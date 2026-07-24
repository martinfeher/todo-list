"use client";

import type { RefObject } from "react";
import { BiCalendar } from "react-icons/bi";
import { InteractIcon } from "./line-control-icons";
import { TaskCompletedIndicator } from "./task-completed-indicator";
import { TaskDatePicker } from "./task-date-picker";
import {
  TaskRowContextMenu,
  type TaskRowContextMenuView,
} from "./task-row-context-menu";
import type { LabelTag } from "./task-tag-selector";
import { TaskTagPills } from "./task-tag-pills";
import { ThreeDotsIcon } from "./three-dots-icon";
import type { TaskListItem, TodoList } from "./todo-app";
import type { TaskDueTime } from "@/lib/task-due-time";

type TaskListTaskRowProps = {
  task: TaskListItem;
  isCompleting?: boolean;
  selectedTaskId: string | null;
  editingTaskId: string | null;
  titleDraft: string;
  titleInputRef: RefObject<HTMLInputElement | null>;
  showDragHandle: boolean;
  openDatePickerTaskId: string | null;
  openMenuTaskId: string | null;
  openPriorityMenuTaskId: string | null;
  openTagMenuTaskId: string | null;
  openMoveMenuTaskId: string | null;
  lists: TodoList[];
  currentListId: string | null;
  moveQuery: string;
  availableTags: LabelTag[];
  assignedTagIds: string[];
  tagQuery: string;
  isTagSubmitting: boolean;
  taskDateMenuRef: RefObject<HTMLDivElement | null>;
  taskContextMenuRef: RefObject<HTMLDivElement | null>;
  dueDateLabel: string | null;
  onTaskClick: (task: TaskListItem) => void;
  onTaskContextMenu: (
    event: React.MouseEvent<HTMLLIElement>,
    task: TaskListItem,
  ) => void;
  onToggleTask: (taskId: string) => void;
  onTitleDraftChange: (taskId: string, value: string) => void;
  onCommitTitleEdit: (task: TaskListItem) => void;
  onTitleKeyDown: (
    event: React.KeyboardEvent<HTMLInputElement>,
    task: TaskListItem,
  ) => void;
  onTaskDragStart: (
    event: React.PointerEvent<HTMLLIElement>,
    taskId: string,
  ) => void;
  onToggleDatePicker: (taskId: string) => void;
  onSelectTaskDueDate: (taskId: string, dateValue: string) => void;
  onSaveTaskDueTime: (taskId: string, dueTime: TaskDueTime) => void;
  onToggleTaskMenu: (taskId: string) => void;
  onStartTitleEdit: (task: TaskListItem) => void;
  onToggleTaskPinned: (task: TaskListItem) => void;
  onOpenPriorityMenu: (taskId: string) => void;
  onOpenTagMenu: (taskId: string) => void;
  onOpenMoveMenu: (taskId: string) => void;
  onMoveQueryChange: (value: string) => void;
  onMoveTaskToList: (taskId: string, targetListId: string) => void;
  onTagQueryChange: (value: string) => void;
  onToggleTag: (tagId: string) => void;
  onCreateTag: (label: string) => void;
  onClearTaskDueDate: (taskId: string) => void;
  onSelectTaskPriority: (taskId: string, priority: number) => void;
  onClearTaskPriority: (taskId: string) => void;
  onConfirmTags: () => void;
  onCloseTaskMenu: () => void;
  hasDueDateActions: boolean;
  hasPriorityActions: boolean;
  hasPinActions: boolean;
  hasTagActions: boolean;
  hasMoveActions: boolean;
};

function getRowMenuView(
  taskId: string,
  openMenuTaskId: string | null,
  openPriorityMenuTaskId: string | null,
  openTagMenuTaskId: string | null,
  openMoveMenuTaskId: string | null,
): TaskRowContextMenuView | null {
  if (openPriorityMenuTaskId === taskId) return "priority";
  if (openTagMenuTaskId === taskId) return "tag";
  if (openMoveMenuTaskId === taskId) return "moveTo";
  if (openMenuTaskId === taskId) return "main";
  return null;
}

