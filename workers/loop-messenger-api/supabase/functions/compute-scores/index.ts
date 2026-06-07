// supabase/functions/compute-scores/index.ts
// Weekly Edge Function — runs every Monday at 03:00 WAT (02:00 UTC)
// Computes Community Health Score (CHS), Creator Health Score (CreatorHS),
// and Regional Density Score (RDS) for the completed week.
// CTO Office — LILCKY STUDIO LIMITED — 2026-06-07

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import {
  getServiceClient,
  isoWeekStart,
  addDays,
  toISO,
  normalise,
  computePercentiles,
  chsTier,
  creatorTier,
  rdsTier,
  log,
} from "../_shared/retention.ts";

// ── Types ──────────────────────────────────────────────────────
interface CommunitySignals {
  community_id:      string;
  member_count:      number;
  d7_retention:      number;
  d30_retention:     number;
  posts_per_member:  number;
  comment_ratio:     number;
  growth_rate_7d:    number;
  avg_trust_score:   number;
}

interface CreatorSignals {
  creator_id:           string;
  audience_size:        number;
  d7_retention:         number;
  d30_retention:        number;
  posts_per_week:       number;
  avg_reactions:        number;
  avg_comments:         number;
  audience_trust_score: number;
}

interface RegionSignals {
  geography_type:         string;
  geography_id:           string;
  geography_name:         string;
  active_users_30d:       number;
  area_km2:               number | null;
  density_per_km2:        number;
  d30_retention:          number;
  active_community_count: number;
  creator_count:          number;
  civic_ratio:            number;
}

// ── CHS weights (v1) ──────────────────────────────────────────
const CHS_WEIGHTS = {
  d7_retention:     0.30,
  d30_retention:    0.25,
  posts_per_member: 0.15,
  comment_ratio:    0.10,
  growth_rate_7d:   0.10,
  avg_trust_score:  0.10,
};

// ── CreatorHS weights (v1) ────────────────────────────────────
const CREATOR_WEIGHTS = {
  d7_retention:         0.35,
  d30_retention:        0.25,
  posts_per_week:       0.15,
  avg_reactions:        0.10,
  avg_comments:         0.10,
  audience_trust_score: 0.05,
};

// ── RDS weights (v1) ──────────────────────────────────────────
const RDS_WEIGHTS = {
  density_per_km2:        0.30,
  d30_retention:          0.25,
  active_community_count: 0.15,
  creator_count:          0.15,
  civic_ratio:            0.15,
};

