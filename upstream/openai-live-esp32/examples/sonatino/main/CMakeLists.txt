idf_component_register(SRCS "main.cpp" "Audio.cpp" "../../common/StandaloneWifi.cpp"
    INCLUDE_DIRS "." "../../common"
    PRIV_INCLUDE_DIRS "$ENV{LIVE_VOICE_PRIVATE_DIR}"
    REQUIRES live_esp32 esp_wifi esp_event esp_netif nvs_flash
        esp_driver_gpio esp_driver_i2s esp_driver_usb_serial_jtag esp_app_format)
target_compile_options(${COMPONENT_LIB} PRIVATE -Wall -Wextra -Wno-missing-field-initializers)
