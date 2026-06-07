-- ============================================================
-- Loop Community Validation Sprint — Signal Fetching Functions
-- Migration: 20260607000002_signal_functions.sql
-- Called by compute-scores Edge Function every Monday 03:00 WAT
-- CTO Office — LILCKY STUDIO LIMITED — 2026-06-07
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
  -- Active members per community (joined at least 10 days ago)
  eligible_members AS (
    SELECT
      cm.community_id,
      COUNT(*) AS member_count
    FROM community_members cm
    WHERE cm.joined_at <= p_score_week - 10
    GROUP BY cm.community_id
    HAVING COUNT(*) >= 10
  ),

  -- D7 retention: members who returned days 2-7 after joining
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

  -- D30 retention: members who returned days 8-30 after joining
  d30_retained AS (
    SELECT
      rc.first_community_id AS community_id,
      COUNT(*) FILTER (WHERE rc.d30_retained) AS retained,
      COUNT(*) AS total
    FROM retention_cohorts rc
    WHERE rc.first_community_id IS NOT NULL
      AND rc.cohort_week >= p_score_week - 35
      AND rc.cohort_week <  p_score_week - 7  -- must be old enough for D30
    GROUP BY rc.first_community_id
  ),

  -- Posts per member (last 7 days)
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

  -- Member growth rate (7d vs 14d ago)
  growth AS (
    SELECT
      community_id,
      COUNT(*) FILTER (WHERE joined_at >= p_score_week - 7) AS new_7d,
      COUNT(*) FILTER (WHERE joined_at >= p_score_week - 14
                         AND joined_at <  p_score_week - 7) AS prev_7d
    FROM community_members
    GROUP BY community_id
  ),

  -- Average trust score of active members
  trust AS (
    SELECT
      cm.community_id,
      AVG(COALESCE(p.trust_score, 50)) AS avg_trust
    FROM community_members cm
    LEFT JOIN profiles p ON p.id = cm.user_id
    WHERE cm.joined_at <= p_score_week
    GROUP BY cm.community_id
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
    COALESCE(ROUND(t.avg_trust, 2), 50) AS avg_trust_score
  FROM eligible_members em
  LEFT JOIN d7_retained    d7 ON d7.community_id  = em.community_id
  LEFT JOIN d30_retained   d30 ON d30.community_id = em.community_id
  LEFT JOIN post_activity  pa  ON pa.community_id  = em.community_id
  LEFT JOIN growth         g   ON g.community_id   = em.community_id
  LEFT JOIN trust          t   ON t.community_id   = em.community_id;
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
  -- Eligible creators: >= 3 posts last 30d, >= 20 attributed users
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

  creator_posts AS (
    SELECT
      ue.creator_id,
      COUNT(*) FILTER (WHERE ue.event_type = 'post'
        AND ue.created_at >= (p_score_week::timestamptz - INTERVAL '30 days')) AS posts_30d
    FROM user_events ue
    WHERE ue.creator_id IS NOT NULL
      AND ue.event_type = 'post'
    GROUP BY ue.creator_id
    HAVING COUNT(*) FILTER (WHERE ue.event_type = 'post'
      AND ue.created_at >= (p_score_week::timestamptz - INTERVAL '30 days')) >= 3
  ),

  -- D7 + D30 retention of attributed audience
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

  -- Post engagement metrics (last 30 days)
  engagement AS (
    SELECT
      p.author_id AS creator_id,
      ROUND(AVG(COALESCE(p.reaction_count, 0))::numeric, 2) AS avg_reactions,
      ROUND(AVG(COALESCE(p.comment_count, 0))::numeric, 2)  AS avg_comments
    FROM posts p
    WHERE p.created_at >= (p_score_week::timestamptz - INTERVAL '30 days')
    GROUP BY p.author_id
  ),

  -- Audience trust score
  audience_trust AS (
    SELECT
      f.creator_id,
      ROUND(AVG(COALESCE(pr.trust_score, 50))::numeric, 2) AS audience_trust
    FROM follows f
    LEFT JOIN profiles pr ON pr.id = f.follower_id
    GROUP BY f.creator_id
  )

  SELECT
    aa.creator_id,
    aa.audience_size,
    COALESCE(d7.d7_retention,  0) AS d7_retention,
    COALESCE(d30.d30_retention, 0) AS d30_retention,
    ROUND(cp.posts_30d::numeric / 4.3, 2) AS posts_per_week,
    COALESCE(e.avg_reactions, 0)  AS avg_reactions,
    COALESCE(e.avg_comments, 0)   AS avg_comments,
    COALESCE(at.audience_trust, 50) AS audience_trust_score
  FROM attributed_audience aa
  JOIN creator_posts    cp  ON cp.creator_id  = aa.creator_id
  LEFT JOIN d7_ret      d7  ON d7.creator_id  = aa.creator_id
  LEFT JOIN d30_ret     d30 ON d30.creator_id = aa.creator_id
  LEFT JOIN engagement  e   ON e.creator_id   = aa.creator_id
  LEFT JOIN audience_trust at ON at.creator_id = aa.creator_id;
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
  -- Column to group by changes based on geography type
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
            WHEN 'lga'   THEN ue.lga IS NOT NULL
            ELSE              ue.lcda IS NOT NULL
          END
    GROUP BY 1
  ),

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
            WHEN 'lga'   THEN rc.lga IS NOT NULL
            ELSE              rc.lcda IS NOT NULL
          END
    GROUP BY 1
  ),

  geo_communities AS (
    SELECT
      CASE p_geography_type
        WHEN 'state' THEN c.state
        WHEN 'lga'   THEN c.lga
        ELSE              c.lcda
      END AS geo_id,
      COUNT(*) FILTER (
        WHERE EXISTS (
          SELECT 1 FROM user_events ue2
          WHERE ue2.community_id = c.id
            AND ue2.event_type = 'post'
            AND ue2.created_at >= (p_score_week::timestamptz - INTERVAL '7 days')
        )
      ) AS active_community_count,
      COUNT(*) FILTER (WHERE c.type = 'civic') AS civic_count,
      COUNT(*) AS total_communities
    FROM communities c
    WHERE CASE p_geography_type
            WHEN 'state' THEN c.state IS NOT NULL
            WHEN 'lga'   THEN c.lga IS NOT NULL
            ELSE              c.lcda IS NOT NULL
          END
    GROUP BY 1
  ),

  geo_creators AS (
    SELECT
      CASE p_geography_type
        WHEN 'state' THEN chs.state
        WHEN 'lga'   THEN chs.lga
        ELSE              chs.lcda
      END AS geo_id,
      COUNT(*) AS creator_count
    FROM creator_health_scores chs_tbl
    JOIN profiles p2 ON p2.id = chs_tbl.creator_id
    -- Get creator geography from their profile location
    LEFT JOIN (
      SELECT
        user_id,
        CASE p_geography_type
          WHEN 'state' THEN state
          WHEN 'lga'   THEN lga
          ELSE              lcda
        END AS geo
      FROM user_events
      WHERE event_type = 'post'
      GROUP BY user_id, CASE p_geography_type
        WHEN 'state' THEN state WHEN 'lga' THEN lga ELSE lcda END
    ) chs ON chs.user_id = chs_tbl.creator_id
    WHERE chs_tbl.score_week = p_score_week - 7
      AND chs_tbl.creator_hs >= 40
    GROUP BY 1
  )

  SELECT
    gu.geo_id                                                AS geography_id,
    COALESCE(ga.geo_name, gu.geo_id)                        AS geography_name,
    gu.active_users_30d,
    ga.area_km2,
    CASE
      WHEN ga.area_km2 > 0
      THEN ROUND(gu.active_users_30d::numeric / ga.area_km2, 4)
      ELSE 0
    END                                                      AS density_per_km2,
    COALESCE(gr.d30_retention, 0)                           AS d30_retention,
    COALESCE(gc.active_community_count, 0)                  AS active_community_count,
    COALESCE(gcr.creator_count, 0)                          AS creator_count,
    COALESCE(
      ROUND(gc.civic_count::numeric / NULLIF(gc.total_communities, 0), 4),
      0
    )                                                        AS civic_ratio
  FROM geo_users gu
  LEFT JOIN geo_area        ga  ON ga.geo_id  = gu.geo_id
  LEFT JOIN geo_retention   gr  ON gr.geo_id  = gu.geo_id
  LEFT JOIN geo_communities gc  ON gc.geo_id  = gu.geo_id
  LEFT JOIN geo_creators    gcr ON gcr.geo_id = gu.geo_id
  WHERE gu.active_users_30d > 0;
