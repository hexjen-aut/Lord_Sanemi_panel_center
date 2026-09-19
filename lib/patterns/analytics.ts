import type { SanemiJournalEntry, SanemiPatternLog, SanemiStrategy } from "@/lib/types";
import { COMPENSATOIRES, DAY } from "./constants";

export const avg = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
export const pct = (x: number) => `${Math.round(x * 100)} %`;
export const fmt1 = (x: number | null) => (x == null ? "–" : x.toFixed(1));
export const hh = (h: number) => {
  const H = Math.floor(h);
  const M = Math.round((h - H) * 60);
  return `${H}h${String(M).padStart(2, "0")}`;
};
export const localDate = (d: string | number | Date) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};
export const ts = (x: string | number | Date) => +new Date(x);

export function rate(logs: SanemiPatternLog[]): number | null {
  const d = logs.filter((l) => l.resultat);
  return d.length ? d.filter((l) => l.resultat === "resiste").length / d.length : null;
}

export function between<T>(arr: T[], a: number, b: number, field: keyof T): T[] {
  return arr.filter((x) => {
    const t = ts(x[field] as unknown as string);
    return t >= a && t < b;
  });
}

export interface BarRow {
  label: string;
  v: number;
  display?: string;
  note?: string;
}

export function countBy(logs: SanemiPatternLog[], field: "emotion" | "activite" | "lieu"): BarRow[] {
  const g: Record<string, number[]> = {};
  logs.forEach((l) => {
    const val = l[field];
    if (val) (g[val] ??= []).push(l.intensite);
  });
  return Object.entries(g)
    .map(([k, v]) => ({ label: k, v: v.length, note: `intensité moyenne ${(avg(v) ?? 0).toFixed(1)}` }))
    .sort((a, b) => b.v - a.v)
    .slice(0, 5);
}

export function intensityBy(logs: SanemiPatternLog[]): BarRow[] {
  const g: Record<string, number[]> = {};
  logs.forEach((l) => {
    (["emotion", "activite"] as const).forEach((f) => {
      const val = l[f];
      if (val) (g[val] ??= []).push(l.intensite);
    });
  });
  return Object.entries(g)
    .filter(([, v]) => v.length >= 2)
    .map(([k, v]) => {
      const a = avg(v) ?? 0;
      return { label: k, v: a, display: a.toFixed(1) };
    })
    .sort((a, b) => b.v - a.v)
    .slice(0, 6);
}

export function journalStats(logs: SanemiPatternLog[], journal: SanemiJournalEntry[]): { low: number; high: number } | null {
  if (!journal.length) return null;
  const perDay: Record<string, number> = {};
  logs.forEach((l) => {
    const d = localDate(l.logged_at);
    perDay[d] = (perDay[d] || 0) + 1;
  });
  const low: number[] = [];
  const high: number[] = [];
  journal.forEach((j) => {
    if (j.humeur == null || ts(j.date) < Date.now() - 31 * DAY) return;
    (j.humeur <= 2 ? low : high).push(perDay[j.date] || 0);
  });
  if (low.length < 2 || high.length < 2) return null;
  return { low: avg(low) ?? 0, high: avg(high) ?? 0 };
}

export function firstHourAvg(logs: SanemiPatternLog[]): number | null {
  const byDay: Record<string, number> = {};
  logs.forEach((l) => {
    const d = new Date(l.logged_at);
    const k = localDate(d);
    const h = d.getHours() + d.getMinutes() / 60;
    byDay[k] = Math.min(byDay[k] ?? 99, h);
  });
  return avg(Object.values(byDay));
}

export interface Signal {
  lvl: 1 | 2;
  t: string;
}

