import { NextResponse } from "next/server";
import {
  getLastSearchQuery,
  setLastSearchQuery,
} from "@/lib/search-settings";

export async function GET() {
  try {
    const query = await getLastSearchQuery();
    return NextResponse.json({ query });
  } catch (error) {
    console.error("Failed to load last search query:", error);
    return NextResponse.json(
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
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as { query?: unknown }).query !== "string"
  ) {
    return NextResponse.json({ error: "Invalid query payload" }, { status: 400 });
  }

  const { query } = body as { query: string };

  try {
    await setLastSearchQuery(query);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to save last search query:", error);
    return NextResponse.json(
      { error: "Failed to save last search query" },
      { status: 500 },
    );
  }
}
