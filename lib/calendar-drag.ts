export function resolveCalendarDayFromPoint(clientX: number, clientY: number) {
  const element = document.elementFromPoint(clientX, clientY);
  if (!(element instanceof Element)) return null;

  const dayCell = element.closest("[data-calendar-day]");
  return dayCell?.getAttribute("data-calendar-day") ?? null;
}

export { resolveCalendarSlotFromPoint } from "@/lib/calendar-time-grid";
export type { CalendarDropSlot } from "@/lib/calendar-time-grid";
