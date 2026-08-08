export const CALENDAR_TIME_SLOT_MINUTES = 15;

export type CalendarDropSlot = {
  dateKey: string;
  dueTimeMinutes: number | null;
};

export function snapToCalendarTimeSlot(
  minutes: number,
  timeSlotMinutes = CALENDAR_TIME_SLOT_MINUTES,
) {
  const snapped = Math.round(minutes / timeSlotMinutes) * timeSlotMinutes;
  return Math.max(0, Math.min(24 * 60 - timeSlotMinutes, snapped));
}

export function getMinutesFromCalendarGridY(
  y: number,
  hourStart: number,
  hourHeightPx: number,
  timeSlotMinutes = CALENDAR_TIME_SLOT_MINUTES,
) {
  const rawMinutes = ((y - hourHeightPx) / hourHeightPx + hourStart) * 60;
  return snapToCalendarTimeSlot(rawMinutes, timeSlotMinutes);
}

export function getTopForCalendarMinutes(
  minutes: number,
  hourStart: number,
  hourHeightPx: number,
) {
  return hourHeightPx + (minutes / 60 - hourStart) * hourHeightPx;
}

export function formatCalendarSlotTimeLabel(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export function isCalendarSlotWithinTimedGrid(
  dueTimeMinutes: number | null,
  hourStart: number,
  hourHeightPx: number,
  hourCount: number,
) {
  if (dueTimeMinutes === null) return false;

  const top = getTopForCalendarMinutes(dueTimeMinutes, hourStart, hourHeightPx);
  return top >= hourHeightPx && top <= hourCount * hourHeightPx;
}

export function resolveCalendarSlotFromPoint(
  clientX: number,
  clientY: number,
  hourStart = 8,
  hourHeightPx = 52,
): CalendarDropSlot | null {
  const element = document.elementFromPoint(clientX, clientY);
  if (!(element instanceof Element)) return null;

  const dayCell = element.closest("[data-calendar-day]");
  if (!(dayCell instanceof HTMLElement)) return null;

  const dateKey = dayCell.getAttribute("data-calendar-day");
  if (!dateKey) return null;

  if (!dayCell.hasAttribute("data-calendar-time-grid")) {
    return { dateKey, dueTimeMinutes: null };
  }

  const resolvedHourStart = Number(
    dayCell.getAttribute("data-hour-start") ?? String(hourStart),
  );
  const resolvedHourHeightPx = Number(
    dayCell.getAttribute("data-hour-height") ?? String(hourHeightPx),
  );

  const rect = dayCell.getBoundingClientRect();
  const y = clientY - rect.top;

  return {
    dateKey,
    dueTimeMinutes: getMinutesFromCalendarGridY(
      y,
      resolvedHourStart,
      resolvedHourHeightPx,
    ),
  };
}
