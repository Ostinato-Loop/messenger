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
-- idx_profiles_phone removed: profiles.phone does not exist in this schema

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
