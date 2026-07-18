import { prisma } from "@/lib/prisma";

export async function seedIfEmpty() {
  const count = await prisma.todoList.count();
  if (count > 0) return;

  await prisma.todoList.createMany({
    data: [
      { id: "1", name: "Work" },
      { id: "2", name: "Personal" },
      { id: "3", name: "Shopping" },
    ],
  });

  await prisma.task.createMany({
    data: [
      {
        id: "t1",
        name: "Review pull request",
        completed: false,
        details: "",
        listId: "1",
      },
      {
        id: "t2",
        name: "Send weekly update",
        completed: true,
        details: "",
        listId: "1",
      },
      {
        id: "t3",
        name: "Buy groceries",
        completed: false,
        details: "",
        listId: "2",
      },
    ],
  });
}

export async function getTodoData() {
  await seedIfEmpty();

  const lists = await prisma.todoList.findMany({
    include: { tasks: { orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "asc" },
  });

  return {
    lists: lists.map(({ id, name }) => ({ id, name })),
    tasksByList: Object.fromEntries(
      lists.map((list) => [
        list.id,
        list.tasks.map(({ id, name, completed, details }) => ({
          id,
          name,
          completed,
          details,
        })),
      ]),
    ),
  };
}