export function signals(logs: SanemiPatternLog[], journal: SanemiJournalEntry[]): Signal[] {
  const now = Date.now();
  const out: Signal[] = [];
  const w1 = between(logs, now - 7 * DAY, now + DAY, "logged_at");
  const w0 = between(logs, now - 14 * DAY, now - 7 * DAY, "logged_at");
  const enough = w0.length >= 3 && w1.length >= 3;
  if (w0.length >= 3 && w1.length >= w0.length * 1.3) {
    out.push({ lvl: 2, t: `Fréquence en hausse : ${w1.length} envies ces 7 derniers jours contre ${w0.length} la semaine d'avant.` });
  }
  const i1 = avg(w1.map((l) => l.intensite));
  const i0 = avg(w0.map((l) => l.intensite));
  if (enough && i1 != null && i0 != null && i1 - i0 >= 1) {
    out.push({ lvl: 1, t: `Intensité moyenne en hausse : ${fmt1(i1)} contre ${fmt1(i0)}.` });
  }
  const r1 = rate(w1);
  const r0 = rate(w0);
  if (enough && r0 != null && r1 != null && r0 - r1 >= 0.15) {
    out.push({ lvl: 2, t: `Tu résistes moins : ${pct(r1)} contre ${pct(r0)} la semaine d'avant.` });
  }
  const f1 = firstHourAvg(w1);
  const f0 = firstHourAvg(w0);
  if (enough && f0 != null && f1 != null && f0 - f1 >= 1) {
    out.push({ lvl: 1, t: `La première envie arrive plus tôt : vers ${hh(f1)} contre ${hh(f0)}.` });
  }
  const M = between(logs, now - 30 * DAY, now + DAY, "logged_at");
  const R = M.filter((l) => l.ressenti_apres);
  if (R.length >= 5) {
    const neg = R.filter((l) => ["vide", "regret"].includes(l.ressenti_apres ?? "")).length / R.length;
    if (neg >= 0.4) out.push({ lvl: 2, t: `${pct(neg)} des fois, tu te sens vide ou en regret après.` });
  }
  const E = M.filter((l) => l.emotion);
  if (E.length >= 5) {
    const c = E.filter((l) => COMPENSATOIRES.includes(l.emotion ?? "")).length / E.length;
    if (c >= 0.5) out.push({ lvl: 1, t: `${pct(c)} des envies suivent une émotion difficile (stress, ennui, solitude…). Elles servent peut-être à la gérer.` });
  }
  const js = journalStats(M, journal);
  if (js && js.low >= 1 && js.low >= js.high * 1.5) {
    out.push({ lvl: 1, t: `Les jours d'humeur basse, tu as ${fmt1(js.low)} envies en moyenne contre ${fmt1(js.high)} les autres jours.` });
  }
  return out;
}

export interface HeatmapPeak {
  c: number;
  i: number;
  j: number;
}

export interface HeatmapData {
  grid: number[][];
  max: number;
  peak: HeatmapPeak | null;
}

export function heatmapData(logs: SanemiPatternLog[]): HeatmapData {
  const g: number[][] = Array.from({ length: 7 }, () => Array(8).fill(0));
  logs.forEach((l) => {
    const d = new Date(l.logged_at);
    g[(d.getDay() + 6) % 7][Math.floor(d.getHours() / 3)]++;
  });
  const mx = Math.max(1, ...g.flat());
  let peak: HeatmapPeak | null = null;
  for (let i = 0; i < g.length; i++) {
    for (let j = 0; j < g[i].length; j++) {
      const c = g[i][j];
      if (c && (!peak || c > peak.c)) peak = { c, i, j };
    }
  }
  return { grid: g, max: mx, peak };
}

export interface WeeklyPoint {
  n: number;
  r: number | null;
  label: string;
}

export function weeklyData(logs: SanemiPatternLog[]): WeeklyPoint[] {
  const now = Date.now();
  const w: WeeklyPoint[] = [];
  for (let i = 7; i >= 0; i--) {
    const B = between(logs, now - (i + 1) * 7 * DAY, now - i * 7 * DAY + (i === 0 ? DAY : 0), "logged_at");
    w.push({ n: B.length, r: rate(B), label: i === 0 ? "actuelle" : `S-${i}` });
  }
  return w;
}

export function altStatsData(logs: SanemiPatternLog[], alternatives: { id: string; label: string }[]): BarRow[] {
  const A = logs.filter((l) => l.alternative_id && l.intensite_apres);
  if (!A.length) return [];
  const g: Record<string, SanemiPatternLog[]> = {};
  A.forEach((l) => (g[l.alternative_id as string] ??= []).push(l));
  return Object.entries(g)
    .map(([id, ls]) => {
      const alt = alternatives.find((a) => a.id === id);
      const drop = avg(ls.map((l) => l.intensite - (l.intensite_apres ?? l.intensite))) ?? 0;
      return {
        label: alt?.label ?? "alternative supprimée",
        v: Math.max(0, drop),
        display: (drop >= 0 ? "−" : "+") + Math.abs(drop).toFixed(1),
        note: `${ls.length} fois, résistance ${pct(rate(ls) ?? 0)}`,
      };
    })
    .sort((a, b) => b.v - a.v);
}

export function planEffect(strategy: SanemiStrategy, logs: SanemiPatternLog[]): string {
  const m = logs.filter((l) => l.emotion === strategy.declencheur || l.activite === strategy.declencheur);
  const t = ts(strategy.created_at);
  const before = m.filter((l) => ts(l.logged_at) < t);
  const after = m.filter((l) => ts(l.logged_at) >= t);
  if (after.length < 3) return `Efficacité mesurable après 3 envies avec ce déclencheur (${after.length} pour l'instant).`;
  const rb = rate(before);
  const ra = rate(after);
  return `Résistance face à ce déclencheur : ${rb == null ? "pas de mesure avant le plan" : `${pct(rb)} avant`}, ${pct(ra ?? 0)} depuis (${after.length} envies).`;
}
