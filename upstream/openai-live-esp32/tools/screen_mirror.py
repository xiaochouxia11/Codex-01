#!/usr/bin/env python3
"""Mirror the Waveshare screen over USB to a local, recordable browser canvas.

Run with ESP-IDF's Python (includes pyserial). Stop other serial monitors first.
The viewer never starts a voice session or captures laptop/device audio.
"""

import argparse
import json
import os
import secrets
import tempfile
import threading
import time
import webbrowser
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from mirror_protocol import Decoder

COMMANDS = {
    "live start",
    "live stop",
    "live mute",
    "live unmute",
    "live status",
    "live timing",
    "live diagnostics",
    "live mirror-status",
    "live mirror-key",
    "live preconnect-on",
    "live preconnect-off",
    "live audio-test",
    "live jitter-test",
    "live playout-on",
    "live playout-off",
    "live mirror-on",
    "live mirror-off",
    "live captions-test",
    "live glyphs-test",
}


class Mirror:
    def __init__(self, args):
        self.args = args
        self.lock = threading.Lock()
        self.stop = threading.Event()
        self.enabled = True
        self.connected = False
        self.error = "Connecting to USB"
        self.decoder = Decoder(self.log)
        self.logfile = None
        # Distinguish reconnects and helper restarts, even at the same revision.
        self.generation = time.monotonic_ns()

    def log(self, data):
        if self.logfile:
            self.logfile.write(data)

    def notice(self, text):
        print(text, flush=True)
        self.log((f"\nUSB host {time.time():.3f}: {text}\n").encode())

    def snapshot(self):
        with self.lock:
            d = self.decoder
            return {
                "connected": self.connected,
                "enabled": self.enabled,
                "error": self.error,
                "ready": d.ready,
                "width": d.width,
                "height": d.height,
                "revision": d.revision,
                "stripes": d.stripes,
                "errors": d.errors,
                "wire_bytes": d.wire_bytes,
            }

    def run(self):
        import serial

        port = serial.Serial(
            port=None, baudrate=115200, timeout=0.05, write_timeout=0.2
        )
        port.port = self.args.port
        if os.name == "posix":
            port.exclusive = True
        commands = None
        try:
            if self.args.log:
                self.args.log.parent.mkdir(parents=True, exist_ok=True)
                self.logfile = self.args.log.open("ab", buffering=0)
                os.chmod(self.args.log, 0o600)
            if self.args.commands:
                self.args.commands.parent.mkdir(parents=True, exist_ok=True)
                self.args.commands.touch(mode=0o600)
                commands = self.args.commands.open()
            while not self.stop.is_set():
                try:
                    port.dtr = port.rts = True
                    port.open()
                    port.rts = port.dtr = False
                    if commands:
                        commands.seek(0, os.SEEK_END)
                    pending = ""
                    with self.lock:
                        self.decoder = Decoder(self.log)
                        self.generation += 1
                        self.connected, self.error = True, ""
                    self.notice("USB connected")
                    last_enabled = None
                    heartbeat = keyframe = repair_after = 0
                    last_errors = 0
                    while not self.stop.is_set():
                        now = time.monotonic()
                        enabled = self.enabled
                        if enabled != last_enabled or (enabled and now >= heartbeat):
                            port.write(
                                b"live mirror-on\n" if enabled else b"live mirror-off\n"
                            )
                            if enabled and last_enabled is not True:
                                keyframe = 0
                            last_enabled, heartbeat = enabled, now + 1
                        # Repair detected damage promptly, but rate-limit requests.
                        # A slower periodic keyframe also covers silent packet loss.
                        with self.lock:
                            errors = self.decoder.errors
                        if enabled and (
                            now >= keyframe
                            or (errors != last_errors and now >= repair_after)
                        ):
                            port.write(b"live mirror-key\n")
                            keyframe, repair_after = now + 30, now + 1
                            last_errors = errors
                        data = port.read(min(16384, max(1, port.in_waiting)))
                        if data:
                            with self.lock:
                                self.decoder.feed(data)
                        if commands:
                            pending += commands.read()
                            while "\n" in pending:
                                line, pending = pending.split("\n", 1)
                                line = line.strip()
                                if line == "live mirror-on":
                                    self.enabled = True
                                elif line == "live mirror-off":
                                    self.enabled = False
                                elif line in COMMANDS:
                                    port.write((line + "\n").encode())
                                    self.notice(line)
                            pending = pending[-128:]
                except (serial.SerialException, OSError) as exc:
                    with self.lock:
                        self.connected, self.error = False, str(exc)
                    self.notice(f"USB unavailable: {exc}")
                finally:
                    if port.is_open:
                        try:
                            port.write(b"live mirror-off\n")
                        except (serial.SerialException, OSError):
                            pass
                    port.close()
                self.stop.wait(1)
        finally:
            if commands:
                commands.close()
            if self.logfile:
                self.logfile.close()


