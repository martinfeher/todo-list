"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { BiCalendar, BiSortAlt2 } from "react-icons/bi";
import { InteractIcon } from "./line-control-icons";
import { TaskDatePicker } from "./task-date-picker";
import { ThreeDotsIcon } from "./three-dots-icon";
import type { TaskListItem } from "./todo-app";
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
};

type TaskDragState = {
  sourceRow: HTMLElement;
  captureTarget: HTMLElement;
  sourceIndex: number;
  dropIndex: number;
  taskIds: string[];
  pointerId: number;
};

const SORT_OPTIONS: SortOption[] = [
  { field: "date", direction: "asc", label: "Date (ascending)" },
  { field: "date", direction: "desc", label: "Date (descending)" },
  { field: "title", direction: "asc", label: "Title (A-Z)" },
  { field: "title", direction: "desc", label: "Title (Z-A)" },
];

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

type TaskListPanelProps = {
  title: string | null;
  tasks: TaskListItem[];
  selectedTaskId: string | null;
  expanded?: boolean;
  showAddTask?: boolean;
  listId?: string | null;
  onAddTask: (name: string) => void;
  onToggleTask: (taskId: string) => void;
  onSelectTask: (taskId: string) => void;
  onRenameTask: (taskId: string, name: string) => void;
  onReorderTasks?: (listId: string, taskIds: string[]) => void;
  onSetTaskDueDate?: (taskId: string, dateValue: string | null) => void;
  onSetTaskDueTime?: (taskId: string, dueTime: TaskDueTime) => void;
  onSetTaskPriority?: (taskId: string, priority: number | null) => void;
};

