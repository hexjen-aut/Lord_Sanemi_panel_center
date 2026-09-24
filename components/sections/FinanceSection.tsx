"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { SanemiRecurringCharge, SanemiTransaction } from "@/lib/types";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Modal, Field, inputClass } from "@/components/ui/Modal";
import { Loader, Empty } from "./PlanningSection";
import { AccountsCard } from "./finance/AccountsCard";
import { PlannedExpensesCard } from "./finance/PlannedExpensesCard";

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

type Period = "semaine" | "mois" | "annee" | "tout";
const PERIODS: { key: Period; label: string }[] = [
  { key: "semaine", label: "Semaine" },
  { key: "mois", label: "Mois" },
  { key: "annee", label: "Année" },
  { key: "tout", label: "Tout" },
];

const fmt = (n: number) => `${n.toLocaleString("fr-FR")} MAD`;

function periodStart(period: Period): Date | null {
  const now = new Date();
  if (period === "tout") return null;
  if (period === "annee") return new Date(now.getFullYear(), 0, 1);
  if (period === "mois") return new Date(now.getFullYear(), now.getMonth(), 1);
  const day = now.getDay();
  const diffToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function lastMonths(n: number): { key: string; label: string }[] {
  const now = new Date();
  const months = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("fr-FR", { month: "short" }),
    });
  }
  return months;
}

