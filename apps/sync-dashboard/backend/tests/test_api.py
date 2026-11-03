"""Exercise API validation and SQLite persistence without external requests."""
from pathlib import Path
import os
import shutil
import tempfile
import unittest
from unittest.mock import patch

from httpx import ASGITransport, AsyncClient

from backend.app import create_app
from backend.store import DEMO_RUNS


class DashboardTests(unittest.IsolatedAsyncioTestCase):
    """Use an independent on-disk database for each test."""

    def setUp(self):
        self.directory = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.directory)
        self.database = str(Path(self.directory) / "status.sqlite3")

    async def test_demo_and_live_are_separate(self):
        """Demo data never masquerades as live records."""
        async with AsyncClient(transport=ASGITransport(app=create_app(self.database)),
                               base_url="http://testserver") as client:
            self.assertEqual((await client.get("/api/health")).json()["status"], "ok")
            self.assertEqual(len((await client.get("/api/runs")).json()["runs"]), 3)
            self.assertEqual((await client.get("/api/runs?mode=live")).json()["runs"], [])
            self.assertEqual((await client.get("/api/runs?mode=invalid")).status_code, 422)

    async def test_refresh_persists_across_app_restart(self):
        """Successful refreshes survive app recreation in the same database."""
        async with AsyncClient(
                transport=ASGITransport(app=create_app(
                    self.database, fetcher=lambda: DEMO_RUNS[:1])),
                base_url="http://testserver") as client:
            response = await client.post("/api/refresh")
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["mode"], "live")
        async with AsyncClient(transport=ASGITransport(app=create_app(self.database)),
                               base_url="http://testserver") as client:
            self.assertEqual(len((await client.get("/api/runs?mode=live")).json()["runs"]), 1)
            self.assertEqual(len((await client.get("/api/runs?mode=demo")).json()["runs"]), 3)

    async def test_failed_refresh_preserves_cache(self):
        """A failed upstream request cannot erase a successful cache."""
        async with AsyncClient(
                transport=ASGITransport(app=create_app(
                    self.database, fetcher=lambda: DEMO_RUNS[:1])),
                base_url="http://testserver") as client:
            await client.post("/api/refresh")

        def unavailable():
            raise RuntimeError("GitHub unavailable")

        async with AsyncClient(transport=ASGITransport(
                app=create_app(self.database, fetcher=unavailable)),
                base_url="http://testserver") as client:
            self.assertEqual((await client.post("/api/refresh")).status_code, 502)
            self.assertEqual(len((await client.get("/api/runs?mode=live")).json()["runs"]), 1)

    async def test_cross_origin_refresh_is_rejected(self):
        """Another website cannot use the browser to refresh our local cache."""
        async with AsyncClient(transport=ASGITransport(app=create_app(self.database)),
                               base_url="http://testserver") as client:
            response = await client.post("/api/refresh", headers={"Origin": "https://example.com"})
            self.assertEqual(response.status_code, 403)

    async def test_database_environment_override(self):
        """A configured data path is honored without changing project files."""
        with patch.dict(os.environ, {"SYNC_DASHBOARD_DB": self.database}):
            async with AsyncClient(transport=ASGITransport(app=create_app()),
                                   base_url="http://testserver") as client:
                self.assertEqual((await client.get("/api/health")).status_code, 200)
        self.assertTrue(Path(self.database).is_file())


if __name__ == "__main__":
    unittest.main()
