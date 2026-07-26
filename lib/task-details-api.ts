export type TaskDetailsRecord = {
  id: string;
  name: string;
  completed: boolean;
  details: string;
  dueDate: string | null;
  dueTimeMinutes: number | null;
  dueDurationMinutes: number | null;
  dueTimeZone: string;
};

export async function fetchTaskById(
  taskId: string,
): Promise<TaskDetailsRecord | null> {
  const response = await fetch(`/api/tasks/${taskId}`);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error("Failed to load task");
  }

  return response.json() as Promise<TaskDetailsRecord>;
}

export async function saveTaskDetails(
  taskId: string,
  details: string,
): Promise<void> {
  const response = await fetch(`/api/tasks/${taskId}/details`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ details }),
  });

  if (!response.ok) {
    throw new Error("Failed to save task details");
  }
}

export function saveTaskDetailsKeepalive(taskId: string, details: string) {
  void fetch(`/api/tasks/${taskId}/details`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ details }),
    keepalive: true,
  });
}
