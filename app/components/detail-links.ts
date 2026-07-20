export const DETAIL_LINK_CLASS = "detail-link";

function normalizeLinkUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return "";

  if (/^(https?:|mailto:|tel:)/i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

export function getLinkFromSelection(
  selection: Selection | null,
  editor: HTMLElement,
) {
  if (!selection || selection.rangeCount === 0) return null;

  const node = selection.anchorNode;
  if (!node || !editor.contains(node)) return null;

  const element =
    node instanceof HTMLElement ? node : node.parentElement;

  const anchor = element?.closest(`a.${DETAIL_LINK_CLASS}`);
  return anchor instanceof HTMLAnchorElement && editor.contains(anchor)
    ? anchor
    : null;
}

export function applyLinkToSelection(
  editor: HTMLElement,
  url: string,
  text: string,
) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return false;

  const normalizedUrl = normalizeLinkUrl(url);
  const linkText = text.trim();
  if (!normalizedUrl || !linkText) return false;

  const range = selection.getRangeAt(0);
  if (!editor.contains(range.commonAncestorContainer)) return false;

  const existingLink = getLinkFromSelection(selection, editor);

  if (existingLink) {
    existingLink.href = normalizedUrl;
    existingLink.textContent = linkText;
    existingLink.target = "_blank";
    existingLink.rel = "noopener noreferrer";
    existingLink.classList.add(DETAIL_LINK_CLASS);
    return true;
  }

  const anchor = document.createElement("a");
  anchor.href = normalizedUrl;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  anchor.className = DETAIL_LINK_CLASS;
  anchor.textContent = linkText;

  if (!range.collapsed) {
    range.deleteContents();
  }

  range.insertNode(anchor);

  const nextRange = document.createRange();
  nextRange.setStartAfter(anchor);
  nextRange.collapse(true);
  selection.removeAllRanges();
  selection.addRange(nextRange);

  return true;
}

export function removeLinkFromSelection(editor: HTMLElement) {
  const selection = window.getSelection();
  if (!selection) return false;

  const existingLink = getLinkFromSelection(selection, editor);
  if (!existingLink) return false;

  const text = document.createTextNode(existingLink.textContent ?? "");
  existingLink.replaceWith(text);

  return true;
}

export function getLinkEditorState(
  editor: HTMLElement,
  selection: Selection | null,
) {
  const existingLink = getLinkFromSelection(selection, editor);
  let text = "";

  if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
    text = selection.toString();
  }

  if (existingLink) {
    return {
      text: existingLink.textContent ?? text,
      url: existingLink.getAttribute("href") ?? "",
      hasExistingLink: true,
    };
  }

  return {
    text,
    url: "",
    hasExistingLink: false,
  };
}

export function normalizeLinks(editor: HTMLElement) {
  editor.querySelectorAll("a").forEach((anchor) => {
    if (!(anchor instanceof HTMLAnchorElement) || !editor.contains(anchor)) {
      return;
    }

    anchor.classList.add(DETAIL_LINK_CLASS);
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
  });
}
