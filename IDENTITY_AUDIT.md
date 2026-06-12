# Messenger — Identity Audit Report
**Audit date:** 2026-06-15  
**Sprint:** Public Beta Hardening — Task 11: Audit Every Service for Direct Identity Logic  
**Authority:** Principal Platform Engineer · RALD Platform Engineering · LILCKY STUDIO LIMITED

---

## FINDING: CRITICAL IDENTITY GAP

Messenger maintains a **completely separate identity system** that does not use RALD identity. This is the largest identity gap in the ecosystem.

---

## CURRENT STATE (as-audited)

### Auth Model
- **Framework:** Express + express-session (cookie-based sessions, `userId` integer in session)
- **User store:** Local PostgreSQL table `usersTable` via Drizzle ORM
- **Schema:** `usersTable = { id: serial, phone: text, displayName: text, createdAt: timestamp }`
- **OTP flow:** Phone → generate OTP locally → send via Termii → verify code → upsert row in `usersTable` → set `req.session.userId`
- **No RALD JWT:** Token is never verified. No `RALD_JWT_SECRET`, no `Authorization: Bearer` header parsing.

### Auth routes (`artifacts/api-server/src/routes/auth.ts`)
| Route | Behaviour |
|---|---|
| `POST /auth/send-otp` | Generates local OTP, sends via Termii, stores in `otpRequestsTable` |
| `POST /auth/verify-otp` | Verifies local OTP, upserts `usersTable`, sets `session.userId` |
| `GET /auth/me` | Reads `session.userId`, queries `usersTable` |
| `POST /auth/signout` | Destroys Express session |

### Identity isolation
```
RALD identity (auth.rald.cloud)        Messenger identity (messenger.rald.cloud)
─────────────────────────────────      ─────────────────────────────────────────
auth_users table (UUID pk)             usersTable (integer pk serial)
RALD JWT (HS256, RALD_JWT_SECRET)      express-session (cookie sessionId)
rald_address = RALD-XXXXXXX            No RALD address
username claims                        displayName field only
trust scores, verification             None
device registry (auth_devices)         None
```

A user who signs into Messenger is **a completely different identity** than their RALD identity. There is no linkage. If the same phone number exists in both systems, the `id` values are different (UUID in RALD, integer in Messenger), causing cross-service identity mismatches.

---

## RISK ASSESSMENT

| Risk | Severity | Detail |
|---|---|---|
| Cross-app identity mismatch | **Critical** | A RALD user sending a DM from Loop cannot be matched to a Messenger user — different UUIDs |
| Duplicate OTP spend | High | Same phone triggers OTP in both RALD Auth + Messenger Auth independently |
| Session isolation | High | Logging out of RALD does not log out of Messenger |
| No trust/verification propagation | Medium | RALD trust scores and verification badges not available in Messenger |
| Audit trail gap | Medium | Messenger user activity not visible in RALD identity audit stream |
| No device registry | Low | No `auth_devices` row in RALD for messenger sessions |

---

## REMEDIATION PLAN

### Phase 1 — SSO Bridge (Beta-safe, additive — ~1 week)
Add a RALD SSO endpoint to Messenger alongside the existing phone-OTP flow. This is additive — no existing sessions break.

**New route:** `POST /api/auth/rald-sso` (matches the Loop pattern)
```typescript
// 1. Accept { rald_token } in request body
// 2. Verify the RALD JWT using RALD_JWT_SECRET
// 3. Upsert Messenger user row from RALD identity (UUID as string id, not serial)
// 4. Set express-session (short-term) OR issue a Messenger-scoped JWT
// 5. Return { access_token, user }
```

**Schema change:** Add `rald_id TEXT UNIQUE` column to `usersTable` for the RALD UUID linkage.

**Wrangler secret to add:** `RALD_JWT_SECRET` (same value as rald-auth-core).

### Phase 2 — Session Migration (~2 weeks)
Migrate the Messenger session model from Express sessions to RALD JWT bearer tokens. All protected routes switch from `requireSession(req)` to `requireAuth(req, RALD_JWT_SECRET)`.

**Tables to migrate:**
- `usersTable` → retire after backfill to RALD identity
- `otpRequestsTable` → retire; OTP sent by RALD Auth, not Messenger

### Phase 3 — Full Identity Consolidation (post-beta, ~1 month)
- Remove `usersTable` and `otpRequestsTable` entirely
- All user lookups: `WHERE rald_id = <uuid from JWT>`
- Messenger becomes a pure application layer; no identity storage

---

## IMMEDIATE ACTION (before beta)

Add `RALD_JWT_SECRET` to the Messenger worker secrets and add the SSO bridge route. This unblocks Loop → Messenger identity linking without requiring any migration of existing Messenger users.

```bash
# In messenger repo:
wrangler secret put RALD_JWT_SECRET
# Value: same as rald-auth-core RALD_JWT_SECRET
```

Then add `POST /api/auth/rald-sso` following the Loop pattern in `rald-sso.ts`.

---

## SERVICES WITH NO DIRECT IDENTITY LOGIC (clean)

| Service | Auth model | Status |
|---|---|---|
| `loop` | RALD SSO → Loop-scoped JWT (re-signed) | ✅ Clean after USN-002 fix |
| `rald-config` | Machine JWT via `/machine/auth` | ✅ Clean |
| `rald-event-bus` | Machine JWT via `/machine/auth` | ✅ Clean |
| `rald-search` | RALD JWT for user context | ✅ Clean |
| `rald-notify` | Machine JWT inbound only (no user store) | ✅ Clean |
| `rald-auth-core` | Canonical authority (this IS identity) | N/A |

---

*Identity audit produced by Public Beta Hardening Sprint · RALD Platform Engineering · LILCKY STUDIO LIMITED · 2026-06-15*
