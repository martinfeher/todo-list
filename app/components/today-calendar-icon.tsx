type TodayCalendarIconProps = {
  className?: string;
  day?: number;
};

export function TodayCalendarIcon({
  className,
  day = new Date().getDate(),
}: TodayCalendarIconProps) {
  const dayLabel = String(day);
  const fontSize = dayLabel.length > 1 ? 7.5 : 8.5;

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <rect
        x="4"
        y="5"
        width="16"
        height="16"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M4 9.5h16"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M8 3.5v3M16 3.5v3"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <text
        x="12"
        y="17.5"
        textAnchor="middle"
        fill="currentColor"
        fontSize={fontSize}
        fontWeight="700"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
      >
        {dayLabel}
      </text>
    </svg>
  );
}
