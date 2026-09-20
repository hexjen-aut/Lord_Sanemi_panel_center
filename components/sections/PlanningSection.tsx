"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { dayOfWeek, weekNumber } from "@/lib/date";
import { PROJECT_COLORS, PROJECT_NAMES, WEEK_DAYS, WEEK_DAYS_FULL, WEEK_MODES } from "@/lib/constants";
import type { ProjectKey, SanemiTask } from "@/lib/types";
import { drawWheel, spinWheel, type WheelItem } from "@/lib/wheel";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal, Field, inputClass } from "@/components/ui/Modal";

const PROJECT_OPTIONS: ProjectKey[] = ["wenna", "myria", "hexjen", "fixi", "perso"];

export function PlanningSection({ userId }: { userId: string }) {
  const [tasks, setTasks] = useState<SanemiTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [quickTask, setQuickTask] = useState("");
  const [motivation, setMotivation] = useState(3);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    project: "wenna" as ProjectKey,
    priority: "moyenne" as SanemiTask["priority"],
    day: dayOfWeek(),
    duration: 1,
  });

  const today = dayOfWeek();
  const week = weekNumber(new Date());
  const year = new Date().getFullYear();

  async function loadTasks() {
    setLoading(true);
    const { data, error } = await supabase
      .from("sanemi_tasks")
      .select("*")
      .eq("user_id", userId);
    if (!error) setTasks(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const todayTasks = useMemo(() => tasks.filter((t) => t.day_of_week === today), [tasks, today]);
  const doneCount = todayTasks.filter((t) => t.done).length;
  const pendingTasks = useMemo(() => todayTasks.filter((t) => !t.done), [todayTasks]);

  const wheelCanvasRef = useRef<HTMLCanvasElement>(null);
  const [wheelRot, setWheelRot] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [pickedTaskId, setPickedTaskId] = useState<string | null>(null);
  const wheelItems: WheelItem[] = pendingTasks.map((t) => ({ id: t.id, label: t.title, w: 1 }));

  useEffect(() => {
    const c = wheelCanvasRef.current;
    if (c) drawWheel(c, wheelItems, wheelRot);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingTasks, wheelRot]);

  const pickedTask = pendingTasks.find((t) => t.id === pickedTaskId) ?? null;

  useEffect(() => {
    function onResize() {
      const c = wheelCanvasRef.current;
      if (c) drawWheel(c, wheelItems, wheelRot);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingTasks]);

  async function spinTasks() {
    const c = wheelCanvasRef.current;
    if (!c || wheelItems.length < 2) return;
    setSpinning(true);
    setPickedTaskId(null);
    const i = await spinWheel(c, wheelItems, wheelRot, setWheelRot);
    setSpinning(false);
    if (i >= 0) setPickedTaskId(wheelItems[i].id);
  }

  async function toggleTask(id: string, done: boolean) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done } : t)));
    await supabase.from("sanemi_tasks").update({ done }).eq("id", id);
  }

  async function deleteTask(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await supabase.from("sanemi_tasks").delete().eq("id", id);
  }

  async function addQuickTask() {
    const title = quickTask.trim();
    if (!title) return;
    setQuickTask("");
    const payload = {
      title,
      project: "wenna" as ProjectKey,
      priority: "moyenne" as const,
      day_of_week: today,
      duration: 1,
      done: false,
      week_number: week,
      year,
      user_id: userId,
    };
    const { data } = await supabase.from("sanemi_tasks").insert(payload).select().single();
    if (data) setTasks((prev) => [...prev, data]);
  }

  async function saveTask() {
    if (!form.title.trim()) return;
    const payload = {
      title: form.title.trim(),
      project: form.project,
      priority: form.priority,
      day_of_week: form.day,
      duration: form.duration,
      done: false,
      week_number: week,
      year,
      user_id: userId,
    };
    const { data } = await supabase.from("sanemi_tasks").insert(payload).select().single();
    if (data) setTasks((prev) => [...prev, data]);
    setForm({ title: "", project: "wenna", priority: "moyenne", day: today, duration: 1 });
    setModalOpen(false);
  }

  const timeBlocks = useMemo(() => buildTimeBlocks(motivation), [motivation]);
  const motivationLabel = ["", "Repos", "Focus léger", "Équilibré", "En forme", "🔥 Full Power"][motivation];

  return (
    <div className="animate-fade-in">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <div className="font-display text-xl font-extrabold">Planning Semaine</div>
          <div className="text-xs text-ink-muted">Semaine {week} · Mode : Alterné</div>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="amber">
            {doneCount}/{todayTasks.length} tâches faites
          </Badge>
          <Button size="sm" onClick={() => setModalOpen(true)}>
            + Tâche
          </Button>
        </div>
      </div>

      <Card className="mb-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm">Niveau d&apos;énergie</div>
            <div className="text-xs text-ink-muted">Adapte tes blocs de travail</div>
          </div>
          <div>
            <div className="mb-1 text-right text-xs text-ink-muted">
              Mode : <strong className="text-orange">{motivationLabel}</strong>
            </div>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setMotivation(lvl)}
                  className={`h-2.5 w-2.5 rounded-full cursor-pointer transition-colors ${
                    lvl <= motivation ? "bg-orange" : "bg-surface-3"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Card className="mb-4">
        <CardTitle>Cette semaine</CardTitle>
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
          {WEEK_DAYS.map((d, i) => {
            const dayTasks = tasks.filter((t) => t.day_of_week === i);
            const isToday = i === today;
            return (
              <div
                key={d}
                className={`overflow-hidden rounded-lg border bg-surface-1 ${
                  isToday ? "border-orange/40" : "border-border"
                }`}
              >
                <div
                  className={`border-b border-border px-2 py-1.5 font-display text-[10px] font-bold uppercase tracking-wide ${
                    isToday ? "text-orange" : ""
                  }`}
                >
                  {d}
                  <span className="block font-normal text-ink-dim">{WEEK_MODES[i]}</span>
                </div>
                <div className="flex min-h-16 flex-col gap-1 p-1.5">
                  {dayTasks.length === 0 && <div className="text-[10px] text-ink-dim">—</div>}
                  {dayTasks.map((t) => (
                    <div
                      key={t.id}
                      className="rounded border-l-2 bg-orange/5 px-1.5 py-1 text-[10px]"
                      style={{ borderColor: `var(--color-${PROJECT_COLORS[t.project] ?? "orange"})` }}
                    >
                      {t.title.length > 18 ? `${t.title.slice(0, 18)}…` : t.title}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {pendingTasks.length > 0 && (
        <Card className="mb-4">
          <CardTitle>Par quoi commencer ?</CardTitle>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
            <div className="relative aspect-square w-32 shrink-0">
              <canvas ref={wheelCanvasRef} className="h-full w-full" aria-label="Roue des tâches du jour" />
            </div>
            <div className="flex-1">
              <Button variant="primary" size="sm" onClick={spinTasks} disabled={spinning || wheelItems.length < 2}>
                Tourner la roue
              </Button>
              {wheelItems.length < 2 && <p className="mt-2 text-xs text-ink-dim">Ajoute au moins deux tâches pour tourner la roue.</p>}
              {pickedTask && (
                <div className="mt-3 rounded-lg border border-orange/30 bg-orange/5 p-3">
                  <div className="text-[10px] uppercase tracking-wide text-ink-muted">La roue a choisi</div>
                  <div className="font-display text-sm font-bold">{pickedTask.title}</div>
                  <Button size="sm" className="mt-2" onClick={() => toggleTask(pickedTask.id, true)}>
                    Marquer fait
                  </Button>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-3.5 md:grid-cols-2">
        <Card>
          <CardTitle>Tâches du jour — {WEEK_DAYS_FULL[today]}</CardTitle>
          {loading ? (
            <Loader />
          ) : todayTasks.length === 0 ? (
            <Empty>Aucune tâche aujourd&apos;hui</Empty>
          ) : (
            <div>
              {todayTasks.map((t) => (
                <div
                  key={t.id}
                  className={`flex items-start gap-2.5 rounded-lg border-b border-border px-1.5 py-2.5 last:border-none ${
                    t.id === pickedTaskId ? "border border-orange/40 bg-orange/5" : ""
                  }`}
                >
                  <button
                    onClick={() => toggleTask(t.id, !t.done)}
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border-[1.5px] cursor-pointer ${
                      t.done ? "border-green bg-green text-black" : "border-border-strong"
                    }`}
                  >
                    {t.done && "✓"}
                  </button>
                  <div className="flex-1">
                    <div className={`text-sm ${t.done ? "text-ink-muted line-through" : ""}`}>{t.title}</div>
                    <div className="mt-1 flex gap-1">
                      <Badge tone={PROJECT_COLORS[t.project]}>{PROJECT_NAMES[t.project]}</Badge>
                      <span className="text-[10px] text-ink-dim">{t.duration}h</span>
                    </div>
                  </div>
                  <button onClick={() => deleteTask(t.id)} className="px-1 text-ink-dim hover:text-ink cursor-pointer">
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="mt-2.5 flex gap-2">
            <input
              value={quickTask}
              onChange={(e) => setQuickTask(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addQuickTask()}
              placeholder="Tâche rapide..."
              className={inputClass}
            />
            <Button variant="primary" size="sm" onClick={addQuickTask}>
              +
            </Button>
          </div>
        </Card>

        <Card>
          <CardTitle>Blocs suggérés</CardTitle>
          <div className="flex flex-col gap-1.5">
            {timeBlocks.map((b) => (
              <div key={b.time} className="flex gap-2.5">
                <div className="w-9 pt-1.5 text-right font-mono text-[10px] text-ink-dim">{b.time}</div>
                <div
                  className="flex-1 rounded-md border-l-2 bg-orange/5 px-2.5 py-1.5 text-xs"
                  style={{ borderColor: `var(--color-${PROJECT_COLORS[b.project] ?? "orange"})` }}
                >
                  <div className="font-medium">{b.label}</div>
                  <div className="text-[10px] text-ink-muted">
                    {b.duration}h · {PROJECT_NAMES[b.project]}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nouvelle tâche">
        <Field label="Titre">
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className={inputClass}
            placeholder="Ex: Finaliser checkout WennaShop"
          />
        </Field>
        <div className="mb-3 grid grid-cols-2 gap-2.5">
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
          <Field label="Priorité">
            <select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value as SanemiTask["priority"] })}
              className={inputClass}
            >
              <option value="haute">Haute</option>
              <option value="moyenne">Moyenne</option>
              <option value="basse">Basse</option>
            </select>
          </Field>
        </div>
        <div className="mb-3 grid grid-cols-2 gap-2.5">
          <Field label="Jour">
            <select
              value={form.day}
              onChange={(e) => setForm({ ...form, day: Number(e.target.value) })}
              className={inputClass}
            >
              {WEEK_DAYS_FULL.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Durée (h)">
            <input
              type="number"
              min={0.5}
              max={8}
              step={0.5}
              value={form.duration}
              onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })}
              className={inputClass}
            />
          </Field>
        </div>
        <Button variant="primary" className="w-full" onClick={saveTask}>
          Ajouter
        </Button>
      </Modal>
    </div>
  );
}

