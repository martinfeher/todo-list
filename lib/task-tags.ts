export const PRIORITY_TAG_CATEGORY = "priority";

export const PRIORITY_TAGS = [
  { slug: "priority-1", label: "Priority 1", level: 1 },
  { slug: "priority-2", label: "Priority 2", level: 2 },
  { slug: "priority-3", label: "Priority 3", level: 3 },
  { slug: "priority-4", label: "Priority 4", level: 4 },
] as const;

export type PriorityLevel = (typeof PRIORITY_TAGS)[number]["level"];

export function isPriorityLevel(value: number): value is PriorityLevel {
  return value === 1 || value === 2 || value === 3 || value === 4;
}

export function normalizePriority(value: number | null): PriorityLevel | null {
  return value !== null && isPriorityLevel(value) ? value : null;
}

export function prioritySlug(level: PriorityLevel) {
  return `priority-${level}`;
}

type TaskTagRecord = {
  tag: {
    category: string;
    level: number | null;
  };
};

export function getPriorityFromTaskTags(tags: TaskTagRecord[]): number | null {
  const priorityTag = tags.find(
    (entry) => entry.tag.category === PRIORITY_TAG_CATEGORY,
  );

  if (!priorityTag?.tag.level || !isPriorityLevel(priorityTag.tag.level)) {
    return null;
  }

  return priorityTag.tag.level;
}
