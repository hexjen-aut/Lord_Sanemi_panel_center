"use client";

import { useSession } from "@/hooks/useSession";
import { SignIn } from "@/components/auth/SignIn";
import { DashboardApp } from "@/components/layout/DashboardApp";

export default function Home() {
  const { user, loading } = useSession();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center font-mono text-sm text-ink-muted">
        Chargement...
      </div>
    );
  }

  if (!user) return <SignIn />;

  return <DashboardApp userId={user.id} />;
}
