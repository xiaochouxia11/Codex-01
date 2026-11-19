import hashlib
import json
import sys
import tempfile
import unittest
import zlib
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
import load_stackchan_cinema as loader
from cinema_layout import media_path

DIGEST = "a" * 64


class Port:
    def __init__(self, lines):
        self.lines = iter(lines)
        self.writes = []

    def write(self, data):
        self.writes.append(data)
        return len(data)

    def readline(self, size=-1):
        return (next(self.lines) + "\n").encode()


class LoaderTests(unittest.TestCase):
    def test_response_retains_fragments_across_serial_timeouts(self):
        class Fragments:
            def __init__(self, chunks):
                self.chunks = iter(chunks)

            def readline(self, size=-1):
                return next(self.chunks)

        port = Fragments([b"log\n", b"CI", b"", b"NEMA DO", b"NE 0 abcd", b"\n"])
        self.assertEqual(loader.response(port, ["CINEMA DONE "]), "CINEMA DONE 0 abcd")
        # A prefix inside an overlong discarded log line is never an ACK.
        port = Fragments([b"x" * 8193, b"CINEMA ACK 1\n", b"CINEMA ACK 32\n"])
        self.assertEqual(loader.response(port, ["CINEMA ACK "]), "CINEMA ACK 32")

    def test_canonical_flat_and_grouped_paths(self):
        for index in range(30000):
            self.assertEqual(media_path(index, 2), f"CINEMA/{index:04d}.SCF")
            self.assertEqual(
                media_path(index), f"CINEMA3/{index // 256:02X}/{index:04d}.SCF"
            )
        for invalid in (-1, 30000, "../0000", 0.5, True):
            with self.assertRaises(ValueError):
                media_path(invalid)
        with self.assertRaises(ValueError):
            media_path(0, 999)

    def pack(self, root, data, version=2):
        movie = root / media_path(0, version)
        movie.parent.mkdir(parents=True)
        movie.write_bytes(data)
        (root / "catalog.json").write_text(
            json.dumps(
                {
                    "version": version,
                    "pack_digest": DIGEST,
                    "clips": [
                        {
                            "index": 0,
                            "file": media_path(0, version),
                            "bytes": len(data),
                            "sha256": hashlib.sha256(data).hexdigest(),
                        }
                    ],
                }
            )
        )

    def card(self):
        return "CINEMA CARD total=16000000 free=15999999 digest=" + DIGEST + " count=1"

    @patch.object(loader.time, "sleep")
    def test_verified_sharded_transfer(self, _):
        data = b"x" * 32
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            self.pack(root, data, version=3)
            port = Port(
                [
                    self.card(),
                    "CINEMA READY 0 4096",
                    "CINEMA ACK 32",
                    f"CINEMA DONE 0 {zlib.crc32(data):08x}",
                    "CINEMA COMMITTED " + DIGEST,
                ]
            )
            loader.upload(port, root)
            self.assertIn(data, port.writes)
            self.assertEqual(port.writes[-1], b"cinema sd commit\n")

    @patch.object(loader.time, "sleep")
    def test_verified_transfer_and_resume(self, _):
        data = b"x" * 5000
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            self.pack(root, data)
            port = Port(
                [
                    self.card(),
                    "CINEMA READY 0 4096",
                    "CINEMA ACK 4096",
                    "CINEMA ACK 5000",
                    f"CINEMA DONE 0 {zlib.crc32(data):08x}",
                    "CINEMA COMMITTED " + DIGEST,
                ]
            )
            loader.upload(port, root)
            self.assertEqual(
                port.writes[-3:], [data[:4096], data[4096:], b"cinema sd commit\n"]
            )
            resumed = Port(
                [
                    "CINEMA ERROR stop-live-and-cinema-first",
                    self.card(),
                    "CINEMA SKIP 0",
                    "CINEMA COMMITTED " + DIGEST,
                ]
            )
            loader.upload(resumed, root)
            self.assertNotIn(data[:4096], resumed.writes)
            self.assertEqual(resumed.writes[-1], b"cinema sd commit\n")

    @patch.object(loader.time, "sleep")
    def test_movie_symlink_cannot_read_outside_pack(self, _):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder) / "pack"
            root.mkdir()
            data = b"x" * 32
            self.pack(root, data)
            outside = Path(folder) / "outside"
            outside.write_bytes(data)
            movie = root / "CINEMA/0000.SCF"
            movie.unlink()
            movie.symlink_to(outside)
            port = Port([self.card()])
            with self.assertRaises(ValueError):
                loader.upload(port, root)
            self.assertFalse(any(b"cinema sd put" in p for p in port.writes))

    @patch.object(loader.time, "sleep")
    def test_completed_device_failure_can_retry_but_is_bounded(self, _):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            data = b"x" * 32
            self.pack(root, data)
            failure = [
                "CINEMA READY 0 4096",
                "CINEMA ERROR write-or-checksum 0 00000000",
            ]
            port = Port(
                [self.card()]
                + failure
                + [
                    "CINEMA READY 0 4096",
                    "CINEMA ACK 32",
                    f"CINEMA DONE 0 {zlib.crc32(data):08x}",
                    "CINEMA COMMITTED " + DIGEST,
                ]
            )
            loader.upload(port, root)
            self.assertEqual(
                sum(p.startswith(b"cinema sd put") for p in port.writes), 2
            )
            port = Port([self.card()] + failure * 3)
            with self.assertRaises(RuntimeError):
                loader.upload(port, root)
            self.assertEqual(
                sum(p.startswith(b"cinema sd put") for p in port.writes), 3
            )
            self.assertNotIn(b"cinema sd commit\n", port.writes)

    @patch.object(loader.time, "sleep")
    def test_lost_final_receipt_resynchronizes_then_verifies_crc(self, _):
        data = b"x" * 32
        done = f"CINEMA DONE 0 {zlib.crc32(data):08x}"
        response = loader.response
        for already_committed in (True, False):
            with self.subTest(already_committed=already_committed):
                with tempfile.TemporaryDirectory() as folder:
                    root = Path(folder)
                    self.pack(root, data)
                    retry = (
                        ["CINEMA SKIP 0"]
                        if already_committed
                        else ["CINEMA READY 0 4096", "CINEMA ACK 32", done]
                    )
                    port = Port(
                        [self.card(), "CINEMA READY 0 4096", "CINEMA ACK 32"]
                        # A delayed original receipt must not replace the idle
                        # acknowledgement or the subsequent file CRC check.
                        + [done, self.card()]
                        + retry
                        + ["CINEMA COMMITTED " + DIGEST]
                    )
                    lost = False

                    def respond(p, prefixes, timeout=30):
                        nonlocal lost
                        if prefixes == ["CINEMA DONE "] and not lost:
                            lost = True
                            raise TimeoutError("lost final receipt")
                        return response(p, prefixes, timeout)

                    with patch.object(loader, "response", side_effect=respond):
                        loader.upload(port, root)
                    self.assertEqual(port.writes.count(b"cinema sd info\n"), 2)
                    self.assertEqual(
                        sum(p.startswith(b"cinema sd put") for p in port.writes), 2
                    )
                    self.assertEqual(
                        port.writes.count(data), 1 if already_committed else 2
                    )
                    self.assertEqual(port.writes[-1], b"cinema sd commit\n")

    @patch.object(loader.time, "sleep")
    def test_lost_block_ack_does_not_send_parser_commands(self, _):
        response = loader.response

        def respond(p, prefixes, timeout=30):
            if prefixes == ["CINEMA ACK "]:
                raise TimeoutError("missing payload ACK")
            return response(p, prefixes, timeout)

        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            self.pack(root, b"x" * 32)
            port = Port([self.card(), "CINEMA READY 0 4096"])
            with patch.object(loader, "response", side_effect=respond):
                with self.assertRaises(TimeoutError):
                    loader.upload(port, root)
            self.assertEqual(port.writes.count(b"cinema sd info\n"), 1)
            self.assertNotIn(b"cinema sd commit\n", port.writes)

    @patch.object(loader.time, "sleep")
    def test_final_receipt_recovery_is_bounded_and_checks_identity(self, _):
        response = loader.response

        def respond(p, prefixes, timeout=30):
            if prefixes == ["CINEMA DONE "]:
                raise TimeoutError("lost final receipt")
            return response(p, prefixes, timeout)

        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            self.pack(root, b"x" * 32)
            attempt = ["CINEMA READY 0 4096", "CINEMA ACK 32"]
            port = Port([self.card()] + (attempt + [self.card()]) * 2 + attempt)
            with patch.object(loader, "response", side_effect=respond):
                with self.assertRaises(loader.CompletionTimeout):
                    loader.upload(port, root)
            self.assertEqual(
                sum(p.startswith(b"cinema sd put") for p in port.writes), 3
            )
            self.assertNotIn(b"cinema sd commit\n", port.writes)
            port = Port(
                [self.card()] + attempt + [self.card().replace(DIGEST, "b" * 64)]
            )
            with patch.object(loader, "response", side_effect=respond):
                with self.assertRaises(ValueError):
                    loader.upload(port, root)
            self.assertEqual(
                sum(p.startswith(b"cinema sd put") for p in port.writes), 1
            )
            self.assertNotIn(b"cinema sd commit\n", port.writes)

    @patch.object(loader.time, "sleep")
    def test_wrong_firmware_never_writes_card(self, _):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            self.pack(root, b"x" * 32)
            port = Port([self.card().replace(DIGEST, "b" * 64)])
            with self.assertRaises(ValueError):
                loader.upload(port, root)
            self.assertFalse(any(b"cinema sd put" in p for p in port.writes))

    @patch.object(loader.time, "sleep")
    def test_corruption_and_bad_ack_never_commit(self, _):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            data = b"x" * 32
            self.pack(root, data)
            for messages in [
                ["CINEMA READY 1 4096"],
                ["CINEMA READY 0 4096", "CINEMA ACK 33"],
                ["CINEMA READY 0 4096", "CINEMA ACK 32", "CINEMA DONE 0 00000000"],
                ["CINEMA ERROR card-not-mounted"],
            ]:
                port = Port([self.card()] + messages)
                with self.assertRaises(RuntimeError):
                    loader.upload(port, root)
                self.assertNotIn(b"cinema sd commit\n", port.writes)
            (root / "CINEMA/0000.SCF").write_bytes(b"y" * 32)
            port = Port([self.card()])
            with self.assertRaises(ValueError):
                loader.upload(port, root)
            self.assertFalse(any(b"cinema sd put" in p for p in port.writes))


if __name__ == "__main__":
    unittest.main()
