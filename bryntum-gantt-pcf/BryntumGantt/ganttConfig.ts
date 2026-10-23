import type { BryntumGanttProps } from '@bryntum/gantt-react';

// Static Gantt configuration. Data, the toolbar and event listeners are added in
// BryntumGanttComponent.tsx because they depend on component state.
export const ganttConfig: Partial<BryntumGanttProps> = {
    // The rows come from Dataverse as a flat list with parentId; Bryntum builds the tree.
    taskStore : {
        tree              : true,
        transformFlatData : true
    } as BryntumGanttProps['taskStore'],

    columns : [
        { type : 'name', field : 'name', text : 'Task', width : 260 },
        { type : 'startdate', width : 120 },
        { type : 'duration', width : 100 },
        { type : 'percentdone', text : '% done', width : 90 }
    ],

    viewPreset    : 'weekAndDayLetter',
    barMargin     : 8,
    rowHeight     : 40,
    selectionMode : { multiSelect : false },

    // Keep the chart pleasant to use on a trial: dragging, resizing, dependency drawing
    // and the task editor are all on by default. Export features need extra setup, so stay off.
    pdfExportFeature   : false,
    excelExporterFeature : false
};
