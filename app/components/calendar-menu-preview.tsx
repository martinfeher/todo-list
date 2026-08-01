"use client";

import { useMemo } from "react";
import { createPortal } from "react-dom";
import {
  formatDueTimeLabel,
  normalizeDueDurationMinutes,
  normalizeDueTimeMinutes,
} from "@/lib/task-due-time";
import type { TaskListItem } from "./todo-app";

type CalendarMenuPreviewProps = {
  tasks: TaskListItem[];
  top: number;
  left: number;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
};

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function compareTasksByTime(a: TaskListItem, b: TaskListItem) {
  const aMinutes = normalizeDueTimeMinutes(a.dueTimeMinutes);
  const bMinutes = normalizeDueTimeMinutes(b.dueTimeMinutes);

  if (aMinutes === null && bMinutes === null) {
    return a.name.localeCompare(b.name);
  }

  if (aMinutes === null) return 1;
  if (bMinutes === null) return -1;
  if (aMinutes !== bMinutes) return aMinutes - bMinutes;

  return a.name.localeCompare(b.name);
}

function formatDueTimeRange(
  dueTimeMinutes: number | null,
  dueDurationMinutes: number | null,
) {
  const start = formatDueTimeLabel(dueTimeMinutes);
  if (!start) return null;

  const duration = normalizeDueDurationMinutes(dueDurationMinutes);
  if (!duration) return start;

  const startMinutes = normalizeDueTimeMinutes(dueTimeMinutes);
  if (startMinutes === null) return start;

  const end = formatDueTimeLabel(startMinutes + duration);
  if (!end) return start;

  const startPeriod = start.match(/ (AM|PM)$/)?.[1];
  const endPeriod = end.match(/ (AM|PM)$/)?.[1];
  const startWithoutPeriod = start.replace(/ (AM|PM)$/, "");

  if (startPeriod && startPeriod === endPeriod) {
    return `${startWithoutPeriod} – ${end}`;
  }

  return `${start} – ${end}`;
}

function formatMonthDay(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatWeekday(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
  }).format(date);
}

type PreviewDaySectionProps = {
  heading: string;
  subheading: string;
  highlight?: boolean;
  tasks: TaskListItem[];
  emptyMessage: string;
};

function PreviewDaySection({
  heading,
  subheading,
  highlight = false,
  tasks,
  emptyMessage,
}: PreviewDaySectionProps) {
  return (
    <div className="flex gap-3 py-3 first:pt-0 last:pb-0">
      <div className="w-[52px] shrink-0 pt-0.5">
        <p
          className={`text-[11px] font-medium leading-tight ${
            highlight
              ? "text-[#eb5757] dark:text-[#ff7b72]"
              : "text-zinc-400 dark:text-zinc-500"
          }`}
        >
          {heading}
        </p>
        <p
          className={`mt-0.5 text-sm font-semibold leading-tight ${
            highlight
              ? "text-[#eb5757] dark:text-[#ff7b72]"
              : "text-zinc-500 dark:text-zinc-400"
          }`}
        >
          {subheading}
        </p>
      </div>
      <div className="min-w-0 flex-1">
        {tasks.length === 0 ? (
          <p className="py-1 text-sm text-zinc-400 dark:text-zinc-500">
            {emptyMessage}
          </p>
        ) : (
          <ul className="space-y-3">
            {tasks.map((task) => {
              const timeLabel = formatDueTimeRange(
                task.dueTimeMinutes,
                task.dueDurationMinutes,
              );

              return (
                <li
                  key={task.id}
                  className="flex gap-2 border-l-2 border-zinc-200 pl-2 dark:border-zinc-700"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      {task.name}
                    </p>
                    {timeLabel ? (
                      <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">
                        {timeLabel}
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export function CalendarMenuPreview({
  tasks,
  top,
  left,
  onMouseEnter,
  onMouseLeave,
}: CalendarMenuPreviewProps) {
  const { todayTasks, tomorrowTasks, today, tomorrow } = useMemo(() => {
    const todayDate = new Date();
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);

    const todayKey = toDateKey(todayDate);
    const tomorrowKey = toDateKey(tomorrowDate);

    const todayItems = tasks
      .filter((task) => task.dueDate?.slice(0, 10) === todayKey)
      .sort(compareTasksByTime);
    const tomorrowItems = tasks
      .filter((task) => task.dueDate?.slice(0, 10) === tomorrowKey)
      .sort(compareTasksByTime);

    return {
      today: todayDate,
      tomorrow: tomorrowDate,
      todayTasks: todayItems,
      tomorrowTasks: tomorrowItems,
    };
  }, [tasks]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="glass-card fixed z-[100] flex h-[300px] w-[300px] flex-col"
      style={{ top, left }}
      role="region"
      aria-label="Calendar preview"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="relative z-[1] min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <PreviewDaySection
          heading="Today"
          subheading={formatMonthDay(today)}
          highlight
          tasks={todayTasks}
          emptyMessage="No more events"
        />
        <PreviewDaySection
          heading={formatWeekday(tomorrow)}
          subheading={formatMonthDay(tomorrow)}
          tasks={tomorrowTasks}
          emptyMessage="No events"
        />
      </div>
    </div>
    ,
    document.body,
  );
}
