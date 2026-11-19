#include "CinemaStorage.hpp"
#include "CinemaAssets.hpp"
#include "CinemaPolicy.hpp"
#include "bsp/m5stack_core_s3.h"
#include "driver/gpio.h"
#include "driver/usb_serial_jtag.h"
#include "esp_heap_caps.h"
#include "esp_lcd_panel_io.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "ff.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include <algorithm>
#include <atomic>
#include <cerrno>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <fcntl.h>
#include <memory>
#include <sys/stat.h>
#include <unistd.h>

namespace {
#ifdef CINEMA_MEDIA_SHARDED
#define CINEMA_CARD_DIR "/CINEMA3"
constexpr bool SHARDED = true;
#else
#define CINEMA_CARD_DIR "/CINEMA"
constexpr bool SHARDED = false;
#endif
bool movie_path(unsigned id, char *out, size_t size) {
  char relative[32];
  if (!cinema::film_path(id, SHARDED, relative, sizeof(relative)))
    return false;
  const auto n = snprintf(out, size, "%s/%s", BSP_SD_MOUNT_POINT, relative);
  return n > 0 && size_t(n) < size;
}
esp_lcd_panel_io_handle_t lcd_io = nullptr;
std::atomic<bool> ready{false}, mounted{false};
std::atomic<unsigned> read_waits{0};
std::atomic<uint32_t> access_max_us{0}, drain_max_us{0};
std::atomic<uint32_t> open_max_us{0}, read_max_us{0};
void observe(std::atomic<uint32_t> &maximum, uint32_t value) {
  auto previous = maximum.load();
  while (previous < value && !maximum.compare_exchange_weak(previous, value)) {
  }
}
// CoreS3 uses GPIO35 for both LCD D/C (output) and SD MISO (input).
// Holding the LVGL lock prevents new transfers; a synchronous NOP first drains
// the LCD IO queue. Restore the output before releasing the lock, even on
// errors.
struct CardAccess {
  bool locked = false, ok = false;
  int64_t acquired_at = 0;
  CardAccess() {
    if (lcd_io) {
      if (!bsp_display_lock(100))
        return;
      locked = true;
      acquired_at = esp_timer_get_time();
      if (esp_lcd_panel_io_tx_param(lcd_io, 0x00, nullptr, 0) != ESP_OK)
        return;
      observe(drain_max_us, uint32_t(esp_timer_get_time() - acquired_at));
    }
    ok = gpio_set_direction(BSP_SD_SPI_MISO, GPIO_MODE_INPUT) == ESP_OK;
  }
  ~CardAccess() {
    if (locked) {
      gpio_set_direction(BSP_LCD_DC, GPIO_MODE_OUTPUT);
      observe(access_max_us, uint32_t(esp_timer_get_time() - acquired_at));
      bsp_display_unlock();
    }
  }
};
} // namespace

// Capture the BSP-created LCD IO handle without editing downloaded vendor code.
extern "C" esp_err_t
__real_esp_lcd_new_panel_io_spi(esp_lcd_spi_bus_handle_t,
                                const esp_lcd_panel_io_spi_config_t *,
                                esp_lcd_panel_io_handle_t *);
