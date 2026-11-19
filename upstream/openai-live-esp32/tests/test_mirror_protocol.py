import importlib.util
import struct
import unittest
import zlib
from pathlib import Path

SPEC = importlib.util.spec_from_file_location(
    "mirror_protocol", Path(__file__).resolve().parents[1] / "tools/mirror_protocol.py"
)
protocol = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(protocol)


def cobs(data):
    output = bytearray(b"\0")
    code_at = 0
    for byte in data:
        if byte:
            output.append(byte)
        if not byte or len(output) - code_at == 255:
            output[code_at] = len(output) - code_at
            code_at = len(output)
            output.append(0)
    output[code_at] = len(output) - code_at
    return bytes(output)


def packet(
    data, seq=1, width=2, height=2, y=0, rows=2, encoding=0, total=None, offset=0
):
    header = protocol.HEADER.pack(
        b"LVM1",
        seq,
        width,
        height,
        y,
        rows,
        encoding,
        len(data) if total is None else total,
        offset,
        len(data),
    )
    body = header + data
    return b"\0" + cobs(body + struct.pack("<I", zlib.crc32(body))) + b"\0"


class MirrorTest(unittest.TestCase):
    def test_fragmentation_and_interleaved_logs(self):
        pixels = bytes.fromhex("00f8e0071f00ffff")
        wire = b"log before\n" + packet(pixels) + b"log after\n"
        for chunk_size in (1, 2, 3, 7, len(wire)):
            log = bytearray()
            decoder = protocol.Decoder(log.extend)
            for start in range(0, len(wire), chunk_size):
                decoder.feed(wire[start : start + chunk_size])
            # Flush the small text tail; real streams also flush at delimiters.
            decoder.feed(b"\0")
            self.assertTrue(decoder.ready)
            self.assertEqual(decoder.pixels, pixels)
            self.assertEqual(decoder.errors, 0)
            self.assertEqual(log, b"log before\nlog after\n")

    def test_rle_and_partial_screen_updates(self):
        decoder = protocol.Decoder()
        decoder.feed(packet(bytes.fromhex("020000f8"), y=0, rows=1, encoding=1))
        self.assertFalse(decoder.ready)
        decoder.feed(packet(bytes.fromhex("1f001f00"), seq=2, y=1, rows=1))
        self.assertTrue(decoder.ready)
        self.assertEqual(decoder.pixels, bytes.fromhex("00f800f81f001f00"))

    def test_missing_fragment_is_repaired_by_next_stripe(self):
        pixels = bytes(range(16))
        decoder = protocol.Decoder()
        decoder.feed(packet(pixels[:4], width=4, total=16))
        decoder.feed(packet(pixels[8:], width=4, total=16, offset=8))
        self.assertFalse(decoder.ready)
        self.assertEqual(decoder.errors, 1)
        decoder.feed(packet(pixels[:8], seq=2, width=4, total=16))
        decoder.feed(packet(pixels[8:], seq=2, width=4, total=16, offset=8))
        self.assertTrue(decoder.ready)
        self.assertEqual(decoder.pixels, pixels)

    def test_corruption_and_truncation_recover(self):
        good = packet(bytes(8))
        for bad in (good[:12], good[:15] + b"\x99" + good[16:], good[1:-1]):
            decoder = protocol.Decoder()
            decoder.feed(bad + b"\0console\n" + good)
            self.assertTrue(decoder.ready)
            self.assertEqual(decoder.pixels, bytes(8))

    def test_invalid_packets_are_bounded(self):
        for bad in (
            packet(bytes(8), width=65535),
            packet(bytes(8), y=2),
            packet(bytes.fromhex("ffff00f8"), encoding=1),
            packet(bytes.fromhex("000000f8"), encoding=1),
            packet(bytes(6)),
            packet(bytes(8), encoding=2),
        ):
            decoder = protocol.Decoder()
            decoder.feed(bad)
            self.assertEqual(decoder.errors, 1)
            self.assertFalse(decoder.ready)
        decoder = protocol.Decoder()
        decoder.feed(b"\xffLVM1" + b"x" * 2000)
        self.assertLessEqual(len(decoder.buffer), protocol.MAX_PACKET)
        decoder.feed(b"\0" + packet(bytes(8)))
        self.assertTrue(decoder.ready)

    def test_cobs_boundaries(self):
        for data in (bytes(300), b"x" * 254, bytes(range(256)) * 3, b"\0x\0"):
            self.assertEqual(protocol.uncobs(cobs(data)), data)


if __name__ == "__main__":
    unittest.main()
