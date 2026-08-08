"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BiChevronDown, BiChevronLeft, BiChevronRight } from "react-icons/bi";
import { CalendarAddTaskPopover } from "./calendar-add-task-popover";
import { CalendarTaskPopover } from "./calendar-task-popover";
import { CalendarDayView } from "./calendar-day-view";
import { CalendarMultiDayView } from "./calendar-multi-day-view";
import { CalendarWeekView } from "./calendar-week-view";
import { TaskCompletionCheckbox } from "./task-completion-checkbox";
import { TaskListPanel } from "./task-list-panel";
import type { TaskListItem, TodoList } from "./todo-app";
import type { TaskDueTime } from "@/lib/task-due-time";
import { resolveCalendarDayFromPoint } from "@/lib/calendar-drag";
import { getCalendarShellClassName } from "@/lib/calendar-layout";

type CalendarTab = "list" | "calendar";
type CalendarViewTab =
  | "day"
  | "week"
  | "month"
  | "year"
  | "multi-day"
  | "multi-week";

export type { CalendarViewTab };

const PRIMARY_CALENDAR_VIEW_TABS: Array<{
  id: CalendarViewTab;
  label: string;
}> = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "year", label: "Year" },
];

const MULTI_CALENDAR_VIEW_OPTIONS: Array<{
  id: Extract<CalendarViewTab, "multi-day" | "multi-week">;
  label: string;
  min: number;
  max: number;
  defaultValue: number;
}> = [
  { id: "multi-day", label: "Multi-Day", min: 2, max: 30, defaultValue: 3 },
  { id: "multi-week", label: "Multi-Week", min: 2, max: 12, defaultValue: 2 },
];

const CALENDAR_VIEW_TABS = [
  ...PRIMARY_CALENDAR_VIEW_TABS,
  ...MULTI_CALENDAR_VIEW_OPTIONS.map(({ id, label }) => ({ id, label })),
];

type CalendarPanelProps = {
  tasks: TaskListItem[];
  lists: TodoList[];
  completingTaskIds: Set<string>;
  checkAnimatingTaskIds?: Set<string>;
  selectedTaskId: string | null;
  onToggleTask: (taskId: string) => void;
  onSelectTask: (taskId: string) => void;
  onRenameTask: (taskId: string, name: string) => void;
  onSetTaskDueDate?: (taskId: string, dateValue: string | null) => void;
  onSetTaskDueTime?: (taskId: string, dueTime: TaskDueTime) => void;
  onSetTaskPriority?: (taskId: string, priority: number | null) => void;
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
  onAddCalendarTask?: (payload: {
    name: string;
    dueDate: string;
    details: string;
    listId: string;
  }) => void | Promise<void>;
  defaultListId?: string | null;
};

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const CALENDAR_TASK_DRAG_THRESHOLD_PX = 5;

type CalendarTaskDragState = {
  taskId: string;
  sourceDateKey: string;
  pointerId: number;
  captureTarget: HTMLElement;
};

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

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromDateKey(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : startOfDay(date);
}

function getFullMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1, 12, 0, 0, 0);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const padding = (firstDay.getDay() + 6) % 7;
  const cells: (Date | null)[] = Array.from({ length: padding }, () => null);

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(year, month, day, 12, 0, 0, 0));
  }

  return cells;
}

