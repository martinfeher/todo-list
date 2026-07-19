type IconProps = {
  className?: string;
};

export function PlusIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
      className={className}
    >
      <path d="M8 3.5v9M3.5 8h9" strokeLinecap="round" />
    </svg>
  );
}

export function InteractIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 10 16" fill="currentColor" aria-hidden="true" className={className}>
      <circle cx="2.5" cy="2.5" r="1.1" />
      <circle cx="7.5" cy="2.5" r="1.1" />
      <circle cx="2.5" cy="8" r="1.1" />
      <circle cx="7.5" cy="8" r="1.1" />
      <circle cx="2.5" cy="13.5" r="1.1" />
      <circle cx="7.5" cy="13.5" r="1.1" />
    </svg>
  );
}

export function ChecklistIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      aria-hidden="true"
      className={className}
    >
      <path d="M2.5 4.5 4 6l3-3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 5.5h7.5" strokeLinecap="round" />
      <path d="M2.5 8.5 4 10l3-3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 9.5h7.5" strokeLinecap="round" />
    </svg>
  );
}

export function BulletListIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className={className}>
      <circle cx="2.5" cy="4" r="1.1" />
      <rect x="5.5" y="3.25" width="8.5" height="1.5" rx="0.75" />
      <circle cx="2.5" cy="8" r="1.1" />
      <rect x="5.5" y="7.25" width="8.5" height="1.5" rx="0.75" />
      <circle cx="2.5" cy="12" r="1.1" />
      <rect x="5.5" y="11.25" width="8.5" height="1.5" rx="0.75" />
    </svg>
  );
}

export function NumberedListIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className={className}>
      <text x="1.5" y="5.5" fontSize="4.5" fontFamily="Arial, sans-serif">
        1
      </text>
      <rect x="5.5" y="3.25" width="8.5" height="1.5" rx="0.75" />
      <text x="1.5" y="9.5" fontSize="4.5" fontFamily="Arial, sans-serif">
        2
      </text>
      <rect x="5.5" y="7.25" width="8.5" height="1.5" rx="0.75" />
    </svg>
  );
}

function getActiveLineRect(
  editor: HTMLElement,
  selection: Selection,
): DOMRect | null {
  if (!selection.focusNode || !editor.contains(selection.focusNode)) {
    return null;
  }

  const range = document.createRange();
  range.setStart(selection.focusNode, selection.focusOffset);
  range.collapse(true);

  const rects = range.getClientRects();
  if (rects.length > 0) {
    return rects[rects.length - 1];
  }

  const rect = range.getBoundingClientRect();
  if (rect.height > 0 || rect.width > 0) {
    return rect;
  }

  const marker = document.createElement("span");
  marker.textContent = "\u200b";
  range.insertNode(marker);
  const markerRect = marker.getBoundingClientRect();
  marker.remove();

  return markerRect.height > 0 ? markerRect : null;
}

export function getLineControlsPositionForLine(
  line: HTMLElement,
  wrapper: HTMLElement,
) {
  const wrapperRect = wrapper.getBoundingClientRect();
  const lineRect = line.getBoundingClientRect();
  if (lineRect.height === 0) return null;

  const range = document.createRange();
  range.selectNodeContents(line);
  const textRects = Array.from(range.getClientRects()).filter(
    (rect) => rect.height > 0,
  );

  const centerY =
    textRects.length > 0
      ? textRects[0].top + textRects[0].height / 2
      : lineRect.top + lineRect.height / 2;

  return {
    top: centerY - wrapperRect.top,
  };
}

export function getLineControlsPosition(
  editor: HTMLElement,
  wrapper: HTMLElement,
  selection: Selection | null,
) {
  if (!selection || selection.rangeCount === 0) return null;
  if (!editor.contains(selection.anchorNode)) return null;

  const lineRect = getActiveLineRect(editor, selection);
  if (!lineRect) return null;

  const wrapperRect = wrapper.getBoundingClientRect();

  return {
    top: lineRect.top - wrapperRect.top + lineRect.height / 2,
  };
}

export function insertLineBelow(editor: HTMLElement) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  editor.focus();
  const range = selection.getRangeAt(0);
  range.collapse(false);

  const lineBreak = document.createElement("br");
  range.insertNode(lineBreak);
  range.setStartAfter(lineBreak);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}
