import { TaskCompletionIcon } from "./task-completion-checkbox";

export function TaskCompletedIndicator() {
  return (
    <div className="flex min-w-0 flex-1 items-center justify-start gap-2 py-0.5 ml-[15px]">
      {/* <TaskCompletionIcon className="size-4 shrink-0 text-[#9eecba]" /> */}
      <span className="text-sm text-zinc-350 dark:text-zinc-400">completed</span>
    </div>
  );
}
