"""Credential and vendor-download checks using ESP-IDF's Python environment."""

import hashlib
import importlib.util
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location(
    "prepare_voice", Path(__file__).resolve().parents[1] / "tools/prepare_voice.py"
)
assert SPEC and SPEC.loader
prepare = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(prepare)


class WifiProfilesTest(unittest.TestCase):
    def load(self, value):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "wifi.json"
            path.write_text(json.dumps(value))
            return prepare.load_wifi(path)

    def test_legacy_and_multiple(self):
        one = {"ssid": "fixture", "password": "testpass"}
        two = {"ssid": "fixture-2", "password": ""}
        self.assertEqual(self.load(one), [one])
        self.assertEqual(self.load({"networks": [one, two]}), [one, two])
        self.assertEqual(prepare.load_wifi(None), [])

    def test_invalid_credentials(self):
        for value in [
            {"networks": []},
            {"networks": [None]},
            {"ssid": "", "password": "testpass"},
            {"ssid": "x" * 33, "password": "testpass"},
            {"ssid": "x\0y", "password": "testpass"},
            {"ssid": "x", "password": "tiny"},
            {"ssid": "x", "password": "y" * 64},
            {"ssid": "x", "password": "test\0pass"},
            [{"ssid": "same", "password": ""}] * 2,
            [{"ssid": str(i), "password": ""} for i in range(9)],
        ]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                self.load(value)

    def test_private_header(self):
        networks = self.load({"ssid": 'test"\\net', "password": "testpass"})
        with tempfile.TemporaryDirectory() as directory:
            private = Path(directory) / "private"
            prepare.write_secrets(private, "fixture-key", networks)
            path = private / "live_voice_secrets.h"
            self.assertEqual(path.stat().st_mode & 0o777, 0o600)
            self.assertEqual(private.stat().st_mode & 0o777, 0o700)
            self.assertIn("LIVE_WIFI_PROFILE_COUNT = 1", path.read_text())
            self.assertIn(json.dumps(networks[0]["ssid"]), path.read_text())


class VendorNoticesTest(unittest.TestCase):
    def test_notices_preserve_upstream_text_and_do_not_duplicate(self):
        for name, upstream in [
            (
                "board.c",
                "/* Copyright Board Authors; SPDX-License-Identifier: Apache-2.0 */\nint value;\n",
            ),
            ("display.hpp", "// Copyright Display Authors\n#pragma once\n"),
            ("CMakeLists.txt", "# Copyright Build Authors\nset(value 1)\n"),
            ("idf_component.yml", "# Copyright Component Authors\ndependencies: {}\n"),
            ("sdkconfig.defaults", "CONFIG_EXAMPLE=y\n"),
        ]:
            with self.subTest(name=name), tempfile.TemporaryDirectory() as directory:
                path = Path(directory) / name
                prepare.write_modified(path, upstream)
                first = path.read_text()
                self.assertTrue(first.endswith(upstream))
                self.assertEqual(first.count("Modified by OpenAI"), 1)
                prepare.write_modified(path, first)
                self.assertEqual(path.read_text(), first)

    def test_failed_patch_does_not_change_source_or_attribution(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "board.c"
            source = "/* Copyright Upstream */\nint duplicated;\nint duplicated;\n"
            path.write_text(source)
            for old in ("missing", "duplicated"):
                with self.assertRaises(RuntimeError):
                    prepare.replace(path, old, "replacement")
                self.assertEqual(path.read_text(), source)


class VendorDownloadTest(unittest.TestCase):
    def test_xiaozhi_exclusions_preserve_other_apps_and_notices(self):
        prefix = "firmware/brookesia/"
        files = {
            "LICENSE": b"Upstream license",
            "NOTICE": b"Upstream attribution",
            prefix + "components/Settings/Settings.cpp": b"settings",
            prefix + "components/XiaozhiAppExtra/example.cpp": b"different component",
            prefix + "components/XiaozhiApp/idf_component.yml": b"font dependency",
            prefix + "components/XiaozhiApp/third_party/LICENSE": b"nested license",
            prefix + "spiffs/xiaozhi/activation.ogg": b"prompt",
            prefix + "spiffs/music/example.wav": b"music",
        }
        tree = {
            "tree": [
                {
                    "type": "blob",
                    "path": name,
                    "sha": hashlib.sha1(
                        b"blob " + str(len(data)).encode() + b"\0" + data
                    ).hexdigest(),
                }
                for name, data in files.items()
            ]
        }
        retained = {
            "LICENSE",
            "NOTICE",
            prefix + "components/Settings/Settings.cpp",
            prefix + "components/XiaozhiAppExtra/example.cpp",
            prefix + "spiffs/music/example.wav",
        }
        for excluded, expected in (
            ((), set(files)),
            (prepare.WAVESHARE_EXCLUDED_DIRS, retained),
        ):
            with (
                self.subTest(excluded=bool(excluded)),
                tempfile.TemporaryDirectory() as directory,
            ):
                downloaded = []

                def urlopen(request, timeout):
                    if not isinstance(request, str):
                        return io.BytesIO(json.dumps(tree).encode())
                    name = request.split("/fixture/", 1)[1]
                    downloaded.append(name)
                    return io.BytesIO(files[name])

                root = Path(directory)
                with patch.object(prepare.urllib.request, "urlopen", side_effect=urlopen):
                    prepare.fetch("example/vendor", "fixture", prefix, root, excluded)
                    self.assertEqual(set(downloaded), expected)
                    self.assertEqual(
                        {
                            str(p.relative_to(root))
                            for p in root.rglob("*")
                            if p.is_file()
                        },
                        expected,
                    )
                    downloaded.clear()
                    prepare.fetch("example/vendor", "fixture", prefix, root, excluded)
                    self.assertEqual(
                        downloaded,
                        [],
                        "verified cache entries should not be fetched again",
                    )


if __name__ == "__main__":
    unittest.main()
