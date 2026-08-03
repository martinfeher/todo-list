import { jsonWithCors, optionsWithCors } from "@/lib/api-cors";
import {
  getLastSearchQuery,
  setLastSearchQuery,
} from "@/lib/search-settings";

export async function GET() {
  try {
    const query = await getLastSearchQuery();
    return jsonWithCors({ query });
  } catch (error) {
    console.error("Failed to load last search query:", error);
    return jsonWithCors(
      { error: "Failed to load last search query" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonWithCors({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as { query?: unknown }).query !== "string"
  ) {
    return jsonWithCors({ error: "Invalid query payload" }, { status: 400 });
  }

  const { query } = body as { query: string };

  try {
    await setLastSearchQuery(query);
    return jsonWithCors({ ok: true });
  } catch (error) {
    console.error("Failed to save last search query:", error);
    return jsonWithCors(
      { error: "Failed to save last search query" },
      { status: 500 },
    );
  }
}

export async function OPTIONS() {
  return optionsWithCors();
}
