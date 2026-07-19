export const DETAIL_LINE_CLASS = "detail-line";

export type LineBlockType =
  | "text"
  | "h1"
  | "h2"
  | "bullet"
  | "numbered"
  | "checklist";

function generateLineId() {
  return crypto.randomUUID();
}

function createLineElement(html = "<br>", type: LineBlockType = "text") {
  const line = document.createElement("div");
  line.className = DETAIL_LINE_CLASS;
  line.dataset.lineId = generateLineId();
  if (type !== "text") {
    line.dataset.lineType = type;
  }
  line.innerHTML = html;
  return line;
}

function htmlToLineParts(html: string) {
  if (!html.trim()) return ["<br>"];

  const normalized = html
    .replace(/<\/div>\s*<div[^>]*>/gi, "<<LINE_BREAK>>")
    .replace(/<br\s*\/?>/gi, "<<LINE_BREAK>>");

  const parts = normalized.split("<<LINE_BREAK>>").map((part) => part.trim());

  return parts.length > 0 ? parts.map((part) => part || "<br>") : ["<br>"];
}

export function getLineElements(editor: HTMLElement) {
  return Array.from(
    editor.querySelectorAll(`:scope > .${DETAIL_LINE_CLASS}`),
  ) as HTMLElement[];
}

export function ensureBlockLines(editor: HTMLElement) {
  const existingLines = getLineElements(editor);

  if (existingLines.length > 0) {
    existingLines.forEach((line) => {
      if (!line.dataset.lineId) {
        line.dataset.lineId = generateLineId();
      }
    });
    return;
  }

  const parts = htmlToLineParts(editor.innerHTML);
  editor.innerHTML = "";
  parts.forEach((part) => {
    editor.appendChild(createLineElement(part));
  });
}

export function getActiveLineElement(editor: HTMLElement) {
  const selection = window.getSelection();
  if (!selection?.focusNode || !editor.contains(selection.focusNode)) {
    return null;
  }

  let node: Node | null = selection.focusNode;

  while (node && node !== editor) {
    if (
      node instanceof HTMLElement &&
      node.classList.contains(DETAIL_LINE_CLASS)
    ) {
      return node;
    }
    node = node.parentNode;
  }

  return null;
}

export function getLineElementAtPoint(editor: HTMLElement, clientY: number) {
  const lines = getLineElements(editor);

  for (const line of lines) {
    const rect = line.getBoundingClientRect();
    if (clientY >= rect.top && clientY <= rect.bottom) {
      return line;
    }
  }

  return null;
}

function mapFilteredDropIndex(
  filteredIndex: number,
  sourceIndex: number | null,
) {
  if (sourceIndex === null) return filteredIndex;

  return filteredIndex >= sourceIndex ? filteredIndex + 1 : filteredIndex;
}

export function getDropIndex(
  clientY: number,
  lines: HTMLElement[],
  draggingIndex: number | null = null,
) {
  if (draggingIndex !== null) {
    for (let index = 0; index < lines.length; index += 1) {
      if (index === draggingIndex) continue;

      const rect = lines[index].getBoundingClientRect();
      if (clientY >= rect.top && clientY <= rect.bottom) {
        return index > draggingIndex ? index + 1 : index;
      }
    }

    const filteredLines = lines.filter((_, index) => index !== draggingIndex);

    for (let index = 0; index < filteredLines.length; index += 1) {
      const rect = filteredLines[index].getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;
      if (clientY < midpoint) {
        return mapFilteredDropIndex(index, draggingIndex);
      }
    }

    return mapFilteredDropIndex(filteredLines.length, draggingIndex);
  }

  for (let index = 0; index < lines.length; index += 1) {
    const rect = lines[index].getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    if (clientY < midpoint) {
      return index;
    }
  }

  return lines.length;
}

export function reorderLine(
  editor: HTMLElement,
  sourceIndex: number,
  dropIndex: number,
) {
  const lines = getLineElements(editor);
  if (sourceIndex < 0 || sourceIndex >= lines.length) return false;

  let targetIndex = dropIndex;
  if (sourceIndex < dropIndex) {
    targetIndex -= 1;
  }

  if (targetIndex === sourceIndex) return false;

  const moved = lines[sourceIndex];
  moved.remove();

  const remaining = getLineElements(editor);

  if (targetIndex >= remaining.length) {
    editor.appendChild(moved);
  } else {
    remaining[targetIndex].before(moved);
  }

  return true;
}

