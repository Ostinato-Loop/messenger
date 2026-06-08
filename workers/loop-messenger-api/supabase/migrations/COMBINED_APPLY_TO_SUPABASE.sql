-- ============================================================
-- Loop Messenger Foundation — Phase G1
-- LILCKY STUDIO LIMITED — 2026-06-02
-- ============================================================

-- 1. CONVERSATIONS
CREATE TABLE IF NOT EXISTS messenger_conversations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     UUID NOT NULL,
  conversation_type TEXT NOT NULL DEFAULT 'direct'
                    CHECK (conversation_type IN ('direct','group','team','customer','internal')),
  title            TEXT,
  description      TEXT,
  created_by       UUID NOT NULL,
  customer_id      UUID,                        -- FK to crm_customers (optional)
  status           TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','archived','closed')),
  last_message_at  TIMESTAMPTZ,
  last_message_preview TEXT,                    -- first 100 chars of last message
  message_count    BIGINT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ
);

-- 2. CONVERSATION MEMBERS
CREATE TABLE IF NOT EXISTS messenger_conversation_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES messenger_conversations(id) ON DELETE CASCADE,
  workspace_id    UUID NOT NULL,
  user_id         UUID NOT NULL,
  role            TEXT NOT NULL DEFAULT 'member'
                   CHECK (role IN ('owner','admin','member','guest')),
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_read_at    TIMESTAMPTZ,
  is_muted        BOOLEAN NOT NULL DEFAULT false,
  is_archived     BOOLEAN NOT NULL DEFAULT false,
  left_at         TIMESTAMPTZ,
  UNIQUE (conversation_id, user_id)
);

-- 3. MESSAGES
CREATE TABLE IF NOT EXISTS messenger_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES messenger_conversations(id) ON DELETE CASCADE,
  workspace_id    UUID NOT NULL,
  sender_id       UUID NOT NULL,
  content         TEXT,                         -- NULL for attachment-only messages
  message_type    TEXT NOT NULL DEFAULT 'text'
                   CHECK (message_type IN ('text','system','emoji')),
  reply_to_id     UUID REFERENCES messenger_messages(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ                   -- soft delete; content → NULL on delete
);

-- 4. MESSAGE STATUS (per-user delivery tracking)
CREATE TABLE IF NOT EXISTS messenger_message_status (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  UUID NOT NULL REFERENCES messenger_messages(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL,
  workspace_id UUID NOT NULL,
  status      TEXT NOT NULL DEFAULT 'sent'
               CHECK (status IN ('sent','delivered','read','failed')),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id)
);

-- 5. MESSAGE REACTIONS
CREATE TABLE IF NOT EXISTS messenger_message_reactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id      UUID NOT NULL REFERENCES messenger_messages(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL,
  workspace_id    UUID NOT NULL,
  user_id         UUID NOT NULL,
  emoji           TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

-- 6. MESSAGE ATTACHMENTS (metadata only — no media processing in G1)
CREATE TABLE IF NOT EXISTS messenger_message_attachments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id      UUID REFERENCES messenger_messages(id) ON DELETE SET NULL,
  conversation_id UUID NOT NULL,
  workspace_id    UUID NOT NULL,
  uploaded_by     UUID NOT NULL,
  filename        TEXT NOT NULL,
  mime_type       TEXT NOT NULL,
  size_bytes      BIGINT NOT NULL DEFAULT 0,
  storage_key     TEXT NOT NULL,               -- CF R2 / Supabase Storage key (future)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. CONVERSATION ASSIGNMENTS
CREATE TABLE IF NOT EXISTS messenger_conversation_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES messenger_conversations(id) ON DELETE CASCADE,
  workspace_id    UUID NOT NULL,
  assigned_to     UUID NOT NULL,               -- agent user_id
  assigned_by     UUID NOT NULL,               -- assigner user_id
  team_id         UUID,                        -- optional team assignment
  reason          TEXT,
  assigned_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  unassigned_at   TIMESTAMPTZ                  -- NULL = currently active assignment
);

