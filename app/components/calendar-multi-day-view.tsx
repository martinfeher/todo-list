"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BiChevronLeft, BiChevronRight } from "react-icons/bi";
import { CalendarAddTaskPopover } from "./calendar-add-task-popover";
import { CalendarTaskPopover } from "./calendar-task-popover";
import type { TaskListItem, TodoList } from "./todo-app";
import type { TaskDueTime } from "@/lib/task-due-time";
import { normalizeDueTimeMinutes } from "@/lib/task-due-time";
import { getCalendarShellClassName } from "@/lib/calendar-layout";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOUR_START = 8;
const HOUR_END = 20;
const HOUR_HEIGHT_PX = 52;
const TIME_SLOT_MINUTES = 15;
const CALENDAR_TASK_DRAG_THRESHOLD_PX = 5;

type CalendarMultiDayViewProps = {
  tasks: TaskListItem[];
  lists: TodoList[];
  selectedTaskId: string | null;
  dayCount: number;
  onSelectTask: (taskId: string) => void;
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
  fullWidth?: boolean;
  externalDropTargetDateKey?: string | null;
};

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

function getVisibleDays(rangeStart: Date, dayCount: number) {
  return Array.from({ length: dayCount }, (_, index) =>
    startOfDay(
      new Date(
        rangeStart.getFullYear(),
        rangeStart.getMonth(),
        rangeStart.getDate() + index,
      ),
    ),
  );
}

function formatRangeHeading(days: Date[]) {
  if (days.length === 0) return "";

  const first = days[0];
  const last = days[days.length - 1];
  const monthYear = new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  });

  if (first.getMonth() === last.getMonth()) {
    return monthYear.format(first);
  }

  const monthOnly = new Intl.DateTimeFormat(undefined, { month: "short" });
  return `${monthOnly.format(first)} – ${monthYear.format(last)}`;
}

