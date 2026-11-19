idf_component_register(SRCS "LiveVoice.cpp" "WifiProfiles.cpp" "ScreenMirror.cpp"
    "../common/fonts/live_font_18.c" "../common/fonts/live_font_22.c"
    "../common/fonts/live_font_28.c" "../common/fonts/live_font_36.c"
    INCLUDE_DIRS "." "../common/fonts"
    PRIV_INCLUDE_DIRS "$ENV{LIVE_VOICE_PRIVATE_DIR}" "../../components/live_esp32"
    REQUIRES brookesia_core bsp_extra system_status live_esp32 esp_wifi esp_event esp_netif esp_driver_usb_serial_jtag)
target_compile_options(${COMPONENT_LIB} PRIVATE -Wno-missing-field-initializers)
