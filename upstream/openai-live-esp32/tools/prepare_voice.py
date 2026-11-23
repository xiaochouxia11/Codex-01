#!/usr/bin/env python3
"""Fetch pinned launcher/peer sources and apply our small integration overlay.

The vendor checkout, generated credential header, assets, and firmware stay in
an external cache. No binary assets or credentials are copied into this repo.
"""

# Standalone ESP-IDF bootstrap: downloads only pinned public GitHub sources.

import argparse
import concurrent.futures
import hashlib
import json
import os
import shutil
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

WAVESHARE = "78e13f852929c2ab4f9d5e0ad1c50ea378dbf2b4"
BSP = "30d0ac3b8b6b27ebd402c5852819cbe0dab92749"
AUDIO_PLAYER = "3cfeb3459e6c9be8055b507f520b2f5e8800b742"  # v1.1.0
SDK = Path(__file__).resolve().parents[1]
WAVESHARE_EXCLUDED_DIRS = (
    "firmware/brookesia/components/XiaozhiApp/",
    "firmware/brookesia/spiffs/xiaozhi/",
)


def fetch(repo, commit, prefix, destination, excluded_dirs=()):
    # Authentication is optional and sent only to the GitHub API, never to
    # source downloads. It avoids the shared anonymous API rate limit.
    headers = {"Accept": "application/vnd.github+json"}
    token = os.environ.get("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(
        f"https://api.github.com/repos/{repo}/git/trees/{commit}?recursive=1",
        headers=headers,
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            tree = json.load(response)
    except urllib.error.HTTPError as exc:
        if exc.code in (403, 429):
            raise RuntimeError(
                "GitHub API access was limited; retry later or set GITHUB_TOKEN "
                "with permission to read public repositories"
            ) from None
        raise
    if tree.get("truncated"):
        raise RuntimeError("Incomplete upstream tree")
    files = [
        x
        for x in tree["tree"]
        if x["type"] == "blob"
        and not any(x["path"].startswith(path) for path in excluded_dirs)
        and (
            x["path"].startswith(prefix)
            or x["path"].upper() in ("LICENSE", "NOTICE", "COPYING", "README.MD")
        )
    ]

    def download(entry):
        path = destination / entry["path"]

        def digest(data):
            return hashlib.sha1(
                b"blob " + str(len(data)).encode() + b"\0" + data
            ).hexdigest()

        if path.exists() and digest(path.read_bytes()) == entry["sha"]:
            return
        url = (
            f"https://raw.githubusercontent.com/{repo}/{commit}/"
            + urllib.parse.quote(entry["path"])
        )
        data = urllib.request.urlopen(url, timeout=60).read()
        if digest(data) != entry["sha"]:
            raise RuntimeError(f"Upstream checksum mismatch: {entry['path']}")
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)

    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        list(pool.map(download, files))
    print(f"Verified {len(files)} files from {repo}@{commit}")


def write_modified(path, text):
    """Retain upstream notices and identify every file changed by the overlay."""
    notice = "Modified by OpenAI for openai-live-esp32."
    if path.suffix in (".c", ".cpp", ".h", ".hpp"):
        marker = f"/* {notice} Upstream license and copyright notices follow. */\n"
    else:
        marker = f"# {notice} Upstream license and copyright notices follow.\n"
    if not text.startswith(marker):
        text = marker + text
    path.write_text(text)


def replace(path, old, new):
    text = path.read_text()
    if text.count(old) != 1:
        raise RuntimeError(f"Integration anchor changed in {path}: {old[:60]}")
    write_modified(path, text.replace(old, new))


