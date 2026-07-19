"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { BiSortAlt2 } from "react-icons/bi";
import type { TaskListItem } from "./todo-app";

type SortField = "date" | "title";
type SortDirection = "asc" | "desc";

type SortOption = {
  field: SortField;
  direction: SortDirection;
  label: string;
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
  onAddTask: (name: string) => void;
  onToggleTask: (taskId: string) => void;
  onSelectTask: (taskId: string) => void;
  onRenameTask: (taskId: string, name: string) => void;
};

export function TaskListPanel({
  title,
  tasks,
  selectedTaskId,
  expanded = false,
  showAddTask = false,
  onAddTask,
  onToggleTask,
  onSelectTask,
  onRenameTask,
}: TaskListPanelProps) {
  const [newTaskName, setNewTaskName] = useState("");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const titleEditReadyRef = useRef(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  const sortedTasks = useMemo(
    () => sortTasks(tasks, sortField, sortDirection),
    [tasks, sortField, sortDirection],
  );

  useEffect(() => {
    setEditingTaskId(null);
    setTitleDraft("");
  }, [title]);

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
    setSortField(field);
    setSortDirection(direction);
    setIsSortMenuOpen(false);
  }

  return (
    <section
      className={`w-full shrink-0 border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 max-w-[350px] ${
        expanded ? "min-w-0 flex-1" : "max-w-[380px]"
      }`}
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
                  className="h-[35px] w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-500"
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
                className="flex size-[35px] items-center justify-center rounded-md border border-zinc-300 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                <BiSortAlt2 className="size-5 text-[#606060]" />
              </button>

              {isSortMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-20 mt-1 min-w-[180px] overflow-hidden rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
                >
                  {SORT_OPTIONS.map((option) => {
                    const isActive =
                      sortField === option.field &&
                      sortDirection === option.direction;

                    return (
                      <button
                        key={`${option.field}-${option.direction}`}
                        type="button"
                        role="menuitem"
                        onClick={() => applySort(option.field, option.direction)}
                        className={`flex h-[35px] w-full items-center px-3 text-left text-sm transition-colors ${
                          isActive
                            ? "bg-zinc-100 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                            : "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800/80"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <ul className="flex flex-col">
            {sortedTasks.length === 0 ? (
              <li className="px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400">
                {title === "Today" ? "No tasks for today" : "No tasks"}
              </li>
            ) : (
            sortedTasks.map((task) => {
              const dueDateLabel = formatTaskDueDateLabel(task.dueDate);

              return (
              <li
                key={task.id}
                className={`flex min-h-[35px] items-center gap-3 border-b border-zinc-100 px-4 py-1 dark:border-zinc-900 cursor-pointer ${
                  task.id === selectedTaskId
                    ? "bg-zinc-100 dark:bg-zinc-900"
                    : ""
                }`}
              >
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
                {dueDateLabel && (
                  <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
                    {dueDateLabel}
                  </span>
                )}
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
