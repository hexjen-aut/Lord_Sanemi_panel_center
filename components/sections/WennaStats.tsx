"use client";

import { useEffect, useState } from "react";
import { wennaSupabase } from "@/lib/wennaSupabase";

interface Stats {
  vendeurs: number;
  produits: number;
}

export function WennaStats() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (!wennaSupabase) return;
    Promise.all([
      wennaSupabase.from("shops").select("*", { count: "exact", head: true }).in("status", ["active", "pending"]),
      wennaSupabase.from("products").select("*", { count: "exact", head: true }).eq("status", "active"),
    ]).then(([shops, products]) => {
      setStats({ vendeurs: shops.count ?? 0, produits: products.count ?? 0 });
    });
  }, []);

  if (!wennaSupabase || !stats) return null;

  return (
    <div className="mb-2.5 flex gap-3 text-[11px] text-ink-muted">
      <span>
        <strong className="text-ink">{stats.vendeurs}</strong> vendeurs actifs
      </span>
      <span>
        <strong className="text-ink">{stats.produits}</strong> produits en ligne
      </span>
    </div>
  );
}
