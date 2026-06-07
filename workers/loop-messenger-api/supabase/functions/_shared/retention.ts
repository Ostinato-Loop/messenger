// supabase/functions/_shared/retention.ts
// Shared utilities for retention analytics Edge Functions
// CTO Office — LILCKY STUDIO LIMITED — 2026-06-07

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Client factory ────────────────────────────────────────────
export function getServiceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ── Date utilities ────────────────────────────────────────────

/** Returns the Monday of the ISO week containing `date` */
export function isoWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0=Sun, 1=Mon … 6=Sat
  const diff = (day === 0 ? -6 : 1 - day); // shift to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Add `n` whole days to a Date */
export function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

/** Format date as YYYY-MM-DD */
export function toISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Returns array of ISO week-start Mondays covering the last `n` weeks */
export function recentCohortWeeks(n: number): Date[] {
  const weeks: Date[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const weekStart = isoWeekStart(addDays(now, -(i * 7)));
    weeks.push(weekStart);
  }
  return weeks;
}

// ── Normalisation ─────────────────────────────────────────────

export interface Percentiles {
  p5:  number;
  p95: number;
}

/**
 * Maps a raw signal value to [0, 1] using 5th–95th percentile clamp.
 * Returns 0.5 on degenerate distribution (all values identical).
 */
export function normalise(value: number, { p5, p95 }: Percentiles): number {
  if (p95 === p5) return 0.5;
  const clamped = Math.max(p5, Math.min(p95, value));
  return (clamped - p5) / (p95 - p5);
}

/**
 * Compute p5 and p95 from an array of numbers.
 * Returns { p5: 0, p95: 0 } for empty arrays.
 */
export function computePercentiles(values: number[]): Percentiles {
  if (values.length === 0) return { p5: 0, p95: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const idx5  = Math.floor(sorted.length * 0.05);
  const idx95 = Math.min(Math.ceil(sorted.length * 0.95), sorted.length - 1);
  return { p5: sorted[idx5], p95: sorted[idx95] };
}

// ── Score tiers ───────────────────────────────────────────────

export type CHSTier = "Thriving" | "Growing" | "Stabilising" | "At risk" | "Dormant" | "Unscored";
export type CreatorTier = "Elite" | "Rising" | "Building" | "Early" | "Inactive" | "Unscored";
export type RDSTier = "Dense" | "Emerging" | "Seeding" | "Sparse";

export function chsTier(score: number | null): CHSTier {
  if (score === null) return "Unscored";
  if (score >= 80) return "Thriving";
  if (score >= 60) return "Growing";
  if (score >= 40) return "Stabilising";
  if (score >= 20) return "At risk";
  return "Dormant";
}

export function creatorTier(score: number | null): CreatorTier {
  if (score === null) return "Unscored";
  if (score >= 80) return "Elite";
  if (score >= 60) return "Rising";
  if (score >= 40) return "Building";
  if (score >= 20) return "Early";
  return "Inactive";
}

export function rdsTier(score: number | null): RDSTier {
  if (score === null || score < 0) return "Sparse";
  if (score >= 80) return "Dense";
  if (score >= 60) return "Emerging";
  if (score >= 40) return "Seeding";
  return "Sparse";
}

// ── Logging ───────────────────────────────────────────────────

export function log(level: "INFO" | "WARN" | "ERROR", msg: string, data?: unknown): void {
  const ts = new Date().toISOString();
  const line = data
    ? `[${ts}] [${level}] ${msg} ${JSON.stringify(data)}`
    : `[${ts}] [${level}] ${msg}`;
  if (level === "ERROR") console.error(line);
  else console.log(line);
}
