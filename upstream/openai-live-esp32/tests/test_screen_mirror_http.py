"""Viewer authentication and frame semantics without USB hardware or pyserial."""

import json
import stat
import sys
import threading
import unittest
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
from screen_mirror import Mirror, handler, viewer_launch_file

TOKEN = "test-only-viewer-capability"


class FrameTest(unittest.TestCase):
    def setUp(self):
        self.mirror = Mirror(SimpleNamespace())
        self.mirror.connected = True
        d = self.mirror.decoder
        d.width, d.height = 2, 1
        d.pixels = bytearray(b"\x00\xf8\xe0\x07")
        d.rows = {0}
        d.revision = 5
        self.handler = object.__new__(handler(self.mirror, TOKEN))
        self.handler.server = SimpleNamespace(server_port=8765)
        self.handler.reply = self.reply

    def reply(self, code, body=b"", content_type=None, headers=None):
        self.result = (code, body, headers)

    def get(self, tag="", host="127.0.0.1:8765"):
        self.handler.path = "/frame"
        self.handler.headers = {
            "Host": host,
            "If-None-Match": tag,
            "Authorization": f"Bearer {TOKEN}",
        }
        self.handler.do_GET()
        return self.result

    def test_conditional_frames_and_reconnect(self):
        code, pixels, headers = self.get()
        self.assertEqual(code, 200)
        self.assertEqual(pixels, self.mirror.decoder.pixels)
        self.assertEqual(headers["X-Ready"], 1)
        tag = headers["ETag"]
        self.assertEqual(self.get(tag)[:2], (204, b""))
        self.mirror.decoder.revision += 1
        self.assertEqual(self.get(tag)[0], 200)
        self.mirror.decoder.revision -= 1
        self.mirror.generation += 1
        # Same revision after reconnect must not suppress a different frame.
        self.assertEqual(self.get(tag)[0], 200)

    def test_status_survives_empty_responses(self):
        self.mirror.enabled = False
        code, pixels, headers = self.get()
        self.assertEqual((code, pixels), (204, b""))
        self.assertEqual(headers["X-Enabled"], 0)
        self.mirror.enabled = True
        self.mirror.connected = False
        code, pixels, headers = self.get()
        self.assertEqual((code, pixels), (204, b""))
        self.assertEqual(headers["X-Connected"], 0)
        self.mirror.connected = True
        self.mirror.decoder.rows.clear()
        self.assertEqual(self.get()[0], 204)

    def test_loopback_host_and_origin_guards(self):
        self.assertEqual(self.get(host="example.com")[0], 403)
        self.handler.path = "/mirror/off"
        self.handler.headers = {
            "Host": "127.0.0.1:8765",
            "Origin": "https://example.com",
            "Authorization": f"Bearer {TOKEN}",
        }
        self.handler.do_POST()
        self.assertEqual(self.result[0], 403)
        self.assertTrue(self.mirror.enabled)
        self.handler.headers["Origin"] = "http://127.0.0.1:8765"
        self.handler.do_POST()
        self.assertEqual(self.result[0], 200)
        self.assertFalse(self.mirror.enabled)


