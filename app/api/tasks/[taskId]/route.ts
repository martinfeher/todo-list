import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { jsonWithCors, optionsWithCors } from "@/lib/api-cors";
import { LABEL_CATEGORY } from "@/lib/task-tags";
import { normalizeDueTimeZone } from "@/lib/task-due-time";
import { getPriorityFromTaskTags } from "@/lib/task-tags";

type RouteContext = {
  params: Promise<{ taskId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { taskId } = await context.params;

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      name: true,
      completed: true,
      details: true,
      dueDate: true,
      dueTimeMinutes: true,
      dueDurationMinutes: true,
      dueTimeZone: true,
      important: true,
      pinned: true,
      list: {
        select: {
          id: true,
          name: true,
        },
      },
      tags: {
        include: {
          tag: {
            select: { id: true, label: true, category: true, level: true },
          },
        },
        orderBy: {
          tag: { label: "asc" },
        },
      },
    },
  });

  if (!task) {
    return jsonWithCors({ error: "Task not found" }, { status: 404 });
  }

  return jsonWithCors({
    id: task.id,
    name: task.name,
    completed: task.completed,
    details: task.details,
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    dueTimeMinutes: task.dueTimeMinutes,
    dueDurationMinutes: task.dueDurationMinutes,
    dueTimeZone: normalizeDueTimeZone(task.dueTimeZone),
    important: task.important,
    pinned: task.pinned,
    priority: getPriorityFromTaskTags(task.tags),
    listId: task.list.id,
    listName: task.list.name,
    labels: task.tags
      .filter((entry) => entry.tag.category === LABEL_CATEGORY)
      .map((entry) => ({ id: entry.tag.id, label: entry.tag.label })),
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { taskId } = await context.params;

  let body: { completed?: boolean; important?: boolean };
  try {
    body = (await request.json()) as { completed?: boolean; important?: boolean };
  } catch {
    return jsonWithCors({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.completed === undefined && body.important === undefined) {
    return jsonWithCors(
      { error: "Provide completed and/or important" },
      { status: 400 },
    );
  }

  if (body.completed !== undefined && typeof body.completed !== "boolean") {
    return jsonWithCors({ error: "completed must be a boolean" }, { status: 400 });
  }

  if (body.important !== undefined && typeof body.important !== "boolean") {
    return jsonWithCors({ error: "important must be a boolean" }, { status: 400 });
  }

  const existing = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true },
  });

  if (!existing) {
    return jsonWithCors({ error: "Task not found" }, { status: 404 });
  }

  const task = await prisma.task.update({
    where: { id: taskId },
    data: {
      ...(body.completed !== undefined ? { completed: body.completed } : {}),
      ...(body.important !== undefined ? { important: body.important } : {}),
    },
    select: {
      id: true,
      name: true,
      completed: true,
      important: true,
      dueDate: true,
    },
  });

  revalidatePath("/");

  return jsonWithCors({
    ...task,
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
  });
}

export function OPTIONS() {
  return optionsWithCors();
}
