"use client";

import { FormEvent, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { BiSortAlt2 } from "react-icons/bi";
import { LuCalendarCheck2, LuCheck, LuPlus, LuX } from "react-icons/lu";
import { PiArrowBendDownRight } from "react-icons/pi";
import { createLabel, getLabels } from "@/app/actions/todo";
import { TaskListTaskRow } from "./task-list-task-row";
import type { Label } from "./task-label-selector";
import {
  TaskRowContextMenu,
  type TaskRowContextMenuView,
} from "./task-row-context-menu";
import type { TaskListItem, TodoList } from "./todo-app";
import type { TaskDueTime } from "@/lib/task-due-time";
import {
  buildVisibleTasks,
  clampSubtaskKeepDropIndex,
  collectParentUpdates,
  getDragBlockIds,
  getDropIndicatorIndent,
  reorderVisibleTaskIds,
  resolveHierarchyDragIntent,
  SUBTASK_INDENT_PX,
  SUBTASK_ICON_INDENT_PX,
  SUBTASK_ROOT_LEFT_PX,
  type HierarchyDragIntent,
} from "@/lib/task-subtasks";
import {
  getTaskDropIndex,
  getTaskRowElements,
} from "./task-reorder";

type SortField = "date" | "title";
type SortDirection = "asc" | "desc";

type SortOption = {
  field: SortField;
  direction: SortDirection;
  label: string;
};

type DropIndicatorState = {
  top: number;
  section: "pinned" | "unpinned";
  indent: number;
};

type TaskDragState = {
  sourceRow: HTMLElement;
  captureTarget: HTMLElement;
  sourceIndex: number;
  dropIndex: number;
  sourceTaskId: string;
  taskIds: string[];
  blockIds: string[];
  pointerId: number;
  section: "pinned" | "unpinned";
  hierarchyIntent: HierarchyDragIntent;
  sourceParentId: string | null;
};

const SORT_OPTIONS: SortOption[] = [
  { field: "date", direction: "asc", label: "Date (ascending)" },
  { field: "date", direction: "desc", label: "Date (descending)" },
  { field: "title", direction: "asc", label: "Title (A-Z)" },
  { field: "title", direction: "desc", label: "Title (Z-A)" },
];

const ROW_DRAG_THRESHOLD_PX = 5;

function shouldStartRowDrag(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return true;

  return !target.closest(
    "input, button, textarea, select, a, [role='menu'], [role='menuitem']",
  );
}

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

function formatTaskDueDateLabel(value: string | null) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const today = startOfDay(new Date());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dueDay = startOfDay(date);

  if (isSameDay(dueDay, today)) return "Today";
  if (isSameDay(dueDay, tomorrow)) return "Tomorrow";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

function getDueDateTimestamp(dueDate: string | null) {
  if (!dueDate) return null;

  const date = new Date(dueDate);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function sortTasks(
  tasks: TaskListItem[],
  field: SortField,
  direction: SortDirection,
) {
  const sorted = [...tasks];

  sorted.sort((a, b) => {
    if (field === "title") {
      const comparison = a.name.localeCompare(b.name, undefined, {
        sensitivity: "base",
      });
      return direction === "asc" ? comparison : -comparison;
    }

    const aDate = getDueDateTimestamp(a.dueDate);
    const bDate = getDueDateTimestamp(b.dueDate);

    if (aDate === null && bDate === null) {
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    }

    if (aDate === null) return direction === "asc" ? 1 : -1;
    if (bDate === null) return direction === "asc" ? -1 : 1;

    const comparison = aDate - bDate;
    if (comparison !== 0) {
      return direction === "asc" ? comparison : -comparison;
    }

    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });

  return sorted;
}

type PointerContextMenuState = {
  taskId: string;
  x: number;
  y: number;
  view: TaskRowContextMenuView;
};

type TaskListPanelProps = {
  title: string | null;
  tasks: TaskListItem[];
  lists: TodoList[];
  completingTaskIds: Set<string>;
  selectedTaskId: string | null;
  expanded?: boolean;
  embedded?: boolean;
  showHeader?: boolean;
  showAddTask?: boolean;
  isLabelFilter?: boolean;
  listId?: string | null;
  onAddTask: (name: string) => void;
  onToggleTask: (taskId: string) => void;
  onSelectTask: (taskId: string) => void;
  onRenameTask: (taskId: string, name: string) => void;
  onTaskNameChange?: (taskId: string, name: string) => void;
  onReorderTasks?: (
    listId: string,
    taskIds: string[],
    section: "pinned" | "unpinned",
    parentUpdates?: Array<{ taskId: string; parentId: string | null }>,
  ) => void;
  onSetTaskDueDate?: (taskId: string, dateValue: string | null) => void;
  onSetTaskDueTime?: (taskId: string, dueTime: TaskDueTime) => void;
  onSetTaskPriority?: (taskId: string, priority: number | null) => void;
  onSetTaskPinned?: (taskId: string, pinned: boolean) => void;
  onSetTaskBookmarked?: (taskId: string, bookmarked: boolean) => void;
  onToggleTaskLabel?: (
    taskId: string,
    labelId: string,
    assigned: boolean,
  ) => Promise<{ id: string; label: string }[]>;
  onLabelsChanged?: () => void;
  onMoveTaskToList?: (
    taskId: string,
    sourceListId: string,
    targetListId: string,
  ) => void;
  onTaskHoverStart?: (taskId: string) => void;
  onTaskHoverEnd?: () => void;
  showListCalendarButton?: boolean;
  listCalendarButtonRef?: RefObject<HTMLButtonElement | null>;
  onListCalendarHoverStart?: () => void;
  onListCalendarHoverLeave?: (event: React.MouseEvent<HTMLButtonElement>) => void;
};

export function TaskListPanel({
  title,
  tasks,
  lists,
  completingTaskIds,
  selectedTaskId,
  expanded = false,
  embedded = false,
  showHeader = true,
  showAddTask = false,
  isLabelFilter = false,
  listId = null,
  onAddTask,
  onToggleTask,
  onSelectTask,
  onRenameTask,
  onTaskNameChange,
  onReorderTasks,
  onSetTaskDueDate,
  onSetTaskDueTime,
  onSetTaskPriority,
  onSetTaskPinned,
  onSetTaskBookmarked,
  onToggleTaskLabel,
  onLabelsChanged,
  onMoveTaskToList,
  onTaskHoverStart,
  onTaskHoverEnd,
  showListCalendarButton = false,
  listCalendarButtonRef,
  onListCalendarHoverStart,
  onListCalendarHoverLeave,
}: TaskListPanelProps) {
  const [newTaskName, setNewTaskName] = useState("");
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [orderedTasks, setOrderedTasks] = useState(tasks);
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [openDatePickerTaskId, setOpenDatePickerTaskId] = useState<string | null>(
    null,
  );
  const [openMenuTaskId, setOpenMenuTaskId] = useState<string | null>(null);
  const [openLabelMenuTaskId, setOpenLabelMenuTaskId] = useState<string | null>(
    null,
  );
  const [openMoveMenuTaskId, setOpenMoveMenuTaskId] = useState<string | null>(
    null,
  );
  const [moveQuery, setMoveQuery] = useState("");
  const [availableLabels, setAvailableLabels] = useState<Label[]>([]);
  const [assignedLabelIds, setAssignedLabelIds] = useState<string[]>([]);
  const [labelQuery, setLabelQuery] = useState("");
  const [isLabelSubmitting, setIsLabelSubmitting] = useState(false);
  const [pointerContextMenu, setPointerContextMenu] =
    useState<PointerContextMenuState | null>(null);
  const [dropIndicator, setDropIndicator] = useState<DropIndicatorState | null>(
    null,
  );

  const activeLabelMenuTaskId =
    openLabelMenuTaskId ??
    (pointerContextMenu?.view === "label" ? pointerContextMenu.taskId : null);

  useEffect(() => {
    if (!activeLabelMenuTaskId) return;

    let cancelled = false;

    void getLabels()
      .then((tags) => {
        if (!cancelled) {
          setAvailableLabels(tags);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAvailableLabels([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeLabelMenuTaskId]);

  useEffect(() => {
    if (!activeLabelMenuTaskId) return;

    const task = orderedTasks.find((item) => item.id === activeLabelMenuTaskId);
    if (!task) return;

    setAssignedLabelIds(task.labels.map((tag) => tag.id));
  }, [activeLabelMenuTaskId, orderedTasks]);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const newTaskInputRef = useRef<HTMLInputElement>(null);
  const keepAddTaskOpenRef = useRef(false);
  const titleEditReadyRef = useRef(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const taskDateMenuRef = useRef<HTMLDivElement>(null);
  const taskContextMenuRef = useRef<HTMLDivElement>(null);
  const pointerContextMenuRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const pinnedListRef = useRef<HTMLUListElement>(null);
  const dragStateRef = useRef<TaskDragState | null>(null);
  const suppressRowClickRef = useRef(false);

  const canReorder = showAddTask && Boolean(listId && onReorderTasks);

  const pinnedTasks = useMemo(
    () =>
      showAddTask ? orderedTasks.filter((task) => Boolean(task.pinned)) : [],
    [orderedTasks, showAddTask],
  );

  const listTasks = useMemo(
    () =>
      showAddTask
        ? orderedTasks.filter((task) => !Boolean(task.pinned))
        : orderedTasks,
    [orderedTasks, showAddTask],
  );

  const pinnedVisibleTasks = useMemo(
    () =>
      canReorder
        ? buildVisibleTasks(orderedTasks, true)
        : pinnedTasks.map((task) => ({ ...task, depth: 0 })),
    [canReorder, orderedTasks, pinnedTasks],
  );

  const unpinnedVisibleTasks = useMemo(
    () =>
      canReorder
        ? buildVisibleTasks(orderedTasks, false)
        : listTasks.map((task) => ({ ...task, depth: 0 })),
    [canReorder, listTasks, orderedTasks],
  );

  const tasksById = useMemo(
    () => new Map(orderedTasks.map((task) => [task.id, task])),
    [orderedTasks],
  );

  useEffect(() => {
    setOrderedTasks(tasks);
  }, [tasks]);

  useEffect(() => {
    if (!editingTaskId) return;

    const task = tasks.find((item) => item.id === editingTaskId);
    if (!task || task.name === titleDraft) return;
    if (document.activeElement === titleInputRef.current) return;

    setTitleDraft(task.name);
  }, [tasks, editingTaskId, titleDraft]);

  useEffect(() => {
    setEditingTaskId(null);
    setTitleDraft("");
    setOpenDatePickerTaskId(null);
    setOpenMenuTaskId(null);
    setOpenLabelMenuTaskId(null);
    setOpenMoveMenuTaskId(null);
    resetLabelMenuState();
    resetMoveMenuState();
    setPointerContextMenu(null);
    setIsAddingTask(false);
    setNewTaskName("");
  }, [title]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;

      if (taskDateMenuRef.current?.contains(target)) return;
      if (taskContextMenuRef.current?.contains(target)) return;
      if (pointerContextMenuRef.current?.contains(target)) return;

      setOpenDatePickerTaskId(null);
      setOpenMenuTaskId(null);
      setOpenLabelMenuTaskId(null);
      setOpenMoveMenuTaskId(null);
      resetLabelMenuState();
      resetMoveMenuState();
      setPointerContextMenu(null);
    }

    if (
      !openDatePickerTaskId &&
      !openMenuTaskId &&
      !openLabelMenuTaskId &&
      !openMoveMenuTaskId &&
      !pointerContextMenu
    ) {
      return;
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [
    openDatePickerTaskId,
    openMenuTaskId,
    openLabelMenuTaskId,
    openMoveMenuTaskId,
    pointerContextMenu,
  ]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;

      setOpenMenuTaskId(null);
      setOpenLabelMenuTaskId(null);
      setOpenMoveMenuTaskId(null);
      resetLabelMenuState();
      resetMoveMenuState();
      setPointerContextMenu(null);
    }

    if (
      !openMenuTaskId &&
      !openLabelMenuTaskId &&
      !openMoveMenuTaskId &&
      !pointerContextMenu
    ) {
      return;
    }

    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [
    openMenuTaskId,
    openLabelMenuTaskId,
    openMoveMenuTaskId,
    pointerContextMenu,
  ]);

  useEffect(() => {
    if (!editingTaskId) {
      titleEditReadyRef.current = false;
      return;
    }

    requestAnimationFrame(() => {
      const input = titleInputRef.current;
      if (!input) return;

      input.focus();
      const end = input.value.length;
      input.setSelectionRange(end, end);
      titleEditReadyRef.current = true;
    });
  }, [editingTaskId]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!sortMenuRef.current?.contains(event.target as Node)) {
        setIsSortMenuOpen(false);
      }
    }

    if (!isSortMenuOpen) return;

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isSortMenuOpen]);

  useEffect(() => {
    if (!isAddingTask) return;

    requestAnimationFrame(() => {
      newTaskInputRef.current?.focus();
    });
  }, [isAddingTask]);

  function cancelAddTask() {
    setIsAddingTask(false);
    setNewTaskName("");
  }

  function submitNewTask() {
    if (!newTaskName.trim()) {
      cancelAddTask();
      return;
    }

    keepAddTaskOpenRef.current = true;
    onAddTask(newTaskName);
    setNewTaskName("");

    requestAnimationFrame(() => {
      newTaskInputRef.current?.focus();
      keepAddTaskOpenRef.current = false;
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitNewTask();
  }

  function startTitleEdit(task: TaskListItem) {
    setEditingTaskId(task.id);
    setTitleDraft(task.name);
  }

  function handleTaskClick(task: TaskListItem) {
    if (suppressRowClickRef.current) {
      suppressRowClickRef.current = false;
      return;
    }

    onSelectTask(task.id);
    startTitleEdit(task);
  }

  function handleTaskHoverEnd(
    event: React.MouseEvent<HTMLLIElement>,
    task: TaskListItem,
  ) {
    if (!onTaskHoverEnd) return;

    const relatedTarget = event.relatedTarget;
    if (relatedTarget instanceof Node) {
      if (pointerContextMenuRef.current?.contains(relatedTarget)) return;
      if (taskDateMenuRef.current?.contains(relatedTarget)) return;
      if (
        relatedTarget instanceof Element &&
        relatedTarget.closest("[data-task-id]")
      ) {
        return;
      }
    }

    if (
      openMenuTaskId === task.id ||
      openLabelMenuTaskId === task.id ||
      openMoveMenuTaskId === task.id ||
      openDatePickerTaskId === task.id ||
      pointerContextMenu?.taskId === task.id
    ) {
      return;
    }

    onTaskHoverEnd();
  }

  function cancelTitleEdit(task: TaskListItem) {
    setTitleDraft(task.name);
    setEditingTaskId(null);
  }

  function commitTitleEdit(task: TaskListItem) {
    const trimmed = titleDraft.trim();

    if (!trimmed) {
      cancelTitleEdit(task);
      return;
    }

    if (trimmed !== task.name) {
      onRenameTask(task.id, trimmed);
    }

    setEditingTaskId(null);
  }

  function handleTitleKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>,
    task: TaskListItem,
  ) {
    if (event.key === "Enter") {
      event.preventDefault();
      commitTitleEdit(task);
    }

    if (event.key === "Escape") {
      event.preventDefault();
      cancelTitleEdit(task);
    }
  }

  function applySort(field: SortField, direction: SortDirection) {
    const pinned = orderedTasks.filter((task) => task.pinned);
    const unpinned = orderedTasks.filter((task) => !task.pinned);
    const sorted = sortTasks(unpinned, field, direction);
    setOrderedTasks([...pinned, ...sorted]);

    if (listId && onReorderTasks) {
      onReorderTasks(
        listId,
        sorted.map((task) => task.id),
        "unpinned",
      );
    }

    setIsSortMenuOpen(false);
  }

  function resetLabelMenuState() {
    setAssignedLabelIds([]);
    setLabelQuery("");
    setIsLabelSubmitting(false);
  }

  function resetMoveMenuState() {
    setMoveQuery("");
  }

  function resolveTaskListId(task: TaskListItem): string | null {
    return task.listId ?? listId ?? null;
  }

  function initLabelMenuForTask(taskId: string) {
    const task = orderedTasks.find((item) => item.id === taskId);
    setAssignedLabelIds(task?.labels.map((item) => item.id) ?? []);
    setLabelQuery("");
    setIsLabelSubmitting(false);
  }

  function closeTaskMenus() {
    setOpenMenuTaskId(null);
    setOpenLabelMenuTaskId(null);
    setOpenMoveMenuTaskId(null);
    resetLabelMenuState();
    resetMoveMenuState();
    setPointerContextMenu(null);
  }

  function toggleDatePicker(taskId: string) {
    closeTaskMenus();
    setOpenDatePickerTaskId((current) => (current === taskId ? null : taskId));
  }

  function toggleTaskMenu(taskId: string) {
    setOpenDatePickerTaskId(null);
    setPointerContextMenu(null);
    setOpenLabelMenuTaskId(null);
    setOpenMoveMenuTaskId(null);
    resetLabelMenuState();
    resetMoveMenuState();
    setOpenMenuTaskId((current) => (current === taskId ? null : taskId));
  }

  function openLabelMenu(taskId: string) {
    setOpenMenuTaskId(null);
    setOpenMoveMenuTaskId(null);
    resetMoveMenuState();
    initLabelMenuForTask(taskId);
    if (pointerContextMenu?.taskId === taskId) {
      setPointerContextMenu({ ...pointerContextMenu, view: "label" });
      return;
    }

    setPointerContextMenu(null);
    setOpenLabelMenuTaskId(taskId);
  }

  function openMoveMenu(taskId: string) {
    setOpenMenuTaskId(null);
    setOpenLabelMenuTaskId(null);
    resetLabelMenuState();
    setMoveQuery("");
    if (pointerContextMenu?.taskId === taskId) {
      setPointerContextMenu({ ...pointerContextMenu, view: "moveTo" });
      return;
    }

    setPointerContextMenu(null);
    setOpenMoveMenuTaskId(taskId);
  }

  function handleMoveTaskToList(taskId: string, targetListId: string) {
    if (!onMoveTaskToList) return;

    const task = orderedTasks.find((item) => item.id === taskId);
    if (!task) return;

    const sourceListId = resolveTaskListId(task);
    if (!sourceListId || sourceListId === targetListId) return;

    onMoveTaskToList(taskId, sourceListId, targetListId);
    closeTaskMenus();
  }

  async function handleToggleLabel(taskId: string, labelId: string) {
    if (!onToggleTaskLabel) return;

    const isAssigned = assignedLabelIds.includes(labelId);
    setIsLabelSubmitting(true);

    try {
      const updatedTags = await onToggleTaskLabel(taskId, labelId, !isAssigned);
      setAssignedLabelIds(updatedTags.map((tag) => tag.id));
    } catch {
      return;
    } finally {
      setIsLabelSubmitting(false);
    }
  }

  async function handleCreateLabel(taskId: string, label: string) {
    const trimmed = label.trim();
    if (!trimmed) return;

    setIsLabelSubmitting(true);

    try {
      const tag = await createLabel(trimmed);
      setAvailableLabels((current) => {
        if (current.some((item) => item.id === tag.id)) {
          return current;
        }

        return [...current, tag].sort((a, b) =>
          a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
        );
      });

      if (onToggleTaskLabel) {
        const updatedTags = await onToggleTaskLabel(taskId, tag.id, true);
        setAssignedLabelIds(updatedTags.map((item) => item.id));
      } else {
        setAssignedLabelIds((current) =>
          current.includes(tag.id) ? current : [...current, tag.id],
        );
      }

      setLabelQuery("");
      onLabelsChanged?.();
    } catch {
      return;
    } finally {
      setIsLabelSubmitting(false);
    }
  }

  function handleConfirmLabels() {
    closeTaskMenus();
  }

  function handleSelectTaskDueDate(taskId: string, dateValue: string) {
    onSetTaskDueDate?.(taskId, dateValue);
  }

  function handleSaveTaskDueTime(taskId: string, dueTime: TaskDueTime) {
    onSetTaskDueTime?.(taskId, dueTime);
    setOpenDatePickerTaskId(null);
  }

  function handleClearTaskDueDate(taskId: string) {
    onSetTaskDueDate?.(taskId, null);
    closeTaskMenus();
  }

  function handleSelectTaskPriority(taskId: string, priority: number) {
    onSetTaskPriority?.(taskId, priority);
    closeTaskMenus();
  }

  function handleToggleTaskPinned(task: TaskListItem) {
    onSetTaskPinned?.(task.id, !task.pinned);
    closeTaskMenus();
  }

  function handleToggleTaskBookmarked(task: TaskListItem) {
    onSetTaskBookmarked?.(task.id, !task.bookmarked);
    closeTaskMenus();
  }

  function handleClearTaskPriority(taskId: string) {
    onSetTaskPriority?.(taskId, null);
    closeTaskMenus();
  }

  function handleTaskContextMenu(
    event: React.MouseEvent<HTMLLIElement>,
    task: TaskListItem,
  ) {
    event.preventDefault();
    event.stopPropagation();

    onSelectTask(task.id);
    setOpenDatePickerTaskId(null);
    setOpenMenuTaskId(null);
    setOpenLabelMenuTaskId(null);
    setOpenMoveMenuTaskId(null);
    resetLabelMenuState();
    resetMoveMenuState();
    setPointerContextMenu({
      taskId: task.id,
      x: event.clientX,
      y: event.clientY,
      view: "main",
    });
  }

  function handleDragMove(event: PointerEvent) {
    const dragState = dragStateRef.current;
    if (!dragState) return;

    const list =
      dragState.section === "pinned"
        ? pinnedListRef.current
        : listRef.current;
    if (!list) return;

    const rows = getTaskRowElements(list);
    let dropIndex = getTaskDropIndex(
      event.clientY,
      rows,
      dragState.sourceIndex,
    );

    const listRect = list.getBoundingClientRect();
    const hasChildBlock = dragState.blockIds.length > 1;
    const sourceParentId = dragState.sourceParentId;
    const hierarchyIntent = hasChildBlock
      ? "root"
      : resolveHierarchyDragIntent(
          event.clientX,
          listRect.left,
          sourceParentId,
        );
    dragState.hierarchyIntent = hierarchyIntent;

    if (sourceParentId && hierarchyIntent === "keep") {
      dropIndex = clampSubtaskKeepDropIndex(
        dragState.taskIds,
        dragState.sourceIndex,
        dropIndex,
        sourceParentId,
        tasksById,
      );
    }

    dragState.dropIndex = dropIndex;

    let indicatorTop: number;

    if (dropIndex >= rows.length) {
      const lastRow = rows[rows.length - 1];
      if (!lastRow) return;
      const rect = lastRow.getBoundingClientRect();
      indicatorTop = rect.bottom - listRect.top;
    } else {
      const targetRow = rows[dropIndex];
      const rect = targetRow.getBoundingClientRect();
      indicatorTop = rect.top - listRect.top;
    }

    const indent = getDropIndicatorIndent(
      hierarchyIntent,
      dropIndex,
      sourceParentId,
    );

    setDropIndicator({ top: indicatorTop, section: dragState.section, indent });
  }

  function beginTaskDrag(
    sourceRow: HTMLElement,
    pointerId: number,
    sourceIndex: number,
    sourceTaskId: string,
    taskIds: string[],
    blockIds: string[],
    section: "pinned" | "unpinned",
    sourceParentId: string | null,
  ) {
    dragStateRef.current = {
      sourceRow,
      captureTarget: sourceRow,
      sourceIndex,
      dropIndex: sourceIndex,
      sourceTaskId,
      taskIds,
      blockIds,
      pointerId,
      section,
      hierarchyIntent: sourceParentId ? "keep" : "root",
      sourceParentId,
    };

    sourceRow.classList.add("opacity-50");
    sourceRow.setPointerCapture(pointerId);
    sourceRow.style.cursor = "move";
    document.body.style.cursor = "move";
    document.addEventListener("pointermove", handleDragMove);
    document.addEventListener("pointerup", handleDragEnd);
    document.addEventListener("pointercancel", handleDragEnd);
  }

  function handleDragEnd() {
    const dragState = dragStateRef.current;
    const wasDragging = dragState !== null;

    document.removeEventListener("pointermove", handleDragMove);
    document.removeEventListener("pointerup", handleDragEnd);
    document.removeEventListener("pointercancel", handleDragEnd);
    document.body.style.cursor = "";

    if (dragState) {
      if (dragState.captureTarget.hasPointerCapture(dragState.pointerId)) {
        dragState.captureTarget.releasePointerCapture(dragState.pointerId);
      }
      dragState.sourceRow.classList.remove("opacity-50");
      dragState.sourceRow.style.cursor = "";
    }

    setDropIndicator(null);

    if (dragState && listId && onReorderTasks) {
      let dropIndex = dragState.dropIndex;

      if (
        dragState.sourceParentId &&
        dragState.hierarchyIntent === "keep"
      ) {
        dropIndex = clampSubtaskKeepDropIndex(
          dragState.taskIds,
          dragState.sourceIndex,
          dropIndex,
          dragState.sourceParentId,
          tasksById,
        );
      }

      const nextIds = reorderVisibleTaskIds(
        dragState.taskIds,
        dragState.sourceIndex,
        dropIndex,
        dragState.blockIds,
      );

      const orderChanged = nextIds.join(",") !== dragState.taskIds.join(",");
      const hierarchyIntentByTaskId = new Map([
        [dragState.sourceTaskId, dragState.hierarchyIntent],
      ]);
      const parentUpdates = collectParentUpdates(
        orderedTasks,
        nextIds,
        [dragState.sourceTaskId],
        hierarchyIntentByTaskId,
        tasksById,
      );
      const parentChanged = parentUpdates.length > 0;

      if (orderChanged || parentChanged) {
        onReorderTasks(
          listId,
          nextIds,
          dragState.section,
          parentUpdates,
        );
      }
    }

    if (wasDragging) {
      suppressRowClickRef.current = true;
    }

    dragStateRef.current = null;
  }

  function handleRowPointerDown(
    event: React.PointerEvent<HTMLLIElement>,
    taskId: string,
    section: "pinned" | "unpinned",
  ) {
    if (!canReorder || event.button !== 0) return;
    if (!shouldStartRowDrag(event.target)) return;

    const list =
      section === "pinned" ? pinnedListRef.current : listRef.current;
    if (!list) return;

    const rows = getTaskRowElements(list);
    const sourceRow = rows.find((row) => row.dataset.taskId === taskId);
    if (!sourceRow) return;

    const dragRow = sourceRow;
    const sourceIndex = rows.indexOf(dragRow);
    if (sourceIndex < 0) return;

    const visibleTasks =
      section === "pinned" ? pinnedVisibleTasks : unpinnedVisibleTasks;
    const taskIds = visibleTasks.map((task) => task.id);
    const blockIds = getDragBlockIds(taskIds, sourceIndex, tasksById);
    const sourceParentId = tasksById.get(taskId)?.parentId ?? null;

    const startX = event.clientX;
    const startY = event.clientY;
    const pointerId = event.pointerId;
    let dragStarted = false;

    dragRow.style.cursor = "move";
    document.body.style.cursor = "move";

    function clearPendingListeners() {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointercancel", onPointerUp);
    }

    function onPointerMove(moveEvent: PointerEvent) {
      if (moveEvent.pointerId !== pointerId) return;

      if (dragStarted) return;

      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      if (Math.hypot(dx, dy) < ROW_DRAG_THRESHOLD_PX) return;

      dragStarted = true;
      clearPendingListeners();
      beginTaskDrag(
        dragRow,
        pointerId,
        sourceIndex,
        taskId,
        taskIds,
        blockIds,
        section,
        sourceParentId,
      );
    }

    function onPointerUp(upEvent: PointerEvent) {
      if (upEvent.pointerId !== pointerId) return;
      clearPendingListeners();
      if (!dragStarted) {
        dragRow.style.cursor = "";
        document.body.style.cursor = "";
      }
    }

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerUp);
  }

  function renderTaskItems(
    taskItems: Array<TaskListItem & { depth?: number }>,
    section: "pinned" | "unpinned",
  ) {
    const hasLabelActions = Boolean(onToggleTaskLabel);
    const hasMoveActions = Boolean(onMoveTaskToList) && lists.length > 1;
    const useWiderRowPadding = title === "Today" || title === "Bookmarks";

    return taskItems.flatMap((task, index) => {
      const depth = task.depth ?? 0;
      const previousTask = index > 0 ? taskItems[index - 1] : null;
      const showSubtaskConnector =
        depth === 1 &&
        previousTask &&
        (previousTask.depth ?? 0) === 0 &&
        task.parentId === previousTask.id;

      const row = (
        <TaskListTaskRow
          key={task.id}
          task={task}
          depth={depth}
          isCompleting={completingTaskIds.has(task.id)}
          selectedTaskId={selectedTaskId}
          editingTaskId={editingTaskId}
          titleDraft={titleDraft}
          titleInputRef={titleInputRef}
          showDragHandle={canReorder}
          openDatePickerTaskId={openDatePickerTaskId}
          openMenuTaskId={openMenuTaskId}
          openLabelMenuTaskId={openLabelMenuTaskId}
          openMoveMenuTaskId={openMoveMenuTaskId}
          lists={lists}
          currentListId={resolveTaskListId(task)}
          moveQuery={moveQuery}
          availableLabels={availableLabels}
          assignedLabelIds={assignedLabelIds}
          labelQuery={labelQuery}
          isLabelSubmitting={isLabelSubmitting}
          taskDateMenuRef={taskDateMenuRef}
          taskContextMenuRef={taskContextMenuRef}
          dueDateLabel={formatTaskDueDateLabel(task.dueDate)}
          onTaskClick={handleTaskClick}
          onTaskHoverStart={
            onTaskHoverStart
              ? () => onTaskHoverStart(task.id)
              : undefined
          }
          onTaskHoverEnd={
            onTaskHoverEnd
              ? (event) => handleTaskHoverEnd(event, task)
              : undefined
          }
          onTaskContextMenu={handleTaskContextMenu}
          onToggleTask={onToggleTask}
          onTitleDraftChange={(taskId, value) => {
            setTitleDraft(value);
            onTaskNameChange?.(taskId, value);
          }}
          onCommitTitleEdit={(item) => {
            if (!titleEditReadyRef.current) return;
            commitTitleEdit(item);
          }}
          onTitleKeyDown={handleTitleKeyDown}
          onTaskDragStart={(event, taskId) =>
            handleRowPointerDown(event, taskId, section)
          }
          onToggleDatePicker={toggleDatePicker}
          onSelectTaskDueDate={handleSelectTaskDueDate}
          onSaveTaskDueTime={handleSaveTaskDueTime}
          onToggleTaskMenu={toggleTaskMenu}
          onStartTitleEdit={startTitleEdit}
          onToggleTaskPinned={handleToggleTaskPinned}
          onToggleTaskBookmarked={handleToggleTaskBookmarked}
          onOpenLabelMenu={openLabelMenu}
          onOpenMoveMenu={openMoveMenu}
          onMoveQueryChange={setMoveQuery}
          onMoveTaskToList={handleMoveTaskToList}
          onLabelQueryChange={setLabelQuery}
          onToggleLabel={(labelId) => handleToggleLabel(task.id, labelId)}
          onCreateLabel={(label) => handleCreateLabel(task.id, label)}
          onClearTaskDueDate={handleClearTaskDueDate}
          onSelectTaskPriority={handleSelectTaskPriority}
          onClearTaskPriority={handleClearTaskPriority}
          onConfirmLabels={handleConfirmLabels}
          onCloseTaskMenu={closeTaskMenus}
          hasDueDateActions={Boolean(onSetTaskDueDate)}
          hasPriorityActions={Boolean(onSetTaskPriority)}
          hasPinActions={Boolean(onSetTaskPinned)}
          hasBookmarkActions={Boolean(onSetTaskBookmarked)}
          hasLabelActions={hasLabelActions}
          hasMoveActions={hasMoveActions}
          useWiderRowPadding={useWiderRowPadding}
        />
      );

      if (!showSubtaskConnector) {
        return [row];
      }

      return [
        <li
          key={`${task.id}-subtask-connector`}
          aria-hidden="true"
          className="flex h-4 items-center border-b border-zinc-100 py-0 pr-2 dark:border-zinc-900"
          style={{
            paddingLeft: SUBTASK_ROOT_LEFT_PX + SUBTASK_INDENT_PX + SUBTASK_ICON_INDENT_PX,
          }}
        >
          <PiArrowBendDownRight className="size-3.5 text-zinc-400 dark:text-zinc-500" />
        </li>,
        row,
      ];
    });
  }

  const pointerMenuTask = pointerContextMenu
    ? orderedTasks.find((task) => task.id === pointerContextMenu.taskId)
    : null;

  return (
    <section
      className={`shrink-0 border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 ${
        embedded ? "w-[350px]" : "w-full max-w-[350px]"
      }`}
    >
      {title ? (
        <div className="flex flex-col">
          {showHeader && (
            <header className="border-b border-zinc-200 pl-[26px] pr-4 py-3 dark:border-zinc-800">
              <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                {title}
              </h1>
            </header>
          )}

          <div className="flex items-center justify-between gap-2 pl-[26px] pr-4 py-3">
            {showAddTask ? (
              isAddingTask ? (
                <form
                  onSubmit={handleSubmit}
                  className="flex min-w-0 flex-1 mr-[40px]! items-center rounded-lg border border-[#c8d4f0] bg-white px-2 dark:border-zinc-600 dark:bg-zinc-900"
                >
                  <input
                    ref={newTaskInputRef}
                    type="text"
                    value={newTaskName}
                    onChange={(event) => setNewTaskName(event.target.value)}
                    placeholder="Task name"
                    aria-label="Task name"
                    className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm text-zinc-900 outline-none dark:text-zinc-50"
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        event.preventDefault();
                        cancelAddTask();
                      }
                    }}
                    onBlur={() => {
                      window.setTimeout(() => {
                        if (keepAddTaskOpenRef.current) return;
                        if (document.activeElement === newTaskInputRef.current) {
                          return;
                        }

                        if (!newTaskName.trim()) {
                          setIsAddingTask(false);
                        }
                      }, 0);
                    }}
                  />
                  <button
                    type="button"
                    aria-label="Clear task name"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      if (newTaskName.trim()) {
                        setNewTaskName("");
                        newTaskInputRef.current?.focus();
                        return;
                      }

                      cancelAddTask();
                    }}
                    className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-300"
                  >
                    <LuX className="size-4" aria-hidden="true" />
                  </button>
                  <button
                    type="submit"
                    onMouseDown={(event) => event.preventDefault()}
                    disabled={!newTaskName.trim()}
                    className="flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-md bg-zinc-400 px-[9px] text-xs font-medium text-white transition-colors enabled:hover:bg-zinc-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <LuCheck className="size-3.5" aria-hidden="true" />
                    Add
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAddingTask(true)}
                  className="flex h-[33px] items-center gap-2 rounded-lg bg-[#4873c7] pl-[13px] pr-[15px] text-sm font-medium text-white transition-colors cursor-pointer hover:bg-[#3f68bd]"
                >
                  <LuPlus className="size-4" aria-hidden="true" />
                  Add task
                </button>
              )
            ) : (
              <div className="flex-1" />
            )}

            <div className="relative shrink-0" ref={sortMenuRef}>
              <button
                type="button"
                aria-label="Sort tasks"
                aria-haspopup="menu"
                aria-expanded={isSortMenuOpen}
                onClick={() => setIsSortMenuOpen((open) => !open)}
                className="flex size-[31px] items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:border-zinc-500 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                <BiSortAlt2 className="size-[18px]" style={{ color: "#777777" }} />
              </button>

              {isSortMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-20 mt-1 min-w-[180px] overflow-hidden rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
                >
                  {SORT_OPTIONS.map((option) => (
                      <button
                        key={`${option.field}-${option.direction}`}
                        type="button"
                        role="menuitem"
                        onClick={() => applySort(option.field, option.direction)}
                        className="flex h-[35px] w-full items-center px-3 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800/80"
                      >
                        {option.label}
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>

          {showAddTask && pinnedVisibleTasks.length > 0 && (
            <div className="mb-2 border-b border-zinc-200 bg-zinc-50/40 dark:border-zinc-700 dark:bg-zinc-900/40">
              <p className="px-4 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-wide text-slate-300 dark:text-zinc-400">
                Pinned
              </p>
              <ul ref={pinnedListRef} className="relative flex flex-col">
                {dropIndicator?.section === "pinned" && (
                  <div
                    className="pointer-events-none absolute right-4 z-20 h-0.5 bg-blue-500"
                    style={{
                      top: dropIndicator.top,
                      left: 16 + dropIndicator.indent,
                    }}
                  />
                )}
                {renderTaskItems(pinnedVisibleTasks, "pinned")}
              </ul>
            </div>
          )}

          <ul
            ref={listRef}
            className={`relative flex flex-col ${
              showAddTask && pinnedVisibleTasks.length > 0
                ? "border-t border-zinc-200 dark:border-zinc-700"
                : ""
            }`}
          >
            {dropIndicator?.section === "unpinned" && (
              <div
                className="pointer-events-none absolute right-4 z-20 h-0.5 bg-blue-500"
                style={{
                  top: dropIndicator.top,
                  left: 16 + dropIndicator.indent,
                }}
              />
            )}

            {listTasks.length === 0 && pinnedVisibleTasks.length === 0 ? (
              <li className="pl-[33px] pr-4 py-3 text-sm text-zinc-500 dark:text-zinc-400">
                {title === "Today"
                  ? "No tasks for today"
                  // : title === "Next 7 days"
                  //   ? "No tasks in the next 7 days"
                  : title === "Bookmarks"
                    ? "No bookmarked tasks"
                    : title === "Calendar"
                      ? "No scheduled tasks"
                      : isLabelFilter
                        ? "No tasks with this label"
                        : "No tasks"}
              </li>
            ) : (
              renderTaskItems(
                canReorder ? unpinnedVisibleTasks : listTasks,
                "unpinned",
              )
            )}
          </ul>

          {showListCalendarButton ? (
            <div className="flex justify-end border-t border-zinc-200 px-4 py-2 dark:border-zinc-800">
              <button
                ref={listCalendarButtonRef}
                type="button"
                onMouseEnter={onListCalendarHoverStart}
                onMouseLeave={onListCalendarHoverLeave}
                aria-label={`Calendar - ${title}`}
                className="group flex items-center overflow-hidden rounded-lg bg-zinc-150 py-[4px] pl-[9px] pr-[9px] text-zinc-700 transition-[background-color,padding] hover:bg-zinc-250 cursor-pointer dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              >
                <LuCalendarCheck2 className="size-4 shrink-0" aria-hidden="true" />
                <span className="max-w-0 overflow-hidden whitespace-nowrap text-[12px] font-medium opacity-0 transition-[max-width,opacity,padding] duration-200 ease-out group-hover:max-w-[12rem] group-hover:pl-1.5 group-hover:opacity-100">
                  {title}
                </span>
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="p-4">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Select a list, Today, or Calendar to view tasks
          </p>
        </div>
      )}

      {pointerContextMenu && pointerMenuTask ? (
        <div ref={pointerContextMenuRef}>
          <TaskRowContextMenu
            task={pointerMenuTask}
            view={pointerContextMenu.view}
            lists={lists}
            currentListId={resolveTaskListId(pointerMenuTask)}
            moveQuery={moveQuery}
            availableLabels={availableLabels}
            assignedLabelIds={assignedLabelIds}
            labelQuery={labelQuery}
            isLabelSubmitting={isLabelSubmitting}
            fixedPosition={{
              x: pointerContextMenu.x,
              y: pointerContextMenu.y,
            }}
            onMoveQueryChange={setMoveQuery}
            onLabelQueryChange={setLabelQuery}
            onToggleLabelSelection={(labelId) =>
              handleToggleLabel(pointerMenuTask.id, labelId)
            }
            onCreateLabel={(label) => handleCreateLabel(pointerMenuTask.id, label)}
            onClose={closeTaskMenus}
            onStartTitleEdit={() => startTitleEdit(pointerMenuTask)}
            onToggleTaskPinned={() => handleToggleTaskPinned(pointerMenuTask)}
            onToggleTaskBookmarked={() =>
              handleToggleTaskBookmarked(pointerMenuTask)
            }
            onOpenLabelMenu={() => openLabelMenu(pointerMenuTask.id)}
            onOpenMoveMenu={() => openMoveMenu(pointerMenuTask.id)}
            onMoveTaskToList={(targetListId) =>
              handleMoveTaskToList(pointerMenuTask.id, targetListId)
            }
            onClearTaskDueDate={() =>
              handleClearTaskDueDate(pointerMenuTask.id)
            }
            onSelectTaskPriority={(priority) =>
              handleSelectTaskPriority(pointerMenuTask.id, priority)
            }
            onClearTaskPriority={() =>
              handleClearTaskPriority(pointerMenuTask.id)
            }
            onConfirmLabels={handleConfirmLabels}
            hasDueDateActions={Boolean(onSetTaskDueDate)}
            hasPriorityActions={Boolean(onSetTaskPriority)}
            hasPinActions={Boolean(onSetTaskPinned)}
            hasBookmarkActions={Boolean(onSetTaskBookmarked)}
            hasLabelActions={Boolean(onToggleTaskLabel)}
            hasMoveActions={Boolean(onMoveTaskToList) && lists.length > 1}
          />
        </div>
      ) : null}
    </section>
  );
}
