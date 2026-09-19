"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type {
  SanemiAlternative,
  SanemiEnvie,
  SanemiEnvieTirage,
  SanemiJournalEntry,
  SanemiPattern,
  SanemiPatternLog,
  SanemiStrategy,
  SanemiVault,
} from "@/lib/types";
import { deriveKey, encryptText, decryptText, safeDecrypt, newSalt } from "@/lib/patterns/crypto";
import { ACTIVITES, CATEGORIES, DAY, EMOTIONS, JOURS, LIEUX, RESSENTIS } from "@/lib/patterns/constants";
import {
  altStatsData,
  avg,
  between,
  countBy,
  fmt1,
  heatmapData,
  intensityBy,
  journalStats,
  pct,
  planEffect,
  rate,
  signals,
  weeklyData,
} from "@/lib/patterns/analytics";
import { drawWheel, spinWheel, type WheelItem } from "@/lib/patterns/wheel";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Modal, Field, inputClass } from "@/components/ui/Modal";
import { Loader, Empty } from "../PlanningSection";
import { Bars } from "./Bars";

type Tab = "log" | "lecture" | "roue" | "plans" | "reglages";

type Opt = string | [string, string];
function optVal(o: Opt) {
  return Array.isArray(o) ? o[0] : o;
}
function optLabel(o: Opt) {
  return Array.isArray(o) ? o[1] : o;
}

function ChipGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Opt[];
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  return (
    <div className="mb-3">
      <div className="mb-1.5 font-mono text-[11px] uppercase tracking-wide text-ink-muted">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const v = optVal(o);
          return (
            <Chip key={v} active={value === v} onClick={() => onChange(value === v ? null : v)}>
              {optLabel(o)}
            </Chip>
          );
        })}
      </div>
    </div>
  );
}

function RangeField({
  label,
  value,
  onChange,
  max = 10,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  max?: number;
}) {
  return (
    <Field label={`${label} — ${value}/${max}`}>
      <input type="range" min={1} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full" />
    </Field>
  );
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { weekday: "short", hour: "2-digit", minute: "2-digit" });
}

interface LogForm {
  pattern_id: string;
  intensite: number;
  emotion: string | null;
  activite: string | null;
  lieu: string | null;
  social: string | null;
  energie: string | null;
  ressenti_apres: string | null;
  alternative_id: string | null;
  intensite_apres: number | null;
  note: string;
}

interface TirageForm {
  envie_id: string;
  intensite: number;
  statut: string | null;
  solution: string;
  satisfaction: string | null;
  ressenti_apres: string | null;
}

