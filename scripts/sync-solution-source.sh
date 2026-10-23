#!/usr/bin/env bash
# Pulls the exported unmanaged solution apart into solution/src so the tables live in source
# control next to the control, and `dotnet build` in solution/ rebuilds the complete zip.
# Usage: bash scripts/sync-solution-source.sh   (after export-solution.sh)
set -euo pipefail
# Prefer the pac installed as a dotnet tool (2.x) over any older pac on the PATH.
export PATH="$HOME/.dotnet/tools:$PATH"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ZIP="$ROOT/dist/BryntumGanttTrial_unmanaged.zip"
[ -f "$ZIP" ] || { echo "Missing $ZIP. Run scripts/export-solution.sh first." >&2; exit 1; }
pac solution unpack --zipfile "$ZIP" --folder "$ROOT/solution/src" --packagetype Unmanaged --allowDelete --allowWrite 2>&1 | cat
# The control itself is built from source by the cdsproj reference, so drop the exported copy.
rm -rf "$ROOT/solution/src/Controls"
# The export is unmanaged (<Managed>0</Managed>); the project packs both types, which needs 2.
sed -i '' 's#<Managed>[0-9]</Managed>#<Managed>2</Managed>#' "$ROOT/solution/src/Other/Solution.xml"
echo "solution/src now contains:"; find "$ROOT/solution/src" -maxdepth 2 | sort
