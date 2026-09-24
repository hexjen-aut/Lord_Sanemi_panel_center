"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { SanemiSchema, SanemiSchemaLog } from "@/lib/types";
import { EMOTIONS } from "@/lib/patterns/constants";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Modal, Field, inputClass } from "@/components/ui/Modal";
import { Loader, Empty } from "../PlanningSection";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

export function SchemasTab() {
  const [schemas, setSchemas] = useState<SanemiSchema[]>([]);
  const [logs, setLogs] = useState<SanemiSchemaLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [schemaOpen, setSchemaOpen] = useState(false);
  const [schemaForm, setSchemaForm] = useState({ name: "", description: "" });
  const [logOpen, setLogOpen] = useState(false);
  const [logForm, setLogForm] = useState({
    situation: "",
    pensee_automatique: "",
    emotion: null as string | null,
    intensite: 5,
    reaction: "",
  });

  async function loadAll() {
    setLoading(true);
    const [s, l] = await Promise.all([
      supabase.from("sanemi_schemas").select("*").order("created_at"),
      supabase.from("sanemi_schema_logs").select("*").order("logged_at", { ascending: false }),
    ]);
    setSchemas(s.data ?? []);
    setLogs(l.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAll();
  }, []);

  const selected = schemas.find((s) => s.id === selectedId) ?? null;
  const selectedLogs = logs.filter((l) => l.schema_id === selectedId);

  async function saveSchema() {
    const name = schemaForm.name.trim();
    if (!name) return;
    const { data, error } = await supabase
      .from("sanemi_schemas")
      .insert({ name, description: schemaForm.description.trim() || null })
      .select()
      .single();
    if (error || !data) return;
    setSchemas((prev) => [...prev, data]);
    setSelectedId(data.id);
    setSchemaForm({ name: "", description: "" });
    setSchemaOpen(false);
  }

  async function deleteSchema(id: string) {
    if (!confirm("Supprimer ce schéma et toutes les entrées associées ?")) return;
    const { error } = await supabase.from("sanemi_schemas").delete().eq("id", id);
    if (error) return;
    setSchemas((prev) => prev.filter((s) => s.id !== id));
    setLogs((prev) => prev.filter((l) => l.schema_id !== id));
    setSelectedId((prev) => (prev === id ? null : prev));
  }

  async function saveLog() {
    if (!selectedId) return;
    const situation = logForm.situation.trim();
    if (!situation) return;
    const { data, error } = await supabase
      .from("sanemi_schema_logs")
      .insert({
        schema_id: selectedId,
        situation,
        pensee_automatique: logForm.pensee_automatique.trim() || null,
        emotion: logForm.emotion,
        intensite: logForm.intensite,
        reaction: logForm.reaction.trim() || null,
      })
      .select()
      .single();
    if (error || !data) return;
    setLogs((prev) => [data, ...prev]);
    setLogForm({ situation: "", pensee_automatique: "", emotion: null, intensite: 5, reaction: "" });
    setLogOpen(false);
  }

  async function deleteLog(id: string) {
    const { error } = await supabase.from("sanemi_schema_logs").delete().eq("id", id);
    if (error) return;
    setLogs((prev) => prev.filter((l) => l.id !== id));
  }

  if (loading) return <Loader />;

  if (!selected) {
    return (
      <div className="flex flex-col gap-3.5">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <CardTitle>Schémas suivis</CardTitle>
            <Button size="sm" variant="primary" onClick={() => setSchemaOpen(true)}>
              + Schéma
            </Button>
          </div>
          <p className="mb-3 text-xs text-ink-muted">
            Un schéma est une pensée automatique récurrente (ex: abandon, échec, injustice) déclenchée par certaines situations. Chaque entrée relie une
            situation à la pensée, l&apos;émotion et la réaction qui suivent.
          </p>
          {schemas.length === 0 ? (
            <Empty>Aucun schéma pour l&apos;instant.</Empty>
          ) : (
            <ul className="flex flex-col gap-2">
              {schemas.map((s) => {
                const count = logs.filter((l) => l.schema_id === s.id).length;
                return (
                  <li key={s.id}>
                    <button
                      onClick={() => setSelectedId(s.id)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-surface-2 px-3.5 py-2.5 text-left transition-colors hover:border-border-strong"
                    >
                      <div>
                        <div className="font-display text-sm font-bold">{s.name}</div>
                        <div className="mt-0.5 text-[10px] text-ink-dim">
                          {count} entrée{count > 1 ? "s" : ""}
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

        <Modal open={schemaOpen} onClose={() => setSchemaOpen(false)} title="Nouveau schéma">
          <Field label="Nom">
            <input
              value={schemaForm.name}
              onChange={(e) => setSchemaForm({ ...schemaForm, name: e.target.value })}
              className={inputClass}
              placeholder="Ex: Abandon, Échec, Injustice..."
            />
          </Field>
          <Field label="Description (optionnel)">
            <textarea
              rows={2}
              value={schemaForm.description}
              onChange={(e) => setSchemaForm({ ...schemaForm, description: e.target.value })}
              className={inputClass}
              placeholder="Ce que ce schéma représente pour toi..."
            />
          </Field>
          <Button variant="primary" className="w-full" onClick={saveSchema}>
            Créer
          </Button>
        </Modal>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <button onClick={() => setSelectedId(null)} className="cursor-pointer text-xs text-ink-muted hover:text-ink">
          ‹ Tous les schémas
        </button>
        <button onClick={() => deleteSchema(selected.id)} className="cursor-pointer text-xs text-red hover:underline">
          Supprimer ce schéma
        </button>
      </div>

      <Card>
        <div className="font-display text-lg font-bold">{selected.name}</div>
        {selected.description && <p className="mt-1 text-xs text-ink-muted">{selected.description}</p>}
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <CardTitle>Entrées</CardTitle>
          <Button size="sm" variant="primary" onClick={() => setLogOpen(true)}>
            + Entrée
          </Button>
        </div>
        {selectedLogs.length === 0 ? (
          <Empty>Aucune entrée pour l&apos;instant.</Empty>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {selectedLogs.map((l) => (
              <li key={l.id} className="rounded-lg border border-border bg-surface-2 p-3">
                <div className="mb-1 flex items-start justify-between gap-2">
                  <div className="text-sm">
                    <b>Situation :</b> {l.situation}
                  </div>
                  <button onClick={() => deleteLog(l.id)} className="shrink-0 cursor-pointer px-1 text-ink-dim hover:text-red">
                    ✕
                  </button>
                </div>
                {l.pensee_automatique && (
                  <p className="mb-1 text-xs text-ink-muted">
                    <b>Pensée :</b> {l.pensee_automatique}
                  </p>
                )}
                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                  {l.emotion && <Badge tone="purple">{l.emotion}</Badge>}
                  {l.intensite != null && <span className="text-[10px] text-ink-dim">intensité {l.intensite}/10</span>}
                </div>
                {l.reaction && (
                  <p className="text-xs text-ink-muted">
                    <b>Réaction :</b> {l.reaction}
                  </p>
                )}
                <div className="mt-1 text-[10px] text-ink-dim">{fmtDate(l.logged_at)}</div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal open={logOpen} onClose={() => setLogOpen(false)} title={`Nouvelle entrée — ${selected.name}`}>
        <Field label="Situation">
          <textarea
            rows={2}
            value={logForm.situation}
            onChange={(e) => setLogForm({ ...logForm, situation: e.target.value })}
            className={inputClass}
            placeholder="Qu'est-ce qui s'est passé ?"
          />
        </Field>
        <Field label="Pensée automatique (optionnel)">
          <textarea
            rows={2}
            value={logForm.pensee_automatique}
            onChange={(e) => setLogForm({ ...logForm, pensee_automatique: e.target.value })}
            className={inputClass}
            placeholder="Ce qui t'es passé par la tête sur le moment..."
          />
        </Field>
        <div className="mb-3">
          <div className="mb-1.5 font-mono text-[11px] uppercase tracking-wide text-ink-muted">Émotion</div>
          <div className="flex flex-wrap gap-1.5">
            {EMOTIONS.map((em) => (
              <Chip key={em} active={logForm.emotion === em} onClick={() => setLogForm({ ...logForm, emotion: logForm.emotion === em ? null : em })}>
                {em}
              </Chip>
            ))}
          </div>
        </div>
        <Field label={`Intensité — ${logForm.intensite}/10`}>
          <input
            type="range"
            min={1}
            max={10}
            value={logForm.intensite}
            onChange={(e) => setLogForm({ ...logForm, intensite: Number(e.target.value) })}
            className="w-full"
          />
        </Field>
        <Field label="Réaction / comportement adopté (optionnel)">
          <textarea
            rows={2}
            value={logForm.reaction}
            onChange={(e) => setLogForm({ ...logForm, reaction: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Button variant="primary" className="w-full" onClick={saveLog}>
          Enregistrer
        </Button>
      </Modal>
    </div>
  );
}
