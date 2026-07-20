-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'priority',
    "level" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "TaskTag" (
    "taskId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("taskId", "tagId"),
    CONSTRAINT "TaskTag_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

-- Seed priority tags
INSERT INTO "Tag" ("id", "slug", "label", "category", "level") VALUES
    ('tag-priority-1', 'priority-1', 'Priority 1', 'priority', 1),
    ('tag-priority-2', 'priority-2', 'Priority 2', 'priority', 2),
    ('tag-priority-3', 'priority-3', 'Priority 3', 'priority', 3),
    ('tag-priority-4', 'priority-4', 'Priority 4', 'priority', 4);

-- Migrate existing Task.priority values into TaskTag rows
INSERT INTO "TaskTag" ("taskId", "tagId")
SELECT "id", 'tag-priority-' || "priority"
FROM "Task"
WHERE "priority" IS NOT NULL AND "priority" BETWEEN 1 AND 4;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "details" TEXT NOT NULL DEFAULT '',
    "dueDate" DATETIME,
    "position" INTEGER NOT NULL DEFAULT 0,
    "listId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Task_listId_fkey" FOREIGN KEY ("listId") REFERENCES "TodoList" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("id", "name", "completed", "details", "dueDate", "position", "listId", "createdAt", "updatedAt") SELECT "id", "name", "completed", "details", "dueDate", "position", "listId", "createdAt", "updatedAt" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
