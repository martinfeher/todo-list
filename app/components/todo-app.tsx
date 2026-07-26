"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createTask,
  createTodoList,
  deleteTodoList,
  getLabels,
  setTaskLabel as setTaskLabelInDb,
  moveTaskToList as moveTaskToListInDb,
  renameTask as renameTaskInDb,
  renameTodoList,
  reorderTodoLists as reorderTodoListsInDb,
  reorderTasks as reorderTasksInDb,
  toggleTask as toggleTaskInDb,
  updateTaskDueDate as updateTaskDueDateInDb,
  updateTaskDueTime as updateTaskDueTimeInDb,
  updateTaskPriority as updateTaskPriorityInDb,
  updateTaskPinned as updateTaskPinnedInDb,
} from "@/app/actions/todo";
import type { TaskDueTime } from "@/lib/task-due-time";
import { taskDetailsHasContent } from "@/lib/task-details-content";
import { Sidebar } from "./sidebar";
import { CalendarPanel, CalendarMonthView } from "./calendar-panel";
import { TaskDetailsPanel } from "./task-details-panel";
import { TaskListPanel } from "./task-list-panel";
import { mergeReorderedPinnedTasks, mergeReorderedUnpinnedTasks } from "./task-reorder";
import { AppFontSwitcher } from "./app-font-switcher";
import { UndoButton } from "./undo-button";

export type TaskLabel = {
  id: string;
  label: string;
};

export type Task = {
  id: string;
  name: string;
  completed: boolean;
  details: string;
  hasDetails: boolean;
  dueDate: string | null;
  dueTimeMinutes: number | null;
  dueDurationMinutes: number | null;
  dueTimeZone: string;
  priority: number | null;
  pinned: boolean;
  parentId: string | null;
  labels: TaskLabel[];
};

export type TodoList = {
  id: string;
  name: string;
};

export type CompletedTask = Task & {
  listId: string;
  listName: string;
};

export type SearchTask = Task & {
  listId: string;
  listName: string;
};

type PendingUndo = {
  taskId: string;
  listId: string;
  taskName: string;
};

type TodoAppProps = {
  initialLists: TodoList[];
  initialLabels: TaskLabel[];
  initialTasksByList: Record<string, Task[]>;
};

function withPinnedDefaults(tasksByList: Record<string, Task[]>) {
  return Object.fromEntries(
    Object.entries(tasksByList).map(([listId, tasks]) => [
      listId,
      tasks.map((task) => ({
        ...task,
        hasDetails: task.hasDetails ?? false,
        pinned: Boolean(task.pinned),
        parentId: task.parentId ?? null,
        labels: task.labels ?? [],
      })),
    ]),
  ) as Record<string, Task[]>;
}

const UNDO_VISIBLE_MS = 7000;
const COMPLETION_DISPLAY_MS = 2000;

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(12, 0, 0, 0);
  return next;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isDueToday(dueDate: string | null) {
  if (!dueDate) return false;

  const date = new Date(dueDate);
  if (Number.isNaN(date.getTime())) return false;

  return isSameDay(startOfDay(date), startOfDay(new Date()));
}

function isDueInNext7Days(dueDate: string | null) {
  if (!dueDate) return false;

  const date = startOfDay(new Date(dueDate));
  if (Number.isNaN(date.getTime())) return false;

  const today = startOfDay(new Date());
  const end = startOfDay(new Date());
  end.setDate(end.getDate() + 7);

  return date.getTime() >= today.getTime() && date.getTime() < end.getTime();
}

function getTasksByLabel(
  labelId: string,
  lists: TodoList[],
  tasksByList: Record<string, Task[]>,
): TaskListItem[] {
  return lists.flatMap((list) =>
    (tasksByList[list.id] ?? [])
      .filter(
        (task) =>
          !task.completed && task.labels.some((item) => item.id === labelId),
      )
      .map((task) => ({
        ...task,
        listId: list.id,
        listName: list.name,
      })),
  );
}

type ActiveView = "today" | "next7days" | "calendar" | null;

