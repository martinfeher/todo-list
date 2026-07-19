import { getDropIndex } from "./detail-lines";

export function getTaskRowElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>("[data-task-id]"),
  );
}

export function mergeReorderedActiveTasks<T extends { id: string; completed: boolean }>(
  allTasks: T[],
  reorderedActiveIds: string[],
) {
  const taskMap = new Map(allTasks.map((task) => [task.id, task]));
  const reorderedActive = reorderedActiveIds
    .map((id) => taskMap.get(id))
    .filter((task): task is T => task !== undefined);

  let activeIndex = 0;

  return allTasks.map((task) => {
    if (task.completed) return task;

    const next = reorderedActive[activeIndex];
    activeIndex += 1;
    return next ?? task;
  });
}

export function reorderTaskIds(
  taskIds: string[],
  sourceIndex: number,
  dropIndex: number,
) {
  if (sourceIndex < 0 || sourceIndex >= taskIds.length) return taskIds;

  let targetIndex = dropIndex;
  if (sourceIndex < dropIndex) {
    targetIndex -= 1;
  }

  if (targetIndex === sourceIndex) return taskIds;

  const next = [...taskIds];
  const [moved] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, moved);
  return next;
}

export function getTaskDropIndex(
  clientY: number,
  rows: HTMLElement[],
  draggingIndex: number | null = null,
) {
  return getDropIndex(clientY, rows, draggingIndex);
}
