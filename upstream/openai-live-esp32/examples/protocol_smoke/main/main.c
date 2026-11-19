#include "esp_chip_info.h"
#include "esp_heap_caps.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "test_live.h"

#include <stdio.h>

void app_main(void) {
  esp_chip_info_t chip;
  esp_chip_info(&chip);
  printf("Live protocol smoke: target=esp32s3 cores=%d\n", chip.cores);
  int failed = chip.model != CHIP_ESP32S3 || chip.cores != 2;
  failed += live_run_tests(true);
  size_t before = heap_caps_get_free_size(MALLOC_CAP_8BIT);
  for (int i = 0; i < 100 && !failed; ++i)
    failed += live_run_tests(false);
  size_t after = heap_caps_get_free_size(MALLOC_CAP_8BIT);
  if (before != after || !heap_caps_check_integrity_all(true))
    ++failed;
  printf("100 repeated suites: heap_before=%u heap_after=%u stack_free=%u\n",
         (unsigned)before, (unsigned)after,
         (unsigned)uxTaskGetStackHighWaterMark(NULL));
  puts(failed ? "LIVE_TESTS_FAIL" : "LIVE_TESTS_PASS");
  fflush(stdout);
  for (;;)
    vTaskDelay(pdMS_TO_TICKS(1000));
}
