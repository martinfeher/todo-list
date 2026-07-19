"use client";

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
      className="fixed bottom-6 right-6 z-50 rounded-md bg-slate-4 px-4 py-2 text-sm font-medium text-white shadow-lg transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
    >
      Undo: {taskName}
    </button>
  );
}