export function getLineIndex(editor: HTMLElement, line: HTMLElement) {
  return getLineElements(editor).indexOf(line);
}

function getNumberForLine(lines: HTMLElement[], lineIndex: number) {
  if (
    lineIndex > 0 &&
    lines[lineIndex - 1].dataset.lineType === "numbered"
  ) {
    const previous = Number(lines[lineIndex - 1].dataset.listNumber ?? "1");
    return Number.isFinite(previous) ? previous + 1 : 1;
  }

  return 1;
}

function clearLineBlockType(line: HTMLElement) {
  delete line.dataset.lineType;
  delete line.dataset.listNumber;
  delete line.dataset.checked;
}

function applyBlockTypeToLine(
  line: HTMLElement,
  type: LineBlockType,
  lines: HTMLElement[],
  numberedStart?: number,
) {
  if (type === "text") {
    clearLineBlockType(line);
    return;
  }

  line.dataset.lineType = type;

  if (type === "numbered") {
    const lineIndex = lines.indexOf(line);
    line.dataset.listNumber = String(
      numberedStart ?? getNumberForLine(lines, lineIndex),
    );
    delete line.dataset.checked;
    return;
  }

  delete line.dataset.listNumber;

  if (type === "checklist") {
    line.dataset.checked = line.dataset.checked ?? "false";
    return;
  }

  delete line.dataset.checked;
}

export function getLinesInSelection(editor: HTMLElement) {
  ensureBlockLines(editor);

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return [];

  const activeLine = getActiveLineElement(editor);
  if (!activeLine) return [];

  if (selection.isCollapsed) {
    return [activeLine];
  }

  const range = selection.getRangeAt(0);
  return getLineElements(editor).filter((line) => range.intersectsNode(line));
}

export function applyBlockTypeToSelection(
  editor: HTMLElement,
  type: LineBlockType,
) {
  ensureBlockLines(editor);

  const selectedLines = getLinesInSelection(editor);
  if (selectedLines.length === 0) return;

  const allAlreadyType = selectedLines.every(
    (line) => line.dataset.lineType === type,
  );

  if (allAlreadyType) {
    selectedLines.forEach((line) => {
      clearLineBlockType(line);
    });
    return;
  }

  const allLines = getLineElements(editor);
  let nextNumber =
    type === "numbered"
      ? getNumberForLine(allLines, allLines.indexOf(selectedLines[0]))
      : 1;

  selectedLines.forEach((line) => {
    if (type === "numbered") {
      applyBlockTypeToLine(line, type, allLines, nextNumber);
      nextNumber += 1;
      return;
    }

    applyBlockTypeToLine(line, type, allLines);
  });
}

export function insertLineBelowLine(editor: HTMLElement, line: HTMLElement) {
  insertTypedLineBelowLine(editor, line, "text");
}

function getNextListNumber(editor: HTMLElement, afterLine: HTMLElement) {
  const lines = getLineElements(editor);
  const afterIndex = lines.indexOf(afterLine);

  if (afterIndex >= 0 && lines[afterIndex].dataset.lineType === "numbered") {
    const current = Number(lines[afterIndex].dataset.listNumber ?? "1");
    return Number.isFinite(current) ? current + 1 : 1;
  }

  return 1;
}

export function insertTypedLineBelowLine(
  editor: HTMLElement,
  line: HTMLElement,
  type: LineBlockType,
) {
  ensureBlockLines(editor);

  const newLine = createLineElement("<br>", type);

  if (type === "numbered") {
    newLine.dataset.listNumber = String(getNextListNumber(editor, line));
  }

  if (type === "checklist") {
    newLine.dataset.checked = "false";
  }

  line.after(newLine);

  const selection = window.getSelection();
  const range = document.createRange();
  range.setStart(newLine, 0);
  range.collapse(true);
  selection?.removeAllRanges();
  selection?.addRange(range);
  editor.focus();
}

