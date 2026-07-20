"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  normalizeDueDurationMinutes,
  normalizeDueTimeMinutes,
  normalizeDueTimeZone,
  type TaskDueTime,
} from "@/lib/task-due-time";
import {
  normalizePriority,
  PRIORITY_TAG_CATEGORY,
  prioritySlug,
} from "@/lib/task-tags";
import {
  cleanupOrphanedTaskImages,
  deleteTaskImageDirectory,
} from "@/lib/task-image-storage";

export async function getTaskById(taskId: string) {
  return prisma.task.findUnique({
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
}

export async function updateTaskDetails(taskId: string, details: string) {
  await prisma.task.update({
    where: { id: taskId },
    data: { details },
  });

  await cleanupOrphanedTaskImages(taskId, details);
}

export async function updateTaskDueDate(taskId: string, dueDate: string | null) {
  const existing = await prisma.task.findUnique({
    where: { id: taskId },
    select: { dueDate: true },
  });

  const existingDateValue = existing?.dueDate
    ? existing.dueDate.toISOString().slice(0, 10)
    : null;
  const dateChanged = dueDate !== existingDateValue;

  const task = await prisma.task.update({
    where: { id: taskId },
    data: {
      dueDate: dueDate ? new Date(`${dueDate}T12:00:00`) : null,
      ...(dateChanged
        ? {
            dueTimeMinutes: null,
            dueDurationMinutes: null,
            dueTimeZone: "floating",
          }
        : {}),
    },
    select: {
      id: true,
      dueDate: true,
      dueTimeMinutes: true,
      dueDurationMinutes: true,
      dueTimeZone: true,
    },
  });

  revalidatePath("/");
  return {
    id: task.id,
    dueDate: task.dueDate,
    dueTimeMinutes: task.dueTimeMinutes,
    dueDurationMinutes: task.dueDurationMinutes,
    dueTimeZone: normalizeDueTimeZone(task.dueTimeZone),
  };
}

export async function updateTaskDueTime(taskId: string, dueTime: TaskDueTime) {
  const task = await prisma.task.update({
    where: { id: taskId },
    data: {
      dueTimeMinutes: normalizeDueTimeMinutes(dueTime.dueTimeMinutes),
      dueDurationMinutes: normalizeDueDurationMinutes(dueTime.dueDurationMinutes),
      dueTimeZone: normalizeDueTimeZone(dueTime.dueTimeZone),
    },
    select: {
      id: true,
      dueTimeMinutes: true,
      dueDurationMinutes: true,
      dueTimeZone: true,
    },
  });

  revalidatePath("/");
  return {
    id: task.id,
    dueTimeMinutes: task.dueTimeMinutes,
    dueDurationMinutes: task.dueDurationMinutes,
    dueTimeZone: normalizeDueTimeZone(task.dueTimeZone),
  };
}

export async function updateTaskPriority(taskId: string, priority: number | null) {
  const normalizedPriority = normalizePriority(priority);

  await prisma.$transaction(async (tx) => {
    await tx.taskTag.deleteMany({
      where: {
        taskId,
        tag: { category: PRIORITY_TAG_CATEGORY },
      },
    });

    if (normalizedPriority !== null) {
      const tag = await tx.tag.findUnique({
        where: { slug: prioritySlug(normalizedPriority) },
        select: { id: true },
      });

      if (!tag) {
        throw new Error(`Missing priority tag: ${prioritySlug(normalizedPriority)}`);
      }

      await tx.taskTag.create({
        data: {
          taskId,
          tagId: tag.id,
        },
      });
    }
  });

  revalidatePath("/");
  return {
    id: taskId,
    priority: normalizedPriority,
  };
}

export async function renameTask(taskId: string, name: string) {
  const task = await prisma.task.update({
    where: { id: taskId },
    data: { name: name.trim() },
  });

  revalidatePath("/");
  return task;
}

export async function renameTodoList(listId: string, name: string) {
  const list = await prisma.todoList.update({
    where: { id: listId },
    data: { name: name.trim() },
  });

  revalidatePath("/");
  return list;
}

export async function deleteTodoList(listId: string) {
  const tasks = await prisma.task.findMany({
    where: { listId },
    select: { id: true },
  });

  await prisma.todoList.delete({
    where: { id: listId },
  });

  await Promise.all(tasks.map((task) => deleteTaskImageDirectory(task.id)));

  revalidatePath("/");
}

export async function createTodoList(name: string) {
  const list = await prisma.todoList.create({
    data: { name },
  });

  revalidatePath("/");
  return list;
}

export async function createTask(listId: string, name: string) {
  const lastTask = await prisma.task.findFirst({
    where: { listId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const task = await prisma.task.create({
    data: {
      listId,
      name,
      position: (lastTask?.position ?? -1) + 1,
    },
  });

  revalidatePath("/");
  return task;
}

export async function reorderTasks(listId: string, taskIds: string[]) {
  const tasks = await prisma.task.findMany({
    where: { listId },
    select: { id: true },
  });

  const validIds = new Set(tasks.map((task) => task.id));
  const orderedIds = taskIds.filter((id) => validIds.has(id));

  if (orderedIds.length !== tasks.length) {
    throw new Error("Invalid task order payload");
  }

  await prisma.$transaction(
    orderedIds.map((id, position) =>
      prisma.task.update({
        where: { id },
        data: { position },
      }),
    ),
  );

  revalidatePath("/");
}

export async function toggleTask(taskId: string, completed: boolean) {
  await prisma.task.update({
    where: { id: taskId },
    data: { completed },
  });

  revalidatePath("/");
}
