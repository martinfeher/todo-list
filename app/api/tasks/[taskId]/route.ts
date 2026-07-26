import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...task,
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    dueTimeZone: normalizeDueTimeZone(task.dueTimeZone),
  });
}
