#!/usr/bin/env python3
"""Copy a prepared pack over USB, with per-file readback verification and resume.

The device must run the matching cinema firmware. No host server is used.
Install pyserial, or use the Python environment supplied with ESP-IDF.
"""

import argparse
import hashlib
import re
import json
import time
import zlib
from pathlib import Path
from cinema_layout import media_path


class CompletionTimeout(TimeoutError):
    """All payload bytes were acknowledged, but the final receipt was lost."""


def response(port, prefixes, timeout=30):
    deadline = time.monotonic() + timeout
    pending = bytearray()
    discard = False
    while time.monotonic() < deadline:
        # pyserial's read timeout can return part of a line. Keep fragments
        # until the delimiter, with a bound even for noisy/corrupt device logs.
        chunk = port.readline(8193)
        complete = chunk.endswith(b"\n")
        if discard or len(pending) + len(chunk) > 8192:
            pending.clear()
            discard = not complete
            continue
        pending.extend(chunk)
        if not complete:
            continue
        line = pending.decode("utf-8", errors="replace").strip()
        pending.clear()
        if line.startswith("CINEMA ERROR"):
            raise RuntimeError(line)
        if any(line.startswith(prefix) for prefix in prefixes):
            return line
    raise TimeoutError("No device acknowledgement: " + repr(prefixes))


def transfer(port, i, data, crc, count):
    port.write(f"cinema sd put {i} {len(data)} {crc:08x}\n".encode())
    ready = response(port, ["CINEMA READY ", "CINEMA SKIP "])
    if ready == f"CINEMA SKIP {i}":
        print(f"{i + 1}/{count} verified existing file", flush=True)
        return False
    fields = ready.split()
    if (
        len(fields) != 4
        or fields[:3] != ["CINEMA", "READY", str(i)]
        or fields[3] not in ("1024", "4096")
    ):
        raise RuntimeError("Unexpected transfer handshake: " + ready)
    block = int(fields[3])
    for offset in range(0, len(data), block):
        chunk = data[offset : offset + block]
        if port.write(chunk) != len(chunk):
            raise IOError("Short serial write")
        ack = response(port, ["CINEMA ACK "])
        if ack != f"CINEMA ACK {offset + len(chunk)}":
            raise RuntimeError("Unexpected offset: " + ack)
    try:
        done = response(port, ["CINEMA DONE "])
    except TimeoutError as error:
        raise CompletionTimeout(str(error)) from error
    if done != f"CINEMA DONE {i} {crc:08x}":
        raise RuntimeError("Readback checksum mismatch: " + done)
    return True


def upload(port, pack):
    catalog = json.loads((pack / "catalog.json").read_text())
    clips = catalog["clips"]
    version = catalog.get("version", 2)
    media_path(0, version)  # Validate before sending commands to the device.
    if not re.fullmatch("[0-9a-f]{64}", catalog["pack_digest"]):
        raise ValueError("Invalid pack identity")
    if not 1 <= len(clips) <= 30000:
        raise ValueError("Invalid pack count")
    port.write(b"live stop\ncinema off\n")
    # Wait for an idle device rather than interrupting active audio/SD work.
    time.sleep(2)
    deadline = time.monotonic() + 30
    while True:
        port.write(b"cinema sd info\n")
        try:
            info = response(port, ["CINEMA CARD"])
            break
        except RuntimeError as error:
            if (
                str(error) != "CINEMA ERROR stop-live-and-cinema-first"
                or time.monotonic() >= deadline
            ):
                raise
            time.sleep(0.5)
    print(info, flush=True)
    if (
        "digest=" + catalog["pack_digest"] not in info.split()
        or "count=" + str(len(clips)) not in info.split()
    ):
        raise ValueError(
            "Flash the firmware for this pack before uploading; no files changed"
        )
    total = 0
    started = time.monotonic()
    for i, clip in enumerate(clips):
        if clip["index"] != i or clip["file"] != media_path(i, version):
            raise ValueError("Invalid/nonsequential pack file")
        movie = (pack / clip["file"]).resolve()
        if not movie.is_relative_to(pack.resolve()):
            raise ValueError("Movie path escapes the pack directory")
        data = movie.read_bytes()
        if len(data) != clip["bytes"] or not 32 <= len(data) <= 2 * 1024 * 1024:
            raise ValueError("Invalid film size")
        if hashlib.sha256(data).hexdigest() != clip["sha256"]:
            raise ValueError("Movie differs from its catalog hash; no replacement sent")
        crc = zlib.crc32(data)
        for attempt in range(3):
            try:
                copied = transfer(port, i, data, crc, len(clips))
                break
            except CompletionTimeout:
                if attempt == 2:
                    raise
                # Every payload byte was ACKed, so binary receive has ended.
                # Confirm the command parser is idle before asking it to verify
                # the same file's CRC. Never apply this to a missing block ACK.
                port.write(b"cinema sd info\n")
                idle = response(port, ["CINEMA CARD"], timeout=180)
                if (
                    "digest=" + catalog["pack_digest"] not in idle.split()
                    or "count=" + str(len(clips)) not in idle.split()
                ):
                    raise ValueError("Device identity changed during transfer")
                print(
                    f"Final receipt missing for {i + 1}/{len(clips)}; device idle, rechecking file CRC ({attempt + 1}/2)",
                    flush=True,
                )
            except RuntimeError as error:
                # This final error means the device has closed/discarded its
                # temporary file and returned to the command parser. Never
                # retry a wrong offset/ACK while it may still expect binary data.
                if (
                    not str(error).startswith("CINEMA ERROR write-or-checksum ")
                    or attempt == 2
                ):
                    raise
                print(
                    f"Retrying file {i + 1}/{len(clips)} after device transfer failure ({attempt + 1}/2)",
                    flush=True,
                )
                time.sleep(1)
        if not copied:
            continue
        total += len(data)
        print(
            f"{i + 1}/{len(clips)} copied and verified; {total / 1e6:.1f} MB, {total / max(0.001, time.monotonic() - started) / 1024:.0f} KiB/s",
            flush=True,
        )
    port.write(b"cinema sd commit\n")
    result = response(port, ["CINEMA COMMITTED "], timeout=180)
    if result != "CINEMA COMMITTED " + catalog["pack_digest"]:
        raise RuntimeError("Firmware and pack identities differ")
    print(result, flush=True)
    # Reboot re-initializes the playable set; keep the UI explicitly off until then.
    print(
        "Pack verified. Restart the device to use the complete card library.",
        flush=True,
    )


def main():
    import serial

    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--port", required=True)
    p.add_argument("--pack", type=Path, required=True)
    args = p.parse_args()
    port = serial.Serial(port=None, baudrate=115200, timeout=0.2, write_timeout=10)
    port.port = args.port
    port.dtr = True
    port.rts = True
    try:
        port.open()
        port.rts = False
        port.dtr = False
        upload(port, args.pack.expanduser().resolve())
    finally:
        port.close()


if __name__ == "__main__":
    main()
