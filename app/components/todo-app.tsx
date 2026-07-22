"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createTask,
  createTodoList,
  deleteTodoList,
  renameTask as renameTaskInDb,
  renameTodoList,
  reorderTasks as reorderTasksInDb,
  toggleTask as toggleTaskInDb,
  updateTaskDueDate as updateTaskDueDateInDb,
  updateTaskDueTime as updateTaskDueTimeInDb,
  updateTaskPriority as updateTaskPriorityInDb,
} from "@/app/actions/todo";
import type { TaskDueTime } from "@/lib/task-due-time";
import { Sidebar } from "./sidebar";
import { CalendarPanel } from "./calendar-panel";
import { TaskDetailsPanel } from "./task-details-panel";
import { TaskListPanel } from "./task-list-panel";
import { mergeReorderedActiveTasks } from "./task-reorder";
import { UndoButton } from "./undo-button";

export type Task = {
  id: string;
  name: string;
  completed: boolean;
  details: string;
  dueDate: string | null;
  dueTimeMinutes: number | null;
  dueDurationMinutes: number | null;
  dueTimeZone: string;
  priority: number | null;
};

export type TodoList = {
  id: string;
  name: string;
};

export type CompletedTask = Task & {
  listId: string;
  listName: string;
};

export type SearchTask = Task & {
  listId: string;
  listName: string;
};

type PendingUndo = {
  taskId: string;
  listId: string;
  taskName: string;
};

type TodoAppProps = {
  initialLists: TodoList[];
  initialTasksByList: Record<string, Task[]>;
};

const UNDO_VISIBLE_MS = 7000;

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

function isDueToday(dueDate: string | null) {
  if (!dueDate) return false;

  const date = new Date(dueDate);
  if (Number.isNaN(date.getTime())) return false;

  return isSameDay(startOfDay(date), startOfDay(new Date()));
}

function getVisibleTasks(
  activeView: "today" | "calendar" | null,
  listId: string | null,
  lists: TodoList[],
  tasksByList: Record<string, Task[]>,
): TaskListItem[] {
  if (activeView === "today") {
    return lists.flatMap((list) =>
      (tasksByList[list.id] ?? [])
        .filter((task) => !task.completed && isDueToday(task.dueDate))
        .map((task) => ({
          ...task,
          listName: list.name,
        })),
    );
  }

  if (activeView === "calendar") {
    return lists
      .flatMap((list) =>
        (tasksByList[list.id] ?? [])
          .filter((task) => !task.completed && task.dueDate)
          .map((task) => ({
            ...task,
            listName: list.name,
          })),
      )
      .sort((a, b) => {
        const aTime = new Date(a.dueDate!).getTime();
        const bTime = new Date(b.dueDate!).getTime();
        return aTime - bTime;
      });
  }

  if (!listId) return [];

  return (tasksByList[listId] ?? []).filter((task) => !task.completed);
}

function getFirstVisibleTaskId(
  activeView: "today" | "calendar" | null,
  listId: string | null,
  lists: TodoList[],
  tasksByList: Record<string, Task[]>,
) {
  return getVisibleTasks(activeView, listId, lists, tasksByList)[0]?.id ?? null;
}

export type TaskListItem = Task & {
  listName?: string;
};

