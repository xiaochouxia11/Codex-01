idf_component_register(SRCS "main.cpp" "Audio.cpp" "Camera.cpp" "../../common/StandaloneWifi.cpp" "View.cpp"
    "../../common/fonts/live_font_16.c" "../../common/fonts/live_font_18.c"
    "../../common/fonts/live_font_22.c"
    INCLUDE_DIRS "." "../../common" "../../common/fonts"
    PRIV_INCLUDE_DIRS "$ENV{LIVE_VOICE_PRIVATE_DIR}"
    REQUIRES live_esp32 m5stack_core_s3 esp_video esp_new_jpeg esp_wifi esp_event esp_netif
        nvs_flash esp_driver_usb_serial_jtag esp_app_format)
target_compile_options(${COMPONENT_LIB} PRIVATE -Wall -Wextra -Wno-missing-field-initializers)
