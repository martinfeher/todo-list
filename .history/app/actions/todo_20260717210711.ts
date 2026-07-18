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
    },
  });
}

export async function updateTaskDetails(taskId: string, details: string) {
  
  await prisma.task.update({
    where: { id: taskId },
    data: { details },
  });
}

export async function createTodoList(name: string) {
  const list = await prisma.todoList.create({
    data: { name },
  });

  revalidatePath("/");
  return list;
}

export async function createTask(listId: string, name: string) {
  const task = await prisma.task.create({
    data: { listId, name },
  });

  revalidatePath("/");
  return task;
}

export async function toggleTask(taskId: string, completed: boolean) {
  await prisma.task.update({
    where: { id: taskId },
    data: { completed },
  });

  revalidatePath("/");
}
