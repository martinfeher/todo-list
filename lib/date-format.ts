const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** Locale-independent short date, e.g. "4 Aug". Safe for SSR hydration. */
export function formatShortDayMonth(date: Date) {
  return `${date.getDate()} ${SHORT_MONTHS[date.getMonth()]}`;
}

/** Locale-independent date with year, e.g. "4 Aug 2026". Safe for SSR hydration. */
export function formatShortDayMonthYear(date: Date) {
  return `${formatShortDayMonth(date)} ${date.getFullYear()}`;
}
