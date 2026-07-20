"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { BiLink, BiRedo, BiUndo } from "react-icons/bi";
import { getTaskById, renameTask, updateTaskDetails, updateTaskDueDate, updateTaskDueTime } from "@/app/actions/todo";
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
  getLineElements,
  getLineIndex,
  insertImagesIntoEditor,
  insertTypedLineBelowLine,
  isCodeLine,
  isDetailLineEmpty,
  type LineBlockType,
  placeCaretInLine,
  removeImageWrapper,
  reorderLine,
  splitEditorContent,
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

type TaskDetailsPanelProps = {
  taskId: string | null;
  onDetailsSaved: (taskId: string, details: string) => void;
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

type LineControlsState = {
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

const ADD_BLOCK_OPTIONS: { type: LineBlockType; label: string }[] = [
  { type: "text", label: "Text" },
  { type: "h1", label: "Heading 1" },
  { type: "h2", label: "Heading 2" },
  { type: "bullet", label: "Bullet list" },
  { type: "numbered", label: "Numbered list" },
  { type: "code", label: "Code" },
];

const AUTO_SAVE_DELAY_MS = 4000;
const HISTORY_DEBOUNCE_MS = 400;
const HISTORY_LIMIT = 50;

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
  onDetailsSaved,
  onTaskRenamed,
  onDueDateUpdated,
}: TaskDetailsPanelProps) {
  const [task, setTask] = useState<TaskDetails | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [formatMenu, setFormatMenu] = useState<FormatMenuState | null>(null);
  const [lineControls, setLineControls] = useState<LineControlsState | null>(null);
  const [dropIndicator, setDropIndicator] = useState<DropIndicatorState | null>(null);
  const [isImageDropActive, setIsImageDropActive] = useState(false);
  const [addBlockMenu, setAddBlockMenu] = useState<AddBlockMenuState | null>(null);
  const [isDateMenuOpen, setIsDateMenuOpen] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [showColorMenu, setShowColorMenu] = useState(false);
  const [showLinkMenu, setShowLinkMenu] = useState(false);
  const [linkText, setLinkText] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const savedDetailsRef = useRef("");
  const detailsRef = useRef("");
  const taskIdRef = useRef<string | null>(null);
  const taskNameRef = useRef("");
  const hydratedTaskIdRef = useRef<string | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const editorWrapperRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const formatMenuRef = useRef<HTMLDivElement>(null);
  const linkUrlInputRef = useRef<HTMLInputElement>(null);
  const savedLinkSelectionRef = useRef<Range | null>(null);
  const showLinkMenuRef = useRef(false);
  const addBlockMenuRef = useRef<HTMLDivElement>(null);
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
  const historyTimerRef = useRef<number | null>(null);
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const isApplyingHistoryRef = useRef(false);
  const isReadyRef = useRef(false);
  const imageDropDepthRef = useRef(0);

  const readEditorContent = useCallback(() => {
    return normalizeDetails(editorRef.current?.innerHTML ?? "");
  }, []);

  const syncEditorContent = useCallback(() => {
    const html = readEditorContent();
    detailsRef.current = html;
    return html;
  }, [readEditorContent]);

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

    if (nextHistory.length > HISTORY_LIMIT) {
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

    historyTimerRef.current = window.setTimeout(() => {
      historyTimerRef.current = null;
      pushHistorySnapshot();
    }, HISTORY_DEBOUNCE_MS);
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
    const currentTaskId = taskIdRef.current;
    if (!currentTaskId || !isReadyRef.current) return;

    const editorHtml = editorRef.current?.innerHTML ?? detailsRef.current;
    const { title, details } = splitEditorContent(editorHtml);
    detailsRef.current = editorHtml;

    let nextStatus: SaveStatus | null = null;

    try {
      if (details !== savedDetailsRef.current) {
        await updateTaskDetails(currentTaskId, details);
        savedDetailsRef.current = details;
        onDetailsSaved(currentTaskId, details);
        nextStatus = "saved";
      }

      if (title && title !== taskNameRef.current) {
        const updatedTask = await renameTask(currentTaskId, title);
        taskNameRef.current = updatedTask.name;
        setTask((current) =>
          current ? { ...current, name: updatedTask.name } : current,
        );
        onTaskRenamed(currentTaskId, updatedTask.name);
        nextStatus = "saved";
      }

      if (nextStatus) {
        setSaveStatus(nextStatus);
      }
    } catch {
      setSaveStatus("error");
    }
  }, [onDetailsSaved, onTaskRenamed]);

  const scheduleAutoSave = useCallback(() => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }

    setSaveStatus("pending");

    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      void saveDetails();
    }, AUTO_SAVE_DELAY_MS);
  }, [saveDetails]);

  const updateLineControls = useCallback(() => {
    const editor = editorRef.current;
    const wrapper = editorWrapperRef.current;
    if (!editor || !wrapper) {
      setLineControls(null);
      return;
    }

    if (dragStateRef.current) return;

    let line: HTMLElement | null = null;

    if (isMouseOverEditorRef.current && hoveredLineRef.current) {
      line = hoveredLineRef.current;
    } else if (editor.contains(document.activeElement)) {
      line = getActiveLineElement(editor);
    }

    if (!line || !editor.contains(line)) {
      activeLineControlsRef.current = null;
      setLineControls(null);
      return;
    }

    if (getLineIndex(editor, line) === 0) {
      activeLineControlsRef.current = null;
      setLineControls(null);
      return;
    }

    const position = getLineControlsPositionForLine(line, wrapper);
    if (!position) {
      activeLineControlsRef.current = null;
      setLineControls(null);
      return;
    }

    activeLineControlsRef.current = line;
    setLineControls(position);
  }, []);

  const closeFormatMenu = useCallback(() => {
    setFormatMenu(null);
    setShowColorMenu(false);
    setShowLinkMenu(false);
    showLinkMenuRef.current = false;
    savedLinkSelectionRef.current = null;
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
      updateHistoryAvailability();
      updateLineControls();
      closeFormatMenu();
      setAddBlockMenu(null);
      scheduleAutoSave();

      requestAnimationFrame(() => {
        isApplyingHistoryRef.current = false;
      });
    },
    [
      closeFormatMenu,
      scheduleAutoSave,
      syncEditorContent,
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
      taskNameRef.current = "";
      previousTextRef.current = "";
      taskIdRef.current = null;
      setSaveStatus("idle");
      closeFormatMenu();
      setLineControls(null);
      setAddBlockMenu(null);
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
    closeFormatMenu();
    setLineControls(null);
    setAddBlockMenu(null);
    setIsDateMenuOpen(false);

    void getTaskById(taskId)
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
        taskNameRef.current = loadedTask.name;
        taskIdRef.current = loadedTask.id;
        isReadyRef.current = true;
        setSaveStatus("idle");
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
      const editorHtml = editorRef.current?.innerHTML ?? detailsRef.current;
      const { title, details } = splitEditorContent(editorHtml);

      if (previousTaskId && details !== savedDetailsRef.current) {
        void updateTaskDetails(previousTaskId, details);
      }

      if (
        previousTaskId &&
        title &&
        title !== taskNameRef.current
      ) {
        void renameTask(previousTaskId, title);
      }
    };
  }, [closeFormatMenu, taskId]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }

      if (historyTimerRef.current !== null) {
        window.clearTimeout(historyTimerRef.current);
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

      if (dateMenuRef.current?.contains(target)) {
        return;
      }

      if (dateButtonRef.current?.contains(target)) {
        return;
      }

      setAddBlockMenu(null);
      setIsDateMenuOpen(false);

      if (!panelRef.current?.contains(target)) {
        closeFormatMenu();
        setLineControls(null);
        void saveDetails();
      }
    }

    function handleSelectionChange() {
      if (!formatMenuRef.current?.contains(document.activeElement)) {
        updateFormatMenu();
      }
      updateLineControls();
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("selectionchange", handleSelectionChange);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, [closeFormatMenu, saveDetails, updateFormatMenu, updateLineControls]);

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
    const editor = editorRef.current;
    if (editor) {
      ensureBlockLines(editor);
      ensureTitleLine(editor);
      normalizeLinks(editor);
      syncLineEmptyState(editor);
    }

    const nextText = editorRef.current?.textContent ?? "";
    const previousText = previousTextRef.current;
    const previousSpaceCount = (previousText.match(/ /g) ?? []).length;
    const nextSpaceCount = (nextText.match(/ /g) ?? []).length;

    previousTextRef.current = nextText;
    syncEditorContent();
    scheduleHistorySnapshot();

    if (nextSpaceCount > previousSpaceCount) {
      flushHistorySnapshot();
      void saveDetails();
      return;
    }

    scheduleAutoSave();
    updateLineControls();
  }

  async function insertImagesFromFiles(
    files: File[],
    referenceLine?: HTMLElement | null,
  ) {
    const editor = editorRef.current;
    const currentTaskId = taskIdRef.current;

    if (!editor || files.length === 0 || !currentTaskId) return;

    try {
      const sources = await uploadImageFiles(currentTaskId, files);
      await insertImagesIntoEditor(editor, sources, referenceLine);
      syncEditorContent();
      recordHistorySnapshot();
      scheduleAutoSave();
      void saveDetails();
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
    if (files.length === 0) return;

    event.preventDefault();

    void insertImagesFromFiles(files, activeLine);
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
    const nextTarget = event.relatedTarget as Node | null;
    if (
      lineControlsRef.current?.contains(nextTarget) ||
      addBlockMenuRef.current?.contains(nextTarget)
    ) {
      return;
    }

    if (!isMouseOverEditorRef.current) {
      setLineControls(null);
      activeLineControlsRef.current = null;
    }

    flushHistorySnapshot();
    void saveDetails();
  }

  function handleEditorWrapperMouseMove(
    event: React.MouseEvent<HTMLDivElement>,
  ) {
    const editor = editorRef.current;
    if (!editor || dragStateRef.current) return;

    ensureBlockLines(editor);

    const line = getLineElementAtPoint(editor, event.clientY);
    if (!line) return;

    hoveredLineRef.current = line;
    updateLineControls();
  }

  function handleEditorWrapperMouseEnter() {
    isMouseOverEditorRef.current = true;
  }

  function handleEditorWrapperMouseLeave(
    event: React.MouseEvent<HTMLDivElement>,
  ) {
    const relatedTarget = event.relatedTarget as Node | null;
    if (
      lineControlsRef.current?.contains(relatedTarget) ||
      addBlockMenuRef.current?.contains(relatedTarget)
    ) {
      return;
    }

    isMouseOverEditorRef.current = false;
    hoveredLineRef.current = null;

    if (!editorRef.current?.contains(document.activeElement)) {
      activeLineControlsRef.current = null;
      setLineControls(null);
    } else {
      updateLineControls();
    }
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

    const line = getLineElementAtPoint(editor, event.clientY);
    if (!line || !isDetailLineEmpty(line)) return;

    requestAnimationFrame(() => {
      placeCaretInLine(line);
    });
  }

  function handlePlusClick(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();

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
        void saveDetails();
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

  function handleLineDragStart(event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault();

    const editor = editorRef.current;
    if (!editor) return;

    const line =
      activeLineControlsRef.current ?? getActiveLineElement(editor);
    if (!line) return;

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

  function handleEditorKeyUp(event: React.KeyboardEvent<HTMLDivElement>) {
    updateFormatMenu();
    updateLineControls();

    if (event.key === "Enter") {
      updateLineControls();
    }
  }

  function handleEditorMouseUp() {
    updateFormatMenu();
    updateLineControls();
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
        scheduleAutoSave();
        void saveDetails();
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
        scheduleAutoSave();
        void saveDetails();
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
      scheduleAutoSave();
      void saveDetails();
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
      setIsDateMenuOpen(false);
    } catch {
      return;
    }
  }

  return (
    <section
      ref={panelRef}
      className="relative min-w-0 flex-1 bg-zinc-50 dark:bg-zinc-950"
    >
      <div className="relative flex items-center justify-between overflow-visible p-4">
        <div className="flex items-center gap-3">
          {task ? (
            <>
              <div className="relative">
                <button
                  ref={dateButtonRef}
                  type="button"
                  aria-label="Set task date"
                  aria-haspopup="dialog"
                  aria-expanded={isDateMenuOpen}
                  onClick={handleDateButtonClick}
                  className="flex cursor-pointer items-center gap-1 rounded-2xl bg-[#e8eff2] pl-3.5 pr-3 py-[7px] text-[12px] font-semibold uppercase tracking-wide text-zinc-700 transition-colors hover:bg-[#e0e2e5] dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                >
                  <span>Date</span>
                  <PlusIcon className="ml-1 size-3 text-[#5F5F5F]" />
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
              {task.dueDate && formatDueDateLabel(task.dueDate) && (
                <div
                  className="cursor-pointer text-[13px] text-zinc-500 dark:text-zinc-400"
                  onClick={handleDateButtonClick}
                >
                  <div className="flex flex-col items-end text-right">
                    <p>{formatDueDateLabel(task.dueDate)}</p>
                    {formatDueTimeLabel(task.dueTimeMinutes) && (
                      <p className="text-[10px]">
                        {formatDueTimeLabel(task.dueTimeMinutes)}
                      </p>
                    )}
                  </div>
                </div>
              )}
              <span className="text-[#c0c0c0] ml-2">|</span>
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
        {taskId && saveStatus !== "idle" && (
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {saveStatus === "loading" && "Loading..."}
            {saveStatus === "pending" && "Unsaved changes"}
            {saveStatus === "saved" && "Saved"}
            {saveStatus === "error" && "Something went wrong"}
          </span>
        )}
      </div>

      {taskId && saveStatus === "loading" ? (
        <p className="px-4 text-sm text-zinc-500 dark:text-zinc-400">
          Loading task details...
        </p>
      ) : task ? (
        <div className="flex flex-col px-4 pb-4">
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

            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={handleEditorInput}
              onPaste={handleEditorPaste}
              onBlur={handleEditorBlur}
              onFocus={handleEditorFocus}
              onMouseUp={handleEditorMouseUp}
              onMouseDown={handleEditorMouseDown}
              onClick={handleEditorClick}
              onKeyDown={handleEditorKeyDown}
              onKeyUp={handleEditorKeyUp}
              onScroll={updateLineControls}
              className="task-details-editor min-h-[650px] reounded-xl w-full resize-y overflow-auto bg-white py-2 pl-10 pr-3 text-[1.05rem] leading-[1.5rem] text-[#333333] outline-none dark:bg-white dark:text-[#333333] [&_.detail-line[data-line-type=bullet]]:pl-1 [&_.detail-line[data-line-type=checklist]]:pl-1 [&_.detail-line[data-line-type=h1]]:text-[1.875rem] [&_.detail-line[data-line-type=h1]]:font-bold [&_.detail-line[data-line-type=h1]]:leading-[2.25rem] [&_.detail-line[data-line-type=h2]]:text-[1.3125rem] [&_.detail-line[data-line-type=h2]]:font-semibold [&_.detail-line[data-line-type=h2]]:leading-[1.6875rem] [&_.detail-line[data-line-type=numbered]]:pl-1 [&_mark]:bg-yellow-200 [&_s]:line-through [&_strike]:line-through [&_u]:underline"
            />

            {dropIndicator && (
              <div
                className="pointer-events-none absolute right-3 left-10 z-20 h-0.5 bg-blue-500"
                style={{ top: dropIndicator.top }}
              />
            )}

            {lineControls && (
              <div
                ref={lineControlsRef}
                className="pointer-events-auto absolute left-1 z-10 flex h-[1.5rem] -translate-y-1/2 items-center gap-0.5"
                style={{ top: lineControls.top }}
              >
                <button
                  type="button"
                  aria-label="Add block below"
                  title="Add block below"
                  aria-haspopup="menu"
                  aria-expanded={addBlockMenu !== null}
                  className="flex size-3 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={handlePlusClick}
                >
                  <PlusIcon className="size-3" />
                </button>
                <button
                  type="button"
                  aria-label="Drag line"
                  title="Drag to reorder line"
                  className="flex size-3 cursor-grab items-center justify-center rounded text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 active:cursor-grabbing dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                  onPointerDown={handleLineDragStart}
                >
                  <InteractIcon className="size-2.5" />
                </button>
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
          {ADD_BLOCK_OPTIONS.map((option) => (
            <button
              key={option.type}
              type="button"
              role="menuitem"
              className="block w-full px-3 py-2 text-left text-sm text-zinc-900 hover:bg-zinc-100 dark:text-zinc-50 dark:hover:bg-zinc-800"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => handleInsertBlockType(option.type)}
            >
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
                <button
                  type="button"
                  className="h-[30px] rounded px-3 text-sm font-bold text-zinc-900 hover:bg-zinc-100 dark:text-zinc-50 dark:hover:bg-zinc-800"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => applyFormat("bold")}
                >
                  B
                </button>
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
                  onClick={() => setShowColorMenu((open) => !open)}
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
