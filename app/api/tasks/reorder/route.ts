import { revalidatePath } from "next/cache";

import {
  mergeReorderedPinnedTasks,
  mergeReorderedUnpinnedTasks,
} from "@/app/components/task-reorder";
import { jsonWithCors, optionsWithCors } from "@/lib/api-cors";
import { prisma } from "@/lib/prisma";

type ReorderBody = {
  listId?: string;
  section?: "pinned" | "tasks";
  taskIds?: string[];
};

export async function PUT(request: Request) {
  let body: ReorderBody;
  try {
    body = (await request.json()) as ReorderBody;
  } catch {
    return jsonWithCors({ error: "Invalid JSON body" }, { status: 400 });
  }

  const listId = body.listId?.trim() ?? "";
  const section = body.section;
  const taskIds = Array.isArray(body.taskIds)
    ? body.taskIds.filter((id): id is string => typeof id === "string")
    : [];

  if (!listId) {
    return jsonWithCors({ error: "listId is required" }, { status: 400 });
  }

  if (section !== "pinned" && section !== "tasks") {
    return jsonWithCors(
      { error: "section must be 'pinned' or 'tasks'" },
      { status: 400 },
    );
  }

  if (taskIds.length === 0) {
    return jsonWithCors({ error: "taskIds is required" }, { status: 400 });
  }

  const list = await prisma.todoList.findUnique({
    where: { id: listId },
    select: { id: true },
  });

  if (!list) {
    return jsonWithCors({ error: "List not found" }, { status: 404 });
  }

  try {
    const tasks = await prisma.task.findMany({
      where: { listId },
      select: {
        id: true,
        completed: true,
        pinned: true,
      },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });

    const expectedActiveCount =
      section === "pinned"
        ? tasks.filter((task) => !task.completed && task.pinned).length
        : tasks.filter((task) => !task.completed && !task.pinned).length;

    if (taskIds.length !== expectedActiveCount) {
      return jsonWithCors(
        { error: "taskIds length does not match active section tasks" },
        { status: 400 },
      );
    }

    const merged =
      section === "pinned"
        ? mergeReorderedPinnedTasks(tasks, taskIds)
        : mergeReorderedUnpinnedTasks(tasks, taskIds);

    const orderedIds = merged.map((task) => task.id);

    await prisma.$transaction(
      orderedIds.map((id, position) =>
        prisma.task.update({
          where: { id },
          data: { position },
        }),
      ),
    );

    revalidatePath("/");

    return jsonWithCors({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to reorder tasks";
    console.error("Failed to reorder tasks for mobile API:", error);
    return jsonWithCors({ error: message }, { status: 500 });
  }
}

export function OPTIONS() {
  return optionsWithCors();
}
