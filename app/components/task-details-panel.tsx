"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getTaskById, updateTaskDetails } from "@/app/actions/todo";

type TaskDetails = {
  id: string;
  name: string;
  completed: boolean;
  details: string;
};

type TaskDetailsPanelProps = {
  taskId: string | null;
  onDetailsSaved: (taskId: string, details: string) => void;
};

type SaveStatus = "idle" | "loading" | "pending" | "saved" | "error";

const AUTO_SAVE_DELAY_MS = 4000;

export function TaskDetailsPanel({
  taskId,
  onDetailsSaved,
}: TaskDetailsPanelProps) {
  const [task, setTask] = useState<TaskDetails | null>(null);
  const [details, setDetails] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const savedDetailsRef = useRef("");
  const detailsRef = useRef("");
  const taskIdRef = useRef<string | null>(null);
  const isLoadingRef = useRef(false);

  const saveDetails = useCallback(async () => {
    const currentTaskId = taskIdRef.current;
    if (!currentTaskId || isLoadingRef.current) return;

    const pendingDetails = detailsRef.current;
    if (pendingDetails === savedDetailsRef.current) return;

    try {
      await updateTaskDetails(currentTaskId, pendingDetails);
      savedDetailsRef.current = pendingDetails;
      onDetailsSaved(currentTaskId, pendingDetails);
      setSaveStatus("saved");
    } catch {
      setSaveStatus("error");
    }
  }, [onDetailsSaved]);

  useEffect(() => {
    detailsRef.current = details;
  }, [details]);

  useEffect(() => {
    if (!taskId) {
      setTask(null);
      setDetails("");
      savedDetailsRef.current = "";
      detailsRef.current = "";
      taskIdRef.current = null;
      isLoadingRef.current = false;
      setSaveStatus("idle");
      return;
    }

    let cancelled = false;
    isLoadingRef.current = true;
    setSaveStatus("loading");

    void getTaskById(taskId)
      .then((loadedTask) => {
        if (cancelled) return;

        if (!loadedTask) {
          setTask(null);
          setDetails("");
          savedDetailsRef.current = "";
          detailsRef.current = "";
          isLoadingRef.current = false;
          setSaveStatus("error");
          return;
        }

        setTask(loadedTask);
        setDetails(loadedTask.details);
        savedDetailsRef.current = loadedTask.details;
        detailsRef.current = loadedTask.details;
        taskIdRef.current = loadedTask.id;
        isLoadingRef.current = false;
        setSaveStatus("idle");
      })
      .catch(() => {
        if (!cancelled) {
          isLoadingRef.current = false;
          setSaveStatus("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [taskId]);

  useEffect(() => {
    if (!taskId || isLoadingRef.current) return;

    const isDirty = details !== savedDetailsRef.current;
    if (!isDirty) return;

    setSaveStatus("pending");

    const timeoutId = window.setTimeout(() => {
      void saveDetails();
    }, AUTO_SAVE_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [details, taskId, saveDetails]);

  useEffect(() => {
    return () => {
      void saveDetails();
    };
  }, [saveDetails]);

  function handleDetailsChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    const previous = detailsRef.current;
    const next = event.target.value;
    const previousSpaceCount = (previous.match(/ /g) ?? []).length;
    const nextSpaceCount = (next.match(/ /g) ?? []).length;

    detailsRef.current = next;
    setDetails(next);

    if (nextSpaceCount > previousSpaceCount) {
      void saveDetails();
    }
  }

  return (
    <section className="min-w-0 flex-1 bg-zinc-50 dark:bg-zinc-950">
      <div className="flex items-center justify-between p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Details
        </h2>
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
        <div className="flex flex-col gap-3 px-4 pb-4">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {task.name}
          </h3>
          <textarea
            value={details}
            onChange={handleDetailsChange}
            placeholder="Add notes..."
            rows={8}
            className="w-full resize-y rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-500"
          />
        </div>
      ) : (
        <p className="px-4 text-sm text-zinc-500 dark:text-zinc-400">
          Select a task to view details
        </p>
      )}
    </section>
  );
}
