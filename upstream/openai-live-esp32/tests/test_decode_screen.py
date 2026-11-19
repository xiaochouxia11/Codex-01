import importlib.util
import struct
import unittest
import zlib
from pathlib import Path

SPEC = importlib.util.spec_from_file_location(
    "decode_screen", Path(__file__).resolve().parents[1] / "tools/decode_screen.py"
)
assert SPEC and SPEC.loader
decoder = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(decoder)


class ScreenshotTest(unittest.TestCase):
    def test_pixels_and_no_log_metadata(self):
        png = decoder.decode(
            "private log text\nLVGL_RGB565 2 1 6\nLVGL_DATA 00f8e007ffff\nLVGL_END\n"
        )
        self.assertTrue(png.startswith(b"\x89PNG\r\n\x1a\n"))
        self.assertNotIn(b"private log text", png)
        offset, chunks = 8, {}
        while offset < len(png):
            size = struct.unpack_from("!I", png, offset)[0]
            kind = png[offset + 4 : offset + 8]
            data = png[offset + 8 : offset + 8 + size]
            crc = struct.unpack_from("!I", png, offset + 8 + size)[0]
            self.assertEqual(crc, zlib.crc32(kind + data))
            chunks[kind] = data
            offset += size + 12
        self.assertEqual(set(chunks), {b"IHDR", b"IDAT", b"IEND"})
        self.assertEqual(zlib.decompress(chunks[b"IDAT"]), b"\0\xff\0\0\0\xff\0")

    def test_incomplete_or_invalid(self):
        for text in [
            "no capture",
            "LVGL_RGB565 1 1 2\nLVGL_DATA 0000\n",
            "LVGL_RGB565 2 1 4\nLVGL_DATA 0000\nLVGL_END",
            "LVGL_RGB565 9000 1 18000\nLVGL_DATA 0000\nLVGL_END",
        ]:
            with self.subTest(text=text), self.assertRaises(ValueError):
                decoder.decode(text)


if __name__ == "__main__":
    unittest.main()
