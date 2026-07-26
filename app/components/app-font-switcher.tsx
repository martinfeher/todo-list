"use client";

import { useEffect, useState } from "react";
import {
  APP_FONT_STORAGE_KEY,
  appFontCookieValue,
  parseAppFont,
  type AppFont,
} from "@/lib/app-font";

export type { AppFont } from "@/lib/app-font";

export function getStoredAppFont(): AppFont {
  if (typeof window === "undefined") return "inter";

  const stored = localStorage.getItem(APP_FONT_STORAGE_KEY);
  return parseAppFont(stored);
}

export function applyAppFont(font: AppFont) {
  document.documentElement.dataset.appFont = font;
}

function persistAppFont(font: AppFont) {
  applyAppFont(font);
  localStorage.setItem(APP_FONT_STORAGE_KEY, font);
  document.cookie = appFontCookieValue(font);
}

const FONT_OPTIONS: { value: AppFont; label: string }[] = [
  { value: "inter", label: "Inter" },
  { value: "sf-pro", label: "SF Pro" },
];

export function AppFontSwitcher() {
  const [font, setFont] = useState<AppFont>("inter");

  useEffect(() => {
    const stored = getStoredAppFont();
    setFont(stored);
    persistAppFont(stored);
  }, []);

  function selectFont(next: AppFont) {
    setFont(next);
    persistAppFont(next);
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-40 flex overflow-hidden rounded-lg border border-zinc-200 bg-white/95 shadow-md backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-900/95"
      role="group"
      aria-label="App font"
    >
      {FONT_OPTIONS.map((option) => {
        const isActive = font === option.value;

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => selectFont(option.value)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
              isActive
                ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
            style={
              option.value === "inter"
                ? { fontFamily: "var(--font-inter), sans-serif" }
                : { fontFamily: "var(--font-sf-pro), sans-serif" }
            }
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
