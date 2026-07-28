"use client";

import { useEffect, useMemo, useRef } from "react";
import { BiSearch } from "react-icons/bi";
import { LuCheck, LuInbox, LuList } from "react-icons/lu";
import type { TodoList } from "./todo-app";

type TaskMoveToSelectorProps = {
  lists: TodoList[];
  currentListId: string | null;
  query: string;
  onQueryChange: (value: string) => void;
  onSelectList: (listId: string) => void;
  onCancel: () => void;
  showCurrentList?: boolean;
};

function getListIcon(name: string) {
  if (name.trim().toLowerCase() === "inbox") {
    return LuInbox;
  }

  return LuList;
}

export function TaskMoveToSelector({
  lists,
  currentListId,
  query,
  onQueryChange,
  onSelectList,
  onCancel,
  showCurrentList = false,
}: TaskMoveToSelectorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const trimmedQuery = query.trim();

  useEffect(() => {
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, []);

  const filteredLists = useMemo(() => {
    const candidates = showCurrentList
      ? lists
      : lists.filter((list) => list.id !== currentListId);
    const normalized = trimmedQuery.toLowerCase();
    if (!normalized) return candidates;

    return candidates.filter((list) =>
      list.name.toLowerCase().includes(normalized),
    );
  }, [currentListId, lists, showCurrentList, trimmedQuery]);

  return (
    <div
      role="dialog"
      aria-label="Move to list"
      className="w-[240px] overflow-hidden rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="border-b border-zinc-200 px-3 py-2.5 dark:border-zinc-700">
        <div className="flex items-center gap-2">
          <BiSearch className="size-4 shrink-0 text-zinc-400" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search"
            aria-label="Search lists"
            className="min-w-0 flex-1 bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-50"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                onCancel();
              }
            }}
          />
        </div>
      </div>

      <div className="max-h-[240px] overflow-y-auto py-1">
        {filteredLists.length === 0 ? (
          <p className="px-4 py-3 text-sm text-zinc-400 dark:text-zinc-500">
            {trimmedQuery ? "No matching lists" : "No lists"}
          </p>
        ) : (
          filteredLists.map((list) => {
            const Icon = getListIcon(list.name);
            const isCurrent = list.id === currentListId;

            return (
              <button
                key={list.id}
                type="button"
                disabled={showCurrentList && isCurrent}
                onClick={() => onSelectList(list.id)}
                className={`flex h-[38px] w-full items-center gap-2.5 px-4 text-left text-sm transition-colors ${
                  showCurrentList && isCurrent
                    ? "cursor-default text-[#4873c7] dark:text-[#7da2ff]"
                    : "text-zinc-800 hover:bg-zinc-50 dark:text-zinc-100 dark:hover:bg-zinc-800/70"
                }`}
              >
                <Icon
                  className={`size-4 shrink-0 ${
                    showCurrentList && isCurrent
                      ? "text-[#4873c7] dark:text-[#7da2ff]"
                      : "text-zinc-500 dark:text-zinc-400"
                  }`}
                />
                <span className="min-w-0 flex-1 truncate">{list.name}</span>
                {showCurrentList && isCurrent ? (
                  <LuCheck className="size-4 shrink-0" aria-hidden="true" />
                ) : null}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
