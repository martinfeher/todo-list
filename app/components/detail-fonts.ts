import { DETAIL_LINE_CLASS, isCodeLine } from "./detail-lines";

function unwrapElement(element: HTMLElement) {
  const parent = element.parentNode;
  if (!parent) return;

  while (element.firstChild) {
    parent.insertBefore(element.firstChild, element);
  }

  parent.removeChild(element);
}

function isInterOrDefaultFont(fontFamily: string) {
  if (!fontFamily.trim()) return true;

  const lower = fontFamily.toLowerCase();
  if (lower.includes("inter") || lower.includes("var(--font-inter)")) {
    return true;
  }

  const parts = lower
    .split(",")
    .map((part) => part.trim().replace(/^['"]|['"]$/g, ""));

  const genericFamilies = new Set([
    "",
    "inherit",
    "initial",
    "unset",
    "ui-sans-serif",
    "system-ui",
    "sans-serif",
    "-apple-system",
    "blinkmacsystemfont",
  ]);

  return parts.every(
    (part) => genericFamilies.has(part) || part.includes("inter"),
  );
}

function shouldSkipFontNormalization(element: Element) {
  const line = element.closest(`.${DETAIL_LINE_CLASS}`);
  if (!(line instanceof HTMLElement)) return false;

  return isCodeLine(line) || Boolean(element.closest(".detail-image-wrapper"));
}

function cleanupStyledElement(element: HTMLElement) {
  if (!element.style.cssText.trim()) {
    element.removeAttribute("style");
  }

  if (
    element.attributes.length === 0 &&
    (element.tagName === "SPAN" || element.tagName === "FONT")
  ) {
    unwrapElement(element);
  }
}

export function normalizeEditorFonts(editor: HTMLElement) {
  let changed = false;

  for (const element of Array.from(editor.querySelectorAll("font"))) {
    if (!(element instanceof HTMLElement)) continue;
    if (shouldSkipFontNormalization(element)) continue;

    if (element.hasAttribute("face")) {
      element.removeAttribute("face");
      changed = true;
    }

    if (element.style.fontFamily) {
      element.style.removeProperty("font-family");
      changed = true;
    }

    if (
      element.attributes.length === 0 ||
      (element.attributes.length === 1 &&
        element.hasAttribute("style") &&
        !element.style.cssText.trim())
    ) {
      unwrapElement(element);
      changed = true;
      continue;
    }

    cleanupStyledElement(element);
  }

  for (const element of Array.from(editor.querySelectorAll("[style*='font']"))) {
    if (!(element instanceof HTMLElement)) continue;
    if (shouldSkipFontNormalization(element)) continue;

    const fontFamily = element.style.fontFamily;
    if (fontFamily && !isInterOrDefaultFont(fontFamily)) {
      element.style.removeProperty("font-family");
      changed = true;
      cleanupStyledElement(element);
    }
  }

  return changed;
}
