"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { SanemiRelation, SanemiRelationEntry } from "@/lib/types";
import { EMOTIONS } from "@/lib/patterns/constants";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Modal, Field, inputClass } from "@/components/ui/Modal";
import { Loader, Empty } from "../PlanningSection";

const RELATION_TYPES: { key: SanemiRelation["relation_type"]; label: string }[] = [
  { key: "famille", label: "Famille" },
  { key: "ami", label: "Ami" },
  { key: "partenaire", label: "Partenaire" },
  { key: "collegue", label: "Collègue" },
  { key: "autre", label: "Autre" },
];

const DYNAMIQUES = ["conflit", "besoin", "soutien", "tension", "rapprochement", "incompréhension", "gratitude"];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

export function RelationsTab() {
  const [relations, setRelations] = useState<SanemiRelation[]>([]);
  const [entries, setEntries] = useState<SanemiRelationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [relationOpen, setRelationOpen] = useState(false);
  const [relationForm, setRelationForm] = useState({ name: "", relation_type: "autre" as SanemiRelation["relation_type"], notes: "" });
  const [entryOpen, setEntryOpen] = useState(false);
  const [entryForm, setEntryForm] = useState({ dynamique: null as string | null, emotion: null as string | null, intensite: 5, description: "" });

  async function loadAll() {
    setLoading(true);
    const [r, e] = await Promise.all([
      supabase.from("sanemi_relations").select("*").order("created_at"),
      supabase.from("sanemi_relation_entries").select("*").order("logged_at", { ascending: false }),
    ]);
    setRelations(r.data ?? []);
    setEntries(e.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAll();
  }, []);

  const selected = relations.find((r) => r.id === selectedId) ?? null;
  const selectedEntries = entries.filter((e) => e.relation_id === selectedId);

  async function saveRelation() {
    const name = relationForm.name.trim();
    if (!name) return;
    const { data, error } = await supabase
      .from("sanemi_relations")
      .insert({ name, relation_type: relationForm.relation_type, notes: relationForm.notes.trim() || null })
      .select()
      .single();
    if (error || !data) return;
    setRelations((prev) => [...prev, data]);
    setSelectedId(data.id);
    setRelationForm({ name: "", relation_type: "autre", notes: "" });
    setRelationOpen(false);
  }

  async function deleteRelation(id: string) {
    if (!confirm("Supprimer cette personne et toutes les entrées associées ?")) return;
    const { error } = await supabase.from("sanemi_relations").delete().eq("id", id);
    if (error) return;
    setRelations((prev) => prev.filter((r) => r.id !== id));
    setEntries((prev) => prev.filter((e) => e.relation_id !== id));
    setSelectedId((prev) => (prev === id ? null : prev));
  }

  async function saveEntry() {
    if (!selectedId) return;
    const description = entryForm.description.trim();
    const { data, error } = await supabase
      .from("sanemi_relation_entries")
      .insert({
        relation_id: selectedId,
        dynamique: entryForm.dynamique,
        emotion: entryForm.emotion,
        intensite: entryForm.intensite,
        description: description || null,
      })
      .select()
      .single();
    if (error || !data) return;
    setEntries((prev) => [data, ...prev]);
    setEntryForm({ dynamique: null, emotion: null, intensite: 5, description: "" });
    setEntryOpen(false);
  }

  async function deleteEntry(id: string) {
    const { error } = await supabase.from("sanemi_relation_entries").delete().eq("id", id);
    if (error) return;
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  if (loading) return <Loader />;

  if (!selected) {
    return (
      <div className="flex flex-col gap-3.5">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <CardTitle>Relations suivies</CardTitle>
            <Button size="sm" variant="primary" onClick={() => setRelationOpen(true)}>
              + Personne
            </Button>
          </div>
          <p className="mb-3 text-xs text-ink-muted">
            Une fiche par personne pour noter les dynamiques qui reviennent avec elle : conflits, besoins, tensions, rapprochements.
          </p>
          {relations.length === 0 ? (
            <Empty>Aucune personne suivie pour l&apos;instant.</Empty>
          ) : (
            <ul className="flex flex-col gap-2">
              {relations.map((r) => {
                const count = entries.filter((e) => e.relation_id === r.id).length;
                const relType = RELATION_TYPES.find((t) => t.key === r.relation_type);
                return (
                  <li key={r.id}>
                    <button
                      onClick={() => setSelectedId(r.id)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-surface-2 px-3.5 py-2.5 text-left transition-colors hover:border-border-strong"
                    >
                      <div>
                        <div className="font-display text-sm font-bold">{r.name}</div>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <Badge tone="teal">{relType?.label}</Badge>
                          <span className="text-[10px] text-ink-dim">
                            {count} entrée{count > 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                      <span className="text-ink-dim">›</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Modal open={relationOpen} onClose={() => setRelationOpen(false)} title="Nouvelle personne">
          <Field label="Nom">
            <input
              value={relationForm.name}
              onChange={(e) => setRelationForm({ ...relationForm, name: e.target.value })}
              className={inputClass}
              placeholder="Prénom ou surnom"
            />
          </Field>
          <div className="mb-3">
            <div className="mb-1.5 font-mono text-[11px] uppercase tracking-wide text-ink-muted">Type</div>
            <div className="flex flex-wrap gap-1.5">
              {RELATION_TYPES.map((t) => (
                <Chip key={t.key} active={relationForm.relation_type === t.key} onClick={() => setRelationForm({ ...relationForm, relation_type: t.key })}>
                  {t.label}
                </Chip>
              ))}
            </div>
          </div>
          <Field label="Notes (optionnel)">
            <textarea
              rows={2}
              value={relationForm.notes}
              onChange={(e) => setRelationForm({ ...relationForm, notes: e.target.value })}
              className={inputClass}
              placeholder="Contexte général sur cette relation..."
            />
          </Field>
          <Button variant="primary" className="w-full" onClick={saveRelation}>
            Ajouter
          </Button>
        </Modal>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <button onClick={() => setSelectedId(null)} className="cursor-pointer text-xs text-ink-muted hover:text-ink">
          ‹ Toutes les relations
        </button>
        <button onClick={() => deleteRelation(selected.id)} className="cursor-pointer text-xs text-red hover:underline">
          Supprimer cette personne
        </button>
      </div>

      <Card>
        <div className="mb-1 flex items-center gap-2">
          <div className="font-display text-lg font-bold">{selected.name}</div>
          <Badge tone="teal">{RELATION_TYPES.find((t) => t.key === selected.relation_type)?.label}</Badge>
        </div>
        {selected.notes && <p className="text-xs text-ink-muted">{selected.notes}</p>}
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <CardTitle>Entrées</CardTitle>
          <Button size="sm" variant="primary" onClick={() => setEntryOpen(true)}>
            + Entrée
          </Button>
        </div>
        {selectedEntries.length === 0 ? (
          <Empty>Aucune entrée pour l&apos;instant.</Empty>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {selectedEntries.map((e) => (
              <li key={e.id} className="rounded-lg border border-border bg-surface-2 p-3">
                <div className="mb-1 flex items-center justify-between">
                  <div className="flex flex-wrap gap-1.5">
                    {e.dynamique && <Badge tone="amber">{e.dynamique}</Badge>}
                    {e.emotion && <Badge tone="purple">{e.emotion}</Badge>}
                    {e.intensite != null && <span className="text-[10px] text-ink-dim">intensité {e.intensite}/10</span>}
                  </div>
                  <button onClick={() => deleteEntry(e.id)} className="cursor-pointer px-1 text-ink-dim hover:text-red">
                    ✕
                  </button>
                </div>
                {e.description && <p className="text-xs text-ink-muted">{e.description}</p>}
                <div className="mt-1 text-[10px] text-ink-dim">{fmtDate(e.logged_at)}</div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal open={entryOpen} onClose={() => setEntryOpen(false)} title={`Nouvelle entrée — ${selected.name}`}>
        <div className="mb-3">
          <div className="mb-1.5 font-mono text-[11px] uppercase tracking-wide text-ink-muted">Dynamique</div>
          <div className="flex flex-wrap gap-1.5">
            {DYNAMIQUES.map((d) => (
              <Chip key={d} active={entryForm.dynamique === d} onClick={() => setEntryForm({ ...entryForm, dynamique: entryForm.dynamique === d ? null : d })}>
                {d}
              </Chip>
            ))}
          </div>
        </div>
        <div className="mb-3">
          <div className="mb-1.5 font-mono text-[11px] uppercase tracking-wide text-ink-muted">Émotion ressentie</div>
          <div className="flex flex-wrap gap-1.5">
            {EMOTIONS.map((em) => (
              <Chip key={em} active={entryForm.emotion === em} onClick={() => setEntryForm({ ...entryForm, emotion: entryForm.emotion === em ? null : em })}>
                {em}
              </Chip>
            ))}
          </div>
        </div>
        <Field label={`Intensité — ${entryForm.intensite}/10`}>
          <input
            type="range"
            min={1}
            max={10}
            value={entryForm.intensite}
            onChange={(e) => setEntryForm({ ...entryForm, intensite: Number(e.target.value) })}
            className="w-full"
          />
        </Field>
        <Field label="Ce qui s'est passé (optionnel)">
          <textarea
            rows={3}
            value={entryForm.description}
            onChange={(e) => setEntryForm({ ...entryForm, description: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Button variant="primary" className="w-full" onClick={saveEntry}>
          Enregistrer
        </Button>
      </Modal>
    </div>
  );
}
