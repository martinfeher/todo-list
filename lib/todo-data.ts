import { prisma } from "@/lib/prisma";
import {
  getLabelsFromTaskTags,
  getPriorityFromTaskTags,
  LABEL_CATEGORY,
  PRIORITY_TAG_CATEGORY,
  PRIORITY_TAGS,
} from "@/lib/task-tags";
import { normalizeDueTimeZone } from "@/lib/task-due-time";

async function ensurePriorityTags() {
  await Promise.all(
    PRIORITY_TAGS.map((tag) =>
      prisma.tag.upsert({
        where: { slug: tag.slug },
        create: {
          id: `tag-${tag.slug}`,
          slug: tag.slug,
          label: tag.label,
          category: PRIORITY_TAG_CATEGORY,
          level: tag.level,
        },
        update: {
          label: tag.label,
          level: tag.level,
        },
      }),
    ),
  );
}

export async function seedIfEmpty() {
  const count = await prisma.todoList.count();
  if (count > 0) return;

  await prisma.todoList.createMany({
    data: [
      { id: "1", name: "Work" },
      { id: "2", name: "Personal" },
      { id: "3", name: "Shopping" },
    ],
  });

  await prisma.task.createMany({
    data: [
      {
        id: "t1",
        name: "Review pull request",
        completed: false,
        details: "",
        position: 0,
        listId: "1",
      },
      {
        id: "t2",
        name: "Send weekly update",
        completed: true,
        details: "",
        position: 1,
        listId: "1",
      },
      {
        id: "t3",
        name: "Buy groceries",
        completed: false,
        details: "",
        position: 0,
        listId: "2",
      },
    ],
  });
}

export async function getTodoData() {
  await seedIfEmpty();
  await ensurePriorityTags();

  const detailFlags = await prisma.$queryRaw<Array<{ id: string; hasDetails: number }>>`
    SELECT
      id,
      CASE
        WHEN trim(details) = '' THEN 0
        WHEN trim(details) IN ('<br>', '<div><br></div>', '<p><br></p>') THEN 0
        ELSE 1
      END AS hasDetails
    FROM Task
  `;
  const hasDetailsByTaskId = Object.fromEntries(
    detailFlags.map((row) => [row.id, Boolean(row.hasDetails)]),
  );

  const lists = await prisma.todoList.findMany({
    include: {
      tasks: {
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          name: true,
          completed: true,
          dueDate: true,
          dueTimeMinutes: true,
          dueDurationMinutes: true,
          dueTimeZone: true,
          pinned: true,
          parentId: true,
          tags: {
            include: { tag: true },
          },
        },
      },
    },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });

  return {
    lists: lists.map(({ id, name }) => ({ id, name })),
    labels: await prisma.tag.findMany({
      where: { category: LABEL_CATEGORY },
      orderBy: { label: "asc" },
      select: { id: true, label: true },
    }),
    tasksByList: Object.fromEntries(
      lists.map((list) => [
        list.id,
        list.tasks.map(
          ({
            id,
            name,
            completed,
            dueDate,
            dueTimeMinutes,
            dueDurationMinutes,
            dueTimeZone,
            tags,
            pinned,
            parentId,
          }) => ({
          id,
          name,
          completed,
          details: "",
          hasDetails: hasDetailsByTaskId[id] ?? false,
          dueDate: dueDate ? dueDate.toISOString() : null,
          dueTimeMinutes,
          dueDurationMinutes,
          dueTimeZone: normalizeDueTimeZone(dueTimeZone),
          priority: getPriorityFromTaskTags(tags),
          labels: getLabelsFromTaskTags(tags),
          pinned: Boolean(pinned),
          parentId: parentId ?? null,
        }),
        ),
      ]),
    ),
  };
}
