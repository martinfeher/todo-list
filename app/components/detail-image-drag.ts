import { placeCaretBelowWrapper } from "./detail-lines";

const DRAG_THRESHOLD_PX = 5;

function parseMarginLeft(element: HTMLElement) {
  const parsed = parseFloat(element.style.marginLeft);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getMaxHorizontalOffset(line: HTMLElement, wrapper: HTMLElement) {
  const lineWidth = line.clientWidth;
  const wrapperWidth = wrapper.getBoundingClientRect().width;
  return Math.max(0, lineWidth - wrapperWidth);
}

function applyHorizontalOffset(
  line: HTMLElement,
  wrapper: HTMLElement,
  offset: number,
) {
  const clamped = Math.max(
    0,
    Math.min(getMaxHorizontalOffset(line, wrapper), Math.round(offset)),
  );

  if (clamped === 0) {
    wrapper.style.marginLeft = "";
  } else {
    wrapper.style.marginLeft = `${clamped}px`;
  }
}

export function startImagePointerInteraction(
  event: PointerEvent,
  wrapper: HTMLElement,
  line: HTMLElement,
  editor: HTMLElement,
  onComplete: () => void,
) {
  const startX = event.clientX;
  const startY = event.clientY;
  const startMarginLeft = parseMarginLeft(wrapper);
  let dragging = false;

  function beginDragging() {
    dragging = true;
    wrapper.dataset.dragging = "true";
    wrapper.setPointerCapture(event.pointerId);
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
  }

  function onPointerMove(moveEvent: PointerEvent) {
    if (
      !dragging &&
      Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) <
        DRAG_THRESHOLD_PX
    ) {
      return;
    }

    if (!dragging) {
      beginDragging();
    }

    applyHorizontalOffset(
      line,
      wrapper,
      startMarginLeft + moveEvent.clientX - startX,
    );
  }

  function onPointerUp() {
    if (dragging) {
      if (wrapper.hasPointerCapture(event.pointerId)) {
        wrapper.releasePointerCapture(event.pointerId);
      }
      delete wrapper.dataset.dragging;
      onComplete();
    } else {
      placeCaretBelowWrapper(wrapper);
      editor.focus();
    }

    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);
    document.removeEventListener("pointercancel", onPointerUp);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }

  document.addEventListener("pointermove", onPointerMove);
  document.addEventListener("pointerup", onPointerUp);
  document.addEventListener("pointercancel", onPointerUp);
}

export function getImageDragTarget(element: EventTarget | null) {
  if (!(element instanceof HTMLElement)) return null;
  if (element.closest(".detail-image-delete")) return null;
  if (element.closest("[data-resize]")) return null;

  const wrapper = element.closest(".detail-image-wrapper");
  if (!(wrapper instanceof HTMLElement)) return null;

  const line = wrapper.closest(".detail-line");
  if (!(line instanceof HTMLElement)) return null;

  return { wrapper, line };
}
