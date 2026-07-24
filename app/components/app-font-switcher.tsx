"use client";

import { useEffect, useState } from "react";

export type AppFont = "inter" | "sf-pro";

const STORAGE_KEY = "todolist-app-font";

export function getStoredAppFont(): AppFont {
  if (typeof window === "undefined") return "inter";

  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "sf-pro" ? "sf-pro" : "inter";
}

export function applyAppFont(font: AppFont) {
  document.documentElement.dataset.appFont = font;
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
    applyAppFont(stored);
  }, []);

  function selectFont(next: AppFont) {
    setFont(next);
    applyAppFont(next);
    localStorage.setItem(STORAGE_KEY, next);
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
