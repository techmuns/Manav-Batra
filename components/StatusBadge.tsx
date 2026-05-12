export type Status = "safe" | "watch" | "risk" | "neutral";

const styles: Record<Status, string> = {
  safe: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  watch: "bg-amber-50 text-amber-700 ring-amber-200",
  risk: "bg-rose-50 text-rose-700 ring-rose-200",
  neutral: "bg-slate-100 text-slate-600 ring-slate-200",
};

export function StatusBadge({
  status,
  children,
}: {
  status: Status;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${styles[status]}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          status === "safe"
            ? "bg-emerald-500"
            : status === "watch"
              ? "bg-amber-500"
              : status === "risk"
                ? "bg-rose-500"
                : "bg-slate-400"
        }`}
      />
      {children}
    </span>
  );
}
