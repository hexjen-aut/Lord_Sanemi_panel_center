import type { BarRow } from "@/lib/patterns/analytics";

export function Bars({ rows, max }: { rows: BarRow[]; max?: number }) {
  if (!rows.length) return <p className="text-sm text-ink-dim">Pas encore de données.</p>;
  const m = max ?? Math.max(...rows.map((r) => r.v), 1);
  return (
    <ul className="flex flex-col gap-1.5">
      {rows.map((r) => (
        <li key={r.label} className="flex items-center gap-2 text-xs">
          <span className="w-24 shrink-0 truncate text-ink-muted">{r.label}</span>
          <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
            <i className="absolute inset-y-0 left-0 rounded-full bg-orange" style={{ width: `${Math.max(4, (r.v / m) * 100)}%` }} />
          </span>
          <span className="w-10 shrink-0 text-right font-mono text-ink">{r.display ?? r.v}</span>
          {r.note && <span className="shrink-0 text-[10px] text-ink-dim">{r.note}</span>}
        </li>
      ))}
    </ul>
  );
}
