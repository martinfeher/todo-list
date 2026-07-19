"use client";

import { FormEvent, useState } from "react";
import type { Task, TodoList } from "./todo-app";

type TaskListPanelProps = {
  list: TodoList | null;
  tasks: Task[];
  selectedTaskId: string | null;
  onAddTask: (name: string) => void;
  onToggleTask: (taskId: string) => void;
  onSelectTask: (taskId: string) => void;
};

export function TaskListPanel({
  list,
  tasks,
  selectedTaskId,
  onAddTask,
  onToggleTask,
  onSelectTask,
}: TaskListPanelProps) {
  const [newTaskName, setNewTaskName] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onAddTask(newTaskName);
    setNewTaskName("");
  }

  return (
    <section className="w-full max-w-[380px] shrink-0 border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      {list ? (
        <div className="flex flex-col">
          <header className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              {list.name}
            </h1>
          </header>

          <form
            onSubmit={handleSubmit}
            className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800"
          >
            <input
              type="text"
              value={newTaskName}
              onChange={(event) => setNewTaskName(event.target.value)}
              placeholder="Add New Task"
              className="h-[35px] w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-500"
            />
          </form>

          <ul className="flex flex-col">
            {tasks.map((task) => (
              <li
                key={task.id}
                className={`flex h-[35px] items-center gap-3 border-b border-zinc-100 px-4 dark:border-zinc-900 ${
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
                <button
                  type="button"
                  onClick={() => onSelectTask(task.id)}
                  className="min-w-0 flex-1 truncate text-left text-sm text-zinc-900 dark:text-zinc-50"
                >
                  {task.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="p-4">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Select a list to view tasks
          </p>
        </div>
      )}
    </section>
  );
}
