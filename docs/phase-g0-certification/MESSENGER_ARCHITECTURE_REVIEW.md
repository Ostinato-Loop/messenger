# MESSENGER_ARCHITECTURE_REVIEW.md
**Phase:** G.0 Foundation Certification  
**Owner:** LILCKY STUDIO LIMITED  
**Date:** 2026-06-02  
**Decision Target:** AUTHORIZED FOR G1 / NOT AUTHORIZED FOR G1

---

## 1. ARCHITECTURE POSITION

Loop Messenger is a **platform capability** built on top of the certified RALD platform services. It is NOT a standalone application. It **consumes** — and never duplicates — the following certified services:

```
                 ┌─────────────────────────────┐
                 │     messenger.rald.cloud      │
                 │   loop-messenger-api Worker   │
                 │     (Hono / CF Worker)        │
                 └──────────────┬──────────────┘
                                │ CONSUMES
         ┌──────────────────────┼──────────────────────┐
         │                      │                      │
    auth.rald.cloud       crm.rald.cloud       inbox.rald.cloud
   (Identity/SSO)        (Customer Graph)     (Unified Inbox)
         │                      │                      │
         └──────────┬───────────┘           notification.rald.cloud
                    │                       (Notifications)
              search.rald.cloud
              (Search Platform)
```

---

## 2. PHASE DEPENDENCY CHAIN

| Phase | Service | Messenger Dependency |
|---|---|---|
| A — Identity | auth.rald.cloud | JWT validation · SSO exchange · Device trust |
| B — Architecture Lock | API patterns | All routes follow RALD API standard |
| C — Workspace Foundation | Workspace isolation | `workspace_id` on ALL tables; RBAC enforced |
| D — Customer Graph | loop-crm | `customer_id` FK on conversations; timeline events |
| E — Notifications + Search | rald-notify + rald-search | New message triggers + conversation indexing |
| F — Unified Inbox | rald-inbox | Messenger registers as channel provider |

---

## 3. WHAT MESSENGER OWNS

| Concern | Messenger Owns | Status |
|---|---|---|
| Conversation model | `messenger_conversations` | ✅ Own table |
| Conversation members | `messenger_conversation_members` | ✅ Own table |
| Messages | `messenger_messages` | ✅ Own table |
| Message status | `messenger_message_status` | ✅ Own table |
| Reactions | `messenger_message_reactions` | ✅ Own table |
| Attachment metadata | `messenger_message_attachments` | ✅ Own table |
| Assignments | `messenger_conversation_assignments` | ✅ Own table |
| Audit log | `messenger_audit_log` | ✅ Own table |

---

## 4. WHAT MESSENGER DOES NOT OWN

| Concern | Owned By | Messenger Integration |
|---|---|---|
| Users / Auth | auth.rald.cloud | JWT from Authorization header |
| Workspace membership | rald/api-worker | X-Workspace-ID header validated |
| Customer identity | loop-crm | customer_id FK → no duplicate tables |
| Notifications | rald-notify | HTTP POST to notification.rald.cloud |
| Search index | rald-search | HTTP POST to search.rald.cloud/index |
| Inbox channel | rald-inbox | Messenger registers as `loop_messenger` adapter |
| Sessions | auth.rald.cloud | JWT contains session context |
| Devices | auth.rald.cloud | Trusted device registry |

---

## 5. DEPLOYMENT ARCHITECTURE

```
GitHub push to main
  → GitHub Actions: deploy-api.yml
    → npx wrangler deploy --minify
      → messenger.rald.cloud (Cloudflare Worker)
      → Same CF Account: d5a1cd03b76f467430034af64a7062fd
```

**Runtime:** Cloudflare Worker (V8 isolate, Hono v4 framework)  
**Database:** Supabase Postgres (service role, app-layer workspace isolation)  
**Secrets:** Managed via wrangler secret put + GitHub Actions

---

## 6. CROSS-SERVICE COMMUNICATION CONTRACTS

| Call Direction | Protocol | Auth | Rate |
|---|---|---|---|
| Messenger → auth.rald.cloud/sso/verify | HTTPS POST | None (public verify endpoint) | Per-request |
| Messenger → notification.rald.cloud | HTTPS POST | RALD JWT | Per-message-event |
| Messenger → search.rald.cloud/index | HTTPS POST | RALD JWT | Per-message |
| Messenger → crm.rald.cloud | HTTPS GET/POST | RALD JWT | Per-customer-link |
| rald-inbox → Messenger | HTTPS (adapter) | RALD JWT | Per-conversation |

---

## 7. ARCHITECTURE VERDICT

```
╔══════════════════════════════════════════════════════════════╗
║  MESSENGER_ARCHITECTURE_REVIEW = PASS                        ║
║  No platform service duplication detected                    ║
║  All 5 certified dependencies correctly consumed             ║
║  Deployment chain: GitHub → CF Worker ✅                     ║
╚══════════════════════════════════════════════════════════════╝
```

**Signed: LILCKY STUDIO LIMITED — 2026-06-02**
