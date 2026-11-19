# Shared Roboto UI fonts

The Waveshare and M5Stack Live Voice apps use **Roboto Medium 2.138**, licensed
under [Apache-2.0](LICENSE). These are generated, uncompressed 4-bpp LVGL bitmap
subsets. Waveshare uses 18, 22, 28, and 36 px; M5Stack uses 16, 18, and 22 px. The SDK and
screenless Sonatino app do not depend on these fonts. See [NOTICE](NOTICE) for
copyright and modification attribution.

The subsets include ASCII, Latin-1 Supplement, Latin Extended-A, common
punctuation (including smart quotes, ellipsis, and dashes), euro/trademark,
up/down arrows, and mathematical minus. Narrow no-break space uses the
thin-space bitmap; nonbreaking hyphen uses the hyphen bitmap. Both retain their
original Unicode codepoints. Line heights at 16/18/22/28/36 px are 21/23/27/36/46 px,
including accent and descender bounds. Captions use 36 px on Waveshare and
22 px on M5Stack. Caption line spacing remains zero; turn spacing is 4 px on Waveshare and 2 px on M5Stack.

Before pagination, a display-only transcript copy goes through `CaptionText.hpp`:

1. Keep printable ASCII and Unicode glyphs present in the selected font.
2. Simplify known unsupported punctuation, spaces, and Latin letters to ASCII.
   Roboto 2 lacks left/right arrows, so those display as `<-` / `->`. Drop
   unsupported combining accents, joiners, and variation selectors.
3. Replace other unsupported scalars or malformed bytes with `?`.

The SDK's original UTF-8 transcript is unchanged. Replacements never expand the
byte buffer. CJK, other scripts, and emoji need additional fonts and, where
applicable, shaping support. No TTF parser or decompressor runs on the device.

## Pinned source and regeneration

Use the **unhinted v2.138 release of Roboto 2**, not Roboto 3 or a moving branch.
The archive includes the Apache-2.0 license; its font metadata also names that
license, version 2.138, copyright 2011 Google Inc., and designer Christian
Robertson. The generator verifies both source hashes, the license hash, and
`lv_font_conv` 1.5.3 before writing any font files.

| Input | Source / SHA-256 |
| --- | --- |
| `roboto-unhinted.zip` | [Roboto 2 v2.138 release asset](https://github.com/googlefonts/roboto-2/releases/download/v2.138/roboto-unhinted.zip) |
| Archive hash | `70f64c718510a601fbcf752aafe644314dacaeb85474dc689c89787c4a72a728` |
| `Roboto-Medium.ttf` | `b398bb9c791ddb08f1063d9c874f98e8aadb99132043b2d272a9276cf90c465a` |
| Archive `LICENSE` (copied verbatim here) | `c71d239df91726fc519c6eb72d318ec65820627232b2f796219e87dcf35d0ab4` |

From the repository root, keep the downloaded source and converter outside the
checkout:

```sh
mkdir -p "$HOME/.cache/live-font-tools"
curl -fL https://github.com/googlefonts/roboto-2/releases/download/v2.138/roboto-unhinted.zip \
  -o "$HOME/.cache/live-font-tools/roboto-unhinted-v2.138.zip"
npm install --prefix "$HOME/.cache/live-font-tools" --ignore-scripts \
  --no-audit --no-fund --save-exact lv_font_conv@1.5.3
python tools/generate_caption_font.py \
  --archive "$HOME/.cache/live-font-tools/roboto-unhinted-v2.138.zip" \
  --converter "$HOME/.cache/live-font-tools/node_modules/.bin/lv_font_conv"
python -m unittest discover -s tests -p 'test_caption_font.py'
```

Generated C files are checked in, contain no local paths, and need no converter
or font download during normal builds. Tests inspect actual character maps and
bitmap bounds at every size; shared fallback tests cover horizontal arrows.

These notices apply to the Live Voice app fonts. The separately downloaded
launcher/LVGL may still contain OFL-licensed Montserrat and other fonts/assets;
they retain their own licenses. This does not make the complete vendor firmware
OFL-free.
