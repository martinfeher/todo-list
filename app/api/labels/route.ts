import { prisma } from "@/lib/prisma";
import { LABEL_CATEGORY } from "@/lib/task-tags";
import { jsonWithCors, optionsWithCors } from "@/lib/api-cors";

export async function GET() {
  const labels = await prisma.tag.findMany({
    where: { category: LABEL_CATEGORY },
    orderBy: { label: "asc" },
    select: { id: true, label: true },
  });

  return jsonWithCors({ labels });
}

export function OPTIONS() {
  return optionsWithCors();
}
