"use client";

import type { MouseEvent, SVGProps } from "react";

const CHECKMARK_OUTLINE_CHECK_PATH =
  "m14 21.414l-5-5.001L10.413 15L14 18.586L21.585 11L23 12.415z";

const CHECKMARK_OUTLINE_CIRCLE_PATH =
  "M16 2a14 14 0 1 0 14 14A14 14 0 0 0 16 2m0 26a12 12 0 1 1 12-12a12 12 0 0 1-12 12";

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
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  "aria-label"?: string;
};

export function TaskCompletionCheckbox({
  checked,
  onChange,
  onClick,
  className = "",
  "aria-label": ariaLabel,
}: TaskCompletionCheckboxProps) {
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
