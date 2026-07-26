export type AppFont = "inter" | "sf-pro";

export const APP_FONT_STORAGE_KEY = "todolist-app-font";

export function parseAppFont(value: string | undefined | null): AppFont {
  return value === "sf-pro" ? "sf-pro" : "inter";
}

export function appFontCookieValue(font: AppFont) {
  return `${APP_FONT_STORAGE_KEY}=${font}; path=/; max-age=31536000; SameSite=Lax`;
}
