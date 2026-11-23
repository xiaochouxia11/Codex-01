# Third-party notices

Original SDK/example code and locally maintained portable transport changes are
licensed under [Apache-2.0](LICENSE), with attribution in [NOTICE](NOTICE).
Third-party code, fonts, vendor assets, and libraries retain their own licenses;
the repository's Apache-2.0 license does not relicense them. This is a source
distribution, not a redistributable firmware bundle.

## Portable protocol and WebRTC libraries

| Dependency | Source / version | License and attribution |
| --- | --- | --- |
| libpeer-derived transport | `sepfy/libpeer` at `5b849de378545c31d34759a145413846953e1366` | [MIT, copyright 2021 sepfy](packages/peer/LICENSE.libpeer) |
| Mbed TLS | 3.6.8 (host/S3), 4.1.2 (optional host/Mosaico); device compatibility patches and provenance linked below | [Apache-2.0 OR GPL-2.0-or-later](packages/peer/licenses/LICENSE.mbedtls); Apache-2.0 selected. Additional source-file notices apply. |
| libSRTP | 2.8.1, `6ff02afa8d2dc3f2e8896af391d137c1c66ff6fa` | [BSD-3-Clause](packages/peer/licenses/LICENSE.libsrtp) |
| usrsctp | `c625e21950600460cb5c6075616eb1622df2b06a` | [BSD-3-Clause](packages/peer/licenses/LICENSE.usrsctp), plus individual source-file notices |
| cJSON | Supplied by ESP-IDF for host tests; registry component 1.7.19~2 for the device build | [MIT, copyright Dave Gamble and contributors](https://github.com/DaveGamble/cJSON/blob/v1.7.19/LICENSE) |

See [portable transport provenance](packages/peer/docs/provenance.md) for source
links, archive verification, adaptations, and test-tool dependencies. No
`esp_peer` source or binary is incorporated or linked. The portable package does
not depend on Espressif's restricted peer or audio libraries.

## Waveshare integration and shared UI fonts

| Dependency | Pinned source | License / attribution |
| --- | --- | --- |
| Waveshare launcher and round-board adapter (decoder disabled) | `78e13f852929c2ab4f9d5e0ad1c50ea378dbf2b4` | [Apache-2.0](https://github.com/waveshareteam/ESP32-S3-Touch-AMOLED-1.8/blob/78e13f852929c2ab4f9d5e0ad1c50ea378dbf2b4/LICENSE); nested components and assets retain their own notices |
| Waveshare board components | `30d0ac3b8b6b27ebd402c5852819cbe0dab92749` | [Apache-2.0](https://github.com/waveshareteam/Waveshare-ESP32-components/blob/30d0ac3b8b6b27ebd402c5852819cbe0dab92749/LICENSE) |
| WAV file player | `chmorgan/esp-audio-player` 1.1.0, `3cfeb3459e6c9be8055b507f520b2f5e8800b742` | [Apache-2.0](https://github.com/chmorgan/esp-audio-player/blob/3cfeb3459e6c9be8055b507f520b2f5e8800b742/LICENSE); modified to remove Helix MP3 resolution/linking and disable MP3 playback |
| Shared Roboto bitmap fonts (both Waveshare examples and M5Stack) | Roboto 2 `v2.138`, `Roboto-Medium.ttf` from `roboto-unhinted.zip` | [Apache-2.0](examples/common/fonts/LICENSE), copyright 2011 Google Inc.; [NOTICE](examples/common/fonts/NOTICE), [source and SHA-256 pins](examples/common/fonts/README.md) |
| ESP-IDF | `v5.5.6` | [Apache-2.0 and component-specific licenses](https://github.com/espressif/esp-idf/tree/v5.5.6) |

`tools/prepare_voice.py` applies an integration overlay to the pinned sources.
Wi-Fi/display/audio adaptations include system-status code copyright 2026
Waveshare and board/launcher code copyright Espressif Systems. Upstream copyright
and license headers remain intact. Modified source, configuration, and build
files carry an OpenAI modification notice. The Apache-2.0 license is included in
[`LICENSES/Apache-2.0.txt`](LICENSES/Apache-2.0.txt).

The generated Roboto bitmap fonts are shipped as C source under Apache-2.0; the
TTF and converter are not required for normal builds. These notices cover our
Live Voice fonts, not separately downloaded launcher/LVGL fonts. Those may still
include OFL-licensed Montserrat and other assets with their own terms; this
change does not make the complete vendor firmware OFL-free.

## M5Stack CoreS3 LITE integration

The standalone M5Stack example downloads the public Espressif BSP and uses
ESP-IDF 5.5.6. Its complete registry versions and component hashes are pinned in
[`examples/m5stack/dependencies.lock`](examples/m5stack/dependencies.lock).
The board files are not copied or relicensed in this repository.

| Component(s) and pinned versions | License evidence |
| --- | --- |
| `espressif/m5stack_core_s3` 4.1.0, source commit `299f29dc50455c5d696f576ff69d82d09c5c0e33` | [Apache-2.0](https://github.com/espressif/esp-bsp/blob/299f29dc50455c5d696f576ff69d82d09c5c0e33/bsp/m5stack_core_s3/LICENSE) |
| `esp_codec_dev` 1.5.11; `esp_io_expander` 1.2.1; `esp_io_expander_aw9523` 1.0.0; `esp_lcd_ili9341` 2.1.0; `esp_lcd_touch` 1.2.1; `esp_lcd_touch_ft5x06` 1.1.1; `esp_lvgl_port` 2.9.0 | Apache-2.0 in each downloaded component's `LICENSE` / `license.txt` |
| `lvgl/lvgl` 9.6.0~1 ([registry](https://components.espressif.com/components/lvgl/lvgl/versions/9.6.0~1)) | MIT (`LICENCE.txt`); bundled Montserrat and Font Awesome fonts retain their separate notices |
| `bmi270` 1.1.0; `sensor_hub` 0.1.5; `i2c_bus` 1.5.2; `cmake_utilities` 0.5.3; `esp_cam_sensor` 2.0.1; `esp_sccb_intf` 1.0.0; `usb` 1.4.1; `usb_host_uvc` 2.4.2 | Apache-2.0 top-level texts; retain any additional source-file notices |
| `esp_video` 2.0.1 | [Espressif MIT, restricted to Espressif products](https://components.espressif.com/components/espressif/esp_video/versions/2.0.1/license) |
| `esp_new_jpeg` 1.0.2 | [Espressif MIT, restricted to Espressif products](https://components.espressif.com/components/espressif/esp_new_jpeg/versions/1.0.2/license) |

Camera and sensor packages are transitive BSP dependencies; the app initializes
the GC0308 camera only for on-demand snapshots and uses `esp_new_jpeg` to encode
them. USB-host peripherals remain unused. The adapter still uses
`esp_audio_codec` 2.4.1 under the device-only terms below. The M5Stack example
does not include the Waveshare launcher, Xiaozhi assets, or its media player.

## Round Waveshare integration

The standalone round example downloads `waveshare/esp32_s3_touch_amoled_1_75`
3.0.1 for the 466 × 466 board. Its complete registry versions, sources, and
hashes are pinned in
[`examples/waveshare_round/dependencies.lock`](examples/waveshare_round/dependencies.lock).
No vendor board sources, launcher, Xiaozhi fonts, or media are copied here.

| Component(s) and pinned versions | License / terms |
| --- | --- |
| `waveshare/esp32_s3_touch_amoled_1_75` 3.0.1; `waveshare/esp_lcd_touch_cst9217` 2.0.0 | Apache-2.0 in the downloaded `LICENSE` / `license.txt`; [BSP registry](https://components.espressif.com/components/waveshare/esp32_s3_touch_amoled_1_75/versions/3.0.1) |
| `esp_codec_dev` 1.5.11; `esp_io_expander` 1.2.1; `esp_io_expander_tca9554` 2.0.3; `esp_lcd_co5300` 2.2.0; `esp_lcd_panel_io_additions` 1.0.1~1; `esp_lcd_touch` 1.2.1 | Apache-2.0 in each downloaded component's license file |
| `esp_lvgl_adapter` 0.6.4; `esp_lv_decoder` 0.5.0; `esp_lv_fs` 1.0.1; `esp_mmap_assets` 2.0.1; `button` 4.2.3; `knob` 1.1.0; `cmake_utilities` 0.5.3 | Apache-2.0 in each downloaded component's license file |
| `lvgl/lvgl` 9.6.0~1; shared generated Roboto 2.138 | LVGL MIT with separate bundled-font notices; Roboto Apache-2.0 as documented above |
| `espressif/freetype` 2.14.3~1 | [FreeType License (FTL) selected](https://components.espressif.com/components/espressif/freetype/versions/2.14.3~1/license); preserve `docs/FTL.TXT` and nested notices; FreeType project acknowledgement required for binary distributions using it |
| `espressif/libpng` 1.6.59; `espressif/zlib` 1.3.2~2; `espressif/qoi` 0.20260529.0 | libpng license, zlib license, and MIT respectively, in the downloaded `LICENSE` files |
| `esp_audio_codec` 2.4.1; `esp_new_jpeg` 1.0.2 | Espressif-product-only terms; see the device-only table below |

The adapter resolves FreeType and image/filesystem dependencies even though this
app disables optional FreeType, decoder, filesystem, button, and knob integration.
It uses the committed bitmap fonts and does not load runtime fonts or media.
FreeType acknowledgement: portions of any build using FreeType are copyright
of the FreeType Project (https://www.freetype.org/); all rights reserved.
These downloaded components retain their upstream notices in the external build
cache. Enabling additional features or distributing firmware requires retaining
the applicable notices, including the FTL acknowledgement and nested licenses.

## Sonatino integration

The screenless Sonatino example uses ESP-IDF 5.5.6, the shared protocol and
transport dependencies above, and `esp_audio_codec` 2.4.1 under the device-only
terms below. Its registry versions and hashes are pinned in
[`examples/sonatino/dependencies.lock`](examples/sonatino/dependencies.lock).
Its original board adapter uses the published
[Sonatino 3.1.x pinout](https://sonatino.com/docs/) and the linked ADC/DAC
specifications. No Sonatino hardware design files or Arduino sketches are
redistributed, and this build adds no display, font, launcher, or BSP dependency.

## ESP-Mosaico integration

The ESP32-S31 example uses a separate ESP-IDF 6.2 preview checkout at
[`7b9cc1ac…`](https://github.com/espressif/esp-idf/tree/7b9cc1ac79f865983f59bb8ff3ff43eb74ff1dbe).
Its BSP, module drivers, and USB console are downloaded into an ignored vendor
directory, not copied into this source distribution. Exact source pins and
SHA-256 checks are in [`prepare_mosaico.py`](tools/prepare_mosaico.py); registry
versions, hashes, and sources are in
[`examples/mosaico/dependencies.lock`](examples/mosaico/dependencies.lock).

| Component / source | License / terms |
| --- | --- |
| [Mosaico BSP and modules](https://github.com/esp-mosaico/esp-mosaico-bsp/tree/5f88b91e1be055d1d3674364123b2779a1758377), including its local touch-button component | Apache-2.0, upstream headers retained; camera CMake applies the vendor's documented DVP/PCLK patches to downloaded IDF/sensor sources; preparation marks a local display SPI queue-limit modification for DMA headroom |
| [High-speed USB console](https://github.com/esp-mosaico/esp-mosaico-claw/tree/2654a4a9f76f5d7ea108e4dff7ade7b1df4c1c5c/boards/esp_mosaico/components/usb_hs_console) | Apache-2.0, original headers retained |
| IDF 6.2 preview wrapper with upstream Mbed TLS 4.1.2/TF-PSA-Crypto and Espressif compatibility patches | Apache-2.0 selected, plus bundled per-source notices; see [transport provenance](packages/peer/docs/provenance.md) |
| `esp_audio_codec` 2.6.2; `esp_video` 2.5.0; `esp_new_jpeg` 1.0.2 | Espressif-product-only modified MIT terms in each downloaded `LICENSE`; used only in the Espressif-device example |
| `bmi270_sensor` 0.4.1; `bmm150` 1.1.0 | BMI270 wrapper Apache-2.0 and Bosch BSD-3-Clause (`BSD_LICENSE`); BMM150 BSD-3-Clause |
| `dhara` 1.1.0; `tinyusb` 0.21.0~4; `cjson` 1.7.19~2 | ISC-style Dhara license; MIT TinyUSB; MIT cJSON |
| `bq27220`, `button`, `cmake_utilities`, `esp_cam_sensor`, `esp_codec_dev`, display/touch drivers, `esp_lvgl_adapter`, `esp_lv_decoder`, `esp_lv_fs`, `esp_mmap_assets`, `esp_sccb_intf`, `esp_tinyusb`, `i2c_bus`, `knob`, `led_strip`, `spi_nand_flash`, touch-sensor components, `usb_host_uvc` | Apache-2.0 in the pinned downloaded license files; see the lockfile for every version |
| `espressif/usb` 1.6.1 | [Apache-2.0](https://components.espressif.com/components/espressif/usb/versions/1.6.1/license); USB host library, distinct from the TinyUSB device console |
| LVGL 9.5.0; generated Roboto 2.138 | LVGL MIT with bundled-font notices; existing Roboto Apache-2.0 provenance above |
| FreeType 2.15.0; libpng 1.6.59~1; zlib 1.4.0; qoi 0.20260529.0 | FTL selected; PNG Reference Library License v2; zlib; MIT, respectively; the FreeType acknowledgement and additional-notice requirements in the round-Waveshare inventory also apply |

No vendor runtime font/media pack or prebuilt firmware is distributed here.
The BSP resolves storage and graphics dependencies even where this app does not
initialize their functionality. Preserve the downloaded source notices and
review the actual linked set before distributing a firmware image.

## Device-only dependencies

The following components have terms limited to use with Espressif products.
They belong to the ESP-IDF adapter, board BSP, or inherited launcher, not the
portable transport. Do not redistribute them for use on non-Espressif hardware.

| Component | Reviewed version | Resolved by | License |
| --- | --- | --- | --- |
| `espressif/esp_audio_codec` | 2.4.1 (S3); 2.6.2 (Mosaico) | All seven device examples | [Espressif Modified MIT](https://components.espressif.com/components/espressif/esp_audio_codec/versions/2.4.1/license) |
| `espressif/esp_video` | 2.0.1 (M5Stack/StackChan); 2.5.0 (Mosaico) | Camera examples | [Espressif MIT](https://components.espressif.com/components/espressif/esp_video/versions/2.0.1/license) |
| `espressif/esp_new_jpeg` | 1.0.2 | M5Stack/StackChan and Mosaico camera; Waveshare launcher and round-board adapter; StackChan cinema playback | [Espressif MIT](https://components.espressif.com/components/espressif/esp_new_jpeg/versions/1.0.2/license) |

The inherited launcher also resolves the following components. These versions
record the inspected build, not additional pins: transitive constraints can
resolve differently. Inspect the generated `dependencies.lock`, component
manifests, license files, and individual source notices for the actual build.

| Component(s) and reviewed versions | License evidence |
| --- | --- |
| `lvgl/lvgl` 9.4.0 | MIT (`LICENCE.txt`); bundled fonts/assets can have separate terms |
| `chmorgan/esp-file-iterator` 1.0.0 | Apache-2.0 notices in `file_iterator.c` and its header |
| `espressif/esp_codec_dev` 1.5.11; `esp-dsp` 1.8.0; `esp-lib-utils` 0.3.0 | Apache-2.0 license files |
| `espressif/esp-boost` 0.3.1 | Apache-2.0, with Boost-derived portions under Boost Software License 1.0; both texts are in `license.txt` |
| `espressif/esp_io_expander` 1.2.1; `esp_io_expander_tca9554` 2.0.3; `esp_lcd_co5300` 2.2.0; `esp_lcd_panel_io_additions` 1.0.1~1 | Apache-2.0 license files |
| `espressif/esp_lcd_touch` 1.2.1; `esp_lcd_touch_cst816s` 1.1.2; `esp_lcd_touch_ft5x06` 1.1.1; `esp_lvgl_port` 2.9.0 | Apache-2.0 license files |
| `espressif/avi_player` 2.0.0; `cmake_utilities` 0.5.3; `esp_mmap_assets` 1.3.2; `espressif2022/image_player` 1.1.1 | Apache-2.0 license files |
| `waveshare/pcf85063a` 2.0.0; `waveshare/qmi8658` 2.0.1 | Apache-2.0 license files |

The build downloads the launcher with the vendor Xiaozhi app and its prompt
audio excluded. Its `78/xiaozhi-fonts` package (including Puhui, Font Awesome,
and emoji assets) is not resolved, linked, or staged into the filesystem.
The removed app's `esp_xiaozhi`, `mcp-c-sdk`, `esp_websocket_client`, managed
`mqtt`, `esp_audio_effects`, `gmf_fft`, `esp-sr`, and `dl_fft` dependencies are
also absent from the resolved registry graph. ESP-IDF's own MQTT component is
separate from the removed managed package.

Preparation removes stale Xiaozhi source/prompt directories from reused caches;
ESP-IDF prunes unused managed packages during dependency resolution. Filesystem
staging starts empty and excludes the Xiaozhi directory. The partition layout is
unchanged: the old speech-model partition is unused and receives no image.
See the [upgrade instructions](examples/waveshare/README.md#prepare-and-build).
This exclusion avoids relying on the font package's blanket MIT manifest for
third-party font/image rights; it is not a clearance claim for historical copies.

Other launcher apps, media, and LVGL fonts remain in the external cache. They are
not committed here. A top-level code license is not evidence that every bundled
asset has the same license or is cleared for redistribution. Independently
review these assets before distributing the launcher or its filesystem images.

Earlier builds used `esp_peer` and the launcher's Helix MP3 decoder. The current
overlay removes Helix from the player manifest and CMake dependencies, disables
MP3, and keeps WAV support. The Helix wrapper's Apache license did not relicense
the nested RealNetworks RPSL/RCSL code. Historical firmware retains the
dependencies it was built with; rebuild to obtain the WAV-only profile.

## Redistribution

Preparation verifies pinned Git blob or archive hashes before patching and keeps
upstream notices in the downloaded source. Preserve all applicable license,
copyright, modification, and NOTICE text when redistributing source or binary
components. Review the resolved dependency graph and nested assets rather than
treating this inventory as a blanket license grant. Never distribute builds
containing API keys, Wi-Fi credentials, or private data.

## M5Stack StackChan integration

`examples/stackchan` reuses the M5Stack CoreS3 audio, camera, and display sources
and the same pinned component graph documented in the
[M5Stack inventory](#m5stack-cores3-lite-integration), including the
Espressif-device-only audio/video/JPEG components. StackChan is an ESP32-S3
product. Its exact registry pins are in
[`examples/stackchan/dependencies.lock`](examples/stackchan/dependencies.lock).

The added servo/base and RGB LED protocols adapt M5Stack StackChan-BSP and its FTServo
subdirectory at commit `e2f3b02dbe7f28e26a02adc72bef3aa2c545e4a0` (MIT).
[Source provenance, modifications, and both retained licenses](third_party/stackchan/README.md)
are included. No additional binary library or Arduino runtime is linked.


## Optional StackChan cinema assets

The separate [`examples/stackchan_cinema`](examples/stackchan_cinema/README.md)
uses the same device dependencies as StackChan; its exact pins are in
[`dependencies.lock`](examples/stackchan_cinema/dependencies.lock). Media and
model assets are prepared outside the repository and are not redistributed
with the source release.

| Optional asset | Source and terms | How it is used |
| --- | --- | --- |
| POTION 4M pretrained static embeddings and WordPiece vocabulary | [Pinned upstream model/card, revision `9b3cff412d30be9ae8603fe10224c224f3401869`](https://huggingface.co/minishlab/potion-base-4M/tree/9b3cff412d30be9ae8603fe10224c224f3401869), declared MIT. Exact file SHA-256 pins are in [`tools/cinema_potion.py`](tools/cinema_potion.py). | Optional locally generated 128D int8 firmware model; upstream model card retained in the generated pack. No model weights, tokenizer assets or Model2Vec implementation code are redistributed in this repository. |
| safetensors 0.8.0 | [Apache-2.0 license](https://github.com/safetensors/safetensors/blob/v0.8.0/LICENSE) | Optional host-only preparation dependency for reading the verified pretrained weights without executing model code; not linked into device firmware. |
| Stanford GloVe 6B, 50-dimensional pretrained word vectors | [Stanford distribution](https://nlp.stanford.edu/projects/glove/), [official mirror](https://huggingface.co/stanfordnlp/glove/tree/main); [Open Data Commons PDDL 1.0](https://opendatacommons.org/licenses/pddl/1-0/). Archive SHA-256: `6471382cdd837544bf3ac72497a38715e845897d265b2b424b4761832009c837`. The pretrained data license is distinct from the GloVe project code license. | A bounded vocabulary is normalized, weighted, quantized and compiled into locally built firmware. We do not copy GloVe implementation code. |
| Moving Image Archive film clips | [Archive rights statement](https://www.movingimagearchive.com/about); per-source provenance retained in each generated `catalog.json`. Preparation requires an explicit `public_domain` source status. | Short silent derivatives are placed on a user's card, with a small flash fallback. Check individual source rights before distributing a pack or firmware; the code license does not grant rights to every downloaded asset. |
| NumPy 2.3.5; pyserial 3.5 | [NumPy BSD-3-Clause and bundled notices](https://github.com/numpy/numpy/blob/v2.3.5/LICENSE.txt); [pyserial BSD license](https://github.com/pyserial/pyserial/blob/v3.5/LICENSE.txt) | Optional host preparation and USB copying tools, pinned in `tools/cinema-requirements.txt`; neither library is linked into device firmware. |
