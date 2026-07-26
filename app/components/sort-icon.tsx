type SortIconProps = {
  className?: string;
};

export function SortIcon({ className }: SortIconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M4.5 10V4.5M4.5 4.5L3 6.5M4.5 4.5L6 6.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11.5 6V11.5M11.5 11.5L10 9.5M11.5 11.5L13 9.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