extern "C" esp_err_t
__wrap_esp_lcd_new_panel_io_spi(esp_lcd_spi_bus_handle_t bus,
                                const esp_lcd_panel_io_spi_config_t *config,
                                esp_lcd_panel_io_handle_t *out) {
  const auto result = __real_esp_lcd_new_panel_io_spi(bus, config, out);
  if (result == ESP_OK && config->cs_gpio_num == BSP_LCD_CS &&
      config->dc_gpio_num == BSP_LCD_DC)
    lcd_io = *out;
  return result;
}
namespace cinema {
void storage_init() {
  // Deselect both devices before SD initialization on their shared bus.
  gpio_set_direction(BSP_LCD_CS, GPIO_MODE_OUTPUT);
  gpio_set_level(BSP_LCD_CS, 1);
  gpio_set_direction(BSP_SD_SPI_CS, GPIO_MODE_OUTPUT);
  gpio_set_level(BSP_SD_SPI_CS, 1);
  bsp_spi_cfg_t spi{};
  // The BSP SD default is only 4000 bytes; subsequent LCD setup reuses this
  // bus.
  spi.max_transfer_sz = 320 * 20 * 2;
  if (bsp_spi_init(&spi) != ESP_OK)
    return;
  esp_vfs_fat_sdmmc_mount_config_t mount{};
  mount.format_if_mount_failed = false;
  mount.max_files = 2;
  mount.allocation_unit_size = 16 * 1024;
  bsp_sdcard_cfg_t config{};
  config.mount = &mount;
  const auto result = bsp_sdcard_sdspi_mount(&config);
  if (result != ESP_OK) {
    ESP_LOGI("Cinema", "SD unavailable (%s); using flash preview",
             esp_err_to_name(result));
    return; // Do not unmount/free the SPI bus needed by the LCD.
  }
  mounted = true;
  const auto *card = bsp_sdcard_get_handle();
  ESP_LOGI("Cinema", "SD mounted name=%s capacity_bytes=%llu sector=%u",
           card->cid.name,
           (unsigned long long)card->csd.capacity * card->csd.sector_size,
           unsigned(card->csd.sector_size));
  FILE *file = fopen(BSP_SD_MOUNT_POINT CINEMA_CARD_DIR "/INDEX.ID", "rb");
  if (file) {
    char digest[67]{};
    const auto size = fread(digest, 1, sizeof(digest), file);
    fclose(file);
    ready =
        size == 65 && digest[64] == '\n' && !memcmp(digest, assets::DIGEST, 64);
  }
  ESP_LOGI("Cinema", "SD index %s",
           ready ? "matches firmware"
                 : "missing or mismatched; using flash preview");
}
bool storage_available() { return ready; }
unsigned storage_contention() { return read_waits.load(); }
void storage_diagnostics() {
  ESP_LOGI("Cinema",
           "sd_window access_max_us=%lu drain_max_us=%lu open_max_us=%lu "
           "read_max_us=%lu",
           (unsigned long)access_max_us.exchange(0),
           (unsigned long)drain_max_us.exchange(0),
           (unsigned long)open_max_us.exchange(0),
           (unsigned long)read_max_us.exchange(0));
}
ReadResult storage_read(unsigned id, uint8_t *output, size_t bytes,
                        bool (*cancelled)()) {
  if (!ready || id >= assets::COUNT || !output ||
      bytes != assets::CLIPS[id].bytes)
    return ReadResult::unavailable;
  // ESP-IDF splits PSRAM reads into individual 512-byte SD commands. An
  // internal DMA buffer permits multi-sector reads without holding the shared
  // display/touch lock across a long series of transactions. Copy to PSRAM
  // after releasing that lock. Each call owns its buffer, including retries.
  constexpr size_t READ_BYTES = 4096;
  std::unique_ptr<uint8_t, decltype(&free)> buffer(
      static_cast<uint8_t *>(
          heap_caps_malloc(READ_BYTES, MALLOC_CAP_INTERNAL | MALLOC_CAP_DMA)),
      free);
  if (!buffer)
    return ReadResult::retry;
  char path[80];
  if (!movie_path(id, path, sizeof(path)))
    return ReadResult::unavailable;
  int file = -1;
  // A busy GUI is not a corrupt movie. Retain partial-read progress while
  // waiting for the shared display/SD bus, and remain promptly cancellable.
  auto access = [&](auto operation) {
    return retry_card_access(
        [&] {
          CardAccess card;
          if (!card.ok) {
            ++read_waits;
            return false;
          }
          operation();
          return true;
        },
        [&] { return cancelled && cancelled(); }, esp_timer_get_time,
        [] { vTaskDelay(1); });
  };
  auto result = access([&] {
    const auto began = esp_timer_get_time();
    file = open(path, O_RDONLY);
    observe(open_max_us, uint32_t(esp_timer_get_time() - began));
  });
  if (result != ReadResult::ok)
    return result;
  if (file < 0)
    return ReadResult::unavailable;
  size_t offset = 0;
  while (offset < bytes) {
    ssize_t n = 0;
    result = access([&] {
      // GPIO35 is shared with LCD D/C. Long reads also prevent LVGL from
      // polling touch; on real cards 8 KiB held this lock for up to 269 ms.
      const auto began = esp_timer_get_time();
      n = read(file, buffer.get(), std::min(READ_BYTES, bytes - offset));
      observe(read_max_us, uint32_t(esp_timer_get_time() - began));
    });
    if (result != ReadResult::ok)
      break;
    if (n <= 0) {
      result = ReadResult::unavailable;
      break;
    }
    memcpy(output + offset, buffer.get(), n);
    offset += n;
    // Short chunks keep the UI and Stop button serviceable while loading.
    vTaskDelay(1);
  }
  if (result == ReadResult::ok && offset == bytes) {
    uint8_t extra = 0;
    ssize_t n = -1;
    result = access([&] { n = read(file, &extra, 1); });
    if (result == ReadResult::ok && n != 0)
      result = ReadResult::unavailable;
  }
  // Read-only close never flushes data writes, including on cancellation.
  close(file);
  return result;
}
namespace {
bool checksum(const char *path, size_t expected, uint32_t &crc) {
  CardAccess access;
  if (!access.ok)
    return false;
  const int file = open(path, O_RDONLY);
  if (file < 0)
    return false;
  uint8_t buffer[2048];
  size_t total = 0;
  crc = 0;
  ssize_t n = 0;
  while ((n = read(file, buffer, sizeof(buffer))) > 0) {
    if (total + n > expected) {
      close(file);
      return false;
    }
    crc = esp_rom_crc32_le(crc, buffer, n);
    total += n;
  }
  const bool ok = total == expected && n == 0;
  close(file);
  return ok;
}
bool receive(uint8_t *data, size_t bytes) {
  const int64_t deadline = esp_timer_get_time() + 15000000;
  size_t offset = 0;
  while (offset < bytes && esp_timer_get_time() < deadline) {
    const int n = usb_serial_jtag_read_bytes(data + offset, bytes - offset,
                                             pdMS_TO_TICKS(100));
    if (n > 0)
      offset += n;
  }
  return offset == bytes;
}
} // namespace
bool storage_command(const char *line) {
  if (!mounted) {
    printf("CINEMA ERROR card-not-mounted\n");
    return true;
  }
  if (!strcmp(line, "info")) {
    uint64_t total = 0, free = 0;
    CardAccess access;
    if (!access.ok ||
        esp_vfs_fat_info(BSP_SD_MOUNT_POINT, &total, &free) != ESP_OK)
      printf("CINEMA ERROR capacity\n");
    else
      printf("CINEMA CARD total=%llu free=%llu ready=%d digest=%s count=%u\n",
             (unsigned long long)total, (unsigned long long)free,
             int(ready.load()), assets::DIGEST, assets::COUNT);
    return true;
  }
  unsigned id = 0, bytes = 0, expected = 0;
  int consumed = 0;
  if (sscanf(line, "put %u %u %x%n", &id, &bytes, &expected, &consumed) == 3 &&
      line[consumed] == 0 && id < assets::COUNT &&
      bytes == assets::CLIPS[id].bytes && bytes <= MAX_FILM) {
    char path[80];
    if (!movie_path(id, path, sizeof(path))) {
      printf("CINEMA ERROR path\n");
      return true;
    }
    uint32_t actual = 0;
    if (checksum(path, bytes, actual) && actual == expected) {
      printf("CINEMA SKIP %u\n", id);
      return true;
    }
    ready = false;
    constexpr char TEMP[] = BSP_SD_MOUNT_POINT CINEMA_CARD_DIR "/UPLOAD.TMP";
    int file = -1;
    {
      CardAccess access;
      if (access.ok) {
        mkdir(BSP_SD_MOUNT_POINT CINEMA_CARD_DIR, 0755);
        if (SHARDED) {
          char directory[64];
          snprintf(directory, sizeof(directory),
                   BSP_SD_MOUNT_POINT CINEMA_CARD_DIR "/%02X", id / 256);
          mkdir(directory, 0755);
        }
        file = open(TEMP, O_WRONLY | O_CREAT | O_TRUNC, 0644);
      }
    }
    if (file < 0) {
      printf("CINEMA ERROR open\n");
      return true;
    }
    printf("CINEMA READY %u 4096\n", id);
    fflush(stdout);
    size_t written = 0;
    const auto began = esp_timer_get_time();
    int64_t write_us = 0;
    uint8_t buffer[4096];
    bool ok = true;
    const char *failure = "none";
    int io_error = 0;
    while (written < bytes) {
      const size_t n = std::min(sizeof(buffer), size_t(bytes - written));
      if (!receive(buffer, n)) {
        ok = false;
        failure = "receive-timeout";
        break;
      }
      {
        CardAccess access;
        const auto start = esp_timer_get_time();
        ok = access.ok && write(file, buffer, n) == ssize_t(n);
        if (!ok) {
          failure = access.ok ? "write" : "display-lock";
          io_error = access.ok ? errno : 0;
        }
        write_us += esp_timer_get_time() - start;
      }
      if (!ok)
        break;
      written += n;
      printf("CINEMA ACK %u\n", unsigned(written));
      fflush(stdout);
    }
    {
      CardAccess access;
      if (access.ok) {
        if (close(file)) {
          ok = false;
          failure = "close";
          io_error = errno;
        }
      } else {
        mounted = false;
        ok = false; /* Do not flush writes onto an unlocked LCD bus. */
        failure = "close-lock";
      }
    }
    const auto verify_start = esp_timer_get_time();
    if (ok && (!checksum(TEMP, bytes, actual) || actual != expected)) {
      ok = false;
      failure = "readback-or-crc";
    }
    ESP_LOGI("Cinema",
             "SD transfer bytes=%u write_ms=%u verify_ms=%u total_ms=%u", bytes,
             unsigned(write_us / 1000),
             unsigned((esp_timer_get_time() - verify_start) / 1000),
             unsigned((esp_timer_get_time() - began) / 1000));
    {
      CardAccess access;
      if (!access.ok)
        ok = false;
      else if (ok) {
        // Replace only this app's numbered film, after complete readback.
        // A reset mid-copy leaves a .TMP and the prior numbered file intact.
        constexpr char BACKUP[] =
            BSP_SD_MOUNT_POINT CINEMA_CARD_DIR "/UPLOAD.BAK";
        unlink(BACKUP);
        const bool had_old = rename(path, BACKUP) == 0;
        ok = rename(TEMP, path) == 0;
        if (!ok && had_old)
          rename(BACKUP, path);
        if (ok && had_old)
          unlink(BACKUP);
      }
      if (access.ok && !ok)
        unlink(TEMP);
    }
    printf(ok ? "CINEMA DONE %u %08x\n"
              : "CINEMA ERROR write-or-checksum %u %08x\n",
           id, unsigned(actual));
    if (!ok)
      ESP_LOGW("Cinema", "Upload failed id=%u offset=%u stage=%s errno=%d", id,
               unsigned(written), failure, io_error);
    return true;
  }
  if (!strcmp(line, "commit")) {
    CardAccess access;
    auto *seen = static_cast<bool *>(heap_caps_calloc(
        assets::COUNT, sizeof(bool), MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
    bool ok = access.ok && seen;
    unsigned found = 0;
    // A stat() per file repeatedly walks the FAT directory, becoming quadratic.
    // As with the free-space query, the SD card is our first FatFs volume.
    const unsigned directories = SHARDED ? (assets::COUNT + 255) / 256 : 1;
    for (unsigned group = 0; ok && group < directories; ++group) {
      FF_DIR directory{};
      char name[32] = "0:" CINEMA_CARD_DIR;
      if (SHARDED)
        snprintf(name, sizeof(name), "0:" CINEMA_CARD_DIR "/%02X", group);
      const bool opened = f_opendir(&directory, name) == FR_OK;
      ok = opened;
      while (ok) {
        FILINFO info{};
        if (f_readdir(&directory, &info) != FR_OK) {
          ok = false;
          break;
        }
        if (!info.fname[0])
          break;
        const int id = film_index(info.fname, assets::COUNT);
        if (id < 0 || (info.fattrib & AM_DIR) ||
            (SHARDED && unsigned(id) / 256 != group))
          continue;
        if (seen[id] || info.fsize != assets::CLIPS[id].bytes) {
          ok = false;
          break;
        }
        seen[id] = true;
        ++found;
      }
      if (opened && f_closedir(&directory) != FR_OK)
        ok = false;
    }
    free(seen);
    ok = ok && found == assets::COUNT;
    if (ok) {
      FILE *file = fopen(BSP_SD_MOUNT_POINT CINEMA_CARD_DIR "/INDEX.ID", "wb");
      if (!file)
        ok = false;
      else {
        ok = fprintf(file, "%s\n", assets::DIGEST) == 65;
        if (fclose(file))
          ok = false;
      }
    }
    ready = ok;
    printf(ok ? "CINEMA COMMITTED %s\n" : "CINEMA ERROR incomplete-pack %s\n",
           assets::DIGEST);
    return true;
  }
  printf("CINEMA ERROR command\n");
  return true;
}

} // namespace cinema
