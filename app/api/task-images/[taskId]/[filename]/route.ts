import { NextResponse } from "next/server";
import {
  getMimeTypeForFilename,
  readTaskImageFile,
} from "@/lib/task-image-storage";

type RouteContext = {
  params: Promise<{ taskId: string; filename: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { taskId, filename } = await context.params;

  try {
    const buffer = await readTaskImageFile(taskId, filename);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": getMimeTypeForFilename(filename),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }
}
