import { prisma } from "@/lib/prisma";

export const LAST_SEARCH_QUERY_KEY = "search.lastQuery";

export async function getLastSearchQuery() {
  const setting = await prisma.appSetting.findUnique({
    where: { key: LAST_SEARCH_QUERY_KEY },
    select: { value: true },
  });

  return setting?.value ?? "";
}

export async function setLastSearchQuery(query: string) {
  await prisma.appSetting.upsert({
    where: { key: LAST_SEARCH_QUERY_KEY },
    create: { key: LAST_SEARCH_QUERY_KEY, value: query },
    update: { value: query },
  });
}
