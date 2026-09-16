import { createClient } from "@supabase/supabase-js";

// Server-only: uses the service role key, bypasses RLS. Never import from a "use client" file.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseAdmin = url && serviceRoleKey ? createClient(url, serviceRoleKey) : null;
