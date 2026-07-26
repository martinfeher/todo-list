"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  normalizeDueDurationMinutes,
  normalizeDueTimeMinutes,
  normalizeDueTimeZone,
  type TaskDueTime,
} from "@/lib/task-due-time";
import {
  LABEL_CATEGORY,
  labelSlug,
  normalizePriority,
  PRIORITY_TAG_CATEGORY,
  prioritySlug,
} from "@/lib/task-tags";
import {
  cleanupOrphanedTaskImages,
  deleteTaskImageDirectory,
  referencedTaskImagesChanged,
} from "@/lib/task-image-storage";

export async function getTaskById(taskId: string) {
  return prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      name: true,
      completed: true,
      details: true,
      dueDate: true,
      dueTimeMinutes: true,
      dueDurationMinutes: true,
      dueTimeZone: true,
    },
  });
}

export async function updateTaskDetails(taskId: string, details: string) {
  const existing = await prisma.task.findUnique({
    where: { id: taskId },
    select: { details: true },
  });

  if (!existing) {
    throw new Error("Task not found");
  }

  if (existing.details === details) {
    return;
  }

  await prisma.task.update({
    where: { id: taskId },
    data: { details },
  });

  if (referencedTaskImagesChanged(taskId, existing.details, details)) {
    await cleanupOrphanedTaskImages(taskId, details);
  }
}

export async function updateTaskDueDate(taskId: string, dueDate: string | null) {
  const existing = await prisma.task.findUnique({
    where: { id: taskId },
    select: { dueDate: true },
  });

  const existingDateValue = existing?.dueDate
    ? existing.dueDate.toISOString().slice(0, 10)
    : null;
  const dateChanged = dueDate !== existingDateValue;

  const task = await prisma.task.update({
    where: { id: taskId },
    data: {
      dueDate: dueDate ? new Date(`${dueDate}T12:00:00`) : null,
      ...(dateChanged
        ? {
            dueTimeMinutes: null,
            dueDurationMinutes: null,
            dueTimeZone: "floating",
          }
        : {}),
    },
    select: {
      id: true,
      dueDate: true,
      dueTimeMinutes: true,
      dueDurationMinutes: true,
      dueTimeZone: true,
    },
  });

  revalidatePath("/");
  return {
    id: task.id,
    dueDate: task.dueDate,
    dueTimeMinutes: task.dueTimeMinutes,
    dueDurationMinutes: task.dueDurationMinutes,
    dueTimeZone: normalizeDueTimeZone(task.dueTimeZone),
  };
}

export async function updateTaskDueTime(taskId: string, dueTime: TaskDueTime) {
  const task = await prisma.task.update({
    where: { id: taskId },
    data: {
      dueTimeMinutes: normalizeDueTimeMinutes(dueTime.dueTimeMinutes),
      dueDurationMinutes: normalizeDueDurationMinutes(dueTime.dueDurationMinutes),
      dueTimeZone: normalizeDueTimeZone(dueTime.dueTimeZone),
    },
    select: {
      id: true,
      dueTimeMinutes: true,
      dueDurationMinutes: true,
      dueTimeZone: true,
    },
  });

  revalidatePath("/");
  return {
    id: task.id,
    dueTimeMinutes: task.dueTimeMinutes,
    dueDurationMinutes: task.dueDurationMinutes,
    dueTimeZone: normalizeDueTimeZone(task.dueTimeZone),
  };
}

export async function updateTaskPriority(taskId: string, priority: number | null) {
  const normalizedPriority = normalizePriority(priority);

  await prisma.$transaction(async (tx) => {
    await tx.taskTag.deleteMany({
      where: {
        taskId,
        tag: { category: PRIORITY_TAG_CATEGORY },
      },
    });

    if (normalizedPriority !== null) {
      const tag = await tx.tag.findUnique({
        where: { slug: prioritySlug(normalizedPriority) },
        select: { id: true },
      });

      if (!tag) {
        throw new Error(`Missing priority tag: ${prioritySlug(normalizedPriority)}`);
      }

      await tx.taskTag.create({
        data: {
          taskId,
          tagId: tag.id,
        },
      });
    }
  });

  revalidatePath("/");
  return {
    id: taskId,
    priority: normalizedPriority,
  };
}

export async function getLabels() {
  return prisma.tag.findMany({
    where: { category: LABEL_CATEGORY },
    orderBy: { label: "asc" },
    select: {
      id: true,
      label: true,
    },
  });
}

