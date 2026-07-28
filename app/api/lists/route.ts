import { getSidebarApiData } from "@/lib/mobile-api-data";
import { jsonWithCors, optionsWithCors } from "@/lib/api-cors";

export async function GET() {
  try {
    const data = await getSidebarApiData();
    return jsonWithCors(data);
  } catch (error) {
    console.error("Failed to load lists for mobile API:", error);
    return jsonWithCors({ error: "Failed to load lists" }, { status: 500 });
  }
}

export function OPTIONS() {
  return optionsWithCors();
}
