# MESSENGER_WORKSPACE_CERTIFICATION.md
**Phase:** G.0 Foundation Certification  
**Owner:** LILCKY STUDIO LIMITED  
**Date:** 2026-06-02

---

## 1. WORKSPACE REQUIREMENTS

Messenger must:
- Respect workspace boundaries
- Respect RBAC
- Support multi-workspace users
- Support workspace switching

---

## 2. WORKSPACE ISOLATION IMPLEMENTATION

| Layer | Implementation |
|---|---|
| Every Messenger table has `workspace_id` | ✅ 8/8 tables |
| `X-Workspace-ID` header required on all requests | ✅ `workspaceMiddleware` returns 400 without it |
| JWT user ID is always `sender_id` — never spoofable | ✅ JWT `id` claim is authoritative |
| All DB queries include `.eq("workspace_id", workspaceId)` | ✅ Enforced in all routes |
| Cross-workspace conversation not possible | ✅ No join across workspace_id boundaries |

---

## 3. RBAC IN MESSENGER

| Role | Conversation Access | Message Access | Admin Operations |
|---|---|---|---|
| `owner` (workspace) | All conversations | All messages | ✅ |
| `admin` (workspace) | All conversations | All messages | ✅ |
| `member` (workspace) | Member conversations only | Member messages only | ❌ |
| `guest` (conversation) | Added conversation only | Added conversation only | ❌ |

Conversation-level roles (`conversation_members.role`):
- `owner` — created conversation, can delete and manage
- `admin` — can add/remove members
- `member` — default
- `guest` — external/limited

---

## 4. MULTI-WORKSPACE USER SUPPORT

A user may belong to multiple workspaces. Each API request targets one workspace via `X-Workspace-ID`. The client (frontend) is responsible for workspace selection per WORKSPACE_SWITCHER_STANDARD_v1.

Messenger enforces the workspace per request — it does not read the user's workspace list.

---

## 5. WORKSPACE SWITCHING

When a user switches workspaces on the frontend:
1. Frontend updates `localStorage("rald_workspace_id")`
2. Frontend updates `X-Workspace-ID` header on all subsequent API calls
3. Messenger API sees new workspace context with zero code changes

---

## 6. CERTIFICATION RESULT

```
╔══════════════════════════════════════════════════════════════╗
║  MESSENGER_WORKSPACE_CERTIFICATION = PASS                    ║
║  workspace_id on all 8 tables · RBAC enforced               ║
║  Multi-workspace supported · No workspace leaks             ║
╚══════════════════════════════════════════════════════════════╝
```

**Signed: LILCKY STUDIO LIMITED — 2026-06-02**