function buildTimeBlocks(motivation: number) {
  if (motivation <= 1) {
    return [
      { time: "10h", label: "Revue messages & emails", project: "perso" as ProjectKey, duration: 1 },
      { time: "11h", label: "1 tâche légère WennaShop", project: "wenna" as ProjectKey, duration: 1 },
      { time: "14h", label: "Formation / veille", project: "perso" as ProjectKey, duration: 1.5 },
    ];
  }
  if (motivation <= 3) {
    return [
      { time: "09h", label: "Deep work WennaShop", project: "wenna" as ProjectKey, duration: 2 },
      { time: "11h", label: "Admin & messages", project: "perso" as ProjectKey, duration: 1 },
      { time: "14h", label: "Myria ou Hexjen", project: "myria" as ProjectKey, duration: 2 },
      { time: "17h", label: "Revue & planning J+1", project: "perso" as ProjectKey, duration: 0.5 },
    ];
  }
  return [
    { time: "08h", label: "Deep work WennaShop", project: "wenna" as ProjectKey, duration: 3 },
    { time: "11h", label: "Bugs & tests", project: "wenna" as ProjectKey, duration: 1.5 },
    { time: "14h", label: "Myria / Hexjen sprint", project: "myria" as ProjectKey, duration: 2.5 },
    { time: "17h", label: "Admin & emails", project: "perso" as ProjectKey, duration: 1 },
    { time: "20h", label: "Apprentissage / idées", project: "perso" as ProjectKey, duration: 1 },
  ];
}

function Loader() {
  return (
    <div className="flex items-center justify-center gap-2 py-8 font-mono text-xs text-ink-muted">
      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-surface-3 border-t-orange" />
      Chargement...
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="py-7 text-center text-sm text-ink-dim">{children}</div>;
}

export { Loader, Empty };
