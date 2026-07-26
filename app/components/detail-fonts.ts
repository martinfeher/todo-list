import { DETAIL_LINE_CLASS, isCodeLine } from "./detail-lines";

export const PASTE_BATCH_ATTR = "data-paste-batch";
export const DEFAULT_DETAIL_FONT_SIZE = "17px";
export const PASTE_FORMAT_PROMPT_MS = 5000;

const FORMATTING_TAGS = new Set([
  "B",
  "STRONG",
  "I",
  "EM",
  "U",
  "S",
  "STRIKE",
  "MARK",
  "SUB",
  "SUP",
]);

function unwrapElement(element: HTMLElement) {
  const parent = element.parentNode;
  if (!parent) return;

  while (element.firstChild) {
    parent.insertBefore(element.firstChild, element);
  }

  parent.removeChild(element);
}

export function isDefaultAppFont(fontFamily: string) {
  if (!fontFamily.trim()) return true;

  const lower = fontFamily.toLowerCase();
  if (
    lower.includes("sf pro") ||
    lower.includes("sf-pro") ||
    lower.includes("var(--font-sf-pro)") ||
    lower.includes("inter") ||
    lower.includes("var(--font-inter)")
  ) {
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
    (part) =>
      genericFamilies.has(part) ||
      part.includes("sf pro") ||
      part.includes("sf-pro") ||
      part.includes("inter"),
  );
}

export function isDefaultDetailFontSize(fontSize: string) {
  if (!fontSize.trim()) return true;

  const normalized = fontSize.trim().toLowerCase();
  if (
    normalized === "inherit" ||
    normalized === "initial" ||
    normalized === "unset" ||
    normalized === DEFAULT_DETAIL_FONT_SIZE ||
    normalized === "1.0625rem"
  ) {
    return true;
  }

  return false;
}

