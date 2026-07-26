"use client";

import { useEffect, useMemo, useRef } from "react";
import { BiCheck, BiSearch } from "react-icons/bi";
import { IoPricetagsOutline } from "react-icons/io5";
import { LuPlus, LuX } from "react-icons/lu";

export type Label = {
  id: string;
  label: string;
};

type TaskLabelSelectorProps = {
  labels: Label[];
  assignedLabelIds: string[];
  query: string;
  isSubmitting?: boolean;
  onQueryChange: (value: string) => void;
  onToggleLabel: (labelId: string) => void;
  onCreateLabel: (label: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

function hasExactLabelMatch(labels: Label[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return false;

  return labels.some((item) => item.label.toLowerCase() === normalized);
}

export function TaskLabelSelector({
  labels,
  assignedLabelIds,
  query,
  isSubmitting = false,
  onQueryChange,
  onToggleLabel,
  onCreateLabel,
  onCancel,
  onConfirm,
}: TaskLabelSelectorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const trimmedQuery = query.trim();

  useEffect(() => {
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, []);

  const assignedLabels = useMemo(
    () => labels.filter((item) => assignedLabelIds.includes(item.id)),
    [assignedLabelIds, labels],
  );

  const filteredLabels = useMemo(() => {
    const normalized = trimmedQuery.toLowerCase();
    if (!normalized) return labels;

    return labels.filter((item) =>
      item.label.toLowerCase().includes(normalized),
    );
  }, [labels, trimmedQuery]);

  const showCreateLabel =
    trimmedQuery.length > 0 && !hasExactLabelMatch(labels, trimmedQuery);

  return (
    <div
      role="dialog"
      aria-label="Add label"
      className="w-[280px] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="border-b border-zinc-200 px-3 py-2.5 dark:border-zinc-700">
        {assignedLabels.length > 0 ? (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {assignedLabels.map((item) => (
              <span
                key={item.id}
                className="inline-flex items-center gap-1 rounded-full bg-[#dbeafe] px-2.5 py-0.5 text-xs font-medium text-[#4873c7] dark:bg-[#1e3a5f] dark:text-[#93c5fd]"
              >
                {item.label}
                <button
                  type="button"
                  aria-label={`Remove ${item.label}`}
                  disabled={isSubmitting}
                  onClick={() => onToggleLabel(item.id)}
                  className="rounded-full p-0.5 transition-colors hover:bg-[#4873c7]/10 disabled:opacity-50"
                >
                  <LuX className="size-3" />
                </button>
              </span>
            ))}
          </div>
        ) : null}

        <div className="flex items-center gap-2">
          <BiSearch className="size-4 shrink-0 text-zinc-400" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Type in a label"
            aria-label="Type in a label"
            className="min-w-0 flex-1 bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-50"
            onKeyDown={(event) => {
              if (event.key === "Enter" && !isSubmitting) {
                event.preventDefault();
                if (showCreateLabel) {
                  onCreateLabel(trimmedQuery);
                } else {
                  onConfirm();
                }
              }

              if (event.key === "Escape") {
                event.preventDefault();
                onCancel();
              }
            }}
          />
        </div>
      </div>

      <div className="max-h-[220px] overflow-y-auto py-1">
        {showCreateLabel ? (
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => onCreateLabel(trimmedQuery)}
            className="flex min-h-[38px] w-full items-center gap-2.5 px-4 py-2 text-left text-sm text-zinc-800 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:text-zinc-100 dark:hover:bg-zinc-800/70"
          >
            <span className="relative flex size-4 shrink-0 items-center justify-center text-zinc-500 dark:text-zinc-400">
              <IoPricetagsOutline className="size-4" />
              <LuPlus className="absolute -right-1 -top-1 size-2.5 rounded-full bg-white dark:bg-zinc-900" />
            </span>
            <span className="truncate">
              Create label &quot;{trimmedQuery}&quot;
            </span>
          </button>
        ) : null}

        {filteredLabels.length === 0 ? (
          !showCreateLabel ? (
            <p className="px-4 py-3 text-sm text-zinc-400 dark:text-zinc-500">
              {trimmedQuery ? "No matching labels" : "No labels yet"}
            </p>
          ) : null
        ) : (
          filteredLabels.map((item) => {
            const isAssigned = assignedLabelIds.includes(item.id);

            return (
              <button
                key={item.id}
                type="button"
                disabled={isSubmitting}
                onClick={() => onToggleLabel(item.id)}
                className={`flex h-[38px] w-full items-center gap-2.5 px-4 text-left text-sm transition-colors cursor-pointer disabled:opacity-50 ${
                  isAssigned
                    ? "text-[#4873c7] hover:bg-blue-50 dark:text-[#93c5fd] dark:hover:bg-blue-950/30"
                    : "text-zinc-800 hover:bg-zinc-50 dark:text-zinc-100 dark:hover:bg-zinc-800/70"
                }`}
              >
                <IoPricetagsOutline
                  className={`size-4 shrink-0 ${
                    isAssigned
                      ? "text-[#4873c7] dark:text-[#93c5fd]"
                      : "text-zinc-500 dark:text-zinc-400"
                  }`}
                />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {isAssigned ? (
                  <BiCheck className="size-4 shrink-0 text-[#4873c7] dark:text-[#93c5fd]" />
                ) : null}
              </button>
            );
          })
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-zinc-200 px-4 py-3 dark:border-zinc-700">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="rounded-full border border-zinc-200 bg-white px-5 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isSubmitting}
          className="rounded-full bg-[#4873c7] px-7 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#3f68bd] disabled:opacity-50"
        >
          OK
        </button>
      </div>
    </div>
  );
}
