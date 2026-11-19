"""Check actual generated cmap entries and bitmap bounds, not glyph comments."""

import re
import unittest
from pathlib import Path

FONTS = Path(__file__).resolve().parents[1] / "examples/common/fonts"


class FontAssertions:
    def setUp(self):
        self.source = (FONTS / f"live_font_{self.size}.c").read_text()
        self.coverage = set()
        tables = re.search(r"cmaps\[\]\s*=\s*\{(.*?)\n\};", self.source, re.DOTALL)[1]
        for table in re.findall(r"\{([^{}]+)\}", tables):
            fields = dict(re.findall(r"\.(\w+)\s*=\s*(\w+)", table))
            start = int(fields["range_start"])
            length = int(fields["range_length"])
            if fields["unicode_list"] == "NULL":
                self.coverage.update(range(start, start + length))
            else:
                name = fields["unicode_list"]
                values = re.search(
                    rf"{name}\[\]\s*=\s*\{{(.*?)\}}", self.source, re.DOTALL
                )[1]
                offsets = [
                    int(value, 16) for value in re.findall(r"0x[0-9a-f]+", values)
                ]
                assert len(offsets) == int(fields["list_length"])
                assert all(offset < length for offset in offsets)
                self.coverage.update(start + offset for offset in offsets)

    def test_repro_punctuation_and_latin(self):
        required = set(range(0x20, 0x7F)) | set(range(0xA0, 0x180))
        required.update(
            map(ord, "“I’d like a goldfish.” ‘Really?’ … – — − € ↑ ↓ ′ ″")
        )
        required.update([0x2011, 0x202F])
        self.assertFalse(required - self.coverage)
        for fallback in "🐟←→":
            self.assertNotIn(ord(fallback), self.coverage)

    def test_ink_fits_line_metrics(self):
        height = int(re.search(r"\.line_height\s*=\s*(\d+)", self.source)[1])
        baseline = int(re.search(r"\.base_line\s*=\s*(\d+)", self.source)[1])
        glyphs = re.search(r"glyph_dsc\[\]\s*=\s*\{(.*?)\n\};", self.source, re.DOTALL)[
            1
        ]
        for glyph in re.findall(r"\{([^{}]+)\}", glyphs):
            fields = dict(re.findall(r"\.(\w+)\s*=\s*(-?\d+)", glyph))
            if not int(fields["box_h"]):
                continue
            y = int(fields["ofs_y"])
            self.assertGreaterEqual(y, -baseline)
            self.assertLessEqual(y + int(fields["box_h"]), height - baseline)

    def test_no_private_generator_paths(self):
        self.assertNotIn("/Users/", self.source)
        self.assertNotIn("/home/", self.source)
        self.assertIn("SPDX-License-Identifier: Apache-2.0", self.source)


for size in (16, 18, 22, 28, 36):
    globals()[f"Font{size}Test"] = type(
        f"Font{size}Test", (FontAssertions, unittest.TestCase), {"size": size}
    )


if __name__ == "__main__":
    unittest.main()