def remove_xiaozhi(root):
    """Exclude the unused vendor assistant and its separately licensed assets."""
    # IDF discovers manifests under every component directory, even when an app
    # is not registered in the launcher. Remove stale copies from older caches
    # as well as excluding them from new downloads.
    for relative in ("components/XiaozhiApp", "spiffs/xiaozhi"):
        path = root / relative
        if path.is_symlink():
            path.unlink()
        elif path.exists():
            shutil.rmtree(path)
    source = root / "main/main.cpp"
    replace(source, '#include "XiaozhiApp.hpp"\n', "")
    replace(
        source,
        "        ESP_UTILS_CHECK_FALSE_EXIT(\n"
        '            install_app(phone, apps::XiaozhiApp::requestInstance(), "Xiaozhi"), "Install Xiaozhi failed"\n'
        "        );\n",
        "",
    )
    cmake = root / "v2/main/CMakeLists.txt"
    replace(cmake, "        XiaozhiApp\n", "")
    start = "idf_build_get_property(build_components BUILD_COMPONENTS)\n"
    end = "# Staging is intentionally unconditional."
    text = cmake.read_text()
    if text.count(start) != 1 or text.count(end) != 1:
        raise RuntimeError("Xiaozhi font staging anchors changed")
    replace(cmake, text[text.index(start) : text.index(end)], "")
    replace(
        cmake,
        '    COMMAND "${CMAKE_COMMAND}" -E make_directory "${STORAGE_STAGING_DIR}/xiaozhi"\n'
        '    COMMAND "${CMAKE_COMMAND}" -E copy_if_different\n'
        '        "${XIAOZHI_COMMON_FONT}" "${STORAGE_STAGING_DIR}/xiaozhi/font.bin"\n',
        # Also exclude Xiaozhi assets added to the source filesystem after prep.
        '    COMMAND "${CMAKE_COMMAND}" -E rm -rf "${STORAGE_STAGING_DIR}/xiaozhi"\n',
    )
    defaults = root / "sdkconfig.defaults"
    write_modified(
        defaults,
        "".join(
            line
            for line in defaults.read_text().splitlines(keepends=True)
            if not line.startswith(("CONFIG_XIAOZHI_", "CONFIG_SR_WN_"))
        ),
    )
    project = "project(esp32-s3-touch-amoled-1-8-brookesia-v2)"
    replace(
        root / "v2/CMakeLists.txt",
        project,
        project + "\n\n"
        "# Do not silently reintroduce the excluded vendor app or its assets.\n"
        "idf_build_get_property(live_components BUILD_COMPONENTS)\n"
        "foreach(component IN LISTS live_components)\n"
        '    if(component MATCHES "(^|__)(XiaozhiApp|xiaozhi-fonts|esp_xiaozhi)$")\n'
        '        message(FATAL_ERROR "Excluded Xiaozhi component: ${component}")\n'
        "    endif()\n"
        "endforeach()",
    )


def patch_wav_player(player, root):
    """Keep the launcher's WAV player without resolving or linking Helix MP3."""
    replace(
        player / "audio_player.cpp",
        '#include "audio_mp3.h"',
        '#if defined(CONFIG_AUDIO_PLAYER_ENABLE_MP3)\n#include "audio_mp3.h"\n#endif',
    )
    replace(
        player / "audio_player.cpp",
        "    /** See https://github.com/ultraembedded/libhelix-mp3/blob/0a0e0673f82bc6804e5a3ddb15fb6efdcde747cd/testwrap/main.c#L74 */\n"
        "    i->output.samples_capacity = MAX_NCHAN * MAX_NGRAN * MAX_NSAMP;",
        "    // Preserve the WAV read chunk and the 2x mono-to-stereo reserve below,\n"
        "    // without depending on MP3 decoder headers for the buffer size.\n"
        "    i->output.samples_capacity = 2304;",
    )
    replace(
        player / "idf_component.yml",
        '  chmorgan/esp-libhelix-mp3: ">=1.0.0,<2.0.0"\n',
        "",
    )
    replace(
        player / "CMakeLists.txt",
        '    list(APPEND srcs "audio_mp3.cpp")',
        '    message(FATAL_ERROR "This WAV-only profile does not support MP3")',
    )
    replace(
        player / "CMakeLists.txt",
        "# TODO: move inside of the 'if(CONFIG_AUDIO_PLAYER_ENABLE_MP3)' when everything builds correctly\n"
        'list(APPEND requires "esp-libhelix-mp3")',
        "# WAV playback has no external decoder dependency.",
    )
    replace(
        player / "Kconfig",
        '        bool "Enable mp3 decoding."\n        default y\n'
        "        help\n            The audio player can play mp3 files using libhelix-mp3.",
        "        bool\n        default n",
    )
    replace(
        root / "components/bsp_extra/idf_component.yml",
        '    version: "1.1.0"',
        f'    version: "1.1.0"\n    override_path: "{player}"',
    )
    board = root / "components/bsp_extra/src/bsp_board_extra.c"
    replace(
        board,
        '    return extension && (strcasecmp(extension, ".mp3") == 0 ||\n'
        '                         strcasecmp(extension, ".wav") == 0);',
        '    return extension && strcasecmp(extension, ".wav") == 0;',
    )
    replace(
        board, "Only MP3 and WAV files are supported", "Only WAV files are supported"
    )
    header = root / "components/bsp_extra/include/bsp_board_extra.h"
    write_modified(header, header.read_text().replace("MP3/WAV", "WAV"))
    music = root / "components/MusicPlayer/MusicPlayer.cpp"
    replace(music, "No MP3/WAV tracks found", "No WAV tracks found")