export function insertLineBelow(editor: HTMLElement) {
  ensureBlockLines(editor);

  const activeLine = getActiveLineElement(editor);
  if (activeLine) {
    insertLineBelowLine(editor, activeLine);
    return;
  }

  const newLine = createLineElement("<br>");
  editor.appendChild(newLine);

  const selection = window.getSelection();
  const range = document.createRange();
  range.setStart(newLine, 0);
  range.collapse(true);
  selection?.removeAllRanges();
  selection?.addRange(range);
}

export function splitLineAtCursor(editor: HTMLElement) {
  ensureBlockLines(editor);

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const activeLine = getActiveLineElement(editor);
  if (!activeLine) return;

  const range = selection.getRangeAt(0);
  if (!activeLine.contains(range.startContainer)) return;

  const afterRange = range.cloneRange();
  afterRange.selectNodeContents(activeLine);
  afterRange.setStart(range.endContainer, range.endOffset);

  const afterContent = afterRange.cloneContents();
  const afterWrapper = document.createElement("div");
  afterWrapper.appendChild(afterContent);
  const afterHtml = afterWrapper.innerHTML.trim() || "<br>";

  afterRange.deleteContents();

  if (!activeLine.innerHTML.trim()) {
    activeLine.innerHTML = "<br>";
  }

  const newLine = createLineElement(afterHtml);
  activeLine.after(newLine);

  const caretRange = document.createRange();
  caretRange.setStart(newLine, 0);
  caretRange.collapse(true);
  selection.removeAllRanges();
  selection.addRange(caretRange);
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function isLineEmpty(line: HTMLElement) {
  return !(line.textContent ?? "").replace(/\u00a0/g, " ").trim();
}

function isDetailsHtmlEmpty(html: string) {
  const trimmed = html.trim();
  if (
    !trimmed ||
    trimmed === "<br>" ||
    trimmed === "<div><br></div>" ||
    trimmed === "<p><br></p>"
  ) {
    return true;
  }

  const container = document.createElement("div");
  container.innerHTML = html;
  ensureBlockLines(container);

  return getLineElements(container).every((line) => isLineEmpty(line));
}

export function syncLineEmptyState(editor: HTMLElement) {
  getLineElements(editor).forEach((line, index) => {
    const isEmpty = isLineEmpty(line);

    if (isEmpty) {
      line.dataset.empty = "true";
    } else {
      delete line.dataset.empty;
    }

    if (isEmpty && index === 1) {
      line.dataset.bodyPlaceholder = "true";
    } else {
      delete line.dataset.bodyPlaceholder;
    }
  });
}

export function ensureTitleLine(editor: HTMLElement) {
  ensureBlockLines(editor);

  const lines = getLineElements(editor);
  if (lines.length === 0) {
    editor.appendChild(createLineElement("<br>", "h1"));
    editor.appendChild(createLineElement("<br>", "text"));
    return;
  }

  const firstLine = lines[0];
  if (firstLine.dataset.lineType !== "h1") {
    firstLine.dataset.lineType = "h1";
  }

  if (lines.length === 1) {
    editor.appendChild(createLineElement("<br>", "text"));
  }
}

export function buildEditorHtmlFromTask(title: string, detailsHtml: string) {
  const editor = document.createElement("div");
  const titleText = title.trim();
  editor.appendChild(
    createLineElement(titleText ? escapeHtml(titleText) : "<br>", "h1"),
  );

  if (!isDetailsHtmlEmpty(detailsHtml)) {
    const detailsRoot = document.createElement("div");
    detailsRoot.innerHTML = detailsHtml;
    ensureBlockLines(detailsRoot);
    getLineElements(detailsRoot).forEach((line) => {
      editor.appendChild(line.cloneNode(true));
    });
  } else {
    editor.appendChild(createLineElement("<br>", "text"));
  }

  return editor.innerHTML;
}

export function splitEditorContent(html: string) {
  const editor = document.createElement("div");
  editor.innerHTML = html;
  ensureBlockLines(editor);
  ensureTitleLine(editor);

  const lines = getLineElements(editor);
  const title = (lines[0]?.textContent ?? "").replace(/\u00a0/g, " ").trim();
  const detailsRoot = document.createElement("div");

  lines.slice(1).forEach((line) => {
    detailsRoot.appendChild(line.cloneNode(true));
  });

  const detailsHtml = detailsRoot.innerHTML.trim();
  const details = isDetailsHtmlEmpty(detailsHtml) ? "" : detailsRoot.innerHTML;

  return { title, details };
}
