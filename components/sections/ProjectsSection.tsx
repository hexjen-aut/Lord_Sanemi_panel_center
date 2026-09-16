"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { BASE_PROJECTS, PROJECT_NAMES } from "@/lib/constants";
import type { ProjectKey, SanemiObjective, SanemiTask } from "@/lib/types";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Modal, Field, inputClass } from "@/components/ui/Modal";
import { Loader } from "./PlanningSection";
import { WennaStats } from "./WennaStats";

const URGENCE_TONE = { critique: "red", haute: "orange", normale: "amber" } as const;
const PROJECT_OPTIONS: ProjectKey[] = ["wenna", "myria", "hexjen", "fixi"];

export function ProjectsSection({ userId }: { userId: string }) {
  const [objectives, setObjectives] = useState<SanemiObjective[]>([]);
  const [tasks, setTasks] = useState<SanemiTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    project: "wenna" as ProjectKey,
    title: "",
    deadline: "",
    urgence: "normale" as SanemiObjective["urgence"],
    progress: 0,
    notes: "",
  });

  async function loadObjectives() {
    setLoading(true);
    const { data, error } = await supabase
      .from("sanemi_objectives")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (!error) setObjectives(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadObjectives();
    supabase
      .from("sanemi_tasks")
      .select("*")
      .eq("user_id", userId)
      .then(({ data }) => setTasks(data ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function saveObjective() {
    if (!form.title.trim()) return;
    const payload = {
      project: form.project,
      title: form.title.trim(),
      deadline: form.deadline || null,
      urgence: form.urgence,
      progress: form.progress,
      notes: form.notes,
      user_id: userId,
    };
    await supabase.from("sanemi_objectives").insert(payload);
    await loadObjectives();
    setForm({ project: "wenna", title: "", deadline: "", urgence: "normale", progress: 0, notes: "" });
    setModalOpen(false);
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <div className="font-display text-xl font-extrabold">Projets</div>
          <div className="text-xs text-ink-muted">Priorités & objectifs</div>
        </div>
        <Button size="sm" variant="primary" onClick={() => setModalOpen(true)}>
          + Objectif
        </Button>
      </div>

      <Card className="mb-4">
        <CardTitle>Tableau de priorités</CardTitle>
        {loading ? (
          <Loader />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr>
                  {["#", "Projet", "Focus", "Urgence", "Avancement"].map((h) => (
                    <th
                      key={h}
                      className="border-b border-border px-2.5 py-2 text-left font-display text-[10px] font-bold uppercase tracking-wide text-ink-muted"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {BASE_PROJECTS.map((p, i) => (
                  <tr key={p.key} className="hover:bg-surface-2">
                    <td className="border-b border-border px-2.5 py-2.5 font-mono text-ink-muted">{i + 1}</td>
                    <td className="border-b border-border px-2.5 py-2.5 font-display font-bold">{p.name}</td>
                    <td className="border-b border-border px-2.5 py-2.5 text-xs text-ink-muted">{p.focus}</td>
                    <td className="border-b border-border px-2.5 py-2.5">
                      <Badge tone={URGENCE_TONE[p.urgence]}>{p.urgence}</Badge>
                    </td>
                    <td className="min-w-24 border-b border-border px-2.5 py-2.5">
                      <ProgressBar value={p.progress} />
                      <span className="text-[11px] text-ink-muted">{p.progress}%</span>
                    </td>
                  </tr>
                ))}
                {objectives.map((o) => (
                  <tr key={o.id} className="hover:bg-surface-2">
                    <td className="border-b border-border px-2.5 py-2.5 font-mono text-ink-dim">+</td>
                    <td className="border-b border-border px-2.5 py-2.5">{PROJECT_NAMES[o.project]}</td>
                    <td className="border-b border-border px-2.5 py-2.5 text-xs text-ink-muted">{o.title}</td>
                    <td className="border-b border-border px-2.5 py-2.5">
                      <Badge tone={URGENCE_TONE[o.urgence]}>{o.urgence}</Badge>
                    </td>
                    <td className="min-w-24 border-b border-border px-2.5 py-2.5">
                      <ProgressBar value={o.progress} />
                      <span className="text-[11px] text-ink-muted">{o.progress}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid gap-3.5 sm:grid-cols-2">
        {BASE_PROJECTS.map((p) => {
          const myObjectives = objectives.filter((o) => o.project === p.key);
          const myTasks = tasks.filter((t) => t.project === p.key);
          return (
            <Card key={p.key} accent={p.key === "wenna"}>
              <div className="mb-2.5 flex items-center justify-between">
                <div className="font-display text-lg font-bold">{p.name}</div>
                <Badge tone={URGENCE_TONE[p.urgence]}>{p.urgence}</Badge>
              </div>
              <ProgressBar value={p.progress} height={5} />
              <div className="mb-2.5 mt-1.5 text-[11px] text-ink-muted">
                {p.progress}% · {p.focus}
              </div>
              {p.key === "wenna" && <WennaStats />}
              <div className="my-3.5 h-px bg-border" />
              {myObjectives.map((o) => (
                <div key={o.id} className="border-b border-border py-1 text-xs last:border-none">
                  ↳ {o.title}
                </div>
              ))}
              <div className="mt-1.5 text-[11px] text-ink-dim">{myTasks.length} tâche(s)</div>
            </Card>
          );
        })}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nouvel objectif">
        <Field label="Projet">
          <select
            value={form.project}
            onChange={(e) => setForm({ ...form, project: e.target.value as ProjectKey })}
            className={inputClass}
          >
            {PROJECT_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {PROJECT_NAMES[p]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Objectif">
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className={inputClass}
            placeholder="Ex: Lancer checkout CinetPay"
          />
        </Field>
        <div className="mb-3 grid grid-cols-2 gap-2.5">
          <Field label="Deadline">
            <input
              type="date"
              value={form.deadline}
              onChange={(e) => setForm({ ...form, deadline: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Urgence">
            <select
              value={form.urgence}
              onChange={(e) => setForm({ ...form, urgence: e.target.value as SanemiObjective["urgence"] })}
              className={inputClass}
            >
              <option value="critique">🔴 Critique</option>
              <option value="haute">🟠 Haute</option>
              <option value="normale">🟡 Normale</option>
            </select>
          </Field>
        </div>
        <Field label="Avancement %">
          <input
            type="number"
            min={0}
            max={100}
            value={form.progress}
            onChange={(e) => setForm({ ...form, progress: Number(e.target.value) })}
            className={inputClass}
          />
        </Field>
        <Field label="Notes">
          <textarea
            rows={2}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className={inputClass}
            placeholder="Contexte, blocages..."
          />
        </Field>
        <Button variant="primary" className="w-full" onClick={saveObjective}>
          Ajouter
        </Button>
      </Modal>
    </div>
  );
}
