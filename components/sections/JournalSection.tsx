"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { todayStr } from "@/lib/date";
import type { SanemiJournalEntry } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal, Field, inputClass } from "@/components/ui/Modal";
import { Loader, Empty } from "./PlanningSection";

const MOOD_EMOJIS = ["", "😩", "😕", "😐", "🙂", "🔥"];

export function JournalSection({ userId }: { userId: string }) {
  const [entries, setEntries] = useState<SanemiJournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [humeur, setHumeur] = useState(3);
  const [energie, setEnergie] = useState(3);
  const [form, setForm] = useState({ realisations: "", blocages: "", idee: "", note: "" });

  async function loadEntries() {
    setLoading(true);
    const { data, error } = await supabase
      .from("sanemi_journal")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(30);
    if (!error) setEntries(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function saveEntry() {
    await supabase.from("sanemi_journal").upsert(
      {
        date: todayStr(),
        humeur,
        energie_demain: energie,
        realisations: form.realisations,
        blocages: form.blocages,
        idee_du_jour: form.idee,
        note_libre: form.note,
        user_id: userId,
      },
      { onConflict: "user_id,date" }
    );
    await loadEntries();
    setForm({ realisations: "", blocages: "", idee: "", note: "" });
    setModalOpen(false);
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <div className="font-display text-xl font-extrabold">Journal de Bord</div>
          <div className="text-xs text-ink-muted">Bilan quotidien structuré</div>
        </div>
        <Button size="sm" variant="primary" onClick={() => setModalOpen(true)}>
          + Entrée du jour
        </Button>
      </div>

      {loading ? (
        <Loader />
      ) : entries.length === 0 ? (
        <Empty>Aucune entrée de journal. Commence aujourd&apos;hui !</Empty>
      ) : (
        <div className="flex flex-col gap-2.5">
          {entries.map((e) => (
            <div key={e.id} className="rounded-2xl border border-border bg-surface-2 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="font-mono text-xs text-ink-muted">
                  {new Date(`${e.date}T12:00:00`).toLocaleDateString("fr-FR", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-lg">{MOOD_EMOJIS[e.humeur] || "😐"}</span>
                  <Badge tone={e.humeur >= 4 ? "green" : e.humeur <= 2 ? "red" : "amber"}>{e.humeur}/5</Badge>
                  <Badge tone="blue">demain: {e.energie_demain}/5</Badge>
                </div>
              </div>
              {e.realisations && <JournalRow label="✓ Réalisations" text={e.realisations} />}
              {e.blocages && <JournalRow label="⚡ Blocages" text={e.blocages} muted />}
              {e.idee_du_jour && <JournalRow label="💡 Idée" text={e.idee_du_jour} accent />}
              {e.note_libre && <JournalRow label="📝 Note libre" text={e.note_libre} muted />}
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Bilan du jour">
        <Field label="Humeur (1=épuisé · 5=au top)">
          <div className="flex flex-wrap gap-1.5">
            {[1, 2, 3, 4, 5].map((v) => (
              <button
                key={v}
                onClick={() => setHumeur(v)}
                className={`rounded-full border px-3 py-1.5 text-xs cursor-pointer ${
                  humeur === v ? "border-orange bg-orange/10 text-orange" : "border-border-strong text-ink-muted"
                }`}
              >
                {MOOD_EMOJIS[v]} {v}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Réalisations du jour">
          <textarea
            rows={3}
            value={form.realisations}
            onChange={(e) => setForm({ ...form, realisations: e.target.value })}
            className={inputClass}
            placeholder="Ce que tu as accompli..."
          />
        </Field>
        <Field label="Blocages / frustrations">
          <textarea
            rows={2}
            value={form.blocages}
            onChange={(e) => setForm({ ...form, blocages: e.target.value })}
            className={inputClass}
            placeholder="Ce qui a coincé..."
          />
        </Field>
        <Field label="Idée du jour">
          <input
            value={form.idee}
            onChange={(e) => setForm({ ...form, idee: e.target.value })}
            className={inputClass}
            placeholder="Une pensée qui a émergé..."
          />
        </Field>
        <Field label="Note libre">
          <textarea
            rows={2}
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            className={inputClass}
            placeholder="Ressenti, observations..."
          />
        </Field>
        <Field label="Énergie prévue demain">
          <div className="flex flex-wrap gap-1.5">
            {[1, 2, 3, 4, 5].map((v) => (
              <button
                key={v}
                onClick={() => setEnergie(v)}
                className={`rounded-full border px-3 py-1.5 text-xs cursor-pointer ${
                  energie === v ? "border-orange bg-orange/10 text-orange" : "border-border-strong text-ink-muted"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </Field>
        <Button variant="primary" className="w-full" onClick={saveEntry}>
          Enregistrer le bilan
        </Button>
      </Modal>
    </div>
  );
}

function JournalRow({ label, text, muted, accent }: { label: string; text: string; muted?: boolean; accent?: boolean }) {
  return (
    <div className="mb-2.5 last:mb-0">
      <div className="mb-0.5 font-mono text-[11px] uppercase tracking-wide text-ink-muted">{label}</div>
      <div className={`text-sm leading-relaxed ${accent ? "text-amber" : muted ? "text-ink-muted" : ""}`}>{text}</div>
    </div>
  );
}
