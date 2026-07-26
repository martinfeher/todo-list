"use client";

import { LuX } from "react-icons/lu";
import {
  TASK_PRIORITY_OPTIONS,
  type TaskPriorityLevel,
} from "@/lib/task-priority";

type TaskPrioritySelectorProps = {
  selectedPriority: number | null;
  onSelectPriority: (priority: TaskPriorityLevel) => void;
  onClearPriority: () => void;
};

export function TaskPrioritySelector({
  selectedPriority,
  onSelectPriority,
  onClearPriority,
}: TaskPrioritySelectorProps) {
  return (
    <div className="px-3 py-2">
      <div className="mb-2 text-xs font-medium text-zinc-400 dark:text-zinc-500">
        Priority
      </div>
      <div className="flex items-center gap-1">
        {TASK_PRIORITY_OPTIONS.map((option) => {
          const isSelected = selectedPriority === option.level;

          return (
            <button
              key={option.label}
              type="button"
              aria-label={option.label}
              title={option.label}
              aria-pressed={isSelected}
              className={`flex size-8 items-center justify-center rounded-md transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                isSelected ? "bg-zinc-100 dark:bg-zinc-800" : ""
              }`}
              onClick={(event) => {
                event.stopPropagation();
                onSelectPriority(option.level);
              }}
            >
              <span
                className="size-4 rounded-full"
                style={{ backgroundColor: option.color }}
              />
            </button>
          );
        })}
        <button
          type="button"
          aria-label="No priority"
          title="No priority"
          aria-pressed={selectedPriority == null}
          className={`flex size-8 items-center justify-center rounded-full transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
            selectedPriority == null ? "bg-zinc-100 dark:bg-zinc-800" : ""
          }`}
          onClick={(event) => {
            event.stopPropagation();
            onClearPriority();
          }}
        >
          <LuX className="size-3.5" style={{ color: "#cccccc" }} aria-hidden />
        </button>
      </div>
    </div>
  );
}
