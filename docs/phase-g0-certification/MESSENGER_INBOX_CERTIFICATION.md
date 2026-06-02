# MESSENGER_INBOX_CERTIFICATION.md
**Phase:** G.0 Foundation Certification  
**Owner:** LILCKY STUDIO LIMITED  
**Date:** 2026-06-02

---

## 1. REQUIREMENT

Messenger must consume `rald-inbox`. It must NOT create a separate inbox architecture.

---

## 2. INTEGRATION DESIGN

Loop Messenger registers as the `loop_messenger` channel adapter in `rald-inbox`. This means:

- Customer conversations initiated via Messenger appear in the agent Unified Inbox
- Agents can respond from the Inbox or from the Messenger interface
- Conversation state is synced: `messenger_conversations` → `conversations` (rald-inbox) via the channel adapter

### 2.1 Channel Registration

```json
POST inbox.rald.cloud/api/channel-registry
{
  "channel_type": "loop_messenger",
  "display_name": "Loop Messenger",
  "base_url": "https://messenger.rald.cloud",
  "adapter_version": "1.0.0"
}
```

### 2.2 Inbound Message Flow (Customer → Inbox)
```
Customer sends message → Messenger Worker
  → Creates messenger_messages record
  → Posts to rald-inbox channel adapter: POST inbox.rald.cloud/api/inbound
  → rald-inbox creates/updates conversation record
  → Agent sees conversation in Unified Inbox
```

### 2.3 Outbound Message Flow (Agent → Customer via Inbox)
```
Agent replies in Inbox → rald-inbox
  → Calls Messenger channel adapter: POST messenger.rald.cloud/api/outbound
  → Messenger creates messenger_messages record
  → Delivers to customer
```

---

## 3. TABLES NOT CREATED

| Table | Status |
|---|---|
| `messenger_inbox` | ❌ Not created — rald-inbox is the inbox |
| `messenger_inbox_views` | ❌ Not created |
| `messenger_inbox_assignments` | ❌ Not created (uses `messenger_conversation_assignments`) |

**Distinction:** `messenger_conversation_assignments` is for P2P/team messaging assignment. Agent Inbox assignments are owned by `rald-inbox`.

---

## 4. CERTIFICATION RESULT

```
╔══════════════════════════════════════════════════════════════╗
║  MESSENGER_INBOX_CERTIFICATION = PASS                        ║
║  loop_messenger registered as rald-inbox channel adapter    ║
║  No duplicate inbox architecture · Both flows defined       ║
╚══════════════════════════════════════════════════════════════╝
```

**Signed: LILCKY STUDIO LIMITED — 2026-06-02**