export async function getTaskLabels(taskId: string) {
  const entries = await prisma.taskTag.findMany({
    where: {
      taskId,
      tag: { category: LABEL_CATEGORY },
    },
    include: {
      tag: {
        select: {
          id: true,
          label: true,
        },
      },
    },
    orderBy: {
      tag: { label: "asc" },
    },
  });

  return entries.map((entry) => entry.tag);
}

export async function createLabel(label: string) {
  const trimmed = label.trim();
  if (!trimmed) {
    throw new Error("Label is required");
  }

  const slug = labelSlug(trimmed);
  const tag = await prisma.tag.upsert({
    where: { slug },
    create: {
      slug,
      label: trimmed,
      category: LABEL_CATEGORY,
    },
    update: {
      label: trimmed,
    },
    select: {
      id: true,
      label: true,
    },
  });

  revalidatePath("/");
  return tag;
}

export async function applyTaskLabels(
  taskId: string,
  labelIds: string[],
  newLabelName?: string | null,
) {
  const uniqueLabelIds = new Set(labelIds);

  if (newLabelName?.trim()) {
    const trimmed = newLabelName.trim();
    const slug = labelSlug(trimmed);
    const tag = await prisma.tag.upsert({
      where: { slug },
      create: {
        slug,
        label: trimmed,
        category: LABEL_CATEGORY,
      },
      update: {
        label: trimmed,
      },
      select: { id: true },
    });
    uniqueLabelIds.add(tag.id);
  }

  if (uniqueLabelIds.size === 0) {
    throw new Error("Select or type at least one label");
  }

  await prisma.$transaction(
    [...uniqueLabelIds].map((tagId) =>
      prisma.taskTag.upsert({
        where: {
          taskId_tagId: {
            taskId,
            tagId,
          },
        },
        create: {
          taskId,
          tagId,
        },
        update: {},
      }),
    ),
  );

  revalidatePath("/");
  return getTaskLabels(taskId);
}

export async function setTaskLabel(
  taskId: string,
  labelId: string,
  assigned: boolean,
) {
  if (assigned) {
    await prisma.taskTag.upsert({
      where: {
        taskId_tagId: {
          taskId,
          tagId: labelId,
        },
      },
      create: {
        taskId,
        tagId: labelId,
      },
      update: {},
    });
  } else {
    await prisma.taskTag.deleteMany({
      where: {
        taskId,
        tagId: labelId,
        tag: { category: LABEL_CATEGORY },
      },
    });
  }

  revalidatePath("/");
  return getTaskLabels(taskId);
}

export async function addTaskLabel(taskId: string, label: string) {
  const trimmed = label.trim();
  if (!trimmed) {
    throw new Error("Label is required");
  }

  const slug = labelSlug(trimmed);

  await prisma.$transaction(async (tx) => {
    const tag = await tx.tag.upsert({
      where: { slug },
      create: {
        slug,
        label: trimmed,
        category: LABEL_CATEGORY,
      },
      update: {
        label: trimmed,
      },
      select: { id: true },
    });

    await tx.taskTag.upsert({
      where: {
        taskId_tagId: {
          taskId,
          tagId: tag.id,
        },
      },
      create: {
        taskId,
        tagId: tag.id,
      },
      update: {},
    });
  });

  revalidatePath("/");
  return { id: taskId, label: trimmed };
}

export async function updateTaskPinned(taskId: string, pinned: boolean) {
  const task = await prisma.task.update({
    where: { id: taskId },
    data: { pinned },
    select: { id: true, pinned: true },
  });

  revalidatePath("/");
  return task;
}

export async function updateTaskImportant(taskId: string, important: boolean) {
  const task = await prisma.task.update({
    where: { id: taskId },
    data: { important },
    select: { id: true, important: true },
  });

  revalidatePath("/");
  return task;
}

export async function renameTask(taskId: string, name: string) {
  const task = await prisma.task.update({
    where: { id: taskId },
    data: { name: name.trim() },
  });

  revalidatePath("/");
  return task;
}

export async function renameTodoList(listId: string, name: string) {
  const list = await prisma.todoList.update({
    where: { id: listId },
    data: { name: name.trim() },
  });

  revalidatePath("/");
  return list;
}

export async function deleteTodoList(listId: string) {
  const tasks = await prisma.task.findMany({
    where: { listId },
    select: { id: true },
  });

  await prisma.todoList.delete({
    where: { id: listId },
  });

  await Promise.all(tasks.map((task) => deleteTaskImageDirectory(task.id)));

  revalidatePath("/");
}

export async function createTodoList(name: string) {
  const list = await prisma.$transaction(async (tx) => {
    const aggregate = await tx.todoList.aggregate({
      _max: { position: true },
    });
    const position = (aggregate._max.position ?? -1) + 1;

    return tx.todoList.create({
      data: {
        name,
        position,
      },
    });
  });

  revalidatePath("/");
  return list;
}

