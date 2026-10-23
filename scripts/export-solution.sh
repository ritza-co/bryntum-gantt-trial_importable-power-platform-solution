#!/usr/bin/env bash
# Exports the BryntumGanttTrial solution (tables + control) as managed and unmanaged zips into dist/.
# Usage: bash scripts/export-solution.sh https://orgXXXX.crmN.dynamics.com [version e.g. 1.0.0.1]
set -euo pipefail
ENV_URL="${1:?Usage: bash scripts/export-solution.sh https://orgXXXX.crmN.dynamics.com [version]}"
VERSION="${2:-}"
# Prefer the pac installed as a dotnet tool (2.x) over any older pac on the PATH.
export PATH="$HOME/.dotnet/tools:$PATH"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$ROOT/dist"
if [ -n "$VERSION" ]; then
  pac solution online-version --solution-name BryntumGanttTrial --solution-version "$VERSION" --environment "$ENV_URL" 2>&1 | cat
fi
pac solution publish --environment "$ENV_URL" 2>&1 | cat
pac solution export --name BryntumGanttTrial --path "$ROOT/dist/BryntumGanttTrial_unmanaged.zip" --managed false --environment "$ENV_URL" --overwrite 2>&1 | cat
pac solution export --name BryntumGanttTrial --path "$ROOT/dist/BryntumGanttTrial_managed.zip" --managed true --environment "$ENV_URL" --overwrite 2>&1 | cat
ls -la "$ROOT/dist"