function getVisibleTasks(
  activeView: ActiveView,
  listId: string | null,
  selectedLabelId: string | null,
  lists: TodoList[],
  tasksByList: Record<string, Task[]>,
): TaskListItem[] {
  if (selectedLabelId) {
    return getTasksByLabel(selectedLabelId, lists, tasksByList);
  }

  if (activeView === "today") {
    return lists.flatMap((list) =>
      (tasksByList[list.id] ?? [])
        .filter((task) => !task.completed && isDueToday(task.dueDate))
        .map((task) => ({
          ...task,
          listId: list.id,
          listName: list.name,
        })),
    );
  }

  if (activeView === "next7days") {
    return lists
      .flatMap((list) =>
        (tasksByList[list.id] ?? [])
          .filter((task) => !task.completed && isDueInNext7Days(task.dueDate))
          .map((task) => ({
            ...task,
            listId: list.id,
            listName: list.name,
          })),
      )
      .sort((a, b) => {
        const aTime = new Date(a.dueDate!).getTime();
        const bTime = new Date(b.dueDate!).getTime();
        return aTime - bTime;
      });
  }

  if (activeView === "calendar") {
    return lists
      .flatMap((list) =>
        (tasksByList[list.id] ?? [])
          .filter((task) => !task.completed && task.dueDate)
          .map((task) => ({
            ...task,
            listId: list.id,
            listName: list.name,
          })),
      )
      .sort((a, b) => {
        const aTime = new Date(a.dueDate!).getTime();
        const bTime = new Date(b.dueDate!).getTime();
        return aTime - bTime;
      });
  }

  if (!listId) return [];

  return (tasksByList[listId] ?? [])
    .filter((task) => !task.completed)
    .map((task) => ({ ...task, listId }));
}

function getFirstVisibleTaskId(
  activeView: ActiveView,
  listId: string | null,
  selectedLabelId: string | null,
  lists: TodoList[],
  tasksByList: Record<string, Task[]>,
) {
  return getVisibleTasks(
    activeView,
    listId,
    selectedLabelId,
    lists,
    tasksByList,
  )[0]?.id ?? null;
}

export type TaskListItem = Task & {
  listId?: string;
  listName?: string;
};

