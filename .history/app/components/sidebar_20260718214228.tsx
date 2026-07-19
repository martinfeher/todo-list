"use client";

import { useState } from "react";
import type { CompletedTask, TodoList } from "./todo-app";

const NAV_ITEMS = ["Search", "Important", "Today"] as const;

type SidebarProps = {
  lists: TodoList[];
  completedTasks: CompletedTask[];
  selectedListId: string | null;
  selectedTaskId: string | null;
  onSelectList: (listId: string) => void;
  onSelectCompletedTask: (taskId: string, listId: string) => void;
  onAddList: () => void;
};

const itemClassName =
  "flex w-full items-center px-4 text-left text-sm transition-colors";

const completedItemClassName =
  "flex min-h-[44px] w-full flex-col items-start justify-center gap-0 px-4 py-1 text-left text-sm transition-colors";

function getItemClassName(isSelected: boolean, baseClassName = itemClassName) {
  const heightClass =
    baseClassName === completedItemClassName ? "" : "h-[35px]";

  return `${baseClassName} ${heightClass} ${
    isSelected
      ? "bg-zinc-200/80 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
      : "text-zinc-900 hover:bg-zinc-200/60 dark:text-zinc-50 dark:hover:bg-zinc-800/60"
  }`;
}

export function Sidebar({
  lists,
  completedTasks,
  selectedListId,
  selectedTaskId,
  onSelectList,
  onSelectCompletedTask,
  onAddList,
}: SidebarProps) {
  const [isCompletedOpen, setIsCompletedOpen] = useState(false);

  return (
    <aside className="flex w-[250px] shrink-0 flex-col border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
      <nav className="flex flex-col">
        {NAV_ITEMS.map((label) => (
          <button key={label} type="button" className={getItemClassName(false)}>
            {label}
          </button>
        ))}
qqq
        {lists.map((list) => (
          <button
            key={list.id}
            type="button"
            className={getItemClassName(list.id === selectedListId)}
            onClick={() => onSelectList(list.id)}
          >
            {list.name}
          </button>
        ))}

        <button
          type="button"
          className={getItemClassName(false)}
          onClick={onAddList}
        >
          New list
        </button>
      </nav>

      <div className="mt-auto border-t border-zinc-200 dark:border-zinc-800">
        <button
          type="button"
          className={getItemClassName(isCompletedOpen)}
          onClick={() => setIsCompletedOpen((open) => !open)}
        >
          Completed
        </button>

        {isCompletedOpen &&
          (completedTasks.length === 0 ? (
            <p className="px-4 pb-3 text-xs text-zinc-400 dark:text-zinc-500">
              No completed tasks
            </p>
          ) : (
            <div className="max-h-[280px] overflow-y-auto">
              {completedTasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  className={getItemClassName(
                    task.id === selectedTaskId,
                    completedItemClassName,
                  )}
                  onClick={() => onSelectCompletedTask(task.id, task.listId)}
                >
                  <span className="w-full truncate text-zinc-400 line-through dark:text-zinc-500">
                    {task.name}
                  </span>
                  <span className="w-full truncate text-xs text-zinc-400 dark:text-zinc-500">
                    {task.listName}
                  </span>
                </button>
              ))}
            </div>
          ))}
      </div>
    </aside>
  );
}
