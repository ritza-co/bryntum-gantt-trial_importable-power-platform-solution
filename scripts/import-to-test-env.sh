#!/usr/bin/env bash
# Imports the managed zip into a clean environment, the way a customer admin will.
# Usage: bash scripts/import-to-test-env.sh https://<clean-test-org>.crm4.dynamics.com [path to zip]
set -euo pipefail
ENV_URL="${1:?Usage: bash scripts/import-to-test-env.sh https://orgXXXX.crmN.dynamics.com [zip]}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ZIP="${2:-$ROOT/dist/BryntumGanttTrial_managed.zip}"
# Prefer the pac installed as a dotnet tool (2.x) over any older pac on the PATH.
export PATH="$HOME/.dotnet/tools:$PATH"
pac solution import --path "$ZIP" --environment "$ENV_URL" --async --max-async-wait-time 30 --activate-plugins 2>&1 | cat
pac solution list --environment "$ENV_URL" 2>&1 | grep -i "bryntum" || true
