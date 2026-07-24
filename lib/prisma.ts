import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/app/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const PRISMA_CLIENT_VERSION = "task-pinned-v1";

function createPrismaClient() {
  const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
  });

  const client = new PrismaClient({ adapter });
  (
    client as PrismaClient & {
      __clientVersion?: string;
    }
  ).__clientVersion = PRISMA_CLIENT_VERSION;

  return client;
}

function isPrismaClientCurrent(client: PrismaClient) {
  return (
    "tag" in client &&
    "taskTag" in client &&
    (client as PrismaClient & { __clientVersion?: string }).__clientVersion ===
      PRISMA_CLIENT_VERSION
  );
}

function getPrismaClient() {
  const cached = globalForPrisma.prisma;

  if (cached && isPrismaClientCurrent(cached)) {
    return cached;
  }

  const client = createPrismaClient();

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }

  return client;
}

export const prisma = getPrismaClient();