$$;

-- ── pg_cron scheduling ────────────────────────────────────────
-- Enable pg_cron extension (requires superuser — done in dashboard or via Supabase CLI)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Daily: compute-retention-cohorts at 01:00 UTC (02:00 WAT)
-- SELECT cron.schedule(
--   'compute-retention-cohorts-daily',
--   '0 1 * * *',
--   $$
--     SELECT net.http_post(
--       url := current_setting('app.supabase_url') || '/functions/v1/compute-retention-cohorts',
--       headers := jsonb_build_object(
--         'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
--         'x-scheduled', 'true'
--       ),
--       body := '{}'::jsonb
--     );
--   $$
-- );

-- Weekly Monday: compute-scores at 02:00 UTC (03:00 WAT)
-- SELECT cron.schedule(
--   'compute-scores-weekly',
--   '0 2 * * 1',
--   $$
--     SELECT net.http_post(
--       url := current_setting('app.supabase_url') || '/functions/v1/compute-scores',
--       headers := jsonb_build_object(
--         'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
--         'x-scheduled', 'true'
--       ),
--       body := '{}'::jsonb
--     );
--   $$
-- );
-- NOTE: Uncomment and run manually once pg_cron is enabled in the Supabase dashboard.
-- Dashboard path: Database → Extensions → pg_cron → Enable
