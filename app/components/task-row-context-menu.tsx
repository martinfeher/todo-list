"use client";

import { BiChevronRight } from "react-icons/bi";
import { TaskMoveToSelector } from "./task-move-to-selector";
import type { LabelTag } from "./task-tag-selector";
import { TaskTagSelector } from "./task-tag-selector";
import type { TaskListItem, TodoList } from "./todo-app";

export type TaskRowContextMenuView = "main" | "priority" | "tag" | "moveTo";

type TaskRowContextMenuProps = {
  task: TaskListItem;
  view: TaskRowContextMenuView;
  lists: TodoList[];
  currentListId: string | null;
  moveQuery: string;
  availableTags: LabelTag[];
  assignedTagIds: string[];
  tagQuery: string;
  isTagSubmitting?: boolean;
  fixedPosition?: { x: number; y: number };
  onMoveQueryChange: (value: string) => void;
  onTagQueryChange: (value: string) => void;
  onToggleTagSelection: (tagId: string) => void;
  onCreateTag: (label: string) => void;
  onClose: () => void;
  onStartTitleEdit: () => void;
  onToggleTaskPinned: () => void;
  onOpenPriorityMenu: () => void;
  onOpenTagMenu: () => void;
  onOpenMoveMenu: () => void;
  onMoveTaskToList: (listId: string) => void;
  onClearTaskDueDate: () => void;
  onSelectTaskPriority: (priority: number) => void;
  onClearTaskPriority: () => void;
  onConfirmTags: () => void;
  hasDueDateActions: boolean;
  hasPriorityActions: boolean;
  hasPinActions: boolean;
  hasTagActions: boolean;
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
  hasPriorityActions,
  hasDueDateActions,
  hasTagActions,
  hasMoveActions,
  onClose,
  onStartTitleEdit,
  onToggleTaskPinned,
  onOpenPriorityMenu,
  onOpenTagMenu,
  onOpenMoveMenu,
  onClearTaskDueDate,
}: Pick<
  TaskRowContextMenuProps,
  | "task"
  | "view"
  | "hasPinActions"
  | "hasPriorityActions"
  | "hasDueDateActions"
  | "hasTagActions"
  | "hasMoveActions"
  | "onClose"
  | "onStartTitleEdit"
  | "onToggleTaskPinned"
  | "onOpenPriorityMenu"
  | "onOpenTagMenu"
  | "onOpenMoveMenu"
  | "onClearTaskDueDate"
>) {
  return (
    <div role="menu" className={`w-36 ${menuClassName}`}>
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
      {hasPriorityActions ? (
        <button
          type="button"
          role="menuitem"
          className={menuItemClassName}
          onClick={(event) => {
            event.stopPropagation();
            onOpenPriorityMenu();
          }}
        >
          Add priority
        </button>
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
      {hasTagActions ? (
        <button
          type="button"
          role="menuitem"
          className={menuItemClassName}
          onClick={(event) => {
            event.stopPropagation();
            onOpenTagMenu();
          }}
        >
          Add tag
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
  availableTags,
  assignedTagIds,
  tagQuery,
  isTagSubmitting = false,
  fixedPosition,
  onMoveQueryChange,
  onTagQueryChange,
  onToggleTagSelection,
  onCreateTag,
  onClose,
  onStartTitleEdit,
  onToggleTaskPinned,
  onOpenPriorityMenu,
  onOpenTagMenu,
  onOpenMoveMenu,
  onMoveTaskToList,
  onClearTaskDueDate,
  onSelectTaskPriority,
  onClearTaskPriority,
  onConfirmTags,
  hasDueDateActions,
  hasPriorityActions,
  hasPinActions,
  hasTagActions,
  hasMoveActions,
}: TaskRowContextMenuProps) {
  const menu = (
    <>
      {view === "main" && (
        <MainMenuItems
          task={task}
          view={view}
          hasPinActions={hasPinActions}
          hasPriorityActions={hasPriorityActions}
          hasDueDateActions={hasDueDateActions}
          hasTagActions={hasTagActions}
          hasMoveActions={hasMoveActions}
          onClose={onClose}
          onStartTitleEdit={onStartTitleEdit}
          onToggleTaskPinned={onToggleTaskPinned}
          onOpenPriorityMenu={onOpenPriorityMenu}
          onOpenTagMenu={onOpenTagMenu}
          onOpenMoveMenu={onOpenMoveMenu}
          onClearTaskDueDate={onClearTaskDueDate}
        />
      )}

      {view === "moveTo" && (
        <div className="flex items-start gap-1">
          <MainMenuItems
            task={task}
            view={view}
            hasPinActions={hasPinActions}
            hasPriorityActions={hasPriorityActions}
            hasDueDateActions={hasDueDateActions}
            hasTagActions={hasTagActions}
            hasMoveActions={hasMoveActions}
            onClose={onClose}
            onStartTitleEdit={onStartTitleEdit}
            onToggleTaskPinned={onToggleTaskPinned}
            onOpenPriorityMenu={onOpenPriorityMenu}
            onOpenTagMenu={onOpenTagMenu}
            onOpenMoveMenu={onOpenMoveMenu}
            onClearTaskDueDate={onClearTaskDueDate}
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

      {view === "priority" && (
        <div role="menu" className={`w-36 ${menuClassName}`}>
          {[1, 2, 3, 4].map((priority) => (
            <button
              key={priority}
              type="button"
              role="menuitem"
              className={`${menuItemClassName} ${
                task.priority === priority ? "font-medium" : ""
              }`}
              onClick={(event) => {
                event.stopPropagation();
                onSelectTaskPriority(priority);
              }}
            >
              Priority {priority}
            </button>
          ))}
          {task.priority ? (
            <button
              type="button"
              role="menuitem"
              className={menuItemClassName}
              onClick={(event) => {
                event.stopPropagation();
                onClearTaskPriority();
              }}
            >
              Clear priority
            </button>
          ) : null}
        </div>
      )}

      {view === "tag" && (
        <TaskTagSelector
          tags={availableTags}
          assignedTagIds={assignedTagIds}
          query={tagQuery}
          isSubmitting={isTagSubmitting}
          onQueryChange={onTagQueryChange}
          onToggleTag={onToggleTagSelection}
          onCreateTag={onCreateTag}
          onCancel={onClose}
          onConfirm={onConfirmTags}
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
