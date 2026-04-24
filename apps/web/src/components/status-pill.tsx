import { cn } from "@trainmap/ui";

const tone = {
  completed: "border-emerald-700/20 bg-emerald-50 text-emerald-800",
  planned: "border-amber-700/20 bg-amber-50 text-amber-800",
  needs_review: "border-rose-700/20 bg-rose-50 text-rose-800",
  exact: "border-emerald-700/20 bg-emerald-50 text-emerald-800",
  inferred: "border-sky-700/20 bg-sky-50 text-sky-800",
  manual: "border-purple-700/20 bg-purple-50 text-purple-800"
};

export function StatusPill({ value }: { value: keyof typeof tone }) {
  return (
    <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-xs font-medium", tone[value])}>
      {value.replace("_", " ")}
    </span>
  );
}
