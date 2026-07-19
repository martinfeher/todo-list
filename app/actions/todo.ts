"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function getTaskById(taskId: string) {
  return prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      name: true,
      completed: true,
      details: true,
      dueDate: true,
    },
  });
}

export async function updateTaskDetails(taskId: string, details: string) {
  await prisma.task.update({
    where: { id: taskId },
    data: { details },
  });
}

export async function updateTaskDueDate(taskId: string, dueDate: string | null) {
  const task = await prisma.task.update({
    where: { id: taskId },
    data: {
      dueDate: dueDate ? new Date(`${dueDate}T12:00:00`) : null,
    },
    select: {
      id: true,
      dueDate: true,
    },
  });

  revalidatePath("/");
  return task;
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
  await prisma.todoList.delete({
    where: { id: listId },
  });

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
