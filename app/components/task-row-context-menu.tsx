"use client";

import { BiChevronRight } from "react-icons/bi";
import { TaskMoveToSelector } from "./task-move-to-selector";
import type { Label } from "./task-label-selector";
import { TaskLabelSelector } from "./task-label-selector";
import { TaskPrioritySelector } from "./task-priority-selector";
import type { TaskListItem, TodoList } from "./todo-app";

export type TaskRowContextMenuView = "main" | "label" | "moveTo";

type TaskRowContextMenuProps = {
  task: TaskListItem;
  view: TaskRowContextMenuView;
  lists: TodoList[];
  currentListId: string | null;
  moveQuery: string;
  availableLabels: Label[];
  assignedLabelIds: string[];
  labelQuery: string;
  isLabelSubmitting?: boolean;
  fixedPosition?: { x: number; y: number };
  onMoveQueryChange: (value: string) => void;
  onLabelQueryChange: (value: string) => void;
  onToggleLabelSelection: (labelId: string) => void;
  onCreateLabel: (label: string) => void;
  onClose: () => void;
  onStartTitleEdit: () => void;
  onToggleTaskPinned: () => void;
  onToggleTaskImportant: () => void;
  onOpenLabelMenu: () => void;
  onOpenMoveMenu: () => void;
  onMoveTaskToList: (listId: string) => void;
  onClearTaskDueDate: () => void;
  onSelectTaskPriority: (priority: number) => void;
  onClearTaskPriority: () => void;
  onConfirmLabels: () => void;
  hasDueDateActions: boolean;
  hasPriorityActions: boolean;
  hasPinActions: boolean;
  hasImportantActions: boolean;
  hasLabelActions: boolean;
  hasMoveActions: boolean;
};

const menuClassName =
  "overflow-hidden rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900";

const menuItemClassName =
  "flex h-[35px] w-full items-center px-3 text-left text-sm text-zinc-900 hover:bg-zinc-100 dark:text-zinc-50 dark:hover:bg-zinc-800";

function MainMenuItems({
  task,
  view,
  hasPinActions,
  hasImportantActions,
  hasPriorityActions,
  hasDueDateActions,
  hasLabelActions,
  hasMoveActions,
  onClose,
  onStartTitleEdit,
  onToggleTaskPinned,
  onToggleTaskImportant,
  onOpenLabelMenu,
  onOpenMoveMenu,
  onClearTaskDueDate,
  onSelectTaskPriority,
  onClearTaskPriority,
}: Pick<
  TaskRowContextMenuProps,
  | "task"
  | "view"
  | "hasPinActions"
  | "hasImportantActions"
  | "hasPriorityActions"
  | "hasDueDateActions"
  | "hasLabelActions"
  | "hasMoveActions"
  | "onClose"
  | "onStartTitleEdit"
  | "onToggleTaskPinned"
  | "onToggleTaskImportant"
  | "onOpenLabelMenu"
  | "onOpenMoveMenu"
  | "onClearTaskDueDate"
  | "onSelectTaskPriority"
  | "onClearTaskPriority"
>) {
  return (
    <div
      role="menu"
      className={`${hasPriorityActions ? "w-[168px]" : "w-36"} ${menuClassName}`}
    >
      <button
        type="button"
        role="menuitem"
        className={menuItemClassName}
        onClick={(event) => {
          event.stopPropagation();
          onClose();
          onStartTitleEdit();
        }}
      >
        Rename
      </button>
      {hasPinActions ? (
        <button
          type="button"
          role="menuitem"
          className={menuItemClassName}
          onClick={(event) => {
            event.stopPropagation();
            onToggleTaskPinned();
          }}
        >
          {task.pinned ? "Unpin task" : "Pin task"}
        </button>
      ) : null}
      {hasImportantActions ? (
        <button
          type="button"
          role="menuitem"
          className={menuItemClassName}
          onClick={(event) => {
            event.stopPropagation();
            onToggleTaskImportant();
          }}
        >
          {task.important ? "Remove from important" : "Mark as important"}
        </button>
      ) : null}
      {hasPriorityActions ? (
        <TaskPrioritySelector
          selectedPriority={task.priority}
          onSelectPriority={(priority) => {
            onSelectTaskPriority(priority);
            onClose();
          }}
          onClearPriority={() => {
            onClearTaskPriority();
            onClose();
          }}
        />
      ) : null}
      {hasMoveActions ? (
        <button
          type="button"
          role="menuitem"
          className={`${menuItemClassName} justify-between ${
            view === "moveTo" ? "bg-zinc-100 dark:bg-zinc-800" : ""
          }`}
          onClick={(event) => {
            event.stopPropagation();
            onOpenMoveMenu();
          }}
        >
          Move to
          <BiChevronRight className="size-4 shrink-0 text-zinc-400" aria-hidden />
        </button>
      ) : null}
      {task.dueDate && hasDueDateActions ? (
        <button
          type="button"
          role="menuitem"
          className={menuItemClassName}
          onClick={(event) => {
            event.stopPropagation();
            onClearTaskDueDate();
          }}
        >
          Clear date
        </button>
      ) : null}
      {hasLabelActions ? (
        <button
          type="button"
          role="menuitem"
          className={menuItemClassName}
          onClick={(event) => {
            event.stopPropagation();
            onOpenLabelMenu();
          }}
        >
          Add label
        </button>
      ) : null}
    </div>
  );
}