export function TaskListTaskRow({
  task,
  isCompleting = false,
  selectedTaskId,
  editingTaskId,
  titleDraft,
  titleInputRef,
  showDragHandle,
  openDatePickerTaskId,
  openMenuTaskId,
  openPriorityMenuTaskId,
  openTagMenuTaskId,
  openMoveMenuTaskId,
  lists,
  currentListId,
  moveQuery,
  availableTags,
  assignedTagIds,
  tagQuery,
  isTagSubmitting,
  taskDateMenuRef,
  taskContextMenuRef,
  dueDateLabel,
  onTaskClick,
  onTaskContextMenu,
  onToggleTask,
  onTitleDraftChange,
  onCommitTitleEdit,
  onTitleKeyDown,
  onTaskDragStart,
  onToggleDatePicker,
  onSelectTaskDueDate,
  onSaveTaskDueTime,
  onToggleTaskMenu,
  onStartTitleEdit,
  onToggleTaskPinned,
  onOpenPriorityMenu,
  onOpenTagMenu,
  onOpenMoveMenu,
  onMoveQueryChange,
  onMoveTaskToList,
  onTagQueryChange,
  onToggleTag,
  onCreateTag,
  onClearTaskDueDate,
  onSelectTaskPriority,
  onClearTaskPriority,
  onConfirmTags,
  onCloseTaskMenu,
  hasDueDateActions,
  hasPriorityActions,
  hasPinActions,
  hasTagActions,
  hasMoveActions,
}: TaskListTaskRowProps) {
  const rowMenuView = getRowMenuView(
    task.id,
    openMenuTaskId,
    openPriorityMenuTaskId,
    openTagMenuTaskId,
    openMoveMenuTaskId,
  );
  const isRowMenuOpen =
    !isCompleting &&
    (openDatePickerTaskId === task.id || rowMenuView !== null);

  if (isCompleting) {
    return (
      <li
        data-task-id={task.id}
        aria-label={`${task.name} completed`}
        className="flex min-h-[35px] items-center gap-2 border-b border-zinc-100 px-2 py-1 dark:border-zinc-900"
      >
        {showDragHandle ? <span className="size-[19px] shrink-0" aria-hidden /> : null}
        <span className="size-4 shrink-0" aria-hidden />
        <TaskCompletedIndicator />
      </li>
    );
  }

  return (
    <li
      data-task-id={task.id}
      aria-current={task.id === selectedTaskId ? "true" : undefined}
      onClick={() => onTaskClick(task)}
      onContextMenu={(event) => onTaskContextMenu(event, task)}
      onPointerDown={
        showDragHandle
          ? (event) => onTaskDragStart(event, task.id)
          : undefined
      }
      className={`group flex min-h-[35px] items-center gap-2 border-b border-zinc-100 px-2 py-1 dark:border-zinc-900 ${
        showDragHandle
          ? "cursor-grab touch-none active:cursor-grabbing"
          : "cursor-pointer"
      }`}
    >
      {showDragHandle ? (
        <span
          aria-hidden="true"
          className="pointer-events-none flex size-[19px] shrink-0 items-center justify-center opacity-0 transition-opacity group-hover:opacity-100"
        >
          <InteractIcon className="size-3.5 text-[#949494]" />
        </span>
      ) : null}

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
          onChange={(event) => onTitleDraftChange(task.id, event.target.value)}
          onClick={(event) => event.stopPropagation()}
          onBlur={() => onCommitTitleEdit(task)}
          onKeyDown={(event) => onTitleKeyDown(event, task)}
          className="min-w-0 flex-1 bg-transparent text-sm text-zinc-900 outline-none dark:text-zinc-50"
        />
      ) : (
        <div className="min-w-0 flex-1">
          <span className="block truncate text-left text-sm text-zinc-900 dark:text-zinc-50">
            {task.name}
          </span>
          {task.listName && (
            <span className="block truncate text-xs text-zinc-400 dark:text-zinc-500">
              {task.listName}
            </span>
          )}
        </div>
      )}

      <div className="relative flex h-7 min-w-0 shrink-0 items-center justify-end gap-1.5">
        {task.tags.length > 0 ? (
          <TaskTagPills tags={task.tags} className="max-w-[140px]" />
        ) : null}

        {dueDateLabel ? (
          <span
            className={`text-xs text-zinc-400 transition-opacity dark:text-zinc-500 ${
              isRowMenuOpen ? "opacity-0" : "group-hover:opacity-0"
            }`}
          >
            {dueDateLabel}
          </span>
        ) : null}

        <div
          className={`flex items-center gap-0.5 transition-opacity ${
            dueDateLabel || task.tags.length > 0 ? "shrink-0" : ""
          } ${
            isRowMenuOpen
              ? "pointer-events-auto opacity-100"
              : "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100"
          }`}
        >
          {hasDueDateActions ? (
            <div
              className="relative"
              ref={openDatePickerTaskId === task.id ? taskDateMenuRef : null}
            >
              <button
                type="button"
                aria-label={
                  dueDateLabel
                    ? `Due ${dueDateLabel}. Change date`
                    : "Set task date"
                }
                aria-haspopup="dialog"
                aria-expanded={openDatePickerTaskId === task.id}
                title={dueDateLabel ? `Due: ${dueDateLabel}` : "Set date"}
                className={`flex h-[24px] w-[20px] items-center justify-center rounded-md text-zinc-400 transition-colors cursor-pointer hover:bg-zinc-200/80 hover:text-zinc-500 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 ${
                  task.dueDate ? "text-zinc-400 dark:text-zinc-300" : ""
                }`}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleDatePicker(task.id);
                }}
              >
                <BiCalendar className="size-4" />
              </button>

              {openDatePickerTaskId === task.id && (
                <div className="absolute right-0 top-full z-30 mt-1">
                  <TaskDatePicker
                    dueDate={task.dueDate}
                    dueTimeMinutes={task.dueTimeMinutes}
                    dueDurationMinutes={task.dueDurationMinutes}
                    dueTimeZone={task.dueTimeZone}
                    onSelectDate={(dateValue) =>
                      onSelectTaskDueDate(task.id, dateValue)
                    }
                    onSaveDueTime={(dueTime) => onSaveTaskDueTime(task.id, dueTime)}
                  />
                </div>
              )}
            </div>
          ) : null}

          <div
            className="relative"
            ref={rowMenuView ? taskContextMenuRef : null}
          >
            <button
              type="button"
              aria-label={`Open menu for ${task.name}`}
              aria-haspopup="menu"
              aria-expanded={rowMenuView !== null}
              title="More options"
              className="flex h-[24px] w-[20px] items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-200/80 hover:text-zinc-500 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              onClick={(event) => {
                event.stopPropagation();
                onToggleTaskMenu(task.id);
              }}
            >
              <ThreeDotsIcon className="size-4" />
            </button>

            {rowMenuView ? (
              <div className="absolute right-0 top-full z-30 mt-1">
                <TaskRowContextMenu
                  task={task}
                  view={rowMenuView}
                  lists={lists}
                  currentListId={currentListId ?? task.listId ?? null}
                  moveQuery={moveQuery}
                  availableTags={availableTags}
                  assignedTagIds={assignedTagIds}
                  tagQuery={tagQuery}
                  isTagSubmitting={isTagSubmitting}
                  onMoveQueryChange={onMoveQueryChange}
                  onTagQueryChange={onTagQueryChange}
                  onToggleTagSelection={onToggleTag}
                  onCreateTag={onCreateTag}
                  onClose={onCloseTaskMenu}
                  onStartTitleEdit={() => onStartTitleEdit(task)}
                  onToggleTaskPinned={() => onToggleTaskPinned(task)}
                  onOpenPriorityMenu={() => onOpenPriorityMenu(task.id)}
                  onOpenTagMenu={() => onOpenTagMenu(task.id)}
                  onOpenMoveMenu={() => onOpenMoveMenu(task.id)}
                  onMoveTaskToList={(targetListId) =>
                    onMoveTaskToList(task.id, targetListId)
                  }
                  onClearTaskDueDate={() => onClearTaskDueDate(task.id)}
                  onSelectTaskPriority={(priority) =>
                    onSelectTaskPriority(task.id, priority)
                  }
                  onClearTaskPriority={() => onClearTaskPriority(task.id)}
                  onConfirmTags={onConfirmTags}
                  hasDueDateActions={hasDueDateActions}
                  hasPriorityActions={hasPriorityActions}
                  hasPinActions={hasPinActions}
                  hasTagActions={hasTagActions}
                  hasMoveActions={hasMoveActions}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  );
}
