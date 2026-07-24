import type { TaskTag } from "./todo-app";

const TAG_PILL_PALETTE = [
  { bg: "bg-[#fef3c7]", text: "text-[#92400e]", dot: "#fbbf24" },
  { bg: "bg-[#ccfbf1]", text: "text-[#115e59]", dot: "#2dd4bf" },
  { bg: "bg-[#dbeafe]", text: "text-[#1e40af]", dot: "#ef4444" },
  { bg: "bg-[#fce7f3]", text: "text-[#9d174d]", dot: "#ec4899" },
  { bg: "bg-[#ede9fe]", text: "text-[#5b21b6]", dot: "#8b5cf6" },
  { bg: "bg-[#ffedd5]", text: "text-[#9a3412]", dot: "#f97316" },
] as const;

export function getTagPaletteIndex(tagId: string) {
  let hash = 0;
  for (let index = 0; index < tagId.length; index += 1) {
    hash = (hash + tagId.charCodeAt(index)) % TAG_PILL_PALETTE.length;
  }
  return hash;
}

export function getTagDotColor(tagId: string) {
  return TAG_PILL_PALETTE[getTagPaletteIndex(tagId)].dot;
}

type TaskTagPillsProps = {
  tags: TaskTag[];
  className?: string;
};

export function TaskTagPills({ tags, className = "" }: TaskTagPillsProps) {
  if (tags.length === 0) return null;

  return (
    <div className={`flex min-w-0 items-center gap-1 ${className}`}>
      {tags.map((tag) => {
        const palette = TAG_PILL_PALETTE[getTagPaletteIndex(tag.id)];

        return (
          <span
            key={tag.id}
            className={`shrink-0 truncate rounded-full px-2 py-0.5 text-[11px] font-medium leading-none ${palette.bg} ${palette.text}`}
          >
            {tag.label}
          </span>
        );
      })}
    </div>
  );
}
