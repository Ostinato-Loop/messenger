# MESSENGER_SEARCH_CERTIFICATION.md
**Phase:** G.0 Foundation Certification  
**Owner:** LILCKY STUDIO LIMITED  
**Date:** 2026-06-02

---

## 1. REQUIREMENT

Messenger must integrate with `rald-search`. It must NOT create search infrastructure.

---

## 2. INTEGRATION DESIGN

Messenger indexes into `rald-search` after message events:

| Content | Index Entity | Search Fields |
|---|---|---|
| Conversation title | `conversations` | title, type, status |
| Message content | `messages` | content, sender_id, conversation_id |
| Participants | `users` | user_id, display_name |
| Customer-linked conversations | `customers` | customer_id, customer_name |

**Write path:** After message send → `POST search.rald.cloud/index`  
**Read path:** Frontend calls `GET search.rald.cloud/search?q=<query>&workspace_id=<id>`

---

## 3. TABLES NOT CREATED

| Table | Status |
|---|---|
| `messenger_search_index` | ❌ Not created — rald-search owns all indexes |
| `messenger_full_text_vectors` | ❌ Not created |

---

## 4. CERTIFICATION RESULT

```
╔══════════════════════════════════════════════════════════════╗
║  MESSENGER_SEARCH_CERTIFICATION = PASS                       ║
║  rald-search consumed via HTTP · No duplicate infra         ║
║  4 entity types indexed · Non-blocking write path           ║
╚══════════════════════════════════════════════════════════════╝
```

**Signed: LILCKY STUDIO LIMITED — 2026-06-02**
