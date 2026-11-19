"""Decode a complete USB RGB565 screenshot into a PNG without changing its pixels.

Uses only Python's standard library. Input logs can contain private transcripts;
only the selected framebuffer is written to the output, with no text metadata.
"""

import argparse
import re
import struct
import zlib
from pathlib import Path


def decode(text: str, index: int = -1) -> bytes:
    captures = re.findall(
        r"LVGL_RGB565 (\d+) (\d+) (\d+)\r?\n(.*?)LVGL_END", text, re.S
    )
    if not captures:
        raise ValueError("No complete screenshot; wait for LVGL_END")
    width, height, stride, body = captures[index]
    width, height, stride = int(width), int(height), int(stride)
    if not (0 < width <= 4096 and 0 < height <= 4096 and 2 * width <= stride <= 8192):
        raise ValueError("Invalid framebuffer dimensions")
    pixels = bytes.fromhex("".join(re.findall(r"LVGL_DATA ([0-9a-f]+)", body)))
    if len(pixels) != stride * height:
        raise ValueError("Incomplete pixel data")
    scanlines = bytearray()
    for y in range(height):
        scanlines.append(0)  # PNG filter: none.
        for x in range(width):
            offset = y * stride + 2 * x
            value = pixels[offset] | pixels[offset + 1] << 8
            red, green, blue = value >> 11, (value >> 5) & 63, value & 31
            scanlines.extend(
                (
                    (red << 3) | (red >> 2),
                    (green << 2) | (green >> 4),
                    (blue << 3) | (blue >> 2),
                )
            )

    def chunk(kind: bytes, data: bytes) -> bytes:
        return (
            struct.pack("!I", len(data))
            + kind
            + data
            + struct.pack("!I", zlib.crc32(kind + data))
        )

    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack("!2I5B", width, height, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(scanlines))
        + chunk(b"IEND", b"")
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("log", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument(
        "--index", type=int, default=-1, help="Capture index; default is latest"
    )
    args = parser.parse_args()
    try:
        result = decode(args.log.read_text(errors="replace"), args.index)
    except (ValueError, IndexError) as exc:
        parser.error(str(exc))
    args.output.write_bytes(result)
    print(f"Saved {args.output}")


if __name__ == "__main__":
    main()
