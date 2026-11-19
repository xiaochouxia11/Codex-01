#!/usr/bin/env python3
"""Run in the foreground in tmux using ESP-IDF's Python environment.

Append 'live start', 'live stop', 'live mute', 'live unmute', or 'live status'
to --commands from another shell. No credential provisioning occurs over USB.
"""

import argparse
import os
import time
from datetime import datetime, timezone
from pathlib import Path

import serial


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", required=True)
    parser.add_argument("--log", type=Path, required=True)
    parser.add_argument("--commands", type=Path, required=True)
    parser.add_argument("--seconds", type=float, default=600)
    args = parser.parse_args()
    os.umask(0o077)
    args.commands.touch(mode=0o600)
    allowed = {
        "live start",
        "live stop",
        "live mute",
        "live unmute",
        "live status",
        "live timing",
        "live diagnostics",
        "live preconnect-on",
        "live preconnect-off",
        "live audio-test",
        "live jitter-test",
        "live burst-test",
        "live playout-on",
        "live playout-off",
        "live captions-test",
        "live glyphs-test",
        "live peer-test",
        "live photo-test",
        "live head pose",
        "live head center",
        "live head stop",
        "live display-test",
        "live display vivid",
        "live display original",
        "live wifi-scan",
        "live wifi-reconnect",
        "live wifi-next",
        "live screen",
        "live screenshot",
        "live panel-reset",
    }
    allowed.add("live transcripts")
    allowed.update(f"live volume {value}" for value in range(101))
    allowed.update(f"live brightness {value}" for value in range(101))
    allowed.update(
        f"live head look {yaw} {pitch}"
        for yaw in range(-40, 41)
        for pitch in range(10, 61)
    )
    port = serial.Serial(port=None, baudrate=115200, timeout=0.1)
    port.port = args.port
    deadline = time.monotonic() + args.seconds
    last_error = None
    try:
        with args.log.open("ab", buffering=0) as log, args.commands.open() as commands:

            def notice(text):
                line = f"\nUSB host {datetime.now(timezone.utc).isoformat()}: {text}\n"
                log.write(line.encode())
                print(line, end="", flush=True)

            while time.monotonic() < deadline:
                try:
                    # Match IDF Monitor's no-reset attach sequence. Opening
                    # with both lines deasserted can reset USB Serial/JTAG.
                    port.dtr = True
                    port.rts = True
                    port.open()
                    port.rts = False
                    port.dtr = False
                    # Never replay a Start/Stop queued before a USB reconnect.
                    commands.seek(0, os.SEEK_END)
                    pending = ""
                    last_error = None
                    notice(f"USB console ready; commands: {args.commands}")
                    port.write(b"live status\nlive timing\n")
                    while time.monotonic() < deadline:
                        data = port.read(max(1, port.in_waiting))
                        if data:
                            log.write(data)
                            print(data.decode(errors="replace"), end="", flush=True)
                        pending += commands.read()
                        while "\n" in pending:
                            line, pending = pending.split("\n", 1)
                            if line.strip() in allowed:
                                port.write((line.strip() + "\n").encode())
                                print("\nUSB command:", line.strip(), flush=True)
                except (serial.SerialException, OSError) as exc:
                    if str(exc) != last_error:
                        notice(f"USB unavailable; reconnecting: {exc}")
                        last_error = str(exc)
                finally:
                    port.close()
                if time.monotonic() < deadline:
                    time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        port.close()


if __name__ == "__main__":
    main()
