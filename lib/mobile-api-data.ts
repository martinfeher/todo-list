import { getTodoData } from "@/lib/todo-data";
import { buildVisibleTasks } from "@/lib/task-subtasks";

function isDueToday(dueDate: string | null) {
  if (!dueDate) return false;

  const date = new Date(dueDate);
  if (Number.isNaN(date.getTime())) return false;

  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

export type SidebarListItem = {
  id: string;
  name: string;
  taskCount: number;
};

export type SidebarLabelItem = {
  id: string;
  label: string;
  taskCount: number;
};

export type SidebarApiResponse = {
  lists: SidebarListItem[];
  labels: SidebarLabelItem[];
  counts: {
    today: number;
    important: number;
  };
};

export type MobileTaskItem = {
  id: string;
  name: string;
  completed: boolean;
  dueDate: string | null;
  pinned: boolean;
  important: boolean;
  priority: number | null;
  parentId: string | null;
  depth: number;
  labels: { id: string; label: string }[];
  listId: string;
  listName?: string;
};

export type TasksApiResponse = {
  title: string;
  pinned: MobileTaskItem[];
  tasks: MobileTaskItem[];
};

type TaskSource = {
  id: string;
  name: string;
  completed: boolean;
  dueDate: string | null;
  pinned: boolean;
  important: boolean;
  priority?: number | null;
  parentId: string | null;
  labels: { id: string; label: string }[];
};

function mapToMobileTask(
  task: TaskSource & { depth?: number },
  listId: string,
  listName?: string,
): MobileTaskItem {
  return {
    id: task.id,
    name: task.name,
    completed: task.completed,
    dueDate: task.dueDate,
    pinned: task.pinned,
    important: task.important,
    priority: task.priority ?? null,
    parentId: task.parentId,
    depth: task.depth ?? 0,
    labels: task.labels,
    listId,
    ...(listName ? { listName } : {}),
  };
}

function buildListTaskSections(
  tasks: TaskSource[],
  listId: string,
  listName?: string,
  useHierarchy = true,
): Pick<TasksApiResponse, "pinned" | "tasks"> {
  const incomplete = tasks.filter((task) => !task.completed);

  if (!useHierarchy) {
    return {
      pinned: [],
      tasks: incomplete.map((task) =>
        mapToMobileTask({ ...task, depth: 0 }, listId, listName),
      ),
    };
  }

  return {
    pinned: buildVisibleTasks(incomplete, true).map((task) =>
      mapToMobileTask(task, listId, listName),
    ),
    tasks: buildVisibleTasks(incomplete, false).map((task) =>
      mapToMobileTask(task, listId, listName),
    ),
  };
}

export type TasksQuery =
  | { view: "list"; listId: string }
  | { view: "today" }
  | { view: "important" }
  | { view: "label"; labelId: string }
  | { view: "calendar" };

export async function getTasksApiData(query: TasksQuery): Promise<TasksApiResponse> {
  const { lists, labels, tasksByList } = await getTodoData();

  if (query.view === "list") {
    const list = lists.find((item) => item.id === query.listId);
    if (!list) {
      throw new Error("List not found");
    }

    const sections = buildListTaskSections(
      tasksByList[list.id] ?? [],
      list.id,
      undefined,
      true,
    );

    return {
      title: list.name,
      ...sections,
    };
  }

  if (query.view === "today") {
    const tasks = lists.flatMap((list) =>
      (tasksByList[list.id] ?? [])
        .filter((task) => !task.completed && isDueToday(task.dueDate))
        .map((task) => mapToMobileTask({ ...task, depth: 0 }, list.id, list.name)),
    );

    return {
      title: "Today",
      pinned: [],
      tasks,
    };
  }

  if (query.view === "important") {
    const tasks = lists.flatMap((list) =>
      (tasksByList[list.id] ?? [])
        .filter((task) => !task.completed && task.important)
        .map((task) => mapToMobileTask({ ...task, depth: 0 }, list.id, list.name)),
    );

    return {
      title: "Important",
      pinned: [],
      tasks,
    };
  }

  if (query.view === "calendar") {
    const tasks = lists
      .flatMap((list) =>
        (tasksByList[list.id] ?? [])
          .filter((task) => !task.completed && task.dueDate)
          .map((task) => mapToMobileTask({ ...task, depth: 0 }, list.id, list.name)),
      )
      .sort((a, b) => {
        const aTime = new Date(a.dueDate!).getTime();
        const bTime = new Date(b.dueDate!).getTime();
        return aTime - bTime;
      });

    return {
      title: "Calendar",
      pinned: [],
      tasks,
    };
  }

  const label = labels.find((item) => item.id === query.labelId);
  if (!label) {
    throw new Error("Label not found");
  }

  const tasks = lists.flatMap((list) =>
    (tasksByList[list.id] ?? [])
      .filter(
        (task) =>
          !task.completed &&
          task.labels.some((item) => item.id === query.labelId),
      )
      .map((task) => mapToMobileTask({ ...task, depth: 0 }, list.id, list.name)),
  );

  return {
    title: label.label,
    pinned: [],
    tasks,
  };
}

export async function getSidebarApiData(): Promise<SidebarApiResponse> {
  const { lists, labels, tasksByList } = await getTodoData();

  let todayCount = 0;
  let importantCount = 0;
  const taskCountByListId: Record<string, number> = {};
  const taskCountByLabelId: Record<string, number> = {};

  for (const list of lists) {
    const tasks = tasksByList[list.id] ?? [];
    taskCountByListId[list.id] = tasks.filter((task) => !task.completed).length;

    for (const task of tasks) {
      if (task.completed) continue;

      if (task.important) {
        importantCount += 1;
      }

      if (isDueToday(task.dueDate)) {
        todayCount += 1;
      }

      for (const label of task.labels) {
        taskCountByLabelId[label.id] = (taskCountByLabelId[label.id] ?? 0) + 1;
      }
    }
  }

  return {
    lists: lists.map((list) => ({
      id: list.id,
      name: list.name,
      taskCount: taskCountByListId[list.id] ?? 0,
    })),
    labels: labels.map((label) => ({
      id: label.id,
      label: label.label,
      taskCount: taskCountByLabelId[label.id] ?? 0,
    })),
    counts: {
      today: todayCount,
      important: importantCount,
    },
  };
}
