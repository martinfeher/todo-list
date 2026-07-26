import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { Prisma, PrismaClient } from "@/app/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const PRISMA_CLIENT_VERSION = "task-bookmarked-v2";

function assertGeneratedClientSupportsSchema() {
  if (!("bookmarked" in Prisma.TaskScalarFieldEnum)) {
    throw new Error(
      "Prisma client is out of date. Run: npx prisma generate",
    );
  }
}

function createPrismaClient() {
  assertGeneratedClientSupportsSchema();

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
