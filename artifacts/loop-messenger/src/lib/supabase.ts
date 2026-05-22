import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string) ?? "";
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ?? "";

/**
 * Supabase client for Realtime presence, typing indicators, and CDC.
 * Returns null when env vars are not configured — all hooks gracefully
 * fall back to the existing adaptive-polling strategy in that case.
 */
export const supabase: SupabaseClient | null =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        realtime: { params: { eventsPerSecond: 10 } },
      })
    : null;
