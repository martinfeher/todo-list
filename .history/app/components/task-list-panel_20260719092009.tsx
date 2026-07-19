"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import type { Task, TodoList } from "./todo-app";

type TaskListPanelProps = {
  list: TodoList | null;
  tasks: Task[];
  selectedTaskId: string | null;
  onAddTask: (name: string) => void;
  onToggleTask: (taskId: string) => void;
  onSelectTask: (taskId: string) => void;
  onRenameTask: (taskId: string, name: string) => void;
};

export function TaskListPanel({
  list,
  tasks,
  selectedTaskId,
  onAddTask,
  onToggleTask,
  onSelectTask,
  onRenameTask,
}: TaskListPanelProps) {
  const [newTaskName, setNewTaskName] = useState("");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);
  const titleEditReadyRef = useRef(false);

  useEffect(() => {
    setEditingTaskId(null);
    setTitleDraft("");
  }, [list?.id]);

  useEffect(() => {
    if (!editingTaskId) {
      titleEditReadyRef.current = false;
      return;
    }

    requestAnimationFrame(() => {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
      titleEditReadyRef.current = true;
    });
  }, [editingTaskId]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onAddTask(newTaskName);
    setNewTaskName("");
  }

  function startTitleEdit(task: Task) {
    setEditingTaskId(task.id);
    setTitleDraft(task.name);
  }

  function cancelTitleEdit(task: Task) {
    setTitleDraft(task.name);
    setEditingTaskId(null);
  }

  function commitTitleEdit(task: Task) {
    const trimmed = titleDraft.trim();

    if (!trimmed) {
      cancelTitleEdit(task);
      return;
    }

    if (trimmed !== task.name) {
      onRenameTask(task.id, trimmed);
    }

    setEditingTaskId(null);
  }

  function handleTitleKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>,
    task: Task,
  ) {
    if (event.key === "Enter") {
      event.preventDefault();
      commitTitleEdit(task);
    }

    if (event.key === "Escape") {
      event.preventDefault();
      cancelTitleEdit(task);
    }
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
            className="px-4 py-3 dark:border-zinc-800"
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
                className={`flex h-[35px] items-center gap-3 border-b border-zinc-100 px-4 dark:border-zinc-900 cursor-pointer ${
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

                {editingTaskId === task.id ? (
                  <input
                    ref={titleInputRef}
                    type="text"
                    value={titleDraft}
                    onChange={(event) => setTitleDraft(event.target.value)}
                    onBlur={() => {
                      if (!titleEditReadyRef.current) return;
                      commitTitleEdit(task);
                    }}
                    onKeyDown={(event) => handleTitleKeyDown(event, task)}
                    className="min-w-0 flex-1 rounded border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => onSelectTask(task.id)}
                    onDoubleClick={(event) => {
                      event.preventDefault();
                      startTitleEdit(task);
                    }}
                    className="min-w-0 flex-1 truncate text-left text-sm text-zinc-900 dark:text-zinc-50 cursor-pointer"
                  >
                    {task.name}
                  </button>
                )}
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
