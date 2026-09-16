"use client";

import { useState } from "react";
import type { SectionId } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { useReminderNotifications } from "@/hooks/useReminderNotifications";
import { Sidebar, MobileNav } from "./Sidebar";
import { PlanningSection } from "@/components/sections/PlanningSection";
import { ProjectsSection } from "@/components/sections/ProjectsSection";
import { FinanceSection } from "@/components/sections/FinanceSection";
import { IdeasSection } from "@/components/sections/IdeasSection";
import { JournalSection } from "@/components/sections/JournalSection";
import { ClientsSection } from "@/components/sections/ClientsSection";
import { FacturationSection } from "@/components/sections/FacturationSection";
import { RemindersSection } from "@/components/sections/RemindersSection";

const SECTION_TITLES: Record<SectionId, string> = {
  planning: "Planning",
  projets: "Projets",
  finance: "Finance",
  idees: "Idées",
  journal: "Journal",
  clients: "Clients",
  facturation: "Facturation",
  rappels: "Rappels",
};

export function DashboardApp({ userId }: { userId: string }) {
  const [section, setSection] = useState<SectionId>("planning");
  const notifications = useReminderNotifications(userId);
  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="flex min-h-screen">
      <Sidebar active={section} onChange={setSection} />

      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav active={section} onChange={setSection} />

        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-black/90 px-4 py-3 backdrop-blur lg:px-8">
          <div className="font-display text-sm font-bold lg:hidden">{SECTION_TITLES[section]}</div>
          <div className="hidden font-mono text-xs text-ink-muted lg:block">{today}</div>
          <button
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-full border border-orange/50 bg-orange/10 font-display text-xs font-bold text-orange lg:hidden"
            onClick={() => supabase.auth.signOut()}
          >
            S
          </button>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 p-4 lg:p-8">
          {section === "planning" && <PlanningSection userId={userId} />}
          {section === "projets" && <ProjectsSection userId={userId} />}
          {section === "finance" && <FinanceSection userId={userId} />}
          {section === "idees" && <IdeasSection userId={userId} />}
          {section === "journal" && <JournalSection userId={userId} />}
          {section === "clients" && <ClientsSection userId={userId} />}
          {section === "facturation" && <FacturationSection userId={userId} />}
          {section === "rappels" && (
            <RemindersSection
              userId={userId}
              notifPermission={notifications.permission}
              onEnableNotifs={notifications.requestPermission}
            />
          )}
        </main>
      </div>
    </div>
  );
}
