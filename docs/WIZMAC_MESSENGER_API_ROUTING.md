# WIZMAC — Messenger API Hono Sub-router Auth Scoping

**Repo:** `messenger`  
**Path:** `workers/loop-messenger-api/src/routes/`  
**Fixed:** 2026-06-04 — Phase H Hardening Sprint  

---

## What Is

The Loop Messenger CF Worker is a Hono application deployed at `messenger.rald.cloud`.
It uses **sub-routers** (one per resource) mounted at the root path `"/"` via
`app.route("/", subRouter)`.

All conversation resource routes require authentication. Before this fix, each
sub-router registered its auth middleware with a wildcard path:

```ts
conversations.use("*", authMiddleware, workspaceMiddleware);
```

After the fix, the path is scoped to conversation URLs only:

```ts
conversations.use("/conversations*", authMiddleware, workspaceMiddleware);
```

Affected sub-routers: `conversations`, `messages`, `reactions`, `members`,
`assignments`, `attachments`.

---

## Why

Hono sub-routers mounted at `"/"` share the same path namespace as the parent
app. A sub-router middleware registered with `"*"` runs for **every** request
that reaches that sub-router — including paths the sub-router has no explicit
handler for.

Because Hono evaluates middleware and routes in registration order, the
conversations sub-router's `"*"` middleware intercepted `GET /` and any other
unmatched path **before** the parent app's root handler could fire:

```
Request: GET /
1. cors ✓ (pass-through)
2. dbMiddleware ✓ (pass-through)
3. sso router → no match for GET /
4. health router → no match for GET /
5. conversations.use("*", authMiddleware) → ❌ 401 Unauthorized  ← BUG
   (root handler never reached)
```

This caused `GET /` (the service-info JSON) to return 401 for any unauthenticated
request, making the API appear completely inaccessible to monitoring, load
balancers, health checks, and the Messenger frontend on initial load.

---

## Mechanics

### Fix

Change the middleware path in all 6 sub-routers from `"*"` to `"/conversations*"`:

| File             | Before                                          | After                                                |
|------------------|-------------------------------------------------|------------------------------------------------------|
| conversations.ts | `conversations.use("*", authMiddleware, ...)`   | `conversations.use("/conversations*", authMiddleware, ...)` |
| messages.ts      | `messages.use("*", authMiddleware, ...)`        | `messages.use("/conversations*", authMiddleware, ...)` |
| reactions.ts     | `reactions.use("*", authMiddleware, ...)`       | `reactions.use("/conversations*", authMiddleware, ...)` |
| members.ts       | `members.use("*", authMiddleware, ...)`         | `members.use("/conversations*", authMiddleware, ...)` |
| assignments.ts   | `assignments.use("*", authMiddleware, ...)`     | `assignments.use("/conversations*", authMiddleware, ...)` |
| attachments.ts   | `attachments.use("*", authMiddleware, ...)`     | `attachments.use("/conversations*", authMiddleware, ...)` |

### Why `/conversations*` (not `/conversations/*`)

- `/conversations*` matches both `GET /conversations` (no trailing slash — list endpoint)
  and `GET /conversations/:id` (parameterized paths).
- `/conversations/*` would miss `GET /conversations` exactly.

### Public endpoints (no auth required)

| Method | Path               | Handler         |
|--------|--------------------|-----------------|
| GET    | `/`                | root info JSON  |
| GET    | `/health`          | health check    |
| GET    | `/healthz`         | k8s probe       |
| GET    | `/version`         | version info    |
| GET    | `/ready`           | readiness probe |
| POST   | `/auth/rald-sso`   | token exchange  |
| GET    | `/auth/silent`     | cookie session  |

### Auth-gated endpoints (require `Authorization: Bearer <RALD_JWT>`)

All `/conversations*` paths require auth + `X-Workspace-ID` header.

---

## Architecture

```
messenger.rald.cloud  (Cloudflare Worker — pure JSON API)
│
├── cors (*)
├── dbMiddleware (*)
│
├── sso router       → /auth/rald-sso, /auth/silent        [PUBLIC]
├── health router    → /health, /healthz, /version, /ready [PUBLIC]
│
├── conversations    → /conversations*   [auth + workspace middleware]
├── messages         → /conversations*   [auth + workspace middleware]
├── reactions        → /conversations*   [auth + workspace middleware]
├── members          → /conversations*   [auth + workspace middleware]
├── assignments      → /conversations*   [auth + workspace middleware]
├── attachments      → /conversations*   [auth + workspace middleware]
│
└── GET /            → service info JSON [PUBLIC — root handler]
```

The Messenger frontend SPA is a **separate deployment** (Cloudflare Pages).
`messenger.rald.cloud` is a pure API — it does not serve HTML.

---

## Caveats

1. **Re-deploy required.** The fix is in source on GitHub. The live CF Worker
   at `messenger.rald.cloud` will serve the old code until a `wrangler deploy`
   is triggered from CI or manually.

2. **Hono sub-router wildcard semantics.** When using `app.route("/", subRouter)`,
   any `subRouter.use("*", handler)` becomes effectively global middleware for
   the parent app. Always scope middleware to the actual path prefix the router
   manages. Prefer `app.use("/resource*", handler)` at the parent level, or
   `subRouter.use("/resource*", handler)` within the sub-router.

3. **Loop CF Worker is not affected.** The Loop API Worker
   (`loop-api.rald.cloud`) mounts routers at explicit paths
   (`app.route("/api/rooms", rooms)`) and uses per-route inline middleware
   (`requireAuth()`), so this class of bug does not apply.

4. **`/auth/silent` 401 is correct.** `GET /auth/silent` with no `rald_session`
   cookie returns `{"valid":false,"reason":"no_session_cookie"} [401]`. This is
   the intended contract — the frontend interprets it as "user not logged in".
