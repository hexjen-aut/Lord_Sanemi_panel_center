import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.REMINDER_TO_EMAIL;

  if (!supabaseAdmin || !resendKey || !toEmail) {
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }

  const { data: due, error } = await supabaseAdmin
    .from("sanemi_reminders")
    .select("*")
    .eq("sent", false)
    .lte("remind_at", new Date().toISOString());

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let sent = 0;
  for (const reminder of due ?? []) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Sanemi OS <reminders@wennashop.com>",
        to: toEmail,
        subject: `Rappel — ${reminder.title}`,
        text: reminder.message || reminder.title,
      }),
    });
    if (res.ok) {
      await supabaseAdmin.from("sanemi_reminders").update({ sent: true }).eq("id", reminder.id);
      sent++;
    } else {
      console.error("Resend send failed:", reminder.id, await res.text());
    }
  }

  return NextResponse.json({ checked: due?.length ?? 0, sent });
}
