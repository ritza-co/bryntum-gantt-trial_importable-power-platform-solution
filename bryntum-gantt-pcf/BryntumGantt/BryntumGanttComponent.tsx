import * as React from 'react';
import { BryntumGantt as BryntumGanttWrapper } from '@bryntum/gantt-react';
import { DependencyModel, Gantt, TaskModel, Toast } from '@bryntum/gantt';
import {
    DataChangeEvent,
    DataverseRow,
    GanttDependency,
    GanttTask,
    IBryntumGanttComponentProps,
    LoadState
} from './BryntumGanttComponent.types';
import { ErrorPanel, LoadingSpinner } from './LoadingSpinner';
import { ganttConfig } from './ganttConfig';
import { dependenciesTable, dependencyFromLookup, dependencyToLookup, publisherPrefix as p, tasksTable } from './constants';
import { buildSampleProject } from './sampleProject';

// ---------------------------------------------------------------------------
// Bryntum record shapes the component relies on (kept local to avoid fighting the typings)
// ---------------------------------------------------------------------------
type TaskRecord = TaskModel & {
    isPhantom: boolean;
    parent?: TaskRecord & { isRoot?: boolean };
    allChildren?: TaskRecord[];
    orderedParentIndex?: number;
    parentIndex?: number;
    note?: string;
    iconCls?: string;
    color?: string;
    direction?: string;
    deadline?: Date | null;
};

type DependencyRecord = DependencyModel & {
    isPhantom: boolean;
    fromTask?: TaskRecord;
    toTask?: TaskRecord;
    fromSide?: string;
    toSide?: string;
    cls?: unknown;
    active?: boolean;
};

type WebApi = ComponentFramework.WebApi;

// The wrapper's typings target React 18; the PCF platform library is React 16.8, so type the
// element loosely. All props are still validated by Bryntum at runtime.
const BryntumGantt = BryntumGanttWrapper as unknown as React.ComponentType<Record<string, unknown>>;
type GanttWithStores = Gantt & { dependencyStore: { applyChangeset(changes: object): void } };