export function TaskListPanel({
  title,
  tasks,
  selectedTaskId,
  expanded = false,
  showAddTask = false,
  listId = null,
  onAddTask,
  onToggleTask,
  onSelectTask,
  onRenameTask,
  onReorderTasks,
  onSetTaskDueDate,
  onSetTaskDueTime,
  onSetTaskPriority,
}: TaskListPanelProps) {
  const [newTaskName, setNewTaskName] = useState("");
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
  const [dropIndicator, setDropIndicator] = useState<DropIndicatorState | null>(
    null,
  );
  const titleInputRef = useRef<HTMLInputElement>(null);
  const titleEditReadyRef = useRef(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const taskDateMenuRef = useRef<HTMLDivElement>(null);
  const taskContextMenuRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const dragStateRef = useRef<TaskDragState | null>(null);

  const canReorder = showAddTask && Boolean(listId && onReorderTasks);

  useEffect(() => {
    setOrderedTasks(tasks);
  }, [tasks]);

  useEffect(() => {
    setEditingTaskId(null);
    setTitleDraft("");
    setOpenDatePickerTaskId(null);
    setOpenMenuTaskId(null);
    setOpenPriorityMenuTaskId(null);
  }, [title]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;

      if (taskDateMenuRef.current?.contains(target)) return;
      if (taskContextMenuRef.current?.contains(target)) return;

      setOpenDatePickerTaskId(null);
      setOpenMenuTaskId(null);
      setOpenPriorityMenuTaskId(null);
    }

    if (!openDatePickerTaskId && !openMenuTaskId && !openPriorityMenuTaskId) return;

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openDatePickerTaskId, openMenuTaskId, openPriorityMenuTaskId]);

  useEffect(() => {
    if (!editingTaskId) {
      titleEditReadyRef.current = false;
      return;
    }

    requestAnimationFrame(() => {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onAddTask(newTaskName);
    setNewTaskName("");
  }

  function startTitleEdit(task: TaskListItem) {
    setEditingTaskId(task.id);
    setTitleDraft(task.name);
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
    const sorted = sortTasks(orderedTasks, field, direction);
    setOrderedTasks(sorted);

    if (listId && onReorderTasks) {
      onReorderTasks(
        listId,
        sorted.map((task) => task.id),
      );
    }

    setIsSortMenuOpen(false);
  }

  function toggleDatePicker(taskId: string) {
    setOpenMenuTaskId(null);
    setOpenPriorityMenuTaskId(null);
    setOpenDatePickerTaskId((current) => (current === taskId ? null : taskId));
  }

  function toggleTaskMenu(taskId: string) {
    setOpenDatePickerTaskId(null);
    setOpenPriorityMenuTaskId(null);
    setOpenMenuTaskId((current) => (current === taskId ? null : taskId));
  }

  function openPriorityMenu(taskId: string) {
    setOpenMenuTaskId(null);
    setOpenPriorityMenuTaskId(taskId);
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
    setOpenMenuTaskId(null);
  }

  function handleSelectTaskPriority(taskId: string, priority: number) {
    onSetTaskPriority?.(taskId, priority);
    setOpenPriorityMenuTaskId(null);
  }

  function handleClearTaskPriority(taskId: string) {
    onSetTaskPriority?.(taskId, null);
    setOpenPriorityMenuTaskId(null);
  }

  function handleDragMove(event: PointerEvent) {
    const list = listRef.current;
    const dragState = dragStateRef.current;

    if (!list || !dragState) return;

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

    setDropIndicator({ top: indicatorTop });
  }

  function handleDragEnd() {
    const dragState = dragStateRef.current;

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
        onReorderTasks(listId, nextIds);
      }
    }

    dragStateRef.current = null;
  }

  function handleTaskDragStart(
    event: React.PointerEvent<HTMLButtonElement>,
    taskId: string,
  ) {
    event.preventDefault();
    event.stopPropagation();

    const list = listRef.current;
    if (!list || !canReorder) return;

    const rows = getTaskRowElements(list);
    const sourceRow = rows.find((row) => row.dataset.taskId === taskId);
    if (!sourceRow) return;

    const sourceIndex = rows.indexOf(sourceRow);
    if (sourceIndex < 0) return;

    const taskIds = orderedTasks.map((task) => task.id);

    dragStateRef.current = {
      sourceRow,
      captureTarget: event.currentTarget,
      sourceIndex,
      dropIndex: sourceIndex,
      taskIds,
      pointerId: event.pointerId,
    };

    sourceRow.classList.add("opacity-50");
    event.currentTarget.setPointerCapture(event.pointerId);
    document.body.style.cursor = "grabbing";
    document.addEventListener("pointermove", handleDragMove);
    document.addEventListener("pointerup", handleDragEnd);
    document.addEventListener("pointercancel", handleDragEnd);
  }

  return (
    <section
      className={`w-full shrink-0 border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 max-w-[350px]`}
    >
      {title ? (
        <div className="flex flex-col">
          <header className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              {title}
            </h1>
          </header>

          <div className="flex items-center gap-2 px-4 py-3">
            {showAddTask ? (
              <form onSubmit={handleSubmit} className="min-w-0 flex-1">
                <input
                  type="text"
                  value={newTaskName}
                  onChange={(event) => setNewTaskName(event.target.value)}
                  placeholder="Add New Task"
                  className="h-[35px] w-full rounded-[7px] border border-zinc-300 bg-white px-3 text-sm text-zinc-900 max-w-[230px] outline-none focus:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-500"
                />
              </form>
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

          <ul ref={listRef} className="relative flex flex-col">
            {dropIndicator && (
              <div
                className="pointer-events-none absolute right-4 left-4 z-20 h-0.5 bg-blue-500"
                style={{ top: dropIndicator.top }}
              />
            )}

            {orderedTasks.length === 0 ? (
              <li className="px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400">
                {title === "Today" ? "No tasks for today" : "No tasks"}
              </li>
            ) : (
              orderedTasks.map((task) => {
                const dueDateLabel = formatTaskDueDateLabel(task.dueDate);
                const isRowMenuOpen =
                  openDatePickerTaskId === task.id ||
                  openMenuTaskId === task.id ||
                  openPriorityMenuTaskId === task.id;

                return (
                  <li
                    key={task.id}
                    data-task-id={task.id}
                    onClick={() =>onSelectTask(task.id)}
                    className={`group flex min-h-[35px] items-center gap-2 border-b border-zinc-100 px-2 py-1 dark:border-zinc-900 cursor-pointer! ${
                      task.id === selectedTaskId
                        ? "bg-zinc-100 dark:bg-zinc-900"
                        : ""
                    }`}
                  >
                    {canReorder ? (
                      <button
                        type="button"
                        aria-label="Drag task"
                        title="Drag to reorder task"
                        className="pointer-events-none flex size-[19px] shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-zinc-500 opacity-0 transition-opacity hover:border-zinc-300 hover:text-zinc-700 active:cursor-grabbing group-hover:pointer-events-auto group-hover:opacity-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                        onPointerDown={(event) =>
                          handleTaskDragStart(event, task.id)
                        }
                        onClick={(event) => event.stopPropagation()}
                      >
                        <InteractIcon className="size-3.5 text-[#949494]" />
                      </button>
                    ) : null}

                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={() => onToggleTask(task.id)}
                      onClick={(event) => event.stopPropagation()}
                      className="size-4 shrink-0 accent-zinc-900 dark:accent-zinc-50"
                    />

                    {editingTaskId === task.id ? (
                      <input
                        ref={titleInputRef}
                        type="text"
                        value={titleDraft}
                        onChange={(event) => setTitleDraft(event.target.value)}
                        onBlur={() => {
                          if (!titleEditReadyRef.current) return;
                          commitTitleEdit(task);
                        }}
                        onKeyDown={(event) => handleTitleKeyDown(event, task)}
                        className="min-w-0 flex-1 rounded border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                      />
                    ) : (
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => onSelectTask(task.id)}
                          onDoubleClick={(event) => {
                            event.preventDefault();
                            startTitleEdit(task);
                          }}
                          className="block w-full truncate text-left text-sm text-zinc-900 dark:text-zinc-50"
                        >
                          {task.name}
                        </button>
                        {task.listName && (
                          <span className="block truncate text-xs text-zinc-400 dark:text-zinc-500">
                            {task.listName}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="relative flex h-7 shrink-0 items-center justify-end">
                      {dueDateLabel ? (
                        <span
                          className={`text-xs text-zinc-400 transition-opacity dark:text-zinc-500 ${
                            isRowMenuOpen
                              ? "opacity-0"
                              : "group-hover:opacity-0"
                          }`}
                        >
                          {dueDateLabel}
                        </span>
                      ) : null}

                      <div
                        className={`flex items-center gap-0.5 transition-opacity ${
                          dueDateLabel ? "absolute right-0" : ""
                        } ${
                          isRowMenuOpen
                            ? "pointer-events-auto opacity-100"
                            : "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100"
                        }`}
                      >
                      {onSetTaskDueDate ? (
                        <div
                          className="relative"
                          ref={
                            openDatePickerTaskId === task.id
                              ? taskDateMenuRef
                              : null
                          }
                        >
                          <button
                            type="button"
                            aria-label={
                              dueDateLabel
                                ? `Due ${dueDateLabel}. Change date`
                                : "Set task date"
                            }
                            aria-haspopup="dialog"
                            aria-expanded={openDatePickerTaskId === task.id}
                            title={
                              dueDateLabel ? `Due: ${dueDateLabel}` : "Set date"
                            }
                            className={`flex w-[20px] h-[24px] items-center justify-center rounded-md text-zinc-400 transition-colors cursor-pointer hover:bg-zinc-200/80 hover:text-zinc-500 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 ${
                              task.dueDate
                                ? "text-zinc-400 dark:text-zinc-300"
                                : ""
                            }`}
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleDatePicker(task.id);
                            }}
                          >
                            <BiCalendar className="size-4" />
                          </button>

                          {openDatePickerTaskId === task.id && (
                            <div className="absolute right-0 top-full z-30 mt-1">
                              <TaskDatePicker
                                dueDate={task.dueDate}
                                dueTimeMinutes={task.dueTimeMinutes}
                                dueDurationMinutes={task.dueDurationMinutes}
                                dueTimeZone={task.dueTimeZone}
                                onSelectDate={(dateValue) =>
                                  handleSelectTaskDueDate(task.id, dateValue)
                                }
                                onSaveDueTime={(dueTime) =>
                                  handleSaveTaskDueTime(task.id, dueTime)
                                }
                              />
                            </div>
                          )}
                        </div>
                      ) : null}

                      <div
                        className="relative"
                        ref={
                          openMenuTaskId === task.id ||
                          openPriorityMenuTaskId === task.id
                            ? taskContextMenuRef
                            : null
                        }
                      >
                        <button
                          type="button"
                          aria-label={`Open menu for ${task.name}`}
                          aria-haspopup="menu"
                          aria-expanded={
                            openMenuTaskId === task.id ||
                            openPriorityMenuTaskId === task.id
                          }
                          title="More options"
                          className="flex w-[20px] h-[24px] items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-200/80 hover:text-zinc-500 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleTaskMenu(task.id);
                          }}
                        >
                          <ThreeDotsIcon className="size-4" />
                        </button>

                        {openMenuTaskId === task.id && (
                          <div
                            role="menu"
                            className="absolute right-0 top-full z-30 mt-1 w-36 overflow-hidden rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
                          >
                            <button
                              type="button"
                              role="menuitem"
                              className="flex h-[35px] w-full items-center px-3 text-left text-sm text-zinc-900 hover:bg-zinc-100 dark:text-zinc-50 dark:hover:bg-zinc-800"
                              onClick={(event) => {
                                event.stopPropagation();
                                setOpenMenuTaskId(null);
                                startTitleEdit(task);
                              }}
                            >
                              Rename
                            </button>
                            {onSetTaskPriority ? (
                              <button
                                type="button"
                                role="menuitem"
                                className="flex h-[35px] w-full items-center px-3 text-left text-sm text-zinc-900 hover:bg-zinc-100 dark:text-zinc-50 dark:hover:bg-zinc-800"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openPriorityMenu(task.id);
                                }}
                              >
                                Add priority
                              </button>
                            ) : null}
                            {task.dueDate && onSetTaskDueDate ? (
                              <button
                                type="button"
                                role="menuitem"
                                className="flex h-[35px] w-full items-center px-3 text-left text-sm text-zinc-900 hover:bg-zinc-100 dark:text-zinc-50 dark:hover:bg-zinc-800"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleClearTaskDueDate(task.id);
                                }}
                              >
                                Clear date
                              </button>
                            ) : null}
                          </div>
                        )}

                        {openPriorityMenuTaskId === task.id && (
                          <div
                            role="menu"
                            className="absolute right-0 top-full z-30 mt-1 w-36 overflow-hidden rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
                          >
                            {[1, 2, 3, 4].map((priority) => (
                              <button
                                key={priority}
                                type="button"
                                role="menuitem"
                                className={`flex h-[35px] w-full items-center px-3 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                                  task.priority === priority
                                    ? "font-medium text-zinc-900 dark:text-zinc-50"
                                    : "text-zinc-900 dark:text-zinc-50"
                                }`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleSelectTaskPriority(task.id, priority);
                                }}
                              >
                                Priority {priority}
                              </button>
                            ))}
                            {task.priority ? (
                              <button
                                type="button"
                                role="menuitem"
                                className="flex h-[35px] w-full items-center px-3 text-left text-sm text-zinc-900 hover:bg-zinc-100 dark:text-zinc-50 dark:hover:bg-zinc-800"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleClearTaskPriority(task.id);
                                }}
                              >
                                Clear priority
                              </button>
                            ) : null}
                          </div>
                        )}
                      </div>
                      </div>
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : (
        <div className="p-4">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Select a list or Today to view tasks
          </p>
        </div>
      )}
    </section>
  );
}
