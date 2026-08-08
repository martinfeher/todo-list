"use client";

import { useEffect, useMemo, useState } from "react";
import { BiChevronLeft, BiChevronRight } from "react-icons/bi";
import { CalendarAddTaskPopover } from "./calendar-add-task-popover";
import { CalendarTaskPopover } from "./calendar-task-popover";
import type { TaskListItem, TodoList } from "./todo-app";
import type { TaskDueTime } from "@/lib/task-due-time";
import { normalizeDueTimeMinutes } from "@/lib/task-due-time";
import { getCalendarShellClassName } from "@/lib/calendar-layout";
import {
  CALENDAR_TIME_SLOT_MINUTES,
  formatCalendarSlotTimeLabel,
  getMinutesFromCalendarGridY,
  getTopForCalendarMinutes,
  isCalendarSlotWithinTimedGrid,
  type CalendarDropSlot,
} from "@/lib/calendar-time-grid";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOUR_START = 8;
const HOUR_END = 21;
const HOUR_HEIGHT_PX = 52;

type CalendarDayViewProps = {
  tasks: TaskListItem[];
  lists: TodoList[];
  selectedTaskId: string | null;
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
  externalDropTargetTimeMinutes?: number | null;
};

function getActiveDropSlot(
  externalDropTargetDateKey: string | null,
  externalDropTargetTimeMinutes: number | null,
): CalendarDropSlot | null {
  if (!externalDropTargetDateKey) return null;

  return {
    dateKey: externalDropTargetDateKey,
    dueTimeMinutes: externalDropTargetTimeMinutes,
  };
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

function formatMonthYear(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatCurrentTimeLabel(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatHourLabel(hour: number) {
  if (hour === 12) return "Noon";
  return `${String(hour).padStart(2, "0")}:00`;
}

export function CalendarDayView({
  tasks,
  lists,
  selectedTaskId,
  onSelectTask,
  onSetTaskDueDate,
  onSetTaskDueTime,
  onMoveTaskToList,
  onAddCalendarTask,
  defaultListId = null,
  fullWidth = false,
  externalDropTargetDateKey = null,
  externalDropTargetTimeMinutes = null,
}: CalendarDayViewProps) {
  const [today, setToday] = useState<Date | null>(null);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
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

  useEffect(() => {
    const current = startOfDay(new Date());
    setToday(current);
    setSelectedDay(current);
    setNow(new Date());
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const hours = useMemo(
    () =>
      Array.from(
        { length: HOUR_END - HOUR_START + 1 },
        (_, index) => HOUR_START + index,
      ),
    [],
  );

  const dayTasks = useMemo(() => {
    if (!selectedDay) return { allDay: [], timed: [] };

    const key = toDateKey(selectedDay);
    const allDay: TaskListItem[] = [];
    const timed: TaskListItem[] = [];

    for (const task of tasks) {
      if (!task.dueDate) continue;

      const date = fromDateKey(task.dueDate.slice(0, 10));
      if (!date || toDateKey(date) !== key) continue;

      const dueTimeMinutes = normalizeDueTimeMinutes(task.dueTimeMinutes);
      if (dueTimeMinutes === null) {
        allDay.push(task);
      } else {
        timed.push(task);
      }
    }

    timed.sort(
      (a, b) =>
        (normalizeDueTimeMinutes(a.dueTimeMinutes) ?? 0) -
        (normalizeDueTimeMinutes(b.dueTimeMinutes) ?? 0),
    );

    return { allDay, timed };
  }, [tasks, selectedDay]);

  const popoverTask = useMemo(() => {
    if (!taskPopover) return null;
    return tasks.find((item) => item.id === taskPopover.task.id) ?? taskPopover.task;
  }, [taskPopover, tasks]);

  const currentTimeTop =
    now === null
      ? null
      : (now.getHours() + now.getMinutes() / 60 - HOUR_START) * HOUR_HEIGHT_PX;

  function goToPreviousDay() {
    if (!selectedDay) return;
    setSelectedDay(
      startOfDay(
        new Date(
          selectedDay.getFullYear(),
          selectedDay.getMonth(),
          selectedDay.getDate() - 1,
        ),
      ),
    );
  }

  function goToNextDay() {
    if (!selectedDay) return;
    setSelectedDay(
      startOfDay(
        new Date(
          selectedDay.getFullYear(),
          selectedDay.getMonth(),
          selectedDay.getDate() + 1,
        ),
      ),
    );
  }

  function goToToday() {
    const current = startOfDay(new Date());
    setSelectedDay(current);
  }

  function closeAddTaskPopover() {
    setAddTaskPopover(null);
    setDraftTaskName("");
  }

  function handleAllDayClick(event: React.MouseEvent<HTMLElement>) {
    if (!selectedDay) return;

    setTaskPopover(null);

    if (!onAddCalendarTask || lists.length === 0) return;

    setDraftTaskName("");
    setAddTaskPopover({
      date: selectedDay,
      x: event.clientX,
      y: event.clientY,
      dueTimeMinutes: null,
    });
  }

  function handleTimeGridClick(event: React.MouseEvent<HTMLDivElement>) {
    if (!selectedDay) return;

    event.stopPropagation();
    setTaskPopover(null);

    if (!onAddCalendarTask || lists.length === 0) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const y = event.clientY - rect.top;
    const dueTimeMinutes = getMinutesFromCalendarGridY(
      y,
      HOUR_START,
      HOUR_HEIGHT_PX,
    );
    const top = getTopForCalendarMinutes(
      dueTimeMinutes,
      HOUR_START,
      HOUR_HEIGHT_PX,
    );

    if (
      top < 0 ||
      top > (hours.length + 1) * HOUR_HEIGHT_PX
    ) {
      return;
    }

    setDraftTaskName("");
    setAddTaskPopover({
      date: selectedDay,
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
    onSelectTask(task.id);
    closeAddTaskPopover();
    setTaskPopover({
      task,
      x: event.clientX,
      y: event.clientY,
    });
  }

  useEffect(() => {
    if (!selectedDay) return;
    setTaskPopover(null);
    closeAddTaskPopover();
  }, [selectedDay]);

  if (!selectedDay || !today || !now) {
    return (
      <div className="flex min-h-0 flex-1 p-4">
        <div className="min-h-0 flex-1 animate-pulse rounded-lg bg-zinc-50 dark:bg-zinc-900/40" />
      </div>
    );
  }

  const dateKey = toDateKey(selectedDay);
  const isToday = isSameDay(selectedDay, today);
  const isActiveDay =
    addTaskPopover !== null && isSameDay(selectedDay, addTaskPopover.date);
  const activeDropSlot = getActiveDropSlot(
    externalDropTargetDateKey,
    externalDropTargetTimeMinutes,
  );
  const isAllDayDropTarget =
    activeDropSlot?.dateKey === dateKey &&
    activeDropSlot.dueTimeMinutes === null;
  const isTimedDropTarget =
    activeDropSlot?.dateKey === dateKey &&
    isCalendarSlotWithinTimedGrid(
      activeDropSlot.dueTimeMinutes,
      HOUR_START,
      HOUR_HEIGHT_PX,
      hours.length + 1,
    );
  const externalDropSlotMinutes = isTimedDropTarget
    ? (activeDropSlot?.dueTimeMinutes ?? null)
    : null;
  const selectedSlotMinutes =
    addTaskPopover?.dueTimeMinutes ??
    externalDropSlotMinutes ??
    null;
  const selectedSlotTop =
    selectedSlotMinutes === null
      ? null
      : getTopForCalendarMinutes(
          selectedSlotMinutes,
          HOUR_START,
          HOUR_HEIGHT_PX,
        );
  const showExternalDropMarker =
    isTimedDropTarget && !isActiveDay && externalDropSlotMinutes !== null;
  const showSelectedSlotMarker =
    selectedSlotTop !== null &&
    selectedSlotTop >= 0 &&
    selectedSlotTop <= (hours.length + 1) * HOUR_HEIGHT_PX &&
    ((isActiveDay && addTaskPopover?.dueTimeMinutes !== null) ||
      showExternalDropMarker);
  const showNowLine =
    isToday &&
    currentTimeTop !== null &&
    currentTimeTop >= 0 &&
    currentTimeTop <= (HOUR_END - HOUR_START + 1) * HOUR_HEIGHT_PX;

  return (
    <div className="flex min-h-0 flex-1 flex-col p-4">
      <div className={getCalendarShellClassName(fullWidth, "max-w-5xl")}>
        <div className="mb-4 flex shrink-0 items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {formatMonthYear(selectedDay)}
          </h2>
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
              aria-label="Previous day"
              onClick={goToPreviousDay}
              className="flex size-8 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <BiChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              aria-label="Next day"
              onClick={goToNextDay}
              className="flex size-8 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <BiChevronRight className="size-5" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <div className="grid min-w-[420px] grid-cols-[56px_minmax(0,1fr)]">
            <div className="sticky top-0 z-20 border-b border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950" />
            <div className="sticky top-0 z-20 border-b border-r border-zinc-200 bg-white px-2 py-2 text-center dark:border-zinc-800 dark:bg-zinc-950">
              <div className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                {WEEKDAY_LABELS[selectedDay.getDay()]}
              </div>
              <div
                className={`mt-1 inline-flex size-7 items-center justify-center rounded-full text-sm ${
                  isToday
                    ? "bg-[#4873c7] font-semibold text-white"
                    : "font-medium text-zinc-700 dark:text-zinc-200"
                }`}
              >
                {selectedDay.getDate()}
              </div>
            </div>

            <div className="border-b border-r border-zinc-200 px-2 py-2 text-[11px] text-zinc-400 dark:border-zinc-800">
              All day
            </div>
            <div
              data-calendar-day={dateKey}
              onClick={handleAllDayClick}
              className={`min-h-18 cursor-pointer border-b border-r border-zinc-200 p-1.5 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/60 ${
                isActiveDay && addTaskPopover?.dueTimeMinutes === null
                  ? "bg-blue-50 ring-1 ring-inset ring-[#4873c7] dark:bg-blue-950/30"
                  : isAllDayDropTarget
                    ? "bg-blue-50 ring-1 ring-inset ring-blue-400 dark:bg-blue-950/30"
                    : "bg-white dark:bg-zinc-950"
              }`}
            >
              <div className="space-y-1">
                {dayTasks.allDay.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleCalendarTaskClick(event, task);
                    }}
                    className={`block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] transition-colors ${
                      task.id === selectedTaskId
                        ? "bg-[#4873c7] text-white"
                        : "bg-[#dbeafe] text-[#1e3a8a] hover:bg-[#bfdbfe] dark:bg-blue-950/50 dark:text-blue-100"
                    }`}
                  >
                    {task.name}
                  </button>
                ))}
                {isActiveDay && addTaskPopover?.dueTimeMinutes === null ? (
                  <div
                    aria-hidden="true"
                    className="block h-4 truncate rounded bg-zinc-200/50 px-1.5 text-[11px] text-zinc-400 dark:bg-zinc-700"
                  >
                    {draftTaskName.trim() || ""}
                  </div>
                ) : null}
              </div>
            </div>

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
                  className="relative border-b border-zinc-200 px-2 py-2 text-[11px] text-zinc-400 dark:border-zinc-800"
                  style={{ height: HOUR_HEIGHT_PX }}
                >
                  {formatHourLabel(hour)}
                  <div className="pointer-events-none absolute inset-x-0 top-1/4 border-t border-dashed border-zinc-100 dark:border-zinc-800/80" />
                  <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-zinc-100 dark:border-zinc-800/80" />
                  <div className="pointer-events-none absolute inset-x-0 top-3/4 border-t border-dashed border-zinc-100 dark:border-zinc-800/80" />
                </div>
              ))}
              <div
                className="border-b border-zinc-200 px-2 py-3 text-[11px] text-zinc-400 dark:border-zinc-800"
                style={{ height: HOUR_HEIGHT_PX }}
              >
                21:00 - 00:00
              </div>

              {showSelectedSlotMarker && selectedSlotMinutes !== null ? (
                <div
                  className="pointer-events-none absolute inset-x-0 z-30"
                  style={{ top: selectedSlotTop }}
                >
                  <span className="absolute -top-2 left-1 text-[10px] font-semibold text-[#4873c7]">
                    {formatCalendarSlotTimeLabel(selectedSlotMinutes)}
                  </span>
                </div>
              ) : null}
            </div>

            <div
              data-calendar-day={dateKey}
              data-calendar-time-grid="true"
              data-hour-start={HOUR_START}
              data-hour-height={HOUR_HEIGHT_PX}
              className={`relative border-r border-zinc-200 dark:border-zinc-800 ${
                isTimedDropTarget ? "bg-blue-50/40 dark:bg-blue-950/20" : ""
              }`}
              onClick={handleTimeGridClick}
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
              <div
                className="cursor-pointer border-b border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/40"
                style={{ height: HOUR_HEIGHT_PX }}
              />

              {dayTasks.timed.map((task) => {
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
                    style={{ top, height }}
                    className={`absolute inset-x-1 z-10 overflow-hidden rounded px-1.5 py-0.5 text-left text-[11px] leading-tight transition-colors ${
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
                      <span className="absolute -left-14 -top-2.5 text-[10px] font-semibold text-[#4873c7]">
                        {formatCalendarSlotTimeLabel(selectedSlotMinutes)}
                      </span>
                      <span className="absolute -right-1 -top-1 size-2 rounded-full bg-[#4873c7]" />
                    </div>
                  </div>
                  {isActiveDay || showExternalDropMarker ? (
                    <div
                      aria-hidden="true"
                      style={{
                        top: selectedSlotTop,
                        height: Math.max(
                          16,
                          (CALENDAR_TIME_SLOT_MINUTES / 60) * HOUR_HEIGHT_PX,
                        ),
                      }}
                      className={`pointer-events-none absolute inset-x-1 z-10 overflow-hidden rounded border px-1.5 py-0.5 text-left text-[11px] ${
                        showExternalDropMarker
                          ? "border-blue-400/60 bg-blue-100/70 text-blue-700 dark:border-blue-500/50 dark:bg-blue-950/40 dark:text-blue-200"
                          : "border-[#4873c7]/40 bg-[#4873c7]/10 text-[#4873c7]"
                      }`}
                    >
                      {isActiveDay
                        ? draftTaskName.trim() ||
                          formatCalendarSlotTimeLabel(selectedSlotMinutes)
                        : formatCalendarSlotTimeLabel(selectedSlotMinutes)}
                    </div>
                  ) : null}
                </>
              ) : null}

              {showNowLine ? (
                <div
                  className="pointer-events-none absolute inset-x-0 z-20"
                  style={{ top: HOUR_HEIGHT_PX + currentTimeTop }}
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
