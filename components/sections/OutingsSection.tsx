"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { BUDGETS, MOODS, OUTINGS_DB, type Mood, type Outing } from "@/lib/constants";
import type { SanemiSortiePref } from "@/lib/types";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";

export function OutingsSection({ userId }: { userId: string }) {
  const [mood, setMood] = useState<Mood | null>(null);
  const [budget, setBudget] = useState(0);
  const [results, setResults] = useState<Outing[] | null>(null);
  const [liked, setLiked] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [aiPowered, setAiPowered] = useState(false);

  useEffect(() => {
    supabase
      .from("sanemi_sortie_prefs")
      .select("*")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle()
      .then(({ data }: { data: SanemiSortiePref | null }) => setLiked(data?.liked_places ?? []));
  }, [userId]);

  function fallbackResults(): Outing[] {
    const pool = OUTINGS_DB[mood!] ?? {};
    let res: Outing[] = [];
    for (let b = 0; b <= budget; b++) {
      if (pool[b]) res = res.concat(pool[b]);
    }
    return res;
  }

  async function generate() {
    if (!mood) return;
    setSearching(true);
    setResults(null);
    const moodLabel = MOODS.find((m) => m.key === mood)?.label ?? mood;
    try {
      const res = await fetch("/api/outings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mood: moodLabel, budgetLabel: BUDGETS[budget] }),
      });
      const data = await res.json();
      if (data.results) {
        setResults(data.results);
        setAiPowered(true);
      } else {
        setResults(fallbackResults());
        setAiPowered(false);
      }
    } catch {
      setResults(fallbackResults());
      setAiPowered(false);
    } finally {
      setSearching(false);
    }
  }

  async function likeOuting(name: string) {
    if (liked.includes(name)) return;
    const nextLiked = [...liked, name];
    setLiked(nextLiked);
    const { data: existing } = await supabase
      .from("sanemi_sortie_prefs")
      .select("*")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    if (existing) {
      await supabase
        .from("sanemi_sortie_prefs")
        .update({ liked_places: nextLiked, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
    } else {
      await supabase.from("sanemi_sortie_prefs").insert({ user_id: userId, liked_places: nextLiked });
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-5">
        <div className="font-display text-xl font-extrabold">Agent Sorties</div>
        <div className="text-xs text-ink-muted">Casablanca · humeur & budget</div>
      </div>

      <Card className="mb-4">
        <CardTitle>Comment tu te sens ?</CardTitle>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {MOODS.map((m) => (
            <Chip key={m.key} active={mood === m.key} onClick={() => setMood(m.key)}>
              {m.label}
            </Chip>
          ))}
        </div>
        <CardTitle>Budget disponible</CardTitle>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {BUDGETS.map((b, i) => (
            <Chip key={b} active={budget === i} onClick={() => setBudget(i)}>
              {b}
            </Chip>
          ))}
        </div>
        <Button variant="primary" className="w-full" onClick={generate} disabled={searching}>
          {searching ? "Recherche en cours..." : "Trouver des sorties ✦"}
        </Button>
      </Card>

      {searching && (
        <div className="mb-4 flex items-center justify-center gap-2 py-8 font-mono text-xs text-ink-muted">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-surface-3 border-t-orange" />
          L&apos;agent cherche de vrais lieux à Casablanca...
        </div>
      )}

      {results && !searching && (
        <div className="mb-4">
          {aiPowered && (
            <div className="mb-2.5">
              <Badge tone="purple">✦ Recherche IA en direct</Badge>
            </div>
          )}
          <div className="grid gap-3.5 sm:grid-cols-2">
            {results.length === 0 ? (
              <div className="col-span-full py-7 text-center text-sm text-ink-dim">Essaie un autre filtre</div>
            ) : (
              results.map((o) => (
                <div key={o.name} className="overflow-hidden rounded-2xl border border-border bg-surface-2 transition-colors hover:border-border-strong">
                  {o.image && <OutingImage src={o.image} alt={o.name} />}
                  <div className="p-4">
                    <div className="mb-1 font-mono text-[10px] uppercase tracking-wide text-ink-muted">{o.area}</div>
                    <div className="mb-1 font-display text-sm font-bold">{o.name}</div>
                    <div className="mb-2.5 text-xs leading-relaxed text-ink-muted">{o.description}</div>
                    <div className="flex items-center justify-between">
                      <Badge tone="green">{budget === 0 ? "Gratuit" : "Budget OK"}</Badge>
                      <button
                        onClick={() => likeOuting(o.name)}
                        className="cursor-pointer px-1 text-ink-muted hover:text-red"
                      >
                        {liked.includes(o.name) ? "♥" : "♡"}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <Card>
        <CardTitle>Ton profil découvert</CardTitle>
        {liked.length ? (
          <div className="flex flex-wrap gap-1.5">
            {liked.map((l) => (
              <Badge key={l} tone="teal">
                {l}
              </Badge>
            ))}
          </div>
        ) : (
          <div className="text-xs text-ink-muted">Marque des lieux ♡ pour construire ton profil</div>
        )}
      </Card>
    </div>
  );
}

function OutingImage({ src, alt }: { src: string; alt: string }) {
  const [broken, setBroken] = useState(false);
  if (broken) return null;
  return (
    <div className="relative h-32 w-full bg-surface-3">
      <Image
        src={src}
        alt={alt}
        fill
        className="object-cover"
        unoptimized
        onError={() => setBroken(true)}
      />
    </div>
  );
}
