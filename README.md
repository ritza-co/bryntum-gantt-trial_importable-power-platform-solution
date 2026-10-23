# Bryntum Gantt (trial) as an importable Power Platform solution

A Bryntum Gantt 7.3.7 trial build wrapped as a Power Apps component framework (PCF) code component, plus the two Dataverse tables it reads and writes, packaged as a solution zip that an admin can import without any developer tooling.

```
code/
├── bryntum-gantt-pcf/      PCF project (React, Bryntum Gantt trial, Dataverse Web API CRUD)
├── solution/               Solution project: `dotnet build -c Release` → managed + unmanaged zips
├── scripts/                Provision tables, push the control, export/import, sync solution source
├── sample-data/            Sample project as JSON and CSV
└── dist/                   Exported zips (created by scripts/export-solution.sh; not in git)
```

## How the component works

- Reads tasks and dependencies from `bryntum_bryntumgantttask` and `bryntum_bryntumganttdependency` with `context.webAPI.retrieveMultipleRecords`, builds the tree from `parentid`, and renders the Gantt.
- Every change a user makes (drag, resize, task editor, dependency drawn, indent, delete) is written back with `createRecord`, `updateRecord`, `deleteRecord`. New rows get their Dataverse id applied to the Bryntum record so later edits hit the right row.
- Empty tables: the toolbar shows **Load sample project**, which creates a two-phase sample through the Web API.
- Hosts without the Dataverse Web API (canvas apps, the local test harness): the component renders the same sample read-only and says so. The Web API is only available in model-driven apps and custom pages, so that is where live data works.
- No external requests: Bryntum, FontAwesome (font inlined) and the Svalbard theme are bundled, so the component is not flagged as premium.

Known Power Apps quirks handled in this project:

- **Promise replacement.** Canvas apps and custom pages replace the page's global `Promise` with a WinJS implementation. Promises Bryntum creates with `new Promise` then fail inside the task editor (`this._state.then is not a function`, see the forum thread t=35643). `webpack.config.js` binds the `Promise` identifier in the bundle to the browser's native constructor; `featureconfig.json` turns that custom config on. `pcfconfig.json` also targets current browsers so Babel leaves Bryntum's `async` functions native. Both are needed.
- **z-index flattening.** Power Apps flattens Bryntum's dynamic z-index, so `BryntumGantt/css/BryntumGanttComponent.css` pins the task editor, its pickers and the delete confirmation dialog in a fixed order.

## What you need

- Node.js 20 or newer and npm.
- .NET SDK 8 or newer (`dotnet`), which also restores the Power Apps MSBuild packages.
- Power Platform CLI, only for the Dataverse steps: `dotnet tool install --global Microsoft.PowerApps.CLI.Tool` (puts `pac` in `~/.dotnet/tools`).
- For the Dataverse steps: a Dataverse environment where you have the System Administrator or System Customizer role. A free developer environment from the Power Apps Developer Plan is enough.

## Build the zips from source (no Dataverse needed)

`solution/src` holds the two table definitions exported from Dataverse, and the solution project references the control, so one command rebuilds both zips:

```sh
cd bryntum-gantt-pcf && npm install && cd ..
bash scripts/build-solution.sh
```

Output: `solution/bin/Release/BryntumGanttTrial_managed.zip` and `solution/bin/Release/BryntumGanttTrial.zip` (unmanaged). The script deletes `bryntum-gantt-pcf/out` first because MSBuild packs whatever bundle is there, and `npm start` leaves a development bundle behind.

To change the version, edit `<Version>` in `solution/src/Other/Solution.xml` and `version` in `bryntum-gantt-pcf/BryntumGantt/ControlManifest.Input.xml`. Power Apps only picks up a new control build when the control version changes.

**Bundle size.** Dataverse rejects web resources over 5 MiB (5,242,880 bytes). The trial build of Bryntum Gantt is obfuscated and minifies to 5,142,218 bytes (4.90 MiB), about 100 KB under, and only when `pcfconfig.json` targets current browsers (Chrome, Edge and Firefox 120, Safari 17), which is what Power Apps supports anyway. With the default pcf-scripts targets Babel rewrites parts of the bundle and it lands 4.6 KB over the limit. Keep the targets as they are, and check the size after any Bryntum upgrade: `pcf-scripts` fails the build with `pcf-1045` when it is too big. (The thin trial packages were measured too, 5,585,441 bytes, so they do not help here. Licensed builds are about 3.9 MiB.)

## Work on the control

```sh
cd bryntum-gantt-pcf
npm install            # trial packages come from the public npm registry (see .npmrc)
npm run copy-css       # refresh BryntumGantt/css from node_modules after a Bryntum upgrade
npm run build:release  # production bundle in out/controls/BryntumGantt
npm start              # Microsoft test harness with the read-only sample (development build)
```

The harness pops up two alerts saying retrieving records "is not yet supported"; dismiss them, the component then shows the sample. For a mocked Web API use PCF Workbench (`npx @pcfworkbench/cli start` from `code/`), which serves `bryntum-gantt-pcf/data.json`.

To try a change against real Dataverse without rebuilding the zips, push the control straight into a build environment that already has the solution:

```sh
pac auth create --environment https://<build-org>.crm4.dynamics.com   # once
bash scripts/push-pcf.sh https://<build-org>.crm4.dynamics.com
```

Then remove and re-add the component on the page and republish; Power Apps caches the old version otherwise.

## Change the tables (needs Dataverse)

The tables are Dataverse metadata, so edit them in an environment and re-export rather than by hand in XML:

```sh
# 1. Publisher "Bryntum" (prefix bryntum), solution BryntumGanttTrial, both tables, lookups, sample rows.
#    Idempotent; re-run after adding columns to the script.
node scripts/provision-dataverse.mjs --url https://<build-org>.crm4.dynamics.com --seed

# 2. Push the control into that solution
bash scripts/push-pcf.sh https://<build-org>.crm4.dynamics.com

# 3. Export managed + unmanaged zips to dist/ (also usable as the deliverable directly)
bash scripts/export-solution.sh https://<build-org>.crm4.dynamics.com 1.0.0.2

# 4. Pull the table definitions back into solution/src so the offline build stays in sync
bash scripts/sync-solution-source.sh
```

Column names the component reads and writes are in `bryntum-gantt-pcf/BryntumGantt/constants.ts` and the `taskToRow` / `rowToTask` functions in `BryntumGanttComponent.tsx`; the provisioning script's column list must match them.

## Test the import on a clean environment

Use an environment that has never had the solution, otherwise the import proves nothing:

```sh
bash scripts/import-to-test-env.sh https://<clean-test-org>.crm4.dynamics.com
```

Then follow `short-import-guide.md` (the guide the customer's admin gets) from step 2 onward and check that the Gantt renders, the sample loads, and a dragged task keeps its new dates after a page refresh. To remove it afterwards, delete the test app's site map and custom page from the Default Solution first, then the solution (guide section 8).

## Changing the target tables

Point the component at other tables by editing `BryntumGantt/constants.ts` (names) and the column mapping in `BryntumGanttComponent.tsx`, then rebuild and push a new control version (bump `version` in `ControlManifest.Input.xml` so Power Apps picks it up).
