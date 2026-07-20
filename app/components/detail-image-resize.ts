export type ImageResizeHandle =
  | "n"
  | "s"
  | "e"
  | "w"
  | "ne"
  | "nw"
  | "se"
  | "sw";

const RESIZE_HANDLES: ImageResizeHandle[] = [
  "nw",
  "n",
  "ne",
  "e",
  "se",
  "s",
  "sw",
  "w",
];

const MIN_IMAGE_WIDTH = 80;
const MIN_IMAGE_HEIGHT = 60;
export const DEFAULT_MAX_IMAGE_DISPLAY_WIDTH = 500;

const CURSOR_BY_HANDLE: Record<ImageResizeHandle, string> = {
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  nw: "nwse-resize",
  se: "nwse-resize",
};

function parseMarginLeft(element: HTMLElement) {
  const parsed = parseFloat(element.style.marginLeft);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseMarginTop(element: HTMLElement) {
  const parsed = parseFloat(element.style.marginTop);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isCornerHandle(handle: ImageResizeHandle) {
  return (
    handle === "ne" ||
    handle === "nw" ||
    handle === "se" ||
    handle === "sw"
  );
}

function isUpwardHeightHandle(handle: ImageResizeHandle) {
  return handle === "n" || handle === "ne" || handle === "nw";
}

function getMinAllowedWrapperTop(line: HTMLElement, wrapper: HTMLElement) {
  const lineRect = line.getBoundingClientRect();
  let minTop = lineRect.top;
  let hasInlineContentAbove = false;

  for (const node of Array.from(line.childNodes)) {
    if (node === wrapper) break;

    const text =
      node.nodeType === Node.TEXT_NODE
        ? (node.textContent ?? "").replace(/\u200B/g, "").trim()
        : "";
    if (node.nodeType === Node.TEXT_NODE && !text) continue;

    hasInlineContentAbove = true;

    const range = document.createRange();
    if (node.nodeType === Node.TEXT_NODE) {
      range.selectNodeContents(node);
    } else if (node instanceof HTMLElement) {
      range.selectNode(node);
    } else {
      continue;
    }

    for (const rect of Array.from(range.getClientRects())) {
      minTop = Math.max(minTop, rect.bottom);
    }
  }

  if (!hasInlineContentAbove) {
    const previousLine = line.previousElementSibling;
    if (previousLine instanceof HTMLElement) {
      minTop = Math.max(minTop, previousLine.getBoundingClientRect().bottom);
    }
  }

  return minTop;
}

type ResizeStartState = {
  startWidth: number;
  startHeight: number;
  startMarginLeft: number;
  startMarginTop: number;
  startWrapperTop: number;
  minAllowedTop: number;
  lineWidth: number;
};

function clampResizeLayout(
  handle: ImageResizeHandle,
  aspectRatio: number,
  deltaX: number,
  deltaY: number,
  state: ResizeStartState,
) {
  let { width, height } = computeResizeSize(
    handle,
    state.startWidth,
    state.startHeight,
    aspectRatio,
    deltaX,
    deltaY,
  );

  if (isUpwardHeightHandle(handle)) {
    const maxUpward = Math.max(0, state.startWrapperTop - state.minAllowedTop);
    const maxHeightFromTop = state.startHeight + 2 * maxUpward;

    if (height > maxHeightFromTop) {
      height = maxHeightFromTop;
      if (isCornerHandle(handle)) {
        width = height * aspectRatio;
      }
    }
  }

  const maxWidthFromLeft = state.startWidth + 2 * state.startMarginLeft;
  const maxWidthFromRight =
    2 * (state.lineWidth - state.startMarginLeft) - state.startWidth;
  let maxWidth = Math.min(
    state.lineWidth,
    maxWidthFromLeft,
    maxWidthFromRight,
  );
  maxWidth = Math.max(MIN_IMAGE_WIDTH, maxWidth);

  if (width > maxWidth) {
    width = maxWidth;
    if (isCornerHandle(handle)) {
      height = width / aspectRatio;
      if (isUpwardHeightHandle(handle)) {
        const maxUpward = Math.max(0, state.startWrapperTop - state.minAllowedTop);
        const maxHeightFromTop = state.startHeight + 2 * maxUpward;
        if (height > maxHeightFromTop) {
          height = maxHeightFromTop;
          width = height * aspectRatio;
        }
      }
    }
  }

  width = clampDimension(width, MIN_IMAGE_WIDTH);
  height = clampDimension(height, MIN_IMAGE_HEIGHT);

  let marginLeft = state.startMarginLeft - (width - state.startWidth) / 2;
  let marginTop = state.startMarginTop;

  if (isUpwardHeightHandle(handle)) {
    marginTop = state.startMarginTop + (state.startHeight - height);

    const estimatedTop = state.startWrapperTop - (height - state.startHeight) / 2;
    if (estimatedTop < state.minAllowedTop) {
      marginTop += state.minAllowedTop - estimatedTop;
    }
  }

  marginLeft = Math.max(
    0,
    Math.min(state.lineWidth - width, Math.round(marginLeft)),
  );

  return { width, height, marginLeft, marginTop };
}

function applyWrapperPosition(
  line: HTMLElement,
  wrapper: HTMLElement,
  marginLeft: number,
  marginTop: number,
  imageWidth: number,
) {
  const maxHorizontalOffset = Math.max(0, line.clientWidth - imageWidth);
  const clampedLeft = Math.max(
    0,
    Math.min(maxHorizontalOffset, Math.round(marginLeft)),
  );

  wrapper.style.marginLeft = clampedLeft === 0 ? "" : `${clampedLeft}px`;
  wrapper.style.marginTop =
    Math.abs(marginTop) < 0.5 ? "" : `${Math.round(marginTop)}px`;
}

function enforceLayoutBounds(
  line: HTMLElement,
  wrapper: HTMLElement,
  image: HTMLImageElement,
  minAllowedTop: number,
  handle: ImageResizeHandle,
) {
  const lineRect = line.getBoundingClientRect();
  let wrapperRect = wrapper.getBoundingClientRect();

  if (
    isUpwardHeightHandle(handle) &&
    wrapperRect.top < minAllowedTop - 0.5
  ) {
    const marginTop = parseMarginTop(wrapper) + (minAllowedTop - wrapperRect.top);
    wrapper.style.marginTop =
      Math.abs(marginTop) < 0.5 ? "" : `${Math.round(marginTop)}px`;
    wrapperRect = wrapper.getBoundingClientRect();
  }

  if (wrapperRect.left < lineRect.left - 0.5) {
    const marginLeft = parseMarginLeft(wrapper) + (lineRect.left - wrapperRect.left);
    wrapper.style.marginLeft =
      marginLeft <= 0 ? "" : `${Math.round(marginLeft)}px`;
    wrapperRect = wrapper.getBoundingClientRect();
  }

  if (wrapperRect.right > lineRect.right + 0.5) {
    const overflow = wrapperRect.right - lineRect.right;
    let marginLeft = parseMarginLeft(wrapper) - overflow;
    const imageWidth = getImageDimensions(image).width;

    if (marginLeft < 0) {
      const nextWidth = Math.max(
        MIN_IMAGE_WIDTH,
        Math.round(imageWidth - (overflow + Math.abs(marginLeft))),
      );
      applyImageSize(image, nextWidth, getImageDimensions(image).height);
      marginLeft = 0;
    }

    wrapper.style.marginLeft =
      marginLeft <= 0 ? "" : `${Math.round(marginLeft)}px`;
  }
}

function computeResizeSize(
  handle: ImageResizeHandle,
  startWidth: number,
  startHeight: number,
  aspectRatio: number,
  deltaX: number,
  deltaY: number,
) {
  let nextWidth = startWidth;
  let nextHeight = startHeight;

  switch (handle) {
    case "e":
      nextWidth = startWidth + 2 * deltaX;
      break;
    case "w":
      nextWidth = startWidth - 2 * deltaX;
      break;
    case "s":
      nextHeight = startHeight + deltaY;
      break;
    case "n":
      nextHeight = startHeight - deltaY;
      break;
    case "se":
      nextHeight = startHeight + deltaY;
      nextWidth = nextHeight * aspectRatio;
      break;
    case "sw":
      nextHeight = startHeight + deltaY;
      nextWidth = nextHeight * aspectRatio;
      break;
    case "ne":
      nextHeight = startHeight - deltaY;
      nextWidth = nextHeight * aspectRatio;
      break;
    case "nw":
      nextHeight = startHeight - deltaY;
      nextWidth = nextHeight * aspectRatio;
      break;
    default:
      break;
  }

  return {
    width: clampDimension(nextWidth, MIN_IMAGE_WIDTH),
    height: clampDimension(nextHeight, MIN_IMAGE_HEIGHT),
  };
}

function clampDimension(value: number, min: number) {
  return Math.max(min, Math.round(value));
}

function getImageDimensions(image: HTMLImageElement) {
  const rect = image.getBoundingClientRect();
  const width = image.offsetWidth || rect.width;
  const height = image.offsetHeight || rect.height;

  return {
    width: Math.max(width, MIN_IMAGE_WIDTH),
    height: Math.max(height, MIN_IMAGE_HEIGHT),
  };
}

function applyImageSize(image: HTMLImageElement, width: number, height: number) {
  image.style.width = `${clampDimension(width, MIN_IMAGE_WIDTH)}px`;
  image.style.height = `${clampDimension(height, MIN_IMAGE_HEIGHT)}px`;
  image.style.maxWidth = "100%";
}

export function applyInitialImageDisplaySize(image: HTMLImageElement) {
  const naturalWidth = image.naturalWidth;
  const naturalHeight = image.naturalHeight;

  if (!naturalWidth || !naturalHeight) return false;
  if (naturalWidth <= DEFAULT_MAX_IMAGE_DISPLAY_WIDTH) return false;

  const scale = DEFAULT_MAX_IMAGE_DISPLAY_WIDTH / naturalWidth;
  applyImageSize(
    image,
    DEFAULT_MAX_IMAGE_DISPLAY_WIDTH,
    naturalHeight * scale,
  );

  return true;
}

export function waitForInitialImageDisplaySize(
  image: HTMLImageElement,
): Promise<void> {
  return new Promise((resolve) => {
    const apply = () => {
      applyInitialImageDisplaySize(image);
      resolve();
    };

    if (image.complete) {
      apply();
      return;
    }

    image.addEventListener("load", apply, { once: true });
    image.addEventListener("error", () => resolve(), { once: true });
  });
}

export function ensureImageResizeHandles(wrapper: HTMLElement) {
  if (wrapper.querySelector(".detail-image-resize-handles")) return;

  const handles = document.createElement("div");
  handles.className = "detail-image-resize-handles";
  handles.contentEditable = "false";

  for (const direction of RESIZE_HANDLES) {
    const handle = document.createElement("span");
    handle.className = `detail-image-resize-handle detail-image-resize-handle-${direction}`;
    handle.dataset.resize = direction;
    handle.contentEditable = "false";
    handle.setAttribute("aria-hidden", "true");
    handles.appendChild(handle);
  }

  wrapper.appendChild(handles);
}

export function startImageResize(
  event: PointerEvent,
  handle: ImageResizeHandle,
  wrapper: HTMLElement,
  onComplete: () => void,
) {
  const rawImage = wrapper.querySelector("img.detail-image");
  if (!(rawImage instanceof HTMLImageElement)) return;

  const image: HTMLImageElement = rawImage;

  event.preventDefault();
  event.stopPropagation();

  const handleTarget = event.target;
  if (!(handleTarget instanceof HTMLElement)) return;

  const handleElement: HTMLElement = handleTarget;
  const lineElement = wrapper.closest(".detail-line");
  if (!(lineElement instanceof HTMLElement)) return;
  const line: HTMLElement = lineElement;

  const startX = event.clientX;
  const startY = event.clientY;
  const { width: startWidth, height: startHeight } = getImageDimensions(image);
  const aspectRatio = startWidth / startHeight;
  const startMarginLeft = parseMarginLeft(wrapper);
  const startMarginTop = parseMarginTop(wrapper);
  const startWrapperTop = wrapper.getBoundingClientRect().top;
  const minAllowedTop = getMinAllowedWrapperTop(line, wrapper);
  const resizeState: ResizeStartState = {
    startWidth,
    startHeight,
    startMarginLeft,
    startMarginTop,
    startWrapperTop,
    minAllowedTop,
    lineWidth: line.clientWidth,
  };

  applyImageSize(image, startWidth, startHeight);
  wrapper.dataset.resizing = "true";

  handleElement.setPointerCapture(event.pointerId);
  document.body.style.cursor = CURSOR_BY_HANDLE[handle];
  document.body.style.userSelect = "none";

  function onPointerMove(moveEvent: PointerEvent) {
    const deltaX = moveEvent.clientX - startX;
    const deltaY = moveEvent.clientY - startY;
    const layout = clampResizeLayout(
      handle,
      aspectRatio,
      deltaX,
      deltaY,
      resizeState,
    );

    applyImageSize(image, layout.width, layout.height);
    applyWrapperPosition(
      line,
      wrapper,
      layout.marginLeft,
      layout.marginTop,
      layout.width,
    );
    enforceLayoutBounds(line, wrapper, image, minAllowedTop, handle);
  }

  function onPointerUp() {
    if (handleElement.hasPointerCapture(event.pointerId)) {
      handleElement.releasePointerCapture(event.pointerId);
    }
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);
    document.removeEventListener("pointercancel", onPointerUp);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    delete wrapper.dataset.resizing;
    onComplete();
  }

  document.addEventListener("pointermove", onPointerMove);
  document.addEventListener("pointerup", onPointerUp);
  document.addEventListener("pointercancel", onPointerUp);
}

export function isImageResizeHandle(element: EventTarget | null) {
  return element instanceof HTMLElement && Boolean(element.dataset.resize);
}

export function getImageResizeHandle(
  element: EventTarget | null,
): ImageResizeHandle | null {
  if (!(element instanceof HTMLElement)) return null;

  const handle = element.closest<HTMLElement>("[data-resize]");
  const direction = handle?.dataset.resize;

  if (
    direction === "n" ||
    direction === "s" ||
    direction === "e" ||
    direction === "w" ||
    direction === "ne" ||
    direction === "nw" ||
    direction === "se" ||
    direction === "sw"
  ) {
    return direction;
  }

  return null;
}