export function TodoApp({
  initialLists,
  initialLabels,
  initialTasksByList,
}: TodoAppProps) {
  const [lists, setLists] = useState(initialLists);
  const [labels, setLabels] = useState(initialLabels);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const [focusNoteAtEndRequest, setFocusNoteAtEndRequest] = useState(0);
  const [activeView, setActiveView] = useState<ActiveView>(null);
  const [tasksByList, setTasksByList] = useState(() =>
    withPinnedDefaults(initialTasksByList),
  );
  const [pendingUndo, setPendingUndo] = useState<PendingUndo | null>(null);
  const [completingTaskIds, setCompletingTaskIds] = useState<Set<string>>(
    () => new Set(),
  );
  const undoTimerRef = useRef<number | null>(null);
  const completionTimerRef = useRef<Record<string, number>>({});
  const [isListCalendarOpen, setIsListCalendarOpen] = useState(false);
  const listCalendarButtonRef = useRef<HTMLButtonElement>(null);
  const listCalendarPanelRef = useRef<HTMLDivElement>(null);
  const listCalendarReturnTaskIdRef = useRef<string | null>(null);
  const listCalendarCloseTimerRef = useRef<number | null>(null);

  const displayedTaskId =
    hoveredTaskId && hoveredTaskId !== selectedTaskId
      ? hoveredTaskId
      : selectedTaskId;
  const isHoverPreview =
    hoveredTaskId !== null && hoveredTaskId !== selectedTaskId;

  const selectedList = lists.find((list) => list.id === selectedListId) ?? null;
  const selectedLabel =
    labels.find((item) => item.id === selectedLabelId) ?? null;

  const calendarTasks: TaskListItem[] = getVisibleTasks(
    "calendar",
    null,
    null,
    lists,
    tasksByList,
  );

  const taskListTitle =
    selectedLabel
      ? selectedLabel.label
      : activeView === "today"
        ? "Today"
        : activeView === "next7days"
          ? "Next 7 days"
          : activeView === "calendar"
            ? "Calendar"
            : (selectedList?.name ?? null);

  const taskListItems: TaskListItem[] = getVisibleTasks(
    activeView,
    selectedListId,
    selectedLabelId,
    lists,
    tasksByList,
  );

  const completedTasks: CompletedTask[] = useMemo(
    () =>
      lists.flatMap((list) =>
        (tasksByList[list.id] ?? [])
          .filter((task) => task.completed)
          .map((task) => ({
            ...task,
            listId: list.id,
            listName: list.name,
          })),
      ),
    [lists, tasksByList],
  );

  const searchTasks: SearchTask[] = useMemo(
    () =>
      lists.flatMap((list) =>
        (tasksByList[list.id] ?? []).map((task) => ({
          ...task,
          listId: list.id,
          listName: list.name,
        })),
      ),
    [lists, tasksByList],
  );

  const taskCountByListId = useMemo(
    () =>
      Object.fromEntries(
        lists.map((list) => [
          list.id,
          (tasksByList[list.id] ?? []).filter((task) => !task.completed).length,
        ]),
      ),
    [lists, tasksByList],
  );

  const clearUndoTimer = useCallback(() => {
    if (undoTimerRef.current !== null) {
      window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
  }, []);

  const scheduleUndo = useCallback(
    (undo: PendingUndo) => {
      clearUndoTimer();
      setPendingUndo(undo);

      undoTimerRef.current = window.setTimeout(() => {
        setPendingUndo(null);
        undoTimerRef.current = null;
      }, UNDO_VISIBLE_MS);
    },
    [clearUndoTimer],
  );

  const dismissUndo = useCallback(() => {
    clearUndoTimer();
    setPendingUndo(null);
  }, [clearUndoTimer]);

  useEffect(() => {
    return () => {
      clearUndoTimer();
      for (const timer of Object.values(completionTimerRef.current)) {
        window.clearTimeout(timer);
      }
    };
  }, [clearUndoTimer]);

  const clearCompletionTimer = useCallback((taskId: string) => {
    const timer = completionTimerRef.current[taskId];
    if (timer !== undefined) {
      window.clearTimeout(timer);
      delete completionTimerRef.current[taskId];
    }
  }, []);

  const removeCompletingTask = useCallback((taskId: string) => {
    setCompletingTaskIds((current) => {
      if (!current.has(taskId)) return current;

      const next = new Set(current);
      next.delete(taskId);
      return next;
    });
  }, []);

  const finalizeTaskCompletion = useCallback(
    async (taskId: string, listId: string) => {
      clearCompletionTimer(taskId);
      removeCompletingTask(taskId);

      await toggleTaskInDb(taskId, true);

      setTasksByList((current) => ({
        ...current,
        [listId]: (current[listId] ?? []).map((item) =>
          item.id === taskId ? { ...item, completed: true } : item,
        ),
      }));
    },
    [clearCompletionTimer, removeCompletingTask],
  );

  const refreshLabels = useCallback(() => {
    void getLabels().then(setLabels);
  }, []);

  function selectList(listId: string) {
    setActiveView(null);
    setSelectedLabelId(null);
    setSelectedListId(listId);
    setSelectedTaskId(
      getFirstVisibleTaskId(null, listId, null, lists, tasksByList),
    );
  }

  function selectToday() {
    setActiveView("today");
    setSelectedLabelId(null);
    setSelectedListId(null);
    setSelectedTaskId(
      getFirstVisibleTaskId("today", null, null, lists, tasksByList),
    );
  }

  function selectNext7Days() {
    setActiveView("next7days");
    setSelectedLabelId(null);
    setSelectedListId(null);
    setSelectedTaskId(
      getFirstVisibleTaskId("next7days", null, null, lists, tasksByList),
    );
  }

  function selectCalendar() {
    setActiveView("calendar");
    setSelectedLabelId(null);
    setSelectedListId(null);
    setSelectedTaskId(null);
  }

  function selectLabel(labelId: string) {
    setActiveView(null);
    setSelectedListId(null);
    setSelectedLabelId(labelId);
    setSelectedTaskId(
      getFirstVisibleTaskId(null, null, labelId, lists, tasksByList),
    );
  }

  function selectCompletedTask(taskId: string, listId: string) {
    setActiveView(null);
    setSelectedLabelId(null);
    setSelectedListId(listId);
    setSelectedTaskId(taskId);
  }

  function selectSearchTask(taskId: string, listId: string) {
    setFocusNoteAtEndRequest((current) => current + 1);
    selectCompletedTask(taskId, listId);
  }

  async function addList(name: string) {
    if (!name.trim()) return;

    const list = await createTodoList(name.trim());
    setLists((current) => [...current, { id: list.id, name: list.name }]);
    setTasksByList((current) => ({ ...current, [list.id]: [] }));
    setActiveView(null);
    setSelectedLabelId(null);
    setSelectedListId(list.id);
    setSelectedTaskId(null);
  }

  async function renameList(listId: string, name: string) {
    const list = await renameTodoList(listId, name);
    setLists((current) =>
      current.map((item) =>
        item.id === listId ? { ...item, name: list.name } : item,
      ),
    );
  }

  async function reorderLists(listIds: string[]) {
    setLists((current) => {
      const listMap = new Map(current.map((list) => [list.id, list]));
      return listIds
        .map((id) => listMap.get(id))
        .filter((list): list is TodoList => list !== undefined);
    });

    await reorderTodoListsInDb(listIds);
  }

  async function removeList(listId: string) {
    const removedTasks = tasksByList[listId] ?? [];

    await deleteTodoList(listId);

    setLists((current) => current.filter((item) => item.id !== listId));
    setTasksByList((current) => {
      const next = { ...current };
      delete next[listId];
      return next;
    });

    if (selectedListId === listId) {
      setSelectedListId(null);
    }

    if (selectedTaskId && removedTasks.some((task) => task.id === selectedTaskId)) {
      setSelectedTaskId(null);
    }
  }

  async function addTask(name: string) {
    if (!selectedListId || !name.trim()) return;

    const task = await createTask(selectedListId, name.trim());
    const newTask: Task = {
      id: task.id,
      name: task.name,
      completed: task.completed,
      details: task.details,
      hasDetails: taskDetailsHasContent(task.details),
      dueDate: null,
      dueTimeMinutes: null,
      dueDurationMinutes: null,
      dueTimeZone: "floating",
      priority: null,
      pinned: false,
      parentId: null,
      labels: [],
    };

    setTasksByList((current) => ({
      ...current,
      [selectedListId]: [newTask, ...(current[selectedListId] ?? [])],
    }));
  }

  async function toggleTask(taskId: string) {
    let listId = selectedListId;

    if (!listId) {
      for (const [id, listTasks] of Object.entries(tasksByList)) {
        if (listTasks.some((item) => item.id === taskId)) {
          listId = id;
          break;
        }
      }
    }

    if (!listId) return;

    const task = (tasksByList[listId] ?? []).find((item) => item.id === taskId);
    if (!task) return;

    const completed = !task.completed;

    if (completed) {
      if (completingTaskIds.has(taskId)) return;

      setCompletingTaskIds((current) => new Set(current).add(taskId));
      scheduleUndo({
        taskId,
        listId,
        taskName: task.name,
      });

      if (selectedTaskId === taskId) {
        setSelectedTaskId(null);
      }

      clearCompletionTimer(taskId);
      completionTimerRef.current[taskId] = window.setTimeout(() => {
        void finalizeTaskCompletion(taskId, listId);
      }, COMPLETION_DISPLAY_MS);
      return;
    }

    dismissUndo();
    clearCompletionTimer(taskId);
    removeCompletingTask(taskId);

    await toggleTaskInDb(taskId, false);

    setTasksByList((current) => ({
      ...current,
      [listId]: (current[listId] ?? []).map((item) =>
        item.id === taskId ? { ...item, completed: false } : item,
      ),
    }));
  }

  async function handleUndo() {
    if (!pendingUndo) return;

    const { taskId, listId } = pendingUndo;
    const task = (tasksByList[listId] ?? []).find((item) => item.id === taskId);

    clearCompletionTimer(taskId);
    removeCompletingTask(taskId);

    if (task?.completed) {
      await toggleTaskInDb(taskId, false);

      setTasksByList((current) => ({
        ...current,
        [listId]: (current[listId] ?? []).map((item) =>
          item.id === taskId ? { ...item, completed: false } : item,
        ),
      }));
    }

    dismissUndo();
  }

  const handleDetailsSaved = useCallback((taskId: string, details: string) => {
    const hasDetails = taskDetailsHasContent(details);
    setTasksByList((current) => {
      const next = { ...current };

      for (const listId of Object.keys(next)) {
        next[listId] = next[listId].map((task) =>
          task.id === taskId ? { ...task, details, hasDetails } : task,
        );
      }

      return next;
    });
  }, []);

  const handleTaskHoverStart = useCallback(
    (taskId: string) => {
      if (taskId === selectedTaskId) {
        setHoveredTaskId(null);
        return;
      }

      for (const listTasks of Object.values(tasksByList)) {
        const task = listTasks.find((item) => item.id === taskId);
        if (!task) continue;

        if (task.hasDetails) {
          setHoveredTaskId(taskId);
        } else {
          setHoveredTaskId(null);
        }
        return;
      }
    },
    [selectedTaskId, tasksByList],
  );

  const handleTaskHasDetailsKnown = useCallback(
    (taskId: string, hasDetails: boolean) => {
      setTasksByList((current) => {
        const next = { ...current };

        for (const listId of Object.keys(next)) {
          next[listId] = next[listId].map((task) =>
            task.id === taskId ? { ...task, hasDetails } : task,
          );
        }

        return next;
      });
    },
    [],
  );

  const handleTaskRenamed = useCallback((taskId: string, name: string) => {
    setTasksByList((current) => {
      const next = { ...current };

      for (const listId of Object.keys(next)) {
        next[listId] = next[listId].map((task) =>
          task.id === taskId ? { ...task, name } : task,
        );
      }

      return next;
    });
  }, []);

  const handleDueDateUpdated = useCallback(
    (
      taskId: string,
      dueDate: string | null,
      dueTime?: {
        dueTimeMinutes: number | null;
        dueDurationMinutes: number | null;
        dueTimeZone: string;
      },
    ) => {
      setTasksByList((current) => {
        const next = { ...current };

        for (const listId of Object.keys(next)) {
          next[listId] = next[listId].map((task) =>
            task.id === taskId
              ? {
                  ...task,
                  dueDate,
                  ...(dueTime ?? {}),
                }
              : task,
          );
        }

        return next;
      });
    },
    [],
  );

  const handlePriorityUpdated = useCallback(
    (taskId: string, priority: number | null) => {
      setTasksByList((current) => {
        const next = { ...current };

        for (const listId of Object.keys(next)) {
          next[listId] = next[listId].map((task) =>
            task.id === taskId ? { ...task, priority } : task,
          );
        }

        return next;
      });
    },
    [],
  );

  const handlePinnedUpdated = useCallback((taskId: string, pinned: boolean) => {
    setTasksByList((current) => {
      const next = { ...current };

      for (const listId of Object.keys(next)) {
        next[listId] = next[listId].map((task) =>
          task.id === taskId ? { ...task, pinned } : task,
        );
      }

      return next;
    });
  }, []);

  const handleTaskLabelsUpdated = useCallback(
    (taskId: string, nextLabels: TaskLabel[]) => {
      setTasksByList((current) => {
        const next = { ...current };

        for (const listId of Object.keys(next)) {
          next[listId] = next[listId].map((task) =>
            task.id === taskId ? { ...task, labels: nextLabels } : task,
          );
        }

        return next;
      });
    },
    [],
  );

  async function renameTask(taskId: string, name: string) {
    const updatedTask = await renameTaskInDb(taskId, name);
    handleTaskRenamed(taskId, updatedTask.name);
  }

  const handleDueTimeUpdated = useCallback(
    (taskId: string, dueTime: TaskDueTime) => {
      setTasksByList((current) => {
        const next = { ...current };

        for (const listId of Object.keys(next)) {
          next[listId] = next[listId].map((task) =>
            task.id === taskId
              ? {
                  ...task,
                  dueTimeMinutes: dueTime.dueTimeMinutes,
                  dueDurationMinutes: dueTime.dueDurationMinutes,
                  dueTimeZone: dueTime.dueTimeZone,
                }
              : task,
          );
        }

        return next;
      });
    },
    [],
  );

  async function setTaskDueTime(taskId: string, dueTime: TaskDueTime) {
    const updated = await updateTaskDueTimeInDb(taskId, dueTime);
    handleDueTimeUpdated(taskId, {
      dueTimeMinutes: updated.dueTimeMinutes,
      dueDurationMinutes: updated.dueDurationMinutes,
      dueTimeZone: updated.dueTimeZone,
    });
  }

  async function setTaskDueDate(taskId: string, dateValue: string | null) {
    const updated = await updateTaskDueDateInDb(taskId, dateValue);
    const dueDate = updated.dueDate
      ? new Date(updated.dueDate).toISOString()
      : null;

    handleDueDateUpdated(taskId, dueDate, {
      dueTimeMinutes: updated.dueTimeMinutes,
      dueDurationMinutes: updated.dueDurationMinutes,
      dueTimeZone: updated.dueTimeZone,
    });
  }

  async function setTaskPriority(taskId: string, priority: number | null) {
    const updated = await updateTaskPriorityInDb(taskId, priority);
    handlePriorityUpdated(taskId, updated.priority);
  }

  async function setTaskPinned(taskId: string, pinned: boolean) {
    handlePinnedUpdated(taskId, pinned);

    try {
      await updateTaskPinnedInDb(taskId, pinned);
    } catch {
      handlePinnedUpdated(taskId, !pinned);
    }
  }

  async function toggleTaskLabel(
    taskId: string,
    labelId: string,
    assigned: boolean,
  ) {
    const updatedLabels = await setTaskLabelInDb(taskId, labelId, assigned);
    handleTaskLabelsUpdated(taskId, updatedLabels);
    refreshLabels();
    return updatedLabels;
  }

  async function moveTaskToList(
    taskId: string,
    sourceListId: string,
    targetListId: string,
  ) {
    if (sourceListId === targetListId) return;

    const sourceTasks = tasksByList[sourceListId] ?? [];
    const task = sourceTasks.find((item) => item.id === taskId);
    if (!task) return;

    await moveTaskToListInDb(taskId, targetListId);

    setTasksByList((current) => {
      const sourceList = current[sourceListId] ?? [];
      const childIds = sourceList
        .filter((item) => item.parentId === taskId)
        .map((item) => item.id);
      const movingIds = new Set([taskId, ...childIds]);
      const nextSource = sourceList.filter((item) => !movingIds.has(item.id));
      const movedTasks = sourceList
        .filter((item) => movingIds.has(item.id))
        .map((item) => ({
          ...item,
          ...(item.id === taskId && item.parentId ? { parentId: null } : {}),
        }));
      const nextTarget = [...movedTasks, ...(current[targetListId] ?? [])];

      return {
        ...current,
        [sourceListId]: nextSource,
        [targetListId]: nextTarget,
      };
    });
  }

  async function reorderTasks(
    listId: string,
    activeTaskIds: string[],
    section: "pinned" | "unpinned",
    parentUpdates: Array<{ taskId: string; parentId: string | null }> = [],
  ) {
    let mergedTaskIds: string[] | null = null;

    setTasksByList((current) => {
      const currentTasks = current[listId] ?? [];
      const expectedActiveCount =
        section === "pinned"
          ? currentTasks.filter((task) => !task.completed && task.pinned).length
          : currentTasks.filter((task) => !task.completed && !task.pinned)
              .length;

      if (activeTaskIds.length !== expectedActiveCount) {
        return current;
      }

      let mergedTasks =
        section === "pinned"
          ? mergeReorderedPinnedTasks(currentTasks, activeTaskIds)
          : mergeReorderedUnpinnedTasks(currentTasks, activeTaskIds);

      if (parentUpdates.length > 0) {
        const parentByTaskId = new Map(
          parentUpdates.map((update) => [update.taskId, update.parentId]),
        );
        mergedTasks = mergedTasks.map((task) =>
          parentByTaskId.has(task.id)
            ? { ...task, parentId: parentByTaskId.get(task.id)! }
            : task,
        );
      }

      mergedTaskIds = mergedTasks.map((task) => task.id);

      return {
        ...current,
        [listId]: mergedTasks,
      };
    });

    if (!mergedTaskIds) return;

    await reorderTasksInDb(listId, mergedTaskIds, parentUpdates);
  }

  const cancelListCalendarClose = useCallback(() => {
    if (listCalendarCloseTimerRef.current !== null) {
      window.clearTimeout(listCalendarCloseTimerRef.current);
      listCalendarCloseTimerRef.current = null;
    }
  }, []);

  const closeListCalendar = useCallback(() => {
    cancelListCalendarClose();
    setIsListCalendarOpen(false);

    const returnTaskId = listCalendarReturnTaskIdRef.current;
    listCalendarReturnTaskIdRef.current = null;

    if (returnTaskId) {
      setSelectedTaskId(returnTaskId);
    }
  }, [cancelListCalendarClose]);

  const scheduleListCalendarClose = useCallback(() => {
    cancelListCalendarClose();
    listCalendarCloseTimerRef.current = window.setTimeout(() => {
      closeListCalendar();
    }, 120);
  }, [cancelListCalendarClose, closeListCalendar]);

  const openListCalendar = useCallback(() => {
    if (!selectedListId) return;

    cancelListCalendarClose();
    listCalendarReturnTaskIdRef.current = selectedTaskId;
    setIsListCalendarOpen(true);
  }, [cancelListCalendarClose, selectedListId, selectedTaskId]);

  const handleListCalendarButtonMouseLeave = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const panel = listCalendarPanelRef.current;
      const relatedTarget = event.relatedTarget as Node | null;

      if (relatedTarget && panel?.contains(relatedTarget)) {
        return;
      }

      scheduleListCalendarClose();
    },
    [scheduleListCalendarClose],
  );

  const handleListCalendarPanelMouseLeave = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const button = listCalendarButtonRef.current;
      const relatedTarget = event.relatedTarget as Node | null;

      if (relatedTarget && button?.contains(relatedTarget)) {
        return;
      }

      scheduleListCalendarClose();
    },
    [scheduleListCalendarClose],
  );

  useEffect(() => {
    setIsListCalendarOpen(false);
    listCalendarReturnTaskIdRef.current = null;
    cancelListCalendarClose();
    setHoveredTaskId(null);
  }, [selectedListId, cancelListCalendarClose]);

  useEffect(() => {
    setHoveredTaskId(null);
  }, [selectedLabelId, activeView]);

  useEffect(() => {
    return () => {
      cancelListCalendarClose();
    };
  }, [cancelListCalendarClose]);

  const showRightPanel = displayedTaskId !== null || isListCalendarOpen;
  const showTaskDetails = displayedTaskId !== null && !isListCalendarOpen;

  const selectedTaskSnapshot = useMemo(() => {
    if (!selectedTaskId) return null;

    for (const listTasks of Object.values(tasksByList)) {
      const task = listTasks.find((item) => item.id === selectedTaskId);
      if (!task) continue;

      return {
        name: task.name,
        dueDate: task.dueDate,
        dueTimeMinutes: task.dueTimeMinutes,
        dueDurationMinutes: task.dueDurationMinutes,
        dueTimeZone: task.dueTimeZone,
      };
    }

    return null;
  }, [selectedTaskId, tasksByList]);

  return (
    <>
      <div className="flex h-dvh min-h-0 flex-1 overflow-hidden">
        <Sidebar
          lists={lists}
          labels={labels}
          taskCountByListId={taskCountByListId}
          completedTasks={completedTasks}
          searchTasks={searchTasks}
          selectedListId={selectedListId}
          selectedLabelId={selectedLabelId}
          isTodaySelected={activeView === "today"}
          isNext7DaysSelected={activeView === "next7days"}
          isCalendarSelected={activeView === "calendar"}
          selectedTaskId={selectedTaskId}
          onSelectList={selectList}
          onSelectLabel={selectLabel}
          onSelectToday={selectToday}
          onSelectNext7Days={selectNext7Days}
          onSelectCalendar={selectCalendar}
          onSelectCompletedTask={selectCompletedTask}
          onSelectSearchTask={selectSearchTask}
          onToggleTask={toggleTask}
          onAddList={addList}
          onRenameList={renameList}
          onRemoveList={removeList}
          onReorderLists={reorderLists}
        />
        {activeView === "calendar" ? (
          <CalendarPanel
            tasks={calendarTasks}
            lists={lists}
            completingTaskIds={completingTaskIds}
            selectedTaskId={selectedTaskId}
            onToggleTask={toggleTask}
            onSelectTask={setSelectedTaskId}
            onRenameTask={renameTask}
            onSetTaskDueDate={setTaskDueDate}
            onSetTaskDueTime={setTaskDueTime}
            onSetTaskPriority={setTaskPriority}
            onToggleTaskLabel={toggleTaskLabel}
            onLabelsChanged={refreshLabels}
            onMoveTaskToList={moveTaskToList}
          />
        ) : (
          <>
            <TaskListPanel
              title={taskListTitle}
              tasks={taskListItems}
              lists={lists}
              completingTaskIds={completingTaskIds}
              selectedTaskId={selectedTaskId}
              expanded={!showRightPanel}
              showAddTask={selectedListId !== null}
              isLabelFilter={selectedLabelId !== null}
              listId={selectedListId}
              onAddTask={addTask}
              onToggleTask={toggleTask}
              onSelectTask={setSelectedTaskId}
              onRenameTask={renameTask}
              onTaskNameChange={handleTaskRenamed}
              onReorderTasks={reorderTasks}
              onSetTaskDueDate={setTaskDueDate}
              onSetTaskDueTime={setTaskDueTime}
              onSetTaskPriority={setTaskPriority}
              onSetTaskPinned={setTaskPinned}
              onToggleTaskLabel={toggleTaskLabel}
              onLabelsChanged={refreshLabels}
              onMoveTaskToList={moveTaskToList}
              onTaskHoverStart={handleTaskHoverStart}
              onTaskHoverEnd={() => setHoveredTaskId(null)}
              showListCalendarButton={selectedListId !== null}
              listCalendarButtonRef={listCalendarButtonRef}
              onListCalendarHoverStart={openListCalendar}
              onListCalendarHoverLeave={handleListCalendarButtonMouseLeave}
            />
            {isListCalendarOpen && (
              <div
                ref={listCalendarPanelRef}
                onMouseEnter={cancelListCalendarClose}
                onMouseLeave={handleListCalendarPanelMouseLeave}
                className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-l border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
              >
                <CalendarMonthView
                  tasks={taskListItems}
                  selectedTaskId={selectedTaskId}
                  onSelectTask={setSelectedTaskId}
                  onToggleTask={toggleTask}
                  onSetTaskDueDate={setTaskDueDate}
                  onSetTaskDueTime={setTaskDueTime}
                />
              </div>
            )}
            {showTaskDetails && (
              <TaskDetailsPanel
                taskId={displayedTaskId}
                isHoverPreview={isHoverPreview}
                taskSnapshot={isHoverPreview ? null : selectedTaskSnapshot}
                focusNoteAtEndRequest={focusNoteAtEndRequest}
                onDetailsSaved={handleDetailsSaved}
                onTaskHasDetailsKnown={handleTaskHasDetailsKnown}
                onTaskRenamed={handleTaskRenamed}
                onDueDateUpdated={handleDueDateUpdated}
              />
            )}
          </>
        )}
      </div>
      <AppFontSwitcher />
      <UndoButton
        visible={pendingUndo !== null}
        taskName={pendingUndo?.taskName ?? ""}
        onUndo={handleUndo}
      />
    </>
  );
}
