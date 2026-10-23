# Bryntum Gantt for Power Apps: import guide

This solution adds the Bryntum Gantt (trial build) to your Power Platform environment as a code component, together with the two Dataverse tables it stores its data in. It is for evaluation: the Gantt shows the Bryntum trial watermark. No code or developer tools are needed.

**What you receive**

- `BryntumGanttTrial_managed.zip`: import this one. It can be removed again in one step.
- `BryntumGanttTrial_unmanaged.zip`: only if you want to edit the tables or the component in your environment.
- Sample data as CSV (optional, the component can also create it for you).

**What you need**

- A Power Platform environment with Dataverse.
- The System Administrator or System Customizer security role in that environment.
- About 15 minutes.

## 1. Import the solution

1. Go to https://make.powerapps.com and pick the environment in the top-right corner.
2. In the left menu choose **Solutions**, then **Import solution**.
3. **Browse** to `BryntumGanttTrial_managed.zip`, choose **Next**, then **Import**.
4. Wait for the green "Solution imported successfully" bar (two to five minutes).

You now have a solution called **Bryntum Gantt (trial)** containing the tables **Bryntum Gantt Task** and **Bryntum Gantt Dependency** and the code component **Bryntum Gantt**.

## 2. Allow code components in pages

Skip this if your environment already uses code components in canvas apps or custom pages.

1. Go to https://admin.powerplatform.microsoft.com, choose **Manage** in the left menu, then **Environments**, and open your environment.
2. Choose **Settings**, expand **Product**, choose **Features**.
3. Turn on **Power Apps component framework for canvas apps** and **Save**.

## 3. Add the Gantt to an app

The component reads and writes Dataverse through the Power Apps Web API, which is available in model-driven apps and custom pages. It is not available inside plain canvas apps; there the Gantt only shows a read-only sample and says so. The quickest working setup is a model-driven app with one custom page:

1. In https://make.powerapps.com choose **Apps** in the left menu, then **+ New app**, then **Start with a page design**. In the gallery pick **Blank page with navigation**, the card tagged *Model driven app* (the cards tagged *Canvas app* will not work with live data). Name it, for example, `Bryntum Gantt Trial`, and choose **Create**.
2. In the app designer choose **Add page**, **Custom page**, **Create a custom page**, name it `Bryntum Gantt page`, and click **Create**. Power Apps Studio opens the page. (Page names must be unique in the environment; if Save says the name already exists, pick another.)
3. In Studio choose **Insert** (the **+** on the left), then **Get more components** at the top of the panel. Open the **Code** tab, tick **Bryntum Gantt**, click **Import**.
4. Still in **Insert**, expand **Code components** and choose **Bryntum Gantt**. It lands on the page.
5. Make it fill the page.
6. Click **Save**, wait for it to save.
7. Click **Back** button top left to leave
8. Bryntum Gantt Trial in table, hover over and click edit.
9. Click **Save and Publish** button at top right.
10. Once publish completed, click **Play** button it top right

 then **Publish**, then **Play**.

If you prefer, you can add the same component to a form of any model-driven app instead (form designer, **Components**, **Get more components**, **Code**).

## 4. First run

The tables are empty after import, so the Gantt opens empty with a **Load sample project** button in its toolbar. Choose it: the component creates a small two-phase project (nine tasks, six dependencies) in the tables. From then on every change you make in the chart is saved to Dataverse: drag a task, resize it, draw a dependency from one bar to another, double-click a task to open the editor, right-click for more options, or use the toolbar to add tasks and zoom.

Refresh the page to see that your changes were kept.

## 5. Use your own data

Add rows to the **Bryntum Gantt Task** table (Tables in the maker portal, or any import). Useful columns:

| Column | Meaning |
|---|---|
| Name | Task name |
| Start date, End date | Task dates |
| Duration, Duration unit | For example `5` and `day` |
| Percent done | 0 to 100 |
| Parent task id | Paste the row id of the summary task to make this a sub-task |
| Parent index | Order among siblings, starting at 0 |
| Expanded | 1 to show sub-tasks open |

Dependencies live in **Bryntum Gantt Dependency**: set **From task** and **To task** (lookups), **Type** = 2 for finish-to-start, **Lag** = 0, **Lag unit** = `day`. The CSV files that come with the solution show the full layout.

## 6. If something does not look right

| What you see | What to do |
|---|---|
| "Bryntum Gantt could not load its data" and "tables were not found" | The import did not finish or the tables were removed. Import the solution again. |
| A permissions error | Give the user a security role with read, write, create and delete on the two Bryntum Gantt tables. System Administrator has this. |
| "Sample data, read-only" banner | The component is in a canvas app. Use a custom page or a model-driven form (step 3). |
| Bryntum Gantt is missing from the **Code** tab | Wait a minute and refresh Studio, and check step 2. |
| An old version keeps showing after an update | Remove the component from the page, add it again, publish the page and the app. |
| Dependency arrows missing or bunched up while editing the page in Studio | Studio scales the design surface. Press **Play** or open the published app: the arrows draw correctly there. |

## 7. Known limitations of this trial package

- **Evaluation build.** The chart shows the Bryntum trial watermark. A production version needs a Bryntum Gantt licence.
- **Model-driven apps and custom pages only for live data.** The component uses the Power Apps Web API to read and write Dataverse, and Microsoft does not provide that API to canvas apps. In a canvas app the component still renders, with a sample project and a "read-only" notice. If you need the Gantt in a canvas app with live data, tell us: that is a different, dataset-bound build.
- **Its own two tables.** The Gantt reads and writes *Bryntum Gantt Task* and *Bryntum Gantt Dependency*. Connecting it to your existing tables is a follow-up that needs a small change to the component.
- **Tasks and dependencies only.** Resources, assignments, calendars and baselines are not stored in this version, so those Gantt features show no data.
- **Right-click menu position.** In a model-driven app custom page the task context menu opens in the top-left corner of the page instead of at the cursor. It still works from there. The toolbar and the task editor (double-click a task) cover the same actions. We have an open GitHub issue for this: https://github.com/bryntum/bryntum-suite/issues/14486
- **One user at a time.** Changes save immediately, but another user's changes appear only after a page refresh.

## 8. Removing the trial

First delete any app or page that uses the component (they depend on the solution): **Apps**, then the **...** menu of the model-driven app and of the custom page, **Delete**. Then **Solutions**, select **Bryntum Gantt (trial)**, **Delete**. Because it is a managed solution, this removes the component, the tables and their data in one step. If Dataverse still reports "Solution dependencies exist", select the solution and choose **Show dependencies** to see what is left. Leftovers from a deleted model-driven app live in **Solutions**, **Default Solution**, **Objects**: delete the app's **Site map** first, then the custom page (filter by **Pages**), then the solution.
