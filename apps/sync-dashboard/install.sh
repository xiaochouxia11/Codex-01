#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
python3 -c 'import sys; assert sys.version_info >= (3, 10), "Python 3.10+ is required"'
node -e 'const [major,minor]=process.versions.node.split(".").map(Number); if (major < 22 || (major === 22 && minor < 12)) throw Error("Node.js 22.12+ required; Node 24 recommended")'
dashboard_venv="${DASHBOARD_VENV:-/workspace/.venvs/codex-01-dashboard}"
python3 -m venv "$dashboard_venv"
"$dashboard_venv/bin/python" -m pip install --require-hashes -r backend/requirements.txt
"$dashboard_venv/bin/python" -m pip check
npm --prefix frontend ci
npm --prefix frontend run build
