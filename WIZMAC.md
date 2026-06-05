# WIZMAC — Messenger Ecosystem Knowledge Map
> **WIZMAC** = Workspace Intelligence, Zero-friction Messaging, Auth, Commerce
>
> This is the institutional memory for the RALD Messenger product.
> Organisation: Ostinato-Loop (GitHub)

---

## 1. Product Overview

**Loop Messenger** is the private messaging layer of the RALD ecosystem.

- **Consumer URL:** `https://chat.rald.cloud` (⚠️ DNS not configured — NXDOMAIN as of 2026-06-05)
- **API URL:** `https://messenger.rald.cloud`
- **Core message:** "Your private relationship network."

### What Messenger Is

Messenger connects people who share a verified RALD identity. It is built around:
- Direct 1:1 and group messaging
- Persistent conversation history
- Relationship-first design (no ads, no algorithmic noise)
- RALD SSO identity (same profile as Loop, Profiles)

### What Messenger Is NOT
- Not a public content feed
- Not an anonymous messaging platform
- Not a notification aggregator
- Not a general-purpose chat for bots/automations

---

## 2. Architecture

| Layer | Stack | Deployment |
|-------|-------|------------|
| API Worker | Cloudflare Worker (Hono) | `messenger.rald.cloud` |
| Frontend SPA | React + Vite (Wouter router) | `chat.rald.cloud` (Cloudflare Pages) |
| Database | Supabase PostgreSQL | `onxdcikfttdmnhofsuwo.supabase.co` |
| Auth | RALD SSO via `auth.rald.cloud` | Shared JWT secret |

### API Worker Structure
```
workers/loop-messenger-api/
  src/
    index.ts          ← Hono app entry, middleware registration
    routes/           ← Route handlers
    middleware/       ← Auth, DB, CORS middleware
  supabase/
    migrations/       ← SQL migration files
```

### Frontend SPA
```
src/
  App.tsx             ← Wouter router
  pages/              ← Conversations, Messages, Profile pages
  hooks/              ← useAuth, useConversations
  lib/                ← API client
```

---

## 3. Auth Flow

Messenger uses RALD SSO — same as all RALD products:

```
1. User visits chat.rald.cloud
2. No token → redirect to profiles.rald.cloud/login?app_id=messenger&redirect_to=chat.rald.cloud
3. Profiles issues RALD JWT, redirects to chat.rald.cloud/?rald_token=JWT
4. Messenger calls POST /api/sso { rald_token } → validates JWT → returns { access_token }
5. access_token stored in localStorage
6. All API calls use Authorization: Bearer <access_token>
7. Logout: POST /api/auth/logout → redirect to profiles.rald.cloud/logout
```

**Shared secret:** `RALD_JWT_SECRET` — same across loop-api, rald-auth-core, messenger.
Set via Cloudflare Wrangler secrets in CI (`push_secret` step in deploy workflow).

---

## 4. Database Schema

### ⚠️ CRITICAL: Migrations NOT Applied as of 2026-06-05

The following tables are defined in migrations but **do not exist in production Supabase**:

```
messenger_conversations
messenger_messages
messenger_conversation_members
profiles
```

**Result:** ALL conversation/message endpoints fail in production.

### Pending Action (P0)
```
1. Supabase Dashboard → Settings → Database → copy DB password
2. GitHub → Ostinato-Loop/messenger → Settings → Secrets → add:
   SUPABASE_DB_PASSWORD = <paste>
3. GitHub Actions → "Apply Supabase Migrations" → Run workflow
```

### Migration Files
```
supabase/migrations/20260602_messenger_foundation.sql    ← Base schema
supabase/migrations/20260605_messenger_schema_fixes.sql  ← workspace_id fix, unread_count
```

Apply workflow: `.github/workflows/apply-migrations.yml`

### Schema Overview (after migrations applied)

```sql
messenger_conversations (
  id UUID PRIMARY KEY,
  workspace_id TEXT NOT NULL,  -- was UUID, fixed to TEXT (middleware passes "consumer")
  created_by TEXT NOT NULL,
  title TEXT,
  type TEXT NOT NULL,          -- 'direct' | 'group'
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)

messenger_messages (
  id UUID PRIMARY KEY,
  conversation_id UUID REFERENCES messenger_conversations(id),
  sender_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ
)

messenger_conversation_members (
  conversation_id UUID REFERENCES messenger_conversations(id),
  user_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  unread_count INTEGER DEFAULT 0,
  joined_at TIMESTAMPTZ,
  PRIMARY KEY (conversation_id, user_id)
)

profiles (
  id TEXT PRIMARY KEY,         -- RALD user ID
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  rald_address TEXT
)
```

---

## 5. Key Environment Variables

| Variable | Required | Set In |
|----------|----------|--------|
| `RALD_JWT_SECRET` | ✅ CRITICAL | GitHub secret → wrangler secret push in CI |
| `SUPABASE_URL` | ✅ CRITICAL | GitHub secret → wrangler secret push in CI |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ CRITICAL | GitHub secret → wrangler secret push in CI |
| `SUPABASE_DB_PASSWORD` | Required for migrations only | Must be added to GitHub secrets |
| `MESSENGER_WEBHOOK_KEY` | For DM notifications | Shared with loop-api for `/api/notify/dm` |

---

## 6. Live Endpoints (2026-06-05)

| Endpoint | Status | Notes |
|----------|--------|-------|
| `messenger.rald.cloud/health` | ✅ 200 OK | `{ status: ok, service: loop-messenger-api }` |
| `messenger.rald.cloud/ready` | ✅ 200 OK | All checks green (jwt, supabase, notify, search, crm) |
| `messenger.rald.cloud/api/sso` | ✅ Working | Token exchange with rald_token |
| `messenger.rald.cloud/api/conversations` | ❌ Fails | DB tables not created yet |
| `messenger.rald.cloud/api/messages` | ❌ Fails | DB tables not created yet |
| `chat.rald.cloud` | ❌ NXDOMAIN | Cloudflare Pages custom domain not added |

---

## 7. CI Pipelines

| Workflow | Status | Trigger |
|----------|--------|---------|
| CI | ✅ Green | Push to main |
| Deploy Messenger API Worker | ✅ Green | Push to main |
| Deploy — Cloudflare Pages | ✅ Green | Push to main |
| Apply Supabase Migrations | ⏸ Manual | workflow_dispatch (requires SUPABASE_DB_PASSWORD secret) |

---

## 8. Trust & Positioning

**Messenger Marketing Page** available at `https://rald.cloud/messenger`:
- Core message: "Your private relationship network."
- Key trust signals: 0 ads, persistent history, verified RALD identities
- Cross-app flow: Loop → Profiles → Messenger

---

## 9. Incidents

| # | Date | Description | Status |
|---|------|-------------|--------|
| M001 | 2026-06 | Messenger DB tables never applied to Supabase production | ⚠️ Open — owner must apply migrations |
| M002 | 2026-06 | workspace_id column was UUID NOT NULL but middleware passes string "consumer" | ✅ Fixed in 20260605 migration (pending application) |
| M003 | 2026-06 | chat.rald.cloud NXDOMAIN — Cloudflare Pages custom domain not added | ⚠️ Open — owner must add domain |

---

*WIZMAC Messenger v1.0 — Created 2026-06-05 — LILCKY STUDIO LIMITED*
*This document is the single source of truth for RALD Messenger platform operations.*
