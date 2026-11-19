"""Run the S3 protocol firmware with a bounded lifetime and capture its UART log.

Uses only the standard library plus esptool from the active ESP-IDF environment.
Success requires the firmware's final marker, not merely an emulator exit code.
"""

import argparse
import math
import selectors
import shutil
import subprocess
import sys
import time
from pathlib import Path

PASS = b"LIVE_TESTS_PASS"
FAIL = b"LIVE_TESTS_FAIL"
MAX_OUTPUT_BYTES = 2 * 1024 * 1024


def run(command: list[str], timeout: float, log_path: Path) -> bool:
    output = bytearray()
    passed = False
    with log_path.open("wb") as log:
        process = subprocess.Popen(
            command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT
        )
        assert process.stdout is not None
        selector = selectors.DefaultSelector()
        selector.register(process.stdout, selectors.EVENT_READ)
        try:
            deadline = time.monotonic() + timeout
            while time.monotonic() < deadline:
                if selector.select(
                    timeout=min(0.2, max(0, deadline - time.monotonic()))
                ):
                    chunk = process.stdout.read1(8192)
                    if not chunk:
                        break
                    log.write(chunk)
                    sys.stdout.buffer.write(chunk)
                    sys.stdout.buffer.flush()
                    output.extend(chunk)
                    if FAIL in output or len(output) > MAX_OUTPUT_BYTES:
                        break
                    if PASS in output:
                        passed = True
                        break
                elif process.poll() is not None:
                    break
        finally:
            selector.close()
            # Stop only the child this invocation created; never kill by name.
            if process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()
            else:
                process.wait()
            process.stdout.close()
    if not passed:
        print(
            f"FAIL: no successful firmware result within {timeout:g}s; log: {log_path}",
            file=sys.stderr,
        )
    return passed


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("emulator", choices=["qemu", "esp-emu"])
    parser.add_argument(
        "--build-dir",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "examples/protocol_smoke/build",
    )
    parser.add_argument("--timeout", type=float, default=45)
    args = parser.parse_args()
    if not math.isfinite(args.timeout) or args.timeout <= 0:
        parser.error("--timeout must be a finite positive number")
    build = args.build_dir.resolve()
    executable = "qemu-system-xtensa" if args.emulator == "qemu" else "esp-emu"
    path = shutil.which(executable)
    if path is None:
        parser.error(f"{executable} is not on PATH; see README.md for toolchain setup")
    firmware = build / "merged-binary.bin"
    if not firmware.is_file():
        parser.error(
            f"missing {firmware}; run idf.py set-target esp32s3 build merge-bin first"
        )
    if args.emulator == "qemu":
        flash = build / "flash-qemu.bin"
        # QEMU requires a full-sized flash device. esptool 4 uses merge_bin.
        subprocess.run(
            [
                sys.executable,
                "-m",
                "esptool",
                "--chip",
                "esp32s3",
                "merge_bin",
                "--fill-flash-size",
                "4MB",
                "-o",
                str(flash),
                "@flash_args",
            ],
            cwd=build,
            check=True,
        )
        command = [
            path,
            "-nographic",
            "-machine",
            "esp32s3",
            "-drive",
            f"file={flash},if=mtd,format=raw",
            "-snapshot",
        ]
    else:
        command = [
            path,
            "--chip",
            "esp32s3",
            "--firmware",
            str(firmware),
            "--timeout",
            f"{args.timeout:g}s",
            "--exit-on",
            PASS.decode(),
        ]
    return 0 if run(command, args.timeout, build / f"{args.emulator}.log") else 1


if __name__ == "__main__":
    raise SystemExit(main())