class AuthenticationTest(unittest.TestCase):
    """Exercise real HTTP requests, including a native client spoofing Origin."""

    def setUp(self):
        self.mirror = Mirror(SimpleNamespace())
        self.mirror.connected = True
        d = self.mirror.decoder
        d.width, d.height = 2, 1
        d.pixels = bytearray(b"\x00\xf8\xe0\x07")
        d.rows = {0}
        self.server = ThreadingHTTPServer(
            ("127.0.0.1", 0), handler(self.mirror, TOKEN)
        )
        self.origin = f"http://127.0.0.1:{self.server.server_port}"
        self.thread = threading.Thread(target=self.server.serve_forever)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)

    def request(self, path, method="GET", headers=None):
        client = HTTPConnection("127.0.0.1", self.server.server_port, timeout=2)
        try:
            client.request(method, path, headers=headers or {})
            response = client.getresponse()
            return response.status, response.read(), dict(response.getheaders())
        finally:
            client.close()

    def test_public_page_contains_no_capability_or_private_frame(self):
        code, body, headers = self.request("/")
        self.assertEqual(code, 200)
        self.assertIn(b"<canvas", body)
        self.assertNotIn(TOKEN.encode(), body)
        self.assertNotIn(bytes(self.mirror.decoder.pixels), body)
        self.assertEqual(headers["Cache-Control"], "no-store")
        self.assertEqual(headers["Referrer-Policy"], "no-referrer")
        self.assertEqual(headers["Content-Security-Policy"], "frame-ancestors 'none'")

    def test_frames_and_status_require_the_current_capability(self):
        for route in ("/frame", "/status"):
            for supplied in (None, "", "Bearer wrong", "Basic " + TOKEN, "Bearer é"):
                with self.subTest(route=route, supplied=supplied):
                    headers = {"Origin": self.origin}
                    if supplied is not None:
                        headers["Authorization"] = supplied
                    code, body, response_headers = self.request(route, headers=headers)
                    self.assertEqual((code, body), (401, b""))
                    self.assertNotIn("ETag", response_headers)
                    self.assertNotIn("X-Width", response_headers)
                    self.assertNotIn("Access-Control-Allow-Origin", response_headers)

    def test_query_and_cookie_do_not_authorize_requests(self):
        self.assertEqual(self.request(f"/frame?token={TOKEN}")[0], 401)
        self.assertEqual(
            self.request("/frame", headers={"Cookie": f"token={TOKEN}"})[0], 401
        )

    def test_spoofed_origin_cannot_resume_paused_capture(self):
        for enabled in (False, True):
            self.mirror.enabled = enabled
            route = "/mirror/off" if enabled else "/mirror/on"
            for auth in (None, "Bearer wrong"):
                with self.subTest(enabled=enabled, auth=auth):
                    headers = {"Origin": self.origin}
                    if auth:
                        headers["Authorization"] = auth
                    code, body, _ = self.request(route, "POST", headers)
                    self.assertEqual((code, body), (401, b""))
                    self.assertEqual(self.mirror.enabled, enabled)

    def test_authenticated_frames_status_and_pause_resume(self):
        headers = {"Authorization": f"Bearer {TOKEN}", "Origin": self.origin}
        code, pixels, frame_headers = self.request("/frame", headers=headers)
        self.assertEqual((code, pixels), (200, bytes(self.mirror.decoder.pixels)))
        tag = frame_headers["ETag"]
        self.assertEqual(
            self.request("/frame", headers={**headers, "If-None-Match": tag})[:2],
            (204, b""),
        )
        self.assertEqual(self.request("/mirror/off", "POST", headers)[0], 200)
        self.assertFalse(self.mirror.enabled)
        self.assertEqual(self.request("/frame", headers=headers)[0], 204)
        status = json.loads(self.request("/status", headers=headers)[1])
        self.assertFalse(status["enabled"])
        self.assertEqual(self.request("/mirror/on", "POST", headers)[0], 200)
        self.assertEqual(self.request("/frame", headers=headers)[0], 200)

    def test_authentication_does_not_bypass_host_or_origin_checks(self):
        auth = {"Authorization": f"Bearer {TOKEN}"}
        self.assertEqual(self.request("/", headers={"Host": "attacker.test"})[0], 403)
        self.assertEqual(
            self.request("/frame", headers={**auth, "Host": "attacker.test"})[0], 403
        )
        for origin in (None, "null", "https://attacker.test"):
            headers = {**auth}
            if origin is not None:
                headers["Origin"] = origin
            self.assertEqual(self.request("/mirror/off", "POST", headers)[0], 403)
            self.assertTrue(self.mirror.enabled)

    def test_previous_instance_token_is_rejected(self):
        # Replace the handler with a new instance, retaining the same origin and
        # fake USB connection, as when restarting the helper on the same port.
        self.server.RequestHandlerClass = handler(self.mirror, "new-instance-token")
        old_headers = {"Authorization": f"Bearer {TOKEN}", "Origin": self.origin}
        self.assertEqual(self.request("/frame", headers=old_headers)[0], 401)
        self.assertEqual(self.request("/mirror/off", "POST", old_headers)[0], 401)
        new_headers = {"Authorization": "Bearer new-instance-token"}
        self.assertEqual(self.request("/frame", headers=new_headers)[0], 200)


class LaunchFileTest(unittest.TestCase):
    def test_owner_private_bootstrap_is_removed_after_use(self):
        url = f"http://127.0.0.1:8765/#token={TOKEN}"
        with viewer_launch_file(url) as path:
            self.assertEqual(stat.S_IMODE(path.parent.stat().st_mode), 0o700)
            self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o600)
            self.assertIn(json.dumps(url), path.read_text())
            self.assertNotIn(TOKEN, path.as_uri())
        self.assertFalse(path.exists())
        self.assertFalse(path.parent.exists())

    def test_launch_file_cleanup_on_failure(self):
        with self.assertRaisesRegex(RuntimeError, "browser failed"):
            with viewer_launch_file("http://127.0.0.1:8765/#token=test") as path:
                raise RuntimeError("browser failed")
        self.assertFalse(path.exists())

    def test_empty_capability_is_rejected(self):
        with self.assertRaises(ValueError):
            handler(Mirror(SimpleNamespace()), "")


if __name__ == "__main__":
    unittest.main()