def load_wifi(path):
    """Accept the original single-network format or up to eight saved networks."""
    if path is None:
        return []
    data = json.loads(path.read_text())
    networks = data.get("networks", [data]) if isinstance(data, dict) else data
    if not isinstance(networks, list) or not 1 <= len(networks) <= 8:
        raise ValueError("Wi-Fi configuration needs one to eight networks")
    seen = set()
    for network in networks:
        if not isinstance(network, dict):
            raise ValueError("Each Wi-Fi network needs ssid and password strings")
        ssid, password = network.get("ssid"), network.get("password")
        if not isinstance(ssid, str) or not isinstance(password, str):
            raise ValueError("Each Wi-Fi network needs ssid and password strings")
        if "\0" in ssid or "\0" in password or not 1 <= len(ssid.encode()) <= 32:
            raise ValueError("Invalid Wi-Fi SSID or embedded NUL")
        if password and not 8 <= len(password.encode()) <= 63:
            raise ValueError("Wi-Fi passwords must be empty or 8–63 bytes")
        if ssid in seen:
            raise ValueError("Duplicate Wi-Fi SSID")
        seen.add(ssid)
    return networks


def write_secrets(private, key, networks):
    private.mkdir(parents=True, exist_ok=True, mode=0o700)
    private.chmod(0o700)
    values = {
        "LIVE_API_KEY": key,
        "LIVE_MODEL": os.environ.get("LIVE_MODEL", "gpt-live-1.1"),
        "LIVE_RESPONSES_MODEL": os.environ.get("LIVE_RESPONSES_MODEL", "gpt-6-luna"),
    }
    secret_header = private / "live_voice_secrets.h"
    secret_header.touch(mode=0o600)
    secret_header.chmod(0o600)
    rows = networks or [{"ssid": "", "password": ""}]
    secret_header.write_text(
        "#pragma once\n"
        + "\n".join(
            f"static constexpr char {name}[] = {json.dumps(value, ensure_ascii=True)};"
            for name, value in values.items()
        )
        + "\nstruct LiveWifiProfile { const char *ssid; const char *password; };\n"
        + "static constexpr LiveWifiProfile LIVE_WIFI_PROFILES[] = {\n"
        + "\n".join(
            "  {" + json.dumps(row["ssid"]) + ", " + json.dumps(row["password"]) + "},"
            for row in rows
        )
        + f"\n}};\nstatic constexpr unsigned LIVE_WIFI_PROFILE_COUNT = {len(networks)};\n"
    )


