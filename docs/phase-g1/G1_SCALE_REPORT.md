# G1_SCALE_REPORT.md
**Phase:** G1 — Loop Messenger Foundation  
**Owner:** LILCKY STUDIO LIMITED  
**Date:** 2026-06-02

---

## 1. PLATFORM SCALE CHARACTERISTICS

| Component | Scale Model | Current Ceiling |
|---|---|---|
| Cloudflare Worker | Auto-scaled globally (V8 isolates) | Effectively unlimited |
| Supabase Postgres | Connection pooling via Supabase | ~500 concurrent connections |
| rald-notify | CF Worker (auto-scaled) | 100k+ notifications/day |
| rald-search | CF Worker (Postgres FTS) | p95 < 200ms at current scale |
| loop-crm | CF Worker (auto-scaled) | Unlimited API requests |

---

## 2. DATABASE PERFORMANCE

| Table | Index Strategy | Expected p95 |
|---|---|---|
| `messenger_conversations` | `(workspace_id, last_message_at DESC) WHERE deleted_at IS NULL` | < 10ms for 100k conversations |
| `messenger_messages` | `(conversation_id, created_at DESC) WHERE deleted_at IS NULL` | < 10ms for 1M messages |
| `messenger_conversation_members` | `(user_id, workspace_id) WHERE left_at IS NULL` | < 5ms |
| `messenger_message_reactions` | `(message_id)` | < 5ms |
| `messenger_audit_log` | `(workspace_id, created_at DESC)` | < 10ms |

---

## 3. PAGINATION

All list endpoints support pagination:
- `GET /conversations?page=1&limit=20` (max 100)
- `GET /conversations/:id/messages?limit=50&before=<ISO>` (cursor-based, max 200)

---

## 4. NON-BLOCKING INTEGRATION CALLS

All platform service calls (rald-notify, rald-search, loop-crm audit) use `c.executionCtx.waitUntil()`:
- Worker responds to client in < 50ms
- Integration calls complete asynchronously
- Failures logged — do not affect client response
- AbortSignal.timeout(5000) on all outbound calls

---

## 5. SCALE LIMITATIONS (G1)

| Limitation | Impact | G-Phase Fix |
|---|---|---|
| No real-time delivery (polling only) | High-frequency poll increases DB load | G3: Durable Objects |
| No read receipt fan-out (sender-only status) | Recipients must poll | G3: Real-time status push |
| No rate limiting on message endpoints | Potential abuse | G2: KV rate limiter |
| Attachment storage key is client-provided | No server-side validation | G2: CF R2 signed upload |
| No message queue for slow integrations | Back-pressure on external failures | G2: Durable Object queue |

---

## 6. SCALE VERDICT

G1 is suitable for initial production traffic at current workspace counts. Platform is inherently horizontally scaled via Cloudflare Workers. Database indexes are in place for expected query patterns.

```
╔══════════════════════════════════════════════════════════════╗
║  G1_SCALE_REPORT = PASS FOR PHASE G BUILD TRAFFIC           ║
║  Real-time + rate limiting required before consumer launch  ║
╚══════════════════════════════════════════════════════════════╝
```

**Signed: LILCKY STUDIO LIMITED — 2026-06-02**
