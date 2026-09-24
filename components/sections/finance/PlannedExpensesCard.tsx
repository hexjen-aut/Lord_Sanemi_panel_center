"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { SanemiPlannedExpense } from "@/lib/types";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal, Field, inputClass } from "@/components/ui/Modal";
import { Loader, Empty } from "../PlanningSection";

const fmt = (n: number) => `${n.toLocaleString("fr-FR")} MAD`;

export function PlannedExpensesCard({ userId }: { userId: string }) {
  const [expenses, setExpenses] = useState<SanemiPlannedExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ label: "", amount: "", expected_date: new Date().toISOString().slice(0, 10), note: "" });

  async function loadExpenses() {
    setLoading(true);
    const { data, error } = await supabase.from("sanemi_planned_expenses").select("*").eq("paid", false).order("expected_date");
    if (!error) setExpenses(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadExpenses();
  }, []);

  async function saveExpense() {
    const label = form.label.trim();
    const amount = parseFloat(form.amount);
    if (!label || !amount || !form.expected_date) return;
    const { data, error } = await supabase
      .from("sanemi_planned_expenses")
      .insert({ label, amount, expected_date: form.expected_date, note: form.note.trim() || null })
      .select()
      .single();
    if (error || !data) return;
    setExpenses((prev) => [...prev, data].sort((a, b) => a.expected_date.localeCompare(b.expected_date)));
    setForm({ label: "", amount: "", expected_date: new Date().toISOString().slice(0, 10), note: "" });
    setOpen(false);
  }

  async function deleteExpense(id: string) {
    const { error } = await supabase.from("sanemi_planned_expenses").delete().eq("id", id);
    if (error) return;
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }

  async function markPaid(e: SanemiPlannedExpense) {
    const { error: txError } = await supabase.from("sanemi_transactions").insert({
      type: "depense",
      label: e.label,
      amount: e.amount,
      category: "projets",
      user_id: userId,
    });
    if (txError) return;
    const { error: updError } = await supabase.from("sanemi_planned_expenses").update({ paid: true }).eq("id", e.id);
    if (updError) return;
    setExpenses((prev) => prev.filter((x) => x.id !== e.id));
  }

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const soon = (date: string) => new Date(date).getTime() - +new Date() < 7 * 864e5;

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <CardTitle>Dépenses futures</CardTitle>
        <Button size="sm" onClick={() => setOpen(true)}>
          + Prévoir
        </Button>
      </div>
      {loading ? (
        <Loader />
      ) : expenses.length === 0 ? (
        <Empty>Aucune dépense prévue</Empty>
      ) : (
        <>
          <div className="mb-2.5 text-xs text-ink-muted">
            À venir : <span className="font-mono text-ink">{fmt(total)}</span>
          </div>
          <ul className="flex flex-col gap-2">
            {expenses.map((e) => (
              <li key={e.id} className="flex items-center gap-2.5 rounded-lg border border-border bg-surface-2 p-3">
                <div className="flex-1">
                  <div className="text-sm">{e.label}</div>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <Badge tone={soon(e.expected_date) ? "amber" : "muted"}>{new Date(e.expected_date).toLocaleDateString("fr-FR")}</Badge>
                    <span className="font-mono text-xs text-ink-muted">{fmt(Number(e.amount))}</span>
                  </div>
                </div>
                <Button size="sm" onClick={() => markPaid(e)}>
                  Payée
                </Button>
                <button onClick={() => deleteExpense(e.id)} className="cursor-pointer px-1 text-ink-dim hover:text-red">
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Prévoir une dépense">
        <Field label="Libellé">
          <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className={inputClass} placeholder="Ex: Achat matériel" />
        </Field>
        <div className="mb-3 grid grid-cols-2 gap-2.5">
          <Field label="Montant (MAD)">
            <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={inputClass} placeholder="500" />
          </Field>
          <Field label="Date prévue">
            <input type="date" value={form.expected_date} onChange={(e) => setForm({ ...form, expected_date: e.target.value })} className={inputClass} />
          </Field>
        </div>
        <Field label="Note (optionnel)">
          <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className={inputClass} />
        </Field>
        <Button variant="primary" className="w-full" onClick={saveExpense}>
          Ajouter
        </Button>
      </Modal>
    </Card>
  );
}
