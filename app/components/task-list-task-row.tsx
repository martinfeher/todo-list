"use client";

import type { RefObject } from "react";
import { BiCalendar } from "react-icons/bi";
import { InteractIcon } from "./line-control-icons";
import { TaskCompletedIndicator } from "./task-completed-indicator";
import { TaskCompletionCheckbox } from "./task-completion-checkbox";
import { TaskDatePicker } from "./task-date-picker";
import {
  TaskRowContextMenu,
  type TaskRowContextMenuView,
} from "./task-row-context-menu";
import type { Label } from "./task-label-selector";
import { TaskLabelPills } from "./task-label-pills";
import { PiDotsThreeBold } from "react-icons/pi";
import type { TaskListItem, TodoList } from "./todo-app";
import type { TaskDueTime } from "@/lib/task-due-time";
import { getTaskPriorityColor } from "@/lib/task-priority";
import { SUBTASK_INDENT_PX, SUBTASK_ICON_INDENT_PX } from "@/lib/task-subtasks";

type TaskListTaskRowProps = {
  task: TaskListItem;
  depth?: number;
  isCompleting?: boolean;
  selectedTaskId: string | null;
  editingTaskId: string | null;
  titleDraft: string;
  titleInputRef: RefObject<HTMLInputElement | null>;
  showDragHandle: boolean;
  openDatePickerTaskId: string | null;
  openMenuTaskId: string | null;
  openLabelMenuTaskId: string | null;
  openMoveMenuTaskId: string | null;
  lists: TodoList[];
  currentListId: string | null;
  moveQuery: string;
  availableLabels: Label[];
  assignedLabelIds: string[];
  labelQuery: string;
  isLabelSubmitting: boolean;
  taskDateMenuRef: RefObject<HTMLDivElement | null>;
  taskContextMenuRef: RefObject<HTMLDivElement | null>;
  dueDateLabel: string | null;
  onTaskClick: (task: TaskListItem) => void;
  onTaskHoverStart?: () => void;
  onTaskHoverEnd?: (event: React.MouseEvent<HTMLLIElement>) => void;
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
  onToggleTaskImportant: (task: TaskListItem) => void;
  onOpenLabelMenu: (taskId: string) => void;
  onOpenMoveMenu: (taskId: string) => void;
  onMoveQueryChange: (value: string) => void;
  onMoveTaskToList: (taskId: string, targetListId: string) => void;
  onLabelQueryChange: (value: string) => void;
  onToggleLabel: (labelId: string) => void;
  onCreateLabel: (label: string) => void;
  onClearTaskDueDate: (taskId: string) => void;
  onSelectTaskPriority: (taskId: string, priority: number) => void;
  onClearTaskPriority: (taskId: string) => void;
  onConfirmLabels: () => void;
  onCloseTaskMenu: () => void;
  hasDueDateActions: boolean;
  hasPriorityActions: boolean;
  hasPinActions: boolean;
  hasImportantActions: boolean;
  hasLabelActions: boolean;
  hasMoveActions: boolean;
  useWiderRowPadding?: boolean;
};

function getRowMenuView(
  taskId: string,
  openMenuTaskId: string | null,
  openLabelMenuTaskId: string | null,
  openMoveMenuTaskId: string | null,
): TaskRowContextMenuView | null {
  if (openLabelMenuTaskId === taskId) return "label";
  if (openMoveMenuTaskId === taskId) return "moveTo";
  if (openMenuTaskId === taskId) return "main";
  return null;
}

