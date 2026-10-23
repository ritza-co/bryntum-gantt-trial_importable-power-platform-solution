#!/usr/bin/env bash
# Pushes the built control into the BryntumGanttTrial solution of a Dataverse environment.
# Usage: bash scripts/push-pcf.sh https://orgXXXX.crmN.dynamics.com
# Needs: pac auth create --environment <url> done once, and the solution created by provision-dataverse.mjs.
set -euo pipefail
ENV_URL="${1:?Usage: bash scripts/push-pcf.sh https://orgXXXX.crmN.dynamics.com}"
# Prefer the pac installed as a dotnet tool (2.x) over any older pac on the PATH.
export PATH="$HOME/.dotnet/tools:$PATH"
cd "$(dirname "$0")/../bryntum-gantt-pcf"
# "| cat" works around a pac spinner crash on macOS (Console.SetCursorPosition).
# The solution already carries the Bryntum publisher (prefix bryntum); pac takes one of the two flags, not both.
pac pcf push --solution-unique-name BryntumGanttTrial --environment "$ENV_URL" 2>&1 | cat
