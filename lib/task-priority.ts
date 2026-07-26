export const TASK_PRIORITY_LEVELS = [1, 2, 3] as const;

export type TaskPriorityLevel = (typeof TASK_PRIORITY_LEVELS)[number];

export const TASK_PRIORITY_OPTIONS: {
  level: TaskPriorityLevel;
  color: string;
  label: string;
}[] = [
  { level: 1, color: "#5566ee", label: "High priority" },
  { level: 2, color: "#F59E0B", label: "Medium priority" },
  { level: 3, color: "#55cc55", label: "Low priority" },
];

export function isTaskPriorityLevel(value: number): value is TaskPriorityLevel {
  return value === 1 || value === 2 || value === 3;
}

export function getTaskPriorityColor(priority: number | null | undefined) {
  if (priority == null || !isTaskPriorityLevel(priority)) return null;

  return (
    TASK_PRIORITY_OPTIONS.find((option) => option.level === priority)?.color ??
    null
  );
}

export function getTaskPriorityLabel(priority: number | null | undefined) {
  if (priority == null || !isTaskPriorityLevel(priority)) return null;

  return (
    TASK_PRIORITY_OPTIONS.find((option) => option.level === priority)?.label ??
    null
  );
}
