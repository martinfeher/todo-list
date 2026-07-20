-- AlterTable
ALTER TABLE "Task" ADD COLUMN "dueTimeMinutes" INTEGER;
ALTER TABLE "Task" ADD COLUMN "dueDurationMinutes" INTEGER;
ALTER TABLE "Task" ADD COLUMN "dueTimeZone" TEXT NOT NULL DEFAULT 'floating';