-- 8. AUDIT LOG
CREATE TABLE IF NOT EXISTS messenger_audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL,
  actor_id      UUID NOT NULL,
  action        TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id   UUID,
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_msng_conversations_workspace
  ON messenger_conversations(workspace_id, last_message_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_msng_conversations_customer
  ON messenger_conversations(customer_id)
  WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_msng_messages_conversation
  ON messenger_messages(conversation_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_msng_messages_sender
  ON messenger_messages(sender_id, workspace_id);

CREATE INDEX IF NOT EXISTS idx_msng_members_user
  ON messenger_conversation_members(user_id, workspace_id)
  WHERE left_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_msng_members_conversation
  ON messenger_conversation_members(conversation_id)
  WHERE left_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_msng_reactions_message
  ON messenger_message_reactions(message_id);

CREATE INDEX IF NOT EXISTS idx_msng_status_message
  ON messenger_message_status(message_id);

CREATE INDEX IF NOT EXISTS idx_msng_assignments_conversation
  ON messenger_conversation_assignments(conversation_id)
  WHERE unassigned_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_msng_audit_workspace
  ON messenger_audit_log(workspace_id, created_at DESC);

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE messenger_conversations IS 'Loop Messenger conversations — workspace isolated, customer-graph compatible';
COMMENT ON TABLE messenger_messages IS 'Messages — soft delete via deleted_at; content nulled on delete';
COMMENT ON TABLE messenger_conversation_members IS 'Conversation membership with per-user role, mute, archive state';
COMMENT ON TABLE messenger_audit_log IS 'Immutable audit trail — 22 action types';

-- ============================================================
-- Loop Messenger — Schema Fixes (Sprint 2026-06-05)
-- LILCKY STUDIO LIMITED
-- ============================================================
-- Fixes:
--  1. workspace_id UUID → TEXT  (middleware passes "consumer" for P2P)
--  2. Add unread_count column   (queried by conversations.ts but missing from G1)
--  3. Create public.profiles    (used by SSO bridge + member enrichment)
-- ============================================================

-- ── 1. workspace_id: UUID → TEXT on all messenger tables ──────────────────
-- "consumer" is the sentinel for Loop P2P (non-workspace) use.
-- Business integrations pass a valid UUID via X-Workspace-ID header.
-- Changing to TEXT accommodates both without breaking either.

ALTER TABLE messenger_conversations
  ALTER COLUMN workspace_id TYPE TEXT USING workspace_id::TEXT;

ALTER TABLE messenger_conversations
  ALTER COLUMN workspace_id SET DEFAULT 'consumer';

ALTER TABLE messenger_conversation_members
  ALTER COLUMN workspace_id TYPE TEXT USING workspace_id::TEXT;

ALTER TABLE messenger_conversation_members
  ALTER COLUMN workspace_id SET DEFAULT 'consumer';

ALTER TABLE messenger_messages
  ALTER COLUMN workspace_id TYPE TEXT USING workspace_id::TEXT;

ALTER TABLE messenger_messages
  ALTER COLUMN workspace_id SET DEFAULT 'consumer';

ALTER TABLE messenger_message_status
  ALTER COLUMN workspace_id TYPE TEXT USING workspace_id::TEXT;

ALTER TABLE messenger_message_status
  ALTER COLUMN workspace_id SET DEFAULT 'consumer';

ALTER TABLE messenger_message_reactions
  ALTER COLUMN workspace_id TYPE TEXT USING workspace_id::TEXT;

ALTER TABLE messenger_message_reactions
  ALTER COLUMN workspace_id SET DEFAULT 'consumer';

ALTER TABLE messenger_message_attachments
  ALTER COLUMN workspace_id TYPE TEXT USING workspace_id::TEXT;

ALTER TABLE messenger_message_attachments
  ALTER COLUMN workspace_id SET DEFAULT 'consumer';

ALTER TABLE messenger_conversation_assignments
  ALTER COLUMN workspace_id TYPE TEXT USING workspace_id::TEXT;

ALTER TABLE messenger_conversation_assignments
  ALTER COLUMN workspace_id SET DEFAULT 'consumer';

ALTER TABLE messenger_audit_log
  ALTER COLUMN workspace_id TYPE TEXT USING workspace_id::TEXT;

ALTER TABLE messenger_audit_log
  ALTER COLUMN workspace_id SET DEFAULT 'consumer';

-- ── 2. unread_count — missing from G1, queried in conversations.ts ─────────
ALTER TABLE messenger_conversation_members
  ADD COLUMN IF NOT EXISTS unread_count INTEGER NOT NULL DEFAULT 0;

-- Function to increment unread count when a message arrives for non-sender members
CREATE OR REPLACE FUNCTION increment_unread_on_message()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE messenger_conversation_members
  SET    unread_count = unread_count + 1
  WHERE  conversation_id = NEW.conversation_id
    AND  user_id        <> NEW.sender_id
    AND  left_at IS NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_increment_unread ON messenger_messages;
CREATE TRIGGER trg_increment_unread
  AFTER INSERT ON messenger_messages
  FOR EACH ROW EXECUTE FUNCTION increment_unread_on_message();

-- Reset unread count when the user marks conversation as read
-- (Called by the PATCH /conversations/:id/read endpoint)
CREATE OR REPLACE FUNCTION reset_unread_for_user(
  p_conversation_id UUID,
  p_user_id         UUID,
  p_workspace_id    TEXT
) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  UPDATE messenger_conversation_members
  SET    unread_count = 0,
         last_read_at = now()
  WHERE  conversation_id = p_conversation_id
    AND  user_id        = p_user_id
    AND  workspace_id   = p_workspace_id;
END;
$$;

-- ── 3. public.profiles — shared identity table ────────────────────────────
-- Created by rald-sso bridge and consumed by loop + messenger member enrichment.
-- auth.rald.cloud populates this on first login / SSO exchange.
-- The id column mirrors the RALD user ID (UUID from auth.rald.cloud).

CREATE TABLE IF NOT EXISTS profiles (
  id              UUID PRIMARY KEY,
  username        TEXT UNIQUE,
  display_name    TEXT,
  avatar_url      TEXT,
  bio             TEXT,
  is_verified     BOOLEAN NOT NULL DEFAULT false,
  phone           TEXT,
  language        TEXT DEFAULT 'en',
  interests       TEXT[] DEFAULT '{}',
  is_creator      BOOLEAN NOT NULL DEFAULT false,
  onboarded       BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username) WHERE username IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_phone    ON profiles(phone)    WHERE phone IS NOT NULL;

COMMENT ON TABLE profiles IS 'Shared RALD identity profiles — populated by auth.rald.cloud SSO bridge; consumed by loop, messenger, and profiles apps';

-- ── 4. Drop UUID indexes that referenced old UUID workspace_id columns ─────
-- Old indexes on (workspace_id) were created against UUID type; they survive
-- the type cast but we recreate with explicit TEXT cast for clarity.

DROP INDEX IF EXISTS idx_msng_conversations_workspace;
CREATE INDEX IF NOT EXISTS idx_msng_conversations_workspace
  ON messenger_conversations(workspace_id, last_message_at DESC)
  WHERE deleted_at IS NULL;

DROP INDEX IF EXISTS idx_msng_members_user;
CREATE INDEX IF NOT EXISTS idx_msng_members_user
  ON messenger_conversation_members(user_id, workspace_id)
  WHERE left_at IS NULL;

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
