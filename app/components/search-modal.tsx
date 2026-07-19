"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { BiSearch } from "react-icons/bi";
import type { SearchTask } from "./todo-app";

type SearchModalProps = {
  open: boolean;
  tasks: SearchTask[];
  onClose: () => void;
  onSelectTask: (taskId: string, listId: string) => void;
  onToggleTask: (taskId: string) => void;
};

const SEARCH_RESULT_LIMIT = 50;

type IndexedSearchTask = SearchTask & {
  normalizedName: string;
};

function buildSearchIndex(tasks: SearchTask[]) {
  return tasks.map((task) => ({
    ...task,
    normalizedName: task.name.toLowerCase(),
  }));
}

function filterTasks(index: IndexedSearchTask[], query: string) {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];

  const matches: IndexedSearchTask[] = [];

  for (const task of index) {
    if (task.normalizedName.includes(trimmed)) {
      matches.push(task);
      if (matches.length >= SEARCH_RESULT_LIMIT) break;
    }
  }

  return matches;
}

export function SearchModal({
  open,
  tasks,
  onClose,
  onSelectTask,
  onToggleTask,
}: SearchModalProps) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const inputRef = useRef<HTMLInputElement>(null);
  const isFiltering = query !== deferredQuery;

  const searchIndex = useMemo(
    () => (open ? buildSearchIndex(tasks) : []),
    [open, tasks],
  );

  const results = useMemo(
    () => filterTasks(searchIndex, deferredQuery),
    [deferredQuery, searchIndex],
  );

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }

    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const trimmedQuery = query.trim();

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[12vh]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="search-modal-title"
        className="flex max-h-[min(70vh,520px)] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-xl dark:bg-zinc-900"
      >
        <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h2 id="search-modal-title" className="sr-only">
            Search tasks
          </h2>
          <div className="flex items-center gap-2">
            <BiSearch className="size-5 shrink-0 text-zinc-400" />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search tasks"
              className="h-[35px] w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-50"
            />
          </div>
        </div>

        <div
          className={`min-h-0 flex-1 overflow-y-auto transition-opacity ${
            isFiltering ? "opacity-70" : "opacity-100"
          }`}
        >
          {!trimmedQuery ? (
            <p className="px-4 py-6 text-sm text-zinc-500 dark:text-zinc-400">
              Start typing to search task names
            </p>
          ) : results.length === 0 ? (
            <p className="px-4 py-6 text-sm text-zinc-500 dark:text-zinc-400">
              No tasks found
            </p>
          ) : (
            <>
              <ul>
                {results.map((task) => (
                  <li
                    key={task.id}
                    className="flex min-h-[44px] items-center gap-3 border-b border-zinc-100 px-4 py-2 dark:border-zinc-800"
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
                      onClick={() => {
                        onSelectTask(task.id, task.listId);
                        onClose();
                      }}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span
                        className={`block truncate text-sm ${
                          task.completed
                            ? "text-zinc-400 line-through dark:text-zinc-500"
                            : "text-zinc-900 dark:text-zinc-50"
                        }`}
                      >
                        {task.name}
                      </span>
                      <span className="block truncate text-xs text-zinc-400 dark:text-zinc-500">
                        {task.listName}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {results.length >= SEARCH_RESULT_LIMIT && (
                <p className="px-4 py-3 text-xs text-zinc-400 dark:text-zinc-500">
                  Showing first {SEARCH_RESULT_LIMIT} matches
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