def patch_gesture_indicator(root):
    """Allow an app to hide the bottom indicator without disabling gestures."""
    phone = root / "components/brookesia_core/systems/phone"
    replace(
        phone / "esp_brookesia_phone_app.hpp",
        "                    .enable_navigation_gesture = 1,",
        "                    .enable_navigation_gesture = 1,\n"
        "                    .hide_bottom_gesture_indicator = 0,",
    )
    replace(
        phone / "esp_brookesia_phone_app.hpp",
        "                                                                will be enabled. */",
        "                                                                will be enabled. */\n"
        "            uint8_t hide_bottom_gesture_indicator: 1; /*!< Hide only the visual hint, not gesture input. */",
    )
    replace(
        phone / "esp_brookesia_phone_manager.cpp",
        "        _flags.enable_gesture_show_left_right_indicator_bar = _flags.enable_gesture_show_mask_left_right_edge;\n"
        "        _flags.enable_gesture_show_bottom_indicator_bar = _flags.enable_gesture_show_mask_bottom_edge;",
        "        _flags.enable_gesture_show_left_right_indicator_bar = _flags.enable_gesture_show_mask_left_right_edge;\n"
        "        _flags.enable_gesture_show_bottom_indicator_bar = _flags.enable_gesture_show_mask_bottom_edge &&\n"
        "                !app_data->flags.hide_bottom_gesture_indicator;",
    )


def patch_audio_stats(root):
    """Expose TX DMA starvation without logging or taking locks in the ISR."""
    header = root / "components/bsp_extra/include/bsp_board_extra.h"
    replace(
        header,
        "bool bsp_extra_codec_pa_is_enabled(void);",
        "bool bsp_extra_codec_pa_is_enabled(void);\n"
        "/* Monotonic TX completion-queue overflow counter. */\n"
        "uint32_t bsp_extra_audio_tx_empty_events(void);",
    )
    board = root / "components/bsp_extra/src/bsp_board_extra.c"
    replace(
        board, '#include "esp_check.h"', '#include "esp_attr.h"\n#include "esp_check.h"'
    )
    replace(
        board,
        "static i2s_chan_handle_t s_i2s_rx;",
        """static i2s_chan_handle_t s_i2s_rx;
static volatile uint32_t s_live_tx_empty_events;
static bool IRAM_ATTR live_tx_empty(i2s_chan_handle_t channel, i2s_event_data_t *event, void *context)
{
    (void)channel; (void)event; (void)context;
    ++s_live_tx_empty_events;
    return false;
}
uint32_t bsp_extra_audio_tx_empty_events(void) { return s_live_tx_empty_events; }""",
    )
    replace(
        board,
        "    audio_codec_i2s_cfg_t codec_i2s_cfg = {",
        """    const i2s_event_callbacks_t callbacks = { .on_send_q_ovf = live_tx_empty };
    result = i2s_channel_register_event_callback(s_i2s_tx, &callbacks, NULL);
    if (result != ESP_OK) goto fail;

    audio_codec_i2s_cfg_t codec_i2s_cfg = {""",
    )


