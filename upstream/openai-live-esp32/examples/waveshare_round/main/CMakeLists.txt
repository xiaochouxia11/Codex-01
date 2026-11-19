idf_component_register(SRCS "main.cpp" "Audio.cpp" "../../common/StandaloneWifi.cpp" "View.cpp"
    "../../common/fonts/live_font_16.c" "../../common/fonts/live_font_18.c"
    "../../common/fonts/live_font_22.c" "../../common/fonts/live_font_28.c"
    INCLUDE_DIRS "." "../../common" "../../common/fonts"
    PRIV_INCLUDE_DIRS "$ENV{LIVE_VOICE_PRIVATE_DIR}"
    REQUIRES live_esp32 esp32_s3_touch_amoled_1_75 esp_wifi esp_event esp_netif
        nvs_flash esp_driver_usb_serial_jtag esp_app_format)
target_compile_options(${COMPONENT_LIB} PRIVATE -Wall -Wextra -Wno-missing-field-initializers)
