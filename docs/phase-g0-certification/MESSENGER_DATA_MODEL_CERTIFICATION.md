# MESSENGER_DATA_MODEL_CERTIFICATION.md
**Phase:** G.0 Foundation Certification  
**Owner:** LILCKY STUDIO LIMITED  
**Date:** 2026-06-02

---

## 1. DATA MODEL OVERVIEW

The Loop Messenger data model lives in 8 Supabase tables, all prefixed `messenger_` to avoid conflicts with existing platform tables. All tables are workspace-isolated.

---

## 2. TABLE SPECIFICATIONS

### 2.1 `messenger_conversations`

| Column | Type | Required | Notes |
|---|---|---|---|
| `id` | UUID PK | ✅ | `gen_random_uuid()` |
| `workspace_id` | UUID | ✅ | Workspace isolation |
| `conversation_type` | TEXT | ✅ | `direct`, `group`, `team`, `customer`, `internal` |
| `title` | TEXT | — | Optional for group/team |
| `description` | TEXT | — | Optional |
| `created_by` | UUID | ✅ | Auth user ID |
| `customer_id` | UUID | — | FK → `crm_customers.id` |
| `status` | TEXT | ✅ | `active`, `archived`, `closed` |
| `last_message_at` | TIMESTAMPTZ | — | Updated on every message |
| `last_message_preview` | TEXT | — | First 100 chars |
| `created_at` | TIMESTAMPTZ | ✅ | Auto |
| `updated_at` | TIMESTAMPTZ | ✅ | Auto |
| `deleted_at` | TIMESTAMPTZ | — | Soft delete |

### 2.2 `messenger_conversation_members`

| Column | Type | Required | Notes |
|---|---|---|---|
| `id` | UUID PK | ✅ | |
| `conversation_id` | UUID FK | ✅ | → `messenger_conversations` |
| `workspace_id` | UUID | ✅ | Denormalised for isolation |
| `user_id` | UUID | ✅ | Auth user ID |
| `role` | TEXT | ✅ | `owner`, `admin`, `member`, `guest` |
| `joined_at` | TIMESTAMPTZ | ✅ | Auto |
| `last_read_at` | TIMESTAMPTZ | — | For unread count |
| `is_muted` | BOOLEAN | ✅ | Default false |
| `is_archived` | BOOLEAN | ✅ | Default false |
| `left_at` | TIMESTAMPTZ | — | Soft leave |
| UNIQUE | `(conversation_id, user_id)` | | Prevents duplicate membership |

### 2.3 `messenger_messages`

| Column | Type | Required | Notes |
|---|---|---|---|
| `id` | UUID PK | ✅ | |
| `conversation_id` | UUID FK | ✅ | → `messenger_conversations` |
| `workspace_id` | UUID | ✅ | Denormalised |
| `sender_id` | UUID | ✅ | Auth user ID |
| `content` | TEXT | — | Null for attachment-only messages |
| `message_type` | TEXT | ✅ | `text`, `system`, `emoji` — extensible |
| `reply_to_id` | UUID FK | — | → `messenger_messages` (thread) |
| `created_at` | TIMESTAMPTZ | ✅ | Immutable after send |
| `updated_at` | TIMESTAMPTZ | ✅ | On edit |
| `deleted_at` | TIMESTAMPTZ | — | Soft delete; content → NULL |

### 2.4 `messenger_message_status`

| Column | Type | Required | Notes |
|---|---|---|---|
| `id` | UUID PK | ✅ | |
| `message_id` | UUID FK | ✅ | → `messenger_messages` |
| `user_id` | UUID | ✅ | Per-user status tracking |
| `workspace_id` | UUID | ✅ | Denormalised |
| `status` | TEXT | ✅ | `sent`, `delivered`, `read`, `failed` |
| `updated_at` | TIMESTAMPTZ | ✅ | |
| UNIQUE | `(message_id, user_id)` | | One status per user per message |

### 2.5 `messenger_message_reactions`

| Column | Type | Required | Notes |
|---|---|---|---|
| `id` | UUID PK | ✅ | |
| `message_id` | UUID FK | ✅ | |
| `conversation_id` | UUID | ✅ | Denormalised |
| `workspace_id` | UUID | ✅ | Denormalised |
| `user_id` | UUID | ✅ | |
| `emoji` | TEXT | ✅ | Unicode emoji |
| `created_at` | TIMESTAMPTZ | ✅ | |
| UNIQUE | `(message_id, user_id, emoji)` | | One reaction per user per emoji |

### 2.6 `messenger_message_attachments`

| Column | Type | Required | Notes |
|---|---|---|---|
| `id` | UUID PK | ✅ | |
| `message_id` | UUID FK | — | Linked after message created |
| `conversation_id` | UUID | ✅ | |
| `workspace_id` | UUID | ✅ | |
| `uploaded_by` | UUID | ✅ | Auth user ID |
| `filename` | TEXT | ✅ | Original filename |
| `mime_type` | TEXT | ✅ | MIME type |
| `size_bytes` | BIGINT | ✅ | File size |
| `storage_key` | TEXT | ✅ | Object storage key (future media processing) |
| `created_at` | TIMESTAMPTZ | ✅ | |

### 2.7 `messenger_conversation_assignments`

| Column | Type | Required | Notes |
|---|---|---|---|
| `id` | UUID PK | ✅ | |
| `conversation_id` | UUID FK | ✅ | |
| `workspace_id` | UUID | ✅ | |
| `assigned_to` | UUID | ✅ | Agent user ID |
| `assigned_by` | UUID | ✅ | Assigner user ID |
| `team_id` | UUID | — | Optional team assignment |
| `reason` | TEXT | — | Escalation note |
| `assigned_at` | TIMESTAMPTZ | ✅ | |
| `unassigned_at` | TIMESTAMPTZ | — | When superseded |

### 2.8 `messenger_audit_log`

| Column | Type | Required | Notes |
|---|---|---|---|
| `id` | UUID PK | ✅ | |
| `workspace_id` | UUID | ✅ | |
| `actor_id` | UUID | ✅ | |
| `action` | TEXT | ✅ | e.g. `conversation.created`, `message.sent` |
| `resource_type` | TEXT | ✅ | `conversation`, `message`, `member` |
| `resource_id` | UUID | — | |
| `metadata` | JSONB | — | Contextual data |
| `created_at` | TIMESTAMPTZ | ✅ | Immutable |

---

## 3. COMPLIANCE CHECKLIST

| Requirement | Status |
|---|---|
| Workspace isolated (workspace_id on all tables) | ✅ |
| Audit friendly (messenger_audit_log, 22 action types) | ✅ |
| Search friendly (conversation title + message content indexable) | ✅ |
| Notification friendly (message_id + sender_id available for notify trigger) | ✅ |
| Customer Graph compatible (customer_id FK → crm_customers) | ✅ |
| Soft delete (deleted_at on conversations + messages) | ✅ |
| Future channel compatible (conversation_type extensible) | ✅ |
| No duplicate auth_users / sessions / devices | ✅ |

---

## 4. CERTIFICATION RESULT

```
╔══════════════════════════════════════════════════════════════╗
║  MESSENGER_DATA_MODEL_CERTIFICATION = PASS                   ║
║  8 tables defined · All workspace isolated                   ║
║  0 duplicate platform tables · CRM-compatible               ║
╚══════════════════════════════════════════════════════════════╝
```

**Signed: LILCKY STUDIO LIMITED — 2026-06-02**
