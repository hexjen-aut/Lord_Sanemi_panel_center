"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { SanemiTransaction } from "@/lib/types";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Modal, Field, inputClass } from "@/components/ui/Modal";
import { Loader, Empty } from "./PlanningSection";

const RULES = [
  { key: "besoins", pct: 0.5, label: "🏠 Besoins — 50%", desc: "Loyer, nourriture, transport, téléphone", tone: "green" as const },
  { key: "projets", pct: 0.3, label: "📈 Projets — 30%", desc: "WennaShop, Myria, Hexjen, outils", tone: "orange" as const },
  { key: "epargne", pct: 0.15, label: "💰 Épargne — 15%", desc: "Fonds de secours · 3 mois minimum", tone: "amber" as const },
  { key: "liberte", pct: 0.05, label: "🎯 Liberté — 5%", desc: "Sorties, plaisirs, impulsions maîtrisées", tone: "teal" as const },
];

const PROTOCOL = [
  { title: "Stop — 48h sans dépenser", desc: "Laisser l'émotion passer" },
  { title: "Appliquer la règle 50/30/15/5", desc: "Calculer à gauche" },
  { title: "Épargne d'abord — virement immédiat", desc: "Hors de portée" },
  { title: "1 seul investissement projet", desc: "WennaShop → Myria → Hexjen" },
];

const fmt = (n: number) => `${n.toLocaleString("fr-FR")} MAD`;

