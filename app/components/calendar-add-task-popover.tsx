"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { BiListUl } from "react-icons/bi";
import { LuCheck, LuX } from "react-icons/lu";
import { TaskMoveToSelector } from "./task-move-to-selector";
import type { TodoList } from "./todo-app";

type CalendarAddTaskPopoverProps = {
  date: Date;
  dueTimeMinutes?: number | null;
  lists: TodoList[];
  defaultListId: string | null;
  x: number;
  y: number;
  name: string;
  onNameChange: (name: string) => void;
  onClose: () => void;
  onAddTask: (payload: {
    name: string;
    dueDate: string;
    details: string;
    listId: string;
    dueTimeMinutes?: number | null;
  }) => void | Promise<void>;
};

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatPopoverDate(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatPopoverDateTime(date: Date, dueTimeMinutes: number | null) {
  const today = new Date();
  const isToday =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
  const dayLabel = isToday
    ? "Today"
    : new Intl.DateTimeFormat(undefined, {
        weekday: "short",
      }).format(date);
  const dateLabel = new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
  }).format(date);

  if (dueTimeMinutes === null || dueTimeMinutes === undefined) {
    return `${dayLabel}, ${dateLabel}`;
  }

  const hours = Math.floor(dueTimeMinutes / 60);
  const minutes = dueTimeMinutes % 60;
  const timeLabel = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;

  return `${dayLabel}, ${dateLabel}, ${timeLabel}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function plainTextToTaskDetails(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return "";

  return trimmed
    .split("\n")
    .map(
      (line) =>
        `<div class="detail-line" data-line-type="text">${line ? escapeHtml(line) : "<br>"}</div>`,
    )
    .join("");
}

export function CalendarAddTaskPopover({
  date,
  dueTimeMinutes = null,
  lists,
  defaultListId,
  x,
  y,
  name,
  onNameChange,
  onClose,
  onAddTask,
}: CalendarAddTaskPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const listButtonRef = useRef<HTMLButtonElement>(null);
  const listMenuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x, top: y + 8 });
  const [content, setContent] = useState("");
  const [selectedListId, setSelectedListId] = useState(
    () => defaultListId ?? lists[0]?.id ?? null,
  );
  const [isListMenuOpen, setIsListMenuOpen] = useState(false);
  const [listQuery, setListQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const dueDate = toDateKey(date);
  const heading = formatPopoverDateTime(date, dueTimeMinutes);
  const selectedList =
    lists.find((list) => list.id === selectedListId) ?? lists[0] ?? null;

  useLayoutEffect(() => {
    const popover = popoverRef.current;
    if (!popover) return;

    const rect = popover.getBoundingClientRect();
    const padding = 12;

    let left = x;
    let top = y + 8;

    if (left + rect.width > window.innerWidth - padding) {
      left = window.innerWidth - rect.width - padding;
    }

    if (top + rect.height > window.innerHeight - padding) {
      top = Math.max(padding, y - rect.height - 8);
    }

    left = Math.max(padding, left);
    setPosition({ left, top });
  }, [x, y, isListMenuOpen, name, content]);

  useEffect(() => {
    requestAnimationFrame(() => {
      nameInputRef.current?.focus();
    });
  }, []);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target)) return;
      onClose();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (isListMenuOpen) {
        setIsListMenuOpen(false);
        setListQuery("");
        return;
      }
      onClose();
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, isListMenuOpen]);

  useEffect(() => {
    if (!isListMenuOpen) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (listMenuRef.current?.contains(target)) return;
      if (listButtonRef.current?.contains(target)) return;
      setIsListMenuOpen(false);
      setListQuery("");
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isListMenuOpen]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName || !selectedListId || isSubmitting) return;

    setIsSubmitting(true);

    try {
      await onAddTask({
        name: trimmedName,
        dueDate,
        details: content,
        listId: selectedListId,
        dueTimeMinutes,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label={`Add task for ${heading}`}
      className="fixed z-50 w-[300px] overflow-visible rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
      style={{ left: position.left, top: position.top }}
      onClick={(event) => event.stopPropagation()}
    >
      <form onSubmit={handleSubmit}>
        <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                New task
              </p>
              <p className="mt-0.5 text-sm font-medium text-zinc-700 dark:text-zinc-200">
                {dueTimeMinutes === null || dueTimeMinutes === undefined
                  ? formatPopoverDate(date)
                  : heading}
              </p>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="flex size-7 shrink-0 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            >
              <LuX className="size-4" />
            </button>
          </div>
        </div>

        <div className="space-y-3 px-4 py-3">
          <input
            ref={nameInputRef}
            type="text"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="Task name"
            aria-label="Task name"
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-[#4873c7] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          />

          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Description"
            aria-label="Task description"
            rows={4}
            className="w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm leading-relaxed text-zinc-900 outline-none transition-colors focus:border-[#4873c7] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          />
        </div>

        {selectedList ? (
          <div className="relative border-t border-zinc-100 dark:border-zinc-800">
            <button
              ref={listButtonRef}
              type="button"
              aria-label={`Choose list. Currently ${selectedList.name}`}
              aria-haspopup="dialog"
              aria-expanded={isListMenuOpen}
              onClick={(event) => {
                event.preventDefault();
                setIsListMenuOpen((open) => !open);
              }}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
            >
              <BiListUl className="size-4 shrink-0 text-zinc-400 dark:text-zinc-500" />
              <span className="truncate text-sm text-zinc-500 dark:text-zinc-400">
                {selectedList.name}
              </span>
            </button>

            {isListMenuOpen ? (
              <div
                ref={listMenuRef}
                className="absolute bottom-full left-3 z-10 mb-1"
              >
                <TaskMoveToSelector
                  lists={lists}
                  currentListId={selectedListId}
                  query={listQuery}
                  onQueryChange={setListQuery}
                  onSelectList={(listId) => {
                    setSelectedListId(listId);
                    setIsListMenuOpen(false);
                    setListQuery("");
                  }}
                  onCancel={() => {
                    setIsListMenuOpen(false);
                    setListQuery("");
                  }}
                  showCurrentList
                />
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <button
            type="submit"
            disabled={!name.trim() || !selectedListId || isSubmitting}
            className="flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-[#4873c7] text-sm font-medium text-white transition-colors enabled:hover:bg-[#3f68bd] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LuCheck className="size-4" aria-hidden="true" />
            Add task
          </button>
        </div>
      </form>
    </div>
  );
}
