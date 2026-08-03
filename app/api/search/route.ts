import { prisma } from "@/lib/prisma";
import { jsonWithCors, optionsWithCors } from "@/lib/api-cors";
import { seedIfEmpty } from "@/lib/todo-data";
import { taskDetailsHasContent } from "@/lib/task-details-content";

export async function GET() {
  try {
    await seedIfEmpty();

    const lists = await prisma.todoList.findMany({
      select: {
        id: true,
        name: true,
        tasks: {
          orderBy: [{ position: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            name: true,
            completed: true,
            details: true,
            dueDate: true,
            pinned: true,
            important: true,
            parentId: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const tasks = lists.flatMap((list) =>
      list.tasks.map((task) => ({
        id: task.id,
        name: task.name,
        completed: task.completed,
        details: task.details,
        hasDetails: taskDetailsHasContent(task.details),
        dueDate: task.dueDate ? task.dueDate.toISOString() : null,
        pinned: task.pinned,
        important: task.important,
        parentId: task.parentId,
        listId: list.id,
        listName: list.name,
      })),
    );

    return jsonWithCors({ tasks });
  } catch (error) {
    console.error("Failed to load search tasks:", error);
    return jsonWithCors({ error: "Failed to load search tasks" }, { status: 500 });
  }
}

export async function OPTIONS() {
  return optionsWithCors();
}
