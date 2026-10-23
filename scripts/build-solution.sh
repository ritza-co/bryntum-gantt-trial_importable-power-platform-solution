#!/usr/bin/env bash
# Builds the control and packs solution/ into managed + unmanaged zips without touching Dataverse.
# Output: solution/bin/Release/BryntumGanttTrial.zip and BryntumGanttTrial_managed.zip
# Note: the zips only contain the tables if scripts/sync-solution-source.sh has been run once.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# A leftover development bundle (from `npm start`) would otherwise be packed as-is, so start clean.
rm -rf "$ROOT/bryntum-gantt-pcf/out" "$ROOT/solution/obj" "$ROOT/solution/bin"
# The pcfproj sets PcfBuildMode=production, so MSBuild runs the production npm build itself.
cd "$ROOT/solution" && dotnet build -c Release
ls -la "$ROOT/solution/bin/Release/"*.zip
