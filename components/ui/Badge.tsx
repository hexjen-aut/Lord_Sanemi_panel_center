import { ReactNode } from "react";

export type BadgeTone = "orange" | "green" | "amber" | "red" | "blue" | "teal" | "purple" | "muted";

const TONES: Record<BadgeTone, string> = {
  orange: "bg-orange/10 text-orange border-orange/30",
  green: "bg-green/10 text-green border-green/30",
  amber: "bg-amber/10 text-amber border-amber/30",
  red: "bg-red/10 text-red border-red/30",
  blue: "bg-blue/10 text-blue border-blue/30",
  teal: "bg-teal/10 text-teal border-teal/30",
  purple: "bg-purple/10 text-purple border-purple/30",
  muted: "bg-surface-2 text-ink-muted border-border",
};

export function Badge({
  children,
  tone = "muted",
  className = "",
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 font-mono text-[11px] border ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