function MonthlyChart({ txs }: { txs: SanemiTransaction[] }) {
  const monthly = useMemo(() => {
    const months = lastMonths(6);
    return months.map((m) => {
      const rev = txs
        .filter((t) => t.type === "revenu" && t.created_at.slice(0, 7) === m.key)
        .reduce((s, t) => s + Number(t.amount), 0);
      const dep = txs
        .filter((t) => t.type === "depense" && t.created_at.slice(0, 7) === m.key)
        .reduce((s, t) => s + Number(t.amount), 0);
      return { ...m, rev, dep };
    });
  }, [txs]);

  const W = 600;
  const H = 140;
  const PAD = 12;
  const max = Math.max(1, ...monthly.flatMap((m) => [m.rev, m.dep]));
  const x = (i: number) => PAD + (i * (W - PAD * 2)) / Math.max(1, monthly.length - 1);
  const y = (v: number) => H - PAD - (v / max) * (H - PAD * 2);
  const revPoints = monthly.map((m, i) => `${x(i)},${y(m.rev)}`).join(" ");
  const depPoints = monthly.map((m, i) => `${x(i)},${y(m.dep)}`).join(" ");

  return (
    <Card>
      <CardTitle>Évolution mensuelle (6 derniers mois)</CardTitle>
      <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full" role="img" aria-label="Évolution mensuelle des revenus et dépenses">
        {[0, 0.5, 1].map((f) => (
          <line
            key={f}
            x1={PAD}
            x2={W - PAD}
            y1={H - PAD - f * (H - PAD * 2)}
            y2={H - PAD - f * (H - PAD * 2)}
            stroke="var(--color-border)"
            strokeWidth={1}
          />
        ))}
        <polyline points={revPoints} fill="none" stroke="var(--color-green)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <polyline
          points={depPoints}
          fill="none"
          stroke="var(--color-red)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="5 4"
        />
        {monthly.map((m, i) => (
          <g key={m.key}>
            <circle cx={x(i)} cy={y(m.rev)} r={3.5} fill="var(--color-green)">
              <title>{`${m.label} — Revenus : ${fmt(m.rev)}`}</title>
            </circle>
            <rect x={x(i) - 3} y={y(m.dep) - 3} width={6} height={6} fill="var(--color-red)">
              <title>{`${m.label} — Dépenses : ${fmt(m.dep)}`}</title>
            </rect>
            <text x={x(i)} y={H + 14} textAnchor="middle" className="fill-ink-dim" style={{ fontSize: 9 }}>
              {m.label}
            </text>
          </g>
        ))}
      </svg>
      <div className="mt-1 flex items-center gap-4 text-[11px] text-ink-muted">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-green" /> Revenus (ligne pleine)
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 bg-red" /> Dépenses (pointillé)
        </div>
      </div>
    </Card>
  );
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function FinanceSection({ userId }: { userId: string }) {
  const [txs, setTxs] = useState<SanemiTransaction[]>([]);
  const [charges, setCharges] = useState<SanemiRecurringCharge[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("mois");

  const [revOpen, setRevOpen] = useState(false);
  const [depOpen, setDepOpen] = useState(false);
  const [chargeOpen, setChargeOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [revForm, setRevForm] = useState({ source: "", amount: "", type: "prevu" });
  const [depForm, setDepForm] = useState({ label: "", amount: "", category: "besoins" });
  const [chargeForm, setChargeForm] = useState({ label: "", amount: "", day_of_month: "1", category: "besoins" as SanemiRecurringCharge["category"] });

  async function loadAll() {
    setLoading(true);
    const [txRes, chargesRes] = await Promise.all([
      supabase.from("sanemi_transactions").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("sanemi_recurring_charges").select("*").eq("user_id", userId).order("day_of_month"),
    ]);
    if (!txRes.error) setTxs(txRes.data ?? []);
    if (!chargesRes.error) setCharges(chargesRes.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const filteredTxs = useMemo(() => {
    const start = periodStart(period);
    if (!start) return txs;
    return txs.filter((t) => new Date(t.created_at) >= start);
  }, [txs, period]);

  const totals = useMemo(() => {
    const rev = filteredTxs.filter((t) => t.type === "revenu").reduce((s, t) => s + Number(t.amount), 0);
    const dep = filteredTxs.filter((t) => t.type === "depense").reduce((s, t) => s + Number(t.amount), 0);
    return { rev, dep, epargne: Math.round(rev * 0.15), dispo: Math.max(0, rev - dep) };
  }, [filteredTxs]);

  function resetRevForm() {
    setRevForm({ source: "", amount: "", type: "prevu" });
    setEditingId(null);
    setRevOpen(false);
  }

  function resetDepForm() {
    setDepForm({ label: "", amount: "", category: "besoins" });
    setEditingId(null);
    setDepOpen(false);
  }

  function openEditTx(t: SanemiTransaction) {
    setEditingId(t.id);
    if (t.type === "revenu") {
      setRevForm({ source: t.source ?? t.label ?? "", amount: String(t.amount), type: t.rev_type ?? "prevu" });
      setRevOpen(true);
    } else {
      setDepForm({ label: t.label ?? "", amount: String(t.amount), category: t.category });
      setDepOpen(true);
    }
  }

  async function deleteTx(id: string) {
    setTxs((prev) => prev.filter((t) => t.id !== id));
    await supabase.from("sanemi_transactions").delete().eq("id", id);
  }

  async function saveRevenu() {
    const amount = parseFloat(revForm.amount);
    if (!amount || !revForm.source.trim()) return;
    if (editingId) {
      await supabase
        .from("sanemi_transactions")
        .update({ label: revForm.source, source: revForm.source, amount, rev_type: revForm.type })
        .eq("id", editingId);
    } else {
      await supabase.from("sanemi_transactions").insert({
        type: "revenu",
        label: revForm.source,
        source: revForm.source,
        amount,
        rev_type: revForm.type,
        category: "revenu",
        user_id: userId,
      });
    }
    await loadAll();
    resetRevForm();
  }

  async function saveDepense() {
    const amount = parseFloat(depForm.amount);
    if (!amount || !depForm.label.trim()) return;
    if (editingId) {
      await supabase
        .from("sanemi_transactions")
        .update({ label: depForm.label, amount, category: depForm.category })
        .eq("id", editingId);
    } else {
      await supabase.from("sanemi_transactions").insert({
        type: "depense",
        label: depForm.label,
        amount,
        category: depForm.category,
        user_id: userId,
      });
    }
    await loadAll();
    resetDepForm();
  }

  async function saveCharge() {
    const amount = parseFloat(chargeForm.amount);
    const day = parseInt(chargeForm.day_of_month, 10);
    if (!amount || !chargeForm.label.trim() || !day || day < 1 || day > 31) return;
    await supabase.from("sanemi_recurring_charges").insert({
      label: chargeForm.label.trim(),
      amount,
      day_of_month: day,
      category: chargeForm.category,
      user_id: userId,
    });
    await loadAll();
    setChargeForm({ label: "", amount: "", day_of_month: "1", category: "besoins" });
    setChargeOpen(false);
  }

  async function markChargePaid(c: SanemiRecurringCharge) {
    const month = currentMonthKey();
    await supabase.from("sanemi_transactions").insert({
      type: "depense",
      label: c.label,
      amount: c.amount,
      category: c.category,
      user_id: userId,
    });
    await supabase.from("sanemi_recurring_charges").update({ last_paid_month: month }).eq("id", c.id);
    await loadAll();
  }

  async function deleteCharge(id: string) {
    setCharges((prev) => prev.filter((c) => c.id !== id));
    await supabase.from("sanemi_recurring_charges").delete().eq("id", id);
  }

  function exportCsv() {
    const rows = [
      ["Date", "Type", "Libellé", "Catégorie", "Montant (MAD)"],
      ...filteredTxs.map((t) => [
        new Date(t.created_at).toLocaleDateString("fr-FR"),
        t.type,
        t.label || t.source || "",
        t.category || t.rev_type || "",
        String(t.amount),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finance-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const monthKey = currentMonthKey();

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

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {PERIODS.map((p) => (
            <Chip key={p.key} active={period === p.key} onClick={() => setPeriod(p.key)}>
              {p.label}
            </Chip>
          ))}
        </div>
        <Button size="sm" onClick={exportCsv}>
          Exporter CSV
        </Button>
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

      <div className="mb-4">
        <MonthlyChart txs={txs} />
      </div>

      <div className="grid gap-3.5 lg:grid-cols-2">
        <div className="flex flex-col gap-3.5">
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

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <CardTitle>Charges fixes & récurrentes</CardTitle>
              <button onClick={() => setChargeOpen(true)} className="cursor-pointer text-xs text-orange hover:underline">
                + Ajouter
              </button>
            </div>
            {charges.length === 0 ? (
              <Empty>Aucune charge fixe enregistrée</Empty>
            ) : (
              charges.map((c) => {
                const paidThisMonth = c.last_paid_month === monthKey;
                return (
                  <div key={c.id} className="flex items-center gap-2.5 border-b border-border py-2.5 last:border-none">
                    <div className="flex-1">
                      <div className="text-sm">{c.label}</div>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[10px] text-ink-muted">
                          Le {c.day_of_month} · {c.category}
                        </span>
                        <Badge tone={paidThisMonth ? "green" : "amber"}>{paidThisMonth ? "Payé ce mois" : "À payer"}</Badge>
                      </div>
                    </div>
                    <div className="font-mono text-sm font-medium">{fmt(Number(c.amount))}</div>
                    {!paidThisMonth && (
                      <Button size="sm" onClick={() => markChargePaid(c)}>
                        Payer
                      </Button>
                    )}
                    <button onClick={() => deleteCharge(c.id)} className="cursor-pointer px-1 text-ink-dim hover:text-red">
                      ✕
                    </button>
                  </div>
                );
              })
            )}
          </Card>

          <AccountsCard />
          <PlannedExpensesCard userId={userId} />
        </div>

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
            <CardTitle>Transactions {period !== "tout" ? `— ${PERIODS.find((p) => p.key === period)?.label.toLowerCase()}` : ""}</CardTitle>
            {loading ? (
              <Loader />
            ) : filteredTxs.length === 0 ? (
              <Empty>Aucune transaction</Empty>
            ) : (
              filteredTxs.slice(0, 12).map((t) => (
                <div key={t.id} className="flex items-start gap-2.5 border-b border-border py-2.5 last:border-none">
                  <div className="flex-1">
                    <div className="text-sm">{t.label || t.source || "—"}</div>
                    <div className="mt-1 flex gap-1">
                      <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[10px] text-ink-muted">
                        {t.category || t.rev_type || "—"}
                      </span>
                      <span className="text-[10px] text-ink-dim">{new Date(t.created_at).toLocaleDateString("fr-FR")}</span>
                      {t.related_order_id && (
                        <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[10px] text-ink-muted">Facturation</span>
                      )}
                    </div>
                  </div>
                  <div className={`font-mono text-sm font-medium ${t.type === "revenu" ? "text-green" : "text-red"}`}>
                    {t.type === "revenu" ? "+" : "-"}
                    {fmt(Number(t.amount))}
                  </div>
                  <button onClick={() => openEditTx(t)} className="cursor-pointer px-1 text-ink-dim hover:text-ink">
                    ✎
                  </button>
                  <button onClick={() => deleteTx(t.id)} className="cursor-pointer px-1 text-ink-dim hover:text-red">
                    ✕
                  </button>
                </div>
              ))
            )}
          </Card>
        </div>
      </div>

      <Modal open={revOpen} onClose={resetRevForm} title={editingId ? "Modifier le revenu" : "Enregistrer un revenu"}>
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
            <select value={revForm.type} onChange={(e) => setRevForm({ ...revForm, type: e.target.value })} className={inputClass}>
              <option value="prevu">Prévu</option>
              <option value="imprévu">Imprévu</option>
            </select>
          </Field>
        </div>
        <Button variant="primary" className="w-full" onClick={saveRevenu}>
          {editingId ? "Enregistrer les modifications" : "Enregistrer & Répartir"}
        </Button>
      </Modal>

      <Modal open={depOpen} onClose={resetDepForm} title={editingId ? "Modifier la dépense" : "Enregistrer une dépense"}>
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
            <select value={depForm.category} onChange={(e) => setDepForm({ ...depForm, category: e.target.value })} className={inputClass}>
              <option value="besoins">Besoins</option>
              <option value="projets">Projets</option>
              <option value="liberte">Liberté</option>
            </select>
          </Field>
        </div>
        <Button variant="primary" className="w-full" onClick={saveDepense}>
          {editingId ? "Enregistrer les modifications" : "Enregistrer"}
        </Button>
      </Modal>

      <Modal open={chargeOpen} onClose={() => setChargeOpen(false)} title="Nouvelle charge fixe">
        <Field label="Libellé">
          <input
            value={chargeForm.label}
            onChange={(e) => setChargeForm({ ...chargeForm, label: e.target.value })}
            className={inputClass}
            placeholder="Ex: Vercel Pro, loyer, Supabase..."
          />
        </Field>
        <div className="mb-3 grid grid-cols-2 gap-2.5">
          <Field label="Montant (MAD)">
            <input
              type="number"
              value={chargeForm.amount}
              onChange={(e) => setChargeForm({ ...chargeForm, amount: e.target.value })}
              className={inputClass}
              placeholder="150"
            />
          </Field>
          <Field label="Jour du mois">
            <input
              type="number"
              min={1}
              max={31}
              value={chargeForm.day_of_month}
              onChange={(e) => setChargeForm({ ...chargeForm, day_of_month: e.target.value })}
              className={inputClass}
            />
          </Field>
        </div>
        <Field label="Catégorie">
          <select
            value={chargeForm.category}
            onChange={(e) => setChargeForm({ ...chargeForm, category: e.target.value as SanemiRecurringCharge["category"] })}
            className={inputClass}
          >
            <option value="besoins">Besoins</option>
            <option value="projets">Projets</option>
            <option value="liberte">Liberté</option>
          </select>
        </Field>
        <Button variant="primary" className="w-full" onClick={saveCharge}>
          Ajouter
        </Button>
      </Modal>
    </div>
  );
}
