import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { jsonWithCors, optionsWithCors } from "@/lib/api-cors";
import { normalizeDueTimeZone } from "@/lib/task-due-time";

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
    },
  });

  if (!task) {
    return jsonWithCors({ error: "Task not found" }, { status: 404 });
  }

  return jsonWithCors({
    ...task,
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    dueTimeZone: normalizeDueTimeZone(task.dueTimeZone),
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { taskId } = await context.params;

  let body: { completed?: boolean };
  try {
    body = (await request.json()) as { completed?: boolean };
  } catch {
    return jsonWithCors({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.completed !== "boolean") {
    return jsonWithCors({ error: "completed must be a boolean" }, { status: 400 });
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
    data: { completed: body.completed },
    select: {
      id: true,
      name: true,
      completed: true,
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
