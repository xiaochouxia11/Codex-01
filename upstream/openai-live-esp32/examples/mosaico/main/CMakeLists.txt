idf_component_register(SRCS "main.cpp" "Audio.cpp" "Camera.cpp" "Hardware.cpp" "View.cpp"
    "../../common/StandaloneWifi.cpp" "../../common/fonts/live_font_18.c"
    "../../common/fonts/live_font_28.c" "../../common/fonts/live_font_36.c"
    INCLUDE_DIRS "." "../../common" "../../common/fonts"
    PRIV_INCLUDE_DIRS "$ENV{LIVE_VOICE_PRIVATE_DIR}"
    REQUIRES live_esp32 esp-mosaico-bsp mosaico_module_camera mosaico_module_interact
        usb_hs_console esp_driver_jpeg esp_wifi esp_event esp_netif nvs_flash
        esp_app_format esp_psram espressif__cjson mbedtls)
target_compile_options(${COMPONENT_LIB} PRIVATE -Wall -Wextra -Wno-missing-field-initializers)