// ── Main handler ───────────────────────────────────────────────
serve(async (req: Request) => {
  const isScheduled = req.headers.get("x-scheduled") === "true";
  const isManual    = req.method === "POST";
  if (!isScheduled && !isManual) {
    return new Response("Method not allowed — POST or scheduled only", { status: 405 });
  }

  const startedAt = Date.now();
  log("INFO", "compute-scores: starting");

  // Score week = the ISO week that just completed (last Monday)
  const scoreWeek = toISO(isoWeekStart(addDays(new Date(), -7)));
  log("INFO", `Score week: ${scoreWeek}`);

  const db    = getServiceClient();
  const stats = { communities: 0, creators: 0, regions: 0, errors: 0 };

  try {
    // ── 1. Community Health Scores ──────────────────────────
    log("INFO", "Computing CHS...");
    const commSignals = await getCommunitySignals(db, scoreWeek);
    if (commSignals.length > 0) {
      const percs = buildCommunityPercentiles(commSignals);
      const chsRecords = commSignals.map(s => {
        const score = computeCHS(s, percs);
        return {
          community_id:       s.community_id,
          score_week:         scoreWeek,
          score_version:      "v1",
          chs:                score,
          tier:               chsTier(score),
          d7_retention:       s.d7_retention,
          d30_retention:      s.d30_retention,
          member_count:       s.member_count,
          posts_per_member:   s.posts_per_member,
          comment_post_ratio: s.comment_ratio,
          growth_rate_7d:     s.growth_rate_7d,
          avg_trust_score:    s.avg_trust_score,
          computed_at:        new Date().toISOString(),
        };
      });
      const { error } = await db
        .from("community_health_scores")
        .upsert(chsRecords, { onConflict: "community_id,score_week" });
      if (error) { log("ERROR", "CHS upsert failed", error); stats.errors++; }
      else stats.communities = chsRecords.length;
    }

    // ── 2. Creator Health Scores ────────────────────────────
    log("INFO", "Computing CreatorHS...");
    const creatorSignals = await getCreatorSignals(db, scoreWeek);
    if (creatorSignals.length > 0) {
      const percs = buildCreatorPercentiles(creatorSignals);
      const creatorRecords = creatorSignals.map(s => {
        const score = computeCreatorHS(s, percs);
        return {
          creator_id:           s.creator_id,
          score_week:           scoreWeek,
          score_version:        "v1",
          creator_hs:           score,
          tier:                 creatorTier(score),
          d7_retention:         s.d7_retention,
          d30_retention:        s.d30_retention,
          audience_size:        s.audience_size,
          posts_per_week:       s.posts_per_week,
          avg_reactions:        s.avg_reactions,
          avg_comments:         s.avg_comments,
          audience_trust_score: s.audience_trust_score,
          computed_at:          new Date().toISOString(),
        };
      });
      const { error } = await db
        .from("creator_health_scores")
        .upsert(creatorRecords, { onConflict: "creator_id,score_week" });
      if (error) { log("ERROR", "CreatorHS upsert failed", error); stats.errors++; }
      else stats.creators = creatorRecords.length;
    }

    // ── 3. Regional Density Scores ──────────────────────────
    log("INFO", "Computing RDS...");
    for (const geoType of ["lcda", "lga", "state"] as const) {
      const regionSignals = await getRegionSignals(db, geoType, scoreWeek);
      if (regionSignals.length === 0) continue;
      const percs = buildRegionPercentiles(regionSignals);
      const rdsRecords = regionSignals.map(s => {
        const score = computeRDS(s, percs);
        return {
          geography_type:          geoType,
          geography_id:            s.geography_id,
          geography_name:          s.geography_name,
          score_week:              scoreWeek,
          score_version:           "v1",
          rds:                     score,
          tier:                    rdsTier(score),
          active_users_30d:        s.active_users_30d,
          area_km2:                s.area_km2,
          density_per_km2:         s.density_per_km2,
          d30_retention:           s.d30_retention,
          active_community_count:  s.active_community_count,
          creator_count:           s.creator_count,
          civic_ratio:             s.civic_ratio,
          computed_at:             new Date().toISOString(),
        };
      });
      const { error } = await db
        .from("regional_density_scores")
        .upsert(rdsRecords, { onConflict: "geography_type,geography_id,score_week" });
      if (error) { log("ERROR", `RDS upsert failed (${geoType})`, error); stats.errors++; }
      else stats.regions += rdsRecords.length;
    }

    const elapsed = Date.now() - startedAt;
    log("INFO", "compute-scores: complete", { ...stats, elapsed_ms: elapsed });
    return Response.json({ ok: true, score_week: scoreWeek, stats, elapsed_ms: elapsed });

  } catch (err) {
    log("ERROR", "compute-scores: unhandled error", err);
    return Response.json({ ok: false, error: String(err) }, { status: 500 });
  }
});

// ── Signal fetchers ────────────────────────────────────────────

async function getCommunitySignals(
  db: ReturnType<typeof getServiceClient>,
  scoreWeek: string,
): Promise<CommunitySignals[]> {
  // Fetch via DB RPC for performance — joins user_events + retention_cohorts
  const { data, error } = await db.rpc("get_community_signals_for_week", {
    p_score_week: scoreWeek,
  });
  if (error) { log("ERROR", "get_community_signals_for_week failed", error); return []; }
  return (data ?? []) as CommunitySignals[];
}

async function getCreatorSignals(
  db: ReturnType<typeof getServiceClient>,
  scoreWeek: string,
): Promise<CreatorSignals[]> {
  const { data, error } = await db.rpc("get_creator_signals_for_week", {
    p_score_week: scoreWeek,
  });
  if (error) { log("ERROR", "get_creator_signals_for_week failed", error); return []; }
  return (data ?? []) as CreatorSignals[];
}

async function getRegionSignals(
  db: ReturnType<typeof getServiceClient>,
  geoType: string,
  scoreWeek: string,
): Promise<RegionSignals[]> {
  const { data, error } = await db.rpc("get_region_signals_for_week", {
    p_geography_type: geoType,
    p_score_week:     scoreWeek,
  });
  if (error) { log("ERROR", `get_region_signals_for_week(${geoType}) failed`, error); return []; }
  return (data ?? []) as RegionSignals[];
}

// ── Score algorithms ───────────────────────────────────────────

type CommunityPercs = Record<keyof typeof CHS_WEIGHTS, { p5: number; p95: number }>;
type CreatorPercs   = Record<keyof typeof CREATOR_WEIGHTS, { p5: number; p95: number }>;
type RegionPercs    = Record<keyof typeof RDS_WEIGHTS, { p5: number; p95: number }>;

