"""Bounded decoder for the Waveshare USB mirror; no third-party dependencies."""

import struct
import zlib

HEADER = struct.Struct("<4sI8H")
MAX_PACKET = 1024


def uncobs(data):
    out = bytearray()
    cursor = 0
    while cursor < len(data):
        code = data[cursor]
        cursor += 1
        if not code or cursor + code - 1 > len(data):
            raise ValueError("Invalid COBS packet")
        out.extend(data[cursor : cursor + code - 1])
        cursor += code - 1
        if code != 255 and cursor < len(data):
            out.append(0)
    return out


class Decoder:
    def __init__(self, log=lambda data: None):
        self.log = log
        self.buffer = bytearray()
        self.discard = False
        self.pending = None
        self.width = self.height = 0
        self.pixels = bytearray()
        self.rows = set()
        self.revision = self.stripes = self.errors = self.wire_bytes = 0

    @property
    def ready(self):
        return bool(self.height and len(self.rows) == self.height)

    def feed(self, data):
        self.buffer.extend(data)
        while 0 in self.buffer:
            end = self.buffer.index(0)
            segment = self.buffer[:end]
            del self.buffer[: end + 1]
            if not self.discard and segment:
                self.segment(segment)
            self.discard = False
        if self.discard:
            self.buffer.clear()
        elif len(self.buffer) >= 5 and self.buffer[1:5] != b"LVM1":
            self.log(bytes(self.buffer))
            self.buffer.clear()
        elif len(self.buffer) > MAX_PACKET:
            self.errors += 1
            self.buffer.clear()
            self.discard = True

    def segment(self, data):
        if data[1:5] != b"LVM1":
            self.log(bytes(data))
            return
        self.wire_bytes += len(data) + 2
        try:
            if len(data) > MAX_PACKET:
                raise ValueError("Oversized packet")
            packet = uncobs(data)
            if len(packet) < HEADER.size + 4:
                raise ValueError("Short packet")
            body, crc = packet[:-4], packet[-4:]
            if zlib.crc32(body) != int.from_bytes(crc, "little"):
                raise ValueError("CRC mismatch")
            magic, sequence, w, h, y, rows, encoding, total, offset, count = (
                HEADER.unpack_from(body)
            )
            if (
                magic != b"LVM1"
                or not (0 < w <= 1024 and 0 < h <= 1024 and w * h <= 512 * 1024)
                or not (0 < rows <= 16 and y + rows <= h)
                or encoding not in (0, 1)
                or not (0 < total <= w * rows * 2)
                or not (0 < count <= 768 and offset + count <= total)
                or len(body) != HEADER.size + count
            ):
                raise ValueError("Invalid dimensions or lengths")
            identity = (sequence, w, h, y, rows, encoding, total)
            if offset == 0:
                self.pending = (identity, bytearray())
            if not self.pending or self.pending[0] != identity:
                raise ValueError("Missing stripe start")
            payload = self.pending[1]
            if offset != len(payload):
                raise ValueError("Missing or duplicated chunk")
            payload.extend(body[HEADER.size :])
            if len(payload) != total:
                return
            self.pending = None
            if encoding == 1:
                if total % 4:
                    raise ValueError("Invalid RLE length")
                decoded = bytearray()
                for pos in range(0, total, 4):
                    run = int.from_bytes(payload[pos : pos + 2], "little")
                    if not run or len(decoded) + run * 2 > w * rows * 2:
                        raise ValueError("Invalid RLE run")
                    decoded.extend(payload[pos + 2 : pos + 4] * run)
                payload = decoded
            if len(payload) != w * rows * 2:
                raise ValueError("Incomplete stripe")
            if (w, h) != (self.width, self.height):
                self.width, self.height = w, h
                self.pixels = bytearray(w * h * 2)
                self.rows.clear()
            self.pixels[y * w * 2 : (y + rows) * w * 2] = payload
            self.rows.update(range(y, y + rows))
            self.stripes += 1
            self.revision += 1
        except (ValueError, struct.error):
            self.errors += 1
            self.pending = None
