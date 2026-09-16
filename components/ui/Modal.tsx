import { ReactNode } from "react";

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-md max-h-[88vh] overflow-y-auto rounded-2xl border border-border-strong bg-surface-1 p-6">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-ink-muted hover:text-ink cursor-pointer"
        >
          ✕
        </button>
        <div className="mb-4 font-display text-lg font-bold">{title}</div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-3">
      <label className="mb-1 block font-mono text-[11px] uppercase tracking-wide text-ink-muted">
        {label}
      </label>
      {children}
    </div>
  );
}

export const inputClass =
  "w-full rounded-lg border border-border-strong bg-surface-2 px-3 py-2 text-sm text-ink outline-none focus:border-orange transition-colors";
