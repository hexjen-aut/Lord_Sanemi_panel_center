"use client";

import type { SectionId } from "@/lib/types";
import { supabase } from "@/lib/supabase";

const NAV: { id: SectionId; label: string }[] = [
  { id: "planning", label: "Planning" },
  { id: "projets", label: "Projets" },
  { id: "finance", label: "Finance" },
  { id: "idees", label: "Idées" },
  { id: "journal", label: "Journal" },
  { id: "clients", label: "Clients" },
  { id: "rappels", label: "Rappels" },
];

export function Sidebar({
  active,
  onChange,
}: {
  active: SectionId;
  onChange: (id: SectionId) => void;
}) {
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-surface-1/60 max-lg:hidden">
      <div className="flex items-center gap-3 border-b border-border px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange font-display text-sm font-extrabold text-black">
          S
        </div>
        <div>
          <div className="font-display text-sm font-bold">Sanemi OS</div>
          <div className="font-mono text-[10px] text-ink-muted">Centre de commandement</div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3">
        {NAV.map((n) => (
          <button
            key={n.id}
            onClick={() => onChange(n.id)}
            className={`rounded-lg px-3 py-2 text-left text-sm transition-colors cursor-pointer ${
              active === n.id
                ? "border border-orange/40 bg-orange/10 text-orange"
                : "border border-transparent text-ink-muted hover:bg-surface-2 hover:text-ink"
            }`}
          >
            {n.label}
          </button>
        ))}
      </nav>

      <div className="border-t border-border p-3">
        <button
          onClick={() => supabase.auth.signOut()}
          className="w-full rounded-lg px-3 py-2 text-left text-sm text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink cursor-pointer"
        >
          Déconnexion
        </button>
      </div>
    </aside>
  );
}

export function MobileNav({
  active,
  onChange,
}: {
  active: SectionId;
  onChange: (id: SectionId) => void;
}) {
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-border bg-black/90 px-3 py-2 lg:hidden">
      {NAV.map((n) => (
        <button
          key={n.id}
          onClick={() => onChange(n.id)}
          className={`shrink-0 rounded-lg px-3 py-1.5 text-sm transition-colors cursor-pointer ${
            active === n.id ? "bg-orange/10 text-orange" : "text-ink-muted"
          }`}
        >
          {n.label}
        </button>
      ))}
    </nav>
  );
}