function formatCurrentTimeLabel(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatSlotTimeLabel(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function snapToTimeSlot(minutes: number) {
  const snapped =
    Math.round(minutes / TIME_SLOT_MINUTES) * TIME_SLOT_MINUTES;
  return Math.max(0, Math.min(24 * 60 - TIME_SLOT_MINUTES, snapped));
}

function getMinutesFromGridY(y: number) {
  const rawMinutes =
    ((y - HOUR_HEIGHT_PX) / HOUR_HEIGHT_PX + HOUR_START) * 60;
  return snapToTimeSlot(rawMinutes);
}

function getTopForMinutes(minutes: number) {
  return HOUR_HEIGHT_PX + (minutes / 60 - HOUR_START) * HOUR_HEIGHT_PX;
}

function resolveCalendarDayFromPoint(clientX: number, clientY: number) {
  const element = document.elementFromPoint(clientX, clientY);
  if (!(element instanceof Element)) return null;

  const dayCell = element.closest("[data-calendar-day]");
  return dayCell?.getAttribute("data-calendar-day") ?? null;
}

export function CalendarMultiDayView({
  tasks,
  lists,
  selectedTaskId,
  dayCount,
  onSelectTask,
  onSetTaskDueDate,
  onSetTaskDueTime,
  onMoveTaskToList,
  onAddCalendarTask,
  defaultListId = null,
  fullWidth = false,
  externalDropTargetDateKey = null,
}: CalendarMultiDayViewProps) {
  const [today, setToday] = useState<Date | null>(null);
  const [rangeStart, setRangeStart] = useState<Date | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [taskPopover, setTaskPopover] = useState<{
    task: TaskListItem;
    x: number;
    y: number;
  } | null>(null);
  const [addTaskPopover, setAddTaskPopover] = useState<{
    date: Date;
    x: number;
    y: number;
    dueTimeMinutes: number | null;
  } | null>(null);
  const [draftTaskName, setDraftTaskName] = useState("");
  const [dropTargetDateKey, setDropTargetDateKey] = useState<string | null>(
    null,
  );
  const dragStateRef = useRef<CalendarTaskDragState | null>(null);
  const suppressTaskClickRef = useRef(false);

  useEffect(() => {
    const current = startOfDay(new Date());
    setToday(current);
    setRangeStart(current);
    setNow(new Date());
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const visibleDays = useMemo(
    () => (rangeStart ? getVisibleDays(rangeStart, dayCount) : []),
    [rangeStart, dayCount],
  );

  const hours = useMemo(
    () =>
      Array.from(
        { length: HOUR_END - HOUR_START + 1 },
        (_, index) => HOUR_START + index,
      ),
    [],
  );

  const tasksByDate = useMemo(() => {
    const map = new Map<
      string,
      { allDay: TaskListItem[]; timed: TaskListItem[] }
    >();

    for (const task of tasks) {
      if (!task.dueDate) continue;

      const date = fromDateKey(task.dueDate.slice(0, 10));
      if (!date) continue;

      const key = toDateKey(date);
      const bucket = map.get(key) ?? { allDay: [], timed: [] };
      const dueTimeMinutes = normalizeDueTimeMinutes(task.dueTimeMinutes);

      if (dueTimeMinutes === null) {
        bucket.allDay.push(task);
      } else {
        bucket.timed.push(task);
      }

      map.set(key, bucket);
    }

    for (const bucket of map.values()) {
      bucket.timed.sort(
        (a, b) =>
          (normalizeDueTimeMinutes(a.dueTimeMinutes) ?? 0) -
          (normalizeDueTimeMinutes(b.dueTimeMinutes) ?? 0),
      );
    }

    return map;
  }, [tasks]);

  const popoverTask = useMemo(() => {
    if (!taskPopover) return null;
    return tasks.find((item) => item.id === taskPopover.task.id) ?? taskPopover.task;
  }, [taskPopover, tasks]);

  const currentTimeTop =
    now === null
      ? null
      : (now.getHours() + now.getMinutes() / 60 - HOUR_START) * HOUR_HEIGHT_PX;

  const todayIndex = useMemo(
    () =>
      today === null
        ? -1
        : visibleDays.findIndex((day) => isSameDay(day, today)),
    [today, visibleDays],
  );

  const showGlobalNowLine =
    todayIndex >= 0 &&
    currentTimeTop !== null &&
    currentTimeTop >= 0 &&
    currentTimeTop <= (HOUR_END - HOUR_START + 1) * HOUR_HEIGHT_PX;

  const gridTemplateColumns = `56px repeat(${dayCount}, minmax(0, 1fr))`;
  const minGridWidth = 56 + dayCount * 120;

  function goToPreviousRange() {
    if (!rangeStart) return;
    setRangeStart(
      startOfDay(
        new Date(
          rangeStart.getFullYear(),
          rangeStart.getMonth(),
          rangeStart.getDate() - dayCount,
        ),
      ),
    );
  }

  function goToNextRange() {
    if (!rangeStart) return;
    setRangeStart(
      startOfDay(
        new Date(
          rangeStart.getFullYear(),
          rangeStart.getMonth(),
          rangeStart.getDate() + dayCount,
        ),
      ),
    );
  }

  function goToToday() {
    const current = startOfDay(new Date());
    setRangeStart(current);
  }

  function closeAddTaskPopover() {
    setAddTaskPopover(null);
    setDraftTaskName("");
  }

  function handleAllDayClick(
    event: React.MouseEvent<HTMLElement>,
    day: Date,
  ) {
    setTaskPopover(null);

    if (!onAddCalendarTask || lists.length === 0) return;

    setDraftTaskName("");
    setAddTaskPopover({
      date: day,
      x: event.clientX,
      y: event.clientY,
      dueTimeMinutes: null,
    });
  }

  function handleTimeGridClick(
    event: React.MouseEvent<HTMLDivElement>,
    day: Date,
  ) {
    event.stopPropagation();
    setTaskPopover(null);

    if (!onAddCalendarTask || lists.length === 0) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const y = event.clientY - rect.top;
    const dueTimeMinutes = getMinutesFromGridY(y);
    const top = getTopForMinutes(dueTimeMinutes);

    if (top < 0 || top > (hours.length + 1) * HOUR_HEIGHT_PX) {
      return;
    }

    setDraftTaskName("");
    setAddTaskPopover({
      date: day,
      x: event.clientX,
      y: event.clientY,
      dueTimeMinutes,
    });
  }

  function handleCalendarTaskClick(
    event: React.MouseEvent<HTMLButtonElement>,
    task: TaskListItem,
  ) {
    event.stopPropagation();

    if (suppressTaskClickRef.current) {
      suppressTaskClickRef.current = false;
      return;
    }

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
    if (!rangeStart) return;
    setTaskPopover(null);
    closeAddTaskPopover();
  }, [rangeStart, dayCount]);

  if (!rangeStart || !today || !now) {
    return (
      <div className="flex min-h-0 flex-1 p-4">
        <div className="min-h-0 flex-1 animate-pulse rounded-lg bg-zinc-50 dark:bg-zinc-900/40" />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col p-4">
      <div className={getCalendarShellClassName(fullWidth)}>
        <div className="mb-4 flex shrink-0 items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {formatRangeHeading(visibleDays)}
            </h2>
            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
              {dayCount} {dayCount === 1 ? "day" : "days"}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={goToToday}
              className="mr-1 rounded-md px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Today
            </button>
            <button
              type="button"
              aria-label={`Previous ${dayCount} days`}
              onClick={goToPreviousRange}
              className="flex size-8 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <BiChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              aria-label={`Next ${dayCount} days`}
              onClick={goToNextRange}
              className="flex size-8 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <BiChevronRight className="size-5" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <div
            className="relative grid"
            style={{ gridTemplateColumns, minWidth: minGridWidth }}
          >
            <div className="sticky top-0 z-20 border-b border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950" />
            {visibleDays.map((day) => {
              const isToday = isSameDay(day, today);
              return (
                <div
                  key={`head-${toDateKey(day)}`}
                  className="sticky top-0 z-20 border-b border-r border-zinc-200 bg-white px-2 py-2 text-center dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <div className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                    {WEEKDAY_LABELS[day.getDay()]}
                  </div>
                  <div
                    className={`mt-1 inline-flex size-7 items-center justify-center rounded-full text-sm ${
                      isToday
                        ? "bg-[#4873c7] font-semibold text-white"
                        : "font-medium text-zinc-700 dark:text-zinc-200"
                    }`}
                  >
                    {day.getDate()}
                  </div>
                </div>
              );
            })}

            <div className="border-b border-r border-zinc-200 px-2 py-2 text-[11px] text-zinc-400 dark:border-zinc-800">
              All day
            </div>
            {visibleDays.map((day) => {
              const dateKey = toDateKey(day);
              const dayTasks = tasksByDate.get(dateKey)?.allDay ?? [];
              const isDropTarget =
                dropTargetDateKey === dateKey ||
                externalDropTargetDateKey === dateKey;
              const isActiveDay =
                addTaskPopover !== null && isSameDay(day, addTaskPopover.date);
              const isActiveAllDay =
                isActiveDay && addTaskPopover?.dueTimeMinutes === null;

              return (
                <div
                  key={`allday-${dateKey}`}
                  data-calendar-day={dateKey}
                  onClick={(event) => handleAllDayClick(event, day)}
                  className={`min-h-[72px] cursor-pointer border-b border-r border-zinc-200 p-1.5 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/60 ${
                    isDropTarget
                      ? "bg-blue-50 ring-1 ring-inset ring-blue-400 dark:bg-blue-950/30"
                      : isActiveAllDay
                        ? "bg-blue-50 ring-1 ring-inset ring-[#4873c7] dark:bg-blue-950/30"
                        : "bg-white dark:bg-zinc-950"
                  }`}
                >
                  <div className="space-y-1">
                    {dayTasks.map((task) => (
                      <button
                        key={task.id}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleCalendarTaskClick(event, task);
                        }}
                        onPointerDown={(event) => {
                          event.stopPropagation();
                          handleCalendarTaskPointerDown(event, task, day);
                        }}
                        className={`block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] transition-colors touch-none ${
                          onSetTaskDueDate
                            ? "cursor-grab active:cursor-grabbing"
                            : ""
                        } ${
                          task.id === selectedTaskId
                            ? "bg-[#4873c7] text-white"
                            : "bg-[#dbeafe] text-[#1e3a8a] hover:bg-[#bfdbfe] dark:bg-blue-950/50 dark:text-blue-100"
                        }`}
                      >
                        {task.name}
                      </button>
                    ))}
                    {isActiveAllDay ? (
                      <div
                        aria-hidden="true"
                        className="block h-4 truncate rounded bg-zinc-200/50 px-1.5 text-[11px] text-zinc-400 dark:bg-zinc-700"
                      >
                        {draftTaskName.trim() || ""}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}

            <div className="relative border-r border-zinc-200 dark:border-zinc-800">
              <div
                className="border-b border-zinc-200 px-2 py-3 text-[11px] text-zinc-400 dark:border-zinc-800"
                style={{ height: HOUR_HEIGHT_PX }}
              >
                00:00 - 07:00
              </div>
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="border-b border-zinc-200 px-2 py-2 text-[11px] text-zinc-400 dark:border-zinc-800"
                  style={{ height: HOUR_HEIGHT_PX }}
                >
                  {String(hour).padStart(2, "0")}:00
                </div>
              ))}
            </div>

            {visibleDays.map((day, dayIndex) => {
              const dateKey = toDateKey(day);
              const timedTasks = tasksByDate.get(dateKey)?.timed ?? [];
              const isDropTarget =
                dropTargetDateKey === dateKey ||
                externalDropTargetDateKey === dateKey;
              const isActiveDay =
                addTaskPopover !== null && isSameDay(day, addTaskPopover.date);
              const selectedSlotMinutes = isActiveDay
                ? (addTaskPopover?.dueTimeMinutes ?? null)
                : null;
              const selectedSlotTop =
                selectedSlotMinutes === null
                  ? null
                  : getTopForMinutes(selectedSlotMinutes);
              const showSelectedSlotMarker =
                isActiveDay &&
                selectedSlotTop !== null &&
                selectedSlotTop >= 0 &&
                selectedSlotTop <= (hours.length + 1) * HOUR_HEIGHT_PX;

              return (
                <div
                  key={`time-${dateKey}`}
                  data-calendar-day={dateKey}
                  className={`relative border-r border-zinc-200 dark:border-zinc-800 ${
                    isDropTarget ? "bg-blue-50/40 dark:bg-blue-950/20" : ""
                  }`}
                  onClick={(event) => handleTimeGridClick(event, day)}
                >
                  <div
                    className="cursor-pointer border-b border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/40"
                    style={{ height: HOUR_HEIGHT_PX }}
                  />
                  {hours.map((hour) => (
                    <div
                      key={hour}
                      className="relative cursor-pointer border-b border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/40"
                      style={{ height: HOUR_HEIGHT_PX }}
                    >
                      <div className="pointer-events-none absolute inset-x-0 top-1/4 border-t border-dashed border-zinc-100 dark:border-zinc-800/80" />
                      <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-zinc-100 dark:border-zinc-800/80" />
                      <div className="pointer-events-none absolute inset-x-0 top-3/4 border-t border-dashed border-zinc-100 dark:border-zinc-800/80" />
                    </div>
                  ))}

                  {timedTasks.map((task) => {
                    const minutes =
                      normalizeDueTimeMinutes(task.dueTimeMinutes) ?? 0;
                    const top =
                      HOUR_HEIGHT_PX +
                      (minutes / 60 - HOUR_START) * HOUR_HEIGHT_PX;
                    const durationMinutes =
                      task.dueDurationMinutes && task.dueDurationMinutes > 0
                        ? task.dueDurationMinutes
                        : 60;
                    const height = Math.max(
                      24,
                      (durationMinutes / 60) * HOUR_HEIGHT_PX,
                    );

                    if (
                      top < HOUR_HEIGHT_PX ||
                      top > (hours.length + 1) * HOUR_HEIGHT_PX
                    ) {
                      return null;
                    }

                    return (
                      <button
                        key={task.id}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleCalendarTaskClick(event, task);
                        }}
                        onPointerDown={(event) => {
                          event.stopPropagation();
                          handleCalendarTaskPointerDown(event, task, day);
                        }}
                        style={{ top, height }}
                        className={`absolute inset-x-1 z-10 overflow-hidden rounded px-1.5 py-0.5 text-left text-[11px] leading-tight transition-colors touch-none ${
                          onSetTaskDueDate
                            ? "cursor-grab active:cursor-grabbing"
                            : ""
                        } ${
                          task.id === selectedTaskId
                            ? "bg-[#4873c7] text-white"
                            : "bg-[#dbeafe] text-[#1e3a8a] hover:bg-[#bfdbfe] dark:bg-blue-950/50 dark:text-blue-100"
                        }`}
                      >
                        <span className="line-clamp-2">{task.name}</span>
                      </button>
                    );
                  })}

                  {showSelectedSlotMarker &&
                  selectedSlotTop !== null &&
                  selectedSlotMinutes !== null ? (
                    <>
                      <div
                        className="pointer-events-none absolute inset-x-0 z-20"
                        style={{ top: selectedSlotTop }}
                      >
                        <div className="relative h-px bg-[#4873c7]">
                          <span className="absolute -right-1 -top-1 size-2 rounded-full bg-[#4873c7]" />
                        </div>
                      </div>
                      <div
                        aria-hidden="true"
                        style={{
                          top: selectedSlotTop,
                          height: Math.max(
                            16,
                            (TIME_SLOT_MINUTES / 60) * HOUR_HEIGHT_PX,
                          ),
                        }}
                        className="pointer-events-none absolute inset-x-1 z-10 overflow-hidden rounded border border-[#4873c7]/40 bg-[#4873c7]/10 px-1.5 py-0.5 text-left text-[11px] text-[#4873c7]"
                      >
                        {draftTaskName.trim() ||
                          formatSlotTimeLabel(selectedSlotMinutes)}
                      </div>
                    </>
                  ) : null}

                  {showGlobalNowLine && dayIndex === todayIndex ? (
                    <div
                      className="pointer-events-none absolute z-20"
                      style={{
                        top: HOUR_HEIGHT_PX + currentTimeTop,
                        left: 0,
                        width: `calc(${dayCount - todayIndex} * 100%)`,
                      }}
                    >
                      <div className="relative h-px bg-red-500">
                        <span className="absolute -left-14 -top-2.5 text-[10px] font-medium text-red-500">
                          {formatCurrentTimeLabel(now)}
                        </span>
                        <span className="absolute -right-1 -top-1 size-2 rounded-full bg-red-500" />
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {addTaskPopover && onAddCalendarTask ? (
        <CalendarAddTaskPopover
          date={addTaskPopover.date}
          dueTimeMinutes={addTaskPopover.dueTimeMinutes}
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
