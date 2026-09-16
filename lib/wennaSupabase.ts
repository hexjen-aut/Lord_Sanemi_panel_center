import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_WENNA_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_WENNA_SUPABASE_ANON_KEY;

export const wennaSupabase = url && anonKey ? createClient(url, anonKey) : null;
