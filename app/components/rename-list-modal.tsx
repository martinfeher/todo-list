"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type RenameListModalProps = {
  open: boolean;
  title?: string;
  initialName?: string;
  confirmLabel?: string;
  onConfirm: (name: string) => void;
  onCancel: () => void;
};

export function RenameListModal({
  open,
  title = "Rename list",
  initialName = "",
  confirmLabel = "Save",
  onConfirm,
  onCancel,
}: RenameListModalProps) {
  const [name, setName] = useState(initialName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;

    setName(initialName);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, [open, initialName]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    onConfirm(name.trim());
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="list-name-modal-title"
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl dark:bg-zinc-900"
      >
        <h2
          id="list-name-modal-title"
          className="text-lg font-semibold text-zinc-900 dark:text-zinc-50"
        >
          {title}
        </h2>
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoFocus
          className="mt-4 h-[35px] w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
        />
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-[35px] rounded-md px-4 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim()}
            className="h-[35px] rounded-md bg-zinc-900 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
