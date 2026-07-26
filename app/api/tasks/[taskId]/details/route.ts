import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cleanupOrphanedTaskImages } from "@/lib/task-image-storage";

type RouteContext = {
  params: Promise<{ taskId: string }>;
};

export async function PUT(request: Request, context: RouteContext) {
  const { taskId } = await context.params;

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as { details?: unknown }).details !== "string"
  ) {
    return NextResponse.json({ error: "Invalid details payload" }, { status: 400 });
  }

  const { details } = body as { details: string };

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true },
  });

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  await prisma.task.update({
    where: { id: taskId },
    data: { details },
  });

  await cleanupOrphanedTaskImages(taskId, details);

  return NextResponse.json({ ok: true });
}