export async function reorderTodoLists(listIds: string[]) {
  const lists = await prisma.todoList.findMany({
    select: { id: true },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });

  const validIds = new Set(lists.map((list) => list.id));
  const seen = new Set<string>();
  const orderedIds: string[] = [];

  for (const id of listIds) {
    if (!validIds.has(id) || seen.has(id)) continue;
    orderedIds.push(id);
    seen.add(id);
  }

  for (const list of lists) {
    if (!seen.has(list.id)) {
      orderedIds.push(list.id);
      seen.add(list.id);
    }
  }

  if (orderedIds.length !== lists.length) {
    throw new Error("Invalid list order payload");
  }

  await prisma.$transaction(
    orderedIds.map((id, position) =>
      prisma.todoList.update({
        where: { id },
        data: { position },
      }),
    ),
  );

  revalidatePath("/");
}

export async function createTask(
  listId: string,
  name: string,
  dueDate?: string | null,
) {
  const task = await prisma.$transaction(async (tx) => {
    await tx.task.updateMany({
      where: { listId },
      data: { position: { increment: 1 } },
    });

    return tx.task.create({
      data: {
        listId,
        name,
        position: 0,
        important: false,
        dueDate: dueDate ? new Date(`${dueDate}T12:00:00`) : null,
      },
    });
  });

  revalidatePath("/");
  return task;
}

export async function moveTaskToList(taskId: string, targetListId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { listId: true, parentId: true },
  });

  if (!task || task.listId === targetListId) {
    return;
  }

  const sourceListId = task.listId;
  const childIds = task.parentId
    ? []
    : (
        await prisma.task.findMany({
          where: { parentId: taskId },
          select: { id: true },
        })
      ).map((child) => child.id);
  const movingIds = [taskId, ...childIds];

  await prisma.$transaction(async (tx) => {
    await tx.task.updateMany({
      where: { listId: targetListId },
      data: { position: { increment: movingIds.length } },
    });

    await Promise.all(
      movingIds.map((id, position) =>
        tx.task.update({
          where: { id },
          data: {
            listId: targetListId,
            position,
            ...(id === taskId && task.parentId ? { parentId: null } : {}),
          },
        }),
      ),
    );

    const sourceTasks = await tx.task.findMany({
      where: { listId: sourceListId },
      select: { id: true },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });

    await Promise.all(
      sourceTasks.map((sourceTask, position) =>
        tx.task.update({
          where: { id: sourceTask.id },
          data: { position },
        }),
      ),
    );
  });

  revalidatePath("/");
}

export type TaskParentUpdate = {
  taskId: string;
  parentId: string | null;
};

export async function reorderTasks(
  listId: string,
  taskIds: string[],
  parentUpdates: TaskParentUpdate[] = [],
) {
  const tasks = await prisma.task.findMany({
    where: { listId },
    select: { id: true },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });

  const validIds = new Set(tasks.map((task) => task.id));
  const seen = new Set<string>();
  const orderedIds: string[] = [];

  for (const id of taskIds) {
    if (!validIds.has(id) || seen.has(id)) continue;
    orderedIds.push(id);
    seen.add(id);
  }

  for (const task of tasks) {
    if (!seen.has(task.id)) {
      orderedIds.push(task.id);
      seen.add(task.id);
    }
  }

  if (orderedIds.length !== tasks.length) {
    throw new Error("Invalid task order payload");
  }

  const validParentUpdates = parentUpdates.filter((update) =>
    validIds.has(update.taskId),
  );

  for (const update of validParentUpdates) {
    if (!update.parentId) continue;

    if (!validIds.has(update.parentId)) {
      throw new Error("Invalid parent task");
    }

    if (update.parentId === update.taskId) {
      throw new Error("Task cannot be its own parent");
    }

    const parentTask = await prisma.task.findUnique({
      where: { id: update.parentId },
      select: { parentId: true },
    });

    if (parentTask?.parentId) {
      throw new Error("Nested subtasks are not supported");
    }
  }

  await prisma.$transaction([
    ...orderedIds.map((id, position) =>
      prisma.task.update({
        where: { id },
        data: { position },
      }),
    ),
    ...validParentUpdates.map(({ taskId, parentId }) =>
      prisma.task.update({
        where: { id: taskId },
        data: { parentId },
      }),
    ),
  ]);

  revalidatePath("/");
}

export async function toggleTask(taskId: string, completed: boolean) {
  await prisma.task.update({
    where: { id: taskId },
    data: { completed },
  });

  revalidatePath("/");
}