@contextmanager
def viewer_launch_file(url):
    """Deliver the capability without exposing it in process arguments or stdout."""
    with tempfile.TemporaryDirectory(prefix="live-screen-viewer-") as directory:
        path = Path(directory) / "open-viewer.html"
        path.write_text(
            '<!doctype html><meta charset="utf-8"><title>Open screen mirror</title>'
            f"<script>location.replace({json.dumps(url)});</script>",
            encoding="utf-8",
        )
        path.chmod(0o600)
        yield path


def handler(mirror, access_token):
    if not access_token:
        raise ValueError("A viewer access token is required")

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_):
            pass

        def reply(self, code, body=b"", content_type="application/json", headers=None):
            self.send_response(code)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("Referrer-Policy", "no-referrer")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Content-Security-Policy", "frame-ancestors 'none'")
            for name, value in (headers or {}).items():
                self.send_header(name, str(value))
            self.end_headers()
            try:
                self.wfile.write(body)
            except (BrokenPipeError, ConnectionResetError):
                pass

        def allowed(self):
            # Loopback only, including Host validation against DNS rebinding.
            expected = f"127.0.0.1:{self.server.server_port}"
            return self.headers.get("Host") == expected

        def authenticated(self):
            # Host/Origin checks constrain browser requests, not other OS users.
            expected = f"Bearer {access_token}".encode("ascii")
            supplied = self.headers.get("Authorization", "").encode("utf-8")
            return secrets.compare_digest(supplied, expected)

        def do_GET(self):
            if not self.allowed():
                self.reply(403)
                return
            path = urlparse(self.path).path
            if path == "/":
                self.reply(
                    200,
                    Path(__file__).with_name("screen_mirror.html").read_bytes(),
                    "text/html; charset=utf-8",
                )
                return
            if not self.authenticated():
                self.reply(401)
                return
            if path == "/status":
                self.reply(200, json.dumps(mirror.snapshot()).encode())
            elif path == "/frame":
                with mirror.lock:
                    d = mirror.decoder
                    tag = f'"{mirror.generation}-{d.revision}"'
                    ready = (
                        mirror.connected
                        and mirror.enabled
                        and d.ready
                        and self.headers.get("If-None-Match") != tag
                    )
                    pixels = bytes(d.pixels) if ready else b""
                    headers = {
                        "ETag": tag,
                        "X-Connected": int(mirror.connected),
                        "X-Enabled": int(mirror.enabled),
                        "X-Ready": int(d.ready),
                        "X-Width": d.width,
                        "X-Height": d.height,
                        "X-Revision": d.revision,
                    }
                self.reply(
                    200 if ready else 204, pixels, "application/octet-stream", headers
                )
            else:
                self.reply(404)

        def do_POST(self):
            origin = f"http://127.0.0.1:{self.server.server_port}"
            if not self.allowed() or self.headers.get("Origin") != origin:
                self.reply(403)
                return
            if not self.authenticated():
                self.reply(401)
                return
            if self.path not in ("/mirror/on", "/mirror/off"):
                self.reply(404)
                return
            mirror.enabled = self.path.endswith("/on")
            self.reply(200, b"{}")

    return Handler


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", required=True, help="USB serial device")
    parser.add_argument("--listen-port", type=int, default=8765)
    parser.add_argument("--no-browser", action="store_true")
    parser.add_argument(
        "--log", type=Path, help="Optional private text log (pixels excluded)"
    )
    parser.add_argument(
        "--commands", type=Path, help="Optional diagnostic command file"
    )
    args = parser.parse_args()
    os.umask(0o077)
    mirror = Mirror(args)
    access_token = secrets.token_urlsafe(32)
    server = ThreadingHTTPServer(
        ("127.0.0.1", args.listen_port), handler(mirror, access_token)
    )
    worker = threading.Thread(target=mirror.run, daemon=True)
    url = f"http://127.0.0.1:{server.server_port}/#token={access_token}"
    try:
        with viewer_launch_file(url) as launch_file:
            worker.start()
            print(
                f"Screen mirror: {launch_file.as_uri()}\n"
                "Ctrl-C stops the viewer. Recordings contain screen pixels only.",
                flush=True,
            )
            if not args.no_browser:
                webbrowser.open(launch_file.as_uri())
            server.serve_forever(poll_interval=0.1)
    except KeyboardInterrupt:
        pass
    finally:
        mirror.stop.set()
        server.server_close()
        if worker.ident is not None:
            worker.join(timeout=2)


if __name__ == "__main__":
    main()
