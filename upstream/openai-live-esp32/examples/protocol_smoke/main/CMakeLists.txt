idf_component_register(
    SRCS "main.c" "../../../tests/test_live.c"
    INCLUDE_DIRS "../../../tests"
    REQUIRES live json esp_system heap)
