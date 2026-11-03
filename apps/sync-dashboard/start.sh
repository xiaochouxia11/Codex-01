#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
dashboard_venv="${DASHBOARD_VENV:-/workspace/.venvs/codex-01-dashboard}"
mode="${1:-dev}"
if [[ "$mode" != "dev" && "$mode" != "serve" ]]; then
  echo "Usage: bash start.sh [dev|serve]" >&2
  exit 2
fi
if [[ ! -x "$dashboard_venv/bin/python" || ! -d frontend/node_modules ]]; then
  echo "Run bash apps/sync-dashboard/install.sh from the repository root first." >&2
  exit 1
fi
if [[ "$mode" == "serve" ]]; then
  if [[ ! -f frontend/dist/index.html ]]; then
    echo "Run npm --prefix frontend run build first." >&2
    exit 1
  fi
  exec "$dashboard_venv/bin/python" -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
fi
python3 - <<'PY'
import socket
for port in (8000, 5173):
    with socket.socket() as connection:
        if connection.connect_ex(("127.0.0.1", port)) == 0:
            raise SystemExit(f"Port {port} is already in use; no existing process was stopped.")
PY
backend_pid=""
frontend_pid=""
cleanup() {
  [[ -z "$backend_pid" ]] || kill "$backend_pid" 2>/dev/null || true
  [[ -z "$frontend_pid" ]] || kill "$frontend_pid" 2>/dev/null || true
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
"$dashboard_venv/bin/python" -m uvicorn backend.app:app --host 127.0.0.1 --port 8000 \
  --reload --reload-dir backend &
backend_pid=$!
(
  cd frontend
  exec node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173 --strictPort
) &
frontend_pid=$!
wait -n "$backend_pid" "$frontend_pid"