export function TaskListTaskRow({
  task,
  depth = 0,
  isCompleting = false,
  selectedTaskId,
  editingTaskId,
  titleDraft,
  titleInputRef,
  showDragHandle,
  openDatePickerTaskId,
  openMenuTaskId,
  openLabelMenuTaskId,
  openMoveMenuTaskId,
  lists,
  currentListId,
  moveQuery,
  availableLabels,
  assignedLabelIds,
  labelQuery,
  isLabelSubmitting,
  taskDateMenuRef,
  taskContextMenuRef,
  dueDateLabel,
  onTaskClick,
  onTaskHoverStart,
  onTaskHoverEnd,
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
  onToggleTaskImportant,
  onOpenLabelMenu,
  onOpenMoveMenu,
  onMoveQueryChange,
  onMoveTaskToList,
  onLabelQueryChange,
  onToggleLabel,
  onCreateLabel,
  onClearTaskDueDate,
  onSelectTaskPriority,
  onClearTaskPriority,
  onConfirmLabels,
  onCloseTaskMenu,
  hasDueDateActions,
  hasPriorityActions,
  hasPinActions,
  hasImportantActions,
  hasLabelActions,
  hasMoveActions,
  useWiderRowPadding = false,
}: TaskListTaskRowProps) {
  const rowMenuView = getRowMenuView(
    task.id,
    openMenuTaskId,
    openLabelMenuTaskId,
    openMoveMenuTaskId,
  );
  const isRowMenuOpen =
    !isCompleting &&
    (openDatePickerTaskId === task.id || rowMenuView !== null);

  const priorityColor = getTaskPriorityColor(task.priority);
  const basePaddingLeft = useWiderRowPadding ? 15 : 5;
  const rowPaddingLeft = basePaddingLeft + depth * SUBTASK_INDENT_PX;
  const isSelected = task.id === selectedTaskId;

  if (isCompleting) {
    return (
      <li
        data-task-id={task.id}
        aria-label={`${task.name} completed`}
        className="flex min-h-[35px] items-center gap-2 border-b border-zinc-100 py-1 pr-2 dark:border-zinc-900"
        style={{ paddingLeft: rowPaddingLeft }}
      >
        {showDragHandle ? <span className="size-[19px] shrink-0" aria-hidden /> : null}
        <TaskCompletedIndicator />
      </li>
    );
  }

  return (
    <li
      data-task-id={task.id}
      aria-current={task.id === selectedTaskId ? "true" : undefined}
      onClick={() => onTaskClick(task)}
      onMouseEnter={onTaskHoverStart}
      onMouseLeave={onTaskHoverEnd}
      onContextMenu={(event) => onTaskContextMenu(event, task)}
      onPointerDown={
        showDragHandle
          ? (event) => onTaskDragStart(event, task.id)
          : undefined
      }
      className={`group flex min-h-[35px] items-center rounded-r-[3px] border-b border-zinc-100 py-1 pr-2 dark:border-zinc-900 cursor-pointer ${
        showDragHandle ? "touch-none" : ""
      } ${
        isSelected
          ? "bg-[#e9ebee]/50 hover:bg-[#e9ebee]/80"
          : "hover:bg-[#faf6ff]"
      }`}
      style={{ paddingLeft: rowPaddingLeft }}
    >
      {showDragHandle ? (
        <span
          aria-hidden="true"
          className="flex size-[19px] ml-[2px] mr-[1px] shrink-0 cursor-move items-center justify-center transition-opacity group-hover:opacity-100"
        >
          <InteractIcon className="size-3.5 text-[#c3c6cc] group-hover:text-[#7e828b]" />
        </span>
      ) : null}

      <TaskCompletionCheckbox
        checked={task.completed}
        onChange={() => onToggleTask(task.id)}
        onClick={(event) => event.stopPropagation()}
        aria-label={`Mark ${task.name} complete`}
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
          className="min-w-0 flex-1 ml-2 bg-transparent text-sm text-zinc-900 outline-none dark:text-zinc-50"
        />
      ) : (
        <div className="min-w-0 flex-1 ml-2">
          <span className="block truncate text-left text-sm text-zinc-700 dark:text-zinc-50">
            {task.name}
          </span>
          {task.listName && (
            <span className="block truncate text-xs text-zinc-400 dark:text-zinc-500">
              {task.listName}
            </span>
          )}
        </div>
      )}

      <div className="relative ml-auto flex h-7 min-w-11 shrink-0 items-center justify-end gap-1.5 pl-2">
        {task.labels.length > 0 ? (
          <TaskLabelPills labels={task.labels} className="max-w-[140px]" />
        ) : null}

        <div
          className={`pointer-events-none absolute right-0 flex items-center gap-1.5 transition-opacity ${
            isRowMenuOpen ? "opacity-0" : "opacity-100 group-hover:opacity-0"
          }`}
        >
          {priorityColor ? (
            <span
              aria-hidden="true"
              className="size-[7px] shrink-0 rounded-full"
              style={{ backgroundColor: priorityColor }}
            />
          ) : null}
          {dueDateLabel ? (
            <span className="whitespace-nowrap text-xs text-zinc-400 dark:text-zinc-500">
              {dueDateLabel}
            </span>
          ) : null}
        </div>

        <div
          className={`absolute right-0 flex items-center gap-1.5 transition-opacity ${
            isRowMenuOpen
              ? "pointer-events-auto opacity-100"
              : "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100"
          }`}
        >
          {priorityColor ? (
            <span
              aria-hidden="true"
              className="size-[7px] shrink-0 rounded-full"
              style={{ backgroundColor: priorityColor }}
            />
          ) : null}
          {dueDateLabel ? (
            <span
              className={`pointer-events-none whitespace-nowrap text-xs text-zinc-400 dark:text-zinc-500 ${
                isRowMenuOpen ? "inline" : "hidden group-hover:inline"
              }`}
            >
              {dueDateLabel}
            </span>
          ) : null}
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
              <PiDotsThreeBold className="size-4" />
            </button>

            {rowMenuView ? (
              <div className="absolute right-0 top-full z-30 mt-1">
                <TaskRowContextMenu
                  task={task}
                  view={rowMenuView}
                  lists={lists}
                  currentListId={currentListId ?? task.listId ?? null}
                  moveQuery={moveQuery}
                  availableLabels={availableLabels}
                  assignedLabelIds={assignedLabelIds}
                  labelQuery={labelQuery}
                  isLabelSubmitting={isLabelSubmitting}
                  onMoveQueryChange={onMoveQueryChange}
                  onLabelQueryChange={onLabelQueryChange}
                  onToggleLabelSelection={onToggleLabel}
                  onCreateLabel={onCreateLabel}
                  onClose={onCloseTaskMenu}
                  onStartTitleEdit={() => onStartTitleEdit(task)}
                  onToggleTaskPinned={() => onToggleTaskPinned(task)}
                  onToggleTaskImportant={() => onToggleTaskImportant(task)}
                  onOpenLabelMenu={() => onOpenLabelMenu(task.id)}
                  onOpenMoveMenu={() => onOpenMoveMenu(task.id)}
                  onMoveTaskToList={(targetListId) =>
                    onMoveTaskToList(task.id, targetListId)
                  }
                  onClearTaskDueDate={() => onClearTaskDueDate(task.id)}
                  onSelectTaskPriority={(priority) =>
                    onSelectTaskPriority(task.id, priority)
                  }
                  onClearTaskPriority={() => onClearTaskPriority(task.id)}
                  onConfirmLabels={onConfirmLabels}
                  hasDueDateActions={hasDueDateActions}
                  hasPriorityActions={hasPriorityActions}
                  hasPinActions={hasPinActions}
                  hasImportantActions={hasImportantActions}
                  hasLabelActions={hasLabelActions}
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
