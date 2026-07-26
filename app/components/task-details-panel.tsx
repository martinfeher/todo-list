"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { BiLink, BiRedo, BiUndo } from "react-icons/bi";
import {
  LuChevronDown,
  LuCode,
  LuHeading1,
  LuHeading2,
  LuHeading3,
  LuList,
  LuPilcrow,
} from "react-icons/lu";
import { renameTask, updateTaskDueDate, updateTaskDueTime } from "@/app/actions/todo";
import { fetchTaskById, saveTaskDetails, saveTaskDetailsKeepalive } from "@/lib/task-details-api";
import { taskDetailsHasContent } from "@/lib/task-details-content";
import {
  formatDueTimeLabel,
  formatDurationLabel,
  type TaskDueTime,
} from "@/lib/task-due-time";
import {
  applyBlockTypeToSelection,
  buildEditorHtmlFromTask,
  ensureBlockLines,
  ensureTitleLine,
  getActiveLineElement,
  getDropIndex,
  getLineElementAtPoint,
  getLineById,
  getLineElements,
  getLineIndex,
  handleClickBelowLastLine,
  insertImagesIntoEditor,
  insertTypedLineBelowLine,
  isCodeLine,
  isDetailLineEmpty,
  isTitleLine,
  type LineBlockType,
  placeCaretInLine,
  focusNoteAtEnd,
  removeImageWrapper,
  reorderLine,
  getEditorTitle,
  splitEditorContent,
  splitBlockLinesOnBreaks,
  splitLineAtCursor,
  syncLineEmptyState,
} from "./detail-lines";
import {
  getImageFilesFromDataTransfer,
  hasImageFilesInDataTransfer,
  uploadImageFiles,
} from "./detail-images";
import {
  getImageDragTarget,
  startImagePointerInteraction,
} from "./detail-image-drag";
import {
  getImageResizeHandle,
  startImageResize,
} from "./detail-image-resize";
import {
  applyLinkToSelection,
  getLinkEditorState,
  getLinkFromSelection,
  normalizeLinks,
} from "./detail-links";
import {
  clearPasteBatchMarkers,
  getPasteBatchPromptPosition,
  insertPasteFragmentAtSelection,
  PASTE_FORMAT_PROMPT_MS,
  pastedHtmlHasFormatting,
  preparePasteFragment,
  stripFormattingInPasteBatch,
} from "./detail-fonts";
import { TaskDatePicker } from "./task-date-picker";
import {
  BulletListIcon,
  ChecklistIcon,
  getLineControlsPositionForLine,
  InteractIcon,
  NumberedListIcon,
  PlusIcon,
} from "./line-control-icons";

type TaskDetails = {
  id: string;
  name: string;
  completed: boolean;
  details: string;
  dueDate: string | null;
  dueTimeMinutes: number | null;
  dueDurationMinutes: number | null;
  dueTimeZone: string;
};

type TaskDetailsSnapshot = {
  name: string;
  dueDate: string | null;
  dueTimeMinutes: number | null;
  dueDurationMinutes: number | null;
  dueTimeZone: string;
};

type TaskDetailsPanelProps = {
  taskId: string | null;
  taskSnapshot?: TaskDetailsSnapshot | null;
  focusNoteAtEndRequest?: number;
  isHoverPreview?: boolean;
  onDetailsSaved: (taskId: string, details: string) => void;
  onTaskHasDetailsKnown?: (taskId: string, hasDetails: boolean) => void;
  onTaskRenamed: (taskId: string, name: string) => void;
  onDueDateUpdated: (
    taskId: string,
    dueDate: string | null,
    dueTime?: {
      dueTimeMinutes: number | null;
      dueDurationMinutes: number | null;
      dueTimeZone: string;
    },
  ) => void;
};

type SaveStatus = "idle" | "loading" | "pending" | "saved" | "error";

type FormatMenuState = {
  x: number;
  y: number;
};

type LineControlItem = {
  lineId: string;
  top: number;
};

type DropIndicatorState = {
  top: number;
};

type AddBlockMenuState = {
  top: number;
  left: number;
};

const FORMAT_LIST_OPTIONS: {
  type: "bullet" | "numbered" | "checklist";
  label: string;
  Icon: typeof BulletListIcon;
}[] = [
  { type: "bullet", label: "Bullet list", Icon: BulletListIcon },
  { type: "numbered", label: "Numbered list", Icon: NumberedListIcon },
  { type: "checklist", label: "Check list", Icon: ChecklistIcon },
];

type TextBlockType = "text" | "h1" | "h2" | "h3";

type TextTypeMenuState = {
  top: number;
  left: number;
};

const TEXT_BLOCK_OPTIONS: {
  type: TextBlockType;
  label: string;
  Icon: typeof LuPilcrow;
}[] = [
  { type: "text", label: "Text", Icon: LuPilcrow },
  { type: "h1", label: "Heading 1", Icon: LuHeading1 },
  { type: "h2", label: "Heading 2", Icon: LuHeading2 },
  { type: "h3", label: "Heading 3", Icon: LuHeading3 },
];

const ADD_BLOCK_OPTIONS: {
  type: LineBlockType;
  label: string;
  Icon: typeof LuPilcrow;
}[] = [
  ...TEXT_BLOCK_OPTIONS,
  { type: "bullet", label: "Bullet list", Icon: BulletListIcon },
  { type: "numbered", label: "Numbered list", Icon: NumberedListIcon },
  { type: "code", label: "Code", Icon: LuCode },
];

const AUTO_SAVE_DEBOUNCE_MS = 3000;
const LARGE_CONTENT_AUTO_SAVE_DEBOUNCE_MS = 5000;
const MIN_SAVE_INTERVAL_MS = 3000;
const CLIPBOARD_SAVE_NOTICE_MS = 4000;
const HISTORY_DEBOUNCE_MS = 400;
const LARGE_CONTENT_HISTORY_DEBOUNCE_MS = 1200;
const HISTORY_LIMIT = 50;
const LARGE_CONTENT_HISTORY_LIMIT = 8;
const LARGE_CONTENT_THRESHOLD = 200_000;
const LINE_CONTROLS_DEBOUNCE_MS = 120;
const FORMAT_MENU_DEBOUNCE_MS = 80;
const SMALL_CONTENT_INPUT_DEBOUNCE_MS = 80;
const INPUT_NORMALIZE_DEBOUNCE_MS = 400;
const TITLE_SYNC_DEBOUNCE_MS = 300;
const MAX_DETAILS_SAVE_BYTES = 9 * 1024 * 1024;

const HIGHLIGHT_COLOR = "#fef08a";
const DEFAULT_TEXT_COLOR = "#444444";

const TEXT_COLOR_OPTIONS = [
  { label: "Default", value: DEFAULT_TEXT_COLOR },
  { label: "Red", value: "#db4035" },
  { label: "Orange", value: "#ff9933" },
  { label: "Yellow", value: "#b58900" },
  { label: "Green", value: "#299438" },
  { label: "Blue", value: "#246fe0" },
  { label: "Purple", value: "#884dff" },
  { label: "Pink", value: "#c855d6" },
] as const;

function formatDueDateLabel(value: string | null) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatSaveTime(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function normalizeDetails(html: string) {
  const trimmed = html.trim();
  if (
    !trimmed ||
    trimmed === "<br>" ||
    trimmed === "<div><br></div>" ||
    trimmed === "<p><br></p>"
  ) {
    return "";
  }
  return html;
}

function isHighlightColor(color: string) {
  if (!color) return false;

  const normalized = color.toLowerCase().replace(/\s/g, "");
  return (
    normalized === HIGHLIGHT_COLOR ||
    normalized === "yellow" ||
    normalized === "rgb(254,240,138)" ||
    normalized === "rgba(254,240,138,1)"
  );
}

function isHighlightYellow(color: string) {
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return false;

  const r = Number(match[1]);
  const g = Number(match[2]);
  const b = Number(match[3]);

  return r >= 240 && g >= 220 && b <= 180;
}

function nodeHasHighlight(node: Node | null, editor: HTMLElement) {
  let current: Node | null = node;

  while (current && current !== editor) {
    if (current instanceof HTMLElement) {
      if (current.tagName === "MARK") return true;

      const inlineBg = current.style.backgroundColor;
      const computedBg = window.getComputedStyle(current).backgroundColor;

      if (isHighlightColor(inlineBg) || isHighlightYellow(computedBg)) {
        return true;
      }
    }

    current = current.parentNode;
  }

  return false;
}

function selectionHasHighlight(editor: HTMLElement) {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return false;

  const { anchorNode, focusNode } = selection;
  if (!anchorNode || !focusNode) return false;

  return (
    nodeHasHighlight(anchorNode, editor) ||
    nodeHasHighlight(focusNode, editor)
  );
}

function unwrapElement(element: HTMLElement) {
  const parent = element.parentNode;
  if (!parent) return;

  while (element.firstChild) {
    parent.insertBefore(element.firstChild, element);
  }

  parent.removeChild(element);
}

function removeHighlightFromSelection(editor: HTMLElement) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  document.execCommand("styleWithCSS", false, "true");
  document.execCommand("removeFormat", false, "hiliteColor");
  document.execCommand("removeFormat", false, "backColor");

  const range = selection.getRangeAt(0);
  const elements = Array.from(editor.querySelectorAll("mark, span[style]"));

  for (const element of elements) {
    if (!(element instanceof HTMLElement)) continue;
    if (!range.intersectsNode(element)) continue;

    const inlineBg = element.style.backgroundColor;
    const computedBg = window.getComputedStyle(element).backgroundColor;

    if (
      element.tagName === "MARK" ||
      isHighlightColor(inlineBg) ||
      isHighlightYellow(computedBg)
    ) {
      unwrapElement(element);
    }
  }
}