def patch_wifi_scan(root):
    """Serialize USB diagnostics with the launcher's reconnect worker."""
    header = root / "components/system_status/include/system_status.hpp"
    replace(
        header,
        "esp_err_t request_wifi_connect();",
        "esp_err_t request_wifi_connect();\n\n"
        "/** Blocking scan; count is the record capacity on input and length on output. */\n"
        "esp_err_t scan_wifi(wifi_ap_record_t *records, uint16_t *count);",
    )
    source = root / "components/system_status/system_status.cpp"
    replace(
        source,
        "                result = esp_wifi_start();",
        """                // Search every channel before choosing an AP, including
                // the saved NVS profile used for the first connection on boot.
                wifi_config_t config{};
                result = esp_wifi_get_config(WIFI_IF_STA, &config);
                if (result != ESP_OK) {
                    return result;
                }
                if (config.sta.ssid[0] != 0) {
                    config.sta.scan_method = WIFI_ALL_CHANNEL_SCAN;
                    config.sta.sort_method = WIFI_CONNECT_AP_BY_SIGNAL;
                    result = esp_wifi_set_config(WIFI_IF_STA, &config);
                    if (result != ESP_OK) {
                        return result;
                    }
                }
                result = esp_wifi_start();""",
    )
    replace(
        source,
        "    esp_err_t requestWifiConnect()",
        """    esp_err_t scanWifi(wifi_ap_record_t *records, uint16_t *count)
    {
        if (records == nullptr || count == nullptr || *count == 0) {
            return ESP_ERR_INVALID_ARG;
        }
        SemaphoreLock api_lock(_api_mutex);
        if (!api_lock.isLocked() || !_running.load() || !_wifi_enabled.load()) {
            return ESP_ERR_INVALID_STATE;
        }
        SemaphoreLock wifi_lock(_wifi_mutex);
        if (!wifi_lock.isLocked() || !_wifi_started.load()) {
            return ESP_ERR_INVALID_STATE;
        }

        // A pending connect aborts scans. Hold the same lock used by the
        // reconnect worker until both the scan and result retrieval finish.
        _manual_wifi_configuration.store(true);
        _wifi_reconnect_requested.store(false);
        wifi_ap_record_t associated{};
        esp_err_t result = ESP_OK;
        if (esp_wifi_sta_get_ap_info(&associated) != ESP_OK) {
            result = esp_wifi_disconnect();
            if (result == ESP_ERR_WIFI_NOT_CONNECT) {
                result = ESP_OK;
            }
        }
        if (result == ESP_OK) {
            wifi_scan_config_t config{};
            config.show_hidden = true;
            result = esp_wifi_scan_start(&config, true);
        }
        if (result == ESP_OK) {
            result = esp_wifi_scan_get_ap_records(count, records);
        }
        if (result != ESP_OK) {
            *count = 0;
            esp_wifi_clear_ap_list();
        }
        _manual_wifi_configuration.store(false);
        if (esp_wifi_sta_get_ap_info(&associated) != ESP_OK) {
            _wifi_reconnect_requested.store(true);
        }
        return result;
    }

    esp_err_t requestWifiConnect()""",
    )
    replace(
        source,
        "esp_err_t request_wifi_connect()",
        """esp_err_t scan_wifi(wifi_ap_record_t *records, uint16_t *count)
{
    return monitor().scanWifi(records, count);
}

esp_err_t request_wifi_connect()""",
    )


