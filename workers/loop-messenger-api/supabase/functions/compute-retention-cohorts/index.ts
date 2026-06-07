// supabase/functions/compute-retention-cohorts/index.ts
// Daily Edge Function — runs at 02:00 WAT (01:00 UTC)
// Computes D1/D7/D30 retention flags for all cohort weeks within the last 35 days.
// CTO Office — LILCKY STUDIO LIMITED — 2026-06-07

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import {
  getServiceClient,
  isoWeekStart,
  addDays,
  toISO,
  recentCohortWeeks,
  log,
} from "../_shared/retention.ts";

// ── Types ──────────────────────────────────────────────────────
interface CohortUser {
  user_id:              string;
  first_event_at:       string;
  lcda:                 string | null;
  lga:                  string | null;
  state:                string | null;
  first_community_id:   string | null;
  first_creator_id:     string | null;
  community_attributed: boolean;
  creator_attributed:   boolean;
}

interface RetentionRecord {
  cohort_week:          string;
  user_id:              string;
  first_event_at:       string;
  lcda:                 string | null;
  lga:                  string | null;
  state:                string | null;
  first_community_id:   string | null;
  first_creator_id:     string | null;
  community_attributed: boolean;
  creator_attributed:   boolean;
  d1_retained:          boolean;
  d7_retained:          boolean;
  d30_retained:         boolean;
  computed_at:          string;
}

// ── Main handler ───────────────────────────────────────────────
serve(async (req: Request) => {
  // Allow manual trigger via POST or scheduled invocation
  const isScheduled = req.headers.get("x-scheduled") === "true";
  const isManual    = req.method === "POST";
  if (!isScheduled && !isManual) {
    return new Response("Method not allowed — POST or scheduled only", { status: 405 });
  }

  const startedAt = Date.now();
  log("INFO", "compute-retention-cohorts: starting");

  const db = getServiceClient();
  const stats = { weeks: 0, users: 0, upserted: 0, errors: 0 };

  try {
    // Process cohort weeks for last 5 weeks (covers D30 window = 35 days)
    // Week 0: current week (D1 may already be computable)
    // Weeks 1-4: back-fill D7 and D30 as windows close
    const cohortWeeks = recentCohortWeeks(5);

    for (const weekDate of cohortWeeks) {
      const weekStart = toISO(weekDate);
      const weekEnd   = toISO(addDays(weekDate, 6));
      log("INFO", `Processing cohort week ${weekStart} → ${weekEnd}`);

      // Fetch cohort users via the DB helper function
      const { data: cohortUsers, error: cohortErr } = await db.rpc("get_cohort_users", {
        p_week_start: weekStart,
        p_week_end:   weekEnd,
      }) as { data: CohortUser[] | null; error: unknown };

      if (cohortErr) {
        log("ERROR", `get_cohort_users failed for ${weekStart}`, cohortErr);
        stats.errors++;
        continue;
      }

      if (!cohortUsers || cohortUsers.length === 0) {
        log("INFO", `No cohort users for week ${weekStart} — skipping`);
        continue;
      }

      stats.weeks++;
      stats.users += cohortUsers.length;
      log("INFO", `Found ${cohortUsers.length} cohort users for ${weekStart}`);

      // Compute retention flags in batches of 200 (avoid overwhelming DB)
      const BATCH = 200;
      for (let i = 0; i < cohortUsers.length; i += BATCH) {
        const batch = cohortUsers.slice(i, i + BATCH);
        const records = await computeRetentionBatch(db, batch, weekStart);

        const { error: upsertErr } = await db
          .from("retention_cohorts")
          .upsert(records, { onConflict: "cohort_week,user_id" });

        if (upsertErr) {
          log("ERROR", `Upsert failed for batch i=${i}`, upsertErr);
          stats.errors++;
        } else {
          stats.upserted += records.length;
        }
      }
    }

    const elapsed = Date.now() - startedAt;
    log("INFO", "compute-retention-cohorts: complete", { ...stats, elapsed_ms: elapsed });

    return Response.json({
      ok: true,
      stats,
      elapsed_ms: elapsed,
    });

  } catch (err) {
    log("ERROR", "compute-retention-cohorts: unhandled error", err);
    return Response.json({ ok: false, error: String(err) }, { status: 500 });
  }
});

// ── Batch retention computation ────────────────────────────────
async function computeRetentionBatch(
  db: ReturnType<typeof getServiceClient>,
  users: CohortUser[],
  cohortWeek: string,
): Promise<RetentionRecord[]> {
  const now = new Date().toISOString();

  // Bulk-fetch all events for these users in the D30 window (days 1–30)
  // Single query rather than per-user queries — far more efficient
  const userIds       = users.map(u => u.user_id);
  const cohortStart   = new Date(cohortWeek);
  const windowEnd     = addDays(cohortStart, 31); // day 30 upper bound (exclusive)

  const { data: events, error: eventsErr } = await db
    .from("user_events")
    .select("user_id, created_at")
    .in("user_id", userIds)
    .gte("created_at", addDays(cohortStart, 1).toISOString()) // day 1 onwards
    .lt("created_at",  windowEnd.toISOString())
    .order("created_at", { ascending: true });

  if (eventsErr) {
    log("WARN", "Failed to fetch events for batch — defaulting to no retention", eventsErr);
    return users.map(u => buildRecord(u, cohortWeek, false, false, false, now));
  }

  // Build a per-user event map: userId → array of event timestamps
  const eventMap = new Map<string, Date[]>();
  for (const e of events ?? []) {
    const ts = new Date(e.created_at);
    if (!eventMap.has(e.user_id)) eventMap.set(e.user_id, []);
    eventMap.get(e.user_id)!.push(ts);
  }

  return users.map(user => {
    const day0      = new Date(user.first_event_at);
    const userEvents = eventMap.get(user.user_id) ?? [];

    const d1 = hasEventInWindow(userEvents, day0, 1, 1);
    const d7 = hasEventInWindow(userEvents, day0, 2, 7);
    const d30 = hasEventInWindow(userEvents, day0, 8, 30);

    return buildRecord(user, cohortWeek, d1, d7, d30, now);
  });
}

function hasEventInWindow(
  events: Date[],
  day0: Date,
  startDay: number,
  endDay: number,
): boolean {
  const windowStart = addDays(day0, startDay);
  const windowEnd   = addDays(day0, endDay + 1); // exclusive
  return events.some(e => e >= windowStart && e < windowEnd);
}

function buildRecord(
  user: CohortUser,
  cohortWeek: string,
  d1: boolean,
  d7: boolean,
  d30: boolean,
  now: string,
): RetentionRecord {
  return {
    cohort_week:          cohortWeek,
    user_id:              user.user_id,
    first_event_at:       user.first_event_at,
    lcda:                 user.lcda,
    lga:                  user.lga,
    state:                user.state,
    first_community_id:   user.first_community_id,
    first_creator_id:     user.first_creator_id,
    community_attributed: user.community_attributed,
    creator_attributed:   user.creator_attributed,
    d1_retained:          d1,
    d7_retained:          d7,
    d30_retained:         d30,
    computed_at:          now,
  };
}