function applyHighlight(editor: HTMLElement) {
  if (selectionHasHighlight(editor)) {
    removeHighlightFromSelection(editor);
    return;
  }

  document.execCommand("styleWithCSS", false, "true");
  const applied = document.execCommand("hiliteColor", false, HIGHLIGHT_COLOR);
  if (!applied) {
    document.execCommand("backColor", false, HIGHLIGHT_COLOR);
  }
}

export function TaskDetailsPanel({
  taskId,
  taskSnapshot = null,
  focusNoteAtEndRequest = 0,
  isHoverPreview = false,
  onDetailsSaved,
  onTaskHasDetailsKnown,
  onTaskRenamed,
  onDueDateUpdated,
}: TaskDetailsPanelProps) {
  const [task, setTask] = useState<TaskDetails | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [showClipboardNotice, setShowClipboardNotice] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [formatMenu, setFormatMenu] = useState<FormatMenuState | null>(null);
  const [lineControls, setLineControls] = useState<LineControlItem[]>([]);
  const [dropIndicator, setDropIndicator] = useState<DropIndicatorState | null>(null);
  const [isImageDropActive, setIsImageDropActive] = useState(false);
  const [addBlockMenu, setAddBlockMenu] = useState<AddBlockMenuState | null>(null);
  const [textTypeMenu, setTextTypeMenu] = useState<TextTypeMenuState | null>(null);
  const [isDateMenuOpen, setIsDateMenuOpen] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [showColorMenu, setShowColorMenu] = useState(false);
  const [showFormatTextTypeMenu, setShowFormatTextTypeMenu] = useState(false);
  const [showLinkMenu, setShowLinkMenu] = useState(false);
  const [linkText, setLinkText] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [pasteFormatPrompt, setPasteFormatPrompt] = useState<{
    pasteId: string;
    top: number;
    left: number;
    removeFormatting: boolean;
  } | null>(null);
  const savedDetailsRef = useRef("");
  const detailsRef = useRef("");
  const isLargeContentRef = useRef(false);
  const saveStatusRef = useRef<SaveStatus>("idle");
  const taskIdRef = useRef<string | null>(null);
  const taskNameRef = useRef("");
  const syncedTitleRef = useRef("");
  const hydratedTaskIdRef = useRef<string | null>(null);
  const handledFocusNoteAtEndRequestRef = useRef(0);
  const panelRef = useRef<HTMLElement>(null);
  const editorWrapperRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const formatMenuRef = useRef<HTMLDivElement>(null);
  const linkUrlInputRef = useRef<HTMLInputElement>(null);
  const savedLinkSelectionRef = useRef<Range | null>(null);
  const showLinkMenuRef = useRef(false);
  const addBlockMenuRef = useRef<HTMLDivElement>(null);
  const textTypeMenuRef = useRef<HTMLDivElement>(null);
  const dateMenuRef = useRef<HTMLDivElement>(null);
  const dateButtonRef = useRef<HTMLButtonElement>(null);
  const lineControlsRef = useRef<HTMLDivElement>(null);
  const hoveredLineRef = useRef<HTMLElement | null>(null);
  const activeLineControlsRef = useRef<HTMLElement | null>(null);
  const isMouseOverEditorRef = useRef(false);
  const dragStateRef = useRef<{
    sourceIndex: number;
    sourceLine: HTMLElement;
    dropIndex: number;
  } | null>(null);
  const previousTextRef = useRef("");
  const saveTimerRef = useRef<number | null>(null);
  const saveInFlightRef = useRef(false);
  const saveQueuedRef = useRef(false);
  const lastSaveCompletedAtRef = useRef(0);
  const historyTimerRef = useRef<number | null>(null);
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const isApplyingHistoryRef = useRef(false);
  const isReadyRef = useRef(false);
  const imageDropDepthRef = useRef(0);
  const pasteFormatPromptTimerRef = useRef<number | null>(null);
  const pasteFormatPromptRef = useRef(pasteFormatPrompt);
  const inputNormalizeFrameRef = useRef<number | null>(null);
  const inputNormalizeTimerRef = useRef<number | null>(null);
  const formatMenuTimerRef = useRef<number | null>(null);
  const lineControlsTimerRef = useRef<number | null>(null);
  const titleSyncTimerRef = useRef<number | null>(null);
  const clipboardNoticeTimerRef = useRef<number | null>(null);

  const readEditorContent = useCallback(() => {
    return normalizeDetails(editorRef.current?.innerHTML ?? "");
  }, []);

  const readCurrentSplitContent = useCallback(() => {
    const editorHtml = readEditorContent();
    detailsRef.current = editorHtml;
    return splitEditorContent(editorHtml);
  }, [readEditorContent]);

  const waitForSaveIdle = useCallback(async () => {
    while (saveInFlightRef.current) {
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 10);
      });
    }
  }, []);

  const syncEditorContent = useCallback(() => {
    const html = readEditorContent();
    detailsRef.current = html;
    return html;
  }, [readEditorContent]);

  const syncTitleToTaskList = useCallback(() => {
    const currentTaskId = taskIdRef.current;
    const editor = editorRef.current;
    if (!currentTaskId || !editor || !isReadyRef.current) return;

    const title = getEditorTitle(editor);
    if (!title || title === syncedTitleRef.current) return;

    syncedTitleRef.current = title;
    setTask((current) =>
      current ? { ...current, name: title } : current,
    );

    if (titleSyncTimerRef.current !== null) {
      window.clearTimeout(titleSyncTimerRef.current);
    }

    titleSyncTimerRef.current = window.setTimeout(() => {
      titleSyncTimerRef.current = null;
      onTaskRenamed(currentTaskId, title);
    }, TITLE_SYNC_DEBOUNCE_MS);
  }, [onTaskRenamed]);

  const syncExternalTaskName = useCallback(
    (name: string) => {
      const editor = editorRef.current;
      if (!editor || !isReadyRef.current) return;

      const title = getEditorTitle(editor);
      if (title === name) {
        syncedTitleRef.current = name;
        return;
      }

      const activeLine =
        document.activeElement === editor ? getActiveLineElement(editor) : null;
      const titleLine = getLineElements(editor)[0];
      if (activeLine && titleLine && activeLine === titleLine) return;

      ensureBlockLines(editor);
      ensureTitleLine(editor);

      const lines = getLineElements(editor);
      if (!lines[0]) return;

      if (name) {
        lines[0].textContent = name;
      } else {
        lines[0].innerHTML = "<br>";
      }

      syncLineEmptyState(editor);
      syncedTitleRef.current = name;
      setTask((current) => (current ? { ...current, name } : current));
      detailsRef.current = editor.innerHTML;
    },
    [],
  );

  const markSavePending = useCallback(() => {
    if (saveStatusRef.current === "pending") return;
    saveStatusRef.current = "pending";
    setSaveStatus("pending");
  }, []);

  const showClipboardSaveNotice = useCallback(() => {
    if (clipboardNoticeTimerRef.current !== null) {
      window.clearTimeout(clipboardNoticeTimerRef.current);
    }

    setShowClipboardNotice(true);
    clipboardNoticeTimerRef.current = window.setTimeout(() => {
      clipboardNoticeTimerRef.current = null;
      setShowClipboardNotice(false);
    }, CLIPBOARD_SAVE_NOTICE_MS);
  }, []);

  const updateHistoryAvailability = useCallback(() => {
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
  }, []);

  const resetHistory = useCallback(
    (html: string) => {
      if (historyTimerRef.current !== null) {
        window.clearTimeout(historyTimerRef.current);
        historyTimerRef.current = null;
      }

      historyRef.current = [html];
      historyIndexRef.current = 0;
      updateHistoryAvailability();
    },
    [updateHistoryAvailability],
  );

  const pushHistorySnapshot = useCallback(() => {
    if (isApplyingHistoryRef.current) return;

    const snapshot = readEditorContent();
    const current = historyRef.current[historyIndexRef.current];

    if (snapshot === current) return;

    const nextHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
    nextHistory.push(snapshot);

    const historyLimit = isLargeContentRef.current
      ? LARGE_CONTENT_HISTORY_LIMIT
      : HISTORY_LIMIT;

    if (nextHistory.length > historyLimit) {
      nextHistory.shift();
    }

    historyRef.current = nextHistory;
    historyIndexRef.current = nextHistory.length - 1;
    updateHistoryAvailability();
  }, [readEditorContent, updateHistoryAvailability]);

  const scheduleHistorySnapshot = useCallback(() => {
    if (isApplyingHistoryRef.current) return;

    if (historyTimerRef.current !== null) {
      window.clearTimeout(historyTimerRef.current);
    }

    const debounceMs = isLargeContentRef.current
      ? LARGE_CONTENT_HISTORY_DEBOUNCE_MS
      : HISTORY_DEBOUNCE_MS;

    historyTimerRef.current = window.setTimeout(() => {
      historyTimerRef.current = null;
      pushHistorySnapshot();
    }, debounceMs);
  }, [pushHistorySnapshot]);

  const flushHistorySnapshot = useCallback(() => {
    if (historyTimerRef.current !== null) {
      window.clearTimeout(historyTimerRef.current);
      historyTimerRef.current = null;
    }

    pushHistorySnapshot();
  }, [pushHistorySnapshot]);

  const recordHistorySnapshot = useCallback(() => {
    flushHistorySnapshot();
  }, [flushHistorySnapshot]);

  const saveDetails = useCallback(async () => {
    if (saveInFlightRef.current) {
      saveQueuedRef.current = true;
      return;
    }

    saveInFlightRef.current = true;

    try {
      while (true) {
        const currentTaskId = taskIdRef.current;
        if (!currentTaskId || !isReadyRef.current) break;

        const { title, details } = readCurrentSplitContent();

        const detailsChanged = details !== savedDetailsRef.current;
        const titleChanged = Boolean(title && title !== taskNameRef.current);

        if (!detailsChanged && !titleChanged) break;

        saveStatusRef.current = "pending";
        setSaveStatus("pending");

        let nextStatus: SaveStatus | null = null;

        if (detailsChanged) {
          const detailsToSave = readCurrentSplitContent().details;

          if (detailsToSave !== savedDetailsRef.current) {
            const detailsBytes = new TextEncoder().encode(detailsToSave).byteLength;
            if (detailsBytes > MAX_DETAILS_SAVE_BYTES) {
              saveStatusRef.current = "error";
              setSaveStatus("error");
              break;
            }

            await saveTaskDetails(currentTaskId, detailsToSave);

            if (taskIdRef.current !== currentTaskId) break;

            savedDetailsRef.current = detailsToSave;
            onDetailsSaved(currentTaskId, detailsToSave);
            nextStatus = "saved";
          }
        }

        const titleToSave = readCurrentSplitContent().title;

        if (titleToSave && titleToSave !== taskNameRef.current) {
          if (taskIdRef.current !== currentTaskId) break;

          const updatedTask = await renameTask(currentTaskId, titleToSave);

          if (taskIdRef.current !== currentTaskId) break;

          taskNameRef.current = updatedTask.name;
          syncedTitleRef.current = updatedTask.name;
          setTask((current) =>
            current ? { ...current, name: updatedTask.name } : current,
          );
          onTaskRenamed(currentTaskId, updatedTask.name);
          nextStatus = "saved";
        }

        if (nextStatus) {
          saveStatusRef.current = nextStatus;
          setSaveStatus(nextStatus);
          lastSaveCompletedAtRef.current = Date.now();
          setLastSavedAt(new Date());
        }

        const latest = readCurrentSplitContent();
        const stillDirty =
          latest.details !== savedDetailsRef.current ||
          (Boolean(latest.title) && latest.title !== taskNameRef.current);

        if (!stillDirty && !saveQueuedRef.current) break;
      }
    } catch {
      saveStatusRef.current = "error";
      setSaveStatus("error");
    } finally {
      saveInFlightRef.current = false;

      if (saveQueuedRef.current) {
        saveQueuedRef.current = false;
        void saveDetails();
      }
    }
  }, [onDetailsSaved, onTaskRenamed, readCurrentSplitContent]);

  const runPendingAutoSave = useCallback(() => {
    const sinceLastSave = Date.now() - lastSaveCompletedAtRef.current;
    const minGapRemaining = MIN_SAVE_INTERVAL_MS - sinceLastSave;

    if (minGapRemaining > 0) {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }

      saveTimerRef.current = window.setTimeout(() => {
        saveTimerRef.current = null;
        void saveDetails();
      }, minGapRemaining);
      return;
    }

    saveTimerRef.current = null;
    void saveDetails();
  }, [saveDetails]);

  const scheduleAutoSave = useCallback(() => {
    markSavePending();

    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }

    const debounceMs = isLargeContentRef.current
      ? LARGE_CONTENT_AUTO_SAVE_DEBOUNCE_MS
      : AUTO_SAVE_DEBOUNCE_MS;

    saveTimerRef.current = window.setTimeout(() => {
      runPendingAutoSave();
    }, debounceMs);
  }, [markSavePending, runPendingAutoSave]);

  const flushAutoSave = useCallback(() => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    runPendingAutoSave();
  }, [runPendingAutoSave]);

  const requestSave = useCallback(
    (mode: "debounced" | "flush" | "immediate" = "debounced") => {
      if (mode === "immediate") {
        if (saveTimerRef.current !== null) {
          window.clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }

        markSavePending();
        void saveDetails();
        return;
      }

      if (mode === "flush") {
        flushAutoSave();
        return;
      }

      scheduleAutoSave();
    },
    [flushAutoSave, markSavePending, saveDetails, scheduleAutoSave],
  );

  const updateLineControls = useCallback(() => {
    const editor = editorRef.current;
    const wrapper = editorWrapperRef.current;
    if (!editor || !wrapper) {
      setLineControls([]);
      return;
    }

    if (dragStateRef.current) return;

    let line: HTMLElement | null = null;

    if (addBlockMenu && activeLineControlsRef.current) {
      line = activeLineControlsRef.current;
    } else if (isMouseOverEditorRef.current && hoveredLineRef.current) {
      line = hoveredLineRef.current;
    } else if (editor.contains(document.activeElement)) {
      line = getActiveLineElement(editor);
    } else {
      setLineControls([]);
      return;
    }

    if (!line || !editor.contains(line)) {
      setLineControls([]);
      return;
    }

    if (getLineIndex(editor, line) === 0) {
      setLineControls([]);
      return;
    }

    const lineId = line.dataset.lineId;
    if (!lineId) {
      setLineControls([]);
      return;
    }

    const position = getLineControlsPositionForLine(line, wrapper);
    if (!position) {
      setLineControls([]);
      return;
    }

    activeLineControlsRef.current = line;
    setLineControls([{ lineId, top: position.top }]);
  }, [addBlockMenu]);

  const scheduleLineControlsUpdate = useCallback(() => {
    if (lineControlsTimerRef.current !== null) {
      window.clearTimeout(lineControlsTimerRef.current);
    }

    lineControlsTimerRef.current = window.setTimeout(() => {
      lineControlsTimerRef.current = null;
      updateLineControls();
    }, LINE_CONTROLS_DEBOUNCE_MS);
  }, [updateLineControls]);

  const runEditorNormalization = useCallback(
    (mode: "light" | "full") => {
      const editor = editorRef.current;
      if (!editor) return;

      ensureBlockLines(editor);
      ensureTitleLine(editor);

      if (mode === "full") {
        splitBlockLinesOnBreaks(editor);
        normalizeLinks(editor);
        syncLineEmptyState(editor);
      }

      syncEditorContent();
      syncTitleToTaskList();
      scheduleHistorySnapshot();
      scheduleAutoSave();
      scheduleLineControlsUpdate();
    },
    [
      scheduleAutoSave,
      scheduleHistorySnapshot,
      scheduleLineControlsUpdate,
      syncEditorContent,
      syncTitleToTaskList,
    ],
  );

  const normalizeEditorAfterInput = useCallback(() => {
    runEditorNormalization(isLargeContentRef.current ? "light" : "full");
  }, [runEditorNormalization]);

  const scheduleInputNormalization = useCallback(() => {
    if (inputNormalizeFrameRef.current !== null) {
      window.cancelAnimationFrame(inputNormalizeFrameRef.current);
      inputNormalizeFrameRef.current = null;
    }

    if (inputNormalizeTimerRef.current !== null) {
      window.clearTimeout(inputNormalizeTimerRef.current);
      inputNormalizeTimerRef.current = null;
    }

    const debounceMs = isLargeContentRef.current
      ? INPUT_NORMALIZE_DEBOUNCE_MS
      : SMALL_CONTENT_INPUT_DEBOUNCE_MS;

    inputNormalizeTimerRef.current = window.setTimeout(() => {
      inputNormalizeTimerRef.current = null;
      inputNormalizeFrameRef.current = window.requestAnimationFrame(() => {
        inputNormalizeFrameRef.current = null;
        normalizeEditorAfterInput();
      });
    }, debounceMs);
  }, [normalizeEditorAfterInput]);

  const closeFormatMenu = useCallback(() => {
    setFormatMenu(null);
    setShowColorMenu(false);
    setShowFormatTextTypeMenu(false);
    setShowLinkMenu(false);
    showLinkMenuRef.current = false;
    savedLinkSelectionRef.current = null;
  }, []);

  useEffect(() => {
    pasteFormatPromptRef.current = pasteFormatPrompt;
  }, [pasteFormatPrompt]);

  const dismissPasteFormatPrompt = useCallback((pasteId?: string) => {
    if (pasteFormatPromptTimerRef.current !== null) {
      window.clearTimeout(pasteFormatPromptTimerRef.current);
      pasteFormatPromptTimerRef.current = null;
    }

    const editor = editorRef.current;
    const idToClear = pasteId ?? pasteFormatPromptRef.current?.pasteId;
    if (editor && idToClear) {
      clearPasteBatchMarkers(editor, idToClear);
    }

    setPasteFormatPrompt(null);
  }, []);

  const getPastePromptPosition = useCallback((pasteId: string) => {
    const editor = editorRef.current;
    const wrapper = editorWrapperRef.current;
    if (!editor || !wrapper) {
      return { top: 12, left: 12 };
    }

    return getPasteBatchPromptPosition(editor, wrapper, pasteId);
  }, []);

  const showPasteFormatPrompt = useCallback(
    (pasteId: string) => {
      dismissPasteFormatPrompt();

      const position = getPastePromptPosition(pasteId);
      setPasteFormatPrompt({
        pasteId,
        top: position.top,
        left: position.left,
        removeFormatting: false,
      });

      pasteFormatPromptTimerRef.current = window.setTimeout(() => {
        dismissPasteFormatPrompt(pasteId);
      }, PASTE_FORMAT_PROMPT_MS);
    },
    [dismissPasteFormatPrompt, getPastePromptPosition],
  );

  const finalizePasteEditorState = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;

    ensureBlockLines(editor);
    splitBlockLinesOnBreaks(editor);
    ensureTitleLine(editor);
    normalizeLinks(editor);
    syncLineEmptyState(editor);
    syncEditorContent();
    syncTitleToTaskList();
    recordHistorySnapshot();
    scheduleAutoSave();
    updateLineControls();
  }, [
    recordHistorySnapshot,
    scheduleAutoSave,
    syncEditorContent,
    syncTitleToTaskList,
    updateLineControls,
  ]);

  const applyPasteFormatOption = useCallback(
    (enabled: boolean) => {
      const editor = editorRef.current;
      const current = pasteFormatPromptRef.current;
      if (!editor || !current) return;

      const pasteId = current.pasteId;

      requestAnimationFrame(() => {
        const currentEditor = editorRef.current;
        if (!currentEditor) return;

        if (enabled) {
          stripFormattingInPasteBatch(currentEditor, pasteId);
        }

        ensureBlockLines(currentEditor);
        syncLineEmptyState(currentEditor);
        syncEditorContent();
        recordHistorySnapshot();
        scheduleAutoSave();
        dismissPasteFormatPrompt(pasteId);
      });
    },
    [
      dismissPasteFormatPrompt,
      recordHistorySnapshot,
      scheduleAutoSave,
      syncEditorContent,
    ],
  );

  useEffect(() => {
    return () => {
      if (pasteFormatPromptTimerRef.current !== null) {
        window.clearTimeout(pasteFormatPromptTimerRef.current);
      }
    };
  }, []);

  const restoreSavedLinkSelection = useCallback(() => {
    const editor = editorRef.current;
    const savedRange = savedLinkSelectionRef.current;
    const selection = window.getSelection();

    if (!editor || !savedRange || !selection) return;

    editor.focus();
    selection.removeAllRanges();
    selection.addRange(savedRange);
  }, []);

  const updateFormatMenu = useCallback(() => {
    if (showLinkMenuRef.current) return;

    const selection = window.getSelection();
    const editor = editorRef.current;

    if (!selection || !editor || !editor.contains(selection.anchorNode)) {
      closeFormatMenu();
      return;
    }

    const activeLine = getActiveLineElement(editor);
    if (isTitleLine(editor, activeLine)) {
      closeFormatMenu();
      return;
    }

    let rect: DOMRect;

    if (selection.isCollapsed) {
      const link = getLinkFromSelection(selection, editor);
      if (!link) {
        closeFormatMenu();
        return;
      }

      rect = link.getBoundingClientRect();
    } else {
      const range = selection.getRangeAt(0);
      rect = range.getBoundingClientRect();
    }

    if (rect.width === 0 && rect.height === 0) {
      closeFormatMenu();
      return;
    }

    setFormatMenu({
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
    });
    setShowColorMenu(false);
    setShowFormatTextTypeMenu(false);
  }, [closeFormatMenu]);

  const applyFormat = useCallback(
    (command: "bold" | "italic" | "underline" | "strikeThrough" | "highlight") => {
      const editor = editorRef.current;
      if (!editor) return;

      const activeLine = getActiveLineElement(editor);
      if (isCodeLine(activeLine)) return;

      editor.focus();

      if (command === "highlight") {
        applyHighlight(editor);
      } else {
        document.execCommand(command, false);
      }

      syncEditorContent();
      recordHistorySnapshot();
      scheduleAutoSave();
      closeFormatMenu();
    },
    [closeFormatMenu, recordHistorySnapshot, scheduleAutoSave, syncEditorContent],
  );

  const openLinkMenu = useCallback(() => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor) return;

    const activeLine = getActiveLineElement(editor);
    if (isCodeLine(activeLine)) return;

    if (selection && selection.rangeCount > 0) {
      savedLinkSelectionRef.current = selection.getRangeAt(0).cloneRange();
    } else {
      savedLinkSelectionRef.current = null;
    }

    const state = getLinkEditorState(editor, selection);
    setLinkText(state.text);
    setLinkUrl(state.url);
    showLinkMenuRef.current = true;
    setShowLinkMenu(true);
    setShowColorMenu(false);
    setShowFormatTextTypeMenu(false);

    requestAnimationFrame(() => {
      linkUrlInputRef.current?.focus();
      linkUrlInputRef.current?.select();
    });
  }, []);

  const applyLink = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const activeLine = getActiveLineElement(editor);
    if (isCodeLine(activeLine)) return;

    if (!linkUrl.trim()) {
      closeFormatMenu();
      return;
    }

    editor.focus();
    restoreSavedLinkSelection();
    const applied = applyLinkToSelection(editor, linkUrl, linkText);
    if (!applied) return;

    syncEditorContent();
    recordHistorySnapshot();
    scheduleAutoSave();
    closeFormatMenu();
  }, [
    closeFormatMenu,
    linkText,
    linkUrl,
    recordHistorySnapshot,
    restoreSavedLinkSelection,
    scheduleAutoSave,
    syncEditorContent,
  ]);

  const applyTextColor = useCallback(
    (color: string) => {
      const editor = editorRef.current;
      if (!editor) return;

      const activeLine = getActiveLineElement(editor);
      if (isCodeLine(activeLine)) return;

      editor.focus();
      document.execCommand("styleWithCSS", false, "true");
      document.execCommand("foreColor", false, color);
      syncEditorContent();
      recordHistorySnapshot();
      scheduleAutoSave();
      closeFormatMenu();
    },
    [closeFormatMenu, recordHistorySnapshot, scheduleAutoSave, syncEditorContent],
  );

  const applyLineBlockType = useCallback(
    (type: "bullet" | "numbered" | "checklist") => {
      const editor = editorRef.current;
      if (!editor) return;

      editor.focus();
      applyBlockTypeToSelection(editor, type);
      syncEditorContent();
      recordHistorySnapshot();
      scheduleAutoSave();
      closeFormatMenu();
      updateLineControls();
    },
    [
      closeFormatMenu,
      recordHistorySnapshot,
      scheduleAutoSave,
      syncEditorContent,
      updateLineControls,
    ],
  );

  const applyFormatTextType = useCallback(
    (type: TextBlockType) => {
      const editor = editorRef.current;
      if (!editor) return;

      const activeLine = getActiveLineElement(editor);
      if (isCodeLine(activeLine)) return;

      editor.focus();
      applyBlockTypeToSelection(editor, type);
      syncEditorContent();
      recordHistorySnapshot();
      scheduleAutoSave();
      closeFormatMenu();
      updateLineControls();
    },
    [
      closeFormatMenu,
      recordHistorySnapshot,
      scheduleAutoSave,
      syncEditorContent,
      updateLineControls,
    ],
  );

  const restoreHistorySnapshot = useCallback(
    (index: number) => {
      const editor = editorRef.current;
      const html = historyRef.current[index];

      if (!editor || html === undefined) return;

      isApplyingHistoryRef.current = true;
      editor.innerHTML = html;
      ensureBlockLines(editor);
      historyIndexRef.current = index;
      previousTextRef.current = editor.textContent ?? "";
      syncEditorContent();
      syncTitleToTaskList();
      updateHistoryAvailability();
      updateLineControls();
      closeFormatMenu();
      setAddBlockMenu(null);
      setTextTypeMenu(null);
      scheduleAutoSave();

      requestAnimationFrame(() => {
        isApplyingHistoryRef.current = false;
      });
    },
    [
      closeFormatMenu,
      scheduleAutoSave,
      syncEditorContent,
      syncTitleToTaskList,
      updateHistoryAvailability,
      updateLineControls,
    ],
  );

  const handleUndo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    restoreHistorySnapshot(historyIndexRef.current - 1);
  }, [restoreHistorySnapshot]);

  const handleRedo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    restoreHistorySnapshot(historyIndexRef.current + 1);
  }, [restoreHistorySnapshot]);

  useLayoutEffect(() => {
    if (!isReadyRef.current || !task?.id) return;
    if (hydratedTaskIdRef.current === task.id) return;

    const editor = editorRef.current;
    if (!editor) return;

    editor.innerHTML = detailsRef.current;
    ensureBlockLines(editor);
    ensureTitleLine(editor);
    syncLineEmptyState(editor);
    previousTextRef.current = editor.textContent ?? "";
    hydratedTaskIdRef.current = task.id;
    resetHistory(readEditorContent());

    requestAnimationFrame(() => {
      updateLineControls();
    });
  }, [readEditorContent, resetHistory, task?.id, updateLineControls]);

  useEffect(() => {
    if (!focusNoteAtEndRequest) return;
    if (focusNoteAtEndRequest === handledFocusNoteAtEndRequestRef.current) {
      return;
    }
    if (!isReadyRef.current || !editorRef.current || !taskId) return;
    if (hydratedTaskIdRef.current !== taskId) return;

    handledFocusNoteAtEndRequestRef.current = focusNoteAtEndRequest;

    requestAnimationFrame(() => {
      const editor = editorRef.current;
      if (!editor) return;

      focusNoteAtEnd(editor);
      updateLineControls();
    });
  }, [focusNoteAtEndRequest, task?.id, taskId, updateLineControls]);

  useEffect(() => {
    if (!taskId || !taskSnapshot || !isReadyRef.current || isHoverPreview) return;
    if (taskId !== taskIdRef.current) return;

    syncExternalTaskName(taskSnapshot.name);

    if (isDateMenuOpen) return;

    setTask((current) => {
      if (!current) return current;

      const dueDateSame = current.dueDate === taskSnapshot.dueDate;
      const dueTimeSame =
        current.dueTimeMinutes === taskSnapshot.dueTimeMinutes &&
        current.dueDurationMinutes === taskSnapshot.dueDurationMinutes &&
        current.dueTimeZone === taskSnapshot.dueTimeZone;

      if (dueDateSame && dueTimeSame) return current;

      return {
        ...current,
        dueDate: taskSnapshot.dueDate,
        dueTimeMinutes: taskSnapshot.dueTimeMinutes,
        dueDurationMinutes: taskSnapshot.dueDurationMinutes,
        dueTimeZone: taskSnapshot.dueTimeZone,
      };
    });
  }, [
    taskId,
    taskSnapshot?.name,
    taskSnapshot?.dueDate,
    taskSnapshot?.dueTimeMinutes,
    taskSnapshot?.dueDurationMinutes,
    taskSnapshot?.dueTimeZone,
    isDateMenuOpen,
    isHoverPreview,
    syncExternalTaskName,
  ]);

  useEffect(() => {
    if (clipboardNoticeTimerRef.current !== null) {
      window.clearTimeout(clipboardNoticeTimerRef.current);
      clipboardNoticeTimerRef.current = null;
    }
    setShowClipboardNotice(false);
    setLastSavedAt(null);

    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    if (!taskId) {
      isReadyRef.current = false;
      hydratedTaskIdRef.current = null;
      setTask(null);
      savedDetailsRef.current = "";
      detailsRef.current = "";
      isLargeContentRef.current = false;
      taskNameRef.current = "";
      syncedTitleRef.current = "";
      previousTextRef.current = "";
      taskIdRef.current = null;
      saveStatusRef.current = "idle";
      setSaveStatus("idle");
      if (clipboardNoticeTimerRef.current !== null) {
        window.clearTimeout(clipboardNoticeTimerRef.current);
        clipboardNoticeTimerRef.current = null;
      }
      setShowClipboardNotice(false);
      setLastSavedAt(null);
      closeFormatMenu();
      setLineControls([]);
      setAddBlockMenu(null);
      setTextTypeMenu(null);
      setIsDateMenuOpen(false);
      setCanUndo(false);
      setCanRedo(false);
      historyRef.current = [];
      historyIndexRef.current = -1;
      return;
    }

    let cancelled = false;
    isReadyRef.current = false;
    hydratedTaskIdRef.current = null;
    setSaveStatus("loading");
    saveStatusRef.current = "loading";
    closeFormatMenu();
    setLineControls([]);
    setAddBlockMenu(null);
    setTextTypeMenu(null);
    setIsDateMenuOpen(false);

    void fetchTaskById(taskId)
      .then((loadedTask) => {
        if (cancelled) return;

        if (!loadedTask) {
          setTask(null);
          savedDetailsRef.current = "";
          detailsRef.current = "";
          previousTextRef.current = "";
          setSaveStatus("error");
          return;
        }

        const loadedDetails = normalizeDetails(loadedTask.details);
        const editorHtml = buildEditorHtmlFromTask(
          loadedTask.name,
          loadedDetails,
        );

        setTask({
          ...loadedTask,
          dueDate: loadedTask.dueDate
            ? new Date(loadedTask.dueDate).toISOString()
            : null,
          dueTimeMinutes: loadedTask.dueTimeMinutes,
          dueDurationMinutes: loadedTask.dueDurationMinutes,
          dueTimeZone: loadedTask.dueTimeZone,
        });
        savedDetailsRef.current = loadedDetails;
        detailsRef.current = editorHtml;
        isLargeContentRef.current =
          loadedDetails.length > LARGE_CONTENT_THRESHOLD ||
          editorHtml.length > LARGE_CONTENT_THRESHOLD;
        taskNameRef.current = loadedTask.name;
        syncedTitleRef.current = loadedTask.name;
        taskIdRef.current = loadedTask.id;
        isReadyRef.current = true;
        setSaveStatus("idle");
        saveStatusRef.current = "idle";
        onTaskHasDetailsKnown?.(
          loadedTask.id,
          taskDetailsHasContent(loadedDetails),
        );
      })
      .catch(() => {
        if (!cancelled) {
          isReadyRef.current = false;
          setSaveStatus("error");
        }
      });

    return () => {
      cancelled = true;
      isReadyRef.current = false;

      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }

      const previousTaskId = taskIdRef.current;
      const editorHtmlAtSwitch =
        editorRef.current?.innerHTML ?? detailsRef.current;
      const { title: titleAtSwitch, details: detailsAtSwitch } =
        splitEditorContent(editorHtmlAtSwitch);
      const savedDetailsAtSwitch = savedDetailsRef.current;
      const taskNameAtSwitch = taskNameRef.current;

      void (async () => {
        await waitForSaveIdle();

        if (!previousTaskId) return;

        if (detailsAtSwitch !== savedDetailsAtSwitch) {
          try {
            await saveTaskDetails(previousTaskId, detailsAtSwitch);
            savedDetailsRef.current = detailsAtSwitch;
            onDetailsSaved(previousTaskId, detailsAtSwitch);
          } catch {
            saveTaskDetailsKeepalive(previousTaskId, detailsAtSwitch);
          }
        }

        if (titleAtSwitch && titleAtSwitch !== taskNameAtSwitch) {
          try {
            const updatedTask = await renameTask(previousTaskId, titleAtSwitch);
            onTaskRenamed(previousTaskId, updatedTask.name);
          } catch {
            // Best effort only when switching tasks.
          }
        }
      })();
    };
  }, [
    closeFormatMenu,
    onDetailsSaved,
    onTaskHasDetailsKnown,
    onTaskRenamed,
    taskId,
    waitForSaveIdle,
  ]);

  useEffect(() => {
    function handlePageHide() {
      const currentTaskId = taskIdRef.current;
      if (!currentTaskId || !isReadyRef.current) return;

      const editorHtml = editorRef.current?.innerHTML ?? detailsRef.current;
      const { details } = splitEditorContent(editorHtml);

      if (details === savedDetailsRef.current) return;

      saveTaskDetailsKeepalive(currentTaskId, details);
    }

    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }

      if (historyTimerRef.current !== null) {
        window.clearTimeout(historyTimerRef.current);
      }

      if (lineControlsTimerRef.current !== null) {
        window.clearTimeout(lineControlsTimerRef.current);
      }

      if (titleSyncTimerRef.current !== null) {
        window.clearTimeout(titleSyncTimerRef.current);
      }

      if (inputNormalizeFrameRef.current !== null) {
        window.cancelAnimationFrame(inputNormalizeFrameRef.current);
      }

      if (inputNormalizeTimerRef.current !== null) {
        window.clearTimeout(inputNormalizeTimerRef.current);
      }

      if (formatMenuTimerRef.current !== null) {
        window.clearTimeout(formatMenuTimerRef.current);
      }

      if (clipboardNoticeTimerRef.current !== null) {
        window.clearTimeout(clipboardNoticeTimerRef.current);
      }

      document.removeEventListener("pointermove", handleDragMove);
      document.removeEventListener("pointerup", handleDragEnd);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;

      if (formatMenuRef.current?.contains(target)) {
        return;
      }

      if (lineControlsRef.current?.contains(target)) {
        return;
      }

      if (addBlockMenuRef.current?.contains(target)) {
        return;
      }

      if (textTypeMenuRef.current?.contains(target)) {
        return;
      }

      if (dateMenuRef.current?.contains(target)) {
        return;
      }

      if (dateButtonRef.current?.contains(target)) {
        return;
      }

      setAddBlockMenu(null);
      setTextTypeMenu(null);
      setIsDateMenuOpen(false);

      if (!panelRef.current?.contains(target)) {
        closeFormatMenu();
        flushAutoSave();
      }
    }

    function handleSelectionChange() {
      if (!formatMenuRef.current?.contains(document.activeElement)) {
        if (formatMenuTimerRef.current !== null) {
          window.clearTimeout(formatMenuTimerRef.current);
        }

        formatMenuTimerRef.current = window.setTimeout(() => {
          formatMenuTimerRef.current = null;
          updateFormatMenu();
        }, FORMAT_MENU_DEBOUNCE_MS);
      }

      scheduleLineControlsUpdate();
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("selectionchange", handleSelectionChange);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, [closeFormatMenu, flushAutoSave, scheduleLineControlsUpdate, updateFormatMenu]);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (!taskIdRef.current || !panelRef.current) return;

      const target = event.target as Node | null;
      if (!target || !panelRef.current.contains(target)) return;

      if (!(event.metaKey || event.ctrlKey)) return;

      const key = event.key.toLowerCase();

      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        handleUndo();
        return;
      }

      if (key === "y") {
        event.preventDefault();
        handleRedo();
        return;
      }

      if (key === "z" && event.shiftKey) {
        event.preventDefault();
        handleRedo();
      }
    }

    document.addEventListener("keydown", handleShortcut, true);
    return () => document.removeEventListener("keydown", handleShortcut, true);
  }, [handleUndo, handleRedo]);

  function handleEditorInput() {
    scheduleInputNormalization();
  }

  async function insertImagesFromFiles(
    files: File[],
    referenceLine?: HTMLElement | null,
    options?: { fromClipboard?: boolean },
  ) {
    const editor = editorRef.current;
    const currentTaskId = taskIdRef.current;

    if (!editor || files.length === 0 || !currentTaskId) return;

    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    try {
      await waitForSaveIdle();

      const sources = await uploadImageFiles(currentTaskId, files);

      if (taskIdRef.current !== currentTaskId || !editorRef.current) return;

      await insertImagesIntoEditor(editor, sources, referenceLine);
      syncEditorContent();
      recordHistorySnapshot();
      if (options?.fromClipboard) {
        showClipboardSaveNotice();
      }
      requestSave("immediate");
      updateLineControls();
    } catch {
      setSaveStatus("error");
    }
  }

  function handleEditorPaste(event: React.ClipboardEvent<HTMLDivElement>) {
    const editor = editorRef.current;
    if (!editor) return;

    const activeLine = getActiveLineElement(editor);
    if (isCodeLine(activeLine)) {
      event.preventDefault();
      const text = event.clipboardData.getData("text/plain");
      if (!text) return;

      editor.focus();
      document.execCommand("insertText", false, text);
      syncEditorContent();
      recordHistorySnapshot();
      scheduleAutoSave();
      updateLineControls();
      return;
    }

    const files = getImageFilesFromDataTransfer(event.clipboardData);
    if (files.length > 0) {
      event.preventDefault();
      void insertImagesFromFiles(files, activeLine, { fromClipboard: true });
      return;
    }

    const html = event.clipboardData.getData("text/html");
    const plainText = event.clipboardData.getData("text/plain");

    if (html && plainText && pastedHtmlHasFormatting(html)) {
      event.preventDefault();

      const pasteId = crypto.randomUUID();
      const fragment = preparePasteFragment(html, pasteId);

      editor.focus();
      insertPasteFragmentAtSelection(fragment);

      requestAnimationFrame(() => {
        finalizePasteEditorState();
        showPasteFormatPrompt(pasteId);
      });
      return;
    }

    requestAnimationFrame(() => {
      finalizePasteEditorState();
    });
  }

  function handleEditorDragEnter(event: React.DragEvent<HTMLDivElement>) {
    if (!hasImageFilesInDataTransfer(event.dataTransfer)) return;

    event.preventDefault();
    imageDropDepthRef.current += 1;
    setIsImageDropActive(true);
  }

  function handleEditorDragOver(event: React.DragEvent<HTMLDivElement>) {
    if (!hasImageFilesInDataTransfer(event.dataTransfer)) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsImageDropActive(true);
  }

  function handleEditorDragLeave(event: React.DragEvent<HTMLDivElement>) {
    const relatedTarget = event.relatedTarget as Node | null;
    if (relatedTarget && event.currentTarget.contains(relatedTarget)) return;

    imageDropDepthRef.current -= 1;
    if (imageDropDepthRef.current <= 0) {
      imageDropDepthRef.current = 0;
      setIsImageDropActive(false);
    }
  }

  function handleEditorDrop(event: React.DragEvent<HTMLDivElement>) {
    imageDropDepthRef.current = 0;
    setIsImageDropActive(false);

    const files = getImageFilesFromDataTransfer(event.dataTransfer);
    if (files.length === 0) return;

    event.preventDefault();

    const editor = editorRef.current;
    if (!editor) return;

    const targetLine = getLineElementAtPoint(editor, event.clientY);
    void insertImagesFromFiles(files, targetLine);
  }

  function handleEditorBlur(event: React.FocusEvent<HTMLDivElement>) {
    const nextTarget = event.relatedTarget;
    if (
      nextTarget instanceof Node &&
      (lineControlsRef.current?.contains(nextTarget) ||
        addBlockMenuRef.current?.contains(nextTarget))
    ) {
      return;
    }

    if (inputNormalizeTimerRef.current !== null) {
      window.clearTimeout(inputNormalizeTimerRef.current);
      inputNormalizeTimerRef.current = null;
    }

    if (inputNormalizeFrameRef.current !== null) {
      window.cancelAnimationFrame(inputNormalizeFrameRef.current);
      inputNormalizeFrameRef.current = null;
    }

    runEditorNormalization("full");
    flushHistorySnapshot();
    flushAutoSave();
  }

  function handleEditorWrapperMouseMove(
    event: React.MouseEvent<HTMLDivElement>,
  ) {
    const editor = editorRef.current;
    if (!editor || dragStateRef.current) return;

    ensureBlockLines(editor);

    const line = getLineElementAtPoint(editor, event.clientY);
    hoveredLineRef.current = line;
    scheduleLineControlsUpdate();
  }

  function handleEditorWrapperMouseEnter() {
    isMouseOverEditorRef.current = true;
  }

  function handleEditorWrapperMouseLeave(
    event: React.MouseEvent<HTMLDivElement>,
  ) {
    const relatedTarget = event.relatedTarget;
    if (
      relatedTarget instanceof Node &&
      (lineControlsRef.current?.contains(relatedTarget) ||
        addBlockMenuRef.current?.contains(relatedTarget) ||
        textTypeMenuRef.current?.contains(relatedTarget))
    ) {
      return;
    }

    isMouseOverEditorRef.current = false;
    hoveredLineRef.current = null;
    scheduleLineControlsUpdate();
  }

  function handleEditorFocus() {
    const editor = editorRef.current;
    const activeLine = editor ? getActiveLineElement(editor) : null;

    if (editor && activeLine && isDetailLineEmpty(activeLine)) {
      placeCaretInLine(activeLine);
    }

    updateLineControls();
  }

  function handleEditorMouseDown(event: React.MouseEvent<HTMLDivElement>) {
    const editor = editorRef.current;
    if (!editor) return;

    const clickResult = handleClickBelowLastLine(editor, event.clientY);
    if (clickResult) {
      if (clickResult === "inserted") {
        syncEditorContent();
        recordHistorySnapshot();
        scheduleAutoSave();
      }
      updateLineControls();
      return;
    }

    const line = getLineElementAtPoint(editor, event.clientY);
    if (!line || !isDetailLineEmpty(line)) return;

    requestAnimationFrame(() => {
      placeCaretInLine(line);
    });
  }

  function handlePlusClick(
    event: React.MouseEvent<HTMLButtonElement>,
    lineId: string,
  ) {
    event.stopPropagation();
    setTextTypeMenu(null);

    const editor = editorRef.current;
    if (!editor) return;

    const line = getLineById(editor, lineId);
    if (!line) return;

    activeLineControlsRef.current = line;

    const rect = event.currentTarget.getBoundingClientRect();
    setAddBlockMenu((current) =>
      current
        ? null
        : {
            top: rect.bottom + 4,
            left: rect.left,
          },
    );
  }

  function handleTextTypeClick(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    setAddBlockMenu(null);

    const rect = event.currentTarget.getBoundingClientRect();
    setTextTypeMenu((current) =>
      current
        ? null
        : {
            top: rect.bottom + 4,
            left: rect.left,
          },
    );
  }

  function handleApplyTextType(type: TextBlockType) {
    const editor = editorRef.current;
    if (!editor) return;

    const line =
      activeLineControlsRef.current ?? getActiveLineElement(editor);
    if (!line) return;

    editor.focus();

    const selection = window.getSelection();
    if (selection) {
      const range = document.createRange();
      range.selectNodeContents(line);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    applyBlockTypeToSelection(editor, type);
    setTextTypeMenu(null);
    syncEditorContent();
    recordHistorySnapshot();
    scheduleAutoSave();
    updateLineControls();
  }

  function handleInsertBlockType(type: LineBlockType) {
    const editor = editorRef.current;
    if (!editor) return;

    const line =
      activeLineControlsRef.current ?? getActiveLineElement(editor);
    if (!line) return;

    insertTypedLineBelowLine(editor, line, type);
    hoveredLineRef.current = line;
    setAddBlockMenu(null);
    syncEditorContent();
    recordHistorySnapshot();
    scheduleAutoSave();
    updateLineControls();
  }

  function handleDragMove(event: PointerEvent) {
    const editor = editorRef.current;
    const wrapper = editorWrapperRef.current;
    const dragState = dragStateRef.current;

    if (!editor || !wrapper || !dragState) return;

    const lines = getLineElements(editor);
    const dropIndex = Math.max(
      1,
      getDropIndex(event.clientY, lines, dragState.sourceIndex),
    );
    dragState.dropIndex = dropIndex;

    const wrapperRect = wrapper.getBoundingClientRect();
    let indicatorTop: number;

    if (dropIndex >= lines.length) {
      const lastLine = lines[lines.length - 1];
      if (!lastLine) return;
      const rect = lastLine.getBoundingClientRect();
      indicatorTop = rect.bottom - wrapperRect.top;
    } else {
      const targetLine = lines[dropIndex];
      const rect = targetLine.getBoundingClientRect();
      indicatorTop = rect.top - wrapperRect.top;
    }

    setDropIndicator({ top: indicatorTop });
  }

  function handleDragEnd() {
    const editor = editorRef.current;
    const dragState = dragStateRef.current;

    document.removeEventListener("pointermove", handleDragMove);
    document.removeEventListener("pointerup", handleDragEnd);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";

    dragState?.sourceLine.classList.remove("opacity-50");
    setDropIndicator(null);

    if (editor && dragState) {
      const changed = reorderLine(
        editor,
        dragState.sourceIndex,
        dragState.dropIndex,
      );

      if (changed) {
        syncEditorContent();
        recordHistorySnapshot();
        scheduleAutoSave();
      }

      updateLineControls();
    }

    dragStateRef.current = null;
  }

  function beginLineReorderDrag(line: HTMLElement) {
    const editor = editorRef.current;
    if (!editor) return;

    ensureBlockLines(editor);

    const sourceIndex = getLineIndex(editor, line);
    if (sourceIndex <= 0) return;

    dragStateRef.current = {
      sourceLine: line,
      sourceIndex,
      dropIndex: sourceIndex,
    };

    line.classList.add("opacity-50");

    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
    document.addEventListener("pointermove", handleDragMove);
    document.addEventListener("pointerup", handleDragEnd);
  }

  function handleLineDragStart(
    event: React.PointerEvent<HTMLButtonElement>,
    lineId: string,
  ) {
    event.preventDefault();

    const editor = editorRef.current;
    if (!editor) return;

    const line = getLineById(editor, lineId);
    if (!line) return;

    activeLineControlsRef.current = line;
    beginLineReorderDrag(line);
  }

  function handleEditorKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      const editor = editorRef.current;
      if (!editor) return;

      const activeLine = getActiveLineElement(editor);
      if (!activeLine) return;

      splitLineAtCursor(editor);
      syncEditorContent();
      recordHistorySnapshot();
      scheduleAutoSave();
      updateLineControls();
      return;
    }
  }

  function handleEditorKeyUp() {
    if (formatMenuTimerRef.current !== null) {
      window.clearTimeout(formatMenuTimerRef.current);
    }

    formatMenuTimerRef.current = window.setTimeout(() => {
      formatMenuTimerRef.current = null;
      updateFormatMenu();
    }, FORMAT_MENU_DEBOUNCE_MS);

    scheduleLineControlsUpdate();
  }

  function handleEditorMouseUp() {
    if (formatMenuTimerRef.current !== null) {
      window.clearTimeout(formatMenuTimerRef.current);
    }

    formatMenuTimerRef.current = window.setTimeout(() => {
      formatMenuTimerRef.current = null;
      updateFormatMenu();
    }, FORMAT_MENU_DEBOUNCE_MS);

    scheduleLineControlsUpdate();
  }

  function handleEditorContextMenu(event: React.MouseEvent<HTMLDivElement>) {
    const editor = editorRef.current;
    if (!editor) return;

    const line = (event.target as HTMLElement).closest(".detail-line");
    if (line instanceof HTMLElement && isTitleLine(editor, line)) {
      event.preventDefault();
    }
  }

  function handleEditorWrapperPointerDownCapture(
    event: React.PointerEvent<HTMLDivElement>,
  ) {
    const target = event.target as HTMLElement;

    const handle = getImageResizeHandle(target);
    if (handle) {
      const wrapper = target.closest(".detail-image-wrapper");
      if (!(wrapper instanceof HTMLElement)) return;

      startImageResize(event.nativeEvent, handle, wrapper, () => {
        syncEditorContent();
        recordHistorySnapshot();
        requestSave("flush");
      });
      return;
    }

    const dragTarget = getImageDragTarget(target);
    if (!dragTarget) return;

    const editor = editorRef.current;
    if (!editor) return;

    event.preventDefault();

    startImagePointerInteraction(
      event.nativeEvent,
      dragTarget.wrapper,
      dragTarget.line,
      editor,
      () => {
        syncEditorContent();
        recordHistorySnapshot();
        requestSave("flush");
      },
    );
  }

  function handleEditorClick(event: React.MouseEvent<HTMLDivElement>) {
    const editor = editorRef.current;
    if (!editor) return;

    const link = (event.target as HTMLElement).closest("a.detail-link");
    if (link instanceof HTMLAnchorElement && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      window.open(link.href, "_blank", "noopener,noreferrer");
      return;
    }

    const deleteButton = (event.target as HTMLElement).closest(
      ".detail-image-delete",
    );
    if (deleteButton) {
      event.preventDefault();
      event.stopPropagation();

      const imageWrapper = deleteButton.closest(".detail-image-wrapper");
      if (!(imageWrapper instanceof HTMLElement)) return;

      const removed = removeImageWrapper(editor, imageWrapper);
      if (!removed) return;

      syncEditorContent();
      recordHistorySnapshot();
      requestSave("flush");
      updateLineControls();
      return;
    }
  }

  function handleDateButtonClick() {
    if (!task) return;
    setIsDateMenuOpen((open) => !open);
  }

  async function handleSelectDueDate(dateValue: string) {
    if (!task) return;

    try {
      const updated = await updateTaskDueDate(task.id, dateValue);
      const dueDate = updated.dueDate
        ? new Date(updated.dueDate).toISOString()
        : null;

      setTask((current) =>
        current
          ? {
              ...current,
              dueDate,
              dueTimeMinutes: updated.dueTimeMinutes,
              dueDurationMinutes: updated.dueDurationMinutes,
              dueTimeZone: updated.dueTimeZone,
            }
          : current,
      );
      onDueDateUpdated(task.id, dueDate, {
        dueTimeMinutes: updated.dueTimeMinutes,
        dueDurationMinutes: updated.dueDurationMinutes,
        dueTimeZone: updated.dueTimeZone,
      });
    } catch {
      return;
    }
  }

  async function handleSaveDueTime(dueTime: TaskDueTime) {
    if (!task) return;

    try {
      const updated = await updateTaskDueTime(task.id, dueTime);

      setTask((current) =>
        current
          ? {
              ...current,
              dueTimeMinutes: updated.dueTimeMinutes,
              dueDurationMinutes: updated.dueDurationMinutes,
              dueTimeZone: updated.dueTimeZone,
            }
          : current,
      );
      onDueDateUpdated(task.id, task.dueDate, {
        dueTimeMinutes: updated.dueTimeMinutes,
        dueDurationMinutes: updated.dueDurationMinutes,
        dueTimeZone: updated.dueTimeZone,
      });
      setIsDateMenuOpen(false);
    } catch {
      return;
    }
  }

  const dueDateLabel = task ? formatDueDateLabel(task.dueDate) : null;
  const dueTimeLabel = task ? formatDueTimeLabel(task.dueTimeMinutes) : null;

  return (
    <section
      ref={panelRef}
      className="relative min-w-0 flex-1 bg-[#fbfbfc] "
    >
      <div className="relative flex items-center justify-between overflow-visible p-4">
        <div className="flex items-center gap-3">
          {task ? (
            <>
              <div className="relative">
                <button
                  ref={dateButtonRef}
                  type="button"
                  aria-label={
                    dueDateLabel
                      ? `Due ${dueDateLabel}. Change date`
                      : "Set task date"
                  }
                  aria-haspopup="dialog"
                  aria-expanded={isDateMenuOpen}
                  onClick={handleDateButtonClick}
                  className="flex cursor-pointer items-center gap-1 rounded-[15px] bg-[#e8eff2] pl-3.5 pr-3 py-[7px] text-[12px] font-semibold uppercase tracking-wide text-zinc-700 transition-colors hover:bg-[#e0e2e5] dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                >
                  <span>Date</span>
                  {dueDateLabel ? (
                    <span className="ml-1 flex flex-col items-start normal-case tracking-normal">
                      <span className="font-medium text-[#5F5F5F] dark:text-zinc-300">
                        {dueDateLabel}
                      </span>
                      {dueTimeLabel ? (
                        <span className="text-[10px] font-normal text-zinc-500 dark:text-zinc-400">
                          {dueTimeLabel}
                        </span>
                      ) : null}
                    </span>
                  ) : (
                    <PlusIcon className="ml-1 size-3 text-[#5F5F5F]" />
                  )}
                </button>

                {isDateMenuOpen && (
                  <div
                    ref={dateMenuRef}
                    className="absolute left-0 top-full z-50 mt-1.5"
                  >
                    <TaskDatePicker
                      dueDate={task.dueDate}
                      dueTimeMinutes={task.dueTimeMinutes}
                      dueDurationMinutes={task.dueDurationMinutes}
                      dueTimeZone={task.dueTimeZone}
                      onSelectDate={(dateValue) =>
                        void handleSelectDueDate(dateValue)
                      }
                      onSaveDueTime={(dueTime) => void handleSaveDueTime(dueTime)}
                    />
                  </div>
                )}
              </div>
              <span className="text-[#cfcfcf] ml-2">|</span>
              <div className="flex items-center overflow-hidden rounded">
                <button
                  type="button"
                  aria-label="Undo"
                  title="Undo (Ctrl+Z / Cmd+Z)"
                  disabled={!canUndo}
                  onClick={handleUndo}
                  className={`flex h-10 min-w-[2.25rem] items-center justify-center px-2.5 text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 ${
                    canUndo ? "cursor-pointer" : "cursor-not-allowed"
                  } disabled:opacity-40`}
                >
                  <BiUndo className="size-[21px]" />
                </button>
                <button
                  type="button"
                  aria-label="Redo"
                  title="Redo (Ctrl+Y / Cmd+Y, Ctrl+Shift+Z / Cmd+Shift+Z)"
                  disabled={!canRedo}
                  onClick={handleRedo}
                  className={`flex h-7 min-w-[2.25rem] items-center justify-center px-2.5 text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 ${
                    canRedo ? "cursor-pointer" : "cursor-not-allowed"
                  } disabled:opacity-40`}
                >
                  <BiRedo className="size-[21px]" />
                </button>
              </div>
            </>
          ) : (
            <span className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Date
            </span>
          )}
        </div>
        {taskId &&
          (saveStatus !== "idle" ||
            showClipboardNotice ||
            lastSavedAt !== null) && (
          <span className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            {showClipboardNotice ? <span>Clipboard</span> : null}
            {saveStatus === "loading" ? <span>Loading...</span> : null}
            {saveStatus === "pending" ? <span>Unsaved changes</span> : null}
            {saveStatus === "error" ? <span>Something went wrong</span> : null}
            {lastSavedAt && saveStatus === "saved" ? (
              <span>Saved · {formatSaveTime(lastSavedAt)}</span>
            ) : null}
          </span>
        )}
      </div>

      {taskId && saveStatus === "loading" ? (
        <p className="px-4 text-sm text-zinc-500 dark:text-zinc-400">
          Loading task details...
        </p>
      ) : task ? (
        <div
          className={`flex flex-col px-4 pb-4 transition-opacity ${
            isHoverPreview ? "opacity-70" : "opacity-100"
          }`}
        >
          <div
            ref={editorWrapperRef}
            className="relative overflow-visible text-[#333333]"
            onMouseEnter={handleEditorWrapperMouseEnter}
            onMouseLeave={handleEditorWrapperMouseLeave}
            onMouseMove={handleEditorWrapperMouseMove}
            onDragEnter={handleEditorDragEnter}
            onDragOver={handleEditorDragOver}
            onDragLeave={handleEditorDragLeave}
            onDrop={handleEditorDrop}
            onPointerDownCapture={handleEditorWrapperPointerDownCapture}
          >
            {isImageDropActive && (
              <div className="pointer-events-none absolute inset-0 z-30 rounded-md border-2 border-dashed border-blue-400 bg-blue-50/40 dark:border-blue-500 dark:bg-blue-950/20" />
            )}

            {pasteFormatPrompt && (
              <div
                className="absolute z-40 flex max-w-[calc(100%-1rem)] items-center gap-2 rounded-lg border border-zinc-200 bg-white/95 px-3 py-2 text-xs shadow-md backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-900/95"
                style={{
                  top: pasteFormatPrompt.top,
                  left: pasteFormatPrompt.left,
                }}
                onMouseDown={(event) => event.preventDefault()}
              >
                <label className="flex cursor-pointer items-center gap-1.5 text-zinc-700 dark:text-zinc-200">
                  <input
                    type="checkbox"
                    className="size-3.5 rounded border-zinc-300 accent-zinc-900 dark:border-zinc-600 dark:accent-zinc-100"
                    checked={pasteFormatPrompt.removeFormatting}
                    onChange={(event) =>
                      applyPasteFormatOption(event.target.checked)
                    }
                  />
                  Remove formatting
                </label>
              </div>
            )}

            <div
              ref={editorRef}
              contentEditable={!isHoverPreview}
              suppressContentEditableWarning
              onInput={handleEditorInput}
              onPaste={handleEditorPaste}
              onBlur={handleEditorBlur}
              onFocus={handleEditorFocus}
              onMouseUp={handleEditorMouseUp}
              onContextMenu={handleEditorContextMenu}
              onMouseDown={handleEditorMouseDown}
              onClick={handleEditorClick}
              onKeyDown={handleEditorKeyDown}
              onKeyUp={handleEditorKeyUp}
              onScroll={updateLineControls}
              className={`task-details-editor min-h-[650px] rounded-xl w-full resize-y overflow-auto py-2 pl-[60px] pr-3 text-[17px] leading-[1.6] text-[#333333] outline-none transition-colors dark:text-[#333333] [&_.detail-line[data-line-type=bullet]]:pl-1 [&_.detail-line[data-line-type=checklist]]:pl-1 [&_.detail-line[data-line-type=h1]]:text-[24px] [&_.detail-line[data-line-type=h1]]:font-bold [&_.detail-line[data-line-type=h1]]:leading-[32px] [&_.detail-line[data-line-type=h2]]:text-[1.3125rem] [&_.detail-line[data-line-type=h2]]:font-semibold [&_.detail-line[data-line-type=h2]]:leading-[1.6875rem] [&_.detail-line[data-line-type=h3]]:text-[1.125rem] [&_.detail-line[data-line-type=h3]]:font-semibold [&_.detail-line[data-line-type=h3]]:leading-[1.5rem] [&_.detail-line[data-line-type=numbered]]:pl-1 [&_mark]:bg-yellow-200 [&_s]:line-through [&_strike]:line-through [&_u]:underline ${
                isHoverPreview ? "bg-[#faf6ff]" : "bg-white dark:bg-white"
              }`}
            />

            {dropIndicator && (
              <div
                className="pointer-events-none absolute right-3 left-10 z-20 h-0.5 bg-blue-500"
                style={{ top: dropIndicator.top }}
              />
            )}

            {lineControls.length > 0 && (
              <div
                ref={lineControlsRef}
                className="pointer-events-none absolute inset-0 z-10"
              >
                {lineControls.map(({ lineId, top }) => (
                  <div
                    key={lineId}
                    className="pointer-events-auto absolute left-1 flex h-[1.6em] -translate-y-1/2 items-center"
                    style={{ top }}
                  >
                    <button
                      type="button"
                      aria-label="Add block below"
                      title="Add block below"
                      aria-haspopup="menu"
                      aria-expanded={addBlockMenu !== null}
                      className="flex size-[21px] rounded-lg py-[3px] px-[1px] items-center justify-center rounded text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 cursor-grab "
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={(event) => handlePlusClick(event, lineId)}
                    >
                      <PlusIcon className="size-[28px]" />
                    </button>
                    <button
                      type="button"
                      aria-label="Drag line"
                      title="Drag to reorder line"
                      className="flex size-[28px] rounded-lg py-[3px] px-[1px] items-center justify-center rounded text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 active:cursor-grabbing dark:hover:bg-zinc-800 dark:hover:text-zinc-200 cursor-grab "
                      onPointerDown={(event) =>
                        handleLineDragStart(event, lineId)
                      }
                    >
                      <InteractIcon className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <p className="px-4 text-sm text-zinc-500 dark:text-zinc-400">
          Select a task to view details
        </p>
      )}

      {addBlockMenu && (
        <div
          ref={addBlockMenuRef}
          role="menu"
          className="fixed z-50 min-w-[168px] rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
          style={{ top: addBlockMenu.top, left: addBlockMenu.left }}
        >
          {ADD_BLOCK_OPTIONS.map((option, index) => (
            <div key={option.type}>
              {index === TEXT_BLOCK_OPTIONS.length && (
                <div
                  role="separator"
                  className="my-1 border-t border-zinc-200 dark:border-zinc-700"
                />
              )}
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-900 hover:bg-zinc-100 dark:text-zinc-50 dark:hover:bg-zinc-800"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handleInsertBlockType(option.type)}
              >
                <option.Icon className="size-4 shrink-0 text-zinc-500 dark:text-zinc-400" />
                {option.label}
              </button>
            </div>
          ))}
        </div>
      )}

      {textTypeMenu && (
        <div
          ref={textTypeMenuRef}
          role="menu"
          className="fixed z-50 min-w-[168px] rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
          style={{ top: textTypeMenu.top, left: textTypeMenu.left }}
        >
          {TEXT_BLOCK_OPTIONS.map((option) => (
            <button
              key={option.type}
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-900 hover:bg-zinc-100 dark:text-zinc-50 dark:hover:bg-zinc-800"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => handleApplyTextType(option.type)}
            >
              <option.Icon className="size-4 shrink-0 text-zinc-500 dark:text-zinc-400" />
              {option.label}
            </button>
          ))}
        </div>
      )}

      {formatMenu && (
        <div
          ref={formatMenuRef}
          className="fixed z-50 min-w-[240px] -translate-x-1/2 -translate-y-full rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
          style={{ left: formatMenu.x, top: formatMenu.y }}
        >
          {showLinkMenu ? (
            <input
              ref={linkUrlInputRef}
              type="text"
              value={linkUrl}
              onChange={(event) => setLinkUrl(event.target.value)}
              placeholder="Paste or type a link"
              aria-label="Link URL"
              className="m-1 w-[calc(100%-0.5rem)] rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              onMouseDown={(event) => event.stopPropagation()}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  applyLink();
                }

                if (event.key === "Escape") {
                  event.preventDefault();
                  closeFormatMenu();
                }
              }}
            />
          ) : (
            <>
              <div className="flex gap-1 p-1">
                <div className="relative flex items-center gap-0.5">
                  <button
                    type="button"
                    className="h-[30px] rounded px-3 text-sm font-bold text-zinc-900 hover:bg-zinc-100 dark:text-zinc-50 dark:hover:bg-zinc-800"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      setShowFormatTextTypeMenu(false);
                      applyFormat("bold");
                    }}
                  >
                    B
                  </button>
                  <button
                    type="button"
                    aria-label="Text and headings"
                    title="Text and headings"
                    aria-haspopup="menu"
                    aria-expanded={showFormatTextTypeMenu}
                    className={`flex h-[30px] items-center gap-0.5 rounded border px-1.5 text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800 ${
                      showFormatTextTypeMenu
                        ? "border-zinc-300 bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800"
                        : "border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
                    }`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      setShowColorMenu(false);
                      setShowFormatTextTypeMenu((open) => !open);
                    }}
                  >
                    <LuList className="size-3.5" />
                    <LuChevronDown className="size-3" />
                  </button>

                  {showFormatTextTypeMenu && (
                    <div
                      role="menu"
                      className="absolute top-full left-0 z-10 mt-1 min-w-[168px] rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
                    >
                      {TEXT_BLOCK_OPTIONS.map((option) => (
                        <button
                          key={option.type}
                          type="button"
                          role="menuitem"
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-900 hover:bg-zinc-100 dark:text-zinc-50 dark:hover:bg-zinc-800"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => applyFormatTextType(option.type)}
                        >
                          <option.Icon className="size-4 shrink-0 text-zinc-500 dark:text-zinc-400" />
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="h-[30px] rounded px-3 text-sm italic text-zinc-900 hover:bg-zinc-100 dark:text-zinc-50 dark:hover:bg-zinc-800"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => applyFormat("italic")}
                >
                  I
                </button>
                <button
                  type="button"
                  className="h-[30px] rounded px-3 text-sm text-zinc-900 underline hover:bg-zinc-100 dark:text-zinc-50 dark:hover:bg-zinc-800"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => applyFormat("underline")}
                >
                  U
                </button>
                <button
                  type="button"
                  aria-label="Highlight"
                  title="Highlight"
                  className="h-[30px] rounded px-3 text-sm text-zinc-900 hover:bg-zinc-100 dark:text-zinc-50 dark:hover:bg-zinc-800"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => applyFormat("highlight")}
                >
                  <span className="rounded-sm bg-yellow-200 px-1 dark:bg-yellow-300 dark:text-zinc-900">
                    H
                  </span>
                </button>
                <button
                  type="button"
                  className="h-[30px] rounded px-3 text-sm text-zinc-900 line-through hover:bg-zinc-100 dark:text-zinc-50 dark:hover:bg-zinc-800"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => applyFormat("strikeThrough")}
                >
                  S
                </button>

                <div
                  aria-hidden="true"
                  className="mx-0.5 w-px self-stretch bg-zinc-200 dark:bg-zinc-700"
                />

                <button
                  type="button"
                  aria-label="Add link"
                  title="Add link"
                  className="flex h-[30px] w-[30px] items-center justify-center rounded text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={openLinkMenu}
                >
                  <BiLink className="size-4" />
                </button>

                <div
                  aria-hidden="true"
                  className="mx-0.5 w-px self-stretch bg-zinc-200 dark:bg-zinc-700"
                />

                <button
                  type="button"
                  aria-label="Text color"
                  title="Text color"
                  aria-expanded={showColorMenu}
                  className={`relative flex h-[30px] min-w-[30px] items-center justify-center rounded px-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                    showColorMenu ? "bg-zinc-100 dark:bg-zinc-800" : ""
                  }`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setShowFormatTextTypeMenu(false);
                    setShowColorMenu((open) => !open);
                  }}
                >
                  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    A
                  </span>
                  <span
                    className="absolute bottom-1 left-1.5 right-1.5 h-0.5 rounded-full"
                    style={{ backgroundColor: DEFAULT_TEXT_COLOR }}
                  />
                </button>

                <div
                  aria-hidden="true"
                  className="mx-0.5 w-px self-stretch bg-zinc-200 dark:bg-zinc-700"
                />

                {FORMAT_LIST_OPTIONS.map(({ type, label, Icon }) => (
                  <button
                    key={type}
                    type="button"
                    aria-label={label}
                    title={label}
                    className="flex h-[30px] w-[30px] items-center justify-center rounded text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => applyLineBlockType(type)}
                  >
                    <Icon className="size-4" />
                  </button>
                ))}
              </div>

              {showColorMenu && (
                <div className="mx-1 mb-1 flex items-center gap-1 border-t border-zinc-200 pt-1 dark:border-zinc-700">
                  {TEXT_COLOR_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-label={option.label}
                      title={option.label}
                      className="size-5 rounded-full border border-zinc-200 transition-transform hover:scale-110 dark:border-zinc-600"
                      style={{ backgroundColor: option.value }}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => applyTextColor(option.value)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
