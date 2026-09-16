"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    supabase
      .from("sanemi_sortie_prefs")
      .select("*")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle()
      .then(({ data }: { data: SanemiSortiePref | null }) => setLiked(data?.liked_places ?? []));
  }, [userId]);

  function generate() {
    if (!mood) return;
    const pool = OUTINGS_DB[mood] ?? {};
    let res: Outing[] = [];
    for (let b = 0; b <= budget; b++) {
      if (pool[b]) res = res.concat(pool[b]);
    }
    setResults(res);
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
        <Button variant="primary" className="w-full" onClick={generate}>
          Trouver des sorties ✦
        </Button>
      </Card>

      {results && (
        <div className="mb-4 grid gap-3.5 sm:grid-cols-2">
          {results.length === 0 ? (
            <div className="col-span-full py-7 text-center text-sm text-ink-dim">Essaie un autre filtre</div>
          ) : (
            results.map((o) => (
              <div key={o.name} className="rounded-2xl border border-border bg-surface-2 p-4 transition-colors hover:border-border-strong">
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
            ))
          )}
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
