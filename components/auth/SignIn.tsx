"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { inputClass } from "@/components/ui/Modal";

export function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function signIn() {
    if (!email || !password) {
      setError("Remplis email et mot de passe");
      return;
    }
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError(error.message);
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-border-strong bg-surface-1 p-10 text-center">
        <div className="mx-auto mb-5 flex h-13 w-13 items-center justify-center rounded-xl bg-orange font-display text-2xl font-extrabold text-black">
          S
        </div>
        <div className="font-display text-2xl font-extrabold">Sanemi OS</div>
        <div className="mb-7 mt-1 text-sm text-ink-muted">Centre de commandement personnel</div>

        <div className="mb-3 text-left">
          <label className="mb-1 block text-xs text-ink-muted">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            placeholder="ton@email.com"
          />
        </div>
        <div className="relative mb-1 text-left">
          <label className="mb-1 block text-xs text-ink-muted">Mot de passe</label>
          <input
            type={showPwd ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && signIn()}
            className={`${inputClass} pr-11`}
            placeholder="••••••••••"
          />
          <button
            type="button"
            onClick={() => setShowPwd((v) => !v)}
            className="absolute bottom-2.5 right-3 text-ink-muted cursor-pointer"
          >
            {showPwd ? "🙈" : "👁"}
          </button>
        </div>

        <div className="min-h-5 py-2 text-left text-xs text-red">{error}</div>

        <button
          onClick={signIn}
          disabled={loading}
          className="w-full rounded-lg bg-orange py-3 font-display font-bold text-black transition-colors hover:bg-orange-dark hover:text-white disabled:opacity-60"
        >
          {loading ? "Connexion..." : "Accéder au dashboard →"}
        </button>
        <div className="mt-4 text-[11px] text-ink-dim">Accès privé · Sanemi OS v3</div>
      </div>
    </div>
  );
}
