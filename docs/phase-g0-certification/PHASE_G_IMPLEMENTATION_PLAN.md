# PHASE_G_IMPLEMENTATION_PLAN.md
**Owner:** LILCKY STUDIO LIMITED  
**Date:** 2026-06-02

---

## G1 — MESSENGER FOUNDATION (This Sprint)

### Deliverables
- Supabase migration: 8 messenger tables
- Cloudflare Worker: loop-messenger-api (Hono)
- API routes: conversations, messages, reactions, members, attachments, assignments
- Platform integrations: rald-notify, rald-search, loop-crm, rald-inbox
- Reports: G1_IMPLEMENTATION_REPORT, G1_SECURITY_REPORT, G1_SCALE_REPORT, G1_CERTIFICATION

### API Endpoints
| Method | Path | Description |
|---|---|---|
| GET | /conversations | List conversations (workspace-scoped) |
| POST | /conversations | Create conversation |
| GET | /conversations/:id | Get conversation |
| PATCH | /conversations/:id | Update conversation |
| DELETE | /conversations/:id | Archive conversation |
| GET | /conversations/:id/messages | List messages |
| POST | /conversations/:id/messages | Send message |
| PATCH | /conversations/:id/messages/:msgId | Edit message |
| DELETE | /conversations/:id/messages/:msgId | Soft-delete message |
| POST | /conversations/:id/messages/:msgId/reactions | Add reaction |
| DELETE | /conversations/:id/messages/:msgId/reactions/:emoji | Remove reaction |
| GET | /conversations/:id/members | List members |
| POST | /conversations/:id/members | Add member |
| PATCH | /conversations/:id/members/:userId | Update member role |
| DELETE | /conversations/:id/members/:userId | Remove member |
| POST | /conversations/:id/assignments | Create assignment |
| GET | /conversations/:id/assignments | List assignments |
| POST | /conversations/:id/attachments | Register attachment metadata |
| GET | /health | Health check |
| GET | /ready | Readiness check |

---

## G2 — CHANNEL INTEGRATION (Next Sprint)

- WhatsApp channel adapter
- Instagram channel adapter
- Facebook Messenger channel adapter
- SMS channel adapter
- Inbound webhook receivers

## G3 — REAL-TIME (Future)

- Cloudflare Durable Objects for live message delivery
- WebSocket connection management
- Presence indicators (online/typing)

## G4 — VOICE & VIDEO (Future)

- After G3 stability certification

## G5 — AI (Future)

- After platform audit

**Signed: LILCKY STUDIO LIMITED — 2026-06-02**
