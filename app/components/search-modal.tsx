"use client";

import {
  Fragment,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { BiSearch } from "react-icons/bi";
import { fetchTaskById } from "@/lib/task-details-api";
import { taskDetailsHasContent } from "@/lib/task-details-content";
import {
  fetchLastSearchQuery,
  saveLastSearchQuery,
} from "@/lib/search-settings-api";
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
const SEARCH_QUERY_SAVE_MS = 400;
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

function getEffectiveDetails(task: SearchTask): string {
  if (taskDetailsHasContent(task.details)) {
    return task.details;
  }

  return detailsCache.get(task.id) ?? "";
}

function buildSearchIndex(tasks: SearchTask[]) {
  return tasks.map((task) => {
    const plainDetails = detailsToPlainText(getEffectiveDetails(task));

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

  const openMatches: IndexedSearchTask[] = [];
  const completedMatches: IndexedSearchTask[] = [];

  for (const task of index) {
    if (!taskMatchesScope(task, trimmed, scope)) continue;

    if (task.completed) {
      completedMatches.push(task);
    } else {
      openMatches.push(task);
    }
  }

  return [...openMatches, ...completedMatches].slice(0, SEARCH_RESULT_LIMIT);
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

type SearchTaskPreviewPanelProps = {
  task: SearchTask | null;
  onOpenTask?: (task: SearchTask) => void;
};

function SearchTaskPreviewPanel({ task, onOpenTask }: SearchTaskPreviewPanelProps) {
  const taskId = task?.id ?? null;
  const details = task?.details ?? "";
  const hasDetails = task?.hasDetails ?? false;

  const hasLoadedDetails = taskDetailsHasContent(details);
  const [fetchedDetails, setFetchedDetails] = useState<string | null>(() => {
    if (!taskId || hasLoadedDetails) return null;
    return detailsCache.get(taskId) ?? null;
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!taskId) {
      setFetchedDetails(null);
      setIsLoading(false);
      return;
    }

    if (hasLoadedDetails) {
      setFetchedDetails(null);
      setIsLoading(false);
      return;
    }

    const cached = detailsCache.get(taskId);
    if (cached !== undefined) {
      setFetchedDetails(cached);
      setIsLoading(false);
      return;
    }

    if (!hasDetails) {
      setFetchedDetails("");
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    fetchTaskById(taskId)
      .then((loadedTask) => {
        if (cancelled) return;
        const loaded = loadedTask?.details ?? "";
        detailsCache.set(taskId, loaded);
        setFetchedDetails(loaded);
      })
      .catch(() => {
        if (cancelled) return;
        detailsCache.set(taskId, "");
        setFetchedDetails("");
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [taskId, details, hasDetails, hasLoadedDetails]);

  if (!task) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-sm text-zinc-400 dark:text-zinc-500">
        Hover a task to preview its content
      </div>
    );
  }

  const previewDetails = hasLoadedDetails
    ? details
    : (fetchedDetails ?? detailsCache.get(task.id) ?? "");
  const hasContent = taskDetailsHasContent(previewDetails);

  function handleOpenTask() {
    if (task && onOpenTask) {
      onOpenTask(task);
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <button
        type="button"
        onClick={handleOpenTask}
        className="border-b border-zinc-100 px-5 py-4 text-left transition-colors hover:bg-zinc-100/80 dark:border-zinc-800 dark:hover:bg-zinc-800/50 cursor-pointer"
      >
        <h3
          className={`text-lg font-semibold leading-snug ${
            task.completed
              ? "text-zinc-400 line-through dark:text-zinc-500"
              : "text-zinc-900 dark:text-zinc-50"
          }`}
        >
          {task.name}
        </h3>
        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
          {task.listName}
        </p>
      </button>
      <button
        type="button"
        onClick={handleOpenTask}
        className="min-h-0 overflow-y-auto px-5 py-4 text-left transition-colors hover:bg-zinc-100/60 dark:hover:bg-zinc-800/30 cursor-pointer"
      >
        {isLoading ? (
          <p className="text-sm text-zinc-400 dark:text-zinc-500">
            Loading content...
          </p>
        ) : hasContent ? (
          <div
            className="search-result-content-preview task-details-editor pointer-events-none text-sm leading-relaxed text-zinc-700 dark:text-zinc-300"
            dangerouslySetInnerHTML={{ __html: previewDetails }}
          />
        ) : (
          <p className="text-sm text-zinc-400 dark:text-zinc-500">
            No content
          </p>
        )}
      </button>
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
  const [detailsVersion, setDetailsVersion] = useState(0);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRefs = useRef<(HTMLLIElement | null)[]>([]);
  const pendingDetailFetchesRef = useRef(new Set<string>());
  const queryRef = useRef(query);
  const prevOpenRef = useRef(false);
  const isFiltering = query !== deferredQuery;

  queryRef.current = query;

  function focusSearchInputSelectAll() {
    const input = inputRef.current;
    if (!input) return;

    input.focus();
    const length = input.value.length;
    if (length > 0) {
      input.setSelectionRange(0, length);
    }
  }

  const searchIndex = useMemo(
    () => (open ? buildSearchIndex(tasks) : []),
    [open, tasks, detailsVersion],
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
      setSearchScope("all");
      setActiveIndex(-1);
      setDetailsVersion(0);
      setIsLoadingDetails(false);
      return;
    }

    let cancelled = false;

    void fetchLastSearchQuery()
      .then((savedQuery) => {
        if (cancelled) return;
        setQuery(savedQuery);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            focusSearchInputSelectAll();
          });
        });
      })
      .catch(() => {
        if (cancelled) return;
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            focusSearchInputSelectAll();
          });
        });
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const timeout = window.setTimeout(() => {
      void saveLastSearchQuery(query).catch(() => {});
    }, SEARCH_QUERY_SAVE_MS);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [open, query]);

  useEffect(() => {
    if (prevOpenRef.current && !open) {
      void saveLastSearchQuery(queryRef.current).catch(() => {});
    }

    prevOpenRef.current = open;
  }, [open]);

  useEffect(() => {
    if (!open || searchScope === "names") {
      setIsLoadingDetails(false);
      return;
    }

    const tasksNeedingDetails = tasks.filter(
      (task) =>
        task.hasDetails &&
        !taskDetailsHasContent(getEffectiveDetails(task)) &&
        !pendingDetailFetchesRef.current.has(task.id),
    );

    if (tasksNeedingDetails.length === 0) {
      setIsLoadingDetails(false);
      return;
    }

    let cancelled = false;
    setIsLoadingDetails(true);

    for (const task of tasksNeedingDetails) {
      pendingDetailFetchesRef.current.add(task.id);
    }

    void Promise.all(
      tasksNeedingDetails.map((task) =>
        fetchTaskById(task.id)
          .then((fetched) => {
            if (cancelled) return;
            detailsCache.set(task.id, fetched?.details ?? "");
            setDetailsVersion((current) => current + 1);
          })
          .catch(() => {
            detailsCache.set(task.id, "");
          })
          .finally(() => {
            pendingDetailFetchesRef.current.delete(task.id);
          }),
      ),
    ).finally(() => {
      if (!cancelled) {
        setIsLoadingDetails(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [open, searchScope, tasks]);

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

  function handleSearchScopeChange(scope: SearchScope) {
    setSearchScope(scope);
    requestAnimationFrame(() => {
      focusSearchInputSelectAll();
    });
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
  const previewTask = activeIndex >= 0 ? (results[activeIndex] ?? null) : null;
  const showSplitLayout = trimmedQuery.length > 0 && results.length > 0;
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
        className="flex max-h-[min(75vh,600px)] w-full min-h-[640px] max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-xl dark:bg-zinc-900"
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
                onClick={() => handleSearchScopeChange(tab.id)}
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
          className={`min-h-0 flex-1 transition-opacity ${
            isFiltering ? "opacity-70" : "opacity-100"
          } ${showSplitLayout ? "flex" : "overflow-y-auto"}`}
        >
          {!trimmedQuery ? (
            <p className="px-4 py-6 text-sm text-zinc-500 dark:text-zinc-400">
              {emptyStateMessage}
            </p>
          ) : results.length === 0 ? (
            <p className="px-4 py-6 text-sm text-zinc-500 dark:text-zinc-400">
              {isLoadingDetails &&
              (searchScope === "content" || searchScope === "all")
                ? "Searching task content..."
                : "No tasks found"}
            </p>
          ) : (
            <>
              <div className="flex min-h-0 min-w-0 flex-1">
                <div className="flex min-h-0 w-[42%] shrink-0 flex-col overflow-y-auto border-r border-zinc-200 dark:border-zinc-800">
                  <ul
                    role="listbox"
                    aria-activedescendant={
                      activeIndex >= 0
                        ? `search-result-${results[activeIndex]?.id}`
                        : undefined
                    }
                  >
                    {results.map((task, index) => {
                      const isFirstCompleted =
                        task.completed &&
                        (index === 0 || !results[index - 1]?.completed);

                      return (
                        <Fragment key={task.id}>
                          {isFirstCompleted ? (
                            <li
                              role="presentation"
                              className="px-4 pb-1 pt-[10px] text-[10px] font-medium text-[#999999]"
                            >
                              Completed
                            </li>
                          ) : null}
                          <li
                            id={`search-result-${task.id}`}
                            ref={(element) => {
                              resultRefs.current[index] = element;
                            }}
                            role="option"
                            aria-selected={index === activeIndex}
                            onMouseEnter={() => setActiveIndex(index)}
                            className={`flex min-h-11 cursor-pointer items-center gap-3 border-b border-zinc-100 px-4 dark:border-zinc-800 ${
                              task.completed ? "blur-[1px]" : ""
                            } ${
                              index === activeIndex
                                ? "bg-zinc-100 dark:bg-zinc-800"
                                : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                            }`}
                          >
                            <TaskCompletionCheckbox
                              checked={task.completed}
                              onChange={() => onToggleTask(task.id)}
                              onClick={(event) => event.stopPropagation()}
                              className="shrink-0"
                              aria-label={`Mark ${task.name} complete`}
                            />
                            <button
                              type="button"
                              onClick={() => selectTask(task)}
                              className="min-w-0 flex-1 py-2.5 text-left"
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
                          </li>
                        </Fragment>
                      );
                    })}
                  </ul>
                  {results.length >= SEARCH_RESULT_LIMIT && (
                    <p className="px-4 py-3 text-xs text-zinc-400 dark:text-zinc-500">
                      Showing first {SEARCH_RESULT_LIMIT} matches
                    </p>
                  )}
                </div>

                <div className="min-h-0 min-w-0 flex-1 bg-zinc-50/60 dark:bg-zinc-950/40">
                  <SearchTaskPreviewPanel
                    task={previewTask}
                    onOpenTask={selectTask}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