export function getDefaultAppFontFamily() {
  if (typeof document === "undefined") {
    return "var(--font-inter), sans-serif";
  }

  return document.documentElement.dataset.appFont === "sf-pro"
    ? "var(--font-sf-pro), sans-serif"
    : "var(--font-inter), sans-serif";
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

export function sanitizePastedHtml(html: string) {
  const doc = new DOMParser().parseFromString(html, "text/html");

  doc
    .querySelectorAll("script, style, meta, link, head, title")
    .forEach((element) => element.remove());

  return doc.body.innerHTML;
}

function elementHasPasteFormatting(element: HTMLElement) {
  if (FORMATTING_TAGS.has(element.tagName)) return true;

  if (element.tagName === "FONT") {
    if (element.hasAttribute("face") || element.hasAttribute("size")) {
      return true;
    }
  }

  const style = element.style;
  if (style.fontFamily && !isDefaultAppFont(style.fontFamily)) return true;
  if (style.fontSize && !isDefaultDetailFontSize(style.fontSize)) return true;
  if (
    style.fontWeight &&
    style.fontWeight !== "normal" &&
    style.fontWeight !== "400"
  ) {
    return true;
  }
  if (style.fontStyle && style.fontStyle !== "normal") return true;
  if (style.textDecoration && style.textDecoration !== "none") return true;
  if (style.color) return true;
  if (style.backgroundColor) return true;

  return false;
}

export function pastedHtmlHasFormatting(html: string) {
  const sanitized = sanitizePastedHtml(html);
  if (!sanitized.trim()) return false;

  const doc = new DOMParser().parseFromString(sanitized, "text/html");
  const body = doc.body;

  for (const element of body.querySelectorAll("*")) {
    if (!(element instanceof HTMLElement)) continue;
    if (elementHasPasteFormatting(element)) return true;
  }

  return false;
}

export function markPasteBatch(root: ParentNode, pasteId: string) {
  if (root instanceof HTMLElement) {
    root.dataset.pasteBatch = pasteId;
  }

  for (const element of root.querySelectorAll("*")) {
    if (element instanceof HTMLElement) {
      element.dataset.pasteBatch = pasteId;
    }
  }
}

export function preparePasteFragment(html: string, pasteId: string) {
  const template = document.createElement("template");
  template.innerHTML = sanitizePastedHtml(html);

  const fragment = document.createDocumentFragment();

  while (template.content.firstChild) {
    const node = template.content.firstChild;

    if (node.nodeType === Node.TEXT_NODE) {
      if (!node.textContent?.trim()) {
        fragment.appendChild(node);
        continue;
      }

      const span = document.createElement("span");
      span.dataset.pasteBatch = pasteId;
      span.appendChild(node);
      fragment.appendChild(span);
      continue;
    }

    if (node instanceof HTMLElement) {
      markPasteBatch(node, pasteId);
    }

    fragment.appendChild(node);
  }

  return fragment;
}

export function insertPasteFragmentAtSelection(fragment: DocumentFragment) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  range.deleteContents();

  const lastInsertedNode = fragment.lastChild;
  range.insertNode(fragment);

  if (!lastInsertedNode) return;

  range.setStartAfter(lastInsertedNode);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function getPasteBatchSelector(pasteId: string) {
  return `[${PASTE_BATCH_ATTR}="${pasteId}"]`;
}

function cleanupPasteBatchElement(element: HTMLElement) {
  if (!element.style.cssText.trim()) {
    element.removeAttribute("style");
  }

  if (
    element.attributes.length === 1 &&
    element.hasAttribute(PASTE_BATCH_ATTR)
  ) {
    if (element.tagName === "SPAN" || element.tagName === "FONT") {
      unwrapElement(element);
    }
  }
}

export function stripFormattingInPasteBatch(
  editor: HTMLElement,
  pasteId: string,
) {
  let changed = false;
  const selector = getPasteBatchSelector(pasteId);
  const elements = Array.from(editor.querySelectorAll(selector)) as HTMLElement[];

  for (const element of [...elements].reverse()) {
    if (shouldSkipFontNormalization(element)) continue;

    if (FORMATTING_TAGS.has(element.tagName)) {
      unwrapElement(element);
      changed = true;
      continue;
    }

    if (element.tagName === "FONT") {
      unwrapElement(element);
      changed = true;
      continue;
    }

    if (element.hasAttribute("style")) {
      element.removeAttribute("style");
      changed = true;
    }

    cleanupPasteBatchElement(element);
  }

  return changed;
}

export function resetFontFamilyInPasteBatch(
  editor: HTMLElement,
  pasteId: string,
) {
  let changed = false;
  const selector = getPasteBatchSelector(pasteId);

  for (const element of Array.from(editor.querySelectorAll(selector))) {
    if (!(element instanceof HTMLElement)) continue;
    if (shouldSkipFontNormalization(element)) continue;

    if (element.tagName === "FONT" && element.hasAttribute("face")) {
      element.removeAttribute("face");
      changed = true;
    }

    if (element.style.fontFamily) {
      element.style.removeProperty("font-family");
      changed = true;
    }

    cleanupPasteBatchElement(element);
  }

  return changed;
}

export function resetFontSizeInPasteBatch(
  editor: HTMLElement,
  pasteId: string,
) {
  let changed = false;
  const selector = getPasteBatchSelector(pasteId);

  for (const element of Array.from(editor.querySelectorAll(selector))) {
    if (!(element instanceof HTMLElement)) continue;
    if (shouldSkipFontNormalization(element)) continue;

    if (element.tagName === "FONT" && element.hasAttribute("size")) {
      element.removeAttribute("size");
      changed = true;
    }

    if (element.style.fontSize) {
      element.style.removeProperty("font-size");
      changed = true;
    }

    cleanupPasteBatchElement(element);
  }

  return changed;
}

export function clearPasteBatchMarkers(editor: HTMLElement, pasteId: string) {
  for (const element of Array.from(
    editor.querySelectorAll(getPasteBatchSelector(pasteId)),
  )) {
    if (element instanceof HTMLElement) {
      delete element.dataset.pasteBatch;
    }
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
    if (fontFamily && !isDefaultAppFont(fontFamily)) {
      element.style.removeProperty("font-family");
      changed = true;
      cleanupStyledElement(element);
    }
  }

  return changed;
}
