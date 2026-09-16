"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { FacturationClient, FacturationItem, FacturationOrder, FacturationSettings } from "@/lib/types";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Modal, Field, inputClass } from "@/components/ui/Modal";
import { Loader, Empty } from "./PlanningSection";

type OrderRow = FacturationOrder & {
  facturation_clients: Pick<FacturationClient, "name" | "address" | "phone" | "email"> | null;
  facturation_items: FacturationItem[];
};

const fmt = (n: number) => `${n.toLocaleString("fr-FR")} MAD`;

const STATUS_META: Record<FacturationOrder["status"], { label: string; tone: BadgeTone }> = {
  brouillon: { label: "Brouillon", tone: "muted" },
  envoye: { label: "Envoyé", tone: "blue" },
  paye: { label: "Payé", tone: "green" },
  annule: { label: "Annulé", tone: "red" },
};

const WENNA_ROLE_LABEL: Record<string, string> = { vendeur: "Vendeur Wenna", chasseur: "Chasseur Wenna" };

function orderTotal(o: OrderRow) {
  const subtotal = o.facturation_items.reduce((s, it) => s + Number(it.quantity) * Number(it.unit_price), 0);
  return subtotal + Number(o.transfer_fee);
}

const emptyItem = () => ({ label: "", quantity: "1", unit_price: "" });

const emptyOrderForm = () => ({
  client_id: "",
  doc_type: "devis" as FacturationOrder["doc_type"],
  order_date: new Date().toISOString().slice(0, 10),
  transfer_fee: "",
  amount_received: "",
  notes: "",
  items: [emptyItem()],
  newClient: { name: "", address: "", phone: "", email: "" },
});

