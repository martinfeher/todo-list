export function getCalendarShellClassName(
  fullWidth = false,
  maxWidthClass = "max-w-7xl",
) {
  return fullWidth
    ? "flex h-full w-full min-h-0 flex-col"
    : `mx-auto flex h-full w-full ${maxWidthClass} min-h-0 flex-col`;
}
