import { GanttDependency, GanttTask } from './BryntumGanttComponent.types';

// A small two-phase project used in three places:
// 1. The "Load sample project" toolbar button writes it into the Dataverse tables when they are empty.
// 2. Hosts without the Dataverse Web API (canvas apps, the local test harness) render it read-only.
// 3. sample-data/*.csv and scripts/provision-dataverse.mjs seed the same rows.
//
// Dates are relative to the Monday of the current week so the Gantt always opens on live-looking data.

type SampleTask = Omit<GanttTask, 'id' | 'startDate' | 'endDate' | 'parentId'> & {
    key: string;
    parentKey?: string;
    startOffsetDays: number;
    durationDays: number;
};

const sampleTasks: SampleTask[] = [
    { key : 'phase1', name : 'Website redesign', startOffsetDays : 0, durationDays : 19, expanded : true, percentDone : 45, parentIndex : 0, orderedParentIndex : 0 },
    { key : 'research', parentKey : 'phase1', name : 'Research', startOffsetDays : 0, durationDays : 5, percentDone : 100, parentIndex : 0, orderedParentIndex : 0 },
    { key : 'design', parentKey : 'phase1', name : 'Design', startOffsetDays : 7, durationDays : 5, percentDone : 60, parentIndex : 1, orderedParentIndex : 1 },
    { key : 'prototype', parentKey : 'phase1', name : 'Build prototype', startOffsetDays : 14, durationDays : 5, percentDone : 20, parentIndex : 2, orderedParentIndex : 2 },
    { key : 'review', parentKey : 'phase1', name : 'Internal review', startOffsetDays : 21, durationDays : 3, percentDone : 0, parentIndex : 3, orderedParentIndex : 3 },
    { key : 'phase2', name : 'Launch', startOffsetDays : 24, durationDays : 10, expanded : true, percentDone : 0, parentIndex : 1, orderedParentIndex : 1 },
    { key : 'docs', parentKey : 'phase2', name : 'Documentation', startOffsetDays : 24, durationDays : 5, percentDone : 0, parentIndex : 0, orderedParentIndex : 0 },
    { key : 'training', parentKey : 'phase2', name : 'Customer training', startOffsetDays : 28, durationDays : 3, percentDone : 0, parentIndex : 1, orderedParentIndex : 1 },
    { key : 'golive', parentKey : 'phase2', name : 'Go live', startOffsetDays : 35, durationDays : 0, percentDone : 0, parentIndex : 2, orderedParentIndex : 2 }
];

// Finish-to-start chain. Bryntum dependency type 2 = end-to-start.
const sampleDependencies: { fromKey: string; toKey: string }[] = [
    { fromKey : 'research', toKey : 'design' },
    { fromKey : 'design', toKey : 'prototype' },
    { fromKey : 'prototype', toKey : 'review' },
    { fromKey : 'review', toKey : 'docs' },
    { fromKey : 'docs', toKey : 'training' },
    { fromKey : 'training', toKey : 'golive' }
];

export function mondayOfThisWeek(now = new Date()): Date {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const day = d.getDay(); // 0 = Sunday
    d.setDate(d.getDate() - ((day + 6) % 7));
    return d;
}

function addDays(date: Date, days: number): Date {
    const d = new Date(date.getTime());
    d.setDate(d.getDate() + days);
    return d;
}

export type SampleProject = {
    tasks: (GanttTask & { key: string; parentKey?: string })[];
    dependencies: (GanttDependency & { fromKey: string; toKey: string })[];
};

// Builds the sample with the given id generator so the same data can carry temporary
// ids (read-only rendering) or real Dataverse ids (after the rows were created).
export function buildSampleProject(start: Date = mondayOfThisWeek()): SampleProject {
    const tasks = sampleTasks.map(t => {
        const { key, parentKey, startOffsetDays, durationDays, ...rest } = t;
        const startDate = addDays(start, startOffsetDays);
        return {
            ...rest,
            key,
            parentKey,
            id                : `sample-${key}`,
            parentId          : parentKey ? `sample-${parentKey}` : null,
            startDate,
            endDate           : addDays(startDate, durationDays),
            duration          : durationDays,
            durationUnit      : 'day',
            manuallyScheduled : false
        };
    });

    const dependencies = sampleDependencies.map((d, i) => ({
        id       : `sample-dep-${i + 1}`,
        fromKey  : d.fromKey,
        toKey    : d.toKey,
        from     : `sample-${d.fromKey}`,
        to       : `sample-${d.toKey}`,
        type     : 2,
        lag      : 0,
        lagUnit  : 'day',
        active   : true,
        fromSide : 'end',
        toSide   : 'start'
    }));

    return { tasks, dependencies };
}
