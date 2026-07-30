export async function fetchLastSearchQuery(): Promise<string> {
  const response = await fetch("/api/search-settings");

  if (!response.ok) {
    throw new Error("Failed to load last search query");
  }

  const data = (await response.json()) as { query?: string };
  return typeof data.query === "string" ? data.query : "";
}

export async function saveLastSearchQuery(query: string): Promise<void> {
  const response = await fetch("/api/search-settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    throw new Error("Failed to save last search query");
  }
}