function formatMonthYear(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatSelectedDay(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

function CalendarTabs({
  activeTab,
  onChange,
}: {
  activeTab: CalendarTab;
  onChange: (tab: CalendarTab) => void;
}) {
  return (
    <div className="flex shrink-0 gap-1 border-b border-zinc-200 px-4 dark:border-zinc-800">
      {(["list", "calendar"] as const).map((tab) => (
        <button
          key={tab}
          type="button"
          onClick={() => onChange(tab)}
          className={`relative px-3 py-3 text-sm font-medium capitalize transition-colors ${
            activeTab === tab
              ? "text-zinc-900 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-zinc-900 dark:text-zinc-50 dark:after:bg-zinc-50"
              : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

function CalendarViewCounter({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (nextValue: number) => void;
}) {
  return (
    <span
      className="flex items-center gap-2 text-sm tabular-nums text-zinc-600 dark:text-zinc-300"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        aria-label="Decrease"
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        className="rounded px-1 text-base leading-none transition-colors hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:text-zinc-50"
      >
        −
      </button>
      <span className="min-w-[1ch] text-center">{value}</span>
      <button
        type="button"
        aria-label="Increase"
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        className="rounded px-1 text-base leading-none transition-colors hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:text-zinc-50"
      >
        +
      </button>
    </span>
  );
}

function CalendarMultiViewMenu({
  activeView,
  multiDayCount,
  multiWeekCount,
  onMultiDayCountChange,
  onMultiWeekCountChange,
  onChange,
}: {
  activeView: CalendarViewTab;
  multiDayCount: number;
  multiWeekCount: number;
  onMultiDayCountChange: (count: number) => void;
  onMultiWeekCountChange: (count: number) => void;
  onChange: (view: CalendarViewTab) => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isMultiActive =
    activeView === "multi-day" || activeView === "multi-week";
  const activeMultiOption = MULTI_CALENDAR_VIEW_OPTIONS.find(
    (option) => option.id === activeView,
  );
  const triggerLabel = activeMultiOption?.label ?? "Multi";

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={menuRef} className="relative flex items-center">
      <span
        aria-hidden="true"
        className="mx-1 h-4 w-px shrink-0 bg-zinc-200 dark:bg-zinc-700"
      />
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
        className={`inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
          isMultiActive
            ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
            : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
        }`}
      >
        {triggerLabel}
        <BiChevronDown
          className={`size-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute left-0 top-[calc(100%+0.5rem)] z-20 min-w-[220px] overflow-hidden rounded-2xl border border-zinc-200 bg-white py-1 shadow-[0_8px_24px_rgba(0,0,0,0.12)] dark:border-zinc-700 dark:bg-zinc-900"
        >
          {MULTI_CALENDAR_VIEW_OPTIONS.map((option) => {
            const count =
              option.id === "multi-day" ? multiDayCount : multiWeekCount;
            const onCountChange =
              option.id === "multi-day"
                ? onMultiDayCountChange
                : onMultiWeekCountChange;

            return (
              <button
                key={option.id}
                type="button"
                role="menuitemradio"
                aria-checked={activeView === option.id}
                onClick={() => {
                  onChange(option.id);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-4 px-4 py-2.5 text-left text-sm font-medium transition-colors ${
                  activeView === option.id
                    ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                    : "text-zinc-900 hover:bg-zinc-50 dark:text-zinc-50 dark:hover:bg-zinc-800/70"
                }`}
              >
                <span>{option.label}</span>
                <CalendarViewCounter
                  value={count}
                  min={option.min}
                  max={option.max}
                  onChange={onCountChange}
                />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function CalendarViewTabs({
  activeView,
  multiDayCount,
  multiWeekCount,
  onMultiDayCountChange,
  onMultiWeekCountChange,
  onChange,
}: {
  activeView: CalendarViewTab;
  multiDayCount: number;
  multiWeekCount: number;
  onMultiDayCountChange: (count: number) => void;
  onMultiWeekCountChange: (count: number) => void;
  onChange: (view: CalendarViewTab) => void;
}) {
  return (
    <div className="mb-4 flex shrink-0 justify-center px-4 pt-4">
      <div className="inline-flex items-center gap-0.5 rounded-full border border-zinc-200 bg-white px-1 py-1 shadow-[0_1px_3px_rgba(0,0,0,0.06)] dark:border-zinc-700 dark:bg-zinc-900">
        {PRIMARY_CALENDAR_VIEW_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            aria-pressed={activeView === tab.id}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              activeView === tab.id
                ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
        <CalendarMultiViewMenu
          activeView={activeView}
          multiDayCount={multiDayCount}
          multiWeekCount={multiWeekCount}
          onMultiDayCountChange={onMultiDayCountChange}
          onMultiWeekCountChange={onMultiWeekCountChange}
          onChange={onChange}
        />
      </div>
    </div>
  );
}

function CalendarViewPlaceholder({ label }: { label: string }) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-8">
      <p className="text-sm text-zinc-400 dark:text-zinc-500">
        {label} view coming soon
      </p>
    </div>
  );
}

export function CalendarMonthView({
  tasks,
  lists,
  selectedTaskId,
  onSelectTask,
  onToggleTask,
  onSetTaskDueDate,
  onSetTaskDueTime,
  onMoveTaskToList,
  onAddCalendarTask,
  defaultListId = null,
  fullWidth = false,
  externalDropTargetDateKey = null,
}: {
  tasks: TaskListItem[];
  lists: TodoList[];
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
  onToggleTask: (taskId: string) => void;
  onSetTaskDueDate?: (taskId: string, dateValue: string | null) => void;
  onSetTaskDueTime?: (taskId: string, dueTime: TaskDueTime) => void;
  onMoveTaskToList?: (
    taskId: string,
    sourceListId: string,
    targetListId: string,
  ) => void;
  onAddCalendarTask?: (payload: {
    name: string;
    dueDate: string;
    details: string;
    listId: string;
  }) => void | Promise<void>;
  defaultListId?: string | null;
  fullWidth?: boolean;
  externalDropTargetDateKey?: string | null;
}) {
  const [today, setToday] = useState<Date | null>(null);
  const [monthDate, setMonthDate] = useState<Date | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [taskPopover, setTaskPopover] = useState<{
    task: TaskListItem;
    x: number;
    y: number;
  } | null>(null);
  const [addTaskPopover, setAddTaskPopover] = useState<{
    date: Date;
    x: number;
    y: number;
  } | null>(null);
  const [draftTaskName, setDraftTaskName] = useState("");
  const [dropTargetDateKey, setDropTargetDateKey] = useState<string | null>(
    null,
  );
  const dragStateRef = useRef<CalendarTaskDragState | null>(null);
  const suppressTaskClickRef = useRef(false);

  useEffect(() => {
    const now = startOfDay(new Date());
    setToday(now);
    setMonthDate(now);
    setSelectedDate(now);
  }, []);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, TaskListItem[]>();

    for (const task of tasks) {
      if (!task.dueDate) continue;

      const date = fromDateKey(task.dueDate.slice(0, 10));
      if (!date) continue;

      const key = toDateKey(date);
      const existing = map.get(key) ?? [];
      existing.push(task);
      map.set(key, existing);
    }

    return map;
  }, [tasks]);

  const monthDays = useMemo(() => {
    if (!monthDate) return [];
    return getFullMonthDays(monthDate.getFullYear(), monthDate.getMonth());
  }, [monthDate]);
  const monthRowCount = Math.max(1, Math.ceil(monthDays.length / 7));

  const selectedDateKey = selectedDate ? toDateKey(selectedDate) : "";
  const selectedDayTasks = tasksByDate.get(selectedDateKey) ?? [];
  const popoverTask = useMemo(() => {
    if (!taskPopover) return null;
    return tasks.find((item) => item.id === taskPopover.task.id) ?? taskPopover.task;
  }, [taskPopover, tasks]);

  function goToPreviousMonth() {
    if (!monthDate) return;
    setMonthDate(
      startOfDay(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1)),
    );
  }

  function goToNextMonth() {
    if (!monthDate) return;
    setMonthDate(
      startOfDay(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1)),
    );
  }

  function closeAddTaskPopover() {
    setAddTaskPopover(null);
    setDraftTaskName("");
  }

  function handleDayClick(
    event:
      | React.MouseEvent<HTMLDivElement>
      | React.KeyboardEvent<HTMLDivElement>,
    day: Date,
  ) {
    setSelectedDate(day);
    setTaskPopover(null);

    if (!onAddCalendarTask || lists.length === 0) return;

    let x: number;
    let y: number;

    if ("clientX" in event) {
      x = event.clientX;
      y = event.clientY;
    } else {
      const rect = event.currentTarget.getBoundingClientRect();
      x = rect.left + rect.width / 2;
      y = rect.top + rect.height / 2;
    }

    setDraftTaskName("");
    setAddTaskPopover({
      date: day,
      x,
      y,
    });
  }

  function handleCalendarTaskClick(
    event: React.MouseEvent<HTMLButtonElement>,
    task: TaskListItem,
    day: Date,
  ) {
    event.stopPropagation();

    if (suppressTaskClickRef.current) {
      suppressTaskClickRef.current = false;
      return;
    }

    setSelectedDate(day);
    onSelectTask(task.id);
    closeAddTaskPopover();
    setTaskPopover({
      task,
      x: event.clientX,
      y: event.clientY,
    });
  }

  function handleCalendarTaskPointerDown(
    event: React.PointerEvent<HTMLButtonElement>,
    task: TaskListItem,
    day: Date,
  ) {
    if (event.button !== 0 || !onSetTaskDueDate) return;

    const sourceDateKey = toDateKey(day);
    const taskButton = event.currentTarget;
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    let dragStarted = false;

    function clearPendingListeners() {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointercancel", onPointerUp);
    }

    function finishDrag(upEvent: PointerEvent) {
      document.body.style.cursor = "";
      taskButton.classList.remove("opacity-50");

      if (taskButton.hasPointerCapture(pointerId)) {
        taskButton.releasePointerCapture(pointerId);
      }

      const dragState = dragStateRef.current;
      const targetDateKey = resolveCalendarDayFromPoint(
        upEvent.clientX,
        upEvent.clientY,
      );

      if (
        dragState &&
        onSetTaskDueDate &&
        targetDateKey &&
        targetDateKey !== dragState.sourceDateKey
      ) {
        onSetTaskDueDate(dragState.taskId, targetDateKey);
        const targetDate = fromDateKey(targetDateKey);
        if (targetDate) {
          setSelectedDate(targetDate);
        }
      }

      dragStateRef.current = null;
      setDropTargetDateKey(null);
      suppressTaskClickRef.current = true;
    }

    function onPointerMove(moveEvent: PointerEvent) {
      if (moveEvent.pointerId !== pointerId) return;

      if (!dragStarted) {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        if (Math.hypot(dx, dy) < CALENDAR_TASK_DRAG_THRESHOLD_PX) return;

        dragStarted = true;
        clearPendingListeners();
        setTaskPopover(null);
        dragStateRef.current = {
          taskId: task.id,
          sourceDateKey,
          pointerId,
          captureTarget: taskButton,
        };
        taskButton.setPointerCapture(pointerId);
        taskButton.classList.add("opacity-50");
        document.body.style.cursor = "grabbing";
        document.addEventListener("pointermove", onActivePointerMove);
        document.addEventListener("pointerup", onActivePointerUp);
        document.addEventListener("pointercancel", onActivePointerUp);
      }
    }

    function onActivePointerMove(moveEvent: PointerEvent) {
      if (moveEvent.pointerId !== pointerId) return;
      setDropTargetDateKey(
        resolveCalendarDayFromPoint(moveEvent.clientX, moveEvent.clientY),
      );
    }

    function onActivePointerUp(upEvent: PointerEvent) {
      if (upEvent.pointerId !== pointerId) return;
      document.removeEventListener("pointermove", onActivePointerMove);
      document.removeEventListener("pointerup", onActivePointerUp);
      document.removeEventListener("pointercancel", onActivePointerUp);
      finishDrag(upEvent);
    }

    function onPointerUp(upEvent: PointerEvent) {
      if (upEvent.pointerId !== pointerId) return;
      clearPendingListeners();
    }

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerUp);
  }

  useEffect(() => {
    if (!monthDate) return;
    setTaskPopover(null);
    closeAddTaskPopover();
  }, [monthDate]);

  if (!monthDate || !selectedDate || !today) {
    return (
      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col p-4">
          <div className={getCalendarShellClassName(fullWidth, "max-w-8xl")}>
            <div className="mb-4 h-8 w-40 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
            <div className="min-h-0 flex-1 animate-pulse rounded-lg bg-zinc-50 dark:bg-zinc-900/40" />
          </div>
        </div>
        <aside className="flex w-[320px] shrink-0 flex-col border-l border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <div className="h-5 w-32 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
          </div>
        </aside>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col p-4">
        <div className={getCalendarShellClassName(fullWidth)}>
          <div className="mb-4 flex shrink-0 items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {formatMonthYear(monthDate)}
            </h2>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Previous month"
                onClick={goToPreviousMonth}
                className="flex size-8 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <BiChevronLeft className="size-5" />
              </button>
              <button
                type="button"
                aria-label="Next month"
                onClick={goToNextMonth}
                className="flex size-8 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <BiChevronRight className="size-5" />
              </button>
            </div>
          </div>

          <div className="grid shrink-0 grid-cols-7 border-b border-zinc-200 pb-2 dark:border-zinc-800">
            {WEEKDAY_LABELS.map((label) => (
              <div
                key={label}
                className="px-2 text-center text-xs font-medium uppercase tracking-wide text-zinc-400"
              >
                {label}
              </div>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div
              className="grid h-full min-h-full grid-cols-7 border-l border-t border-zinc-200 dark:border-zinc-800"
              style={{
                gridTemplateRows: `repeat(${monthRowCount}, minmax(96px, 140px))`,
              }}
            >
            {monthDays.map((day, index) => {
              if (!day) {
                return (
                  <div
                    key={`empty-${index}`}
                    className="h-full border-r border-b border-zinc-200 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-900/40"
                  />
                );
              }

              const dateKey = toDateKey(day);
              const dayTasks = tasksByDate.get(dateKey) ?? [];
              const isSelected = isSameDay(day, selectedDate);
              const isToday = isSameDay(day, today);
              const isCurrentMonth = day.getMonth() === monthDate.getMonth();

              const isDropTarget =
                dropTargetDateKey === dateKey ||
                externalDropTargetDateKey === dateKey;
              const isActiveDay =
                addTaskPopover !== null && isSameDay(day, addTaskPopover.date);

              return (
                <div
                  key={dateKey}
                  data-calendar-day={dateKey}
                  role="button"
                  tabIndex={0}
                  onClick={(event) => handleDayClick(event, day)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleDayClick(event, day);
                    }
                  }}
                  className={`h-full cursor-pointer border-r border-b border-zinc-200 p-2 text-left transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/60 ${
                    isDropTarget
                      ? "bg-blue-50 ring-1 ring-inset ring-blue-400 dark:bg-blue-950/30 dark:ring-blue-500"
                      : isActiveDay
                        ? "bg-blue-50 ring-1 ring-inset ring-[#4873c7] dark:bg-blue-950/30 dark:ring-[#7da2ff]"
                        : isSelected
                          ? "bg-zinc-100 ring-1 ring-inset ring-zinc-300 dark:bg-zinc-900 dark:ring-zinc-600"
                          : "bg-white dark:bg-zinc-950"
                  }`}
                >
                  <span
                    className={`inline-flex size-7 items-center justify-center rounded-full text-sm ${
                      isToday
                        ? "bg-[#b2b6bf] font-semibold text-white dark:bg-zinc-50 dark:text-zinc-900"
                        : isCurrentMonth
                          ? "font-medium text-[#b2b6bf] dark:text-zinc-100"
                          : "text-zinc-400"
                    }`}
                  >
                    {day.getDate()}
                  </span>

                  <div className="mt-1 space-y-0.5">
                    {dayTasks.slice(0, isActiveDay ? 2 : 3).map((task) => (
                      <button
                        key={task.id}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleCalendarTaskClick(event, task, day);
                        }}
                        onPointerDown={(event) => {
                          event.stopPropagation();
                          handleCalendarTaskPointerDown(event, task, day);
                        }}
                        className={`block w-full truncate rounded px-1 py-0.5 text-left text-[11px] transition-colors touch-none ${
                          onSetTaskDueDate
                            ? "cursor-grab active:cursor-grabbing"
                            : ""
                        } ${
                          task.id === selectedTaskId
                            ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                            : "bg-zinc-200/80 text-zinc-700 hover:bg-zinc-300/80 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                        }`}
                      >
                        {task.name}
                      </button>
                    ))}
                    {isActiveDay ? (
                      <div
                        aria-hidden="true"
                        className="block w-full truncate h-[16px] rounded-[6px] bg-zinc-200/50 px-2 py-0.5 text-left text-[11px] text-zinc-400 dark:bg-zinc-700 dark:text-zinc-100"
                      >
                        {draftTaskName.trim() || ""}
                      </div>
                    ) : null}
                    {!isActiveDay && dayTasks.length > 3 && (
                      <span className="block px-1 text-[11px] text-zinc-400">
                        +{dayTasks.length - 3} more
                      </span>
                    )}
                    {isActiveDay && dayTasks.length > 2 && (
                      <span className="block px-1 text-[11px] text-zinc-400">
                        +{dayTasks.length - 2} more
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        </div>
      </div>

      <aside className="flex w-[320px] shrink-0 flex-col border-l border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              {formatSelectedDay(selectedDate)}
            </h3>
          </div>

          <ul className="flex-1 overflow-y-auto">
            {selectedDayTasks.length === 0 ? (
              <li className="px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400">
                No tasks scheduled
              </li>
            ) : (
              selectedDayTasks.map((task) => (
                <li
                  key={task.id}
                  className={`flex items-center gap-2 border-b border-zinc-100 px-4 py-2 dark:border-zinc-900 ${
                    task.id === selectedTaskId
                      ? "bg-zinc-100 dark:bg-zinc-900"
                      : ""
                  }`}
                >
                  <TaskCompletionCheckbox
                    checked={task.completed}
                    onChange={() => onToggleTask(task.id)}
                    aria-label={`Mark ${task.name} complete`}
                    className="text-[#777777]"
                  />
                  <button
                    type="button"
                    onClick={() => onSelectTask(task.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block truncate text-sm text-zinc-900 dark:text-zinc-50">
                      {task.name}
                    </span>
                    {task.listName && (
                      <span className="block truncate text-xs text-zinc-400 dark:text-zinc-500">
                        {task.listName}
                      </span>
                    )}
                  </button>
                </li>
              ))
            )}
        </ul>
      </aside>

      {addTaskPopover && onAddCalendarTask ? (
        <CalendarAddTaskPopover
          date={addTaskPopover.date}
          lists={lists}
          defaultListId={defaultListId}
          x={addTaskPopover.x}
          y={addTaskPopover.y}
          name={draftTaskName}
          onNameChange={setDraftTaskName}
          onClose={closeAddTaskPopover}
          onAddTask={onAddCalendarTask}
        />
      ) : null}

      {popoverTask && taskPopover ? (
        <CalendarTaskPopover
          task={popoverTask}
          lists={lists}
          x={taskPopover.x}
          y={taskPopover.y}
          onClose={() => setTaskPopover(null)}
          onSetTaskDueDate={onSetTaskDueDate}
          onSetTaskDueTime={onSetTaskDueTime}
          onMoveTaskToList={onMoveTaskToList}
        />
      ) : null}
    </div>
  );
}

type CalendarViewsPanelProps = {
  tasks: TaskListItem[];
  lists: TodoList[];
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
  onToggleTask: (taskId: string) => void;
  onSetTaskDueDate?: (taskId: string, dateValue: string | null) => void;
  onSetTaskDueTime?: (taskId: string, dueTime: TaskDueTime) => void;
  onMoveTaskToList?: (
    taskId: string,
    sourceListId: string,
    targetListId: string,
  ) => void;
  onAddCalendarTask?: (payload: {
    name: string;
    dueDate: string;
    details: string;
    listId: string;
    dueTimeMinutes?: number | null;
  }) => void | Promise<void>;
  defaultListId?: string | null;
  defaultView?: CalendarViewTab;
  fullWidth?: boolean;
  externalDropTargetDateKey?: string | null;
  externalDropTargetTimeMinutes?: number | null;
};

export function CalendarViewsPanel({
  tasks,
  lists,
  selectedTaskId,
  onSelectTask,
  onToggleTask,
  onSetTaskDueDate,
  onSetTaskDueTime,
  onMoveTaskToList,
  onAddCalendarTask,
  defaultListId = null,
  defaultView = "month",
  fullWidth = false,
  externalDropTargetDateKey = null,
  externalDropTargetTimeMinutes = null,
}: CalendarViewsPanelProps) {
  const [activeView, setActiveView] = useState<CalendarViewTab>(defaultView);
  const [multiDayCount, setMultiDayCount] = useState(
    MULTI_CALENDAR_VIEW_OPTIONS.find((option) => option.id === "multi-day")
      ?.defaultValue ?? 3,
  );
  const [multiWeekCount, setMultiWeekCount] = useState(
    MULTI_CALENDAR_VIEW_OPTIONS.find((option) => option.id === "multi-week")
      ?.defaultValue ?? 2,
  );
  const activeViewLabel =
    activeView === "multi-day"
      ? `Multi-day (${multiDayCount} days)`
      : activeView === "multi-week"
        ? `Multi-week (${multiWeekCount} weeks)`
        : (CALENDAR_VIEW_TABS.find((tab) => tab.id === activeView)?.label ??
          activeView);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <CalendarViewTabs
        activeView={activeView}
        multiDayCount={multiDayCount}
        multiWeekCount={multiWeekCount}
        onMultiDayCountChange={setMultiDayCount}
        onMultiWeekCountChange={setMultiWeekCount}
        onChange={setActiveView}
      />
      {activeView === "month" ? (
        <CalendarMonthView
          tasks={tasks}
          lists={lists}
          selectedTaskId={selectedTaskId}
          onSelectTask={onSelectTask}
          onToggleTask={onToggleTask}
          onSetTaskDueDate={onSetTaskDueDate}
          onSetTaskDueTime={onSetTaskDueTime}
          onMoveTaskToList={onMoveTaskToList}
          onAddCalendarTask={onAddCalendarTask}
          defaultListId={defaultListId}
          fullWidth={fullWidth}
          externalDropTargetDateKey={externalDropTargetDateKey}
        />
      ) : activeView === "week" ? (
        <CalendarWeekView
          tasks={tasks}
          lists={lists}
          selectedTaskId={selectedTaskId}
          onSelectTask={onSelectTask}
          onSetTaskDueDate={onSetTaskDueDate}
          onSetTaskDueTime={onSetTaskDueTime}
          onMoveTaskToList={onMoveTaskToList}
          onAddCalendarTask={onAddCalendarTask}
          defaultListId={defaultListId}
          fullWidth={fullWidth}
          externalDropTargetDateKey={externalDropTargetDateKey}
          externalDropTargetTimeMinutes={externalDropTargetTimeMinutes}
        />
      ) : activeView === "day" ? (
        <CalendarDayView
          tasks={tasks}
          lists={lists}
          selectedTaskId={selectedTaskId}
          onSelectTask={onSelectTask}
          onSetTaskDueDate={onSetTaskDueDate}
          onSetTaskDueTime={onSetTaskDueTime}
          onMoveTaskToList={onMoveTaskToList}
          onAddCalendarTask={onAddCalendarTask}
          defaultListId={defaultListId}
          fullWidth={fullWidth}
          externalDropTargetDateKey={externalDropTargetDateKey}
          externalDropTargetTimeMinutes={externalDropTargetTimeMinutes}
        />
      ) : activeView === "multi-day" ? (
        <CalendarMultiDayView
          tasks={tasks}
          lists={lists}
          selectedTaskId={selectedTaskId}
          dayCount={multiDayCount}
          onSelectTask={onSelectTask}
          onSetTaskDueDate={onSetTaskDueDate}
          onSetTaskDueTime={onSetTaskDueTime}
          onMoveTaskToList={onMoveTaskToList}
          onAddCalendarTask={onAddCalendarTask}
          defaultListId={defaultListId}
          fullWidth={fullWidth}
          externalDropTargetDateKey={externalDropTargetDateKey}
        />
      ) : (
        <CalendarViewPlaceholder label={activeViewLabel} />
      )}
    </div>
  );
}

export function CalendarPanel({
  tasks,
  lists,
  completingTaskIds,
  checkAnimatingTaskIds,
  selectedTaskId,
  onToggleTask,
  onSelectTask,
  onRenameTask,
  onSetTaskDueDate,
  onSetTaskDueTime,
  onSetTaskPriority,
  onToggleTaskLabel,
  onLabelsChanged,
  onMoveTaskToList,
  onAddCalendarTask,
  defaultListId,
}: CalendarPanelProps) {
  const [activeTab, setActiveTab] = useState<CalendarTab>("calendar");

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white dark:bg-zinc-950">
      <CalendarTabs activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === "list" ? (
        <div className="min-h-0 flex-1 overflow-hidden">
          <TaskListPanel
          title="Calendar"
          tasks={tasks}
          lists={lists}
          completingTaskIds={completingTaskIds}
          checkAnimatingTaskIds={checkAnimatingTaskIds}
          selectedTaskId={selectedTaskId}
          embedded
          showHeader={false}
          showAddTask={false}
          onAddTask={() => {}}
          onToggleTask={onToggleTask}
          onSelectTask={onSelectTask}
          onRenameTask={onRenameTask}
          onSetTaskDueDate={onSetTaskDueDate}
          onSetTaskDueTime={onSetTaskDueTime}
          onSetTaskPriority={onSetTaskPriority}
          onToggleTaskLabel={onToggleTaskLabel}
          onLabelsChanged={onLabelsChanged}
          onMoveTaskToList={onMoveTaskToList}
        />
        </div>
      ) : (
        <CalendarViewsPanel
          tasks={tasks}
          lists={lists}
          selectedTaskId={selectedTaskId}
          onSelectTask={onSelectTask}
          onToggleTask={onToggleTask}
          onSetTaskDueDate={onSetTaskDueDate}
          onSetTaskDueTime={onSetTaskDueTime}
          onMoveTaskToList={onMoveTaskToList}
          onAddCalendarTask={onAddCalendarTask}
          defaultListId={defaultListId}
        />
      )}
    </section>
  );
}
