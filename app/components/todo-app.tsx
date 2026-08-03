"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
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
  updateTaskImportant as updateTaskImportantInDb,
  updateTaskDetails as updateTaskDetailsInDb,
} from "@/app/actions/todo";
import type { TaskParentUpdate } from "@/app/actions/todo";
import type { TaskDueTime } from "@/lib/task-due-time";
import { taskDetailsHasContent } from "@/lib/task-details-content";
import { Sidebar } from "./sidebar";
import { CalendarPanel, CalendarMonthView } from "./calendar-panel";
import { plainTextToTaskDetails } from "./calendar-add-task-popover";
import { TaskDetailsPanel } from "./task-details-panel";
import { PanelResizeHandle } from "./panel-resize-handle";
import { TaskListPanel } from "./task-list-panel";
import {
  CHECKED_ROW_DIM_MS,
  CHECKMARK_HIDE_FADE_MS,
  CHECKMARK_HIDE_MS,
  clearCheckboxCheckStart,
} from "./task-completion-checkbox";
import { mergeReorderedPinnedTasks, mergeReorderedUnpinnedTasks } from "./task-reorder";
import { AppFontSwitcher } from "./app-font-switcher";
import { UndoButton } from "./undo-button";

const MIN_PANEL_WIDTH = 300;
const DEFAULT_TASK_LIST_WIDTH = 350;
const RESIZE_HANDLE_WIDTH = 4;

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
  important: boolean;
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

type ListTasksSnapshot = {
  listId: string;
  tasks: Task[];
};

function cloneListTasks(tasks: Task[]): Task[] {
  return tasks.map((task) => ({
    ...task,
    labels: [...task.labels],
  }));
}

function collectParentUpdates(
  currentTasks: Task[],
  targetTasks: Task[],
): TaskParentUpdate[] {
  const targetById = new Map(
    targetTasks.map((task) => [task.id, task.parentId ?? null]),
  );
  const updates: TaskParentUpdate[] = [];
  const seen = new Set<string>();

  for (const task of currentTasks) {
    const targetParentId = targetById.get(task.id);
    if (targetParentId === undefined) continue;

    const currentParentId = task.parentId ?? null;
    if (currentParentId !== targetParentId && !seen.has(task.id)) {
      updates.push({ taskId: task.id, parentId: targetParentId });
      seen.add(task.id);
    }
  }

  return updates;
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;

  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable
  );
}

type TodoAppProps = {
  initialLists: TodoList[];
  initialLabels: TaskLabel[];
  initialTasksByList: Record<string, Task[]>;
  initialActiveView?: ActiveView;
};

function withPinnedDefaults(tasksByList: Record<string, Task[]>) {
  return Object.fromEntries(
    Object.entries(tasksByList).map(([listId, tasks]) => [
      listId,
      tasks.map((task) => ({
        ...task,
        hasDetails: task.hasDetails ?? false,
        pinned: Boolean(task.pinned),
        important: Boolean(task.important),
        parentId: task.parentId ?? null,
        labels: task.labels ?? [],
      })),
    ]),
  ) as Record<string, Task[]>;
}

const UNDO_VISIBLE_MS = 7000;
const CHECKBOX_COMPLETE_ANIMATION_MS = 280;
/** Remove the row after checkmark hide and row dim both finish. */
const COMPLETION_REMOVE_MS = Math.max(
  CHECKMARK_HIDE_MS + CHECKMARK_HIDE_FADE_MS,
  CHECKED_ROW_DIM_MS,
);
const COMPLETION_DISPLAY_MS = Math.max(
  0,
  COMPLETION_REMOVE_MS - CHECKBOX_COMPLETE_ANIMATION_MS,
);

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

function getTodayDateValue() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function isDueToday(dueDate: string | null) {
  if (!dueDate) return false;

  const date = new Date(dueDate);
  if (Number.isNaN(date.getTime())) return false;

  return isSameDay(startOfDay(date), startOfDay(new Date()));
}

