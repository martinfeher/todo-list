"use client";

import {
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { BiSearch } from "react-icons/bi";
import { fetchTaskById } from "@/lib/task-details-api";
import { taskDetailsHasContent } from "@/lib/task-details-content";
import { TaskCompletionCheckbox } from "./task-completion-checkbox";
import type { SearchTask } from "./todo-app";

type SearchModalProps = {
  open: boolean;
  tasks: SearchTask[];
  onClose: () => void;
  onSelectTask: (taskId: string, listId: string) => void;
  onToggleTask: (taskId: string) => void;
};

const SEARCH_RESULT_LIMIT = 50;
const detailsCache = new Map<string, string>();

type SearchScope = "all" | "names" | "content";

const SEARCH_SCOPE_TABS: { id: SearchScope; label: string }[] = [
  { id: "all", label: "All" },
  { id: "names", label: "Names" },
  { id: "content", label: "Task content" },
];

type IndexedSearchTask = SearchTask & {
  normalizedName: string;
  normalizedDetails: string;
  plainDetails: string;
};

function detailsToPlainText(details: string): string {
  if (!details.trim()) return "";

  const container = document.createElement("div");
  container.innerHTML = details;
  return (container.textContent ?? "").replace(/\s+/g, " ").trim();
}

function buildSearchIndex(tasks: SearchTask[]) {
  return tasks.map((task) => {
    const plainDetails = detailsToPlainText(task.details);

    return {
      ...task,
      normalizedName: task.name.toLowerCase(),
      plainDetails,
      normalizedDetails: plainDetails.toLowerCase(),
    };
  });
}

function taskMatchesScope(
  task: IndexedSearchTask,
  query: string,
  scope: SearchScope,
) {
  const trimmed = query.trim().toLowerCase();
  const nameMatch = task.normalizedName.includes(trimmed);
  const contentMatch = task.normalizedDetails.includes(trimmed);

  if (scope === "names") return nameMatch;
  if (scope === "content") return contentMatch;
  return nameMatch || contentMatch;
}

function filterTasks(
  index: IndexedSearchTask[],
  query: string,
  scope: SearchScope,
) {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];

  const matches: IndexedSearchTask[] = [];

  for (const task of index) {
    if (taskMatchesScope(task, trimmed, scope)) {
      matches.push(task);
      if (matches.length >= SEARCH_RESULT_LIMIT) break;
    }
  }

  return matches;
}