function buildCommunityPercentiles(signals: CommunitySignals[]): CommunityPercs {
  return {
    d7_retention:     computePercentiles(signals.map(s => s.d7_retention)),
    d30_retention:    computePercentiles(signals.map(s => s.d30_retention)),
    posts_per_member: computePercentiles(signals.map(s => Math.min(s.posts_per_member, 10))),
    comment_ratio:    computePercentiles(signals.map(s => Math.min(s.comment_ratio, 20))),
    growth_rate_7d:   computePercentiles(signals.map(s => Math.max(0, Math.min(s.growth_rate_7d, 2.0)))),
    avg_trust_score:  computePercentiles(signals.map(s => s.avg_trust_score)),
  };
}

function computeCHS(s: CommunitySignals, p: CommunityPercs): number {
  const score =
    CHS_WEIGHTS.d7_retention     * normalise(s.d7_retention,                       p.d7_retention)     +
    CHS_WEIGHTS.d30_retention     * normalise(s.d30_retention,                      p.d30_retention)     +
    CHS_WEIGHTS.posts_per_member  * normalise(Math.min(s.posts_per_member, 10),     p.posts_per_member)  +
    CHS_WEIGHTS.comment_ratio     * normalise(Math.min(s.comment_ratio, 20),        p.comment_ratio)     +
    CHS_WEIGHTS.growth_rate_7d    * normalise(Math.max(0, Math.min(s.growth_rate_7d, 2.0)), p.growth_rate_7d) +
    CHS_WEIGHTS.avg_trust_score   * normalise(s.avg_trust_score,                    p.avg_trust_score);
  return Math.round(score * 1000) / 10; // round to 1 decimal place
}

function buildCreatorPercentiles(signals: CreatorSignals[]): CreatorPercs {
  return {
    d7_retention:         computePercentiles(signals.map(s => s.d7_retention)),
    d30_retention:        computePercentiles(signals.map(s => s.d30_retention)),
    posts_per_week:       computePercentiles(signals.map(s => Math.min(s.posts_per_week, 21))),
    avg_reactions:        computePercentiles(signals.map(s => s.avg_reactions)),
    avg_comments:         computePercentiles(signals.map(s => s.avg_comments)),
    audience_trust_score: computePercentiles(signals.map(s => s.audience_trust_score)),
  };
}

function computeCreatorHS(s: CreatorSignals, p: CreatorPercs): number {
  const score =
    CREATOR_WEIGHTS.d7_retention         * normalise(s.d7_retention,                        p.d7_retention)         +
    CREATOR_WEIGHTS.d30_retention         * normalise(s.d30_retention,                       p.d30_retention)         +
    CREATOR_WEIGHTS.posts_per_week        * normalise(Math.min(s.posts_per_week, 21),         p.posts_per_week)        +
    CREATOR_WEIGHTS.avg_reactions         * normalise(s.avg_reactions,                        p.avg_reactions)         +
    CREATOR_WEIGHTS.avg_comments          * normalise(s.avg_comments,                         p.avg_comments)          +
    CREATOR_WEIGHTS.audience_trust_score  * normalise(s.audience_trust_score,                 p.audience_trust_score);
  return Math.round(score * 1000) / 10;
}

function buildRegionPercentiles(signals: RegionSignals[]): RegionPercs {
  return {
    density_per_km2:        computePercentiles(signals.map(s => s.density_per_km2)),
    d30_retention:          computePercentiles(signals.map(s => s.d30_retention)),
    active_community_count: computePercentiles(signals.map(s => s.active_community_count)),
    creator_count:          computePercentiles(signals.map(s => s.creator_count)),
    civic_ratio:            computePercentiles(signals.map(s => s.civic_ratio)),
  };
}

function computeRDS(s: RegionSignals, p: RegionPercs): number {
  const score =
    RDS_WEIGHTS.density_per_km2         * normalise(s.density_per_km2,         p.density_per_km2)         +
    RDS_WEIGHTS.d30_retention           * normalise(s.d30_retention,            p.d30_retention)            +
    RDS_WEIGHTS.active_community_count  * normalise(s.active_community_count,   p.active_community_count)   +
    RDS_WEIGHTS.creator_count           * normalise(s.creator_count,            p.creator_count)            +
    RDS_WEIGHTS.civic_ratio             * normalise(s.civic_ratio,              p.civic_ratio);
  return Math.round(score * 1000) / 10;
}
