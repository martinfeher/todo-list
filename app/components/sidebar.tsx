"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { IoIosSearch } from "react-icons/io";
import { IoPricetagOutline } from "react-icons/io5";
import { LuPlus, LuStar } from "react-icons/lu";
import { PiDotsThreeBold } from "react-icons/pi";
import { BsCalendar3 } from "react-icons/bs";

import type {
  CompletedTask,
  SearchTask,
  SidebarHoverPreview,
  TaskLabel,
  TaskListItem,
  TodoList,
} from "./todo-app";
import { CalendarMenuPreview } from "./calendar-menu-preview";
import {
  getListDropIndex,
  getListRowElements,
  reorderListIds,
} from "./list-reorder";
import { ConfirmModal } from "./confirm-modal";
import { MacCmdIcon } from "./mac-cmd-icon";
import { RenameListModal } from "./rename-list-modal";
import { TodayCalendarIcon } from "./today-calendar-icon";


const SearchModal = dynamic(
  () => import("./search-modal").then((module) => module.SearchModal),
  { ssr: false },
);

const NAV_ITEMS = [
  { label: "Search", action: "search" as const },
  { label: "Today", action: "today" as const },
  // { label: "Next 7 days", action: "next7days" as const },
  { label: "Important", action: "important" as const },
  { label: "Calendar", action: "calendar" as const },
];

type SidebarProps = {
  lists: TodoList[];
  labels: TaskLabel[];
  taskCountByListId: Record<string, number>;
  taskCountByLabelId: Record<string, number>;
  completedTasks: CompletedTask[];
  searchTasks: SearchTask[];
  calendarTasks: TaskListItem[];
  selectedListId: string | null;
  selectedLabelId: string | null;
  isTodaySelected: boolean;
  // isNext7DaysSelected: boolean;
  isImportantSelected: boolean;
  isCalendarSelected: boolean;
  selectedTaskId: string | null;
  onSelectList: (listId: string) => void;
  onSelectLabel: (labelId: string) => void;
  onSelectToday: () => void;
  // onSelectNext7Days: () => void;
  onSelectImportant: () => void;
  onSelectCalendar: () => void;
  onSelectCompletedTask: (taskId: string, listId: string) => void;
  onSelectSearchTask: (taskId: string, listId: string) => void;
  onToggleTask: (taskId: string) => void;
  onAddList: (name: string) => void;
  onRenameList: (listId: string, name: string) => void;
  onRemoveList: (listId: string) => void;
  onReorderLists?: (listIds: string[]) => void;
  onSidebarHoverStart?: (preview: SidebarHoverPreview) => void;
  onSidebarHoverEnd?: () => void;
  sidebarHoverPreview?: SidebarHoverPreview | null;
};

const LIST_DRAG_THRESHOLD_PX = 5;

function shouldStartListDrag(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return true;

  return !target.closest(
    "input, button, textarea, select, a, [role='menu'], [role='menuitem']",
  );
}

const itemClassName =
  "flex mx-[6px] mb-px w-auto items-center rounded-[7px] text-left text-sm transition-colors cursor-pointer";

const completedItemClassName =
  "flex mx-[4px] mb-px min-h-[44px] w-auto flex-col items-start justify-center gap-0 rounded-[7px] px-4 py-1 text-left text-sm transition-colors";

function getItemClassName(isSelected: boolean, baseClassName = itemClassName) {
  const heightClass =
    baseClassName === completedItemClassName ? "" : "h-[35px]";

  return `${baseClassName} ${heightClass} ${
    isSelected
      ? "bg-[#e9ebee] font-medium text-[#111111] dark:bg-zinc-800 dark:text-zinc-50"
      : "text-zinc-900 hover:bg-zinc-200/60 dark:text-zinc-50 dark:hover:bg-zinc-800/60"
  }`;
}

