"use client";

import type { TodoList } from "./todo-app";

const NAV_ITEMS = ["Search", "Important", "Today"] as const;

type SidebarProps = {
  lists: TodoList[];
  selectedListId: string | null;
  onSelectList: (listId: string) => void;
  onAddList: () => void;
};

const itemClassName =
  "flex h-[35px] w-full items-center px-4 text-left text-sm transition-colors";

function getItemClassName(isSelected: boolean) {
  return `${itemClassName} ${
    isSelected
      ? "bg-zinc-200/80 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
      : "text-zinc-900 hover:bg-zinc-200/60 dark:text-zinc-50 dark:hover:bg-zinc-800/60"
  }`;
}

export function Sidebar({
  lists,
  selectedListId,
  onSelectList,
  onAddList,
}: SidebarProps) {
  return (
    <aside className="w-[250px] shrink-0 border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
      <nav className="flex flex-col">
        {NAV_ITEMS.map((label) => (
          <button key={label} type="button" className={getItemClassName(false)}>
            {label}
          </button>
        ))}

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
    </aside>
  );
}
