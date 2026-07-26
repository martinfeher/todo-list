"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BiChevronLeft, BiChevronRight } from "react-icons/bi";
import { CalendarTaskPopover } from "./calendar-task-popover";
import { TaskListPanel } from "./task-list-panel";
import type { TaskListItem, TodoList } from "./todo-app";
import type { TaskDueTime } from "@/lib/task-due-time";

type CalendarTab = "list" | "calendar";

type CalendarPanelProps = {
  tasks: TaskListItem[];
  lists: TodoList[];
  completingTaskIds: Set<string>;
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
};

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const CALENDAR_TASK_DRAG_THRESHOLD_PX = 5;

type CalendarTaskDragState = {
  taskId: string;
  sourceDateKey: string;
  pointerId: number;
  captureTarget: HTMLElement;
};

function resolveCalendarDayFromPoint(clientX: number, clientY: number) {
  const element = document.elementFromPoint(clientX, clientY);
  if (!(element instanceof Element)) return null;

  const dayCell = element.closest("[data-calendar-day]");
  return dayCell?.getAttribute("data-calendar-day") ?? null;
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

function CalendarMonthView({
  tasks,
  selectedTaskId,
  onSelectTask,
  onToggleTask,
  onSetTaskDueDate,
  onSetTaskDueTime,
}: {
  tasks: TaskListItem[];
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
  onToggleTask: (taskId: string) => void;
  onSetTaskDueDate?: (taskId: string, dateValue: string | null) => void;
  onSetTaskDueTime?: (taskId: string, dueTime: TaskDueTime) => void;
}) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const [monthDate, setMonthDate] = useState(() => startOfDay(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const [taskPopover, setTaskPopover] = useState<{
    task: TaskListItem;
    x: number;
    y: number;
  } | null>(null);
  const [dropTargetDateKey, setDropTargetDateKey] = useState<string | null>(
    null,
  );
  const dragStateRef = useRef<CalendarTaskDragState | null>(null);
  const suppressTaskClickRef = useRef(false);

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

  const monthDays = useMemo(
    () => getFullMonthDays(monthDate.getFullYear(), monthDate.getMonth()),
    [monthDate],
  );
  const monthRowCount = Math.ceil(monthDays.length / 7);

  const selectedDateKey = toDateKey(selectedDate);
  const selectedDayTasks = tasksByDate.get(selectedDateKey) ?? [];
  const popoverTask = useMemo(() => {
    if (!taskPopover) return null;
    return tasks.find((item) => item.id === taskPopover.task.id) ?? taskPopover.task;
  }, [taskPopover, tasks]);

  function goToPreviousMonth() {
    setMonthDate(
      startOfDay(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1)),
    );
  }

  function goToNextMonth() {
    setMonthDate(
      startOfDay(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1)),
    );
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
    setTaskPopover(null);
  }, [monthDate]);

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col p-4">
        <div className="mx-auto flex h-full w-full max-w-6xl min-h-0 flex-col">
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

              const isDropTarget = dropTargetDateKey === dateKey;

              return (
                <div
                  key={dateKey}
                  data-calendar-day={dateKey}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedDate(day)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedDate(day);
                    }
                  }}
                  className={`h-full cursor-pointer border-r border-b border-zinc-200 p-2 text-left transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/60 ${
                    isDropTarget
                      ? "bg-blue-50 ring-2 ring-inset ring-blue-400 dark:bg-blue-950/30 dark:ring-blue-500"
                      : isSelected
                        ? "bg-zinc-100 ring-1 ring-inset ring-zinc-300 dark:bg-zinc-900 dark:ring-zinc-600"
                        : "bg-white dark:bg-zinc-950"
                  }`}
                >
                  <span
                    className={`inline-flex size-7 items-center justify-center rounded-full text-sm ${
                      isToday
                        ? "bg-zinc-900 font-semibold text-white dark:bg-zinc-50 dark:text-zinc-900"
                        : isCurrentMonth
                          ? "font-medium text-zinc-800 dark:text-zinc-100"
                          : "text-zinc-400"
                    }`}
                  >
                    {day.getDate()}
                  </span>

                  <div className="mt-1 space-y-0.5">
                    {dayTasks.slice(0, 3).map((task) => (
                      <button
                        key={task.id}
                        type="button"
                        onClick={(event) =>
                          handleCalendarTaskClick(event, task, day)
                        }
                        onPointerDown={(event) =>
                          handleCalendarTaskPointerDown(event, task, day)
                        }
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
                    {dayTasks.length > 3 && (
                      <span className="block px-1 text-[11px] text-zinc-400">
                        +{dayTasks.length - 3} more
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
                  <input
                    type="checkbox"
                    checked={task.completed}
                    onChange={() => onToggleTask(task.id)}
                    className="size-4 shrink-0 accent-zinc-900 dark:accent-zinc-50"
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

      {popoverTask && taskPopover ? (
        <CalendarTaskPopover
          task={popoverTask}
          x={taskPopover.x}
          y={taskPopover.y}
          onClose={() => setTaskPopover(null)}
          onSetTaskDueDate={onSetTaskDueDate}
          onSetTaskDueTime={onSetTaskDueTime}
        />
      ) : null}
    </div>
  );
}

export function CalendarPanel({
  tasks,
  lists,
  completingTaskIds,
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
        <CalendarMonthView
          tasks={tasks}
          selectedTaskId={selectedTaskId}
          onSelectTask={onSelectTask}
          onToggleTask={onToggleTask}
          onSetTaskDueDate={onSetTaskDueDate}
          onSetTaskDueTime={onSetTaskDueTime}
        />
      )}
    </section>
  );
}