export function FinanceSection({ userId }: { userId: string }) {
  const [txs, setTxs] = useState<SanemiTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [revOpen, setRevOpen] = useState(false);
  const [depOpen, setDepOpen] = useState(false);
  const [revForm, setRevForm] = useState({ source: "", amount: "", type: "prevu" });
  const [depForm, setDepForm] = useState({ label: "", amount: "", category: "besoins" });

  async function loadTx() {
    setLoading(true);
    const { data, error } = await supabase
      .from("sanemi_transactions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (!error) setTxs(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadTx();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const totals = useMemo(() => {
    const rev = txs.filter((t) => t.type === "revenu").reduce((s, t) => s + Number(t.amount), 0);
    const dep = txs.filter((t) => t.type === "depense").reduce((s, t) => s + Number(t.amount), 0);
    return { rev, dep, epargne: Math.round(rev * 0.15), dispo: Math.max(0, rev - dep) };
  }, [txs]);

  async function saveRevenu() {
    const amount = parseFloat(revForm.amount);
    if (!amount || !revForm.source.trim()) return;
    await supabase.from("sanemi_transactions").insert({
      type: "revenu",
      label: revForm.source,
      source: revForm.source,
      amount,
      rev_type: revForm.type,
      category: "revenu",
      user_id: userId,
    });
    await loadTx();
    setRevForm({ source: "", amount: "", type: "prevu" });
    setRevOpen(false);
  }

  async function saveDepense() {
    const amount = parseFloat(depForm.amount);
    if (!amount || !depForm.label.trim()) return;
    await supabase.from("sanemi_transactions").insert({
      type: "depense",
      label: depForm.label,
      amount,
      category: depForm.category,
      user_id: userId,
    });
    await loadTx();
    setDepForm({ label: "", amount: "", category: "besoins" });
    setDepOpen(false);
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <div className="font-display text-xl font-extrabold">Finance</div>
          <div className="text-xs text-ink-muted">MAD · Casablanca</div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setRevOpen(true)}>
            + Revenu
          </Button>
          <Button size="sm" onClick={() => setDepOpen(true)}>
            + Dépense
          </Button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card accent>
          <CardTitle>Revenus</CardTitle>
          <div className="font-display text-2xl font-bold text-orange">{fmt(totals.rev)}</div>
        </Card>
        <Card>
          <CardTitle>Dépenses</CardTitle>
          <div className="font-display text-2xl font-bold">{fmt(totals.dep)}</div>
        </Card>
        <Card>
          <CardTitle>Épargne (15%)</CardTitle>
          <div className="font-display text-2xl font-bold text-green">{fmt(totals.epargne)}</div>
        </Card>
        <Card>
          <CardTitle>Disponible</CardTitle>
          <div className="font-display text-2xl font-bold text-teal">{fmt(totals.dispo)}</div>
        </Card>
      </div>

      <div className="grid gap-3.5 lg:grid-cols-2">
        <Card>
          <CardTitle>Règles 50/30/15/5</CardTitle>
          {RULES.map((r) => {
            const value = Math.round(totals.rev * r.pct);
            return (
              <div key={r.key} className="mb-2 rounded-lg border border-border bg-surface-2 p-3.5 last:mb-0">
                <div className="mb-0.5 font-display text-xs font-bold">{r.label}</div>
                <div className="mb-2 text-[11px] text-ink-muted">{r.desc}</div>
                <ProgressBar value={r.pct * 100} tone={r.tone === "orange" ? "orange" : r.tone} />
                <div className="mt-1 text-[11px] text-ink-muted">{totals.rev > 0 ? fmt(value) : "— MAD"}</div>
              </div>
            );
          })}
        </Card>

        <div className="flex flex-col gap-3.5">
          <Card>
            <CardTitle>Entrée imprévue — protocole</CardTitle>
            {PROTOCOL.map((s, i) => (
              <div key={s.title} className="flex items-start gap-2.5 border-b border-border py-2.5 last:border-none">
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-orange/40 bg-orange/10 font-mono text-[10px] text-orange">
                  {i + 1}
                </div>
                <div>
                  <div className="text-sm font-medium">{s.title}</div>
                  <div className="text-[11px] text-ink-muted">{s.desc}</div>
                </div>
              </div>
            ))}
          </Card>
          <Card>
            <CardTitle>Transactions récentes</CardTitle>
            {loading ? (
              <Loader />
            ) : txs.length === 0 ? (
              <Empty>Aucune transaction</Empty>
            ) : (
              txs.slice(0, 8).map((t) => (
                <div key={t.id} className="flex items-start gap-2.5 border-b border-border py-2.5 last:border-none">
                  <div className="flex-1">
                    <div className="text-sm">{t.label || t.source || "—"}</div>
                    <div className="mt-1 flex gap-1">
                      <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[10px] text-ink-muted">
                        {t.category || t.rev_type || "—"}
                      </span>
                      <span className="text-[10px] text-ink-dim">
                        {new Date(t.created_at).toLocaleDateString("fr-FR")}
                      </span>
                    </div>
                  </div>
                  <div className={`font-mono text-sm font-medium ${t.type === "revenu" ? "text-green" : "text-red"}`}>
                    {t.type === "revenu" ? "+" : "-"}
                    {fmt(Number(t.amount))}
                  </div>
                </div>
              ))
            )}
          </Card>
        </div>
      </div>

      <Modal open={revOpen} onClose={() => setRevOpen(false)} title="Enregistrer un revenu">
        <Field label="Source">
          <input
            value={revForm.source}
            onChange={(e) => setRevForm({ ...revForm, source: e.target.value })}
            className={inputClass}
            placeholder="Ex: Hexjen — client website"
          />
        </Field>
        <div className="mb-3 grid grid-cols-2 gap-2.5">
          <Field label="Montant (MAD)">
            <input
              type="number"
              value={revForm.amount}
              onChange={(e) => setRevForm({ ...revForm, amount: e.target.value })}
              className={inputClass}
              placeholder="3500"
            />
          </Field>
          <Field label="Type">
            <select
              value={revForm.type}
              onChange={(e) => setRevForm({ ...revForm, type: e.target.value })}
              className={inputClass}
            >
              <option value="prevu">Prévu</option>
              <option value="imprévu">Imprévu</option>
            </select>
          </Field>
        </div>
        <Button variant="primary" className="w-full" onClick={saveRevenu}>
          Enregistrer & Répartir
        </Button>
      </Modal>

      <Modal open={depOpen} onClose={() => setDepOpen(false)} title="Enregistrer une dépense">
        <Field label="Libellé">
          <input
            value={depForm.label}
            onChange={(e) => setDepForm({ ...depForm, label: e.target.value })}
            className={inputClass}
            placeholder="Ex: Hébergement Netlify"
          />
        </Field>
        <div className="mb-3 grid grid-cols-2 gap-2.5">
          <Field label="Montant (MAD)">
            <input
              type="number"
              value={depForm.amount}
              onChange={(e) => setDepForm({ ...depForm, amount: e.target.value })}
              className={inputClass}
              placeholder="120"
            />
          </Field>
          <Field label="Catégorie">
            <select
              value={depForm.category}
              onChange={(e) => setDepForm({ ...depForm, category: e.target.value })}
              className={inputClass}
            >
              <option value="besoins">Besoins</option>
              <option value="projets">Projets</option>
              <option value="liberte">Liberté</option>
            </select>
          </Field>
        </div>
        <Button variant="primary" className="w-full" onClick={saveDepense}>
          Enregistrer
        </Button>
      </Modal>
    </div>
  );
}
