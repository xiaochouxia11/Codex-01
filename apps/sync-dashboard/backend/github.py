"""Fetch a bounded set of public Actions runs from a fixed repository."""
import json
import os
import urllib.error
import urllib.request

REPOSITORY = "xiaochouxia11/Codex-01"


def fetch_runs():
    """Read GitHub only; never trigger workflows or write remote data."""
    headers = {"User-Agent": "Codex-Sync-Dashboard", "Accept": "application/vnd.github+json"}
    if os.environ.get("GH_TOKEN"):
        headers["Authorization"] = "Bearer " + os.environ["GH_TOKEN"]
    request = urllib.request.Request(
        f"https://api.github.com/repos/{REPOSITORY}/actions/runs?per_page=30", headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            payload = json.load(response)
    except urllib.error.HTTPError as error:
        raise RuntimeError(f"GitHub returned HTTP {error.code}. Try again later.") from error
    except (OSError, urllib.error.URLError, json.JSONDecodeError) as error:
        raise RuntimeError("GitHub is unavailable. Your cached records are unchanged.") from error
    return [{"id": int(run["id"]), "name": run["name"], "status": run["status"],
             "conclusion": run.get("conclusion"), "branch": run.get("head_branch") or "—",
             "updated_at": run["updated_at"],
             "url": f"https://github.com/{REPOSITORY}/actions/runs/{int(run['id'])}"}
            for run in payload["workflow_runs"]]
