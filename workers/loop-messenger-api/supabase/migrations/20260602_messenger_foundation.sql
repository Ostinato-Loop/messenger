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
