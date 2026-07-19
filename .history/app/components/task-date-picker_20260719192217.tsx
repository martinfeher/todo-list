"use client";

import { useMemo, useState } from "react";
import {
  BiChevronLeft,
  BiChevronRight,
  BiRevision,
  BiSun,
  BiTimeFive,
} from "react-icons/bi";

type TaskDatePickerProps = {
  dueDate: string | null;
  onSelectDate: (dateValue: string) => void;
};

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(12, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return startOfDay(next);
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function toDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromDateValue(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : startOfDay(date);
}

function isPastDay(day: Date, today: Date) {
  return toDateValue(day) < toDateValue(today);
}

type ParsedTypedDate = {
  date: Date;
  normalized: string;
};

function formatNormalizedDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

function normalizeYear(year: number) {
  if (year < 100) {
    return 2000 + year;
  }
  return year;
}

function buildDate(year: number, month: number, day: number) {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function parseNumericDateInput(input: string, today: Date) {
  const trimmed = input.trim();

  const isoMatch = trimmed.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
  if (isoMatch) {
    return buildDate(
      parseInt(isoMatch[1], 10),
      parseInt(isoMatch[2], 10),
      parseInt(isoMatch[3], 10),
    );
  }

  const dottedFullMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (dottedFullMatch) {
    return buildDate(
      normalizeYear(parseInt(dottedFullMatch[3], 10)),
      parseInt(dottedFullMatch[2], 10),
      parseInt(dottedFullMatch[1], 10),
    );
  }

  const dottedShortMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})$/);
  if (dottedShortMatch) {
    return buildDate(
      today.getFullYear(),
      parseInt(dottedShortMatch[2], 10),
      parseInt(dottedShortMatch[1], 10),
    );
  }

  const fullMatch = trimmed.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (fullMatch) {
    const part1 = parseInt(fullMatch[1], 10);
    const part2 = parseInt(fullMatch[2], 10);
    const year = normalizeYear(parseInt(fullMatch[3], 10));

    if (part1 > 12) {
      return buildDate(year, part2, part1);
    }

    if (part2 > 12) {
      return buildDate(year, part1, part2);
    }

    return buildDate(year, part1, part2);
  }

  const shortMatch = trimmed.match(/^(\d{1,2})[\/-](\d{1,2})$/);
  if (shortMatch) {
    return buildDate(
      today.getFullYear(),
      parseInt(shortMatch[1], 10),
      parseInt(shortMatch[2], 10),
    );
  }

  return null;
}

function parseTypedDate(input: string, today: Date): ParsedTypedDate | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const lowered = trimmed.toLowerCase();

  if (lowered === "today") {
    return { date: today, normalized: formatNormalizedDate(today) };
  }

  if (lowered === "tomorrow") {
    const date = addDays(today, 1);
    return { date, normalized: formatNormalizedDate(date) };
  }

  const numericDate = parseNumericDateInput(trimmed, today);
  if (numericDate && !isPastDay(numericDate, today)) {
    return {
      date: numericDate,
      normalized: formatNormalizedDate(numericDate),
    };
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    const date = startOfDay(parsed);
    if (!isPastDay(date, today)) {
      return { date, normalized: formatNormalizedDate(date) };
    }
  }

  return null;
}

function formatMonthYear(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatWeekdayShort(date: Date) {
  return new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date);
}

function getMonthDays(year: number, month: number, today: Date) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const visibleDays: Date[] = [];

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day, 12, 0, 0, 0);
    if (!isPastDay(date, today)) {
      visibleDays.push(date);
    }
  }

  if (visibleDays.length === 0) {
    return [];
  }

  const padding = visibleDays[0].getDay();
  const cells: (Date | null)[] = Array.from({ length: padding }, () => null);
  return [...cells, ...visibleDays];
}

function TodayIcon() {
  const today = new Date().getDate();
  return (
    <span className="relative flex size-6 items-center justify-center rounded-md bg-emerald-500 text-[11px] font-semibold text-white">
      {today}
    </span>
  );
}

