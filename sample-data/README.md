# Sample data

Three ways to get the sample project into the Dataverse tables. Use one.

1. **In the app (easiest).** Open the Gantt in a model-driven app or custom page. When the tables are empty it shows a **Load sample project** button in its toolbar. Click it; the component creates the rows through the Web API.
2. **Script.** `node scripts/provision-dataverse.mjs --url <environment url> --seed` seeds `sample-project.json` after creating the tables.
3. **CSV import in the maker portal.** Import `bryntum-gantt-tasks.csv` into *Bryntum Gantt Tasks* first, then copy the generated row ids of *Website redesign* and *Launch* into the `Parent task id` column of their sub-tasks and import again (or edit the rows). Then import `bryntum-gantt-dependencies.csv` into *Bryntum Gantt Dependencies*, mapping *From task* and *To task* to the lookup columns by task name.

Dates in the files are in November 2026. The in-app loader uses the current week instead.