// ---------------------------------------------------------------------------
// Value helpers
// ---------------------------------------------------------------------------
const str = (v: unknown): string | null => (v === undefined || v === null || v === '' ? null : String(v));
const num = (v: unknown): number | null => (v === undefined || v === null || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
const flag = (v: unknown): number | null => (v === undefined || v === null ? null : (v ? 1 : 0));
const iso = (v: unknown): string | null => {
    if (!v) return null;
    const d = v instanceof Date ? v : new Date(String(v));
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

// ---------------------------------------------------------------------------
// Dataverse row <-> Gantt task / dependency mapping
// ---------------------------------------------------------------------------
function rowToTask(row: DataverseRow): GanttTask {
    return {
        id                     : String(row[tasksTable.primaryIdAttribute]),
        name                   : (row[`${p}name`] as string) ?? '',
        startDate              : row[`${p}startdate`] as string | null,
        endDate                : row[`${p}enddate`] as string | null,
        effort                 : row[`${p}effort`] as number | null,
        effortUnit             : row[`${p}effortunit`] as string | null,
        duration               : row[`${p}duration`] as number | null,
        durationUnit           : row[`${p}durationunit`] as string | null,
        percentDone            : row[`${p}percentdone`] as number | null,
        schedulingMode         : row[`${p}schedulingmode`] as string | null,
        note                   : row[`${p}note`] as string | null,
        constraintType         : row[`${p}constrainttype`] as string | null,
        constraintDate         : row[`${p}constraintdate`] as string | null,
        manuallyScheduled      : row[`${p}manuallyscheduled`] as number | null,
        unscheduled            : row[`${p}unscheduled`] as number | null,
        ignoreResourceCalendar : row[`${p}ignoreresourcecalendar`] as number | null,
        effortDriven           : row[`${p}effortdriven`] as number | null,
        inactive               : row[`${p}inactive`] as number | null,
        cls                    : row[`${p}cls`] as string | null,
        iconCls                : row[`${p}iconcls`] as string | null,
        color                  : row[`${p}color`] as string | null,
        expanded               : row[`${p}expanded`] as number | null,
        deadline               : row[`${p}deadline`] as string | null,
        direction              : row[`${p}direction`] as string | null,
        parentId               : (row[`${p}parentid`] as string | null) || null,
        parentIndex            : row[`${p}parentindex`] as number | null,
        orderedParentIndex     : row[`${p}orderedparentindex`] as number | null
    };
}

function rowToDependency(row: DataverseRow): GanttDependency {
    return {
        id       : String(row[dependenciesTable.primaryIdAttribute]),
        from     : String(row[`_${dependencyFromLookup}_value`]),
        to       : String(row[`_${dependencyToLookup}_value`]),
        type     : row[`${p}type`] as number | null,
        cls      : row[`${p}cls`] as string | null,
        lag      : row[`${p}lag`] as number | null,
        lagUnit  : row[`${p}lagunit`] as string | null,
        active   : row[`${p}active`] as number | null,
        fromSide : row[`${p}fromside`] as string | null,
        toSide   : row[`${p}toside`] as string | null
    };
}

function recordToTask(record: TaskRecord): GanttTask {
    const parent = record.parent;
    return {
        id                     : String(record.id),
        name                   : record.name,
        startDate              : record.startDate as Date | null,
        endDate                : record.endDate as Date | null,
        effort                 : record.effort,
        effortUnit             : record.effortUnit,
        duration               : record.duration,
        durationUnit           : record.durationUnit,
        percentDone            : record.percentDone,
        schedulingMode         : record.schedulingMode,
        note                   : record.note,
        constraintType         : record.constraintType as string | null,
        constraintDate         : record.constraintDate as Date | null,
        manuallyScheduled      : record.manuallyScheduled,
        unscheduled            : record.unscheduled,
        ignoreResourceCalendar : record.ignoreResourceCalendar,
        effortDriven           : record.effortDriven,
        inactive               : record.inactive,
        cls                    : record.cls ? String(record.cls) : null,
        iconCls                : record.iconCls,
        color                  : record.color,
        expanded               : record.expanded,
        deadline               : record.deadline,
        direction              : record.direction,
        parentId               : parent && !parent.isRoot ? String(parent.id) : null,
        parentIndex            : record.parentIndex,
        orderedParentIndex     : record.orderedParentIndex
    };
}

function taskToRow(task: GanttTask): DataverseRow {
    return {
        [`${p}name`]                   : task.name || 'New task',
        [`${p}startdate`]              : iso(task.startDate),
        [`${p}enddate`]                : iso(task.endDate),
        [`${p}effort`]                 : num(task.effort),
        [`${p}effortunit`]             : str(task.effortUnit),
        [`${p}duration`]               : num(task.duration),
        [`${p}durationunit`]           : str(task.durationUnit),
        [`${p}percentdone`]            : num(task.percentDone),
        [`${p}schedulingmode`]         : str(task.schedulingMode),
        [`${p}note`]                   : str(task.note),
        [`${p}constrainttype`]         : str(task.constraintType),
        [`${p}constraintdate`]         : iso(task.constraintDate),
        [`${p}manuallyscheduled`]      : flag(task.manuallyScheduled),
        [`${p}unscheduled`]            : flag(task.unscheduled),
        [`${p}ignoreresourcecalendar`] : flag(task.ignoreResourceCalendar),
        [`${p}effortdriven`]           : flag(task.effortDriven),
        [`${p}inactive`]               : flag(task.inactive),
        [`${p}cls`]                    : str(task.cls),
        [`${p}iconcls`]                : str(task.iconCls),
        [`${p}color`]                  : str(task.color),
        [`${p}expanded`]               : flag(task.expanded),
        [`${p}deadline`]               : iso(task.deadline),
        [`${p}direction`]              : str(task.direction),
        [`${p}parentid`]               : str(task.parentId),
        [`${p}parentindex`]            : num(task.parentIndex),
        [`${p}orderedparentindex`]     : num(task.orderedParentIndex)
    };
}

function dependencyToRow(dep: GanttDependency, tasksEntitySet: string, fromName?: string, toName?: string): DataverseRow {
    return {
        [`${p}name`]                           : `${fromName ?? dep.from} → ${toName ?? dep.to}`.slice(0, 100),
        [`${p}type`]                           : num(dep.type) ?? 2,
        [`${p}cls`]                            : str(dep.cls),
        [`${p}lag`]                            : num(dep.lag) ?? 0,
        [`${p}lagunit`]                        : str(dep.lagUnit) ?? 'day',
        [`${p}active`]                         : flag(dep.active) ?? 1,
        [`${p}fromside`]                       : str(dep.fromSide),
        [`${p}toside`]                         : str(dep.toSide),
        [`${dependencyFromLookup}@odata.bind`] : `/${tasksEntitySet}(${dep.from})`,
        [`${dependencyToLookup}@odata.bind`]   : `/${tasksEntitySet}(${dep.to})`
    };
}

const taskSelect = [
    tasksTable.primaryIdAttribute,
    'name', 'startdate', 'enddate', 'effort', 'effortunit', 'duration', 'durationunit', 'percentdone',
    'schedulingmode', 'note', 'constrainttype', 'constraintdate', 'manuallyscheduled', 'unscheduled',
    'ignoreresourcecalendar', 'effortdriven', 'inactive', 'cls', 'iconcls', 'color', 'expanded', 'deadline',
    'direction', 'parentid', 'parentindex', 'orderedparentindex'
].map((c, i) => (i === 0 ? c : `${p}${c}`)).join(',');

const dependencySelect = [
    dependenciesTable.primaryIdAttribute,
    `_${dependencyFromLookup}_value`, `_${dependencyToLookup}_value`,
    `${p}type`, `${p}cls`, `${p}lag`, `${p}lagunit`, `${p}active`, `${p}fromside`, `${p}toside`
].join(',');

function isNotImplemented(e: unknown): boolean {
    // Canvas apps throw PCFNonImplementedError; the Microsoft test harness throws a plain Error
    // "Your control is trying to retrieve multiple records. This is not yet supported."
    const err = e as { name?: string; message?: string } | undefined;
    return !!err && (err.name === 'PCFNonImplementedError' || /not (yet )?(implemented|supported)/i.test(err.message ?? ''));
}

function isNotFound(e: unknown): boolean {
    const err = e as { message?: string; errorCode?: number; status?: number } | undefined;
    return !!err && (err.status === 404 || /not found|could not find|does not exist|0x80060888|0x8006088a/i.test(err.message ?? ''));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export const BryntumGanttComponent: React.FunctionComponent<IBryntumGanttComponentProps> = ({ context }) => {
    const [state, setState] = React.useState<LoadState>({ kind : 'loading' });
    const ganttRef = React.useRef<BryntumGanttWrapper>(null);
    const webApiRef = React.useRef<WebApi | undefined>(context?.webAPI);
    webApiRef.current = context?.webAPI;
    const sourceRef = React.useRef<'dataverse' | 'sample'>('dataverse');
    const entitySetsRef = React.useRef({ tasks : tasksTable.entitySetName, dependencies : dependenciesTable.entitySetName });
    // Phantom id -> promise of the real Dataverse id, for records whose POST is still in flight.
    const inflightCreates = React.useRef(new Map<string, Promise<string>>());

    // Power Apps reports the space it gives the control; the test harness reports NaN or -1.
    const px = (v: unknown): string => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? `${v}px` : '100%');
    const containerStyle: React.CSSProperties = {
        width  : px(context?.mode.allocatedWidth),
        height : px(context?.mode.allocatedHeight)
    };

    const gantt = (): GanttWithStores | undefined => ganttRef.current?.instance as unknown as GanttWithStores | undefined;

    // -----------------------------------------------------------------------
    // Loading
    // -----------------------------------------------------------------------
    const resolveEntitySets = React.useCallback(async() => {
        try {
            const [t, d] = await Promise.all([
                context?.utils.getEntityMetadata(tasksTable.logicalName),
                context?.utils.getEntityMetadata(dependenciesTable.logicalName)
            ]);
            const tm = t as unknown as { EntitySetName?: string } | undefined;
            const dm = d as unknown as { EntitySetName?: string } | undefined;
            if (tm?.EntitySetName) entitySetsRef.current.tasks = tm.EntitySetName;
            if (dm?.EntitySetName) entitySetsRef.current.dependencies = dm.EntitySetName;
        }
        catch {
            // Not available in every host; the constants are the documented defaults.
        }
    }, [context]);

    const fetchFromDataverse = React.useCallback(async(): Promise<{ tasks: GanttTask[]; dependencies: GanttDependency[] }> => {
        const webAPI = webApiRef.current;
        if (!webAPI) throw Object.assign(new Error('Web API unavailable'), { name : 'PCFNonImplementedError' });
        const [tasks, dependencies] = await Promise.all([
            webAPI.retrieveMultipleRecords(tasksTable.logicalName, `?$select=${taskSelect}&$orderby=${p}parentindex asc`),
            webAPI.retrieveMultipleRecords(dependenciesTable.logicalName, `?$select=${dependencySelect}`)
        ]);
        return {
            tasks        : tasks.entities.map(rowToTask),
            dependencies : dependencies.entities
                .map(rowToDependency)
                .filter(d => d.from !== 'null' && d.to !== 'null')
        };
    }, []);

    const load = React.useCallback(async() => {
        try {
            await resolveEntitySets();
            const data = await fetchFromDataverse();
            sourceRef.current = 'dataverse';
            setState({ kind : 'ready', source : 'dataverse', ...data });
        }
        catch (e) {
            if (isNotImplemented(e)) {
                // Canvas apps and the local test harness have no Dataverse Web API.
                const sample = buildSampleProject();
                sourceRef.current = 'sample';
                setState({ kind : 'ready', source : 'sample', tasks : sample.tasks, dependencies : sample.dependencies });
                return;
            }
            const message = (e as Error)?.message ?? String(e);
            console.error('[Bryntum Gantt PCF] load failed', e);
            setState({
                kind : 'error',
                message,
                hint : isNotFound(e)
                    ? `The tables ${tasksTable.logicalName} and ${dependenciesTable.logicalName} were not found. Import the full Bryntum Gantt (trial) solution, which includes them, or update constants.ts to match your own tables.`
                    : 'Check that your user has read and write access to the Bryntum Gantt tables, then reload the page.'
            });
        }
    }, [fetchFromDataverse, resolveEntitySets]);

    React.useEffect(() => {
        void load();
    }, [load]);

    React.useEffect(() => {
        if (state.kind === 'ready' && state.source === 'sample') {
            Toast.show({
                html    : '<b>Sample data, read-only.</b> This host has no Dataverse Web API. Add the component to a model-driven app or a custom page to work with live data.',
                timeout : 10000
            });
        }
    }, [state.kind, state.kind === 'ready' ? state.source : '']);

    // -----------------------------------------------------------------------
    // Writing
    // -----------------------------------------------------------------------
    const realId = React.useCallback(async(record: { id: string | number; isPhantom: boolean }): Promise<string | null> => {
        if (!record.isPhantom) return String(record.id);
        const pending = inflightCreates.current.get(String(record.id));
        return pending ? pending : null;
    }, []);

    const createTask = React.useCallback((record: TaskRecord): Promise<string> => {
        const webAPI = webApiRef.current;
        const phantomId = String(record.id);
        const run = async(): Promise<string> => {
            if (!webAPI) throw new Error('Web API unavailable');
            const g = gantt();
            // Let the scheduling engine finish so dates and duration are normalised.
            await g?.project.commitAsync();
            const task = recordToTask(record);
            if (record.parent && !record.parent.isRoot) {
                task.parentId = await realId(record.parent as unknown as TaskRecord);
            }
            const res = await webAPI.createRecord(tasksTable.logicalName, taskToRow(task));
            g?.taskStore.applyChangeset({ updated : [{ $PhantomId : phantomId, id : res.id }] });
            return res.id;
        };
        const promise = run().finally(() => inflightCreates.current.delete(phantomId));
        inflightCreates.current.set(phantomId, promise);
        return promise;
    }, [realId]);

    const updateTask = React.useCallback(async(record: TaskRecord) => {
        const webAPI = webApiRef.current;
        const id = await realId(record);
        if (!webAPI || !id) return;
        const task = recordToTask(record);
        if (record.parent && !record.parent.isRoot) task.parentId = await realId(record.parent as unknown as TaskRecord);
        await webAPI.updateRecord(tasksTable.logicalName, id, taskToRow(task));
    }, [realId]);

    const deleteTasks = React.useCallback(async(records: TaskRecord[]) => {
        const webAPI = webApiRef.current;
        if (!webAPI) return;
        const all: TaskRecord[] = [];
        const collect = (r: TaskRecord) => {
            all.push(r);
            ((r.allChildren ?? []) as unknown as TaskRecord[]).forEach(c => all.push(c));
        };
        records.forEach(collect);
        for (const r of all) {
            const id = await realId(r);
            if (!id) continue;
            try {
                await webAPI.deleteRecord(tasksTable.logicalName, id);
            }
            catch (e) {
                if (!isNotFound(e)) throw e;
            }
        }
    }, [realId]);

    const dependencyIds = React.useCallback(async(dep: DependencyRecord): Promise<{ from: string; to: string } | null> => {
        const fromTask = dep.fromTask ?? (gantt()?.taskStore.getById(dep.from) as unknown as TaskRecord | undefined);
        const toTask = dep.toTask ?? (gantt()?.taskStore.getById(dep.to) as unknown as TaskRecord | undefined);
        if (!fromTask || !toTask) return null;
        const [from, to] = await Promise.all([realId(fromTask), realId(toTask)]);
        return from && to ? { from, to } : null;
    }, [realId]);

    const createDependency = React.useCallback((record: DependencyRecord): Promise<string> => {
        const webAPI = webApiRef.current;
        const phantomId = String(record.id);
        const run = async(): Promise<string> => {
            if (!webAPI) throw new Error('Web API unavailable');
            const ids = await dependencyIds(record);
            if (!ids) throw new Error('Dependency endpoints are not saved tasks');
            const row = dependencyToRow(
                { id : phantomId, ...ids, type : record.type, cls : record.cls ? String(record.cls) : null, lag : record.lag, lagUnit : record.lagUnit, active : record.active, fromSide : record.fromSide, toSide : record.toSide },
                entitySetsRef.current.tasks,
                record.fromTask?.name,
                record.toTask?.name
            );
            const res = await webAPI.createRecord(dependenciesTable.logicalName, row);
            gantt()?.dependencyStore.applyChangeset({ updated : [{ $PhantomId : phantomId, id : res.id }] });
            return res.id;
        };
        const promise = run().finally(() => inflightCreates.current.delete(phantomId));
        inflightCreates.current.set(phantomId, promise);
        return promise;
    }, [dependencyIds]);

    const updateDependency = React.useCallback(async(record: DependencyRecord) => {
        const webAPI = webApiRef.current;
        const id = await realId(record);
        const ids = await dependencyIds(record);
        if (!webAPI || !id || !ids) return;
        const row = dependencyToRow(
            { id, ...ids, type : record.type, cls : record.cls ? String(record.cls) : null, lag : record.lag, lagUnit : record.lagUnit, active : record.active, fromSide : record.fromSide, toSide : record.toSide },
            entitySetsRef.current.tasks,
            record.fromTask?.name,
            record.toTask?.name
        );
        await webAPI.updateRecord(dependenciesTable.logicalName, id, row);
    }, [dependencyIds, realId]);

    const deleteDependencies = React.useCallback(async(records: DependencyRecord[]) => {
        const webAPI = webApiRef.current;
        if (!webAPI) return;
        for (const r of records) {
            const id = await realId(r);
            if (!id) continue;
            try {
                await webAPI.deleteRecord(dependenciesTable.logicalName, id);
            }
            catch (e) {
                // Cascade delete on the task relationship may already have removed it.
                if (!isNotFound(e)) throw e;
            }
        }
    }, [realId]);

    // Bryntum fires dataChange for every store change. Persist the ones a user made.
    const onDataChange = React.useCallback((event: DataChangeEvent) => {
        if (sourceRef.current !== 'dataverse') return;
        const { store, isExpand, isCollapse } = event;
        const action = String(event.action).toLowerCase();
        // Bryntum passes isMove as true or as a map of record id -> moved flag.
        const isMove = event.isMove === true || (!!event.isMove && typeof event.isMove === 'object' && Object.values(event.isMove).some(Boolean));
        const records = (event.records ?? (event.record ? [event.record] : [])) as unknown[];
        if (!records.length || !['add', 'remove', 'update'].includes(action)) return;

        const report = (e: unknown) => {
            console.error('[Bryntum Gantt PCF] save failed', e);
            Toast.show({ html : `<b>Could not save to Dataverse.</b> ${(e as Error)?.message ?? ''}`, timeout : 8000 });
        };

        if (store.id === 'tasks') {
            const tasks = records as TaskRecord[];
            if (action === 'add') {
                if (isExpand) return;
                // A move (indent, outdent, drag reorder) re-adds existing records: store the new parent/position.
                const work = isMove ? tasks.map(updateTask) : tasks.filter(t => t.isPhantom).map(createTask);
                Promise.all(work).catch(report);
            }
            else if (action === 'remove') {
                if (isCollapse || isMove) return;
                deleteTasks(tasks).catch(report);
            }
            else if (action === 'update') {
                Promise.all(tasks.map(updateTask)).catch(report);
            }
        }
        else if (store.id === 'dependencies') {
            const deps = records as DependencyRecord[];
            if (action === 'add') {
                Promise.all(deps.filter(d => d.isPhantom).map(createDependency)).catch(report);
            }
            else if (action === 'remove') {
                deleteDependencies(deps).catch(report);
            }
            else if (action === 'update') {
                Promise.all(deps.map(updateDependency)).catch(report);
            }
        }
    }, [createDependency, createTask, deleteDependencies, deleteTasks, updateDependency, updateTask]);

    // -----------------------------------------------------------------------
    // Toolbar actions
    // -----------------------------------------------------------------------
    const loadSampleProject = React.useCallback(async() => {
        const webAPI = webApiRef.current;
        const g = gantt();
        if (!webAPI || !g) return;
        g.mask('Creating the sample project in Dataverse…');
        try {
            const sample = buildSampleProject();
            const idByKey = new Map<string, string>();
            for (const task of sample.tasks) {
                const row = taskToRow({ ...task, parentId : task.parentKey ? idByKey.get(task.parentKey) ?? null : null });
                const res = await webAPI.createRecord(tasksTable.logicalName, row);
                idByKey.set(task.key, res.id);
            }
            const nameByKey = new Map(sample.tasks.map(t => [t.key, t.name]));
            for (const dep of sample.dependencies) {
                const row = dependencyToRow(
                    { ...dep, from : idByKey.get(dep.fromKey) as string, to : idByKey.get(dep.toKey) as string },
                    entitySetsRef.current.tasks,
                    nameByKey.get(dep.fromKey),
                    nameByKey.get(dep.toKey)
                );
                await webAPI.createRecord(dependenciesTable.logicalName, row);
            }
            const data = await fetchFromDataverse();
            setState({ kind : 'ready', source : 'dataverse', ...data });
            Toast.show({ html : 'Sample project created. Drag tasks, draw dependencies and open the task editor: every change is saved to Dataverse.', timeout : 8000 });
        }
        catch (e) {
            console.error('[Bryntum Gantt PCF] sample load failed', e);
            Toast.show({ html : `<b>Could not create the sample project.</b> ${(e as Error)?.message ?? ''}`, timeout : 10000 });
        }
        finally {
            g.unmask();
        }
    }, [fetchFromDataverse]);

    const addTask = React.useCallback(() => {
        const g = gantt();
        if (!g) return;
        const selected = g.selectedRecord as TaskRecord | undefined;
        const parent = selected?.parent && !selected.parent.isRoot ? selected.parent : g.taskStore.rootNode;
        const startDate = selected?.endDate ?? g.project.startDate ?? new Date();
        const added = (parent as unknown as { appendChild(d: object): TaskRecord }).appendChild({
            name         : 'New task',
            startDate,
            duration     : 1,
            durationUnit : 'day'
        });
        void g.scrollTaskIntoView(added).then(() => g.editTask(added));
    }, []);

    const hasTasks = state.kind === 'ready' && state.tasks.length > 0;
    const isSample = state.kind === 'ready' && state.source === 'sample';

    const tbar = React.useMemo(() => [
        { type : 'button', ref : 'addTaskButton', text : 'Add task', icon : 'b-fa b-fa-plus', disabled : isSample, onAction : addTask },
        { type : 'button', ref : 'loadSampleButton', text : 'Load sample project', icon : 'b-fa b-fa-wand-magic-sparkles', hidden : hasTasks || isSample, onAction : loadSampleProject },
        '->',
        isSample ? { type : 'widget', cls : 'bryntum-gantt-pcf-status', html : 'Sample data (read-only)' } : null,
        { type : 'button', icon : 'b-fa b-fa-magnifying-glass-plus', tooltip : 'Zoom in', onAction : () => gantt()?.zoomIn() },
        { type : 'button', icon : 'b-fa b-fa-magnifying-glass-minus', tooltip : 'Zoom out', onAction : () => gantt()?.zoomOut() },
        { type : 'button', icon : 'b-fa b-fa-arrows-left-right-to-line', tooltip : 'Zoom to fit', onAction : () => gantt()?.zoomToFit({ leftMargin : 40, rightMargin : 40 }) },
        { type : 'button', icon : 'b-fa b-fa-angles-down', tooltip : 'Expand all', onAction : () => gantt()?.expandAll() },
        { type : 'button', icon : 'b-fa b-fa-angles-up', tooltip : 'Collapse all', onAction : () => gantt()?.collapseAll() }
    ].filter(Boolean), [addTask, hasTasks, isSample, loadSampleProject]);

    // -----------------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------------
    return (
        <div className="bryntum-gantt-pcf-root" style={containerStyle}>
            {state.kind === 'loading' && <LoadingSpinner />}
            {state.kind === 'error' && <ErrorPanel message={state.message} hint={state.hint} />}
            {state.kind === 'ready' && (
                <BryntumGantt
                    ref={ganttRef}
                    {...ganttConfig}
                    tasks={state.tasks}
                    dependencies={state.dependencies}
                    tbar={tbar}
                    readOnly={isSample}
                    onDataChange={onDataChange}
                />
            )}
        </div>
    );
};

export default BryntumGanttComponent;
