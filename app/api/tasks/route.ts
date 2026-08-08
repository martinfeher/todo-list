import { revalidatePath } from "next/cache";
import { getTasksApiData, type TasksQuery } from "@/lib/mobile-api-data";
import { jsonWithCors, optionsWithCors } from "@/lib/api-cors";
import { prisma } from "@/lib/prisma";

function parseTasksQuery(searchParams: URLSearchParams): TasksQuery | null {
  const view = searchParams.get("view");
  const listId = searchParams.get("listId");
  const labelId = searchParams.get("labelId");

  if (listId) {
    return { view: "list", listId };
  }

  if (view === "today") {
    return { view: "today" };
  }

  if (view === "important") {
    return { view: "important" };
  }

  if (view === "calendar") {
    return { view: "calendar" };
  }

  if (view === "label" && labelId) {
    return { view: "label", labelId };
  }

  return null;
}

export async function GET(request: Request) {
  const query = parseTasksQuery(new URL(request.url).searchParams);

  if (!query) {
    return jsonWithCors(
      { error: "Provide listId or view query parameter" },
      { status: 400 },
    );
  }

  try {
    const data = await getTasksApiData(query);
    return jsonWithCors(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load tasks";
    const status = message.endsWith("not found") ? 404 : 500;
    console.error("Failed to load tasks for mobile API:", error);
    return jsonWithCors({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  let body: { name?: string; listId?: string; dueDate?: string | null };
  try {
    body = (await request.json()) as {
      name?: string;
      listId?: string;
      dueDate?: string | null;
    };
  } catch {
    return jsonWithCors({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = body.name?.trim() ?? "";
  const listId = body.listId?.trim() ?? "";
  const dueDate = body.dueDate?.trim() || null;

  if (!name) {
    return jsonWithCors({ error: "name is required" }, { status: 400 });
  }

  if (!listId) {
    return jsonWithCors({ error: "listId is required" }, { status: 400 });
  }

  const list = await prisma.todoList.findUnique({
    where: { id: listId },
    select: { id: true, name: true },
  });

  if (!list) {
    return jsonWithCors({ error: "List not found" }, { status: 404 });
  }

  try {
    const task = await prisma.$transaction(async (tx) => {
      await tx.task.updateMany({
        where: { listId },
        data: { position: { increment: 1 } },
      });

      return tx.task.create({
        data: {
          listId,
          name,
          position: 0,
          important: false,
          dueDate: dueDate ? new Date(`${dueDate}T12:00:00`) : null,
        },
      });
    });

    revalidatePath("/");

    return jsonWithCors(
      {
        id: task.id,
        name: task.name,
        completed: task.completed,
        dueDate: task.dueDate ? task.dueDate.toISOString() : null,
        pinned: task.pinned,
        important: task.important,
        priority: null,
        parentId: task.parentId,
        depth: 0,
        labels: [],
        listId: list.id,
        listName: list.name,
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create task";
    console.error("Failed to create task for mobile API:", error);
    return jsonWithCors({ error: message }, { status: 500 });
  }
}

export function OPTIONS() {
  return optionsWithCors();
}
