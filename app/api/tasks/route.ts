import { getTasksApiData, type TasksQuery } from "@/lib/mobile-api-data";
import { jsonWithCors, optionsWithCors } from "@/lib/api-cors";

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

export function OPTIONS() {
  return optionsWithCors();
}