export function PatternsSection() {
  const [patterns, setPatterns] = useState<SanemiPattern[]>([]);
  const [alternatives, setAlternatives] = useState<SanemiAlternative[]>([]);
  const [logs, setLogs] = useState<SanemiPatternLog[]>([]);
  const [strategies, setStrategies] = useState<SanemiStrategy[]>([]);
  const [envies, setEnvies] = useState<SanemiEnvie[]>([]);
  const [tirages, setTirages] = useState<SanemiEnvieTirage[]>([]);
  const [journal, setJournal] = useState<SanemiJournalEntry[]>([]);
  const [vault, setVault] = useState<SanemiVault | null>(null);
  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null);
  const [decrypted, setDecrypted] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [pid, setPid] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("log");
  const [wheelMode, setWheelMode] = useState<"hasard" | "pondere">("hasard");
  const [wheelRot, setWheelRot] = useState(0);
  const [altRot, setAltRot] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const cryptoKeyRef = useRef<CryptoKey | null>(null);
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wheelCanvasRef = useRef<HTMLCanvasElement>(null);
  const altWheelCanvasRef = useRef<HTMLCanvasElement>(null);

  const [logOpen, setLogOpen] = useState(false);
  const [logForm, setLogForm] = useState<LogForm | null>(null);
  const [tirageOpen, setTirageOpen] = useState(false);
  const [tirageForm, setTirageForm] = useState<TirageForm | null>(null);
  const [envieOpen, setEnvieOpen] = useState(false);
  const [envieForm, setEnvieForm] = useState({ label: "", categorie: "général", intensite: 5, implique_autrui: "false" });
  const [planOpen, setPlanOpen] = useState(false);
  const [planForm, setPlanForm] = useState({ declencheur: null as string | null, action: "" });
  const [patternOpen, setPatternOpen] = useState(false);
  const [patternForm, setPatternForm] = useState({ name: "", objectif: "observer", is_intime: "false" });
  const [pinOpen, setPinOpen] = useState(false);
  const [pinValue, setPinValue] = useState("");
  const [altLabel, setAltLabel] = useState("");

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 2800);
  }

  useEffect(() => {
    cryptoKeyRef.current = cryptoKey;
  }, [cryptoKey]);

  async function decryptAllWith(
    key: CryptoKey,
    data: { patterns: SanemiPattern[]; envies: SanemiEnvie[]; logs: SanemiPatternLog[]; tirages: SanemiEnvieTirage[] }
  ) {
    const map: Record<string, string> = {};
    for (const p of data.patterns) if (p.is_intime) map[p.id] = await safeDecrypt(p.name, key);
    for (const e of data.envies) if (e.is_encrypted) map[e.id] = await safeDecrypt(e.label, key);
    for (const l of data.logs) if (l.is_encrypted && l.note) map[l.id] = await safeDecrypt(l.note, key);
    for (const t of data.tirages) if (t.is_encrypted && t.solution) map[t.id] = await safeDecrypt(t.solution, key);
    setDecrypted((prev) => ({ ...prev, ...map }));
  }

  async function loadAll() {
    setLoading(true);
    const since = new Date(Date.now() - 120 * DAY).toISOString();
    const [p, a, l, s, e, t, v, j] = await Promise.all([
      supabase.from("sanemi_patterns").select("*").order("created_at"),
      supabase.from("sanemi_alternatives").select("*").order("created_at"),
      supabase.from("sanemi_pattern_logs").select("*").gte("logged_at", since).order("logged_at"),
      supabase.from("sanemi_strategies").select("*").order("created_at"),
      supabase.from("sanemi_envies").select("*").eq("archived", false).order("created_at"),
      supabase.from("sanemi_envie_tirages").select("*").gte("tire_at", since).order("tire_at"),
      supabase.from("sanemi_vault").select("*").maybeSingle(),
      supabase.from("sanemi_journal").select("date,humeur").gte("date", since.slice(0, 10)),
    ]);
    const bad = [p, a, l, s, e, t, v].find((r) => r.error);
    if (bad?.error) {
      const m = bad.error.message || "";
      if (bad.error.code === "42P01" || bad.error.code === "PGRST205" || /does not exist|schema cache/i.test(m)) {
        setMissing(true);
        setLoading(false);
        return;
      }
      showToast(bad.error.message);
      setLoading(false);
      return;
    }
    setMissing(false);
    const P = p.data ?? [];
    const A = a.data ?? [];
    const L = l.data ?? [];
    const S = s.data ?? [];
    const E = e.data ?? [];
    const T = t.data ?? [];
    setPatterns(P);
    setAlternatives(A);
    setLogs(L);
    setStrategies(S);
    setEnvies(E);
    setTirages(T);
    setVault(v.data);
    setJournal(j.error ? [] : ((j.data as SanemiJournalEntry[]) ?? []));
    setPid((prev) => (prev && P.some((x) => x.id === prev) ? prev : (P[0]?.id ?? null)));
    if (cryptoKeyRef.current) await decryptAllWith(cryptoKeyRef.current, { patterns: P, envies: E, logs: L, tirages: T });
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function armLock() {
    if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
    lockTimerRef.current = setTimeout(() => {
      setCryptoKey(null);
      setDecrypted({});
      showToast("Verrouillé après 5 minutes sans activité.");
    }, 5 * 60 * 1000);
  }
  useEffect(() => {
    if (!cryptoKey) return;
    const bump = () => armLock();
    window.addEventListener("pointerdown", bump, { passive: true });
    window.addEventListener("keydown", bump);
    return () => {
      window.removeEventListener("pointerdown", bump);
      window.removeEventListener("keydown", bump);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cryptoKey]);

  function lock() {
    setCryptoKey(null);
    setDecrypted({});
    if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
  }

  async function setupPin(pin: string) {
    if (pin.length < 4) return showToast("4 caractères minimum.");
    const salt = newSalt();
    const key = await deriveKey(pin, salt);
    const check_cipher = await encryptText("sanemi-ok", key);
    const { data, error } = await supabase.from("sanemi_vault").insert({ salt, check_cipher }).select().single();
    if (error) return showToast(error.message);
    setVault(data);
    setCryptoKey(key);
    await decryptAllWith(key, { patterns, envies, logs, tirages });
    armLock();
    showToast("Code créé. Contenus intimes déverrouillés.");
  }
  async function unlock(pin: string) {
    if (!vault) return;
    const key = await deriveKey(pin, vault.salt);
    let ok = false;
    try {
      ok = (await decryptText(vault.check_cipher, key)) === "sanemi-ok";
    } catch {
      ok = false;
    }
    if (!ok) return showToast("Code incorrect.");
    setCryptoKey(key);
    await decryptAllWith(key, { patterns, envies, logs, tirages });
    armLock();
    showToast("Déverrouillé.");
  }

  const pattern = useMemo(() => patterns.find((p) => p.id === pid) ?? null, [patterns, pid]);
  const pName = (p: SanemiPattern | null | undefined) => (!p ? "" : p.is_intime ? (decrypted[p.id] ?? "Pattern privé") : p.name);
  const eLabel = (e: SanemiEnvie | undefined) => (!e ? "envie retirée" : e.is_encrypted ? (decrypted[e.id] ?? "Catégorie I") : e.label);
  const tSol = (t: SanemiEnvieTirage) => (t.is_encrypted ? (decrypted[t.id] ?? null) : t.solution);
  const logsFor = (patternId: string) => logs.filter((l) => l.pattern_id === patternId);
  const altItems = (patternId: string): WheelItem[] => alternatives.filter((a) => a.pattern_id === patternId).map((a) => ({ id: a.id, label: a.label, w: 1 }));
  const wheelItems = (): WheelItem[] => envies.map((e) => ({ id: e.id, label: eLabel(e), w: wheelMode === "pondere" ? e.intensite : 1 }));

  useEffect(() => {
    const c = wheelCanvasRef.current;
    if (c && tab === "roue") drawWheel(c, wheelItems(), wheelRot);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, envies, wheelMode, decrypted]);

  useEffect(() => {
    const c = altWheelCanvasRef.current;
    if (c && logOpen && logForm) drawWheel(c, altItems(logForm.pattern_id), altRot);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logOpen, logForm?.pattern_id, alternatives]);

  useEffect(() => {
    function onResize() {
      const c = wheelCanvasRef.current;
      if (c && tab === "roue") drawWheel(c, wheelItems(), wheelRot);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, envies, wheelMode]);

  async function seedTabac() {
    const { data: p, error } = await supabase.from("sanemi_patterns").insert({ name: "Envie de fumer", objectif: "observer" }).select().single();
    if (error) return showToast(error.message);
    const labels = ["10 minutes de marche", "Un grand verre d'eau", "Appeler quelqu'un", "10 pompes", "Respiration 4-7-8", "Un chewing-gum"];
    const { data: alts } = await supabase
      .from("sanemi_alternatives")
      .insert(labels.map((label) => ({ pattern_id: p.id, label })))
      .select();
    setPatterns((prev) => [...prev, p]);
    setAlternatives((prev) => [...prev, ...(alts ?? [])]);
    setPid(p.id);
    showToast("Pattern créé avec 6 alternatives, modifiables dans Réglages.");
  }

  function openLogSheet() {
    if (!pid) return;
    setLogForm({
      pattern_id: pid,
      intensite: 6,
      emotion: null,
      activite: null,
      lieu: null,
      social: null,
      energie: null,
      ressenti_apres: null,
      alternative_id: null,
      intensite_apres: null,
      note: "",
    });
    setLogOpen(true);
  }

  async function spinAlt() {
    if (!logForm) return;
    const c = altWheelCanvasRef.current;
    if (!c) return;
    const items = altItems(logForm.pattern_id);
    setSpinning(true);
    const i = await spinWheel(c, items, altRot, setAltRot);
    setSpinning(false);
    if (i < 0) return;
    setLogForm((prev) => (prev ? { ...prev, alternative_id: items[i].id, intensite_apres: prev.intensite } : prev));
  }

  async function saveLog(resultat: "resiste" | "cede") {
    if (!logForm) return;
    const p = patterns.find((x) => x.id === logForm.pattern_id);
    if (!p) return;
    const note = logForm.note.trim();
    const row: Record<string, unknown> = {
      pattern_id: p.id,
      intensite: logForm.intensite,
      resultat,
      emotion: logForm.emotion,
      activite: logForm.activite,
      lieu: logForm.lieu,
      social: logForm.social == null ? null : logForm.social === "true",
      energie: logForm.energie ? Number(logForm.energie) : null,
      ressenti_apres: logForm.ressenti_apres,
      alternative_id: logForm.alternative_id,
      intensite_apres: logForm.alternative_id ? (logForm.intensite_apres ?? logForm.intensite) : null,
      note: null,
      is_encrypted: false,
    };
    if (note) {
      if (p.is_intime) {
        if (!cryptoKey) return showToast("Déverrouille pour enregistrer la note.");
        row.note = await encryptText(note, cryptoKey);
        row.is_encrypted = true;
      } else row.note = note;
    }
    const { data, error } = await supabase.from("sanemi_pattern_logs").insert(row).select().single();
    if (error) return showToast(error.message);
    if (data.is_encrypted) setDecrypted((prev) => ({ ...prev, [data.id]: note }));
    setLogs((prev) => [...prev, data]);
    setLogOpen(false);
    setLogForm(null);
    showToast(resultat === "resiste" ? "Résistance notée." : "Envie notée.");
  }

  async function spinEnvies() {
    const c = wheelCanvasRef.current;
    if (!c) return;
    const items = wheelItems();
    setSpinning(true);
    const i = await spinWheel(c, items, wheelRot, setWheelRot);
    setSpinning(false);
    if (i < 0) return;
    const e = envies.find((x) => x.id === items[i].id);
    if (!e) return;
    setTirageForm({ envie_id: e.id, intensite: e.intensite, statut: null, solution: "", satisfaction: null, ressenti_apres: null });
    setTirageOpen(true);
  }

  async function saveTirage() {
    if (!tirageForm) return;
    if (!tirageForm.statut) return showToast("Choisis une issue.");
    const e = envies.find((x) => x.id === tirageForm.envie_id);
    if (!e) return;
    const sol = tirageForm.solution.trim();
    const row: Record<string, unknown> = {
      envie_id: e.id,
      intensite: tirageForm.intensite,
      statut: tirageForm.statut,
      satisfaction: tirageForm.satisfaction ? Number(tirageForm.satisfaction) : null,
      ressenti_apres: tirageForm.ressenti_apres,
      solution: null,
      is_encrypted: false,
    };
    if (sol) {
      if (e.is_encrypted) {
        if (!cryptoKey) return showToast("Déverrouille pour enregistrer la solution.");
        row.solution = await encryptText(sol, cryptoKey);
        row.is_encrypted = true;
      } else row.solution = sol;
    }
    const { data, error } = await supabase.from("sanemi_envie_tirages").insert(row).select().single();
    if (error) return showToast(error.message);
    if (data.is_encrypted) setDecrypted((prev) => ({ ...prev, [data.id]: sol }));
    setTirages((prev) => [...prev, data]);
    await supabase.from("sanemi_envies").update({ intensite: tirageForm.intensite, updated_at: new Date().toISOString() }).eq("id", e.id);
    setEnvies((prev) => prev.map((x) => (x.id === e.id ? { ...x, intensite: tirageForm.intensite } : x)));
    setTirageOpen(false);
    setTirageForm(null);
    showToast("Tirage enregistré.");
  }

  async function saveEnvie() {
    const label = envieForm.label.trim();
    if (!label) return showToast("Écris l'envie.");
    const intime = envieForm.categorie === "intime";
    if (intime && !cryptoKey) return showToast(vault ? "Déverrouille d'abord." : "Crée d'abord un code dans Réglages.");
    const same = envies.find((e) => (!e.is_encrypted || decrypted[e.id]) && eLabel(e).toLowerCase() === label.toLowerCase());
    if (same) {
      const { error } = await supabase
        .from("sanemi_envies")
        .update({ recurrence: same.recurrence + 1, intensite: envieForm.intensite, updated_at: new Date().toISOString() })
        .eq("id", same.id);
      if (error) return showToast(error.message);
      setEnvies((prev) => prev.map((x) => (x.id === same.id ? { ...x, recurrence: x.recurrence + 1, intensite: envieForm.intensite } : x)));
      setEnvieOpen(false);
      return showToast("Déjà sur la roue : récurrence +1.");
    }
    const row: Record<string, unknown> = {
      label: intime ? await encryptText(label, cryptoKey as CryptoKey) : label,
      categorie: envieForm.categorie || "général",
      intensite: envieForm.intensite,
      implique_autrui: envieForm.implique_autrui === "true",
      is_encrypted: intime,
    };
    const { data, error } = await supabase.from("sanemi_envies").insert(row).select().single();
    if (error) return showToast(error.message);
    if (intime) setDecrypted((prev) => ({ ...prev, [data.id]: label }));
    setEnvies((prev) => [...prev, data]);
    setEnvieOpen(false);
    setEnvieForm({ label: "", categorie: "général", intensite: 5, implique_autrui: "false" });
    showToast("Envie ajoutée à la roue.");
  }

  async function recur(id: string) {
    const en = envies.find((x) => x.id === id);
    if (!en) return;
    const { error } = await supabase.from("sanemi_envies").update({ recurrence: en.recurrence + 1, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return showToast(error.message);
    setEnvies((prev) => prev.map((x) => (x.id === id ? { ...x, recurrence: x.recurrence + 1 } : x)));
    showToast("Récurrence +1.");
  }
  async function archiveEnvie(id: string) {
    const { error } = await supabase.from("sanemi_envies").update({ archived: true }).eq("id", id);
    if (error) return showToast(error.message);
    setEnvies((prev) => prev.filter((x) => x.id !== id));
    showToast("Envie retirée de la roue.");
  }

  async function savePlan() {
    if (!pid) return;
    const action = planForm.action.trim();
    if (!planForm.declencheur || !action) return showToast("Choisis un déclencheur et écris l'action.");
    const { data, error } = await supabase.from("sanemi_strategies").insert({ pattern_id: pid, declencheur: planForm.declencheur, action }).select().single();
    if (error) return showToast(error.message);
    setStrategies((prev) => [...prev, data]);
    setPlanOpen(false);
    setPlanForm({ declencheur: null, action: "" });
    showToast("Plan enregistré.");
  }
  async function togglePlan(id: string) {
    const s = strategies.find((x) => x.id === id);
    if (!s) return;
    const { error } = await supabase.from("sanemi_strategies").update({ active: !s.active }).eq("id", id);
    if (error) return showToast(error.message);
    setStrategies((prev) => prev.map((x) => (x.id === id ? { ...x, active: !x.active } : x)));
  }
  async function deletePlan(id: string) {
    if (!confirm("Supprimer ce plan ?")) return;
    const { error } = await supabase.from("sanemi_strategies").delete().eq("id", id);
    if (error) return showToast(error.message);
    setStrategies((prev) => prev.filter((x) => x.id !== id));
  }

  async function savePattern() {
    const name = patternForm.name.trim();
    if (!name) return showToast("Donne un nom au pattern.");
    const intime = patternForm.is_intime === "true";
    if (intime && !cryptoKey) return showToast(vault ? "Déverrouille d'abord." : "Crée d'abord un code dans Réglages.");
    const row: Record<string, unknown> = {
      name: intime ? await encryptText(name, cryptoKey as CryptoKey) : name,
      objectif: patternForm.objectif,
      is_intime: intime,
    };
    const { data, error } = await supabase.from("sanemi_patterns").insert(row).select().single();
    if (error) return showToast(error.message);
    if (intime) setDecrypted((prev) => ({ ...prev, [data.id]: name }));
    setPatterns((prev) => [...prev, data]);
    setPid(data.id);
    setPatternOpen(false);
    setPatternForm({ name: "", objectif: "observer", is_intime: "false" });
    showToast("Pattern créé.");
  }
  async function deletePattern(id: string) {
    if (!confirm("Supprimer ce pattern et toutes les envies notées avec ? C'est définitif.")) return;
    const { error } = await supabase.from("sanemi_patterns").delete().eq("id", id);
    if (error) return showToast(error.message);
    setPatterns((prev) => prev.filter((x) => x.id !== id));
    setLogs((prev) => prev.filter((l) => l.pattern_id !== id));
    setAlternatives((prev) => prev.filter((x) => x.pattern_id !== id));
    setStrategies((prev) => prev.filter((x) => x.pattern_id !== id));
    setPid((prev) => (prev === id ? null : prev));
  }
  async function deleteAlt(id: string) {
    const { error } = await supabase.from("sanemi_alternatives").delete().eq("id", id);
    if (error) return showToast(error.message);
    setAlternatives((prev) => prev.filter((x) => x.id !== id));
  }
  async function addAlt() {
    if (!pid) return;
    const label = altLabel.trim();
    if (!label) return;
    const { data, error } = await supabase.from("sanemi_alternatives").insert({ pattern_id: pid, label }).select().single();
    if (error) return showToast(error.message);
    setAlternatives((prev) => [...prev, data]);
    setAltLabel("");
  }

  if (loading) return <Loader />;
  if (missing) {
    return (
      <Empty>
        Configuration en cours de propagation côté base de données. Réessaie dans un instant.
        <div className="mt-3">
          <Button size="sm" onClick={() => loadAll()}>
            Recharger
          </Button>
        </div>
      </Empty>
    );
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: "log", label: "Noter" },
    { key: "lecture", label: "Lecture" },
    { key: "roue", label: "Roue" },
    { key: "plans", label: "Plans" },
    { key: "reglages", label: "Réglages" },
  ];

  return (
    <div className="animate-fade-in">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <div className="font-display text-xl font-extrabold">Patterns</div>
          <div className="text-xs text-ink-muted">Déclencheurs, envies, stratégies</div>
        </div>
        {vault && (
          <Button size="sm" onClick={() => (cryptoKey ? lock() : setPinOpen(true))}>
            {cryptoKey ? "Verrouiller" : "Déverrouiller"}
          </Button>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <Chip key={t.key} active={tab === t.key} onClick={() => setTab(t.key)}>
            {t.label}
          </Chip>
        ))}
      </div>

      {patterns.length > 1 && tab !== "roue" && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {patterns.map((p) => (
            <Chip key={p.id} active={p.id === pid} onClick={() => setPid(p.id)}>
              {pName(p)}
            </Chip>
          ))}
        </div>
      )}

      {tab === "log" && (
        <LogTab
          patterns={patterns}
          pattern={pattern}
          logsFor={logsFor}
          pName={pName}
          onSeed={seedTabac}
          onNewPattern={() => setPatternOpen(true)}
          onOpenLog={openLogSheet}
        />
      )}

      {tab === "lecture" && (
        <LectureTab
          pattern={pattern}
          logsFor={logsFor}
          journal={journal}
          pName={pName}
          onGoToLog={() => setTab("log")}
          alternatives={alternatives}
        />
      )}

      {tab === "roue" && (
        <RoueTab
          wheelMode={wheelMode}
          setWheelMode={setWheelMode}
          wheelCanvasRef={wheelCanvasRef}
          items={wheelItems()}
          spinning={spinning}
          onSpin={spinEnvies}
          envies={envies}
          tirages={tirages}
          eLabel={eLabel}
          tSol={tSol}
          onAddEnvie={() => setEnvieOpen(true)}
          onRecur={recur}
          onArchive={archiveEnvie}
        />
      )}

      {tab === "plans" && (
        <PlansTab
          pattern={pattern}
          pName={pName}
          logsFor={logsFor}
          strategies={strategies}
          onNewPlan={() => setPlanOpen(true)}
          onToggle={togglePlan}
          onDelete={deletePlan}
        />
      )}

      {tab === "reglages" && (
        <ReglagesTab
          patterns={patterns}
          pattern={pattern}
          pName={pName}
          alternatives={alternatives}
          vault={vault}
          cryptoKey={cryptoKey}
          altLabel={altLabel}
          setAltLabel={setAltLabel}
          onAddAlt={addAlt}
          onDeleteAlt={deleteAlt}
          onNewPattern={() => setPatternOpen(true)}
          onDeletePattern={deletePattern}
          onSetupPin={() => setPinOpen(true)}
          onLock={lock}
        />
      )}

      {/* Sheet: log an envie */}
      <Modal open={logOpen} onClose={() => { setLogOpen(false); setLogForm(null); }} title="Nouvelle envie">
        {logForm && (
          <>
            <p className="mb-3 font-display text-sm font-bold">{pName(patterns.find((p) => p.id === logForm.pattern_id))}</p>
            <RangeField label="Intensité de l'envie" value={logForm.intensite} onChange={(v) => setLogForm({ ...logForm, intensite: v })} />
            <ChipGroup label="Émotion juste avant" options={EMOTIONS} value={logForm.emotion} onChange={(v) => setLogForm({ ...logForm, emotion: v })} />
            {(() => {
              const plan = strategies.find(
                (s) => s.active && s.pattern_id === logForm.pattern_id && (s.declencheur === logForm.emotion || s.declencheur === logForm.activite)
              );
              return plan ? (
                <p className="mb-3 rounded-lg border border-orange/30 bg-orange/5 p-2.5 text-xs">
                  Ton plan : si {plan.declencheur}, alors {plan.action}.
                </p>
              ) : null;
            })()}
            <ChipGroup label="Ce que tu faisais" options={ACTIVITES} value={logForm.activite} onChange={(v) => setLogForm({ ...logForm, activite: v })} />
            <ChipGroup label="Lieu" options={LIEUX} value={logForm.lieu} onChange={(v) => setLogForm({ ...logForm, lieu: v })} />
            <ChipGroup
              label="Avec d'autres personnes"
              options={[["true", "Oui"], ["false", "Non"]]}
              value={logForm.social}
              onChange={(v) => setLogForm({ ...logForm, social: v })}
            />
            <ChipGroup label="Énergie" options={["1", "2", "3", "4", "5"]} value={logForm.energie} onChange={(v) => setLogForm({ ...logForm, energie: v })} />
            {altItems(logForm.pattern_id).length > 0 && (
              <div className="mb-3">
                <div className="mb-1.5 font-mono text-[11px] uppercase tracking-wide text-ink-muted">Alternative</div>
                <div className="mx-auto mb-2 aspect-square w-32">
                  <canvas ref={altWheelCanvasRef} className="h-full w-full" aria-label="Roue des alternatives" />
                </div>
                <Button type="button" className="w-full" onClick={spinAlt} disabled={spinning}>
                  {logForm.alternative_id ? "Relancer la roue" : "Tourner la roue d'alternatives"}
                </Button>
                {logForm.alternative_id && (
                  <>
                    <p className="mt-2.5 rounded-lg border border-orange/30 bg-orange/5 p-2.5 text-xs">
                      Essaie : {alternatives.find((a) => a.id === logForm.alternative_id)?.label}. Puis note l&apos;intensité.
                    </p>
                    <RangeField
                      label="Intensité après l'alternative"
                      value={logForm.intensite_apres ?? logForm.intensite}
                      onChange={(v) => setLogForm({ ...logForm, intensite_apres: v })}
                    />
                  </>
                )}
              </div>
            )}
            <ChipGroup label="Ressenti après (facultatif)" options={RESSENTIS} value={logForm.ressenti_apres} onChange={(v) => setLogForm({ ...logForm, ressenti_apres: v })} />
            <Field label={`Note${patterns.find((p) => p.id === logForm.pattern_id)?.is_intime ? " chiffrée" : ""}`}>
              <textarea rows={2} value={logForm.note} onChange={(e) => setLogForm({ ...logForm, note: e.target.value })} className={inputClass} />
            </Field>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => saveLog("resiste")}>
                J&apos;ai résisté
              </Button>
              <Button className="flex-1" onClick={() => saveLog("cede")}>
                J&apos;ai cédé
              </Button>
            </div>
          </>
        )}
      </Modal>

      {/* Sheet: tirage roue */}
      <Modal open={tirageOpen} onClose={() => { setTirageOpen(false); setTirageForm(null); }} title="La roue a choisi">
        {tirageForm &&
          (() => {
            const e = envies.find((x) => x.id === tirageForm.envie_id);
            if (!e) return null;
            if (e.is_encrypted && !cryptoKey) {
              return <p className="text-sm text-ink-muted">Cette envie est privée. Déverrouille pour la voir.</p>;
            }
            const opts: Opt[] = e.implique_autrui
              ? [["planifiee", "Proposer ou planifier"], ["non", "Pas cette fois"]]
              : [["realisee", "Réalisée"], ["planifiee", "Planifiée"], ["non", "Pas cette fois"]];
            return (
              <>
                <p className="mb-3 font-display text-sm font-bold">{eLabel(e)}</p>
                {e.implique_autrui && (
                  <p className="mb-3 rounded-lg border border-orange/30 bg-orange/5 p-2.5 text-xs">
                    Elle implique d&apos;autres personnes : elle ne se réalise que si elles sont partantes.
                  </p>
                )}
                <RangeField label="Intensité en ce moment" value={tirageForm.intensite} onChange={(v) => setTirageForm({ ...tirageForm, intensite: v })} />
                <ChipGroup label="Issue" options={opts} value={tirageForm.statut} onChange={(v) => setTirageForm({ ...tirageForm, statut: v })} />
                <Field label={`Comment tu l'as satisfaite ou résolue${e.is_encrypted ? " (chiffré)" : ""}`}>
                  <textarea rows={2} value={tirageForm.solution} onChange={(ev) => setTirageForm({ ...tirageForm, solution: ev.target.value })} className={inputClass} />
                </Field>
                <ChipGroup label="Satisfaction" options={["1", "2", "3", "4", "5"]} value={tirageForm.satisfaction} onChange={(v) => setTirageForm({ ...tirageForm, satisfaction: v })} />
                <ChipGroup label="Ressenti après" options={RESSENTIS} value={tirageForm.ressenti_apres} onChange={(v) => setTirageForm({ ...tirageForm, ressenti_apres: v })} />
                <Button variant="primary" className="w-full" onClick={saveTirage}>
                  Enregistrer le tirage
                </Button>
              </>
            );
          })()}
      </Modal>

      {/* Sheet: nouvelle envie */}
      <Modal open={envieOpen} onClose={() => setEnvieOpen(false)} title="Nouvelle envie">
        <Field label="L'envie">
          <input value={envieForm.label} onChange={(e) => setEnvieForm({ ...envieForm, label: e.target.value })} className={inputClass} placeholder="Ex. partir un week-end à Essaouira" />
        </Field>
        <ChipGroup label="Catégorie" options={CATEGORIES} value={envieForm.categorie} onChange={(v) => setEnvieForm({ ...envieForm, categorie: v ?? "général" })} />
        {envieForm.categorie === "intime" && !vault && <p className="mb-3 text-xs text-ink-muted">Crée d&apos;abord un code dans Réglages pour chiffrer les envies intimes.</p>}
        {envieForm.categorie === "intime" && vault && !cryptoKey && <p className="mb-3 text-xs text-ink-muted">Déverrouille pour ajouter une envie intime.</p>}
        <RangeField label="Intensité" value={envieForm.intensite} onChange={(v) => setEnvieForm({ ...envieForm, intensite: v })} />
        <ChipGroup
          label="Implique d'autres personnes"
          options={[["true", "Oui"], ["false", "Non"]]}
          value={envieForm.implique_autrui}
          onChange={(v) => setEnvieForm({ ...envieForm, implique_autrui: v ?? "false" })}
        />
        <Button variant="primary" className="w-full" onClick={saveEnvie}>
          Ajouter à la roue
        </Button>
      </Modal>

      {/* Sheet: nouveau plan */}
      <Modal open={planOpen} onClose={() => setPlanOpen(false)} title="Nouveau plan">
        <ChipGroup label="Si…" options={[...EMOTIONS, ...ACTIVITES]} value={planForm.declencheur} onChange={(v) => setPlanForm({ ...planForm, declencheur: v })} />
        <Field label="…alors je">
          <input value={planForm.action} onChange={(e) => setPlanForm({ ...planForm, action: e.target.value })} className={inputClass} placeholder="Ex. marche 5 minutes et bois un verre d'eau" />
        </Field>
        <Button variant="primary" className="w-full" onClick={savePlan}>
          Enregistrer le plan
        </Button>
      </Modal>

      {/* Sheet: nouveau pattern */}
      <Modal open={patternOpen} onClose={() => setPatternOpen(false)} title="Nouveau pattern">
        <Field label="Ce que tu observes">
          <input value={patternForm.name} onChange={(e) => setPatternForm({ ...patternForm, name: e.target.value })} className={inputClass} placeholder="Ex. grignotage du soir" />
        </Field>
        <ChipGroup
          label="Objectif"
          options={[["observer", "Observer"], ["reduire", "Réduire"], ["arreter", "Arrêter"]]}
          value={patternForm.objectif}
          onChange={(v) => setPatternForm({ ...patternForm, objectif: v ?? "observer" })}
        />
        <ChipGroup
          label="Intime : nom et notes chiffrés"
          options={[["true", "Oui"], ["false", "Non"]]}
          value={patternForm.is_intime}
          onChange={(v) => setPatternForm({ ...patternForm, is_intime: v ?? "false" })}
        />
        {patternForm.is_intime === "true" && !cryptoKey && (
          vault ? <p className="mb-3 text-xs text-ink-muted">Déverrouille d&apos;abord dans Réglages.</p> : <p className="mb-3 text-xs text-ink-muted">Crée d&apos;abord un code dans Réglages.</p>
        )}
        <Button variant="primary" className="w-full" onClick={savePattern}>
          Créer le pattern
        </Button>
      </Modal>

      {/* Sheet: PIN */}
      <Modal open={pinOpen} onClose={() => { setPinOpen(false); setPinValue(""); }} title={vault ? "Déverrouiller" : "Créer un code"}>
        <p className="mb-3 text-xs text-ink-muted">
          {vault
            ? "Affiche les contenus intimes pendant 5 minutes d'activité."
            : "Ce code chiffre tes contenus intimes dans ton téléphone avant l'envoi. En cas d'oubli, il n'existe aucune récupération."}
        </p>
        <Field label="Code">
          <input
            type="password"
            inputMode="numeric"
            minLength={4}
            value={pinValue}
            onChange={(e) => setPinValue(e.target.value)}
            className={inputClass}
            placeholder={vault ? "Ton code" : "4 chiffres ou plus"}
          />
        </Field>
        <Button
          variant="primary"
          className="w-full"
          onClick={async () => {
            if (vault) await unlock(pinValue);
            else await setupPin(pinValue);
            setPinValue("");
            setPinOpen(false);
          }}
        >
          {vault ? "Déverrouiller" : "Créer le code"}
        </Button>
      </Modal>

      {toast && (
        <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-border-strong bg-surface-2 px-4 py-2 text-xs shadow-lg lg:bottom-6">
          {toast}
        </div>
      )}
    </div>
  );
}

