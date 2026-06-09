-- ============================================================
-- Loop Community Validation Sprint — Signal Fetching Functions
-- Migration: 20260607000002_signal_functions.sql
-- Called by compute-scores Edge Function every Monday 03:00 WAT
-- CTO Office — LILCKY STUDIO LIMITED — 2026-06-07
-- Rev 2: Fixed schema references
--   • profiles.trust_score → 50 hardcoded (column does not exist)
--   • follows.creator_id → follows.following_id (correct FK name)
--   • posts table → user_events (posts table not in public schema)
--   • communities.state/lga/lcda → user_events geography (communities has no location cols)
--   • chs alias conflict in geo_creators resolved
-- ============================================================

-- ── Community signals for a given score week ─────────────────
CREATE OR REPLACE FUNCTION get_community_signals_for_week(p_score_week date)
RETURNS TABLE (
  community_id      uuid,
  member_count      bigint,
  d7_retention      numeric,
  d30_retention     numeric,
  posts_per_member  numeric,
  comment_ratio     numeric,
  growth_rate_7d    numeric,
  avg_trust_score   numeric
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH
  -- Active communities: members who joined at least 10 days before score_week
  eligible_members AS (
    SELECT
      cm.community_id,
      COUNT(*) AS member_count
    FROM community_members cm
    WHERE cm.joined_at <= p_score_week - 10
    GROUP BY cm.community_id
    HAVING COUNT(*) >= 10
  ),

  -- D7 retention
  d7_retained AS (
    SELECT
      rc.first_community_id AS community_id,
      COUNT(*) FILTER (WHERE rc.d7_retained) AS retained,
      COUNT(*) AS total
    FROM retention_cohorts rc
    WHERE rc.first_community_id IS NOT NULL
      AND rc.cohort_week >= p_score_week - 35
      AND rc.cohort_week <  p_score_week
    GROUP BY rc.first_community_id
  ),

  -- D30 retention
  d30_retained AS (
    SELECT
      rc.first_community_id AS community_id,
      COUNT(*) FILTER (WHERE rc.d30_retained) AS retained,
      COUNT(*) AS total
    FROM retention_cohorts rc
    WHERE rc.first_community_id IS NOT NULL
      AND rc.cohort_week >= p_score_week - 35
      AND rc.cohort_week <  p_score_week - 7
    GROUP BY rc.first_community_id
  ),

  -- Posts and comments from user_events (last 7 days)
  post_activity AS (
    SELECT
      ue.community_id,
      COUNT(*) FILTER (WHERE ue.event_type = 'post')    AS post_count,
      COUNT(*) FILTER (WHERE ue.event_type = 'comment') AS comment_count
    FROM user_events ue
    WHERE ue.community_id IS NOT NULL
      AND ue.created_at >= (p_score_week::timestamptz - INTERVAL '7 days')
      AND ue.created_at <   p_score_week::timestamptz
    GROUP BY ue.community_id
  ),

  -- Member growth rate (7d vs prior 7d)
  growth AS (
    SELECT
      community_id,
      COUNT(*) FILTER (WHERE joined_at >= p_score_week - 7)  AS new_7d,
      COUNT(*) FILTER (WHERE joined_at >= p_score_week - 14
                         AND joined_at <  p_score_week - 7)  AS prev_7d
    FROM community_members
    GROUP BY community_id
  )

  SELECT
    em.community_id,
    em.member_count,
    COALESCE(ROUND(d7.retained::numeric  / NULLIF(d7.total,  0), 4), 0)   AS d7_retention,
    COALESCE(ROUND(d30.retained::numeric / NULLIF(d30.total, 0), 4), 0)   AS d30_retention,
    COALESCE(ROUND(pa.post_count::numeric / NULLIF(em.member_count, 0), 3), 0) AS posts_per_member,
    COALESCE(ROUND(pa.comment_count::numeric / NULLIF(pa.post_count, 0), 3), 0) AS comment_ratio,
    COALESCE(ROUND(
      (g.new_7d - g.prev_7d)::numeric / NULLIF(g.prev_7d, 0), 4
    ), 0) AS growth_rate_7d,
    50::numeric AS avg_trust_score  -- profiles.trust_score column not yet present; default 50 (neutral)
  FROM eligible_members em
  LEFT JOIN d7_retained    d7  ON d7.community_id  = em.community_id
  LEFT JOIN d30_retained   d30 ON d30.community_id = em.community_id
  LEFT JOIN post_activity  pa  ON pa.community_id  = em.community_id
  LEFT JOIN growth         g   ON g.community_id   = em.community_id;
$$;

-- ── Creator signals for a given score week ───────────────────
CREATE OR REPLACE FUNCTION get_creator_signals_for_week(p_score_week date)
RETURNS TABLE (
  creator_id           uuid,
  audience_size        bigint,
  d7_retention         numeric,
  d30_retention        numeric,
  posts_per_week       numeric,
  avg_reactions        numeric,
  avg_comments         numeric,
  audience_trust_score numeric
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH
  -- Eligible creators: attributed audience >= 20 users in last 35 weeks
  attributed_audience AS (
    SELECT
      rc.first_creator_id AS creator_id,
      COUNT(*) AS audience_size
    FROM retention_cohorts rc
    WHERE rc.first_creator_id IS NOT NULL
      AND rc.creator_attributed = true
      AND rc.cohort_week >= p_score_week - 35
    GROUP BY rc.first_creator_id
    HAVING COUNT(*) >= 20
  ),

  -- Creators with >= 3 posts in last 30 days (via user_events)
  creator_posts AS (
    SELECT
      ue.creator_id,
      COUNT(*) FILTER (WHERE ue.event_type = 'post'
        AND ue.created_at >= (p_score_week::timestamptz - INTERVAL '30 days')) AS posts_30d
    FROM user_events ue
    WHERE ue.creator_id IS NOT NULL
    GROUP BY ue.creator_id
    HAVING COUNT(*) FILTER (WHERE ue.event_type = 'post'
      AND ue.created_at >= (p_score_week::timestamptz - INTERVAL '30 days')) >= 3
  ),

  -- D7 retention of attributed audience
  d7_ret AS (
    SELECT
      rc.first_creator_id AS creator_id,
      ROUND(COUNT(*) FILTER (WHERE rc.d7_retained)::numeric / NULLIF(COUNT(*), 0), 4) AS d7_retention
    FROM retention_cohorts rc
    WHERE rc.first_creator_id IS NOT NULL
      AND rc.creator_attributed = true
      AND rc.cohort_week >= p_score_week - 35
    GROUP BY rc.first_creator_id
  ),

  -- D30 retention of attributed audience
  d30_ret AS (
    SELECT
      rc.first_creator_id AS creator_id,
      ROUND(COUNT(*) FILTER (WHERE rc.d30_retained)::numeric / NULLIF(COUNT(*), 0), 4) AS d30_retention
    FROM retention_cohorts rc
    WHERE rc.first_creator_id IS NOT NULL
      AND rc.creator_attributed = true
      AND rc.cohort_week >= p_score_week - 35
      AND rc.cohort_week <  p_score_week - 7
    GROUP BY rc.first_creator_id
  ),

  -- Engagement: reactions and comments per creator post (from user_events)
  engagement AS (
    SELECT
      ue.creator_id,
      ROUND(
        COUNT(*) FILTER (WHERE ue.event_type = 'react')::numeric
          / NULLIF(COUNT(*) FILTER (WHERE ue.event_type = 'post'), 0), 2
      ) AS avg_reactions,
      ROUND(
        COUNT(*) FILTER (WHERE ue.event_type = 'comment')::numeric
          / NULLIF(COUNT(*) FILTER (WHERE ue.event_type = 'post'), 0), 2
      ) AS avg_comments
    FROM user_events ue
    WHERE ue.creator_id IS NOT NULL
      AND ue.created_at >= (p_score_week::timestamptz - INTERVAL '30 days')
      AND ue.event_type IN ('post', 'react', 'comment')
    GROUP BY ue.creator_id
  )

  SELECT
    aa.creator_id,
    aa.audience_size,
    COALESCE(d7.d7_retention,   0) AS d7_retention,
    COALESCE(d30.d30_retention, 0) AS d30_retention,
    ROUND(cp.posts_30d::numeric / 4.3, 2) AS posts_per_week,
    COALESCE(e.avg_reactions, 0)   AS avg_reactions,
    COALESCE(e.avg_comments, 0)    AS avg_comments,
    50::numeric                    AS audience_trust_score  -- profiles.trust_score not yet present
  FROM attributed_audience aa
  JOIN creator_posts   cp  ON cp.creator_id  = aa.creator_id
  LEFT JOIN d7_ret     d7  ON d7.creator_id  = aa.creator_id
  LEFT JOIN d30_ret    d30 ON d30.creator_id = aa.creator_id
  LEFT JOIN engagement e   ON e.creator_id   = aa.creator_id;
$$;

-- ── Region signals for a given score week ────────────────────
CREATE OR REPLACE FUNCTION get_region_signals_for_week(
  p_geography_type text,
  p_score_week     date
)
RETURNS TABLE (
  geography_id            text,
  geography_name          text,
  active_users_30d        bigint,
  area_km2                numeric,
  density_per_km2         numeric,
  d30_retention           numeric,
  active_community_count  bigint,
  creator_count           bigint,
  civic_ratio             numeric
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH
  -- Active users per geo, last 30d (from user_events geography fields)
  geo_users AS (
    SELECT
      CASE p_geography_type
        WHEN 'state' THEN ue.state
        WHEN 'lga'   THEN ue.lga
        ELSE              ue.lcda
      END AS geo_id,
      COUNT(DISTINCT ue.user_id) AS active_users_30d
    FROM user_events ue
    WHERE ue.created_at >= (p_score_week::timestamptz - INTERVAL '30 days')
      AND ue.created_at <   p_score_week::timestamptz
      AND CASE p_geography_type
            WHEN 'state' THEN ue.state IS NOT NULL
            WHEN 'lga'   THEN ue.lga   IS NOT NULL
            ELSE              ue.lcda  IS NOT NULL
          END
    GROUP BY 1
  ),

  -- Area + name from geography_reference table
  geo_area AS (
    SELECT
      CASE p_geography_type
        WHEN 'state' THEN state_id
        WHEN 'lga'   THEN lga_id
        ELSE              lcda_id
      END AS geo_id,
      CASE p_geography_type
        WHEN 'state' THEN MIN(state_name)
        WHEN 'lga'   THEN MIN(lga_name)
        ELSE              MIN(lcda_name)
      END AS geo_name,
      SUM(area_km2) AS area_km2
    FROM geography_reference
    GROUP BY 1
  ),

  -- D30 retention per geo
  geo_retention AS (
    SELECT
      CASE p_geography_type
        WHEN 'state' THEN rc.state
        WHEN 'lga'   THEN rc.lga
        ELSE              rc.lcda
      END AS geo_id,
      ROUND(COUNT(*) FILTER (WHERE rc.d30_retained)::numeric
              / NULLIF(COUNT(*), 0), 4) AS d30_retention
    FROM retention_cohorts rc
    WHERE rc.cohort_week >= p_score_week - 35
      AND rc.cohort_week <  p_score_week - 7
      AND CASE p_geography_type
            WHEN 'state' THEN rc.state IS NOT NULL
            WHEN 'lga'   THEN rc.lga   IS NOT NULL
            ELSE              rc.lcda  IS NOT NULL
          END
    GROUP BY 1
  ),

  -- Active communities per geo derived from user_events community activity
  -- (communities table has no location columns; we infer from user_events geo fields)
  geo_communities AS (
    SELECT
      CASE p_geography_type
        WHEN 'state' THEN ue.state
        WHEN 'lga'   THEN ue.lga
        ELSE              ue.lcda
      END AS geo_id,
      COUNT(DISTINCT ue.community_id) AS active_community_count,
      0::bigint                       AS civic_count,
      COUNT(DISTINCT ue.community_id) AS total_communities
    FROM user_events ue
    WHERE ue.community_id IS NOT NULL
      AND ue.event_type   = 'post'
      AND ue.created_at  >= (p_score_week::timestamptz - INTERVAL '7 days')
      AND ue.created_at  <   p_score_week::timestamptz
      AND CASE p_geography_type
            WHEN 'state' THEN ue.state IS NOT NULL
            WHEN 'lga'   THEN ue.lga   IS NOT NULL
            ELSE              ue.lcda  IS NOT NULL
          END
    GROUP BY 1
  ),

  -- Active creators per geo: use most recent post geography from user_events
  geo_creators AS (
    SELECT
      creator_geo.geo_id,
      COUNT(DISTINCT chs_row.creator_id) AS creator_count
    FROM creator_health_scores chs_row
    INNER JOIN (
      SELECT DISTINCT ON (ue.creator_id)
        ue.creator_id,
        CASE p_geography_type
          WHEN 'state' THEN ue.state
          WHEN 'lga'   THEN ue.lga
          ELSE              ue.lcda
        END AS geo_id
      FROM user_events ue
      WHERE ue.creator_id IS NOT NULL
        AND ue.event_type = 'post'
        AND CASE p_geography_type
              WHEN 'state' THEN ue.state IS NOT NULL
              WHEN 'lga'   THEN ue.lga   IS NOT NULL
              ELSE              ue.lcda  IS NOT NULL
            END
      ORDER BY ue.creator_id, ue.created_at DESC
    ) creator_geo ON creator_geo.creator_id = chs_row.creator_id
    WHERE chs_row.score_week = p_score_week - 7
      AND chs_row.creator_hs >= 40
    GROUP BY creator_geo.geo_id
  )

  SELECT
    gu.geo_id                                                       AS geography_id,
    COALESCE(ga.geo_name, gu.geo_id)                               AS geography_name,
    gu.active_users_30d,
    ga.area_km2,
    CASE
      WHEN ga.area_km2 > 0
      THEN ROUND(gu.active_users_30d::numeric / ga.area_km2, 4)
      ELSE 0
    END                                                             AS density_per_km2,
    COALESCE(gr.d30_retention, 0)                                  AS d30_retention,
    COALESCE(gc.active_community_count, 0)                         AS active_community_count,
    COALESCE(gcr.creator_count, 0)                                 AS creator_count,
    COALESCE(
      ROUND(gc.civic_count::numeric / NULLIF(gc.total_communities, 0), 4),
      0
    )                                                               AS civic_ratio
  FROM geo_users gu
  LEFT JOIN geo_area        ga  ON ga.geo_id  = gu.geo_id
  LEFT JOIN geo_retention   gr  ON gr.geo_id  = gu.geo_id
  LEFT JOIN geo_communities gc  ON gc.geo_id  = gu.geo_id
  LEFT JOIN geo_creators    gcr ON gcr.geo_id = gu.geo_id
  WHERE gu.active_users_30d > 0;
$$;

-- ── pg_cron scheduling ────────────────────────────────────────
-- Enable pg_cron extension via Supabase dashboard: Database → Extensions → pg_cron → Enable
-- Then uncomment the blocks below.

-- SELECT cron.schedule('compute-retention-cohorts-daily','0 1 * * *',$$
--   SELECT net.http_post(
--     url := current_setting('app.supabase_url') || '/functions/v1/compute-retention-cohorts',
--     headers := jsonb_build_object('Authorization','Bearer '||current_setting('app.service_role_key'),'x-scheduled','true'),
--     body := '{}'::jsonb
--   );$$);

-- SELECT cron.schedule('compute-scores-weekly','0 2 * * 1',$$
--   SELECT net.http_post(
--     url := current_setting('app.supabase_url') || '/functions/v1/compute-scores',
--     headers := jsonb_build_object('Authorization','Bearer '||current_setting('app.service_role_key'),'x-scheduled','true'),
--     body := '{}'::jsonb
--   );$$);
