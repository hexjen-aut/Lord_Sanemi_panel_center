"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { SanemiAccount } from "@/lib/types";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Modal, Field, inputClass } from "@/components/ui/Modal";
import { Loader, Empty } from "../PlanningSection";

const fmt = (n: number) => `${n.toLocaleString("fr-FR")} MAD`;

export function AccountsCard() {
  const [accounts, setAccounts] = useState<SanemiAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const [accountOpen, setAccountOpen] = useState(false);
  const [accountForm, setAccountForm] = useState({ name: "", account_type: "perso" as SanemiAccount["account_type"], balance: "" });

  const [txAccount, setTxAccount] = useState<SanemiAccount | null>(null);
  const [txForm, setTxForm] = useState({ type: "depot" as "depot" | "retrait", amount: "", note: "" });

  async function loadAccounts() {
    setLoading(true);
    const { data, error } = await supabase.from("sanemi_accounts").select("*").order("created_at");
    if (!error) setAccounts(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAccounts();
  }, []);

  async function saveAccount() {
    const name = accountForm.name.trim();
    if (!name) return;
    const { data, error } = await supabase
      .from("sanemi_accounts")
      .insert({ name, account_type: accountForm.account_type, balance: parseFloat(accountForm.balance) || 0 })
      .select()
      .single();
    if (error || !data) return;
    setAccounts((prev) => [...prev, data]);
    setAccountForm({ name: "", account_type: "perso", balance: "" });
    setAccountOpen(false);
  }

  async function deleteAccount(id: string) {
    if (!confirm("Supprimer ce compte et son historique de mouvements ?")) return;
    const { error } = await supabase.from("sanemi_accounts").delete().eq("id", id);
    if (error) return;
    setAccounts((prev) => prev.filter((a) => a.id !== id));
  }

  async function saveTx() {
    if (!txAccount) return;
    const amount = parseFloat(txForm.amount);
    if (!amount) return;
    const { error: txError } = await supabase.from("sanemi_account_transactions").insert({
      account_id: txAccount.id,
      type: txForm.type,
      amount,
      note: txForm.note.trim() || null,
    });
    if (txError) return;
    const newBalance = txAccount.balance + (txForm.type === "depot" ? amount : -amount);
    const { error: balError } = await supabase.from("sanemi_accounts").update({ balance: newBalance }).eq("id", txAccount.id);
    if (balError) return;
    setAccounts((prev) => prev.map((a) => (a.id === txAccount.id ? { ...a, balance: newBalance } : a)));
    setTxForm({ type: "depot", amount: "", note: "" });
    setTxAccount(null);
  }

  const total = accounts.reduce((s, a) => s + Number(a.balance), 0);

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <CardTitle>Comptes & cartes</CardTitle>
        <Button size="sm" onClick={() => setAccountOpen(true)}>
          + Compte
        </Button>
      </div>
      {loading ? (
        <Loader />
      ) : accounts.length === 0 ? (
        <Empty>Aucun compte enregistré</Empty>
      ) : (
        <>
          <div className="mb-2.5 text-xs text-ink-muted">
            Total : <span className="font-mono text-ink">{fmt(total)}</span>
          </div>
          <ul className="flex flex-col gap-2">
            {accounts.map((a) => (
              <li key={a.id} className="flex items-center gap-2.5 rounded-lg border border-border bg-surface-2 p-3">
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium">{a.name}</span>
                    <Badge tone={a.account_type === "business" ? "blue" : "muted"}>{a.account_type === "business" ? "Business" : "Perso"}</Badge>
                  </div>
                  <div className="mt-0.5 font-mono text-sm text-orange">{fmt(Number(a.balance))}</div>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setTxAccount(a);
                    setTxForm({ type: "depot", amount: "", note: "" });
                  }}
                >
                  Mouvement
                </Button>
                <button onClick={() => deleteAccount(a.id)} className="cursor-pointer px-1 text-ink-dim hover:text-red">
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <Modal open={accountOpen} onClose={() => setAccountOpen(false)} title="Nouveau compte">
        <Field label="Nom">
          <input
            value={accountForm.name}
            onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
            className={inputClass}
            placeholder="Ex: Wafacash 1, Carte business..."
          />
        </Field>
        <div className="mb-3 grid grid-cols-2 gap-2.5">
          <div>
            <div className="mb-1.5 font-mono text-[11px] uppercase tracking-wide text-ink-muted">Type</div>
            <div className="flex gap-1.5">
              <Chip active={accountForm.account_type === "perso"} onClick={() => setAccountForm({ ...accountForm, account_type: "perso" })}>
                Perso
              </Chip>
              <Chip active={accountForm.account_type === "business"} onClick={() => setAccountForm({ ...accountForm, account_type: "business" })}>
                Business
              </Chip>
            </div>
          </div>
          <Field label="Solde actuel (MAD)">
            <input
              type="number"
              value={accountForm.balance}
              onChange={(e) => setAccountForm({ ...accountForm, balance: e.target.value })}
              className={inputClass}
              placeholder="0"
            />
          </Field>
        </div>
        <Button variant="primary" className="w-full" onClick={saveAccount}>
          Ajouter
        </Button>
      </Modal>

      <Modal open={!!txAccount} onClose={() => setTxAccount(null)} title={txAccount ? `Mouvement — ${txAccount.name}` : "Mouvement"}>
        <div className="mb-3 flex gap-1.5">
          <Chip active={txForm.type === "depot"} onClick={() => setTxForm({ ...txForm, type: "depot" })}>
            Dépôt
          </Chip>
          <Chip active={txForm.type === "retrait"} onClick={() => setTxForm({ ...txForm, type: "retrait" })}>
            Retrait
          </Chip>
        </div>
        <Field label="Montant (MAD)">
          <input
            type="number"
            value={txForm.amount}
            onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })}
            className={inputClass}
            placeholder="500"
          />
        </Field>
        <Field label="Note (optionnel)">
          <input value={txForm.note} onChange={(e) => setTxForm({ ...txForm, note: e.target.value })} className={inputClass} />
        </Field>
        <Button variant="primary" className="w-full" onClick={saveTx}>
          Enregistrer
        </Button>
      </Modal>
    </Card>
  );
}
