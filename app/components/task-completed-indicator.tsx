import { BiCheck } from "react-icons/bi";
import { LuCircle } from "react-icons/lu";

export function TaskCompletedIndicator() {
  return (
    <div className="flex min-w-0 flex-1 items-center justify-center gap-2 py-0.5">
      <span className="relative flex size-5 shrink-0 items-center justify-center">
        <LuCircle className="size-5 text-zinc-400 dark:text-zinc-500" aria-hidden />
        <BiCheck
          className="absolute size-3.5 text-[#86efac]"
          strokeWidth={1.5}
          aria-hidden
        />
      </span>
      <span className="text-sm text-zinc-500 dark:text-zinc-400">Completed</span>
    </div>
  );
}
