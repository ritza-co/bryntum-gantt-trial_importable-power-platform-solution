import * as React from "react";
import { BryntumTaskBoard as OriginalBryntumTaskBoard } from "@bryntum/taskboard-react";
import { FunctionComponent, useRef } from "react";
import {
  IBryntumTaskboardComponentProps,
  SyncData,
  TaskboardAssignment,
  TaskboardAssignmentDataverse,
  TaskboardResource,
  TaskboardResourceDataverse,
  TaskboardTask,
  TaskboardTaskDataverse,
} from "./BryntumTaskboardComponent.types";
import LoadingSpinner from "./LoadingSpinner";
import { taskboardConfig } from "./taskboardConfig";
import {
  assignmentsDataverseTableName,
  databasePrefix,
  resourcesDataverseTableName,
  tasksDataverseTableName,
} from "./constants";

const BryntumTaskBoard = OriginalBryntumTaskBoard as unknown as React.ComponentType<
  Record<string, unknown>
>;

// NOTE: @bryntum/taskboard-react@7.3.2 does NOT forward an `onDataChange` prop
// (Scheduler/Grid/Calendar wrappers whitelist it; the TaskBoard wrapper does
// not — the docs are ahead of this package version). So instead of the
// onDataChange prop, we listen to each project store's `change` event directly
// (fires on add/remove/update with { action, records }) to drive the sync.
//
// The widget exposes its stores through the project. The published types widen
// these to Store | StoreConfig, so we narrow to the runtime shape we use: id,
// applyChangeset (reconciling phantom ids after a create) and on/un.
type StoreChangeEvent = {
  action: SyncData["action"];
  records: SyncData["records"];
};
type TaskboardStore = {
  id: SyncData["store"]["id"];
  applyChangeset: (changes: {
    updated: { $PhantomId: string; id: string }[];
  }) => void;
  on: (event: string, handler: (event: StoreChangeEvent) => void) => void;
  un: (event: string, handler: (event: StoreChangeEvent) => void) => void;
};
type TaskBoardInstanceStores = {
  project: {
    eventStore: TaskboardStore;
    resourceStore: TaskboardStore;
    assignmentStore: TaskboardStore;
  };
};

function removeTasksDataColumnPrefixes(
  entities: ComponentFramework.WebApi.Entity[]
) {
  return entities.map((entity: ComponentFramework.WebApi.Entity) => {
    const task: Partial<TaskboardTask> = {};
    if (entity[`${databasePrefix}${tasksDataverseTableName}id`]) {
      task.id = entity[`${databasePrefix}${tasksDataverseTableName}id`];
    }
    if (entity[`${databasePrefix}name`]) {
      task.name = entity[`${databasePrefix}name`];
    }
    if (entity[`${databasePrefix}status`]) {
      task.status = entity[`${databasePrefix}status`];
    }
    if (entity[`${databasePrefix}prio`]) {
      task.prio = entity[`${databasePrefix}prio`];
    }
    if (entity[`${databasePrefix}description`]) {
      task.description = entity[`${databasePrefix}description`];
    }
    return task;
  });
}

function removeResourcesDataColumnPrefixes(
  entities: ComponentFramework.WebApi.Entity[]
) {
  return entities.map((entity: ComponentFramework.WebApi.Entity) => {
    const resource: Partial<TaskboardResource> = {};
    if (entity[`${databasePrefix}${resourcesDataverseTableName}id`]) {
      resource.id = entity[`${databasePrefix}${resourcesDataverseTableName}id`];
    }
    if (entity[`${databasePrefix}name`]) {
      resource.name = entity[`${databasePrefix}name`];
    }
    return resource;
  });
}

function removeAssignmentsDataColumnPrefixes(
  entities: ComponentFramework.WebApi.Entity[]
) {
  return entities.map((entity: ComponentFramework.WebApi.Entity) => {
    const assignment: Partial<TaskboardAssignment> = {};
    if (entity[`${databasePrefix}${assignmentsDataverseTableName}id`]) {
      assignment.id =
        entity[`${databasePrefix}${assignmentsDataverseTableName}id`];
    }
    if (entity[`${databasePrefix}taskid`]) {
      assignment.event =
        entity[`${databasePrefix}taskid`][
          `${databasePrefix}${tasksDataverseTableName}id`
        ];
    }
    if (entity[`${databasePrefix}resourceid`]) {
      assignment.resource =
        entity[`${databasePrefix}resourceid`][
          `${databasePrefix}${resourcesDataverseTableName}id`
        ];
    }
    return assignment;
  });
}


