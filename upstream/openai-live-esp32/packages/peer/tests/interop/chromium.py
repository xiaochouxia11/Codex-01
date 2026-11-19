"""Real Chromium / libwebrtc against the C driver; stdlib only, no API calls.

Use a disposable browser profile and synthetic audio. The server binds loopback;
ICE may use other local interfaces selected by the browser. No STUN/TURN servers.
"""

import argparse
import json
import shutil
import subprocess
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("driver")
    parser.add_argument("--browser")
    parser.add_argument(
        "--bind-address",
        default="127.0.0.1",
        help="C peer IPv4 address; some browsers require a local interface instead of loopback",
    )
    parser.add_argument("--rounds", type=int, default=3)
    parser.add_argument(
        "--server", action="store_true", help="Chromium acts as DTLS server"
    )
    args = parser.parse_args()
    if not 1 <= args.rounds <= 100:
        parser.error("rounds must be between 1 and 100")
    browser = args.browser or shutil.which("google-chrome") or shutil.which("chromium")
    if not browser:
        candidate = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
        browser = str(candidate) if candidate.exists() else None
    if not browser:
        parser.error("provide --browser pointing to Chromium or Google Chrome")
    done = threading.Event()
    result = {}
    with (
        tempfile.TemporaryDirectory(prefix="peer-chromium-") as temp,
        open(Path(temp) / "driver.log", "w+") as driver_log,
        open(Path(temp) / "browser.log", "w+") as browser_log,
        subprocess.Popen(
            [args.driver, str(args.rounds), "", "both", args.bind_address],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=driver_log,
        ) as driver,
    ):

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *unused):
                pass

            def reply(self, data, content_type="application/json"):
                body = data if isinstance(data, bytes) else json.dumps(data).encode()
                self.send_response(200)
                self.send_header("Content-Type", content_type)
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def do_GET(self):
                try:
                    if self.path == "/config":
                        self.reply({"rounds": args.rounds, "server": args.server})
                    elif self.path == "/offer":
                        line = driver.stdout.readline()
                        assert line.startswith(b"OFFER "), line
                        size = int(line.split()[1])
                        assert 0 < size < 8192
                        self.reply({"sdp": driver.stdout.read(size).decode()})
                    elif self.path == "/result":
                        line = driver.stdout.readline()
                        assert line.startswith(b"RESULT "), line
                        self.reply(
                            {
                                k: int(v)
                                for k, v in (
                                    item.split("=")
                                    for item in line.decode().split()[1:]
                                )
                            }
                        )
                    elif self.path == "/":
                        self.reply(
                            Path(__file__).with_suffix(".html").read_bytes(),
                            "text/html",
                        )
                    else:
                        self.send_error(404)
                except (AssertionError, OSError, ValueError) as error:
                    result.update(ok=False, error=str(error))
                    done.set()
                    self.send_error(500)

            def do_POST(self):
                size = int(self.headers.get("Content-Length", "0"))
                if not 0 < size < 65536:
                    self.send_error(400)
                    return
                body = self.rfile.read(size)
                if self.path == "/answer":
                    driver.stdin.write(f"ANSWER {len(body)}\n".encode() + body)
                    driver.stdin.flush()
                elif self.path == "/done":
                    result.update(json.loads(body))
                    done.set()
                else:
                    self.send_error(404)
                    return
                self.reply({})

        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        chrome = None
        try:
            chrome = subprocess.Popen(
                [
                    browser,
                    "--headless=new",
                    "--use-fake-ui-for-media-stream",
                    "--use-fake-device-for-media-stream",
                    f"--user-data-dir={temp}/profile",
                    "--no-first-run",
                    "--no-default-browser-check",
                    "--disable-background-networking",
                    "--disable-component-update",
                    "--disable-sync",
                    "--disable-features=WebRtcHideLocalIpsWithMdns",
                    "--autoplay-policy=no-user-gesture-required",
                    f"http://127.0.0.1:{server.server_port}/",
                ],
                stdout=browser_log,
                stderr=browser_log,
            )
            for _ in range(20 + args.rounds * 15):
                if done.wait(1):
                    break
                if chrome.poll() is not None:
                    raise RuntimeError(f"browser exited: {chrome.returncode}")
            else:
                raise RuntimeError("browser/driver test timed out")
            assert result.get("ok"), result
            assert driver.wait(timeout=10) == 0
            print(json.dumps(result, indent=2))
        except Exception:
            driver_log.seek(0)
            print(driver_log.read())
            browser_log.seek(0)
            print(browser_log.read()[-4000:])
            raise
        finally:
            if chrome is not None:
                chrome.terminate()
                try:
                    chrome.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    chrome.kill()
                    chrome.wait()
            if driver.poll() is None:
                driver.kill()
                driver.wait()
            server.shutdown()
            server.server_close()
            thread.join(timeout=5)


if __name__ == "__main__":
    main()
