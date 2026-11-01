#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
export PYTHONPATH="${PYTHONPATH:-}${PYTHONPATH:+:}${ROOT}/src"

python -m research_agent.interface.cli "$@"
