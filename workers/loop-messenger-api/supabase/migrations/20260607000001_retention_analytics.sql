-- ============================================================
-- Loop Community Validation Sprint — Retention Analytics Schema
-- Migration: 20260607000001_retention_analytics.sql
-- CTO Office — LILCKY STUDIO LIMITED — 2026-06-07
-- ============================================================

-- ── 1. Geography reference (Nigeria LCDA/LGA/State lookup) ──
CREATE TABLE IF NOT EXISTS geography_reference (
  lcda_id     text PRIMARY KEY,
  lcda_name   text NOT NULL,
  lga_id      text NOT NULL,
  lga_name    text NOT NULL,
  state_id    text NOT NULL,
  state_name  text NOT NULL,
  area_km2    numeric,
  lat_center  numeric,
  lng_center  numeric,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_geography_lga   ON geography_reference (lga_id);
CREATE INDEX IF NOT EXISTS idx_geography_state ON geography_reference (state_id);

-- ── 2. User events (qualifying retention actions) ────────────
CREATE TABLE IF NOT EXISTS user_events (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type    text        NOT NULL CHECK (event_type IN (
                              'post','react','comment','join','view',
                              'message','story_view','profile_view'
                            )),
  community_id  uuid,
  creator_id    uuid,
  session_id    text,
  lcda          text,
  lga           text,
  state         text,
  metadata      jsonb       NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_events_user_created   ON user_events (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_user_events_community      ON user_events (community_id, created_at);
CREATE INDEX IF NOT EXISTS idx_user_events_creator        ON user_events (creator_id, created_at);
CREATE INDEX IF NOT EXISTS idx_user_events_created_at     ON user_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_events_geography      ON user_events (state, lga, lcda, created_at);

ALTER TABLE user_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "service_role_full_access_user_events"
  ON user_events USING (auth.role() = 'service_role');

CREATE POLICY IF NOT EXISTS "user_own_events_select"
  ON user_events FOR SELECT USING (auth.uid() = user_id);

-- ── 3. Retention cohorts (computed daily) ───────────────────
CREATE TABLE IF NOT EXISTS retention_cohorts (
  cohort_week           date        NOT NULL,
  user_id               uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_event_at        timestamptz NOT NULL,
  lcda                  text,
  lga                   text,
  state                 text,
  first_community_id    uuid,
  first_creator_id      uuid,
  community_attributed  boolean     NOT NULL DEFAULT false,
  creator_attributed    boolean     NOT NULL DEFAULT false,
  d1_retained           boolean     NOT NULL DEFAULT false,
  d7_retained           boolean     NOT NULL DEFAULT false,
  d30_retained          boolean     NOT NULL DEFAULT false,
  computed_at           timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (cohort_week, user_id)
);

CREATE INDEX IF NOT EXISTS idx_retention_cohorts_week    ON retention_cohorts (cohort_week);
CREATE INDEX IF NOT EXISTS idx_retention_cohorts_lcda    ON retention_cohorts (lcda, cohort_week);
CREATE INDEX IF NOT EXISTS idx_retention_cohorts_lga     ON retention_cohorts (lga, cohort_week);
CREATE INDEX IF NOT EXISTS idx_retention_cohorts_state   ON retention_cohorts (state, cohort_week);
CREATE INDEX IF NOT EXISTS idx_retention_cohorts_comm    ON retention_cohorts (first_community_id, cohort_week);
CREATE INDEX IF NOT EXISTS idx_retention_cohorts_creator ON retention_cohorts (first_creator_id, cohort_week);

ALTER TABLE retention_cohorts ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "service_role_full_access_cohorts"
  ON retention_cohorts USING (auth.role() = 'service_role');

-- ── 4. Community health scores (computed weekly) ────────────
CREATE TABLE IF NOT EXISTS community_health_scores (
  community_id          uuid        NOT NULL,
  score_week            date        NOT NULL,
  score_version         text        NOT NULL DEFAULT 'v1',
  chs                   numeric(5,2),
  tier                  text        CHECK (tier IN (
                          'Thriving','Growing','Stabilising','At risk','Dormant','Unscored'
                        )),
  d7_retention          numeric(5,4),
  d30_retention         numeric(5,4),
  member_count          integer     NOT NULL DEFAULT 0,
  posts_per_member      numeric(6,3),
  comment_post_ratio    numeric(6,3),
  growth_rate_7d        numeric(6,4),
  avg_trust_score       numeric(5,2),
  computed_at           timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (community_id, score_week)
);

CREATE INDEX IF NOT EXISTS idx_chs_week ON community_health_scores (score_week, chs DESC NULLS LAST);

ALTER TABLE community_health_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "service_role_full_access_chs"
  ON community_health_scores USING (auth.role() = 'service_role');

-- ── 5. Creator health scores (computed weekly) ──────────────
CREATE TABLE IF NOT EXISTS creator_health_scores (
  creator_id            uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score_week            date        NOT NULL,
  score_version         text        NOT NULL DEFAULT 'v1',
  creator_hs            numeric(5,2),
  tier                  text        CHECK (tier IN (
                          'Elite','Rising','Building','Early','Inactive','Unscored'
                        )),
  d7_retention          numeric(5,4),
  d30_retention         numeric(5,4),
  audience_size         integer     NOT NULL DEFAULT 0,
  posts_per_week        numeric(5,2),
  avg_reactions         numeric(6,2),
  avg_comments          numeric(6,2),
  audience_trust_score  numeric(5,2),
  computed_at           timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (creator_id, score_week)
);

CREATE INDEX IF NOT EXISTS idx_creator_hs_week ON creator_health_scores (score_week, creator_hs DESC NULLS LAST);

ALTER TABLE creator_health_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "service_role_full_access_creator_hs"
  ON creator_health_scores USING (auth.role() = 'service_role');

-- ── 6. Regional density scores (computed weekly) ────────────
CREATE TABLE IF NOT EXISTS regional_density_scores (
  geography_type          text        NOT NULL CHECK (geography_type IN ('lcda','lga','state')),
  geography_id            text        NOT NULL,
  geography_name          text        NOT NULL,
  score_week              date        NOT NULL,
  score_version           text        NOT NULL DEFAULT 'v1',
  rds                     numeric(5,2),
  tier                    text        CHECK (tier IN ('Dense','Emerging','Seeding','Sparse')),
  active_users_30d        integer     NOT NULL DEFAULT 0,
  area_km2                numeric,
  density_per_km2         numeric(10,4),
  d30_retention           numeric(5,4),
  active_community_count  integer              DEFAULT 0,
  creator_count           integer              DEFAULT 0,
  civic_ratio             numeric(5,4),
  computed_at             timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (geography_type, geography_id, score_week)
);

CREATE INDEX IF NOT EXISTS idx_rds_week      ON regional_density_scores (score_week, rds DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_rds_type_week ON regional_density_scores (geography_type, score_week, rds DESC NULLS LAST);

ALTER TABLE regional_density_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "service_role_full_access_rds"
  ON regional_density_scores USING (auth.role() = 'service_role');

-- ── 7. Helper function: ISO week Monday ──────────────────────
CREATE OR REPLACE FUNCTION iso_week_start(ts timestamptz)
RETURNS date
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (date_trunc('week', ts AT TIME ZONE 'Africa/Lagos'))::date;
$$;

-- ── 8. Helper function: cohort users for a given week ────────
CREATE OR REPLACE FUNCTION get_cohort_users(
  p_week_start date,
  p_week_end   date
)
RETURNS TABLE (
  user_id              uuid,
  first_event_at       timestamptz,
  lcda                 text,
  lga                  text,
  state                text,
  first_community_id   uuid,
  first_creator_id     uuid,
  community_attributed boolean,
  creator_attributed   boolean
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH first_events AS (
    SELECT DISTINCT ON (e.user_id)
      e.user_id,
      e.created_at                    AS first_event_at,
      e.lcda,
      e.lga,
      e.state,
      e.community_id                  AS first_community_id,
      e.creator_id                    AS first_creator_id,
      (e.community_id IS NOT NULL
       AND e.event_type IN ('join','post','react','comment'))
                                      AS community_attributed,
      (e.creator_id IS NOT NULL
       AND e.event_type IN ('view','react','comment'))
                                      AS creator_attributed
    FROM user_events e
    WHERE e.created_at >= p_week_start::timestamptz
      AND e.created_at <  (p_week_end + interval '1 day')::timestamptz
    ORDER BY e.user_id, e.created_at ASC
  )
  SELECT *
  FROM first_events
  -- Only users whose FIRST EVER event falls in this week
  WHERE NOT EXISTS (
    SELECT 1 FROM user_events older
    WHERE older.user_id = first_events.user_id
      AND older.created_at < p_week_start::timestamptz
  );
$$;

-- ── 9. Backfill user_events from existing tables ─────────────
-- Run once to seed historical data. Safe to re-run (ON CONFLICT DO NOTHING).
-- Uncomment and run manually after deployment.

-- INSERT INTO user_events (user_id, event_type, community_id, created_at)
-- SELECT author_id, 'post', community_id, created_at
-- FROM posts
-- ON CONFLICT DO NOTHING;

-- INSERT INTO user_events (user_id, event_type, community_id, created_at)
-- SELECT user_id, 'join', community_id, joined_at
-- FROM community_members
-- ON CONFLICT DO NOTHING;

-- INSERT INTO user_events (user_id, event_type, created_at)
-- SELECT user_id, 'react', created_at
-- FROM reactions
-- ON CONFLICT DO NOTHING;

COMMENT ON TABLE user_events IS 'Qualifying user actions for retention analytics. Written by the Loop API on every user interaction. Source of truth for all cohort computation.';
COMMENT ON TABLE retention_cohorts IS 'D1/D7/D30 retention flags per user per cohort week. Computed daily by the compute-retention-cohorts Edge Function.';
COMMENT ON TABLE community_health_scores IS 'Weekly CHS composite scores per community. Computed by the compute-scores Edge Function every Monday at 03:00 WAT.';
COMMENT ON TABLE creator_health_scores IS 'Weekly CreatorHS composite scores per creator. Computed by compute-scores.';
COMMENT ON TABLE regional_density_scores IS 'Weekly RDS composite scores per geography (LCDA/LGA/State). Computed by compute-scores.';