export function FacturationSection({ userId }: { userId: string }) {
  const [view, setView] = useState<"orders" | "clients">("orders");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [clients, setClients] = useState<FacturationClient[]>([]);
  const [settings, setSettings] = useState<FacturationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "devis" | "facture">("all");

  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [printOrder, setPrintOrder] = useState<OrderRow | null>(null);

  const [orderForm, setOrderForm] = useState(emptyOrderForm());
  const [clientForm, setClientForm] = useState({ name: "", address: "", phone: "", email: "", wenna_role: "" as "" | "vendeur" | "chasseur" });
  const [settingsForm, setSettingsForm] = useState({ business_name: "", address: "", phone: "", email: "" });

  async function loadAll() {
    setLoading(true);
    const [ordersRes, clientsRes, settingsRes] = await Promise.all([
      supabase
        .from("facturation_orders")
        .select("*, facturation_clients(name, address, phone, email), facturation_items(*)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabase.from("facturation_clients").select("*").eq("user_id", userId).order("name"),
      supabase.from("facturation_settings").select("*").eq("user_id", userId).maybeSingle(),
    ]);
    if (!ordersRes.error) setOrders((ordersRes.data as OrderRow[]) ?? []);
    if (!clientsRes.error) setClients(clientsRes.data ?? []);
    if (settingsRes.data) {
      setSettings(settingsRes.data);
      setSettingsForm({
        business_name: settingsRes.data.business_name,
        address: settingsRes.data.address,
        phone: settingsRes.data.phone,
        email: settingsRes.data.email,
      });
    }
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const stats = useMemo(() => {
    const paye = orders.filter((o) => o.status === "paye").reduce((s, o) => s + orderTotal(o), 0);
    const enAttente = orders
      .filter((o) => o.status === "brouillon" || o.status === "envoye")
      .reduce((s, o) => s + orderTotal(o), 0);
    return { paye, enAttente, clients: clients.length };
  }, [orders, clients]);

  async function saveSettings() {
    await supabase
      .from("facturation_settings")
      .upsert({ user_id: userId, ...settingsForm, updated_at: new Date().toISOString() });
    await loadAll();
    setSettingsModalOpen(false);
  }

  async function saveClient() {
    if (!clientForm.name.trim()) return;
    await supabase.from("facturation_clients").insert({
      name: clientForm.name.trim(),
      address: clientForm.address.trim() || null,
      phone: clientForm.phone.trim() || null,
      email: clientForm.email.trim() || null,
      wenna_role: clientForm.wenna_role || null,
      user_id: userId,
    });
    await loadAll();
    setClientForm({ name: "", address: "", phone: "", email: "", wenna_role: "" });
    setClientModalOpen(false);
  }

  async function updateClientRole(id: string, role: "" | "vendeur" | "chasseur") {
    setClients((prev) => prev.map((c) => (c.id === id ? { ...c, wenna_role: role || null } : c)));
    await supabase.from("facturation_clients").update({ wenna_role: role || null }).eq("id", id);
  }

  async function deleteClient(id: string) {
    setClients((prev) => prev.filter((c) => c.id !== id));
    await supabase.from("facturation_clients").delete().eq("id", id);
  }

  function updateItem(index: number, field: "label" | "quantity" | "unit_price", value: string) {
    setOrderForm((prev) => ({ ...prev, items: prev.items.map((it, i) => (i === index ? { ...it, [field]: value } : it)) }));
  }

  function addItemRow() {
    setOrderForm((prev) => ({ ...prev, items: [...prev.items, emptyItem()] }));
  }

  function removeItemRow(index: number) {
    setOrderForm((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
  }

  async function saveOrder() {
    const validItems = orderForm.items.filter((it) => it.label.trim());
    if (validItems.length === 0) return;

    let clientId = orderForm.client_id;
    if (clientId === "__new__") {
      if (!orderForm.newClient.name.trim()) return;
      const { data: newClient, error: clientError } = await supabase
        .from("facturation_clients")
        .insert({
          name: orderForm.newClient.name.trim(),
          address: orderForm.newClient.address.trim() || null,
          phone: orderForm.newClient.phone.trim() || null,
          email: orderForm.newClient.email.trim() || null,
          user_id: userId,
        })
        .select()
        .single();
      if (clientError || !newClient) return;
      clientId = newClient.id;
    }
    if (!clientId) return;

    const orderId = crypto.randomUUID();
    const { error: orderError } = await supabase.from("facturation_orders").insert({
      id: orderId,
      user_id: userId,
      client_id: clientId,
      doc_type: orderForm.doc_type,
      order_date: orderForm.order_date,
      transfer_fee: parseFloat(orderForm.transfer_fee) || 0,
      amount_received: parseFloat(orderForm.amount_received) || 0,
      notes: orderForm.notes.trim() || null,
    });
    if (orderError) return;
    await supabase.from("facturation_items").insert(
      validItems.map((it) => ({
        order_id: orderId,
        label: it.label.trim(),
        quantity: parseFloat(it.quantity) || 1,
        unit_price: parseFloat(it.unit_price) || 0,
      }))
    );
    await loadAll();
    setOrderForm(emptyOrderForm());
    setOrderModalOpen(false);
  }

  async function updateOrderStatus(id: string, status: FacturationOrder["status"]) {
    const order = orders.find((o) => o.id === id);
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
    await supabase.from("facturation_orders").update({ status, updated_at: new Date().toISOString() }).eq("id", id);

    if (status === "paye" && order) {
      const { data: existing } = await supabase
        .from("sanemi_transactions")
        .select("id")
        .eq("related_order_id", id)
        .maybeSingle();
      if (!existing) {
        const amount = Number(order.amount_received) > 0 ? Number(order.amount_received) : orderTotal(order);
        await supabase.from("sanemi_transactions").insert({
          type: "revenu",
          label: `Facture — ${order.facturation_clients?.name ?? "Client"}`,
          source: "Facturation",
          amount,
          rev_type: "prevu",
          category: "revenu",
          related_order_id: id,
          user_id: userId,
        });
      }
    }
  }

  async function convertToFacture(id: string) {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, doc_type: "facture" } : o)));
    await supabase.from("facturation_orders").update({ doc_type: "facture", updated_at: new Date().toISOString() }).eq("id", id);
  }

  async function deleteOrder(id: string) {
    setOrders((prev) => prev.filter((o) => o.id !== id));
    await supabase.from("facturation_orders").delete().eq("id", id);
  }

  const filteredOrders = orders.filter((o) => filter === "all" || o.doc_type === filter);

  return (
    <div className="animate-fade-in">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <div className="font-display text-xl font-extrabold">Facturation</div>
          <div className="text-xs text-ink-muted">Devis & factures parfum</div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setSettingsModalOpen(true)}>
            Mes infos
          </Button>
          <Button size="sm" variant="primary" onClick={() => setOrderModalOpen(true)}>
            + Commande
          </Button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3">
        <Card>
          <CardTitle>En attente</CardTitle>
          <div className="font-display text-2xl font-bold text-amber">{fmt(stats.enAttente)}</div>
        </Card>
        <Card accent>
          <CardTitle>Payé</CardTitle>
          <div className="font-display text-2xl font-bold text-orange">{fmt(stats.paye)}</div>
        </Card>
        <Card>
          <CardTitle>Clients</CardTitle>
          <div className="font-display text-2xl font-bold">{stats.clients}</div>
        </Card>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        <Chip active={view === "orders"} onClick={() => setView("orders")}>
          Commandes
        </Chip>
        <Chip active={view === "clients"} onClick={() => setView("clients")}>
          Clients
        </Chip>
      </div>

      {view === "orders" && (
        <>
          <div className="mb-4 flex flex-wrap gap-1.5">
            <Chip active={filter === "all"} onClick={() => setFilter("all")}>
              Tous
            </Chip>
            <Chip active={filter === "devis"} onClick={() => setFilter("devis")}>
              Devis
            </Chip>
            <Chip active={filter === "facture"} onClick={() => setFilter("facture")}>
              Factures
            </Chip>
          </div>

          {loading ? (
            <Loader />
          ) : filteredOrders.length === 0 ? (
            <Empty>Aucune commande</Empty>
          ) : (
            <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredOrders.map((o) => {
                const statusMeta = STATUS_META[o.status];
                return (
                  <Card key={o.id}>
                    <div className="mb-1.5 flex items-start justify-between gap-2">
                      <div className="font-display text-sm font-bold">{o.facturation_clients?.name ?? "Client supprimé"}</div>
                      <button onClick={() => deleteOrder(o.id)} className="shrink-0 cursor-pointer px-1 text-ink-dim hover:text-red">
                        ✕
                      </button>
                    </div>
                    <div className="mb-2 text-[10px] text-ink-dim">
                      {new Date(o.order_date).toLocaleDateString("fr-FR")} · Réf. {o.id.slice(0, 8).toUpperCase()}
                    </div>
                    <div className="mb-2.5 flex items-center justify-between">
                      <Badge tone={o.doc_type === "facture" ? "orange" : "muted"}>{o.doc_type === "facture" ? "Facture" : "Devis"}</Badge>
                      <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
                    </div>
                    <div className="mb-2.5 font-mono text-lg font-bold text-orange">{fmt(orderTotal(o))}</div>
                    <div className="mb-3 flex gap-2">
                      <Button size="sm" className="flex-1" onClick={() => setPrintOrder(o)}>
                        Voir / Imprimer
                      </Button>
                      {o.doc_type === "devis" && (
                        <Button size="sm" onClick={() => convertToFacture(o.id)}>
                          → Facture
                        </Button>
                      )}
                    </div>
                    <select
                      value={o.status}
                      onChange={(e) => updateOrderStatus(o.id, e.target.value as FacturationOrder["status"])}
                      className={inputClass}
                    >
                      {Object.entries(STATUS_META).map(([key, meta]) => (
                        <option key={key} value={key}>
                          {meta.label}
                        </option>
                      ))}
                    </select>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {view === "clients" && (
        <>
          <div className="mb-4 flex justify-end">
            <Button size="sm" variant="primary" onClick={() => setClientModalOpen(true)}>
              + Client
            </Button>
          </div>
          <div className="mb-3 text-xs text-ink-muted">
            La base clients parfum reste séparée du CRM WennaShop. Marquer un client &quot;Vendeur&quot; ou &quot;Chasseur&quot; l&apos;étiquette
            simplement ici — ça ne le crée pas encore automatiquement côté Wenna.
          </div>
          {loading ? (
            <Loader />
          ) : clients.length === 0 ? (
            <Empty>Aucun client</Empty>
          ) : (
            <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {clients.map((c) => (
                <Card key={c.id}>
                  <div className="mb-1.5 flex items-start justify-between gap-2">
                    <div className="font-display text-sm font-bold">{c.name}</div>
                    <button onClick={() => deleteClient(c.id)} className="shrink-0 cursor-pointer px-1 text-ink-dim hover:text-red">
                      ✕
                    </button>
                  </div>
                  {c.address && <div className="text-xs text-ink-muted">{c.address}</div>}
                  {c.phone && <div className="text-xs text-ink-muted">{c.phone}</div>}
                  {c.email && <div className="mb-2 text-xs text-ink-muted">{c.email}</div>}
                  {c.wenna_role && (
                    <div className="mb-2">
                      <Badge tone="teal">{WENNA_ROLE_LABEL[c.wenna_role]}</Badge>
                    </div>
                  )}
                  <select
                    value={c.wenna_role ?? ""}
                    onChange={(e) => updateClientRole(c.id, e.target.value as "" | "vendeur" | "chasseur")}
                    className={inputClass}
                  >
                    <option value="">CRM Wenna — aucun</option>
                    <option value="vendeur">Marquer Vendeur Wenna</option>
                    <option value="chasseur">Marquer Chasseur Wenna</option>
                  </select>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      <Modal open={settingsModalOpen} onClose={() => setSettingsModalOpen(false)} title="Mes infos fournisseur">
        <Field label="Nom / entreprise">
          <input
            value={settingsForm.business_name}
            onChange={(e) => setSettingsForm({ ...settingsForm, business_name: e.target.value })}
            className={inputClass}
            placeholder="Ex: Lord Sanemi — Parfums"
          />
        </Field>
        <Field label="Adresse">
          <input
            value={settingsForm.address}
            onChange={(e) => setSettingsForm({ ...settingsForm, address: e.target.value })}
            className={inputClass}
            placeholder="Casablanca, Maroc"
          />
        </Field>
        <div className="mb-3 grid grid-cols-2 gap-2.5">
          <Field label="Téléphone">
            <input
              value={settingsForm.phone}
              onChange={(e) => setSettingsForm({ ...settingsForm, phone: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Email">
            <input
              value={settingsForm.email}
              onChange={(e) => setSettingsForm({ ...settingsForm, email: e.target.value })}
              className={inputClass}
            />
          </Field>
        </div>
        <Button variant="primary" className="w-full" onClick={saveSettings}>
          Enregistrer
        </Button>
      </Modal>

      <Modal open={clientModalOpen} onClose={() => setClientModalOpen(false)} title="Nouveau client">
        <Field label="Nom">
          <input
            value={clientForm.name}
            onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
            className={inputClass}
            placeholder="Nom du client"
          />
        </Field>
        <Field label="Adresse (optionnel)">
          <input
            value={clientForm.address}
            onChange={(e) => setClientForm({ ...clientForm, address: e.target.value })}
            className={inputClass}
          />
        </Field>
        <div className="mb-3 grid grid-cols-2 gap-2.5">
          <Field label="Téléphone (optionnel)">
            <input
              value={clientForm.phone}
              onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Email (optionnel)">
            <input
              value={clientForm.email}
              onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
              className={inputClass}
            />
          </Field>
        </div>
        <Field label="CRM Wenna (optionnel)">
          <select
            value={clientForm.wenna_role}
            onChange={(e) => setClientForm({ ...clientForm, wenna_role: e.target.value as "" | "vendeur" | "chasseur" })}
            className={inputClass}
          >
            <option value="">Aucun</option>
            <option value="vendeur">Vendeur Wenna</option>
            <option value="chasseur">Chasseur Wenna</option>
          </select>
        </Field>
        <Button variant="primary" className="w-full" onClick={saveClient}>
          Ajouter
        </Button>
      </Modal>

      <Modal open={orderModalOpen} onClose={() => setOrderModalOpen(false)} title="Nouvelle commande">
        <div className="mb-3 grid grid-cols-2 gap-2.5">
          <Field label="Type">
            <select
              value={orderForm.doc_type}
              onChange={(e) => setOrderForm({ ...orderForm, doc_type: e.target.value as FacturationOrder["doc_type"] })}
              className={inputClass}
            >
              <option value="devis">Devis</option>
              <option value="facture">Facture</option>
            </select>
          </Field>
          <Field label="Date">
            <input
              type="date"
              value={orderForm.order_date}
              onChange={(e) => setOrderForm({ ...orderForm, order_date: e.target.value })}
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="Client">
          <select
            value={orderForm.client_id}
            onChange={(e) => setOrderForm({ ...orderForm, client_id: e.target.value })}
            className={inputClass}
          >
            <option value="">Sélectionner...</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            <option value="__new__">+ Nouveau client</option>
          </select>
        </Field>

        {orderForm.client_id === "__new__" && (
          <div className="mb-3 rounded-lg border border-border bg-surface-2 p-3">
            <Field label="Nom du nouveau client">
              <input
                value={orderForm.newClient.name}
                onChange={(e) => setOrderForm({ ...orderForm, newClient: { ...orderForm.newClient, name: e.target.value } })}
                className={inputClass}
              />
            </Field>
            <Field label="Adresse (optionnel)">
              <input
                value={orderForm.newClient.address}
                onChange={(e) => setOrderForm({ ...orderForm, newClient: { ...orderForm.newClient, address: e.target.value } })}
                className={inputClass}
              />
            </Field>
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Téléphone">
                <input
                  value={orderForm.newClient.phone}
                  onChange={(e) => setOrderForm({ ...orderForm, newClient: { ...orderForm.newClient, phone: e.target.value } })}
                  className={inputClass}
                />
              </Field>
              <Field label="Email">
                <input
                  value={orderForm.newClient.email}
                  onChange={(e) => setOrderForm({ ...orderForm, newClient: { ...orderForm.newClient, email: e.target.value } })}
                  className={inputClass}
                />
              </Field>
            </div>
          </div>
        )}

        <div className="mb-1.5 font-mono text-[11px] uppercase tracking-wide text-ink-muted">Articles</div>
        {orderForm.items.map((it, i) => (
          <div key={i} className="mb-2 flex gap-1.5">
            <input
              value={it.label}
              onChange={(e) => updateItem(i, "label", e.target.value)}
              className={`${inputClass} flex-1`}
              placeholder="Parfum, format..."
            />
            <input
              type="number"
              value={it.quantity}
              onChange={(e) => updateItem(i, "quantity", e.target.value)}
              className={`${inputClass} w-16`}
              placeholder="Qté"
            />
            <input
              type="number"
              value={it.unit_price}
              onChange={(e) => updateItem(i, "unit_price", e.target.value)}
              className={`${inputClass} w-24`}
              placeholder="P.U."
            />
            {orderForm.items.length > 1 && (
              <button onClick={() => removeItemRow(i)} className="cursor-pointer px-1 text-ink-dim hover:text-red">
                ✕
              </button>
            )}
          </div>
        ))}
        <button onClick={addItemRow} className="mb-3 cursor-pointer text-xs text-orange hover:underline">
          + Ajouter un article
        </button>

        <div className="mb-3 grid grid-cols-2 gap-2.5">
          <Field label="Frais de transfert (MAD)">
            <input
              type="number"
              value={orderForm.transfer_fee}
              onChange={(e) => setOrderForm({ ...orderForm, transfer_fee: e.target.value })}
              className={inputClass}
              placeholder="0"
            />
          </Field>
          <Field label="Montant déjà reçu (MAD)">
            <input
              type="number"
              value={orderForm.amount_received}
              onChange={(e) => setOrderForm({ ...orderForm, amount_received: e.target.value })}
              className={inputClass}
              placeholder="0"
            />
          </Field>
        </div>
        <Field label="Notes (optionnel)">
          <textarea
            rows={2}
            value={orderForm.notes}
            onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Button variant="primary" className="w-full" onClick={saveOrder}>
          Créer
        </Button>
      </Modal>

      {printOrder && <InvoicePreview order={printOrder} settings={settings} onClose={() => setPrintOrder(null)} />}
    </div>
  );
}

function InvoicePreview({ order, settings, onClose }: { order: OrderRow; settings: FacturationSettings | null; onClose: () => void }) {
  const subtotal = order.facturation_items.reduce((s, it) => s + Number(it.quantity) * Number(it.unit_price), 0);
  const total = subtotal + Number(order.transfer_fee);
  const balance = total - Number(order.amount_received);
  const title = order.doc_type === "devis" ? "DEVIS" : "FACTURE";
  const ref = order.id.slice(0, 8).toUpperCase();
  const client = order.facturation_clients;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border-strong bg-surface-1 p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="font-display text-lg font-bold">
            {title} — {ref}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="primary" onClick={() => window.print()}>
              Imprimer / PDF
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}>
              Fermer
            </Button>
          </div>
        </div>

        <div id="print-invoice" className="rounded-xl bg-white p-6 text-black">
          <div className="mb-6 flex items-start justify-between">
            <div>
              <div className="text-lg font-bold">{settings?.business_name || "Ton entreprise"}</div>
              <div className="whitespace-pre-line text-xs text-gray-600">{settings?.address}</div>
              <div className="text-xs text-gray-600">
                {settings?.phone} {settings?.email}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold">{title}</div>
              <div className="text-xs text-gray-600">Réf. {ref}</div>
              <div className="text-xs text-gray-600">{new Date(order.order_date).toLocaleDateString("fr-FR")}</div>
            </div>
          </div>

          <div className="mb-4">
            <div className="text-[10px] uppercase tracking-wide text-gray-500">Client</div>
            <div className="font-medium">{client?.name}</div>
            {client?.address && <div className="text-xs text-gray-600">{client.address}</div>}
            <div className="text-xs text-gray-600">
              {client?.phone} {client?.email}
            </div>
          </div>

          <table className="mb-4 w-full text-sm">
            <thead>
              <tr className="border-b border-gray-300 text-left text-xs uppercase text-gray-500">
                <th className="py-1.5">Article</th>
                <th className="py-1.5 text-right">Qté</th>
                <th className="py-1.5 text-right">Prix unit.</th>
                <th className="py-1.5 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {order.facturation_items.map((it) => (
                <tr key={it.id} className="border-b border-gray-100">
                  <td className="py-1.5">{it.label}</td>
                  <td className="py-1.5 text-right">{it.quantity}</td>
                  <td className="py-1.5 text-right">{fmt(Number(it.unit_price))}</td>
                  <td className="py-1.5 text-right">{fmt(Number(it.quantity) * Number(it.unit_price))}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="ml-auto max-w-[220px] space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Sous-total</span>
              <span>{fmt(subtotal)}</span>
            </div>
            {Number(order.transfer_fee) > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Frais de transfert</span>
                <span>{fmt(Number(order.transfer_fee))}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-gray-300 pt-1 font-bold">
              <span>Total</span>
              <span>{fmt(total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Reçu</span>
              <span>{fmt(Number(order.amount_received))}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Solde</span>
              <span>{fmt(balance)}</span>
            </div>
          </div>

          {order.notes && <div className="mt-4 text-xs text-gray-600">{order.notes}</div>}
        </div>
      </div>
    </div>
  );
}
