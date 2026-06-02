# MESSENGER_CUSTOMER_GRAPH_CERTIFICATION.md
**Phase:** G.0 Foundation Certification  
**Owner:** LILCKY STUDIO LIMITED  
**Date:** 2026-06-02

---

## 1. REQUIREMENT

Messenger conversations must link to `crm_customers`, `crm_customer_channels`, and `crm_customer_activity`. No duplicate customer tables are allowed.

---

## 2. INTEGRATION DESIGN

### 2.1 Conversation → Customer Link

`messenger_conversations.customer_id` is a nullable FK that references `crm_customers.id` in the `loop-crm` Supabase schema. When a customer conversation is created, the customer_id is stored — enabling the CRM to display the full conversation history.

### 2.2 Channel Resolution

When a message arrives from a customer channel (WhatsApp, SMS, email — Phase G+), the messenger worker:
1. Calls `GET crm.rald.cloud/channels/resolve?channel_type=<type>&channel_id=<id>`
2. Receives `{ customer_id, workspace_id }` or `{ notFound: true }`
3. If not found → creates new customer via `POST crm.rald.cloud/customers`
4. Links the conversation to the resolved `customer_id`

### 2.3 Activity Timeline

Every meaningful messenger event writes to the CRM customer timeline:

| Messenger Event | CRM Activity Type |
|---|---|
| Customer conversation created | `conversation_started` |
| Message sent to customer | `message_sent` |
| Conversation assigned | `conversation_assigned` |
| Conversation closed | `conversation_resolved` |

Implementation: `POST crm.rald.cloud/timeline` with `{ customer_id, activity_type, metadata }`

---

## 3. DUPLICATE PREVENTION

| Check | Status |
|---|---|
| No `messenger_customers` table | ✅ Verified — not in data model |
| No `messenger_contacts` table | ✅ Verified |
| No `messenger_channels` table | ✅ Verified |
| customer_id FK used | ✅ `messenger_conversations.customer_id` |

---

## 4. CERTIFICATION RESULT

```
╔══════════════════════════════════════════════════════════════╗
║  MESSENGER_CUSTOMER_GRAPH_CERTIFICATION = PASS               ║
║  customer_id FK on conversations · CRM API consumed         ║
║  No duplicate customer tables · Timeline events planned     ║
╚══════════════════════════════════════════════════════════════╝
```

**Signed: LILCKY STUDIO LIMITED — 2026-06-02**