export function Sidebar({
  lists,
  labels,
  taskCountByListId,
  taskCountByLabelId,
  completedTasks,
  searchTasks,
  calendarTasks,
  selectedListId,
  selectedLabelId,
  isTodaySelected,
  // isNext7DaysSelected,
  isImportantSelected,
  isCalendarSelected,
  selectedTaskId,
  onSelectList,
  onSelectLabel,
  onSelectToday,
  // onSelectNext7Days,
  onSelectImportant,
  onSelectCalendar,
  onSelectCompletedTask,
  onSelectSearchTask,
  onToggleTask,
  onAddList,
  onRenameList,
  onRemoveList,
  onReorderLists,
  onSidebarHoverStart,
  onSidebarHoverEnd,
  sidebarHoverPreview = null,
}: SidebarProps) {
  const [orderedLists, setOrderedLists] = useState(lists);
  const [dropIndicatorTop, setDropIndicatorTop] = useState<number | null>(null);
  const [isCompletedOpen, setIsCompletedOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [openMenuListId, setOpenMenuListId] = useState<string | null>(null);
  const [renameList, setRenameList] = useState<TodoList | null>(null);
  const [removeList, setRemoveList] = useState<TodoList | null>(null);
  const [isAddListOpen, setIsAddListOpen] = useState(false);
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [listNameDraft, setListNameDraft] = useState("");
  const [isCalendarPreviewOpen, setIsCalendarPreviewOpen] = useState(false);
  const [calendarPreviewPosition, setCalendarPreviewPosition] = useState({
    top: 0,
    left: 0,
  });
  const calendarNavRef = useRef<HTMLDivElement>(null);
  const calendarPreviewCloseTimerRef = useRef<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const listNameInputRef = useRef<HTMLInputElement>(null);
  const dragStateRef = useRef<{
    sourceRow: HTMLElement;
    captureTarget: HTMLElement;
    sourceIndex: number;
    dropIndex: number;
    listIds: string[];
    pointerId: number;
  } | null>(null);
  const suppressListClickRef = useRef(false);

  useEffect(() => {
    setOrderedLists(lists);
  }, [lists]);

  useEffect(() => {
    if (!editingListId) return;

    requestAnimationFrame(() => {
      const input = listNameInputRef.current;
      if (!input) return;

      input.focus();
      const end = input.value.length;
      input.setSelectionRange(end, end);
    });
  }, [editingListId]);

  useEffect(() => {
    function handleSearchShortcut(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key.toLowerCase() !== "k") return;
      if (event.altKey || event.shiftKey) return;

      event.preventDefault();
      setIsSearchOpen(true);
    }

    document.addEventListener("keydown", handleSearchShortcut);
    return () => document.removeEventListener("keydown", handleSearchShortcut);
  }, []);

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

  function isListSelected(listId: string) {
    return (
      !isTodaySelected &&
      !isImportantSelected &&
      !isCalendarSelected &&
      !selectedLabelId &&
      listId === selectedListId
    );
  }

  function getListRowClassName(listId: string) {
    const isSelected = isListSelected(listId);
    const isHovered =
      sidebarHoverPreview?.kind === "list" &&
      sidebarHoverPreview.listId === listId;
    const isAnySidebarHover = sidebarHoverPreview !== null;

    if (isHovered) {
      return "border-r-2 border-[#cfcfcf] bg-[#e9ebee]/70 dark:bg-zinc-800/60";
    }

    if (isSelected) {
      if (isAnySidebarHover && !isHovered) {
        return "bg-[#e9ebee]/50 dark:bg-zinc-800";
      }

      return "bg-[#e9ebee]/50 dark:bg-zinc-800";
    }

    return "hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60";
  }

  function getNavItemClassName(
    action: "today" | "important" | "calendar",
    isSelected: boolean,
  ) {
    const isHovered =
      (action === "today" && sidebarHoverPreview?.kind === "today") ||
      (action === "important" && sidebarHoverPreview?.kind === "important") ||
      (action === "calendar" && sidebarHoverPreview?.kind === "calendar");
    const isAnySidebarHover = sidebarHoverPreview !== null;

    if (isHovered) {
      return `${itemClassName} h-[35px] bg-[#e9ebee]/70 dark:bg-zinc-800/60`;
    }

    if (isSelected) {
      if (isAnySidebarHover) {
        return `${itemClassName} h-[35px] bg-[#e9ebee]/50 font-medium text-[#111111] dark:bg-zinc-800 dark:text-zinc-50`;
      }
      return getItemClassName(true);
    }

    return getItemClassName(false);
  }

  function cancelCalendarPreviewClose() {
    if (calendarPreviewCloseTimerRef.current !== null) {
      window.clearTimeout(calendarPreviewCloseTimerRef.current);
      calendarPreviewCloseTimerRef.current = null;
    }
  }

  function openCalendarPreview() {
    cancelCalendarPreviewClose();
    const nav = calendarNavRef.current;
    const rect = nav?.getBoundingClientRect();
    if (!rect) {
      setIsCalendarPreviewOpen(true);
      return;
    }

    const previewWidth = 300;
    const previewHeight = 300;
    const gap = 8;
    const margin = 12;
    const asideRect = nav?.closest("aside")?.getBoundingClientRect();

    let left = rect.left - previewWidth - gap;
    if (left < margin) {
      left = (asideRect?.right ?? rect.right) + gap;
    }
    left = Math.min(left, window.innerWidth - previewWidth - margin);
    left = Math.max(margin, left);

    let top = rect.top;
    top = Math.max(margin, Math.min(top, window.innerHeight - previewHeight - margin));

    setCalendarPreviewPosition({ top, left });
    setIsCalendarPreviewOpen(true);
  }

  function scheduleCalendarPreviewClose() {
    cancelCalendarPreviewClose();
    calendarPreviewCloseTimerRef.current = window.setTimeout(() => {
      setIsCalendarPreviewOpen(false);
    }, 150);
  }

  useEffect(() => {
    return () => {
      cancelCalendarPreviewClose();
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

  function startListNameEdit(list: TodoList) {
    setOpenMenuListId(null);
    setEditingListId(list.id);
    setListNameDraft(list.name);
  }

  function cancelListNameEdit(list: TodoList) {
    setListNameDraft(list.name);
    setEditingListId(null);
  }

  function commitListNameEdit(list: TodoList) {
    const trimmed = listNameDraft.trim();

    if (!trimmed) {
      cancelListNameEdit(list);
      return;
    }

    if (trimmed !== list.name) {
      onRenameList(list.id, trimmed);
      setOrderedLists((current) =>
        current.map((item) =>
          item.id === list.id ? { ...item, name: trimmed } : item,
        ),
      );
    }

    setEditingListId(null);
  }

  function handleListNameKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>,
    list: TodoList,
  ) {
    if (event.key === "Enter") {
      event.preventDefault();
      commitListNameEdit(list);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      cancelListNameEdit(list);
    }
  }

  function handleListDragMove(event: PointerEvent) {
    const dragState = dragStateRef.current;
    const container = listContainerRef.current;
    if (!dragState || !container) return;

    const rows = getListRowElements(container);
    const dropIndex = getListDropIndex(
      event.clientY,
      rows,
      dragState.sourceIndex,
    );
    dragState.dropIndex = dropIndex;

    const containerRect = container.getBoundingClientRect();
    let indicatorTop: number;

    if (dropIndex >= rows.length) {
      const lastRow = rows[rows.length - 1];
      if (!lastRow) return;
      const rect = lastRow.getBoundingClientRect();
      indicatorTop = rect.bottom - containerRect.top;
    } else {
      const targetRow = rows[dropIndex];
      const rect = targetRow.getBoundingClientRect();
      indicatorTop = rect.top - containerRect.top;
    }

    setDropIndicatorTop(indicatorTop);
  }

  function handleListDragEnd() {
    const dragState = dragStateRef.current;
    const wasDragging = dragState !== null;

    document.removeEventListener("pointermove", handleListDragMove);
    document.removeEventListener("pointerup", handleListDragEnd);
    document.removeEventListener("pointercancel", handleListDragEnd);
    document.body.style.cursor = "";

    if (dragState) {
      if (dragState.captureTarget.hasPointerCapture(dragState.pointerId)) {
        dragState.captureTarget.releasePointerCapture(dragState.pointerId);
      }
      dragState.sourceRow.classList.remove("opacity-50");
      dragState.sourceRow.style.cursor = "";
    }

    setDropIndicatorTop(null);

    if (dragState && onReorderLists) {
      const nextIds = reorderListIds(
        dragState.listIds,
        dragState.sourceIndex,
        dragState.dropIndex,
      );

      if (nextIds.join(",") !== dragState.listIds.join(",")) {
        const listMap = new Map(orderedLists.map((list) => [list.id, list]));
        setOrderedLists(
          nextIds
            .map((id) => listMap.get(id))
            .filter((list): list is TodoList => list !== undefined),
        );
        onReorderLists(nextIds);
      }
    }

    if (wasDragging) {
      suppressListClickRef.current = true;
    }

    dragStateRef.current = null;
  }

  function beginListDrag(
    sourceRow: HTMLElement,
    pointerId: number,
    sourceIndex: number,
    listIds: string[],
  ) {
    dragStateRef.current = {
      sourceRow,
      captureTarget: sourceRow,
      sourceIndex,
      dropIndex: sourceIndex,
      listIds,
      pointerId,
    };

    sourceRow.classList.add("opacity-50");
    sourceRow.setPointerCapture(pointerId);
    sourceRow.style.cursor = "move";
    document.body.style.cursor = "move";
    document.addEventListener("pointermove", handleListDragMove);
    document.addEventListener("pointerup", handleListDragEnd);
    document.addEventListener("pointercancel", handleListDragEnd);
  }

  function handleListPointerDown(
    event: React.PointerEvent<HTMLDivElement>,
    listId: string,
  ) {
    if (editingListId === listId) return;
    if (!onReorderLists || event.button !== 0) return;
    if (!shouldStartListDrag(event.target)) return;

    const container = listContainerRef.current;
    if (!container) return;

    const rows = getListRowElements(container);
    const sourceRow = rows.find((row) => row.dataset.listId === listId);
    if (!sourceRow) return;

    const dragRow = sourceRow;
    const sourceIndex = rows.indexOf(dragRow);
    if (sourceIndex < 0) return;

    const listIds = orderedLists.map((list) => list.id);
    const startX = event.clientX;
    const startY = event.clientY;
    const pointerId = event.pointerId;
    let dragStarted = false;

    function clearPendingListeners() {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointercancel", onPointerUp);
    }

    function onPointerMove(moveEvent: PointerEvent) {
      if (moveEvent.pointerId !== pointerId) return;
      if (dragStarted) return;

      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      if (Math.hypot(dx, dy) < LIST_DRAG_THRESHOLD_PX) return;

      dragStarted = true;
      clearPendingListeners();
      beginListDrag(dragRow, pointerId, sourceIndex, listIds);
    }

    function onPointerUp(upEvent: PointerEvent) {
      if (upEvent.pointerId !== pointerId) return;
      clearPendingListeners();
    }

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerUp);
  }

  function handleListClick(listId: string) {
    if (editingListId === listId) return;
    if (suppressListClickRef.current) {
      suppressListClickRef.current = false;
      return;
    }

    onSelectList(listId);
  }

  return (
    <>
      <aside className="flex w-[250px] shrink-0 flex-col border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
        <nav className="flex flex-col">
          {NAV_ITEMS.map((item) => {
            const isNavItemSelected =
              (item.action === "today" && isTodaySelected) ||
              // (item.action === "next7days" && isNext7DaysSelected) ||
              (item.action === "important" && isImportantSelected) ||
              (item.action === "calendar" && isCalendarSelected);
            const navIconColor = isNavItemSelected
              ? "text-[#111111]"
              : "text-[#7c92a0]";

            return (
            item.action === "calendar" ? (
              <div
                key={item.label}
                ref={calendarNavRef}
                onMouseEnter={() => {
                  openCalendarPreview();
                  onSidebarHoverStart?.({ kind: "calendar" });
                }}
                onMouseLeave={() => {
                  scheduleCalendarPreviewClose();
                  onSidebarHoverEnd?.();
                }}
              >
                <button
                  type="button"
                  onClick={onSelectCalendar}
                  className={`${getNavItemClassName("calendar", isNavItemSelected)} !w-[236px] gap-2 px-4`}
                >
                  <BsCalendar3
                    className={`size-[14px] shrink-0 ${navIconColor}`}
                    aria-hidden="true"
                  />
                  {item.label}
                </button>
              </div>
            ) : (
            <button
              key={item.label}
              type="button"
              onClick={
                item.action === "today"
                  ? onSelectToday
                  : item.action === "important"
                    ? onSelectImportant
                    : item.action === "search"
                      ? () => setIsSearchOpen(true)
                      : undefined
              }
              onMouseEnter={
                item.action === "today"
                  ? () => onSidebarHoverStart?.({ kind: "today" })
                  : item.action === "important"
                    ? () => onSidebarHoverStart?.({ kind: "important" })
                    : undefined
              }
              onMouseLeave={
                item.action === "today" || item.action === "important"
                  ? () => onSidebarHoverEnd?.()
                  : undefined
              }
              className={
                item.action === "search"
                  ? "mx-[6px] my-2 flex h-[35px] w-auto cursor-pointer items-center gap-2 self-stretch rounded-[7px] border border-[#e3e3e9] py-0 pl-3 pr-[3px] text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-50 dark:hover:bg-zinc-800/60"
                  : item.action === "today"
                    ? `${getNavItemClassName("today", isNavItemSelected)} gap-2 px-4`
                    : item.action === "important"
                      ? `${getNavItemClassName("important", isNavItemSelected)} gap-2 px-4`
                      : `${getItemClassName(isNavItemSelected)} gap-2 px-4`
              }
            >
              {item.action === "search" ? (
                <IoIosSearch
                  className="size-[18px] shrink-0 cursor-pointer"
                  aria-hidden="true"
                />
              ) : null}
              {item.action === "today" ? (
                <TodayCalendarIcon
                  className={`size-[19px] -ml-[2px] shrink-0 ${navIconColor}`}
                />
              ) : null}
              {item.action === "important" ? (
                <LuStar
                  className={`size-[15px] shrink-0 ${navIconColor}`}
                  aria-hidden="true"
                />
              ) : null}
              {item.label}
              {item.action === "search" ? (
                <div
                  className="ml-auto flex h-[25px] w-[37px] shrink-0 items-center justify-center rounded-full bg-[#eceff4]/75 mr-[1px] border border-[#eee8ef]"
                  aria-hidden="true"
                >
                  <div className="flex items-center gap-px text-[#a1a7be]/50">
                    <MacCmdIcon className="size-[9px] shrink-0" />
                    <span className="text-[10px] font-bold leading-none text-[#a1a7ae]/65">
                      +K
                    </span>
                  </div>
                </div>
              ) : null}
            </button>
            )
            );
          })}
          
          <hr className="my-2 border-zinc-200 dark:border-zinc-800" />
          <div className="flex flex-col gap-2 px-4 pb-1 text-xs font-medium text-zinc-400 dark:text-zinc-500">Lists</div>
          <div
            ref={listContainerRef}
            className="relative flex flex-col"
            onMouseLeave={() => {
              onSidebarHoverEnd?.();
            }}
          >
            {dropIndicatorTop !== null && (
              <div
                className="pointer-events-none absolute right-2 left-2 z-20 h-0.5 bg-blue-500"
                style={{ top: dropIndicatorTop }}
              />
            )}
            {orderedLists.map((list) => (
            <div
              key={list.id}
              data-list-id={list.id}
              onPointerDown={(event) => handleListPointerDown(event, list.id)}
              onClick={() => handleListClick(list.id)}
              onMouseEnter={() => {
                onSidebarHoverStart?.({ kind: "list", listId: list.id });
              }}
              className={`group relative flex h-[35px] items-center cursor-pointer mx-[6px] mb-px rounded-[7px] ${getListRowClassName(list.id)}`}
            >
              <div className="flex min-w-0 flex-1 items-center gap-2 px-4 text-left text-sm text-zinc-800 dark:text-zinc-50">
                {editingListId === list.id ? (
                  <input
                    ref={listNameInputRef}
                    type="text"
                    value={listNameDraft}
                    onChange={(event) => setListNameDraft(event.target.value)}
                    onClick={(event) => event.stopPropagation()}
                    onPointerDown={(event) => event.stopPropagation()}
                    onDoubleClick={(event) => event.stopPropagation()}
                    onBlur={() => commitListNameEdit(list)}
                    onKeyDown={(event) => handleListNameKeyDown(event, list)}
                    aria-label={`Rename ${list.name}`}
                    className="min-w-0 flex-1 bg-transparent text-sm text-zinc-800 outline-none cursor-text dark:text-zinc-50"
                  />
                ) : (
                  <span
                    className="min-w-0 flex-1 truncate cursor-pointer"
                    onDoubleClick={(event) => {
                      event.stopPropagation();
                      startListNameEdit(list);
                    }}
                  >
                    {list.name}
                  </span>
                )}
                <span className="shrink-0 pr-1 text-xs tabular-nums text-zinc-400 transition-[padding,opacity] group-hover:opacity-0 dark:text-zinc-500">
                  {taskCountByListId[list.id] ?? 0}
                </span>
              </div>

              <div
                className="absolute right-1 top-1/2 -translate-y-1/2"
                ref={openMenuListId === list.id ? menuRef : null}
              >
                <button
                  type="button"
                  aria-label={`Open menu for ${list.name}`}
                  aria-expanded={openMenuListId === list.id}
                  className={`mr-1 flex size-7 items-center justify-center rounded-[8px] text-zinc-500 transition-opacity hover:bg-zinc-200/80 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-50 cursor-pointer ${
                    openMenuListId === list.id
                      ? "opacity-100"
                      : "opacity-0 group-hover:opacity-100"
                  }`}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    setOpenMenuListId((current) =>
                      current === list.id ? null : list.id,
                    );
                  }}
                >
                  <PiDotsThreeBold className="size-[19px] text-[#777777]" />
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
          </div>

          <button
            type="button"
            className={`${getItemClassName(false)} gap-2 pr-4 pl-[15px] group hover:text-zinc-900 hover:bg-zinc-150!`}
            onClick={() => setIsAddListOpen(true)}
          >
            <div className="pl-2 pr-3 py-1 rounded-lg flex items-center gap-1 duration-200">
            {/* <div className="hover:bg-[#e1ddda] pl-2 pr-3 py-1 rounded-lg flex items-center gap-1 duration-200"> */}
              <LuPlus className="size-3.5 text-gray-500 group-hover:text-zinc-600 shrink-0" aria-hidden="true" />
              {/* <LuPlus className="size-3.5 text-[#d0d5dc] group-hover:text-zinc-600 shrink-0" aria-hidden="true" /> */}
              <div className="text-gray-500 group-hover:text-gray-800 ">Create list</div>
            </div>
          </button>

          {labels.length > 0 ? (
            <div
              className="mt-3 flex flex-col"
              onMouseLeave={() => onSidebarHoverEnd?.()}
            >
              <p className="px-4 pb-1 text-xs font-medium text-zinc-400 dark:text-zinc-500">
                Labels
              </p>
              {labels.map((item) => {
                const isHovered =
                  sidebarHoverPreview?.kind === "label" &&
                  sidebarHoverPreview.labelId === item.id;
                const isSelected = selectedLabelId === item.id;

                return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectLabel(item.id)}
                  onMouseEnter={() =>
                    onSidebarHoverStart?.({ kind: "label", labelId: item.id })
                  }
                  className={`${
                    isHovered
                      ? `${itemClassName} h-[35px] bg-[#e9ebee]/70`
                      : getItemClassName(isSelected)
                  } gap-2 pl-[16px] pr-2 text-[#5b5b5b] ${
                    isSelected && !isHovered ? "" : "hover:text-[#777777]"
                  }`}
                >
                  <IoPricetagOutline
                    className="size-4 shrink-0 text-[#777777]"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate text-[#777777]">
                    {item.label}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-[#777777] mr-[11px]!">
                    {taskCountByLabelId[item.id] ?? 0}
                  </span>
                </button>
                );
              })}
            </div>
          ) : null}

          <div className="mt-3 flex flex-col border-t border-zinc-150">
            <button
              type="button"
              className={`${getItemClassName(isCompletedOpen)} pl-6 pr-4`}
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
        </nav>
      </aside>

      <SearchModal
        open={isSearchOpen}
        tasks={isSearchOpen ? searchTasks : []}
        onClose={() => setIsSearchOpen(false)}
        onSelectTask={onSelectSearchTask}
        onToggleTask={onToggleTask}
      />

      {isCalendarPreviewOpen ? (
        <CalendarMenuPreview
          tasks={calendarTasks}
          top={calendarPreviewPosition.top}
          left={calendarPreviewPosition.left}
          onMouseEnter={openCalendarPreview}
          onMouseLeave={scheduleCalendarPreviewClose}
        />
      ) : null}

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
