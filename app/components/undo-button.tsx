"use client";

import { LuUndo2 } from "react-icons/lu";

type UndoButtonProps = {
  visible: boolean;
  taskName: string;
  onUndo: () => void;
};

export function UndoButton({ visible, taskName, onUndo }: UndoButtonProps) {
  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={onUndo}
      aria-label={`Undo completing ${taskName}`}
      className="fixed bottom-14 right-4 z-50 flex cursor-pointer items-center gap-3 rounded-xl bg-[#2d3139] px-6 py-3 text-sm font-medium text-white shadow-[0_4px_16px_rgba(0,0,0,0.28)] transition-opacity hover:opacity-95"
    >
      Task completed
      <LuUndo2 className="size-5 shrink-0 text-[#86efac]" aria-hidden />
    </button>
  );
}