/*
function isDueInNext7Days(dueDate: string | null) {
  if (!dueDate) return false;

  const date = startOfDay(new Date(dueDate));
  if (Number.isNaN(date.getTime())) return false;

  const today = startOfDay(new Date());
  const end = startOfDay(new Date());
  end.setDate(end.getDate() + 7);

  return date.getTime() >= today.getTime() && date.getTime() < end.getTime();
}
*/

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

type ActiveView =
  | "today"
  // | "next7days"
  | "important"
  | "calendar"
  | null;

export type TodoActiveView = ActiveView;

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

  /*
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
  */

  if (activeView === "important") {
    return lists.flatMap((list) =>
      (tasksByList[list.id] ?? [])
        .filter((task) => !task.completed && task.important)
        .map((task) => ({
          ...task,
          listId: list.id,
          listName: list.name,
        })),
    );
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

export type SidebarHoverPreview =
  | { kind: "list"; listId: string }
  | { kind: "today" }
  | { kind: "important" }
  | { kind: "calendar" }
  | { kind: "label"; labelId: string };

export function TodoApp({
  initialLists,
  initialLabels,
  initialTasksByList,
  initialActiveView = null,
}: TodoAppProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [lists, setLists] = useState(initialLists);
  const [labels, setLabels] = useState(initialLabels);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const [suppressListSelectionHighlightId, setSuppressListSelectionHighlightId] =
    useState<string | null>(null);
  const listSelectionHighlightTimerRef = useRef<number | null>(null);
  const [sidebarHoverPreview, setSidebarHoverPreview] =
    useState<SidebarHoverPreview | null>(null);
  const sidebarHoverPreviewRef = useRef<SidebarHoverPreview | null>(null);
  const clearSidebarHoverTimerRef = useRef<number | null>(null);
  const [focusNoteAtEndRequest, setFocusNoteAtEndRequest] = useState(0);
  const [activeView, setActiveView] = useState<ActiveView>(initialActiveView);
  const [tasksByList, setTasksByList] = useState(() =>
    withPinnedDefaults(initialTasksByList),
  );
  const [pendingUndo, setPendingUndo] = useState<PendingUndo | null>(null);
  const [completingTaskIds, setCompletingTaskIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [checkAnimatingTaskIds, setCheckAnimatingTaskIds] = useState<Set<string>>(
    () => new Set(),
  );
  const undoTimerRef = useRef<number | null>(null);
  const reorderUndoStackRef = useRef<ListTasksSnapshot[]>([]);
  const reorderRedoStackRef = useRef<ListTasksSnapshot[]>([]);
  const tasksByListRef = useRef(tasksByList);
  const isApplyingReorderHistoryRef = useRef(false);
  tasksByListRef.current = tasksByList;
  sidebarHoverPreviewRef.current = sidebarHoverPreview;
  const completionTimerRef = useRef<Record<string, number>>({});
  const [isListCalendarOpen, setIsListCalendarOpen] = useState(false);
  const listCalendarButtonRef = useRef<HTMLButtonElement>(null);
  const listCalendarPanelRef = useRef<HTMLDivElement>(null);
  const listCalendarReturnTaskIdRef = useRef<string | null>(null);
  const listCalendarCloseTimerRef = useRef<number | null>(null);
  const [taskListWidth, setTaskListWidth] = useState(DEFAULT_TASK_LIST_WIDTH);
  const [hasResizedTaskList, setHasResizedTaskList] = useState(false);
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const taskListWidthRef = useRef(taskListWidth);
  taskListWidthRef.current = taskListWidth;

  const clampTaskListWidth = useCallback((width: number) => {
    const container = splitContainerRef.current;
    if (!container) {
      return Math.max(MIN_PANEL_WIDTH, width);
    }

    const containerWidth = container.getBoundingClientRect().width;
    const maxWidth = containerWidth - MIN_PANEL_WIDTH - RESIZE_HANDLE_WIDTH;
    return Math.min(maxWidth, Math.max(MIN_PANEL_WIDTH, width));
  }, []);

  const handleTaskListResizeStart = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = taskListWidthRef.current;
      const pointerId = event.pointerId;
      const handle = event.currentTarget;
      handle.setPointerCapture(pointerId);
      setHasResizedTaskList(true);

      const onPointerMove = (moveEvent: PointerEvent) => {
        if (moveEvent.pointerId !== pointerId) return;
        setTaskListWidth(
          clampTaskListWidth(startWidth + (moveEvent.clientX - startX)),
        );
      };

      const onPointerUp = (upEvent: PointerEvent) => {
        if (upEvent.pointerId !== pointerId) return;
        handle.releasePointerCapture(pointerId);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    },
    [clampTaskListWidth],
  );

  useEffect(() => {
    const container = splitContainerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      setTaskListWidth((currentWidth) => clampTaskListWidth(currentWidth));
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [clampTaskListWidth]);

  const displayedTaskId = (() => {
    if (hoveredTaskId && hoveredTaskId !== selectedTaskId) {
      return hoveredTaskId;
    }

    if (
      sidebarHoverPreview?.kind === "today" ||
      sidebarHoverPreview?.kind === "important"
    ) {
      const previewTasks = getVisibleTasks(
        sidebarHoverPreview.kind,
        null,
        null,
        lists,
        tasksByList,
      );
      if (
        selectedTaskId == null ||
        !previewTasks.some((task) => task.id === selectedTaskId)
      ) {
        return previewTasks[0]?.id ?? null;
      }
    }

    return selectedTaskId;
  })();
  const isHoverPreview =
    (hoveredTaskId !== null && hoveredTaskId !== selectedTaskId) ||
    ((sidebarHoverPreview?.kind === "today" ||
      sidebarHoverPreview?.kind === "important") &&
      displayedTaskId !== null &&
      displayedTaskId !== selectedTaskId);

  const previewListId =
    sidebarHoverPreview?.kind === "list" ? sidebarHoverPreview.listId : null;
  const previewList =
    previewListId !== null
      ? (lists.find((list) => list.id === previewListId) ?? null)
      : null;
  const previewLabelId =
    sidebarHoverPreview?.kind === "label"
      ? sidebarHoverPreview.labelId
      : null;
  const previewLabel =
    previewLabelId !== null
      ? (labels.find((item) => item.id === previewLabelId) ?? null)
      : null;

  const displayedListId =
    sidebarHoverPreview == null
      ? selectedListId
      : sidebarHoverPreview.kind === "list"
        ? sidebarHoverPreview.listId
        : null;
  const displayedActiveView: ActiveView =
    sidebarHoverPreview == null
      ? activeView
      : sidebarHoverPreview.kind === "today"
        ? "today"
        : sidebarHoverPreview.kind === "important"
          ? "important"
          : sidebarHoverPreview.kind === "calendar"
            ? "calendar"
            : null;
  const displayedLabelId =
    sidebarHoverPreview == null
      ? selectedLabelId
      : sidebarHoverPreview.kind === "label"
        ? sidebarHoverPreview.labelId
        : null;

  const isSidebarHoverPreview = Boolean(
    sidebarHoverPreview &&
      (sidebarHoverPreview.kind === "list"
        ? sidebarHoverPreview.listId !== selectedListId ||
          activeView !== null ||
          selectedLabelId !== null
        : sidebarHoverPreview.kind === "today"
          ? activeView !== "today"
          : sidebarHoverPreview.kind === "important"
            ? activeView !== "important"
            : sidebarHoverPreview.kind === "calendar"
              ? activeView !== "calendar"
              : sidebarHoverPreview.labelId !== selectedLabelId ||
                activeView !== null ||
                selectedListId !== null),
  );

  const showingCalendarMonth = displayedActiveView === "calendar";

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
    previewList
      ? previewList.name
      : previewLabel
        ? previewLabel.label
        : sidebarHoverPreview?.kind === "today"
          ? "Today"
          : sidebarHoverPreview?.kind === "important"
            ? "Important"
            : sidebarHoverPreview?.kind === "calendar"
              ? "Calendar"
              : selectedLabel
                ? selectedLabel.label
                : activeView === "today"
                  ? "Today"
                  : activeView === "important"
                    ? "Important"
                    : activeView === "calendar"
                      ? "Calendar"
                      : (selectedList?.name ?? null);

  const taskListItems: TaskListItem[] = getVisibleTasks(
    displayedActiveView,
    displayedListId,
    displayedLabelId,
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

  const taskCountByLabelId = useMemo(() => {
    const counts: Record<string, number> = {};

    for (const list of lists) {
      for (const task of tasksByList[list.id] ?? []) {
        if (task.completed) continue;

        for (const label of task.labels) {
          counts[label.id] = (counts[label.id] ?? 0) + 1;
        }
      }
    }

    return counts;
  }, [lists, tasksByList]);

  const visibleLabels = useMemo(() => {
    const labelIdsWithTasks = new Set<string>();

    for (const list of lists) {
      for (const task of tasksByList[list.id] ?? []) {
        if (task.completed) continue;

        for (const label of task.labels) {
          labelIdsWithTasks.add(label.id);
        }
      }
    }

    return labels.filter((label) => labelIdsWithTasks.has(label.id));
  }, [labels, lists, tasksByList]);

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

  const applyListSnapshot = useCallback(async (snapshot: ListTasksSnapshot) => {
    const { listId, tasks } = snapshot;
    const currentTasks = tasksByListRef.current[listId] ?? [];
    const parentUpdates = collectParentUpdates(currentTasks, tasks);
    const taskIds = tasks.map((task) => task.id);

    setTasksByList((current) => ({
      ...current,
      [listId]: cloneListTasks(tasks),
    }));

    await reorderTasksInDb(listId, taskIds, parentUpdates);
  }, []);

  const handleReorderUndo = useCallback(async () => {
    if (isApplyingReorderHistoryRef.current) return;

    const undoStack = reorderUndoStackRef.current;
    if (undoStack.length === 0) return;

    isApplyingReorderHistoryRef.current = true;

    try {
      const snapshot = undoStack[undoStack.length - 1];
      reorderUndoStackRef.current = undoStack.slice(0, -1);

      const currentTasks = tasksByListRef.current[snapshot.listId] ?? [];
      reorderRedoStackRef.current = [
        ...reorderRedoStackRef.current,
        {
          listId: snapshot.listId,
          tasks: cloneListTasks(currentTasks),
        },
      ];

      await applyListSnapshot(snapshot);
    } finally {
      isApplyingReorderHistoryRef.current = false;
    }
  }, [applyListSnapshot]);

  const handleReorderRedo = useCallback(async () => {
    if (isApplyingReorderHistoryRef.current) return;

    const redoStack = reorderRedoStackRef.current;
    if (redoStack.length === 0) return;

    isApplyingReorderHistoryRef.current = true;

    try {
      const snapshot = redoStack[redoStack.length - 1];
      reorderRedoStackRef.current = redoStack.slice(0, -1);

      const currentTasks = tasksByListRef.current[snapshot.listId] ?? [];
      reorderUndoStackRef.current = [
        ...reorderUndoStackRef.current,
        {
          listId: snapshot.listId,
          tasks: cloneListTasks(currentTasks),
        },
      ];

      await applyListSnapshot(snapshot);
    } finally {
      isApplyingReorderHistoryRef.current = false;
    }
  }, [applyListSnapshot]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) return;

      const isMod = event.metaKey || event.ctrlKey;
      if (!isMod) return;

      const key = event.key.toLowerCase();

      if (key === "z" && event.shiftKey) {
        if (reorderRedoStackRef.current.length === 0) return;
        event.preventDefault();
        void handleReorderRedo();
        return;
      }

      if (key === "z") {
        if (reorderUndoStackRef.current.length === 0) return;
        event.preventDefault();
        void handleReorderUndo();
        return;
      }

      if (key === "y" && event.ctrlKey && !event.metaKey) {
        if (reorderRedoStackRef.current.length === 0) return;
        event.preventDefault();
        void handleReorderRedo();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleReorderRedo, handleReorderUndo]);

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
    clearCheckboxCheckStart(taskId);
    setCompletingTaskIds((current) => {
      if (!current.has(taskId)) return current;

      const next = new Set(current);
      next.delete(taskId);
      return next;
    });
    setCheckAnimatingTaskIds((current) => {
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

  const leaveCalendarRoute = useCallback(() => {
    if (pathname === "/calendar") {
      router.push("/");
    }
  }, [pathname, router]);

  useEffect(() => {
    if (pathname === "/calendar") {
      setActiveView("calendar");
      setSelectedLabelId(null);
      setSelectedListId(null);
      return;
    }

    setActiveView((current) => (current === "calendar" ? null : current));
  }, [pathname]);

  function clearListSelectionHighlightDelay() {
    if (listSelectionHighlightTimerRef.current !== null) {
      window.clearTimeout(listSelectionHighlightTimerRef.current);
      listSelectionHighlightTimerRef.current = null;
    }
    setSuppressListSelectionHighlightId(null);
  }

  function selectList(listId: string) {
    leaveCalendarRoute();
    clearListSelectionHighlightDelay();
    setActiveView(null);
    setSelectedLabelId(null);
    setSelectedListId(listId);
    setSelectedTaskId(
      getFirstVisibleTaskId(null, listId, null, lists, tasksByList),
    );
  }

  const cancelSidebarHoverClear = useCallback(() => {
    if (clearSidebarHoverTimerRef.current !== null) {
      window.clearTimeout(clearSidebarHoverTimerRef.current);
      clearSidebarHoverTimerRef.current = null;
    }
  }, []);

  const handleSidebarHoverStart = useCallback(
    (preview: SidebarHoverPreview) => {
      cancelSidebarHoverClear();
      setSidebarHoverPreview(preview);
    },
    [cancelSidebarHoverClear],
  );

  const handleSidebarHoverEnd = useCallback(() => {
    cancelSidebarHoverClear();
    clearSidebarHoverTimerRef.current = window.setTimeout(() => {
      clearSidebarHoverTimerRef.current = null;
      setSidebarHoverPreview(null);
    }, 400);
  }, [cancelSidebarHoverClear]);

  function commitSidebarHoverSelection() {
    cancelSidebarHoverClear();
    const preview = sidebarHoverPreviewRef.current;
    if (!preview) return;

    setSidebarHoverPreview(null);

    if (preview.kind === "list") {
      if (
        preview.listId === selectedListId &&
        activeView === null &&
        selectedLabelId === null
      ) {
        return;
      }
      selectList(preview.listId);
      return;
    }

    if (preview.kind === "today") {
      if (activeView === "today") return;
      selectToday();
      return;
    }

    if (preview.kind === "important") {
      if (activeView === "important") return;
      selectImportant();
      return;
    }

    if (preview.kind === "calendar") {
      if (activeView === "calendar") return;
      selectCalendar();
      return;
    }

    if (preview.labelId === selectedLabelId) return;
    selectLabel(preview.labelId);
  }

  function selectToday() {
    leaveCalendarRoute();
    setActiveView("today");
    setSelectedLabelId(null);
    setSelectedListId(null);
    setSelectedTaskId(
      getFirstVisibleTaskId("today", null, null, lists, tasksByList),
    );
  }

  /*
  function selectNext7Days() {
    setActiveView("next7days");
    setSelectedLabelId(null);
    setSelectedListId(null);
    setSelectedTaskId(
      getFirstVisibleTaskId("next7days", null, null, lists, tasksByList),
    );
  }
  */

  function selectImportant() {
    leaveCalendarRoute();
    setActiveView("important");
    setSelectedLabelId(null);
    setSelectedListId(null);
    setSelectedTaskId(
      getFirstVisibleTaskId("important", null, null, lists, tasksByList),
    );
  }

  function selectCalendar() {
    if (pathname !== "/calendar") {
      router.push("/calendar");
    }
    setActiveView("calendar");
    setSelectedLabelId(null);
    setSelectedListId(null);
    setSelectedTaskId(null);
  }

  function selectLabel(labelId: string) {
    leaveCalendarRoute();
    setActiveView(null);
    setSelectedListId(null);
    setSelectedLabelId(labelId);
    setSelectedTaskId(
      getFirstVisibleTaskId(null, null, labelId, lists, tasksByList),
    );
  }

  function selectCompletedTask(taskId: string, listId: string) {
    leaveCalendarRoute();
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
    setSuppressListSelectionHighlightId(list.id);

    if (listSelectionHighlightTimerRef.current !== null) {
      window.clearTimeout(listSelectionHighlightTimerRef.current);
    }
    listSelectionHighlightTimerRef.current = window.setTimeout(() => {
      listSelectionHighlightTimerRef.current = null;
      setSuppressListSelectionHighlightId((current) =>
        current === list.id ? null : current,
      );
    }, 150);
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
    if (!name.trim()) return;

    const targetListId =
      displayedListId ??
      (displayedActiveView === "today" || displayedActiveView === "important"
        ? (lists[0]?.id ?? null)
        : null);
    if (!targetListId) return;

    const dueDateValue =
      displayedListId || displayedActiveView !== "today"
        ? null
        : getTodayDateValue();
    const markImportant = displayedActiveView === "important";
    const task = await createTask(targetListId, name.trim(), dueDateValue);

    if (markImportant) {
      await updateTaskImportantInDb(task.id, true);
    }

    const newTask: Task = {
      id: task.id,
      name: task.name,
      completed: task.completed,
      details: task.details,
      hasDetails: taskDetailsHasContent(task.details),
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString() : null,
      dueTimeMinutes: null,
      dueDurationMinutes: null,
      dueTimeZone: "floating",
      priority: null,
      pinned: false,
      important: markImportant,
      parentId: null,
      labels: [],
    };

    setTasksByList((current) => ({
      ...current,
      [targetListId]: [newTask, ...(current[targetListId] ?? [])],
    }));

    if (activeView === "today" || activeView === "important") {
      setSelectedTaskId(task.id);
    }
  }

  async function addCalendarTask(payload: {
    name: string;
    dueDate: string;
    details: string;
    listId: string;
  }) {
    const { name, dueDate, details, listId } = payload;
    if (!name.trim() || !listId) return;

    const task = await createTask(listId, name.trim(), dueDate);
    const detailsHtml = plainTextToTaskDetails(details);

    if (detailsHtml) {
      await updateTaskDetailsInDb(task.id, detailsHtml);
    }

    const newTask: Task = {
      id: task.id,
      name: task.name,
      completed: task.completed,
      details: detailsHtml,
      hasDetails: taskDetailsHasContent(detailsHtml),
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString() : null,
      dueTimeMinutes: null,
      dueDurationMinutes: null,
      dueTimeZone: "floating",
      priority: null,
      pinned: false,
      important: false,
      parentId: null,
      labels: [],
    };

    setTasksByList((current) => ({
      ...current,
      [listId]: [newTask, ...(current[listId] ?? [])],
    }));

    setSelectedTaskId(task.id);
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
      if (completingTaskIds.has(taskId) || checkAnimatingTaskIds.has(taskId)) {
        return;
      }

      setCheckAnimatingTaskIds((current) => new Set(current).add(taskId));
      setCompletingTaskIds((current) => new Set(current).add(taskId));

      if (selectedTaskId === taskId) {
        setSelectedTaskId(null);
      }

      clearCompletionTimer(taskId);
      completionTimerRef.current[taskId] = window.setTimeout(() => {
        setCheckAnimatingTaskIds((current) => {
          if (!current.has(taskId)) return current;
          const next = new Set(current);
          next.delete(taskId);
          return next;
        });
        scheduleUndo({
          taskId,
          listId,
          taskName: task.name,
        });

        completionTimerRef.current[taskId] = window.setTimeout(() => {
          void finalizeTaskCompletion(taskId, listId);
        }, COMPLETION_DISPLAY_MS);
      }, CHECKBOX_COMPLETE_ANIMATION_MS);
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

  const handleImportantUpdated = useCallback(
    (taskId: string, important: boolean) => {
      setTasksByList((current) => {
        const next = { ...current };

        for (const listId of Object.keys(next)) {
          next[listId] = next[listId].map((task) =>
            task.id === taskId ? { ...task, important } : task,
          );
        }

        return next;
      });
    },
    [],
  );

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

  async function setTaskImportant(taskId: string, important: boolean) {
    handleImportantUpdated(taskId, important);

    try {
      await updateTaskImportantInDb(taskId, important);
    } catch {
      handleImportantUpdated(taskId, !important);
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
    let previousSnapshot: ListTasksSnapshot | null = null;

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

      const previousIds = currentTasks.map((task) => task.id);
      const orderChanged = mergedTaskIds.join(",") !== previousIds.join(",");
      const parentChanged = parentUpdates.some((update) => {
        const task = currentTasks.find((item) => item.id === update.taskId);
        return task && (task.parentId ?? null) !== update.parentId;
      });

      if (!orderChanged && !parentChanged) {
        mergedTaskIds = null;
        return current;
      }

      previousSnapshot = {
        listId,
        tasks: cloneListTasks(currentTasks),
      };

      return {
        ...current,
        [listId]: mergedTasks,
      };
    });

    if (!mergedTaskIds || !previousSnapshot) return;

    reorderUndoStackRef.current = [
      ...reorderUndoStackRef.current,
      previousSnapshot,
    ];
    reorderRedoStackRef.current = [];

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
      const relatedTarget = event.relatedTarget;

      if (
        relatedTarget instanceof Node &&
        panel?.contains(relatedTarget)
      ) {
        return;
      }

      scheduleListCalendarClose();
    },
    [scheduleListCalendarClose],
  );

  const handleListCalendarPanelMouseLeave = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const button = listCalendarButtonRef.current;
      const relatedTarget = event.relatedTarget;

      if (
        relatedTarget instanceof Node &&
        button?.contains(relatedTarget)
      ) {
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
    setSidebarHoverPreview(null);
  }, [selectedListId, selectedLabelId, activeView]);

  useEffect(() => {
    return () => {
      cancelListCalendarClose();
      cancelSidebarHoverClear();
      if (listSelectionHighlightTimerRef.current !== null) {
        window.clearTimeout(listSelectionHighlightTimerRef.current);
      }
    };
  }, [cancelListCalendarClose, cancelSidebarHoverClear]);

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
          labels={visibleLabels}
          taskCountByListId={taskCountByListId}
          taskCountByLabelId={taskCountByLabelId}
          completedTasks={completedTasks}
          searchTasks={searchTasks}
          calendarTasks={calendarTasks}
          selectedListId={selectedListId}
          suppressListSelectionHighlightId={suppressListSelectionHighlightId}
          selectedLabelId={selectedLabelId}
          isTodaySelected={activeView === "today"}
          // isNext7DaysSelected={activeView === "next7days"}
          isImportantSelected={activeView === "important"}
          isCalendarSelected={activeView === "calendar"}
          selectedTaskId={selectedTaskId}
          onSelectList={selectList}
          onSelectLabel={selectLabel}
          onSelectToday={selectToday}
          // onSelectNext7Days={selectNext7Days}
          onSelectImportant={selectImportant}
          onSelectCalendar={selectCalendar}
          onSelectCompletedTask={selectCompletedTask}
          onSelectSearchTask={selectSearchTask}
          onToggleTask={toggleTask}
          onAddList={addList}
          onRenameList={renameList}
          onRemoveList={removeList}
          onReorderLists={reorderLists}
          onSidebarHoverStart={handleSidebarHoverStart}
          onSidebarHoverEnd={handleSidebarHoverEnd}
          sidebarHoverPreview={sidebarHoverPreview}
        />
        {showingCalendarMonth ? (
          <div
            className="flex min-h-0 min-w-0 flex-1 overflow-hidden"
            onMouseEnter={commitSidebarHoverSelection}
          >
            <CalendarPanel
              tasks={calendarTasks}
              lists={lists}
              completingTaskIds={completingTaskIds}
              checkAnimatingTaskIds={checkAnimatingTaskIds}
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
              onAddCalendarTask={addCalendarTask}
              defaultListId={lists[0]?.id ?? null}
            />
          </div>
        ) : showRightPanel ? (
          <div
            ref={splitContainerRef}
            className="flex min-h-0 min-w-0 flex-1 overflow-hidden"
          >
            <div
              className="flex min-h-0 shrink-0"
              onMouseEnter={commitSidebarHoverSelection}
            >
              <TaskListPanel
                title={taskListTitle}
                tasks={taskListItems}
                lists={lists}
                completingTaskIds={completingTaskIds}
                checkAnimatingTaskIds={checkAnimatingTaskIds}
                selectedTaskId={selectedTaskId}
                panelWidth={taskListWidth}
                panelMaxWidth={
                  hasResizedTaskList ? undefined : DEFAULT_TASK_LIST_WIDTH
                }
                expanded={false}
                showAddTask={
                  displayedListId !== null ||
                  ((displayedActiveView === "today" ||
                    displayedActiveView === "important") &&
                    lists.length > 0)
                }
                isLabelFilter={displayedLabelId !== null}
                listId={displayedListId}
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
                onSetTaskImportant={setTaskImportant}
                onToggleTaskLabel={toggleTaskLabel}
                onLabelsChanged={refreshLabels}
                onMoveTaskToList={moveTaskToList}
                onTaskHoverStart={handleTaskHoverStart}
                onTaskHoverEnd={() => setHoveredTaskId(null)}
                showListCalendarButton={displayedListId !== null}
                listCalendarButtonRef={listCalendarButtonRef}
                onListCalendarHoverStart={openListCalendar}
                onListCalendarHoverLeave={handleListCalendarButtonMouseLeave}
                isListHovered={sidebarHoverPreview !== null}
              />
              <PanelResizeHandle onPointerDown={handleTaskListResizeStart} />
            </div>
            <div className="flex min-h-0 min-w-[300px] flex-1 flex-col overflow-hidden">
              {isListCalendarOpen && (
                <div
                  ref={listCalendarPanelRef}
                  onMouseEnter={cancelListCalendarClose}
                  onMouseLeave={handleListCalendarPanelMouseLeave}
                  className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white dark:bg-zinc-950"
                >
                  <CalendarMonthView
                    tasks={taskListItems}
                    lists={lists}
                    selectedTaskId={selectedTaskId}
                    onSelectTask={setSelectedTaskId}
                    onToggleTask={toggleTask}
                    onSetTaskDueDate={setTaskDueDate}
                    onSetTaskDueTime={setTaskDueTime}
                    onMoveTaskToList={moveTaskToList}
                    onAddCalendarTask={addCalendarTask}
                    defaultListId={displayedListId}
                  />
                </div>
              )}
              {showTaskDetails && (
                <div
                  className={`flex min-h-0 flex-1 flex-col overflow-hidden transition-[filter] duration-200 ${
                    isSidebarHoverPreview &&
                    sidebarHoverPreview?.kind !== "today" &&
                    sidebarHoverPreview?.kind !== "important"
                      ? "pointer-events-none blur-[1.5px] brightness-[0.985]"
                      : ""
                  }`}
                >
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
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            <TaskListPanel
              title={taskListTitle}
              tasks={taskListItems}
              lists={lists}
              completingTaskIds={completingTaskIds}
              checkAnimatingTaskIds={checkAnimatingTaskIds}
              selectedTaskId={selectedTaskId}
              expanded
              showAddTask={
                displayedListId !== null ||
                ((displayedActiveView === "today" ||
                  displayedActiveView === "important") &&
                  lists.length > 0)
              }
              isLabelFilter={displayedLabelId !== null}
              listId={displayedListId}
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
              onSetTaskImportant={setTaskImportant}
              onToggleTaskLabel={toggleTaskLabel}
              onLabelsChanged={refreshLabels}
              onMoveTaskToList={moveTaskToList}
              onTaskHoverStart={handleTaskHoverStart}
              onTaskHoverEnd={() => setHoveredTaskId(null)}
              showListCalendarButton={displayedListId !== null}
              listCalendarButtonRef={listCalendarButtonRef}
              onListCalendarHoverStart={openListCalendar}
              onListCalendarHoverLeave={handleListCalendarButtonMouseLeave}
              isListHovered={sidebarHoverPreview !== null}
              onPanelMouseEnter={commitSidebarHoverSelection}
            />
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
