import { databasePrefix } from "./constants";
import { IInputs } from "./generated/ManifestTypes";

export interface IBryntumTaskboardComponentProps {
  context?: ComponentFramework.Context<IInputs>;
}

type RecordItem = {
  data: TaskboardTask | TaskboardResource | TaskboardAssignment;
  meta: {
    modified:
      | Partial<TaskboardTask>
      | Partial<TaskboardResource>
      | Partial<TaskboardAssignment>;
  };
} & TaskboardTask &
  TaskboardResource &
  TaskboardAssignment;

export type SyncData = {
  action: "dataset" | "add" | "remove" | "update";
  records: RecordItem[];
  store: {
    // TaskBoard's onDataChange reports the task store's id as "tasks"
    // (resources -> "resources", assignments -> "assignments").
    id: "tasks" | "resources" | "assignments";
  };
};

export type TaskboardTask = {
  id: string;
  name: string;
  status: string;
  prio: string;
  description: string;
};

export type TaskboardResource = {
  id: string;
  name: string;
};

export type TaskboardAssignment = {
  id: string;
  event: string;
  resource: string;
};

const KEY_ID = `${databasePrefix}id` as const;
const KEY_NAME = `${databasePrefix}name` as const;
const KEY_STATUS = `${databasePrefix}status` as const;
const KEY_PRIO = `${databasePrefix}prio` as const;
const KEY_DESCRIPTION = `${databasePrefix}description` as const;

export type TaskboardTaskDataverse = {
  [KEY_ID]: string;
  [KEY_NAME]: string;
  [KEY_STATUS]: string;
  [KEY_PRIO]: string;
  [KEY_DESCRIPTION]: string;
};

export type TaskboardResourceDataverse = {
  [KEY_ID]: string;
  [KEY_NAME]: string;
};

const KEY_TASK_ID = `${databasePrefix}taskid@odata.bind` as const;
const KEY_RESOURCE_ID = `${databasePrefix}resourceid@odata.bind` as const;

export type TaskboardAssignmentDataverse = {
  [KEY_ID]: string;
  [KEY_TASK_ID]: string;
  [KEY_RESOURCE_ID]: string;
};
