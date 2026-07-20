"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { IoIosSearch } from "react-icons/io";
import { LuPlus } from "react-icons/lu";
import type { CompletedTask, SearchTask, TodoList } from "./todo-app";
import { ConfirmModal } from "./confirm-modal";
import { RenameListModal } from "./rename-list-modal";
import { ThreeDotsIcon } from "./three-dots-icon";

const SearchModal = dynamic(
  () => import("./search-modal").then((module) => module.SearchModal),
  { ssr: false },
);

const NAV_ITEMS = ["Search", "Important", "Today"] as const;

type SidebarProps = {
  lists: TodoList[];
  completedTasks: CompletedTask[];
  searchTasks: SearchTask[];
  selectedListId: string | null;
  isTodaySelected: boolean;
  selectedTaskId: string | null;
  onSelectList: (listId: string) => void;
  onSelectToday: () => void;
  onSelectCompletedTask: (taskId: string, listId: string) => void;
  onSelectSearchTask: (taskId: string, listId: string) => void;
  onToggleTask: (taskId: string) => void;
  onAddList: (name: string) => void;
  onRenameList: (listId: string, name: string) => void;
  onRemoveList: (listId: string) => void;
};

const itemClassName =
  "flex w-full items-center text-left text-sm transition-colors cursor-pointer";

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
  searchTasks,
  selectedListId,
  isTodaySelected,
  selectedTaskId,
  onSelectList,
  onSelectToday,
  onSelectCompletedTask,
  onSelectSearchTask,
  onToggleTask,
  onAddList,
  onRenameList,
  onRemoveList,
}: SidebarProps) {
  const [isCompletedOpen, setIsCompletedOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [openMenuListId, setOpenMenuListId] = useState<string | null>(null);
  const [renameList, setRenameList] = useState<TodoList | null>(null);
  const [removeList, setRemoveList] = useState<TodoList | null>(null);
  const [isAddListOpen, setIsAddListOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpenMenuListId(null);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  function openRenameModal(list: TodoList) {
    setOpenMenuListId(null);
    setRenameList(list);
  }

  function openRemoveModal(list: TodoList) {
    setOpenMenuListId(null);
    setRemoveList(list);
  }

  return (
    <>
      <aside className="flex w-[250px] shrink-0 flex-col border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
        <nav className="flex flex-col">
          {NAV_ITEMS.map((label) => (
            <button
              key={label}
              type="button"
              onClick={
                label === "Today"
                  ? onSelectToday
                  : label === "Search"
                    ? () => setIsSearchOpen(true)
                    : undefined
              }
              className={`${getItemClassName(label === "Today" && isTodaySelected)} gap-2 px-4`}
            >
              {label === "Search" ? (
                <IoIosSearch className="size-[18px] shrink-0 cursor-pointer" aria-hidden="true" />
              ) : null}
              {label}
            </button>
          ))}
          
          <hr className="my-2 border-zinc-200 dark:border-zinc-800" />
          <div className="flex flex-col gap-2 text-slate-500 text-sm px-4">Zoznam listov</div>
          {lists.map((list) => (
            <div
              key={list.id}
              className={`group relative flex h-[35px] items-center cursor-pointer ${
                !isTodaySelected && list.id === selectedListId
                  ? "bg-zinc-200/80 dark:bg-zinc-800"
                  : "hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60"
              }`}
            >
              <button
                type="button"
                className="min-w-0 flex-1 truncate px-4 text-left text-sm text-zinc-900 dark:text-zinc-50"
                onClick={() => onSelectList(list.id)}
              >
                {list.name}
              </button>

              <div className="relative shrink-0" ref={openMenuListId === list.id ? menuRef : null}>
                <button
                  type="button"
                  aria-label={`Open menu for ${list.name}`}
                  aria-expanded={openMenuListId === list.id}
                  className={`mr-1 flex size-7 items-center justify-center rounded-md text-zinc-500 transition-opacity hover:bg-zinc-300/60 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-50 cursor-pointer ${
                    openMenuListId === list.id
                      ? "opacity-100"
                      : "opacity-0 group-hover:opacity-100"
                  }`}
                  onClick={(event) => {
                    event.stopPropagation();
                    setOpenMenuListId((current) =>
                      current === list.id ? null : list.id,
                    );
                  }}
                >
                  <ThreeDotsIcon className="size-4" />
                </button>

                {openMenuListId === list.id && (
                  <div className="absolute right-0 top-full z-20 mt-1 w-36 overflow-hidden rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                    <button
                      type="button"
                      className="flex h-[35px] w-full items-center px-3 text-left text-sm text-zinc-900 hover:bg-zinc-100 dark:text-zinc-50 dark:hover:bg-zinc-800"
                      onClick={() => openRenameModal(list)}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      className="flex h-[35px] w-full items-center px-3 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                      onClick={() => openRemoveModal(list)}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          <button
            type="button"
            className={`${getItemClassName(false)} gap-4 px-4 group hover:text-zinc-900`}
            onClick={() => setIsAddListOpen(true)}
          >
            New list
            <LuPlus className="size-3.5 text-zinc-250 group-hover:text-zinc-600 shrink-0" aria-hidden="true" />
          </button>
        </nav>

        <div className="mt-auto border-t border-zinc-200 dark:border-zinc-800">
          <button
            type="button"
            className={`${getItemClassName(isCompletedOpen)} px-4`}
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

      <SearchModal
        open={isSearchOpen}
        tasks={isSearchOpen ? searchTasks : []}
        onClose={() => setIsSearchOpen(false)}
        onSelectTask={onSelectSearchTask}
        onToggleTask={onToggleTask}
      />

      <RenameListModal
        open={isAddListOpen}
        title="New list"
        initialName=""
        onConfirm={(name) => {
          onAddList(name);
          setIsAddListOpen(false);
        }}
        onCancel={() => setIsAddListOpen(false)}
      />

      <RenameListModal
        open={renameList !== null}
        initialName={renameList?.name ?? ""}
        onConfirm={(name) => {
          if (renameList) {
            onRenameList(renameList.id, name);
          }
          setRenameList(null);
        }}
        onCancel={() => setRenameList(null)}
      />

      <ConfirmModal
        open={removeList !== null}
        title="Remove list"
        message={`Are you sure you want to remove "${removeList?.name}"? All tasks in this list will be deleted.`}
        confirmLabel="Remove"
        onConfirm={() => {
          if (removeList) {
            onRemoveList(removeList.id);
          }
          setRemoveList(null);
        }}
        onCancel={() => setRemoveList(null)}
      />
    </>
  );
}
