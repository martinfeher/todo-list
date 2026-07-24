import { getDropIndex } from "./detail-lines";
import { reorderTaskIds } from "./task-reorder";

export function getListRowElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>("[data-list-id]"),
  );
}

export function reorderListIds(
  listIds: string[],
  sourceIndex: number,
  dropIndex: number,
) {
  return reorderTaskIds(listIds, sourceIndex, dropIndex);
}

export function getListDropIndex(
  clientY: number,
  rows: HTMLElement[],
  draggingIndex: number | null = null,
) {
  return getDropIndex(clientY, rows, draggingIndex);
}