def patch_panel(bsp):
    """Use Waveshare's V2 CO5300 wake sequence and expose USB recovery."""
    panel = bsp / "esp32_s3_touch_amoled_1_8.c"
    text = panel.read_text()
    start = text.index("static const co5300_lcd_init_cmd_t lcd_init_cmds[] = {")
    end = text.index("\n};", start) + len("\n};")
    # Pinned V2 Arduino_CO5300: leave sleep before configuring the panel,
    # allow 120 ms for SLPOUT, and disable contrast enhancement.
    text = (
        text[:start]
        + """static const co5300_lcd_init_cmd_t lcd_init_cmds[] = {
    {0x11, NULL, 0, 120},
    {0xFE, (uint8_t[]){0x00}, 1, 0},
    {0xC4, (uint8_t[]){0x80}, 1, 0},
    {0x3A, (uint8_t[]){0x55}, 1, 0},
    {0x53, (uint8_t[]){0x20}, 1, 0},
    {0x63, (uint8_t[]){0xFF}, 1, 0},
    {0x29, NULL, 0, 0},
    {0x51, (uint8_t[]){0xD0}, 1, 0},
    {0x58, (uint8_t[]){0x00}, 1, 10},
};"""
        + text[end:]
    )
    write_modified(panel, text)
    replace(
        panel,
        "    esp_lcd_panel_io_tx_param(io_handle, lcd_cmd, &param, 1);\n\n    return ESP_OK;",
        "    return esp_lcd_panel_io_tx_param(io_handle, lcd_cmd, &param, 1);",
    )
    replace(
        panel,
        "    esp_lcd_panel_reset(panel_handle);\n    esp_lcd_panel_init(panel_handle);",
        "    ESP_ERROR_CHECK(esp_lcd_panel_reset(panel_handle));\n"
        "    vTaskDelay(pdMS_TO_TICKS(200));\n"
        "    ESP_ERROR_CHECK(esp_lcd_panel_init(panel_handle));",
    )
    replace(
        panel,
        "    esp_lcd_panel_disp_on_off(panel_handle, true);",
        "    ESP_ERROR_CHECK(esp_lcd_panel_disp_on_off(panel_handle, true));",
    )
    replace(
        panel,
        "esp_err_t bsp_display_backlight_off(void)",
        """// Caller holds the display lock so LVGL cannot submit frames during reset.
esp_err_t bsp_display_recover(void)
{
    ESP_RETURN_ON_FALSE(panel_handle, ESP_ERR_INVALID_STATE, TAG, "Panel not initialized");
    ESP_RETURN_ON_ERROR(esp_lcd_panel_reset(panel_handle), TAG, "Panel reset failed");
    vTaskDelay(pdMS_TO_TICKS(200));
    ESP_RETURN_ON_ERROR(esp_lcd_panel_init(panel_handle), TAG, "Panel init failed");
    ESP_RETURN_ON_ERROR(esp_lcd_panel_disp_on_off(panel_handle, true), TAG, "Display on failed");
    ESP_RETURN_ON_ERROR(bsp_display_brightness_set(70), TAG, "Brightness failed");
    ESP_LOGI(TAG, "Panel reset, awake, display on, brightness 70%%");
    return ESP_OK;
}

esp_err_t bsp_display_backlight_off(void)""",
    )
    replace(
        bsp / "include/bsp/display.h",
        "esp_err_t bsp_display_brightness_init(void);",
        "esp_err_t bsp_display_brightness_init(void);\n"
        "/** Reset/wake the CO5300. Caller must hold the display lock. */\n"
        "esp_err_t bsp_display_recover(void);",
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--cache", type=Path, default=Path.home() / ".cache/openai-live-esp32"
    )
    parser.add_argument(
        "--key-file", type=Path, help="Private file; otherwise OPENAI_API_KEY"
    )
    parser.add_argument(
        "--wifi-file",
        type=Path,
        help="Private JSON with one network or a networks list",
    )
    args = parser.parse_args()
    key = (
        args.key_file.read_text().strip()
        if args.key_file
        else os.environ.get("OPENAI_API_KEY", "")
    )
    if not key:
        parser.error("Set OPENAI_API_KEY or supply --key-file (value is never printed)")
    try:
        networks = load_wifi(args.wifi_file)
    except ValueError as exc:
        parser.error(str(exc))
    args.cache.mkdir(parents=True, exist_ok=True, mode=0o700)
    args.cache.chmod(0o700)
    private = args.cache / "private"
    write_secrets(private, key, networks)
    vendor = args.cache / "vendor"
    fetch(
        "waveshareteam/ESP32-S3-Touch-AMOLED-1.8",
        WAVESHARE,
        "firmware/brookesia/",
        vendor / "waveshare",
        excluded_dirs=WAVESHARE_EXCLUDED_DIRS,
    )
    from prepare_peer import prepare

    prepare(vendor / "peer")
    fetch(
        "waveshareteam/Waveshare-ESP32-components",
        BSP,
        "bsp/esp32_s3_touch_amoled_1_8/",
        vendor / "board",
    )
    bsp = vendor / "board/bsp/esp32_s3_touch_amoled_1_8"
    player = vendor / "chmorgan__esp-audio-player"
    fetch("chmorgan/esp-audio-player", AUDIO_PLAYER, "", player)
    panel = bsp / "esp32_s3_touch_amoled_1_8.c"
    text = panel.read_text()
    # This CO5300 is QSPI. Registering it as RGB never signals SPI flush
    # completion and deadlocks LVGL while the BSP adds the touch input.
    start = text.index("    const lvgl_port_display_rgb_cfg_t rgb_cfg = {")
    old = "    lv_display_t *disp = lvgl_port_add_disp_rgb(&disp_cfg, &rgb_cfg);"
    end = text.index(old, start) + len(old)
    write_modified(
        panel,
        text[:start]
        + "    lv_display_t *disp = lvgl_port_add_disp(&disp_cfg);"
        + text[end:],
    )
    patch_panel(bsp)
    root = vendor / "waveshare/firmware/brookesia"
    remove_xiaozhi(root)
    patch_wav_player(player, root)
    replace(
        root / "v2/main/idf_component.yml",
        '    version: "2.0.3"',
        f'    version: "2.0.3"\n    override_path: "{bsp}"',
    )
    cmake = root / "v2/CMakeLists.txt"
    replace(
        cmake,
        'set(EXTRA_COMPONENT_DIRS "${CMAKE_CURRENT_LIST_DIR}/../components")',
        "set(LIVE_USE_MANAGED_CJSON ON)\nset(EXTRA_COMPONENT_DIRS\n"
        '  "${CMAKE_CURRENT_LIST_DIR}/../components"\n'
        f'  "{SDK / "components/live"}"\n'
        f'  "{SDK / "components/live_esp32"}"\n'
        f'  "{SDK / "examples/waveshare"}"\n'
        f'  "{SDK / "components/live_peer"}"\n'
        f'  "{vendor / "peer/mbedtls"}"\n)',
    )
    replace(
        root / "v2/main/CMakeLists.txt",
        "    REQUIRES\n",
        "    REQUIRES\n        waveshare\n",
    )
    source = root / "main/main.cpp"
    replace(
        source, '#include "Clock.hpp"', '#include "Clock.hpp"\n#include "LiveVoice.hpp"'
    )
    replace(
        source,
        '        ESP_UTILS_CHECK_FALSE_EXIT(phone->begin(), "Begin phone failed");',
        '        ESP_UTILS_CHECK_FALSE_EXIT(phone->begin(), "Begin phone failed");\n'
        '        ESP_UTILS_CHECK_FALSE_EXIT(install_app(phone, apps::LiveVoice::requestInstance(), "Live Voice"), "Install Live Voice failed");',
    )
    replace(
        source,
        '    ESP_UTILS_LOGI("Brookesia firmware is ready");',
        "    apps::LiveVoice::provisionWifi();\n"
        "    { LvLockGuard guard; systems::base::Context::AppEventData event{apps::LiveVoice::requestInstance()->getId(), systems::base::Context::AppEventType::START, nullptr}; phone->sendAppEvent(&event); }\n"
        '    ESP_UTILS_LOGI("Brookesia firmware is ready");',
    )
    header = root / "components/bsp_extra/include/bsp_board_extra.h"
    replace(
        header,
        "    BSP_EXTRA_AUDIO_OWNER_MAX,",
        "    BSP_EXTRA_AUDIO_OWNER_LIVE,\n    BSP_EXTRA_AUDIO_OWNER_MAX,",
    )
    board = root / "components/bsp_extra/src/bsp_board_extra.c"
    replace(
        board,
        '    case BSP_EXTRA_AUDIO_OWNER_XIAOZHI: return "Xiaozhi";',
        '    case BSP_EXTRA_AUDIO_OWNER_XIAOZHI: return "Xiaozhi";\n    case BSP_EXTRA_AUDIO_OWNER_LIVE: return "Live Voice";',
    )
    patch_gesture_indicator(root)
    patch_audio_stats(root)
    patch_wifi_scan(root)
    defaults = root / "sdkconfig.defaults"
    write_modified(
        defaults,
        defaults.read_text()
        + "\n"
        + (SDK / "examples/waveshare/sdkconfig.defaults").read_text(),
    )
    # This is our generated cache checkout; regenerate config from pinned defaults.
    (root / "v2/sdkconfig").unlink(missing_ok=True)
    print(f"Prepared launcher: {root / 'v2'}")
    print(f"Build with LIVE_VOICE_PRIVATE_DIR={private} in an ESP-IDF 5.5 environment.")


if __name__ == "__main__":
    main()
