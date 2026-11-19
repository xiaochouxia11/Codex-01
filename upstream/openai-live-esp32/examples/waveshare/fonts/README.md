# Shared UI fonts

The Waveshare UI uses the Apache-2.0 Roboto fonts shared with M5Stack in
[`examples/common/fonts`](../../common/fonts/README.md). That directory contains
the generated C files, license, provenance, coverage, and regeneration steps.

`live glyphs-test` shows three local sample pages for ten seconds each, including
the smart-quote reproduction, accents, punctuation, and unsupported-character
fallback. It checks the selected font's real glyph descriptors for missing
glyphs and clipping, and does not send sample text to the API.
