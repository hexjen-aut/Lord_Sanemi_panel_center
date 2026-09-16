export function ProgressBar({
  value,
  tone = "orange",
  height = 4,
}: {
  value: number;
  tone?: "orange" | "green" | "amber" | "teal";
  height?: number;
}) {
  const colors: Record<string, string> = {
    orange: "bg-orange",
    green: "bg-green",
    amber: "bg-amber",
    teal: "bg-teal",
  };
  return (
    <div className="rounded-full bg-surface-3 overflow-hidden" style={{ height }}>
      <div
        className={`h-full rounded-full transition-all ${colors[tone]}`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}
