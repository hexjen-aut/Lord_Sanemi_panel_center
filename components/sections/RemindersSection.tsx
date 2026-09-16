"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PROJECT_COLORS, PROJECT_NAMES } from "@/lib/constants";
import type { ProjectKey, SanemiReminder } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal, Field, inputClass } from "@/components/ui/Modal";
import { Loader, Empty } from "./PlanningSection";

const PROJECT_OPTIONS: ProjectKey[] = ["wenna", "myria", "hexjen", "fixi", "perso"];

export function RemindersSection({
  userId,
  notifPermission,
  onEnableNotifs,
}: {
  userId: string;
  notifPermission: NotificationPermission | "unsupported";
  onEnableNotifs: () => void;
}) {
  const [reminders, setReminders] = useState<SanemiReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    message: "",
    date: "",
    project: "wenna" as ProjectKey,
  });

  async function loadReminders() {
    setLoading(true);
    const { data, error } = await supabase
      .from("sanemi_reminders")
      .select("*")
      .eq("user_id", userId)
      .order("remind_at", { ascending: true });
    if (!error) setReminders(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadReminders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function saveReminder() {
    if (!form.title.trim() || !form.date) return;
    await supabase.from("sanemi_reminders").insert({
      title: form.title.trim(),
      message: form.message,
      remind_at: new Date(form.date).toISOString(),
      channel: "email",
      related_project: form.project,
      sent: false,
      user_id: userId,
    });
    await loadReminders();
    setForm({ title: "", message: "", date: "", project: "wenna" });
    setModalOpen(false);
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <div className="font-display text-xl font-extrabold">Rappels & Notifications</div>
          <div className="text-xs text-ink-muted">Email automatique à la date prévue</div>
        </div>
        <Button size="sm" variant="primary" onClick={() => setModalOpen(true)}>
          + Rappel
        </Button>
      </div>

      {notifPermission === "default" && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-orange/30 bg-orange/5 px-4 py-3">
          <div className="text-xs text-ink-muted">
            Active les notifications navigateur pour être alerté dès qu&apos;un rappel arrive à échéance (en plus de l&apos;email).
          </div>
          <Button size="sm" onClick={onEnableNotifs}>
            Activer
          </Button>
        </div>
      )}
      {notifPermission === "denied" && (
        <div className="mb-4 text-xs text-ink-dim">
          Notifications navigateur bloquées — réactive-les dans les réglages du site si tu changes d&apos;avis.
        </div>
      )}

      {loading ? (
        <Loader />
      ) : reminders.length === 0 ? (
        <Empty>Aucun rappel programmé</Empty>
      ) : (
        <div className="flex flex-col gap-1.5">
          {reminders.map((r) => {
            const date = new Date(r.remind_at);
            const past = date < new Date();
            return (
              <div key={r.id} className="flex items-center gap-3 rounded-lg border border-border bg-surface-2 p-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange/10 text-sm">
                  ⏰
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium">{r.title}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge>📧 email</Badge>
                    <Badge tone={PROJECT_COLORS[r.related_project]}>{PROJECT_NAMES[r.related_project]}</Badge>
                    <span className="text-[11px] text-ink-dim">
                      {date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
                <Badge tone={r.sent || past ? "green" : "orange"}>
                  {r.sent ? "Envoyé" : past ? "Passé" : "Programmé"}
                </Badge>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nouveau Rappel">
        <Field label="Titre">
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className={inputClass}
            placeholder="Ex: Deadline WennaShop checkout"
          />
        </Field>
        <Field label="Message (email)">
          <textarea
            rows={2}
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            className={inputClass}
            placeholder="Détail..."
          />
        </Field>
        <div className="mb-3 grid grid-cols-2 gap-2.5">
          <Field label="Date & heure">
            <input
              type="datetime-local"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className={inputClass}
            />
          </Field>
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
        </div>
        <Button variant="primary" className="w-full" onClick={saveReminder}>
          Programmer
        </Button>
      </Modal>
    </div>
  );
}
