"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { BiCalendar, BiListUl } from "react-icons/bi";
import { fetchTaskById } from "@/lib/task-details-api";
import { taskDetailsHasContent } from "@/lib/task-details-content";
import { TaskDatePicker } from "./task-date-picker";
import { TaskMoveToSelector } from "./task-move-to-selector";
import type { TaskListItem, TodoList } from "./todo-app";
import type { TaskDueTime } from "@/lib/task-due-time";

type CalendarTaskPopoverProps = {
  task: TaskListItem;
  lists: TodoList[];
  x: number;
  y: number;
  onClose: () => void;
  onSetTaskDueDate?: (taskId: string, dateValue: string | null) => void;
  onSetTaskDueTime?: (taskId: string, dueTime: TaskDueTime) => void;
  onMoveTaskToList?: (
    taskId: string,
    sourceListId: string,
    targetListId: string,
  ) => void;
};

const detailsCache = new Map<string, string>();

export function CalendarTaskPopover({
  task,
  lists,
  x,
  y,
  onClose,
  onSetTaskDueDate,
  onSetTaskDueTime,
  onMoveTaskToList,
}: CalendarTaskPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const dateButtonRef = useRef<HTMLButtonElement>(null);
  const dateMenuRef = useRef<HTMLDivElement>(null);
  const listButtonRef = useRef<HTMLButtonElement>(null);
  const listMenuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x, top: y + 8 });
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isListMenuOpen, setIsListMenuOpen] = useState(false);
  const [listQuery, setListQuery] = useState("");

  const hasLoadedDetails = taskDetailsHasContent(task.details);
  const [fetchedDetails, setFetchedDetails] = useState<string | null>(() => {
    if (hasLoadedDetails) return null;
    return detailsCache.get(task.id) ?? null;
  });
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  const previewDetails = hasLoadedDetails
    ? task.details
    : (fetchedDetails ?? detailsCache.get(task.id) ?? "");
  const hasContent = taskDetailsHasContent(previewDetails);
  const hasDateActions = Boolean(onSetTaskDueDate);
  const hasListActions = Boolean(onMoveTaskToList && task.listId && lists.length > 0);

  useEffect(() => {
    if (!task.hasDetails || hasLoadedDetails || fetchedDetails !== null) return;

    let cancelled = false;
    setIsLoadingDetails(true);

    fetchTaskById(task.id)
      .then((loadedTask) => {
        if (cancelled) return;
        const loaded = loadedTask?.details ?? "";
        detailsCache.set(task.id, loaded);
        setFetchedDetails(loaded);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) {
          setIsLoadingDetails(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [task.id, task.hasDetails, hasLoadedDetails, fetchedDetails]);

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
  }, [x, y, task.id, isDatePickerOpen, isListMenuOpen, hasContent, isLoadingDetails]);

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
      if (isDatePickerOpen) {
        setIsDatePickerOpen(false);
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
  }, [onClose, isDatePickerOpen, isListMenuOpen]);

  useEffect(() => {
    if (!isDatePickerOpen) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (dateMenuRef.current?.contains(target)) return;
      if (dateButtonRef.current?.contains(target)) return;
      setIsDatePickerOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isDatePickerOpen]);

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

  function handleToggleDatePicker() {
    setIsDatePickerOpen((open) => !open);
  }

  function handleSelectDueDate(dateValue: string) {
    onSetTaskDueDate?.(task.id, dateValue);
  }

  function handleSaveDueTime(dueTime: TaskDueTime) {
    onSetTaskDueTime?.(task.id, dueTime);
    setIsDatePickerOpen(false);
  }

  function handleToggleListMenu() {
    setIsListMenuOpen((open) => !open);
    if (isListMenuOpen) {
      setListQuery("");
    }
  }

  function handleSelectList(targetListId: string) {
    if (!task.listId || !onMoveTaskToList || targetListId === task.listId) return;

    onMoveTaskToList(task.id, task.listId, targetListId);
    setIsListMenuOpen(false);
    setListQuery("");
  }

  function handleCancelListMenu() {
    setIsListMenuOpen(false);
    setListQuery("");
  }

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label={task.name}
      className="fixed z-50 w-[280px] overflow-visible rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
      style={{ left: position.left, top: position.top }}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
        <div className="flex items-start gap-2">
          <h3 className="min-w-0 flex-1 text-base font-semibold leading-snug text-zinc-900 dark:text-zinc-50">
            {task.name}
          </h3>

          {hasDateActions ? (
            <div className="relative shrink-0">
              <button
                ref={dateButtonRef}
                type="button"
                aria-label="Set task date"
                aria-haspopup="dialog"
                aria-expanded={isDatePickerOpen}
                onClick={(event) => {
                  event.stopPropagation();
                  handleToggleDatePicker();
                }}
                className={`flex size-7 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 ${
                  task.dueDate ? "text-zinc-500 dark:text-zinc-300" : ""
                }`}
              >
                <BiCalendar className="size-4" />
              </button>

              {isDatePickerOpen ? (
                <div
                  ref={dateMenuRef}
                  className="absolute right-0 top-full z-10 mt-1"
                >
                  <TaskDatePicker
                    dueDate={task.dueDate}
                    dueTimeMinutes={task.dueTimeMinutes}
                    dueDurationMinutes={task.dueDurationMinutes}
                    dueTimeZone={task.dueTimeZone}
                    onSelectDate={handleSelectDueDate}
                    onSaveDueTime={
                      onSetTaskDueTime ? handleSaveDueTime : undefined
                    }
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="px-4 py-3">
        {isLoadingDetails ? (
          <p className="text-sm text-zinc-400 dark:text-zinc-500">Loading...</p>
        ) : hasContent ? (
          <div
            className="task-details-editor max-h-36 overflow-hidden text-sm leading-relaxed text-zinc-600 dark:text-zinc-300 [&_.detail-line]:my-0"
            dangerouslySetInnerHTML={{ __html: previewDetails }}
          />
        ) : (
          <p className="text-sm text-zinc-400 dark:text-zinc-500">No description</p>
        )}
      </div>

      {task.listName ? (
        <div className="relative border-t border-zinc-100 dark:border-zinc-800">
          {hasListActions ? (
            <button
              ref={listButtonRef}
              type="button"
              aria-label={`Move task to another list. Currently in ${task.listName}`}
              aria-haspopup="dialog"
              aria-expanded={isListMenuOpen}
              onClick={(event) => {
                event.stopPropagation();
                handleToggleListMenu();
              }}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
            >
              <BiListUl className="size-4 shrink-0 text-zinc-400 dark:text-zinc-500" />
              <span className="truncate text-sm text-zinc-500 dark:text-zinc-400">
                {task.listName}
              </span>
            </button>
          ) : (
            <div className="flex items-center gap-2 px-4 py-2.5">
              <BiListUl className="size-4 shrink-0 text-zinc-400 dark:text-zinc-500" />
              <span className="truncate text-sm text-zinc-500 dark:text-zinc-400">
                {task.listName}
              </span>
            </div>
          )}

          {isListMenuOpen && hasListActions ? (
            <div
              ref={listMenuRef}
              className="absolute bottom-full left-3 z-10 mb-1"
            >
              <TaskMoveToSelector
                lists={lists}
                currentListId={task.listId ?? null}
                query={listQuery}
                onQueryChange={setListQuery}
                onSelectList={handleSelectList}
                onCancel={handleCancelListMenu}
                showCurrentList
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
