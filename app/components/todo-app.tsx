"use client";

import { useCallback, useState } from "react";
import {
  createTask,
  createTodoList,
  toggleTask as toggleTaskInDb,
} from "@/app/actions/todo";
import { Sidebar } from "./sidebar";
import { TaskDetailsPanel } from "./task-details-panel";
import { TaskListPanel } from "./task-list-panel";

export type Task = {
  id: string;
  name: string;
  completed: boolean;
  details: string;
};

export type TodoList = {
  id: string;
  name: string;
};

type TodoAppProps = {
  initialLists: TodoList[];
  initialTasksByList: Record<string, Task[]>;
};

export function TodoApp({ initialLists, initialTasksByList }: TodoAppProps) {
  const [lists, setLists] = useState(initialLists);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [tasksByList, setTasksByList] = useState(initialTasksByList);

  const selectedList = lists.find((list) => list.id === selectedListId) ?? null;
  const tasks = selectedListId ? (tasksByList[selectedListId] ?? []) : [];

  function selectList(listId: string) {
    setSelectedListId(listId);
    setSelectedTaskId(null);
  }

  async function addList() {
    const list = await createTodoList(`List ${lists.length + 1}`);
    setLists((current) => [...current, { id: list.id, name: list.name }]);
    setTasksByList((current) => ({ ...current, [list.id]: [] }));
    setSelectedListId(list.id);
  }

  async function addTask(name: string) {
    if (!selectedListId || !name.trim()) return;

    const task = await createTask(selectedListId, name.trim());
    const newTask: Task = {
      id: task.id,
      name: task.name,
      completed: task.completed,
      details: task.details,
    };

    setTasksByList((current) => ({
      ...current,
      [selectedListId]: [...(current[selectedListId] ?? []), newTask],
    }));
  }

  async function toggleTask(taskId: string) {
    if (!selectedListId) return;

    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;

    const completed = !task.completed;
    await toggleTaskInDb(taskId, completed);

    setTasksByList((current) => ({
      ...current,
      [selectedListId]: (current[selectedListId] ?? []).map((item) =>
        item.id === taskId ? { ...item, completed } : item,
      ),
    }));
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

  return (
    <div className="flex min-h-full flex-1">
      <Sidebar
        lists={lists}
        selectedListId={selectedListId}
        onSelectList={selectList}
        onAddList={addList}
      />
      <TaskListPanel
        list={selectedList}
        tasks={tasks}
        selectedTaskId={selectedTaskId}
        onAddTask={addTask}
        onToggleTask={toggleTask}
        onSelectTask={setSelectedTaskId}
      />
      <TaskDetailsPanel
        taskId={selectedTaskId}
        onDetailsSaved={handleDetailsSaved}
      />
    </div>
  );
}