export function TodoApp({ initialLists, initialTasksByList }: TodoAppProps) {
  const [lists, setLists] = useState(initialLists);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"today" | "calendar" | null>(null);
  const [tasksByList, setTasksByList] = useState(initialTasksByList);
  const [pendingUndo, setPendingUndo] = useState<PendingUndo | null>(null);
  const undoTimerRef = useRef<number | null>(null);

  const selectedList = lists.find((list) => list.id === selectedListId) ?? null;
  const allTasksInList = selectedListId ? (tasksByList[selectedListId] ?? []) : [];
  const activeTasks = allTasksInList.filter((task) => !task.completed);

  const todayTasks: TaskListItem[] = getVisibleTasks("today", null, lists, tasksByList);

  const calendarTasks: TaskListItem[] = getVisibleTasks(
    "calendar",
    null,
    lists,
    tasksByList,
  );

  const taskListTitle =
    activeView === "today"
      ? "Today"
      : activeView === "calendar"
        ? "Calendar"
        : (selectedList?.name ?? null);
  const taskListItems: TaskListItem[] =
    activeView === "today"
      ? todayTasks
      : activeView === "calendar"
        ? calendarTasks
        : activeTasks;

  const completedTasks: CompletedTask[] = useMemo(
    () =>
      lists.flatMap((list) =>
        (tasksByList[list.id] ?? [])
          .filter((task) => task.completed)
          .map((task) => ({
            ...task,
            listId: list.id,
            listName: list.name,
          })),
      ),
    [lists, tasksByList],
  );

  const searchTasks: SearchTask[] = useMemo(
    () =>
      lists.flatMap((list) =>
        (tasksByList[list.id] ?? []).map((task) => ({
          ...task,
          listId: list.id,
          listName: list.name,
        })),
      ),
    [lists, tasksByList],
  );

  const clearUndoTimer = useCallback(() => {
    if (undoTimerRef.current !== null) {
      window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
  }, []);

  const scheduleUndo = useCallback(
    (undo: PendingUndo) => {
      clearUndoTimer();
      setPendingUndo(undo);

      undoTimerRef.current = window.setTimeout(() => {
        setPendingUndo(null);
        undoTimerRef.current = null;
      }, UNDO_VISIBLE_MS);
    },
    [clearUndoTimer],
  );

  const dismissUndo = useCallback(() => {
    clearUndoTimer();
    setPendingUndo(null);
  }, [clearUndoTimer]);

  useEffect(() => {
    return () => {
      clearUndoTimer();
    };
  }, [clearUndoTimer]);

  function selectList(listId: string) {
    setActiveView(null);
    setSelectedListId(listId);
    setSelectedTaskId(
      getFirstVisibleTaskId(null, listId, lists, tasksByList),
    );
  }

  function selectToday() {
    setActiveView("today");
    setSelectedListId(null);
    setSelectedTaskId(getFirstVisibleTaskId("today", null, lists, tasksByList));
  }

  function selectCalendar() {
    setActiveView("calendar");
    setSelectedListId(null);
    setSelectedTaskId(null);
  }

  function selectCompletedTask(taskId: string, listId: string) {
    setActiveView(null);
    setSelectedListId(listId);
    setSelectedTaskId(taskId);
  }

  async function addList(name: string) {
    if (!name.trim()) return;

    const list = await createTodoList(name.trim());
    setLists((current) => [...current, { id: list.id, name: list.name }]);
    setTasksByList((current) => ({ ...current, [list.id]: [] }));
    setActiveView(null);
    setSelectedListId(list.id);
    setSelectedTaskId(null);
  }

  async function renameList(listId: string, name: string) {
    const list = await renameTodoList(listId, name);
    setLists((current) =>
      current.map((item) =>
        item.id === listId ? { ...item, name: list.name } : item,
      ),
    );
  }

  async function removeList(listId: string) {
    const removedTasks = tasksByList[listId] ?? [];

    await deleteTodoList(listId);

    setLists((current) => current.filter((item) => item.id !== listId));
    setTasksByList((current) => {
      const next = { ...current };
      delete next[listId];
      return next;
    });

    if (selectedListId === listId) {
      setSelectedListId(null);
    }

    if (selectedTaskId && removedTasks.some((task) => task.id === selectedTaskId)) {
      setSelectedTaskId(null);
    }
  }

  async function addTask(name: string) {
    if (!selectedListId || !name.trim()) return;

    const task = await createTask(selectedListId, name.trim());
    const newTask: Task = {
      id: task.id,
      name: task.name,
      completed: task.completed,
      details: task.details,
      dueDate: null,
      dueTimeMinutes: null,
      dueDurationMinutes: null,
      dueTimeZone: "floating",
      priority: null,
    };

    setTasksByList((current) => ({
      ...current,
      [selectedListId]: [...(current[selectedListId] ?? []), newTask],
    }));
  }

  async function toggleTask(taskId: string) {
    let listId = selectedListId;

    if (!listId) {
      for (const [id, listTasks] of Object.entries(tasksByList)) {
        if (listTasks.some((item) => item.id === taskId)) {
          listId = id;
          break;
        }
      }
    }

    if (!listId) return;

    const task = (tasksByList[listId] ?? []).find((item) => item.id === taskId);
    if (!task) return;

    const completed = !task.completed;

    if (completed) {
      scheduleUndo({
        taskId,
        listId,
        taskName: task.name,
      });

      if (selectedTaskId === taskId) {
        setSelectedTaskId(null);
      }
    } else {
      dismissUndo();
    }

    await toggleTaskInDb(taskId, completed);

    setTasksByList((current) => ({
      ...current,
      [listId]: (current[listId] ?? []).map((item) =>
        item.id === taskId ? { ...item, completed } : item,
      ),
    }));
  }

  async function handleUndo() {
    if (!pendingUndo) return;

    const { taskId, listId } = pendingUndo;
    await toggleTaskInDb(taskId, false);

    setTasksByList((current) => ({
      ...current,
      [listId]: (current[listId] ?? []).map((item) =>
        item.id === taskId ? { ...item, completed: false } : item,
      ),
    }));

    dismissUndo();
  }

  const handleDetailsSaved = useCallback((taskId: string, details: string) => {
    setTasksByList((current) => {
      const next = { ...current };

      for (const listId of Object.keys(next)) {
        next[listId] = next[listId].map((task) =>
          task.id === taskId ? { ...task, details } : task,
        );
      }

      return next;
    });
  }, []);

  const handleTaskRenamed = useCallback((taskId: string, name: string) => {
    setTasksByList((current) => {
      const next = { ...current };

      for (const listId of Object.keys(next)) {
        next[listId] = next[listId].map((task) =>
          task.id === taskId ? { ...task, name } : task,
        );
      }

      return next;
    });
  }, []);

  const handleDueDateUpdated = useCallback(
    (
      taskId: string,
      dueDate: string | null,
      dueTime?: {
        dueTimeMinutes: number | null;
        dueDurationMinutes: number | null;
        dueTimeZone: string;
      },
    ) => {
      setTasksByList((current) => {
        const next = { ...current };

        for (const listId of Object.keys(next)) {
          next[listId] = next[listId].map((task) =>
            task.id === taskId
              ? {
                  ...task,
                  dueDate,
                  ...(dueTime ?? {}),
                }
              : task,
          );
        }

        return next;
      });
    },
    [],
  );

  const handlePriorityUpdated = useCallback(
    (taskId: string, priority: number | null) => {
      setTasksByList((current) => {
        const next = { ...current };

        for (const listId of Object.keys(next)) {
          next[listId] = next[listId].map((task) =>
            task.id === taskId ? { ...task, priority } : task,
          );
        }

        return next;
      });
    },
    [],
  );

  async function renameTask(taskId: string, name: string) {
    const updatedTask = await renameTaskInDb(taskId, name);
    handleTaskRenamed(taskId, updatedTask.name);
  }

  const handleDueTimeUpdated = useCallback(
    (taskId: string, dueTime: TaskDueTime) => {
      setTasksByList((current) => {
        const next = { ...current };

        for (const listId of Object.keys(next)) {
          next[listId] = next[listId].map((task) =>
            task.id === taskId
              ? {
                  ...task,
                  dueTimeMinutes: dueTime.dueTimeMinutes,
                  dueDurationMinutes: dueTime.dueDurationMinutes,
                  dueTimeZone: dueTime.dueTimeZone,
                }
              : task,
          );
        }

        return next;
      });
    },
    [],
  );

  async function setTaskDueTime(taskId: string, dueTime: TaskDueTime) {
    const updated = await updateTaskDueTimeInDb(taskId, dueTime);
    handleDueTimeUpdated(taskId, {
      dueTimeMinutes: updated.dueTimeMinutes,
      dueDurationMinutes: updated.dueDurationMinutes,
      dueTimeZone: updated.dueTimeZone,
    });
  }

  async function setTaskDueDate(taskId: string, dateValue: string | null) {
    const updated = await updateTaskDueDateInDb(taskId, dateValue);
    const dueDate = updated.dueDate
      ? new Date(updated.dueDate).toISOString()
      : null;

    handleDueDateUpdated(taskId, dueDate, {
      dueTimeMinutes: updated.dueTimeMinutes,
      dueDurationMinutes: updated.dueDurationMinutes,
      dueTimeZone: updated.dueTimeZone,
    });
  }

  async function setTaskPriority(taskId: string, priority: number | null) {
    const updated = await updateTaskPriorityInDb(taskId, priority);
    handlePriorityUpdated(taskId, updated.priority);
  }

  async function reorderTasks(listId: string, activeTaskIds: string[]) {
    const currentTasks = tasksByList[listId] ?? [];
    const expectedActiveCount = currentTasks.filter(
      (task) => !task.completed,
    ).length;

    if (activeTaskIds.length !== expectedActiveCount) return;

    const mergedTasks = mergeReorderedActiveTasks(
      currentTasks,
      activeTaskIds,
    );

    setTasksByList((current) => ({
      ...current,
      [listId]: mergedTasks,
    }));

    await reorderTasksInDb(
      listId,
      mergedTasks.map((task) => task.id),
    );
  }

  const showDetailsPanel = selectedTaskId !== null;

  return (
    <>
      <div className="flex min-h-full flex-1">
        <Sidebar
          lists={lists}
          completedTasks={completedTasks}
          searchTasks={searchTasks}
          selectedListId={selectedListId}
          isTodaySelected={activeView === "today"}
          isCalendarSelected={activeView === "calendar"}
          selectedTaskId={selectedTaskId}
          onSelectList={selectList}
          onSelectToday={selectToday}
          onSelectCalendar={selectCalendar}
          onSelectCompletedTask={selectCompletedTask}
          onSelectSearchTask={selectCompletedTask}
          onToggleTask={toggleTask}
          onAddList={addList}
          onRenameList={renameList}
          onRemoveList={removeList}
        />
        {activeView === "calendar" ? (
          <CalendarPanel
            tasks={calendarTasks}
            selectedTaskId={selectedTaskId}
            onToggleTask={toggleTask}
            onSelectTask={setSelectedTaskId}
            onRenameTask={renameTask}
            onSetTaskDueDate={setTaskDueDate}
            onSetTaskDueTime={setTaskDueTime}
            onSetTaskPriority={setTaskPriority}
          />
        ) : (
          <>
            <TaskListPanel
              title={taskListTitle}
              tasks={taskListItems}
              selectedTaskId={selectedTaskId}
              expanded={!showDetailsPanel}
              showAddTask={selectedListId !== null}
              listId={selectedListId}
              onAddTask={addTask}
              onToggleTask={toggleTask}
              onSelectTask={setSelectedTaskId}
              onRenameTask={renameTask}
              onReorderTasks={reorderTasks}
              onSetTaskDueDate={setTaskDueDate}
              onSetTaskDueTime={setTaskDueTime}
              onSetTaskPriority={setTaskPriority}
            />
            {showDetailsPanel && (
              <TaskDetailsPanel
                taskId={selectedTaskId}
                onDetailsSaved={handleDetailsSaved}
                onTaskRenamed={handleTaskRenamed}
                onDueDateUpdated={handleDueDateUpdated}
              />
            )}
          </>
        )}
      </div>
      <UndoButton
        visible={pendingUndo !== null}
        taskName={pendingUndo?.taskName ?? ""}
        onUndo={handleUndo}
      />
    </>
  );
}
