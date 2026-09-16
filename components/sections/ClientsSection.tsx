"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { CLIENT_STATUSES, type ClientStatus } from "@/lib/constants";
import type { SanemiClient } from "@/lib/types";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Modal, Field, inputClass } from "@/components/ui/Modal";
import { Loader, Empty } from "./PlanningSection";

const fmt = (n: number) => `${n.toLocaleString("fr-FR")} MAD`;

const FILTERS: { key: "all" | ClientStatus; label: string }[] = [
  { key: "all", label: "Tous" },
  ...CLIENT_STATUSES.map((s) => ({ key: s.key, label: s.label })),
];

export function ClientsSection({ userId }: { userId: string }) {
  const [clients, setClients] = useState<SanemiClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | ClientStatus>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    contact: "",
    status: "contact" as ClientStatus,
    estimated_value: "",
    next_action: "",
    next_action_date: "",
    notes: "",
  });

  async function loadClients() {
    setLoading(true);
    const { data, error } = await supabase
      .from("sanemi_clients")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (!error) setClients(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const totals = useMemo(() => {
    const actifs = clients.filter((c) => c.status !== "perdu" && c.status !== "livre");
    const pipeline = actifs.reduce((s, c) => s + Number(c.estimated_value), 0);
    const signe = clients
      .filter((c) => c.status === "signe" || c.status === "livre")
      .reduce((s, c) => s + Number(c.estimated_value), 0);
    return { pipeline, signe, actifs: actifs.length };
  }, [clients]);

  async function changeStatus(id: string, status: ClientStatus) {
    setClients((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
    await supabase.from("sanemi_clients").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  }

  async function deleteClient(id: string) {
    setClients((prev) => prev.filter((c) => c.id !== id));
    await supabase.from("sanemi_clients").delete().eq("id", id);
  }

  async function saveClient() {
    if (!form.name.trim()) return;
    const value = parseFloat(form.estimated_value) || 0;
    await supabase.from("sanemi_clients").insert({
      name: form.name.trim(),
      contact: form.contact.trim() || null,
      status: form.status,
      estimated_value: value,
      next_action: form.next_action.trim() || null,
      next_action_date: form.next_action_date || null,
      notes: form.notes.trim() || null,
      user_id: userId,
    });
    await loadClients();
    setForm({ name: "", contact: "", status: "contact", estimated_value: "", next_action: "", next_action_date: "", notes: "" });
    setModalOpen(false);
  }

  const filtered = clients.filter((c) => filter === "all" || c.status === filter);

  return (
    <div className="animate-fade-in">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <div className="font-display text-xl font-extrabold">Pipeline Clients</div>
          <div className="text-xs text-ink-muted">Hexjen Conceptions</div>
        </div>
        <Button size="sm" variant="primary" onClick={() => setModalOpen(true)}>
          + Client
        </Button>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3">
        <Card accent>
          <CardTitle>Pipeline actif</CardTitle>
          <div className="font-display text-2xl font-bold text-orange">{fmt(totals.pipeline)}</div>
        </Card>
        <Card>
          <CardTitle>Valeur signée</CardTitle>
          <div className="font-display text-2xl font-bold text-green">{fmt(totals.signe)}</div>
        </Card>
        <Card>
          <CardTitle>Clients actifs</CardTitle>
          <div className="font-display text-2xl font-bold">{totals.actifs}</div>
        </Card>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <Chip key={f.key} active={filter === f.key} onClick={() => setFilter(f.key)}>
            {f.label}
          </Chip>
        ))}
      </div>

      {loading ? (
        <Loader />
      ) : filtered.length === 0 ? (
        <Empty>Aucun client dans cette catégorie</Empty>
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => {
            const statusMeta = CLIENT_STATUSES.find((s) => s.key === c.status)!;
            return (
              <Card key={c.id}>
                <div className="mb-1.5 flex items-start justify-between gap-2">
                  <div className="font-display text-sm font-bold">{c.name}</div>
                  <button
                    onClick={() => deleteClient(c.id)}
                    className="shrink-0 cursor-pointer px-1 text-ink-dim hover:text-red"
                  >
                    ✕
                  </button>
                </div>
                {c.contact && <div className="mb-2 text-xs text-ink-muted">{c.contact}</div>}
                <div className="mb-2.5 flex items-center justify-between">
                  <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
                  <div className="font-mono text-sm font-medium text-orange">{fmt(Number(c.estimated_value))}</div>
                </div>
                {c.next_action && (
                  <div className="mb-2 rounded-lg border border-border bg-surface-2 p-2.5">
                    <div className="text-xs">{c.next_action}</div>
                    {c.next_action_date && (
                      <div className="mt-0.5 text-[10px] text-ink-dim">
                        {new Date(c.next_action_date).toLocaleDateString("fr-FR")}
                      </div>
                    )}
                  </div>
                )}
                {c.notes && <div className="mb-2 text-xs leading-relaxed text-ink-muted">{c.notes}</div>}
                <select
                  value={c.status}
                  onChange={(e) => changeStatus(c.id, e.target.value as ClientStatus)}
                  className={inputClass}
                >
                  {CLIENT_STATUSES.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nouveau client">
        <Field label="Nom / entreprise">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={inputClass}
            placeholder="Ex: Café Atlas"
          />
        </Field>
        <Field label="Contact (optionnel)">
          <input
            value={form.contact}
            onChange={(e) => setForm({ ...form, contact: e.target.value })}
            className={inputClass}
            placeholder="Téléphone, email..."
          />
        </Field>
        <div className="mb-3 grid grid-cols-2 gap-2.5">
          <Field label="Statut">
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as ClientStatus })}
              className={inputClass}
            >
              {CLIENT_STATUSES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Valeur estimée (MAD)">
            <input
              type="number"
              value={form.estimated_value}
              onChange={(e) => setForm({ ...form, estimated_value: e.target.value })}
              className={inputClass}
              placeholder="5000"
            />
          </Field>
        </div>
        <Field label="Prochaine action (optionnel)">
          <input
            value={form.next_action}
            onChange={(e) => setForm({ ...form, next_action: e.target.value })}
            className={inputClass}
            placeholder="Relancer, envoyer devis..."
          />
        </Field>
        <Field label="Date de l'action (optionnel)">
          <input
            type="date"
            value={form.next_action_date}
            onChange={(e) => setForm({ ...form, next_action_date: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="Notes (optionnel)">
          <textarea
            rows={3}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className={inputClass}
            placeholder="Contexte, besoin, budget..."
          />
        </Field>
        <Button variant="primary" className="w-full" onClick={saveClient}>
          Ajouter au pipeline
        </Button>
      </Modal>
    </div>
  );
}
