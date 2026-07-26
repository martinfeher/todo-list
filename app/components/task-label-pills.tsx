import type { TaskLabel } from "./todo-app";

const LABEL_PILL_PALETTE = [
  { bg: "bg-[#dbeafe]", text: "text-[#1e40af]", dot: "#4873c7" },
  { bg: "bg-[#dcfce7]", text: "text-[#166534]", dot: "#22c55e" },
  { bg: "bg-[#fef3c7]", text: "text-[#92400e]", dot: "#f59e0b" },
  { bg: "bg-[#fce7f3]", text: "text-[#9d174d]", dot: "#ec4899" },
  { bg: "bg-[#ede9fe]", text: "text-[#5b21b6]", dot: "#8b5cf6" },
  { bg: "bg-[#ffedd5]", text: "text-[#9a3412]", dot: "#f97316" },
] as const;

export function getLabelPaletteIndex(labelId: string) {
  let hash = 0;
  for (let index = 0; index < labelId.length; index += 1) {
    hash = (hash + labelId.charCodeAt(index)) % LABEL_PILL_PALETTE.length;
  }
  return hash;
}

export function getLabelDotColor(labelId: string) {
  return LABEL_PILL_PALETTE[getLabelPaletteIndex(labelId)].dot;
}

type TaskLabelPillsProps = {
  labels: TaskLabel[];
  className?: string;
};

export function TaskLabelPills({ labels, className = "" }: TaskLabelPillsProps) {
  if (labels.length === 0) return null;

  return (
    <span className={`flex min-w-0 items-center gap-1 ${className}`}>
      {labels.map((item) => {
        const palette = LABEL_PILL_PALETTE[getLabelPaletteIndex(item.id)];

        return (
          <span
            key={item.id}
            className={`truncate rounded px-1.5 py-0.5 text-[10px] font-medium ${palette.bg} ${palette.text}`}
          >
            {item.label}
          </span>
        );
      })}
    </span>
  );
}
