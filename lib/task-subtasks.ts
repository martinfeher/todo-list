export type TaskWithParent = {
  id: string;
  parentId: string | null;
};

export type VisibleTask<T extends TaskWithParent> = T & {
  depth: number;
};

export const SUBTASK_NEST_THRESHOLD_PX = 26;
export const SUBTASK_INDENT_PX = 26;
export const SUBTASK_ICON_INDENT_PX = 10;
export const SUBTASK_ROOT_LEFT_PX = 8;
export const SUBTASK_UNNEST_THRESHOLD_PX = 20;

export type HierarchyDragIntent = "nest" | "root" | "keep";

export function resolveHierarchyDragIntent(
  clientX: number,
  listLeft: number,
  sourceParentId: string | null,
): HierarchyDragIntent {
  const offsetX = clientX - listLeft;

  if (offsetX >= SUBTASK_NEST_THRESHOLD_PX) {
    return "nest";
  }

  if (sourceParentId && offsetX <= SUBTASK_UNNEST_THRESHOLD_PX) {
    return "root";
  }

  if (sourceParentId) {
    return "keep";
  }

  return "root";
}

export function getDropIndicatorIndent(
  intent: HierarchyDragIntent,
  dropIndex: number,
  sourceParentId: string | null,
): number {
  if (intent === "nest" && dropIndex > 0) {
    return SUBTASK_INDENT_PX;
  }

  if (intent === "keep" && sourceParentId) {
    return SUBTASK_INDENT_PX;
  }

  return 0;
}

export function buildVisibleTasks<
  T extends TaskWithParent & { completed: boolean; pinned: boolean },
>(tasks: T[], pinned: boolean): VisibleTask<T>[] {
  const active = tasks.filter(
    (task) => !task.completed && Boolean(task.pinned) === pinned,
  );
  const activeIds = new Set(active.map((task) => task.id));
  const order = new Map(tasks.map((task, index) => [task.id, index]));

  const sortByStoredOrder = (items: T[]) =>
    [...items].sort(
      (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
    );

  const roots = sortByStoredOrder(
    active.filter(
      (task) => !task.parentId || !activeIds.has(task.parentId),
    ),
  );

  const visible: VisibleTask<T>[] = [];

  for (const root of roots) {
    visible.push({ ...root, depth: 0 });

    const children = sortByStoredOrder(
      active.filter((task) => task.parentId === root.id),
    );

    for (const child of children) {
      visible.push({ ...child, depth: 1 });
    }
  }

  return visible;
}

export function getDragBlockIds<T extends TaskWithParent>(
  visibleIds: string[],
  sourceIndex: number,
  tasksById: Map<string, T>,
): string[] {
  const sourceId = visibleIds[sourceIndex];
  if (!sourceId) return [];

  const sourceTask = tasksById.get(sourceId);
  if (!sourceTask || sourceTask.parentId) {
    return [sourceId];
  }

  const block = [sourceId];
  for (let index = sourceIndex + 1; index < visibleIds.length; index += 1) {
    const nextId = visibleIds[index];
    const nextTask = tasksById.get(nextId);
    if (nextTask?.parentId === sourceId) {
      block.push(nextId);
      continue;
    }
    break;
  }

  return block;
}

export function reorderVisibleTaskIds(
  visibleIds: string[],
  sourceIndex: number,
  dropIndex: number,
  blockIds: string[],
): string[] {
  const blockSet = new Set(blockIds);
  const withoutBlock = visibleIds.filter((id) => !blockSet.has(id));

  let targetIndex = dropIndex;
  if (sourceIndex < dropIndex) {
    targetIndex -= blockIds.length;
  }

  targetIndex = Math.max(0, Math.min(targetIndex, withoutBlock.length));

  return [
    ...withoutBlock.slice(0, targetIndex),
    ...blockIds,
    ...withoutBlock.slice(targetIndex),
  ];
}

export function resolveDropParentId<T extends TaskWithParent>(
  orderedVisibleIds: string[],
  movedTaskId: string,
  dropIndex: number,
  intent: HierarchyDragIntent,
  tasksById: Map<string, T>,
  previousParentId: string | null,
): string | null {
  if (intent === "root") {
    return null;
  }

  if (intent === "keep") {
    return previousParentId;
  }

  if (dropIndex <= 0) {
    return previousParentId ?? null;
  }

  const aboveId = orderedVisibleIds[dropIndex - 1];
  const aboveTask = aboveId ? tasksById.get(aboveId) : null;
  if (!aboveTask || aboveTask.id === movedTaskId) {
    return previousParentId ?? null;
  }

  if (aboveTask.parentId === movedTaskId) {
    return previousParentId ?? null;
  }

  if (aboveTask.parentId) {
    return aboveTask.parentId;
  }

  return aboveTask.id;
}

export function clampSubtaskKeepDropIndex<T extends TaskWithParent>(
  visibleIds: string[],
  sourceIndex: number,
  dropIndex: number,
  parentId: string,
  tasksById: Map<string, T>,
): number {
  const parentIndex = visibleIds.indexOf(parentId);
  if (parentIndex < 0) return dropIndex;

  const siblingIndices = visibleIds.flatMap((id, index) => {
    if (tasksById.get(id)?.parentId !== parentId) return [];
    return [index];
  });

  if (siblingIndices.length === 0) {
    return Math.max(parentIndex + 1, Math.min(dropIndex, parentIndex + 1));
  }

  const minDrop = parentIndex + 1;
  const maxDrop = Math.max(...siblingIndices) + 1;

  let clamped = Math.max(minDrop, Math.min(dropIndex, maxDrop));

  if (sourceIndex < clamped) {
    clamped = Math.min(clamped, maxDrop);
  }

  return clamped;
}

export function isNestIntent(clientX: number, listLeft: number) {
  return resolveHierarchyDragIntent(clientX, listLeft, null) === "nest";
}

export function collectParentUpdates<T extends TaskWithParent>(
  previousTasks: T[],
  orderedVisibleIds: string[],
  movedTaskIds: string[],
  hierarchyIntentByTaskId: Map<string, HierarchyDragIntent>,
  tasksById: Map<string, T>,
): Array<{ taskId: string; parentId: string | null }> {
  const updates: Array<{ taskId: string; parentId: string | null }> = [];
  const previousById = new Map(previousTasks.map((task) => [task.id, task]));

  for (const movedTaskId of movedTaskIds) {
    const movedTask = tasksById.get(movedTaskId);
    if (!movedTask) continue;

    const dropIndex = orderedVisibleIds.indexOf(movedTaskId);
    const previousParentId = previousById.get(movedTaskId)?.parentId ?? null;
    const intent = hierarchyIntentByTaskId.get(movedTaskId) ?? "root";
    const parentId = resolveDropParentId(
      orderedVisibleIds,
      movedTaskId,
      dropIndex,
      intent,
      tasksById,
      previousParentId,
    );

    if (parentId !== previousParentId) {
      updates.push({ taskId: movedTaskId, parentId });
    }
  }

  return updates;
}
