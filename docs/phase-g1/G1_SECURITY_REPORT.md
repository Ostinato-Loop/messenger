# G1_SECURITY_REPORT.md
**Phase:** G1 — Loop Messenger Foundation  
**Owner:** LILCKY STUDIO LIMITED  
**Date:** 2026-06-02

---

## 1. AUTHENTICATION SECURITY

| Check | Implementation | Status |
|---|---|---|
| JWT algorithm: HS256 (Web Crypto HMAC-SHA256) | `verifyJwt()` in lib/auth.ts | ✅ |
| Expiry enforced | `payload.exp < Date.now()/1000 → null → 401` | ✅ |
| Missing auth header → 401 | `authMiddleware` exits immediately | ✅ |
| Missing X-Workspace-ID → 400 | `workspaceMiddleware` exits immediately | ✅ |
| Non-member access to conversation → 404 | `conversationAccessMiddleware` | ✅ |
| Shared secret: `RALD_JWT_SECRET` CF binding | Worker secret — never in source code | ✅ |

---

## 2. WORKSPACE ISOLATION

| Attack Vector | Protection |
|---|---|
| User queries another workspace's conversations | `workspace_id` from header; all queries `.eq("workspace_id", workspaceId)` |
| Forged workspace_id in request body | Body workspace_id ignored — middleware value is authoritative |
| Cross-workspace member addition | `workspaceId` from middleware on all member inserts |
| Cross-workspace message read | `conversationAccessMiddleware` verifies membership in correct workspace |

---

## 3. CONVERSATION ACCESS CONTROL

`conversationAccessMiddleware` verifies the requesting user is an active member (`left_at IS NULL`) of the conversation before any data is returned or modified.

```
Request → authMiddleware → workspaceMiddleware → conversationAccessMiddleware → route handler
          (JWT valid)       (WS-ID present)       (member of conversation)
```

---

## 4. RBAC ENFORCEMENT

| Operation | Minimum Role |
|---|---|
| Read messages/members/reactions | `member` (any active member) |
| Send message | `member` |
| Add/remove members | `admin` or `owner` |
| Update conversation | `admin` or `owner` |
| Delete conversation | `owner` only |
| Edit own message | Sender ID match |
| Delete own message | Sender ID match |
| Delete any message | `admin` or `owner` |
| Create assignment | `admin` or `owner` |

---

## 5. SOFT DELETE INTEGRITY

- Messages: `deleted_at` set, `content` nulled in DB and responses
- Conversations: `deleted_at` set, `status: "closed"`
- Reactions and audit records preserved
- Status records preserved (read receipt history)
- All soft-deleted records excluded from default queries (`IS NULL deleted_at` filters)

---

## 6. AUDIT TRAIL

22 actions logged to `messenger_audit_log`:

`conversation.created` · `conversation.updated` · `conversation.archived` · `conversation.deleted` · `message.sent` · `message.edited` · `message.deleted` · `reaction.added` · `reaction.removed` · `member.added` · `member.removed` · `member.role_changed` · `member.left` · `assignment.created` · `assignment.removed` · `attachment.uploaded` · `conversation.customer_linked` · `conversation.inbox_sync` · `search.indexed` · `notification.triggered` · `member.muted` · `member.archived`

All audit writes are non-blocking (`c.executionCtx.waitUntil()`). Failures are logged but do not affect user response.

---

## 7. SECRETS POSTURE

| Secret | Location | Access Pattern |
|---|---|---|
| `RALD_JWT_SECRET` | CF Worker Secret | Runtime binding — never logged |
| `SUPABASE_URL` | CF Worker Secret | Runtime binding |
| `SUPABASE_SERVICE_ROLE_KEY` | CF Worker Secret | Runtime binding — never in source |
| `NOTIFY_URL` | `[vars]` (wrangler.toml) | Non-secret URL |
| `SEARCH_URL` | `[vars]` | Non-secret URL |
| `CRM_URL` | `[vars]` | Non-secret URL |

No secrets committed to source code. ✅

---

## 8. SECURITY FINDINGS

| ID | Severity | Finding | Fix | Effort |
|---|---|---|---|---|
| G1-SEC-01 | LOW | Attachment storage_key not validated — client provides key without server verification | Validate against CF R2 in G2 | 1 day |
| G1-SEC-02 | LOW | No rate limiting on message send endpoint | Wire RATE_LIMIT_KV in G2 | 1 day |
| G1-SEC-03 | INFO | Polling-only delivery model — no push for real-time security | G3 Durable Objects | N/A |

**CRITICAL: 0 · HIGH: 0 · MEDIUM: 0 · LOW: 2 · INFO: 1**

**Signed: LILCKY STUDIO LIMITED — 2026-06-02**