function MonthGrid({
  monthDate,
  today,
  selectedDate,
  onSelectDate,
  showHeading = true,
}: {
  monthDate: Date;
  today: Date;
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  showHeading?: boolean;
}) {
  const days = useMemo(
    () => getMonthDays(monthDate.getFullYear(), monthDate.getMonth(), today),
    [monthDate, today],
  );

  if (days.length === 0) {
    return null;
  }

  return (
    <div>
      {showHeading && (
        <div className="mb-2 flex items-center justify-between px-3">
          <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            {formatMonthYear(monthDate)}
          </h4>
        </div>
      )}

      {!showHeading && (
        <h4 className="mb-2 px-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          {new Intl.DateTimeFormat(undefined, { month: "short" }).format(monthDate)}
        </h4>
      )}

      <div className="grid grid-cols-7 px-2">
        {WEEKDAY_LABELS.map((label, index) => (
          <div
            key={`${label}-${index}`}
            className="flex h-8 items-center justify-center text-xs font-medium text-zinc-400"
          >
            {label}
          </div>
        ))}

        {days.map((day, index) => {
          if (!day) {
            return <div key={`empty-${index}`} className="h-9" />;
          }

          const isSunday = day.getDay() === 0;
          const isToday = isSameDay(day, today);
          const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelectDate(day)}
              className="flex h-9 flex-col items-center justify-center rounded-xl transition-colors hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
            >
              <span
                className={`flex size-7 items-center justify-center rounded-full text-sm ${
                  isSelected
                    ? "bg-zinc-500 font-semibold text-white"
                    : isSunday
                      ? "font-medium text-ora-500"
                      : "text-zinc-600 dark:text-zinc-100"
                }`}
              >
                {day.getDate()}
              </span>
              {isToday && !isSelected && (
                <span className="mt-0.5 size-1 rounded-full bg-zinc-400" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TaskDatePicker({ dueDate, onSelectDate }: TaskDatePickerProps) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const selectedDate = fromDateValue(dueDate);
  const todayMonth = useMemo(
    () => new Date(today.getFullYear(), today.getMonth(), 1, 12, 0, 0, 0),
    [today],
  );
  const [typedDate, setTypedDate] = useState("");
  const [dateInputError, setDateInputError] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => {
    const base = selectedDate ?? today;
    const baseMonth = new Date(base.getFullYear(), base.getMonth(), 1, 12, 0, 0, 0);
    return baseMonth < todayMonth ? todayMonth : baseMonth;
  });

  const tomorrow = addDays(today, 1);
  const nextMonth = useMemo(
    () => new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1, 12, 0, 0, 0),
    [viewMonth],
  );
  const canGoToPreviousMonth = viewMonth > todayMonth;

  function selectDate(date: Date) {
    onSelectDate(toDateValue(date));
  }

  function handleTypedDateSubmit() {
    const parsed = parseTypedDate(typedDate, today);
    if (!parsed) {
      setDateInputError(true);
      return;
    }

    setDateInputError(false);
    setTypedDate(parsed.normalized);
    selectDate(parsed.date);
  }

  function shiftMonth(offset: number) {
    if (offset < 0 && !canGoToPreviousMonth) return;

    setViewMonth(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() + offset, 1, 12, 0, 0, 0),
    );
  }

  const quickOptions = [
    {
      key: "today",
      label: "Today",
      hint: formatWeekdayShort(today),
      icon: <TodayIcon />,
      date: today,
    },
    {
      key: "tomorrow",
      label: "Tomorrow",
      hint: formatWeekdayShort(tomorrow),
      icon: <BiSun className="size-6 text-amber-500" />,
      date: tomorrow,
    },
  ];

  return (
    <div className="w-[280px] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
      <div className="border-b border-zinc-200 px-3 py-2.5 dark:border-zinc-700">
        <input
          type="text"
          value={typedDate}
          onChange={(event) => {
            setTypedDate(event.target.value);
            if (dateInputError) {
              setDateInputError(false);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              handleTypedDateSubmit();
            }
          }}
          placeholder="Type a date"
          aria-invalid={dateInputError}
          className={`w-full bg-transparent text-sm outline-none placeholder:text-zinc-400 dark:text-zinc-50 ${
            dateInputError
              ? "text-red-600 placeholder:text-red-300"
              : "text-zinc-900"
          }`}
        />
        {dateInputError && (
          <p className="mt-1 text-xs text-red-500">
            Enter a valid future date, e.g. 07/05/2026 or 15.09.2026
          </p>
        )}
      </div>

      <div className="py-1">
        {quickOptions.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => selectDate(option.date)}
            className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/80"
          >
            <span className="flex w-6 shrink-0 items-center justify-center">
              {option.icon}
            </span>
            <span className="flex-1 text-sm text-zinc-900 dark:text-zinc-50">
              {option.label}
            </span>
            <span className="text-sm text-zinc-400">{option.hint}</span>
          </button>
        ))}
      </div>

      <div className="border-t border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center justify-between px-3 py-2">
          <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            {formatMonthYear(viewMonth)}
          </h4>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous month"
              disabled={!canGoToPreviousMonth}
              onClick={() => shiftMonth(-1)}
              className="flex size-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-zinc-800"
            >
              <BiChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              aria-label="Go to today"
              onClick={() => {
                setViewMonth(todayMonth);
              }}
              className="flex size-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <span className="size-2 rounded-full bg-zinc-400" />
            </button>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => shiftMonth(1)}
              className="flex size-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <BiChevronRight className="size-5" />
            </button>
          </div>
        </div>

        <div className="max-h-[220px] overflow-y-auto pb-2">
          <MonthGrid
            monthDate={viewMonth}
            today={today}
            selectedDate={selectedDate}
            onSelectDate={selectDate}
            showHeading={false}
          />
          <MonthGrid
            monthDate={nextMonth}
            today={today}
            selectedDate={selectedDate}
            onSelectDate={selectDate}
            showHeading={false}
          />
        </div>
      </div>

      <div className="space-y-2 border-t border-zinc-200 p-3 dark:border-zinc-700">
        <button
          type="button"
          disabled
          title="Coming soon"
          className="flex w-full items-center justify-center gap-2 rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-400 dark:border-zinc-700"
        >
          <BiTimeFive className="size-4" />
          Time
        </button>
        <button
          type="button"
          disabled
          title="Coming soon"
          className="flex w-full items-center justify-center gap-2 rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-400 dark:border-zinc-700"
        >
          <BiRevision className="size-4" />
          Repeat
        </button>
      </div>
    </div>
  );
}
