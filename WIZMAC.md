# WIZMAC — messenger
> Loop Messenger — Private Messaging Layer
> Last updated: 2026-06-17 — LILCKY STUDIO LIMITED
> (Full reference: WIZMAC.md in the messenger repo root)

---

## 1. Product Overview
**messenger** is the private messaging layer of RALD. It powers 1:1 and group messaging between RALD-verified users. Accessible at `chat.rald.cloud` (SPA) and `messenger.rald.cloud` (API).

| Field | Value |
|-------|-------|
| API URL | `https://messenger.rald.cloud` |
| SPA URL | `https://chat.rald.cloud` ⚠️ NXDOMAIN — DNS not configured |
| Repo | `Ostinato-Loop/messenger` |
| Stack | Cloudflare Worker (Hono) + React/Vite SPA |
| Database | Supabase `onxdcikfttdmnhofsuwo.supabase.co` |
| Version | 1.2.2 |

---

## 2. Architecture
| Layer | Stack | Deployment |
|-------|-------|------------|
| API Worker | Cloudflare Worker (Hono) | `messenger.rald.cloud` |
| SPA | React + Vite (Wouter) | Cloudflare Pages (`chat.rald.cloud`) |
| Database | Supabase PostgreSQL | Shared instance |
| Auth | RALD SSO JWT | Shared `RALD_JWT_SECRET` |

---

## 3. Auth Flow
```
1. SPA calls POST /api/sso { rald_token } → returns { access_token }
2. All API calls: Authorization: Bearer <access_token>
3. Internal: POST /internal/accounts/provision (X-Internal-Secret only)
```

---

## 4. Database Schema
```sql
messenger_conversations (id, workspace_id, conversation_type, title,
  description, created_by, customer_id, status, last_message_at,
  last_message_preview, message_count, created_at, updated_at, deleted_at)

messenger_conversation_members (id, conversation_id, workspace_id, user_id,
  role, joined_at, last_read_at, is_muted, is_archived, left_at)

messenger_messages (id, conversation_id, workspace_id, sender_id, content,
  message_type, reply_to_id, created_at, updated_at, deleted_at)

messenger_message_status (id, message_id, user_id, delivered_at, read_at)

messenger_message_reactions (id, message_id, user_id, emoji, created_at)

messenger_attachments (id, message_id, conversation_id, url, type,
  filename, size, created_at)

messenger_profiles (id, user_id, username, display_name, avatar_url,
  bio, is_active, created_at, updated_at)
-- ⚠️ CRITICAL: Migrations NOT applied to Supabase production
```

---

## 5. Key Environment Variables
| Variable | Required | Set In |
|----------|----------|--------|
| `RALD_JWT_SECRET` | ✅ | Cloudflare secret |
| `SUPABASE_URL` | ✅ | Cloudflare secret |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ ⚠️ ROTATE | Cloudflare secret |
| `RALD_INTERNAL_SECRET` | ✅ | Cloudflare secret |
| `SUPABASE_DB_PASSWORD` | Migration only | GitHub secret |

---

## 6. Live Endpoints
| Method | Path | Auth | Status |
|--------|------|------|--------|
| GET | `/health` | None | ✅ |
| POST | `/auth/rald-sso` | None | ✅ |
| POST | `/internal/accounts/provision` | `X-Internal-Secret` | ✅ New |
| GET | `/conversations` | JWT | ⚠️ DB tables not applied |
| POST | `/conversations` | JWT | ⚠️ DB tables not applied |
| GET | `/conversations/:id/messages` | JWT | ⚠️ DB tables not applied |
| POST | `/conversations/:id/messages` | JWT | ⚠️ DB tables not applied |

---

## 7. CI Pipelines
| Workflow | Trigger | Status |
|----------|---------|--------|
| CI | Push/PR to main | ✅ Green |
| Deploy API Worker | Push to main | ✅ Green |
| Deploy Pages | Push to main | ✅ Green |
| Apply Migrations | Manual | ⚠️ Requires SUPABASE_DB_PASSWORD |

---

## 8. Incidents
| # | Date | Description | Status |
|---|------|-------------|--------|
| M-001 | 2026-06-05 | Messenger DB tables never applied — all conversation endpoints fail | ⚠️ SQL ready |
| M-002 | 2026-06-05 | workspace_id UUID/TEXT mismatch | ✅ Fixed in migration 20260605 |
| M-003 | 2026-06-05 | chat.rald.cloud NXDOMAIN | ⚠️ DNS not configured |
| M-004 | 2026-06-17 | POST /internal/accounts/provision added for identity chain (v1.2.2) | ✅ Deployed |