function sampleData(): {
  tasks: TaskboardTask[];
  resources: TaskboardResource[];
  assignments: TaskboardAssignment[];
} {
  const t = (id: string, name: string, status: string, prio: string, description = ""): TaskboardTask =>
    ({ id, name, status, prio, description });
  return {
    tasks: [
      t("t1", "Book flight", "done", "medium"),
      t("t2", "Book hotel", "done", "medium"),
      t("t3", "Pack bags", "doing", "low", "Don't forget the charger"),
      t("t4", "Write report", "doing", "high"),
      t("t5", "Review slides", "todo", "high"),
      t("t6", "Plan dinner", "todo", "low"),
    ],
    resources: [
      { id: "r1", name: "Ava" },
      { id: "r2", name: "Ben" },
      { id: "r3", name: "Cleo" },
    ],
    assignments: [
      { id: "a1", event: "t1", resource: "r1" },
      { id: "a2", event: "t3", resource: "r2" },
      { id: "a3", event: "t4", resource: "r3" },
      { id: "a4", event: "t4", resource: "r1" },
    ],
  };
}

const BryntumTaskboardComponent: FunctionComponent<IBryntumTaskboardComponentProps> = (
  props
) => {
  const [data, setData] = React.useState<{
    tasks: TaskboardTask[];
    resources: TaskboardResource[];
    assignments: TaskboardAssignment[];
  }>();

  const taskboard = useRef<OriginalBryntumTaskBoard>(null);
  // Assignments whose task was still an unsaved phantom when the resource was
  // attached. Keyed by the task's phantom id; flushed once the task is created
  // and has a real id (see the "tasks" create branch in syncData).
  const pendingAssignmentsRef = useRef<{
    [taskPhantomId: string]: { assignmentPhantomId: string; resourceId: string }[];
  }>({});
  const allocatedWidth = props.context?.mode.allocatedWidth;
  const allocatedHeight = props.context?.mode.allocatedHeight;
  const containerStyle: React.CSSProperties = {
    width:
      allocatedWidth && allocatedWidth > 0 ? `${allocatedWidth}px` : "100%",
    height:
      allocatedHeight && allocatedHeight > 0 ? `${allocatedHeight}px` : "100%",
  };

  React.useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    try {
      const tasksPromise = props?.context?.webAPI.retrieveMultipleRecords(
        `${databasePrefix}${tasksDataverseTableName}`
      );
      const resourcesPromise = props?.context?.webAPI.retrieveMultipleRecords(
        `${databasePrefix}${resourcesDataverseTableName}`
      );
      const assignmentsPromise = props?.context?.webAPI.retrieveMultipleRecords(
        `${databasePrefix}${assignmentsDataverseTableName}`,
        `?$select=${databasePrefix}taskid,${databasePrefix}resourceid&$expand=${databasePrefix}taskid($select=${databasePrefix}${tasksDataverseTableName}id),${databasePrefix}resourceid($select=${databasePrefix}${resourcesDataverseTableName}id)`
      );

      const [tasks, resources, assignments] = await Promise.all([
        tasksPromise,
        resourcesPromise,
        assignmentsPromise,
      ]);

      if (tasks && resources && assignments) {
        setData({
          tasks: removeTasksDataColumnPrefixes(tasks.entities) as TaskboardTask[],
          resources: removeResourcesDataColumnPrefixes(
            resources.entities
          ) as TaskboardResource[],
          assignments: removeAssignmentsDataColumnPrefixes(
            assignments.entities
          ) as TaskboardAssignment[],
        });
      }
    } catch (e) {
      // No Web API (canvas app, test harness) or the cr8a7_ Task Board tables are missing:
      // show built-in sample data so the editor, combos and dialogs can still be exercised.
      console.warn("[Bryntum TaskBoard PCF] Dataverse load failed, using sample data", e);
      setData(sampleData());
    }
  };

  const syncData = async ({ store, action, records }: SyncData) => {
    const storeId = store.id;
    // TaskBoard's task store reports its id as "tasks" in onDataChange
    if (storeId === "tasks") {
      if (action === "add" || action === "update") {
        for (let i = 0; i < records.length; i++) {
          const task = records[i] as TaskboardTask;
          const isNew = `${task.id}`.startsWith("_generated");
          try {
            const writeData: Partial<TaskboardTaskDataverse> = {};
            if (task?.name) {
              writeData[`${databasePrefix}name`] = task.name;
            }
            if (task?.status) {
              writeData[`${databasePrefix}status`] = task.status;
            }
            if (task?.prio) {
              writeData[`${databasePrefix}prio`] = task.prio;
            }
            if (task?.description) {
              writeData[`${databasePrefix}description`] = task.description;
            }

            if (isNew) {
              const res = await props?.context?.webAPI.createRecord(
                `${databasePrefix}${tasksDataverseTableName}`,
                writeData
              );
              if (taskboard?.current?.instance && res) {
                const { project } = taskboard.current
                  .instance as unknown as TaskBoardInstanceStores;
                project.eventStore.applyChangeset({
                  updated: [{ $PhantomId: task.id, id: res.id }],
                });
                // The task now has a real id, so create any resource
                // assignments that were deferred while it was a phantom.
                const pending = pendingAssignmentsRef.current[task.id];
                if (pending) {
                  delete pendingAssignmentsRef.current[task.id];
                  for (const p of pending) {
                    try {
                      const assignData: Partial<TaskboardAssignmentDataverse> = {};
                      assignData[
                        `${databasePrefix}taskid@odata.bind`
                      ] = `/${databasePrefix}${tasksDataverseTableName}es(${res.id})`;
                      assignData[
                        `${databasePrefix}resourceid@odata.bind`
                      ] = `/${databasePrefix}${resourcesDataverseTableName}es(${p.resourceId})`;
                      const ares = await props?.context?.webAPI.createRecord(
                        `${databasePrefix}${assignmentsDataverseTableName}`,
                        assignData
                      );
                      if (ares) {
                        project.assignmentStore.applyChangeset({
                          updated: [
                            { $PhantomId: p.assignmentPhantomId, id: ares.id },
                          ],
                        });
                      }
                    } catch (error) {
                      console.error(error);
                    }
                  }
                }
              }
            } else {
              await props?.context?.webAPI
                .updateRecord(
                  `${databasePrefix}${tasksDataverseTableName}`,
                  task.id,
                  writeData
                )
                .then((res) => {
                  console.log("webAPI.updateRecord for tasks response: ", res);
                });
            }
          } catch (error) {
            console.error(error);
          }
        }
      }
      if (action === "remove") {
        records.forEach((record) => {
          if (`${record.data.id}`.startsWith("_generated")) return;
          try {
            return props?.context?.webAPI
              .deleteRecord(
                `${databasePrefix}${tasksDataverseTableName}`,
                record.data.id
              )
              .then((res) => {
                console.log("deleteRecord: ", { res });
              });
          } catch (error) {
            console.error(error);
          }
        });
      }
    }
    if (storeId === "resources") {
      if (action === "add" || action === "update") {
        for (let i = 0; i < records.length; i++) {
          const resource = records[i] as TaskboardResource;
          const isNew = `${resource.id}`.startsWith("_generated");
          try {
            const writeData: Partial<TaskboardResourceDataverse> = {};
            if (resource?.name) {
              writeData[`${databasePrefix}name`] = resource.name;
            }

            if (isNew) {
              const res = await props?.context?.webAPI.createRecord(
                `${databasePrefix}${resourcesDataverseTableName}`,
                writeData
              );
              if (taskboard?.current?.instance && res) {
                (taskboard.current.instance as unknown as TaskBoardInstanceStores).project.resourceStore.applyChangeset(
                  { updated: [{ $PhantomId: resource.id, id: res.id }] }
                );
              }
            } else {
              await props?.context?.webAPI
                .updateRecord(
                  `${databasePrefix}${resourcesDataverseTableName}`,
                  resource.id,
                  writeData
                )
                .then((res) => {
                  console.log(
                    "webAPI.updateRecord for resources response: ",
                    res
                  );
                });
            }
          } catch (error) {
            console.error(error);
          }
        }
      }
      if (action === "remove") {
        records.forEach((record) => {
          if (`${record.data.id}`.startsWith("_generated")) return;
          try {
            return props?.context?.webAPI
              .deleteRecord(
                `${databasePrefix}${resourcesDataverseTableName}`,
                record.data.id
              )
              .then((res) => {
                console.log("deleteRecord: ", { res });
              });
          } catch (error) {
            console.error(error);
          }
        });
      }
    }
    if (storeId === "assignments") {
      if (action === "add") {
        for (let i = 0; i < records.length; i++) {
          // The change record is a Bryntum AssignmentModel. Its task/resource
          // ids are exposed as eventId/resourceId — the `event`/`resource`
          // getters return the *linked records* (objects), not ids, so reading
          // those produced a malformed odata.bind and the resource was never
          // saved.
          const assignment = records[i] as unknown as {
            id: string;
            eventId: string;
            resourceId: string;
          };
          const taskId = `${assignment.eventId}`;
          const resourceId = `${assignment.resourceId}`;
          // If the task is still an unsaved phantom, defer this assignment
          // until the task is created (see the "tasks" create branch).
          if (taskId.startsWith("_generated")) {
            if (!pendingAssignmentsRef.current[taskId]) {
              pendingAssignmentsRef.current[taskId] = [];
            }
            pendingAssignmentsRef.current[taskId].push({
              assignmentPhantomId: assignment.id,
              resourceId,
            });
            continue;
          }
          try {
            const insertData: Partial<TaskboardAssignmentDataverse> = {};
            insertData[
              `${databasePrefix}taskid@odata.bind`
            ] = `/${databasePrefix}${tasksDataverseTableName}es(${taskId})`;
            insertData[
              `${databasePrefix}resourceid@odata.bind`
            ] = `/${databasePrefix}${resourcesDataverseTableName}es(${resourceId})`;
            const res = await props?.context?.webAPI.createRecord(
              `${databasePrefix}${assignmentsDataverseTableName}`,
              insertData
            );
            if (taskboard?.current?.instance && res) {
              (taskboard.current.instance as unknown as TaskBoardInstanceStores).project.assignmentStore.applyChangeset(
                { updated: [{ $PhantomId: assignment.id, id: res.id }] }
              );
            }
          } catch (error) {
            console.error(error);
          }
        }
      }
      if (action === "remove") {
        records.forEach((record) => {
          if (`${record.data.id}`.startsWith("_generated")) return;
          try {
            return props?.context?.webAPI
              .deleteRecord(
                `${databasePrefix}${assignmentsDataverseTableName}`,
                record.data.id
              )
              .then((res) => {
                console.log("deleteRecord: ", { res });
              });
          } catch (error) {
            console.error(error);
          }
        });
      }
    }
  };

  // Wire each project store's `change` event to syncData once the widget exists
  // (the TaskBoard React wrapper does not forward onDataChange — see note above).
  React.useEffect(() => {
    const instance = taskboard.current?.instance;
    if (!data || !instance) return;
    const { project } = instance as unknown as TaskBoardInstanceStores;
    const stores: TaskboardStore[] = [
      project.eventStore,
      project.resourceStore,
      project.assignmentStore,
    ];
    const detachers = stores.map((store) => {
      const handler = ({ action, records }: StoreChangeEvent) =>
        syncData({ store: { id: store.id }, action, records });
      store.on("change", handler);
      return () => store.un("change", handler);
    });
    return () => detachers.forEach((detach) => detach());
  }, [data]);

  return (
    <div className="bryntum-taskboard-pcf-root" style={containerStyle}>
      {data ? (
    <BryntumTaskBoard
      ref={taskboard}
      tasks={data.tasks}
      resources={data.resources}
      assignments={data.assignments}
      {...taskboardConfig}
    />
      ) : (
        <LoadingSpinner />
      )}
    </div>
  );
};

// If you plan to use stateful React collections for data binding please check this guide
// https://bryntum.com/products/taskboard/docs/guide/TaskBoard/integration/react/data-binding

export default BryntumTaskboardComponent;