function LogTab({
  patterns,
  pattern,
  logsFor,
  pName,
  onSeed,
  onNewPattern,
  onOpenLog,
}: {
  patterns: SanemiPattern[];
  pattern: SanemiPattern | null;
  logsFor: (id: string) => SanemiPatternLog[];
  pName: (p: SanemiPattern | null | undefined) => string;
  onSeed: () => void;
  onNewPattern: () => void;
  onOpenLog: () => void;
}) {
  if (!patterns.length) {
    return (
      <Card>
        <div className="mb-2 font-display text-lg font-bold">Qu&apos;est-ce que tu veux observer ?</div>
        <p className="mb-3 text-sm text-ink-muted">
          Chaque envie notée ici devient une donnée. Après deux ou trois semaines, la lecture te montre ce qui la déclenche et ce qui l&apos;accentue.
        </p>
        <div className="flex flex-col gap-2">
          <Button variant="primary" onClick={onSeed}>
            Commencer avec l&apos;envie de fumer
          </Button>
          <Button onClick={onNewPattern}>Créer un autre pattern</Button>
        </div>
      </Card>
    );
  }
  if (!pattern) return <Empty>Sélectionne un pattern.</Empty>;
  const L = logsFor(pattern.id);
  const today = L.filter((l) => new Date(l.logged_at).toDateString() === new Date().toDateString());
  const res = today.filter((l) => l.resultat === "resiste").length;
  const recent = L.slice(-6).reverse();
  return (
    <>
      <Card accent className="mb-4 text-center">
        <button onClick={onOpenLog} className="mb-3 w-full cursor-pointer rounded-xl border border-orange bg-orange/10 py-6 text-orange transition-colors hover:bg-orange/20">
          <div className="font-display text-lg font-bold">J&apos;ai une envie</div>
          <div className="text-xs text-ink-muted">{pName(pattern)}</div>
        </button>
        <p className="text-sm">
          <strong>{today.length}</strong> aujourd&apos;hui, dont <strong>{res}</strong> résistée{res > 1 ? "s" : ""}
        </p>
      </Card>
      <Card>
        <CardTitle>Dernières envies</CardTitle>
        {recent.length ? (
          <ul className="flex flex-col gap-2.5">
            {recent.map((l) => (
              <li key={l.id} className="flex items-center gap-2.5 border-b border-border pb-2.5 last:border-none">
                <span className={`h-2 w-2 shrink-0 rounded-full ${l.resultat === "resiste" ? "bg-green" : l.resultat === "cede" ? "bg-red" : "bg-surface-3"}`} />
                <div className="flex-1 text-xs">
                  <b>{fmtTime(l.logged_at)}</b>{" "}
                  <span className="text-ink-muted">
                    intensité {l.intensite}/10{l.emotion ? `, ${l.emotion}` : ""}
                    {l.activite ? `, ${l.activite}` : ""}
                  </span>
                </div>
                <em className="text-[10px] text-ink-dim">{l.resultat === "resiste" ? "résistée" : l.resultat === "cede" ? "cédé" : ""}</em>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Rien pour l&apos;instant. Note la prochaine envie dès qu&apos;elle arrive.</Empty>
        )}
      </Card>
    </>
  );
}

function LectureTab({
  pattern,
  logsFor,
  journal,
  pName,
  onGoToLog,
  alternatives,
}: {
  pattern: SanemiPattern | null;
  logsFor: (id: string) => SanemiPatternLog[];
  journal: SanemiJournalEntry[];
  pName: (p: SanemiPattern | null | undefined) => string;
  onGoToLog: () => void;
  alternatives: SanemiAlternative[];
}) {
  const patternId = pattern?.id ?? null;
  const computed = useMemo(() => {
    if (!patternId) return null;
    const now = +new Date();
    const L = logsFor(patternId);
    const M = between(L, now - 30 * DAY, now + DAY, "logged_at");
    if (L.length < 5) return { L, M, ready: false as const };
    const sig = signals(L, journal);
    const score = sig.reduce((s, x) => s + x.lvl, 0);
    const [tone, label]: ["green" | "amber" | "red", string] =
      score >= 3 ? ["red", "Préoccupant"] : score >= 1 ? ["amber", "À surveiller"] : ["green", "Stable"];
    const R = rate(M);
    const js = journalStats(M, journal);
    const heat = heatmapData(M);
    const weekly = weeklyData(L);
    const altRows = altStatsData(M, alternatives.filter((a) => a.pattern_id === patternId));
    const ressentiRows = RESSENTIS.map(([k, t]) => ({ label: t, v: M.filter((l) => l.ressenti_apres === k).length })).filter((r) => r.v);
    return { L, M, ready: true as const, sig, tone, label, R, js, heat, weekly, altRows, ressentiRows };
  }, [patternId, logsFor, journal, alternatives]);

  if (!pattern || !computed) return <Empty>Aucun pattern sélectionné.</Empty>;
  const { L } = computed;
  if (!computed.ready) {
    const remaining = 5 - L.length;
    return (
      <Card>
        <div className="mb-2 font-display text-lg font-bold">Encore {remaining} envie{remaining > 1 ? "s" : ""} à noter</div>
        <p className="mb-3 text-sm text-ink-muted">La lecture devient fiable à partir de 5 envies et se précise vraiment après deux à trois semaines.</p>
        <Button variant="primary" onClick={onGoToLog}>
          Noter une envie
        </Button>
      </Card>
    );
  }
  const { M, sig, tone, label, R, js, heat, weekly, altRows, ressentiRows } = computed;
  const hours = ["0h", "3h", "6h", "9h", "12h", "15h", "18h", "21h"];

  return (
    <div className="flex flex-col gap-3.5">
      <Card>
        <div className="mb-2 flex items-center justify-between">
          <div className="font-display text-lg font-bold">{label}</div>
          <Badge tone={tone}>{tone === "green" ? "OK" : tone === "amber" ? "!" : "!!"}</Badge>
        </div>
        <p className="mb-2 text-sm text-ink-muted">
          {pName(pattern)}, 30 derniers jours : {M.length} envies, intensité moyenne {fmt1(avg(M.map((l) => l.intensite)))}/10
          {R != null ? `, résistance ${pct(R)}` : ""}.
        </p>
        {sig.length ? (
          <ul className="flex flex-col gap-1.5">
            {sig.map((s, i) => (
              <li key={i} className={`text-xs ${s.lvl >= 2 ? "text-red" : "text-amber"}`}>
                {s.t}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-ink-dim">Aucun signal de dérive sur les deux dernières semaines.</p>
        )}
      </Card>

      <Card>
        <CardTitle>Tes moments à risque</CardTitle>
        {heat.peak && (
          <p className="mb-2 text-sm">
            Pic : <strong>{JOURS[heat.peak.i]} entre {hours[heat.peak.j]} et {(heat.peak.j + 1) * 3}h</strong> ({heat.peak.c} envies).
          </p>
        )}
        <div className="overflow-x-auto">
          <div className="grid grid-cols-9 gap-0.5 text-[9px]" style={{ minWidth: 360 }}>
            <span />
            {hours.map((h) => (
              <span key={h} className="text-center text-ink-dim">
                {h}
              </span>
            ))}
            {heat.grid.map((row, i) => (
              <>
                <span key={`d${i}`} className="text-ink-muted">
                  {JOURS[i]}
                </span>
                {row.map((c, j) => (
                  <span
                    key={`${i}-${j}`}
                    className="flex aspect-square items-center justify-center rounded"
                    style={{ background: `rgba(255,106,0,${c / heat.max})` }}
                  >
                    {c || ""}
                  </span>
                ))}
              </>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle>Ce qui déclenche</CardTitle>
        <div className="mb-2 text-[11px] font-semibold text-ink-muted">Émotions</div>
        <Bars rows={countBy(M, "emotion")} />
        <div className="mb-2 mt-3 text-[11px] font-semibold text-ink-muted">Activités</div>
        <Bars rows={countBy(M, "activite")} />
        <div className="mb-2 mt-3 text-[11px] font-semibold text-ink-muted">Lieux</div>
        <Bars rows={countBy(M, "lieu")} />
      </Card>

      <Card>
        <CardTitle>Ce qui accentue</CardTitle>
        <Bars rows={intensityBy(M)} max={10} />
        <p className="mt-2 text-[11px] text-ink-dim">Intensité moyenne selon l&apos;émotion ou l&apos;activité, à partir de 2 envies.</p>
      </Card>

      <Card>
        <CardTitle>Résistance par semaine</CardTitle>
        <div className="flex items-end justify-between gap-1">
          {weekly.map((w, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[10px] text-ink-muted">{w.r == null ? "" : pct(w.r)}</span>
              <span className="flex h-16 w-full items-end overflow-hidden rounded bg-surface-3">
                <i className="w-full bg-orange" style={{ height: `${w.r == null ? 0 : Math.max(3, w.r * 100)}%` }} />
              </span>
              <span className="text-[9px] text-ink-dim">{w.label}</span>
              <span className="text-[9px] text-ink-dim">{w.n}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-ink-dim">Part des envies résistées chaque semaine. Le chiffre du bas est le nombre d&apos;envies.</p>
      </Card>

      {altRows.length > 0 && (
        <Card>
          <CardTitle>Alternatives qui marchent</CardTitle>
          <Bars rows={altRows} max={10} />
          <p className="mt-2 text-[11px] text-ink-dim">Baisse moyenne de l&apos;intensité après l&apos;alternative, sur 10.</p>
        </Card>
      )}

      {ressentiRows.length > 0 && (
        <Card>
          <CardTitle>Ressenti après</CardTitle>
          <Bars rows={ressentiRows} />
        </Card>
      )}

      {js && (
        <Card>
          <CardTitle>Lien avec ton humeur</CardTitle>
          <p className="text-sm">
            Les jours d&apos;humeur basse (2 ou moins dans ton journal), tu as en moyenne <strong>{fmt1(js.low)}</strong> envies, contre{" "}
            <strong>{fmt1(js.high)}</strong> les autres jours.
          </p>
        </Card>
      )}
    </div>
  );
}

function RoueTab({
  wheelMode,
  setWheelMode,
  wheelCanvasRef,
  items,
  spinning,
  onSpin,
  envies,
  tirages,
  eLabel,
  tSol,
  onAddEnvie,
  onRecur,
  onArchive,
}: {
  wheelMode: "hasard" | "pondere";
  setWheelMode: (m: "hasard" | "pondere") => void;
  wheelCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  items: WheelItem[];
  spinning: boolean;
  onSpin: () => void;
  envies: SanemiEnvie[];
  tirages: SanemiEnvieTirage[];
  eLabel: (e: SanemiEnvie | undefined) => string;
  tSol: (t: SanemiEnvieTirage) => string | null;
  onAddEnvie: () => void;
  onRecur: (id: string) => void;
  onArchive: (id: string) => void;
}) {
  const byE = envies.map((e) => {
    const T = tirages.filter((t) => t.envie_id === e.id);
    const I = T.filter((t) => t.intensite).map((t) => t.intensite as number);
    return { e, T, done: T.filter((t) => t.statut === "realisee").length, trend: I.length >= 2 ? I[I.length - 1] - I[0] : 0 };
  });
  const total = tirages.length;
  const realised = tirages.filter((t) => t.statut === "realisee").length;
  const stuck = byE.filter((x) => x.e.recurrence >= 3 && x.done === 0);
  const rising = byE.filter((x) => x.trend >= 2);
  const top = [...byE].sort((a, b) => b.e.recurrence - a.e.recurrence).slice(0, 5);
  const good = tirages.filter((t) => (t.satisfaction ?? 0) >= 4 && tSol(t)).slice(-4).reverse();

  return (
    <div className="flex flex-col gap-3.5">
      <Card>
        <div className="mb-3 flex justify-center gap-1.5">
          <Chip active={wheelMode === "hasard"} onClick={() => setWheelMode("hasard")}>
            Hasard
          </Chip>
          <Chip active={wheelMode === "pondere"} onClick={() => setWheelMode("pondere")}>
            Pondéré par l&apos;intensité
          </Chip>
        </div>
        <div className="relative mx-auto mb-3 aspect-square w-56 max-w-full">
          <canvas ref={wheelCanvasRef} className="h-full w-full" aria-label="Roue des envies" />
        </div>
        <Button variant="primary" className="w-full" onClick={onSpin} disabled={items.length < 2 || spinning}>
          Tourner la roue
        </Button>
        {items.length < 2 && <p className="mt-2 text-center text-xs text-ink-dim">Ajoute au moins deux envies pour tourner la roue.</p>}
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <CardTitle>Tes envies</CardTitle>
          <button onClick={onAddEnvie} className="cursor-pointer text-xs text-orange hover:underline">
            + Ajouter une envie
          </button>
        </div>
        {envies.length ? (
          <ul className="flex flex-col gap-2.5">
            {envies.map((e) => (
              <li key={e.id} className="flex items-center gap-2.5 border-b border-border pb-2.5 last:border-none">
                <div className="flex-1 text-xs">
                  <b>{eLabel(e)}</b>
                  <br />
                  <span className="text-ink-muted">
                    {e.categorie}, intensité {e.intensite}/10, revenue {e.recurrence} fois{e.implique_autrui ? ", implique d'autres personnes" : ""}
                  </span>
                </div>
                <Button size="sm" onClick={() => onRecur(e.id)}>
                  Elle revient
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onArchive(e.id)}>
                  Retirer
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Aucune envie pour l&apos;instant.</Empty>
        )}
      </Card>

      {total > 0 && (
        <Card>
          <CardTitle>Lecture de la roue</CardTitle>
          <div className="mb-3 flex gap-4">
            <div>
              <div className="font-display text-xl font-bold">{total}</div>
              <div className="text-[10px] text-ink-muted">tirages</div>
            </div>
            <div>
              <div className="font-display text-xl font-bold">{pct(realised / total)}</div>
              <div className="text-[10px] text-ink-muted">réalisées</div>
            </div>
          </div>
          <div className="mb-1.5 text-[11px] font-semibold text-ink-muted">Les plus récurrentes</div>
          <Bars
            rows={top.map((x) => ({
              label: eLabel(x.e),
              v: x.e.recurrence,
              note: `${x.done} réalisée${x.done > 1 ? "s" : ""} sur ${x.T.length} tirage${x.T.length > 1 ? "s" : ""}`,
            }))}
          />
          {stuck.length > 0 && (
            <>
              <div className="mb-1.5 mt-3 text-[11px] font-semibold text-ink-muted">Reviennent sans être résolues</div>
              <ul className="flex flex-col gap-1 text-xs text-ink-muted">
                {stuck.map((x) => (
                  <li key={x.e.id}>
                    {eLabel(x.e)} : revenue {x.e.recurrence} fois, jamais réalisée
                  </li>
                ))}
              </ul>
            </>
          )}
          {rising.length > 0 && (
            <>
              <div className="mb-1.5 mt-3 text-[11px] font-semibold text-ink-muted">S&apos;intensifient</div>
              <ul className="flex flex-col gap-1 text-xs text-ink-muted">
                {rising.map((x) => (
                  <li key={x.e.id}>
                    {eLabel(x.e)} : +{x.trend} points d&apos;intensité depuis le premier tirage
                  </li>
                ))}
              </ul>
            </>
          )}
          {good.length > 0 && (
            <>
              <div className="mb-1.5 mt-3 text-[11px] font-semibold text-ink-muted">Solutions qui te satisfont</div>
              <ul className="flex flex-col gap-1 text-xs text-ink-muted">
                {good.map((t) => (
                  <li key={t.id}>
                    {tSol(t)} <span className="text-ink-dim">({eLabel(envies.find((e) => e.id === t.envie_id))}, {t.satisfaction}/5)</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      )}
    </div>
  );
}

function PlansTab({
  pattern,
  pName,
  logsFor,
  strategies,
  onNewPlan,
  onToggle,
  onDelete,
}: {
  pattern: SanemiPattern | null;
  pName: (p: SanemiPattern | null | undefined) => string;
  logsFor: (id: string) => SanemiPatternLog[];
  strategies: SanemiStrategy[];
  onNewPlan: () => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  if (!pattern) return <Empty>Aucun pattern sélectionné.</Empty>;
  const L = logsFor(pattern.id);
  const P = strategies.filter((s) => s.pattern_id === pattern.id);
  return (
    <Card>
      <CardTitle>Tes plans pour {pName(pattern)}</CardTitle>
      <p className="mb-3 text-xs text-ink-muted">Un plan dit quoi faire quand un déclencheur précis arrive. Il s&apos;affiche dans le formulaire dès que tu choisis ce déclencheur.</p>
      {P.length ? (
        <ul className="mb-3 flex flex-col gap-2.5">
          {P.map((s) => (
            <li key={s.id} className={`rounded-lg border border-border bg-surface-2 p-3 ${s.active ? "" : "opacity-50"}`}>
              <p className="text-sm">
                <b>Si</b> {s.declencheur}, <b>alors</b> {s.action}
              </p>
              <p className="mt-1 text-[11px] text-ink-muted">{planEffect(s, L)}</p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={() => onToggle(s.id)}>
                  {s.active ? "Mettre en pause" : "Réactiver"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onDelete(s.id)}>
                  Supprimer
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>Aucun plan. Commence par ton déclencheur le plus fréquent, visible dans Lecture.</Empty>
      )}
      <Button variant="primary" onClick={onNewPlan}>
        Nouveau plan
      </Button>
    </Card>
  );
}

function ReglagesTab({
  patterns,
  pattern,
  pName,
  alternatives,
  vault,
  cryptoKey,
  altLabel,
  setAltLabel,
  onAddAlt,
  onDeleteAlt,
  onNewPattern,
  onDeletePattern,
  onSetupPin,
  onLock,
}: {
  patterns: SanemiPattern[];
  pattern: SanemiPattern | null;
  pName: (p: SanemiPattern | null | undefined) => string;
  alternatives: SanemiAlternative[];
  vault: SanemiVault | null;
  cryptoKey: CryptoKey | null;
  altLabel: string;
  setAltLabel: (v: string) => void;
  onAddAlt: () => void;
  onDeleteAlt: (id: string) => void;
  onNewPattern: () => void;
  onDeletePattern: (id: string) => void;
  onSetupPin: () => void;
  onLock: () => void;
}) {
  const objLabels: Record<string, string> = { observer: "observer", reduire: "réduire", arreter: "arrêter" };
  const alts = pattern ? alternatives.filter((a) => a.pattern_id === pattern.id) : [];
  return (
    <div className="flex flex-col gap-3.5">
      <Card>
        <CardTitle>Patterns suivis</CardTitle>
        {patterns.length > 0 && (
          <ul className="mb-3 flex flex-col gap-2">
            {patterns.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 border-b border-border pb-2 last:border-none">
                <div className="text-xs">
                  <b>{pName(p)}</b>
                  <br />
                  <span className="text-ink-muted">
                    objectif : {objLabels[p.objectif]}
                    {p.is_intime ? ", intime" : ""}
                  </span>
                </div>
                <Button size="sm" variant="ghost" onClick={() => onDeletePattern(p.id)}>
                  Supprimer
                </Button>
              </li>
            ))}
          </ul>
        )}
        <Button onClick={onNewPattern}>Nouveau pattern</Button>
      </Card>

      {pattern && (
        <Card>
          <CardTitle>Alternatives pour {pName(pattern)}</CardTitle>
          <div className="mb-2.5 flex flex-wrap gap-1.5">
            {alts.map((a) => (
              <span key={a.id} className="inline-flex items-center gap-1 rounded-full border border-orange bg-orange/10 px-3 py-1 text-xs text-orange">
                {a.label}
                <button onClick={() => onDeleteAlt(a.id)} aria-label={`Retirer ${a.label}`} className="cursor-pointer">
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-1.5">
            <input
              value={altLabel}
              onChange={(e) => setAltLabel(e.target.value)}
              placeholder="Ex. 10 minutes de marche"
              maxLength={60}
              className={`${inputClass} flex-1`}
            />
            <Button size="sm" onClick={onAddAlt}>
              Ajouter
            </Button>
          </div>
        </Card>
      )}

      <Card>
        <CardTitle>Code de confidentialité</CardTitle>
        {!vault ? (
          <>
            <p className="mb-3 text-xs text-ink-muted">
              Ce code chiffre tes contenus intimes dans ton téléphone avant l&apos;envoi. Sans lui, personne ne peut les lire, pas même la base de données. En
              cas d&apos;oubli, il n&apos;existe aucune récupération.
            </p>
            <Button variant="primary" onClick={onSetupPin}>
              Créer un code
            </Button>
          </>
        ) : cryptoKey ? (
          <>
            <p className="mb-3 text-sm">Déverrouillé. Verrouillage automatique après 5 minutes sans activité.</p>
            <Button onClick={onLock}>Verrouiller maintenant</Button>
          </>
        ) : (
          <>
            <p className="mb-3 text-xs text-ink-muted">Verrouillé : les contenus intimes sont masqués.</p>
            <Button variant="primary" onClick={onSetupPin}>
              Déverrouiller
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}
