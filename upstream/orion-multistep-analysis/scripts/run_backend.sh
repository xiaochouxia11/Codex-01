#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
export PYTHONPATH="${PYTHONPATH:-}${PYTHONPATH:+:}${ROOT}/src"

uvicorn research_agent.backend.main:app --reload --port 8000
