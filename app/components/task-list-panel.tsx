"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { BiSortAlt2 } from "react-icons/bi";
import { LuPlus } from "react-icons/lu";
import { createLabelTag, getLabelTags } from "@/app/actions/todo";
import { TaskListTaskRow } from "./task-list-task-row";
import type { LabelTag } from "./task-tag-selector";
import {
  TaskRowContextMenu,
  type TaskRowContextMenuView,
} from "./task-row-context-menu";
import type { TaskListItem, TodoList } from "./todo-app";
import type { TaskDueTime } from "@/lib/task-due-time";
import {
  getTaskDropIndex,
  getTaskRowElements,
  reorderTaskIds,
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
};

type TaskDragState = {
  sourceRow: HTMLElement;
  captureTarget: HTMLElement;
  sourceIndex: number;
  dropIndex: number;
  taskIds: string[];
  pointerId: number;
  section: "pinned" | "unpinned";
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
  isTagFilter?: boolean;
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
  ) => void;
  onSetTaskDueDate?: (taskId: string, dateValue: string | null) => void;
  onSetTaskDueTime?: (taskId: string, dueTime: TaskDueTime) => void;
  onSetTaskPriority?: (taskId: string, priority: number | null) => void;
  onSetTaskPinned?: (taskId: string, pinned: boolean) => void;
  onToggleTaskLabelTag?: (
    taskId: string,
    tagId: string,
    assigned: boolean,
  ) => Promise<{ id: string; label: string }[]>;
  onLabelTagsChanged?: () => void;
  onMoveTaskToList?: (
    taskId: string,
    sourceListId: string,
    targetListId: string,
  ) => void;
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
  isTagFilter = false,
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
  onToggleTaskLabelTag,
  onLabelTagsChanged,
  onMoveTaskToList,
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
  const [openPriorityMenuTaskId, setOpenPriorityMenuTaskId] = useState<
    string | null
  >(null);
  const [openTagMenuTaskId, setOpenTagMenuTaskId] = useState<string | null>(
    null,
  );
  const [openMoveMenuTaskId, setOpenMoveMenuTaskId] = useState<string | null>(
    null,
  );
  const [moveQuery, setMoveQuery] = useState("");
  const [availableTags, setAvailableTags] = useState<LabelTag[]>([]);
  const [assignedTagIds, setAssignedTagIds] = useState<string[]>([]);
  const [tagQuery, setTagQuery] = useState("");
  const [isTagSubmitting, setIsTagSubmitting] = useState(false);
  const [pointerContextMenu, setPointerContextMenu] =
    useState<PointerContextMenuState | null>(null);
  const [dropIndicator, setDropIndicator] = useState<DropIndicatorState | null>(
    null,
  );

  const activeTagMenuTaskId =
    openTagMenuTaskId ??
    (pointerContextMenu?.view === "tag" ? pointerContextMenu.taskId : null);

  useEffect(() => {
    if (!activeTagMenuTaskId) return;

    let cancelled = false;

    void getLabelTags()
      .then((tags) => {
        if (!cancelled) {
          setAvailableTags(tags);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAvailableTags([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeTagMenuTaskId]);

  useEffect(() => {
    if (!activeTagMenuTaskId) return;

    const task = orderedTasks.find((item) => item.id === activeTagMenuTaskId);
    if (!task) return;

    setAssignedTagIds(task.tags.map((tag) => tag.id));
  }, [activeTagMenuTaskId, orderedTasks]);
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
    setOpenPriorityMenuTaskId(null);
    setOpenTagMenuTaskId(null);
    setOpenMoveMenuTaskId(null);
    resetTagMenuState();
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
      setOpenPriorityMenuTaskId(null);
      setOpenTagMenuTaskId(null);
      setOpenMoveMenuTaskId(null);
      resetTagMenuState();
      resetMoveMenuState();
      setPointerContextMenu(null);
    }

    if (
      !openDatePickerTaskId &&
      !openMenuTaskId &&
      !openPriorityMenuTaskId &&
      !openTagMenuTaskId &&
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
    openPriorityMenuTaskId,
    openTagMenuTaskId,
    openMoveMenuTaskId,
    pointerContextMenu,
  ]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;

      setOpenMenuTaskId(null);
      setOpenPriorityMenuTaskId(null);
      setOpenTagMenuTaskId(null);
      setOpenMoveMenuTaskId(null);
      resetTagMenuState();
      resetMoveMenuState();
      setPointerContextMenu(null);
    }

    if (
      !openMenuTaskId &&
      !openPriorityMenuTaskId &&
      !openTagMenuTaskId &&
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
    openPriorityMenuTaskId,
    openTagMenuTaskId,
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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newTaskName.trim()) {
      setIsAddingTask(false);
      setNewTaskName("");
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

  function resetTagMenuState() {
    setAssignedTagIds([]);
    setTagQuery("");
    setIsTagSubmitting(false);
  }

  function resetMoveMenuState() {
    setMoveQuery("");
  }

  function resolveTaskListId(task: TaskListItem): string | null {
    return task.listId ?? listId ?? null;
  }

  function initTagMenuForTask(taskId: string) {
    const task = orderedTasks.find((item) => item.id === taskId);
    setAssignedTagIds(task?.tags.map((tag) => tag.id) ?? []);
    setTagQuery("");
    setIsTagSubmitting(false);
  }

  function closeTaskMenus() {
    setOpenMenuTaskId(null);
    setOpenPriorityMenuTaskId(null);
    setOpenTagMenuTaskId(null);
    setOpenMoveMenuTaskId(null);
    resetTagMenuState();
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
    setOpenPriorityMenuTaskId(null);
    setOpenTagMenuTaskId(null);
    setOpenMoveMenuTaskId(null);
    resetTagMenuState();
    resetMoveMenuState();
    setOpenMenuTaskId((current) => (current === taskId ? null : taskId));
  }

  function openPriorityMenu(taskId: string) {
    setOpenMenuTaskId(null);
    setOpenTagMenuTaskId(null);
    setOpenMoveMenuTaskId(null);
    resetTagMenuState();
    resetMoveMenuState();
    if (pointerContextMenu?.taskId === taskId) {
      setPointerContextMenu({ ...pointerContextMenu, view: "priority" });
      return;
    }

    setPointerContextMenu(null);
    setOpenPriorityMenuTaskId(taskId);
  }

  function openTagMenu(taskId: string) {
    setOpenMenuTaskId(null);
    setOpenPriorityMenuTaskId(null);
    setOpenMoveMenuTaskId(null);
    resetMoveMenuState();
    initTagMenuForTask(taskId);
    if (pointerContextMenu?.taskId === taskId) {
      setPointerContextMenu({ ...pointerContextMenu, view: "tag" });
      return;
    }

    setPointerContextMenu(null);
    setOpenTagMenuTaskId(taskId);
  }

  function openMoveMenu(taskId: string) {
    setOpenMenuTaskId(null);
    setOpenPriorityMenuTaskId(null);
    setOpenTagMenuTaskId(null);
    resetTagMenuState();
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

  async function handleToggleTag(taskId: string, tagId: string) {
    if (!onToggleTaskLabelTag) return;

    const isAssigned = assignedTagIds.includes(tagId);
    setIsTagSubmitting(true);

    try {
      const updatedTags = await onToggleTaskLabelTag(taskId, tagId, !isAssigned);
      setAssignedTagIds(updatedTags.map((tag) => tag.id));
    } catch {
      return;
    } finally {
      setIsTagSubmitting(false);
    }
  }

  async function handleCreateTag(taskId: string, label: string) {
    const trimmed = label.trim();
    if (!trimmed) return;

    setIsTagSubmitting(true);

    try {
      const tag = await createLabelTag(trimmed);
      setAvailableTags((current) => {
        if (current.some((item) => item.id === tag.id)) {
          return current;
        }

        return [...current, tag].sort((a, b) =>
          a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
        );
      });

      if (onToggleTaskLabelTag) {
        const updatedTags = await onToggleTaskLabelTag(taskId, tag.id, true);
        setAssignedTagIds(updatedTags.map((item) => item.id));
      } else {
        setAssignedTagIds((current) =>
          current.includes(tag.id) ? current : [...current, tag.id],
        );
      }

      setTagQuery("");
      onLabelTagsChanged?.();
    } catch {
      return;
    } finally {
      setIsTagSubmitting(false);
    }
  }

  function handleConfirmTags() {
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
    setOpenPriorityMenuTaskId(null);
    setOpenTagMenuTaskId(null);
    setOpenMoveMenuTaskId(null);
    resetTagMenuState();
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
    const dropIndex = getTaskDropIndex(
      event.clientY,
      rows,
      dragState.sourceIndex,
    );
    dragState.dropIndex = dropIndex;

    const listRect = list.getBoundingClientRect();
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

    setDropIndicator({ top: indicatorTop, section: dragState.section });
  }

  function beginTaskDrag(
    sourceRow: HTMLElement,
    pointerId: number,
    sourceIndex: number,
    taskIds: string[],
    section: "pinned" | "unpinned",
  ) {
    dragStateRef.current = {
      sourceRow,
      captureTarget: sourceRow,
      sourceIndex,
      dropIndex: sourceIndex,
      taskIds,
      pointerId,
      section,
    };

    sourceRow.classList.add("opacity-50");
    sourceRow.setPointerCapture(pointerId);
    document.body.style.cursor = "grabbing";
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
    }

    setDropIndicator(null);

    if (dragState && listId && onReorderTasks) {
      const nextIds = reorderTaskIds(
        dragState.taskIds,
        dragState.sourceIndex,
        dragState.dropIndex,
      );

      if (nextIds.join(",") !== dragState.taskIds.join(",")) {
        onReorderTasks(listId, nextIds, dragState.section);
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

    const taskIds =
      section === "pinned"
        ? pinnedTasks.map((task) => task.id)
        : listTasks.map((task) => task.id);

    const startX = event.clientX;
    const startY = event.clientY;
    const pointerId = event.pointerId;
    let dragStarted = false;

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
      beginTaskDrag(dragRow, pointerId, sourceIndex, taskIds, section);
    }

    function onPointerUp(upEvent: PointerEvent) {
      if (upEvent.pointerId !== pointerId) return;
      clearPendingListeners();
    }

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerUp);
  }

  function renderTaskItems(
    taskItems: TaskListItem[],
    section: "pinned" | "unpinned",
  ) {
    const hasTagActions = Boolean(onToggleTaskLabelTag);
    const hasMoveActions = Boolean(onMoveTaskToList) && lists.length > 1;

    return taskItems.map((task) => (
      <TaskListTaskRow
        key={task.id}
        task={task}
        isCompleting={completingTaskIds.has(task.id)}
        selectedTaskId={selectedTaskId}
        editingTaskId={editingTaskId}
        titleDraft={titleDraft}
        titleInputRef={titleInputRef}
        showDragHandle={canReorder}
        openDatePickerTaskId={openDatePickerTaskId}
        openMenuTaskId={openMenuTaskId}
        openPriorityMenuTaskId={openPriorityMenuTaskId}
        openTagMenuTaskId={openTagMenuTaskId}
        openMoveMenuTaskId={openMoveMenuTaskId}
        lists={lists}
        currentListId={resolveTaskListId(task)}
        moveQuery={moveQuery}
        availableTags={availableTags}
        assignedTagIds={assignedTagIds}
        tagQuery={tagQuery}
        isTagSubmitting={isTagSubmitting}
        taskDateMenuRef={taskDateMenuRef}
        taskContextMenuRef={taskContextMenuRef}
        dueDateLabel={formatTaskDueDateLabel(task.dueDate)}
        onTaskClick={handleTaskClick}
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
        onOpenPriorityMenu={openPriorityMenu}
        onOpenTagMenu={openTagMenu}
        onOpenMoveMenu={openMoveMenu}
        onMoveQueryChange={setMoveQuery}
        onMoveTaskToList={handleMoveTaskToList}
        onTagQueryChange={setTagQuery}
        onToggleTag={(tagId) => handleToggleTag(task.id, tagId)}
        onCreateTag={(label) => handleCreateTag(task.id, label)}
        onClearTaskDueDate={handleClearTaskDueDate}
        onSelectTaskPriority={handleSelectTaskPriority}
        onClearTaskPriority={handleClearTaskPriority}
        onConfirmTags={handleConfirmTags}
        onCloseTaskMenu={closeTaskMenus}
        hasDueDateActions={Boolean(onSetTaskDueDate)}
        hasPriorityActions={Boolean(onSetTaskPriority)}
        hasPinActions={Boolean(onSetTaskPinned)}
        hasTagActions={hasTagActions}
        hasMoveActions={hasMoveActions}
      />
    ));
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
            <header className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                {title}
              </h1>
            </header>
          )}

          <div className="flex items-center justify-between gap-2 px-4 py-3">
            {showAddTask ? (
              isAddingTask ? (
                <form onSubmit={handleSubmit} className="min-w-0 flex-1">
                  <input
                    ref={newTaskInputRef}
                    type="text"
                    value={newTaskName}
                    onChange={(event) => setNewTaskName(event.target.value)}
                    placeholder={`+ Add Task to - ${title}`}
                    aria-label={`+ Add Task to - ${title}`}
                    className="h-[35px] w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 max-w-[190px] outline-none focus:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-500"
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        event.preventDefault();
                        setIsAddingTask(false);
                        setNewTaskName("");
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

          {showAddTask && pinnedTasks.length > 0 && (
            <div className="border-b border-zinc-200 bg-zinc-50/80 dark:border-zinc-700 dark:bg-zinc-900/40">
              <p className="px-4 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Pinned
              </p>
              <ul ref={pinnedListRef} className="relative flex flex-col">
                {dropIndicator?.section === "pinned" && (
                  <div
                    className="pointer-events-none absolute right-4 left-4 z-20 h-0.5 bg-blue-500"
                    style={{ top: dropIndicator.top }}
                  />
                )}
                {renderTaskItems(pinnedTasks, "pinned")}
              </ul>
            </div>
          )}

          <ul
            ref={listRef}
            className={`relative flex flex-col ${
              showAddTask && pinnedTasks.length > 0
                ? "border-t border-zinc-200 dark:border-zinc-700"
                : ""
            }`}
          >
            {dropIndicator?.section === "unpinned" && (
              <div
                className="pointer-events-none absolute right-4 left-4 z-20 h-0.5 bg-blue-500"
                style={{ top: dropIndicator.top }}
              />
            )}

            {listTasks.length === 0 && pinnedTasks.length === 0 ? (
              <li className="px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400">
                {title === "Today"
                  ? "No tasks for today"
                  : title === "Next 7 days"
                    ? "No tasks in the next 7 days"
                    : title === "Calendar"
                      ? "No scheduled tasks"
                      : isTagFilter
                        ? "No tasks with this tag"
                        : "No tasks"}
              </li>
            ) : (
              renderTaskItems(listTasks, "unpinned")
            )}
          </ul>
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
            availableTags={availableTags}
            assignedTagIds={assignedTagIds}
            tagQuery={tagQuery}
            isTagSubmitting={isTagSubmitting}
            fixedPosition={{
              x: pointerContextMenu.x,
              y: pointerContextMenu.y,
            }}
            onMoveQueryChange={setMoveQuery}
            onTagQueryChange={setTagQuery}
            onToggleTagSelection={(tagId) =>
              handleToggleTag(pointerMenuTask.id, tagId)
            }
            onCreateTag={(label) => handleCreateTag(pointerMenuTask.id, label)}
            onClose={closeTaskMenus}
            onStartTitleEdit={() => startTitleEdit(pointerMenuTask)}
            onToggleTaskPinned={() => handleToggleTaskPinned(pointerMenuTask)}
            onOpenPriorityMenu={() => openPriorityMenu(pointerMenuTask.id)}
            onOpenTagMenu={() => openTagMenu(pointerMenuTask.id)}
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
            onConfirmTags={handleConfirmTags}
            hasDueDateActions={Boolean(onSetTaskDueDate)}
            hasPriorityActions={Boolean(onSetTaskPriority)}
            hasPinActions={Boolean(onSetTaskPinned)}
            hasTagActions={Boolean(onToggleTaskLabelTag)}
            hasMoveActions={Boolean(onMoveTaskToList) && lists.length > 1}
          />
        </div>
      ) : null}
    </section>
  );
}
