import type { BryntumTaskBoardProps } from "@bryntum/taskboard-react";

const taskboardConfig: Partial<BryntumTaskBoardProps> = {
  // Columns to display, and the task field used to pair a task to a column.
  columns: [
    { id: "todo", text: "To do" },
    { id: "doing", text: "Doing" },
    { id: "done", text: "Done" },
  ],
  columnField: "status",
};

export { taskboardConfig };
