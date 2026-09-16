"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type Support = "unsupported" | NotificationPermission;

const POLL_MS = 30_000;

export function useReminderNotifications(userId: string) {
  const [permission, setPermission] = useState<Support>("unsupported");
  const shown = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPermission(Notification.permission);
    }
  }, []);

  async function requestPermission() {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
  }

  useEffect(() => {
    if (permission !== "granted") return;

    async function checkDue() {
      const { data } = await supabase
        .from("sanemi_reminders")
        .select("*")
        .eq("user_id", userId)
        .lte("remind_at", new Date().toISOString())
        .order("remind_at", { ascending: true });

      for (const reminder of data ?? []) {
        if (shown.current.has(reminder.id)) continue;
        shown.current.add(reminder.id);
        new Notification(reminder.title, { body: reminder.message || "Rappel Sanemi OS" });
      }
    }

    checkDue();
    const interval = setInterval(checkDue, POLL_MS);
    return () => clearInterval(interval);
  }, [permission, userId]);

  return { permission, requestPermission };
}
