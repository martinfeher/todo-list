"use client";

import type { CSSProperties, MouseEvent, SVGProps } from "react";

const CHECKMARK_OUTLINE_CHECK_PATH =
  "m14 21.414l-5-5.001L10.413 15L14 18.586L21.585 11L23 12.415z";

const CHECKMARK_OUTLINE_CIRCLE_PATH =
  "M16 2a14 14 0 1 0 14 14A14 14 0 0 0 16 2m0 26a12 12 0 1 1 12-12a12 12 0 0 1-12 12";

export const CHECKMARK_HIDE_MS = 950;
export const CHECKMARK_HIDE_FADE_MS = 200;
/** Row celebration + settle background animation duration. */
export const TASK_COMPLETE_ANIMATION_MS = 350;
/** Text/content dim during task completion. */
export const CHECKED_ROW_DIM_MS = TASK_COMPLETE_ANIMATION_MS;
const checkStartTimes = new Map<string, number>();

export function clearCheckboxCheckStart(checkKey: string) {
  checkStartTimes.delete(checkKey);
}

function CheckmarkOutlineIcon({
  className,
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      fill="currentColor"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <path d={CHECKMARK_OUTLINE_CIRCLE_PATH} fillRule="evenodd" />
      <path
        className="opacity-20 transition-opacity group-hover:opacity-100"
        d={CHECKMARK_OUTLINE_CHECK_PATH}
      />
    </svg>
  );
}

type TaskCompletionCheckboxProps = {
  checked: boolean;
  onChange: () => void;
  onClick?: (event: MouseEvent<HTMLButtonElement | HTMLInputElement>) => void;
  className?: string;
  variant?: "outline" | "box";
  checkKey?: string;
  /** Only the actively checking box should animate (avoids animating the next row). */
  animateCheck?: boolean;
  "aria-label"?: string;
};

export function TaskCompletionCheckbox({
  checked,
  onChange,
  onClick,
  className = "",
  variant = "outline",
  checkKey,
  animateCheck = false,
  "aria-label": ariaLabel,
}: TaskCompletionCheckboxProps) {
  if (variant === "box") {
    if (checkKey) {
      if (checked) {
        if (!checkStartTimes.has(checkKey)) {
          checkStartTimes.set(checkKey, Date.now());
        }
      } else {
        checkStartTimes.delete(checkKey);
      }
    }

    const startedAt = checkKey ? checkStartTimes.get(checkKey) : undefined;
    const elapsedMs = startedAt != null ? Date.now() - startedAt : 0;
    const hideDelayMs =
      checked && startedAt != null
        ? Math.max(0, CHECKMARK_HIDE_MS - elapsedMs)
        : CHECKMARK_HIDE_MS;
    const checkHidden =
      checked && startedAt != null && elapsedMs >= CHECKMARK_HIDE_MS;

    return (
      <div
        className={`checkbox-wrapper-29 shrink-0 ${
          animateCheck ? "animate-check" : ""
        } ${checkHidden ? "check-hidden" : ""} ${className}`}
        style={
          {
            "--check-hide-delay": `${hideDelayMs}ms`,
          } as CSSProperties
        }
        onClick={(event) => event.stopPropagation()}
      >
        <label className="checkbox">
          <input
            type="checkbox"
            className="checkbox__input"
            checked={checked}
            aria-label={ariaLabel}
            onChange={onChange}
            onClick={(event) => {
              onClick?.(event);
            }}
          />
          <span className="checkbox__label" />
        </label>
      </div>
    );
  }

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={(event) => {
        onClick?.(event);
        onChange();
      }}
      className={`group inline-flex shrink-0 items-center justify-center rounded-full p-0 transition-colors hover:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/60 dark:hover:text-zinc-300 dark:focus-visible:ring-zinc-500/60 ${
        checked
          ? "text-[#5b8b6f] dark:text-zinc-300"
          : "text-[#31d988] hover:text-[#5b8b6f] dark:text-zinc-500 dark:hover:text-zinc-400 cursor-pointer"
      } ${className}`}
    >
      <CheckmarkOutlineIcon className="size-[19px]" />
    </button>
  );
}

export function TaskCompletionIcon({
  className = "size-8",
}: {
  checked?: boolean;
  className?: string;
}) {
  return <CheckmarkOutlineIcon className={className} />;
}
