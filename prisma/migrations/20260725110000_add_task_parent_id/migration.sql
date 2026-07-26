-- AlterTable
ALTER TABLE "Task" ADD COLUMN "parentId" TEXT;

-- CreateIndex
CREATE INDEX "Task_parentId_idx" ON "Task"("parentId");