export function TaskRowContextMenu({
  task,
  view,
  lists,
  currentListId,
  moveQuery,
  availableLabels,
  assignedLabelIds,
  labelQuery,
  isLabelSubmitting = false,
  fixedPosition,
  onMoveQueryChange,
  onLabelQueryChange,
  onToggleLabelSelection,
  onCreateLabel,
  onClose,
  onStartTitleEdit,
  onToggleTaskPinned,
  onToggleTaskImportant,
  onOpenLabelMenu,
  onOpenMoveMenu,
  onMoveTaskToList,
  onClearTaskDueDate,
  onSelectTaskPriority,
  onClearTaskPriority,
  onConfirmLabels,
  hasDueDateActions,
  hasPriorityActions,
  hasPinActions,
  hasImportantActions,
  hasLabelActions,
  hasMoveActions,
}: TaskRowContextMenuProps) {
  const menu = (
    <>
      {view === "main" && (
        <MainMenuItems
          task={task}
          view={view}
          hasPinActions={hasPinActions}
          hasImportantActions={hasImportantActions}
          hasPriorityActions={hasPriorityActions}
          hasDueDateActions={hasDueDateActions}
          hasLabelActions={hasLabelActions}
          hasMoveActions={hasMoveActions}
          onClose={onClose}
          onStartTitleEdit={onStartTitleEdit}
          onToggleTaskPinned={onToggleTaskPinned}
          onToggleTaskImportant={onToggleTaskImportant}
          onOpenLabelMenu={onOpenLabelMenu}
          onOpenMoveMenu={onOpenMoveMenu}
          onClearTaskDueDate={onClearTaskDueDate}
          onSelectTaskPriority={onSelectTaskPriority}
          onClearTaskPriority={onClearTaskPriority}
        />
      )}

      {view === "moveTo" && (
        <div className="flex items-start gap-1">
          <MainMenuItems
            task={task}
            view={view}
            hasPinActions={hasPinActions}
            hasImportantActions={hasImportantActions}
            hasPriorityActions={hasPriorityActions}
            hasDueDateActions={hasDueDateActions}
            hasLabelActions={hasLabelActions}
            hasMoveActions={hasMoveActions}
            onClose={onClose}
            onStartTitleEdit={onStartTitleEdit}
            onToggleTaskPinned={onToggleTaskPinned}
            onToggleTaskImportant={onToggleTaskImportant}
            onOpenLabelMenu={onOpenLabelMenu}
            onOpenMoveMenu={onOpenMoveMenu}
            onClearTaskDueDate={onClearTaskDueDate}
            onSelectTaskPriority={onSelectTaskPriority}
            onClearTaskPriority={onClearTaskPriority}
          />
          <TaskMoveToSelector
            lists={lists}
            currentListId={currentListId}
            query={moveQuery}
            onQueryChange={onMoveQueryChange}
            onSelectList={onMoveTaskToList}
            onCancel={onClose}
          />
        </div>
      )}

      {view === "label" && (
        <TaskLabelSelector
          labels={availableLabels}
          assignedLabelIds={assignedLabelIds}
          query={labelQuery}
          isSubmitting={isLabelSubmitting}
          onQueryChange={onLabelQueryChange}
          onToggleLabel={onToggleLabelSelection}
          onCreateLabel={onCreateLabel}
          onCancel={onClose}
          onConfirm={onConfirmLabels}
        />
      )}
    </>
  );

  if (fixedPosition) {
    return (
      <div
        className="fixed z-50"
        style={{ left: fixedPosition.x, top: fixedPosition.y }}
      >
        {menu}
      </div>
    );
  }

  return menu;
}
