# MESSENGER_IDENTITY_CERTIFICATION.md
**Phase:** G.0 Foundation Certification  
**Owner:** LILCKY STUDIO LIMITED  
**Date:** 2026-06-02

---

## 1. IDENTITY REQUIREMENT

Loop Messenger MUST NOT create, own, or manage:
- users
- auth_users
- sessions
- devices
- permissions
- roles

Authentication must come **exclusively** from `auth.rald.cloud`.

---

## 2. AUTHENTICATION FLOW

```
User authenticates at auth.rald.cloud
  → Receives master JWT (HS256, 24h, RALD_JWT_SECRET)
  → (Optional) POST /sso/exchange { appId: "messenger" }
    → Receives app-scoped JWT (1h)
  
  → All requests to messenger.rald.cloud include:
    Authorization: Bearer <jwt>
    X-Workspace-ID: <workspace_uuid>
  
  → messenger-api Worker:
    → verifyJwt(token, RALD_JWT_SECRET) — Web Crypto HMAC-SHA256
    → Extracts: { id, email, role, appId }
    → Sets c.set("user", payload)
    → Passes workspace_id from X-Workspace-ID header
```

---

## 3. TABLES NOT IN MESSENGER

| Table | Location | Messenger Reference |
|---|---|---|
| `auth_users` | rald-auth-core / Supabase | JWT payload only (no direct query) |
| `auth_sessions` | rald-auth-core / Supabase | Not accessed |
| `auth_devices` | rald-auth-core / Supabase | Not accessed |
| `auth_product_access` | rald-auth-core / Supabase | Not accessed |
| `organization_members` | rald/api-worker | Not accessed directly |

**Messenger queries zero identity tables.** All identity is derived from the JWT. ✅

---

## 4. JWT USAGE IN MESSENGER

| JWT Claim | Usage in Messenger |
|---|---|
| `id` | `sender_id`, `actor_id` in all tables |
| `email` | Notification targets (passed to rald-notify) |
| `role` | Admin gate checks |
| `appId` | Verified as `"messenger"` on app-scoped tokens |
| `exp` | Enforced by `verifyJwt()` — 401 on expiry |

---

## 5. CERTIFICATION RESULT

```
╔══════════════════════════════════════════════════════════════╗
║  MESSENGER_IDENTITY_CERTIFICATION = PASS                     ║
║  No auth tables created or queried                           ║
║  Authentication exclusively via auth.rald.cloud JWT          ║
║  RALD_JWT_SECRET shared secret — Web Crypto HMAC-SHA256      ║
╚══════════════════════════════════════════════════════════════╝
```

**Signed: LILCKY STUDIO LIMITED — 2026-06-02**
