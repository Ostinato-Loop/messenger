# MESSENGER_NOTIFICATION_CERTIFICATION.md
**Phase:** G.0 Foundation Certification  
**Owner:** LILCKY STUDIO LIMITED  
**Date:** 2026-06-02

---

## 1. REQUIREMENT

Messenger must integrate with `rald-notify`. It must NOT create notification infrastructure.

---

## 2. INTEGRATION DESIGN

Messenger calls `rald-notify` for these events:

| Trigger | Notification Type | Channel |
|---|---|---|
| New message (not sender) | `new_message` | In-app + push |
| @mention in message | `mention` | In-app + push + email |
| Conversation assigned to agent | `assignment` | In-app + email |
| Conversation escalated | `escalation` | In-app + email + SMS |

Implementation: `POST notification.rald.cloud/notifications` with:
```json
{
  "workspace_id": "<uuid>",
  "type": "new_message",
  "recipient_id": "<user_id>",
  "template_id": "messenger_new_message",
  "data": {
    "conversation_id": "<uuid>",
    "sender_name": "John",
    "preview": "Hello..."
  }
}
```

Calls are non-blocking: `c.executionCtx.waitUntil(notifyNewMessage(...))`.

---

## 3. TABLES NOT CREATED

| Table | Status |
|---|---|
| `messenger_notification_templates` | ❌ Not created — uses rald-notify templates |
| `messenger_deliveries` | ❌ Not created — tracked in rald-notify |
| `messenger_notification_channels` | ❌ Not created |
| `messenger_preferences` | ❌ Not created — tracked in rald-notify preferences |

---

## 4. CERTIFICATION RESULT

```
╔══════════════════════════════════════════════════════════════╗
║  MESSENGER_NOTIFICATION_CERTIFICATION = PASS                 ║
║  rald-notify consumed via HTTP · No duplicate infra         ║
║  4 trigger types defined · Non-blocking execution           ║
╚══════════════════════════════════════════════════════════════╝
```

**Signed: LILCKY STUDIO LIMITED — 2026-06-02**
