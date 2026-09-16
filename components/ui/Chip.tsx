import { ReactNode } from "react";

export function Chip({
  children,
  active = false,
  onClick,
}: {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-xs whitespace-nowrap transition-colors cursor-pointer ${
        active
          ? "border-orange bg-orange/10 text-orange"
          : "border-border-strong bg-surface-2 text-ink-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
