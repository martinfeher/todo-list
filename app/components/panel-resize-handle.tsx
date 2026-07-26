"use client";

type PanelResizeHandleProps = {
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
};

export function PanelResizeHandle({ onPointerDown }: PanelResizeHandleProps) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize panels"
      onPointerDown={onPointerDown}
      className="group relative w-1 shrink-0 cursor-col-resize touch-none bg-zinc-200 dark:bg-zinc-800"
    >
      <div className="absolute inset-y-0 -left-1 -right-1" />
      <div className="absolute inset-y-0 left-0 w-px bg-zinc-300 opacity-0 transition-opacity group-hover:opacity-100 dark:bg-zinc-600" />
    </div>
  );
}