function highlightSearchMatch(text: string, query: string): ReactNode {
  const trimmed = query.trim();
  if (!trimmed) return text;

  const lowerText = text.toLowerCase();
  const lowerQuery = trimmed.toLowerCase();
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let matchIndex = lowerText.indexOf(lowerQuery, lastIndex);

  while (matchIndex !== -1) {
    if (matchIndex > lastIndex) {
      parts.push(text.slice(lastIndex, matchIndex));
    }

    parts.push(
      <span key={matchIndex} className="font-bold text-[#444444]">
        {text.slice(matchIndex, matchIndex + lowerQuery.length)}
      </span>,
    );

    lastIndex = matchIndex + lowerQuery.length;
    matchIndex = lowerText.indexOf(lowerQuery, lastIndex);
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

type SearchResultContentPreviewProps = {
  taskId: string;
  details: string;
  hasDetails: boolean;
};

function SearchResultContentPreview({
  taskId,
  details,
  hasDetails,
}: SearchResultContentPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const hasLoadedDetails = taskDetailsHasContent(details);
  const [fetchedDetails, setFetchedDetails] = useState<string | null>(() => {
    if (hasLoadedDetails) return null;
    return detailsCache.get(taskId) ?? null;
  });

  useEffect(() => {
    if (!hasDetails || hasLoadedDetails || fetchedDetails !== null) return;

    let cancelled = false;

    fetchTaskById(taskId)
      .then((task) => {
        if (cancelled) return;
        const loaded = task?.details ?? "";
        detailsCache.set(taskId, loaded);
        setFetchedDetails(loaded);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [taskId, hasDetails, hasLoadedDetails, fetchedDetails]);

  const previewDetails = hasLoadedDetails
    ? details
    : (fetchedDetails ?? detailsCache.get(taskId) ?? "");
  const hasContent = taskDetailsHasContent(previewDetails);

  useLayoutEffect(() => {
    if (!hasContent) return;

    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    const updateScale = () => {
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      const contentWidth = content.scrollWidth;
      const contentHeight = content.scrollHeight;

      if (contentWidth <= 0 || contentHeight <= 0) return;

      const nextScale = Math.min(
        containerWidth / contentWidth,
        containerHeight / contentHeight,
        1,
      );

      setScale(nextScale);
    };

    updateScale();

    const resizeObserver = new ResizeObserver(updateScale);
    resizeObserver.observe(container);
    resizeObserver.observe(content);

    const images = content.querySelectorAll("img");
    for (const image of images) {
      if (!image.complete) {
        image.addEventListener("load", updateScale);
        image.addEventListener("error", updateScale);
      }
    }

    return () => {
      resizeObserver.disconnect();
      for (const image of images) {
        image.removeEventListener("load", updateScale);
        image.removeEventListener("error", updateScale);
      }
    };
  }, [hasContent, previewDetails]);

  if (!hasDetails && !hasContent) return null;
  if (!hasContent) return null;

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="relative w-[220px] shrink-0 self-stretch overflow-hidden border-l border-zinc-100 bg-white/70 py-1.5 pl-2 pr-1.5 dark:border-zinc-800 dark:bg-zinc-950/50"
    >
      <div
        ref={contentRef}
        className="search-result-content-preview task-details-editor absolute left-2 top-1.5 w-[280px] origin-top-left text-[13px] leading-[1.45]"
        style={{ transform: `scale(${scale})` }}
        dangerouslySetInnerHTML={{ __html: previewDetails }}
      />
    </div>
  );
}

export function SearchModal({
  open,
  tasks,
  onClose,
  onSelectTask,
  onToggleTask,
}: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [searchScope, setSearchScope] = useState<SearchScope>("all");
  const [activeIndex, setActiveIndex] = useState(-1);
  const deferredQuery = useDeferredValue(query);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRefs = useRef<(HTMLLIElement | null)[]>([]);
  const isFiltering = query !== deferredQuery;

  const searchIndex = useMemo(
    () => (open ? buildSearchIndex(tasks) : []),
    [open, tasks],
  );

  const results = useMemo(
    () => filterTasks(searchIndex, deferredQuery, searchScope),
    [deferredQuery, searchIndex, searchScope],
  );

  useEffect(() => {
    setActiveIndex(results.length > 0 ? 0 : -1);
    resultRefs.current = [];
  }, [results]);

  useEffect(() => {
    if (activeIndex < 0) return;

    resultRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, results]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setSearchScope("all");
      setActiveIndex(-1);
      return;
    }

    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  function selectTask(task: SearchTask) {
    onSelectTask(task.id, task.listId);
    onClose();
  }

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (results.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) =>
        current < 0 ? 0 : Math.min(current + 1, results.length - 1),
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) =>
        current < 0 ? results.length - 1 : Math.max(current - 1, 0),
      );
      return;
    }

    if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      const task = results[activeIndex];
      if (task) {
        selectTask(task);
      }
    }
  }

  if (!open) return null;

  const trimmedQuery = query.trim();
  const highlightQuery = deferredQuery.trim();
  const emptyStateMessage =
    searchScope === "names"
      ? "Start typing to search task names"
      : searchScope === "content"
        ? "Start typing to search task content"
        : "Start typing to search task names and content";
   

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[12vh]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="search-modal-title"
        className="flex max-h-[min(70vh,520px)] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-xl dark:bg-zinc-900"
      >
        <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h2 id="search-modal-title" className="sr-only">
            Search tasks
          </h2>
          <div className="flex items-center gap-2">
            <BiSearch className="size-5 shrink-0 text-zinc-400" />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Search tasks and notes"
              className="h-[35px] w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-50"
            />
          </div>
          <div
            className="mt-3 flex flex-wrap gap-2"
            role="tablist"
            aria-label="Search scope"
          >
            {SEARCH_SCOPE_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={searchScope === tab.id}
                onClick={() => setSearchScope(tab.id)}
                className={`rounded-full px-[13px] py-[5px] text-xs font-medium transition-colors cursor-pointer ${
                  searchScope === tab.id
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "bg-zinc-200 text-zinc-600 hover:bg-zinc-400 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div
          className={`min-h-0 flex-1 overflow-y-auto transition-opacity ${
            isFiltering ? "opacity-70" : "opacity-100"
          }`}
        >
          {!trimmedQuery ? (
            <p className="px-4 py-6 text-sm text-zinc-500 dark:text-zinc-400">
              {emptyStateMessage}
            </p>
          ) : results.length === 0 ? (
            <p className="px-4 py-6 text-sm text-zinc-500 dark:text-zinc-400">
              No tasks found
            </p>
          ) : (
            <>
              <ul role="listbox" aria-activedescendant={activeIndex >= 0 ? `search-result-${results[activeIndex]?.id}` : undefined}>
                {results.map((task, index) => {
                  const showContentPreview =
                    task.hasDetails || taskDetailsHasContent(task.details);

                  return (
                  <li
                    key={task.id}
                    id={`search-result-${task.id}`}
                    ref={(element) => {
                      resultRefs.current[index] = element;
                    }}
                    role="option"
                    aria-selected={index === activeIndex}
                    className={`flex min-h-[44px] items-stretch gap-3 border-b border-zinc-100 px-4 dark:border-zinc-800 cursor-pointer ${
                      index === activeIndex
                        ? "bg-zinc-100 dark:bg-zinc-800"
                        : ""
                    }`}
                  >
                    <TaskCompletionCheckbox
                      checked={task.completed}
                      onChange={() => onToggleTask(task.id)}
                      onClick={(event) => event.stopPropagation()}
                      className="my-auto"
                      aria-label={`Mark ${task.name} complete`}
                    />
                    <button
                      type="button"
                      onClick={() => selectTask(task)}
                      className="min-w-0 flex-1 py-2 text-left max-w-[183px]"
                    >
                      <span
                        className={`block truncate text-sm ${
                          task.completed
                            ? "text-zinc-400 line-through dark:text-zinc-500"
                            : "text-zinc-900 dark:text-zinc-50"
                        }`}
                      >
                        {highlightSearchMatch(task.name, highlightQuery)}
                      </span>
                      <span className="block truncate text-xs text-zinc-400 dark:text-zinc-500">
                        {task.listName}
                      </span>
                    </button>
                    {showContentPreview ? (
                      <SearchResultContentPreview
                        taskId={task.id}
                        details={task.details}
                        hasDetails={task.hasDetails}
                      />
                    ) : null}
                  </li>
                  );
                })}
              </ul>
              {results.length >= SEARCH_RESULT_LIMIT && (
                <p className="px-4 py-3 text-xs text-zinc-400 dark:text-zinc-500">
                  Showing first {SEARCH_RESULT_LIMIT} matches
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
