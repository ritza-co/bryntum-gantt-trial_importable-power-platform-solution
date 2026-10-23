import { IInputs } from './generated/ManifestTypes';

export interface IBryntumGanttComponentProps {
    context?: ComponentFramework.Context<IInputs>;
}

// Plain-object shape of a Bryntum TaskModel as the component moves it between
// Dataverse and the Gantt. Field names match https://bryntum.com/products/gantt/docs/api/Gantt/model/TaskModel
export type GanttTask = {
    id: string;
    name: string;
    startDate?: string | Date | null;
    endDate?: string | Date | null;
    effort?: number | null;
    effortUnit?: string | null;
    duration?: number | null;
    durationUnit?: string | null;
    percentDone?: number | null;
    schedulingMode?: string | null;
    note?: string | null;
    constraintType?: string | null;
    constraintDate?: string | Date | null;
    manuallyScheduled?: boolean | number | null;
    unscheduled?: boolean | number | null;
    ignoreResourceCalendar?: boolean | number | null;
    effortDriven?: boolean | number | null;
    inactive?: boolean | number | null;
    cls?: string | null;
    iconCls?: string | null;
    color?: string | null;
    expanded?: boolean | number | null;
    calendar?: string | null;
    deadline?: string | Date | null;
    direction?: string | null;
    parentId?: string | null;
    parentIndex?: number | null;
    orderedParentIndex?: number | null;
};

export type GanttDependency = {
    id: string;
    from: string;
    to: string;
    type?: number | null;
    cls?: string | null;
    lag?: number | null;
    lagUnit?: string | null;
    active?: boolean | number | null;
    fromSide?: string | null;
    toSide?: string | null;
};

// The subset of the Bryntum Store "dataChange" event the component uses.
// See https://bryntum.com/products/gantt/docs/api/Core/data/Store#event-dataChange
export type DataChangeEvent = {
    action: 'dataset' | 'add' | 'remove' | 'removeAll' | 'update' | 'clearchanges' | 'filter' | 'replace';
    store: { id: string };
    record?: unknown;
    records?: unknown[];
    changes?: Record<string, { value: unknown; oldValue: unknown }>;
    // Tree flags forwarded from the underlying add/remove events.
    isExpand?: boolean;
    isCollapse?: boolean;
    isMove?: boolean | Record<string, boolean>;
};

export type DataverseRow = Record<string, unknown>;

export type LoadState =
    | { kind: 'loading' }
    | { kind: 'ready'; source: 'dataverse' | 'sample'; tasks: GanttTask[]; dependencies: GanttDependency[] }
    | { kind: 'error'; message: string; hint: string };
