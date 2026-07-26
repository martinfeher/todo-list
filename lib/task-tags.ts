import {
  isTaskPriorityLevel,
  type TaskPriorityLevel,
  TASK_PRIORITY_OPTIONS,
} from "./task-priority";

export const PRIORITY_TAG_CATEGORY = "priority";
export const LABEL_CATEGORY = "label";

export function labelSlug(label: string) {
  const normalized = label
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

  return normalized || `label-${Date.now()}`;
}

export const PRIORITY_TAGS = TASK_PRIORITY_OPTIONS.map((option) => ({
  slug: `priority-${option.level}`,
  label: option.label,
  level: option.level,
}));

export type PriorityLevel = TaskPriorityLevel;

export function isPriorityLevel(value: number): value is PriorityLevel {
  return isTaskPriorityLevel(value);
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

type LabelTagRecord = {
  tag: {
    id: string;
    label: string;
    category: string;
  };
};

export function getLabelsFromTaskTags(
  tags: LabelTagRecord[],
): { id: string; label: string }[] {
  return tags
    .filter((entry) => entry.tag.category === LABEL_CATEGORY)
    .map((entry) => ({
      id: entry.tag.id,
      label: entry.tag.label,
    }));
}
