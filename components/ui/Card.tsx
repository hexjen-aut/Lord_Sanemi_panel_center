import { ReactNode } from "react";

export function Card({
  children,
  accent = false,
  className = "",
}: {
  children: ReactNode;
  accent?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        accent
          ? "border-orange/25 bg-gradient-to-br from-orange/[0.06] to-surface-1"
          : "border-border bg-surface-1"
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children }: { children: ReactNode }) {
  return (
    <div className="mb-3 font-display text-[11px] font-bold uppercase tracking-wider text-ink-muted">
      {children}
    </div>
  );
}
