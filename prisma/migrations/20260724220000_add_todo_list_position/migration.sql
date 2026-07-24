-- AlterTable
ALTER TABLE "TodoList" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;

-- Backfill positions from creation order
UPDATE "TodoList"
SET "position" = (
  SELECT COUNT(*)
  FROM "TodoList" AS "other"
  WHERE "other"."createdAt" < "TodoList"."createdAt"
     OR ("other"."createdAt" = "TodoList"."createdAt" AND "other"."id" < "TodoList"."id")
);
