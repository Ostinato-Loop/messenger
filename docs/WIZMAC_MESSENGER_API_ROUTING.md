# WIZMAC — Messenger API Hono Sub-router Auth Scoping

**Repo:** `messenger`  
**Path:** `workers/loop-messenger-api/src/routes/`  
**Fixed:** 2026-06-04 — Phase H Hardening Sprint  

---

## What Is

The Loop Messenger CF Worker is a Hono v4 application deployed at `messenger.rald.cloud`.
It uses **sub-routers** (one per resource) mounted at the root path `"/"` via
`app.route("/", subRouter)`.

All conversation resource routes require authentication. Before this fix, each
sub-router registered its auth middleware with a wildcard path:

```ts
conversations.use("*", authMiddleware, workspaceMiddleware);
```

After the fix, the path is scoped correctly:

```ts
// conversations.ts — covers GET/POST /conversations AND /conversations/:id/*
conversations.use("/conversations",   authMiddleware, workspaceMiddleware);
conversations.use("/conversations/*", authMiddleware, workspaceMiddleware);

// messages / reactions / members / assignments / attachments
// (all routes are nested: /conversations/:id/something — /* is sufficient)
messages.use("/conversations/*",     authMiddleware, workspaceMiddleware);
reactions.use("/conversations/*",    authMiddleware, workspaceMiddleware);
members.use("/conversations/*",      authMiddleware, workspaceMiddleware);
assignments.use("/conversations/*",  authMiddleware, workspaceMiddleware);
attachments.use("/conversations/*",  authMiddleware, workspaceMiddleware);
```

---

## Why

Two distinct bugs were present:

### Bug 1 — Wildcard bled into root path (`GET /` → 401)

Hono sub-routers mounted at `"/"` share the parent app's path namespace.
A sub-router middleware `*.use("*", handler)` is equivalent to `app.use("/*", handler)`,
which intercepts **every** path — including `GET /` — before the parent's root handler fires.

```
Request: GET /
1. cors ✓
2. dbMiddleware ✓
3. sso router       → no match
4. health router    → no match
5. conversations.use("*", authMiddleware) → ❌ 401  ← BUG — root handler never reached
```

### Bug 2 — Hono v4 `path*` doesn't match the bare prefix (`GET /conversations` → 500)

In Hono v4, the pattern `"/conversations*"` does **not** match the exact path `/conversations`
(zero characters after the prefix). As a result, `GET /conversations` bypassed the auth
middleware entirely, fell through to the route handler, and crashed when it called
`c.get("user").id` on the unset variable — producing HTTP 500.

The correct Hono v4 patterns are:
- `"/conversations"` — exact path (matches `GET /conversations` and `POST /conversations`)  
- `"/conversations/*"` — wildcard sub-paths (matches `/conversations/:id` and deeper)  

---

## Mechanics

### Final middleware registration per sub-router

| Router       | Middleware line(s)                                                                 |
|--------------|-----------------------------------------------------------------------------------|
| conversations | `use("/conversations", auth, ws)` + `use("/conversations/*", auth, ws)`           |
| messages      | `use("/conversations/*", auth, ws)` — all paths are `/conversations/:id/messages` |
| reactions     | `use("/conversations/*", auth, ws)`                                                |
| members       | `use("/conversations/*", auth, ws)`                                                |
| assignments   | `use("/conversations/*", auth, ws)`                                                |
| attachments   | `use("/conversations/*", auth, ws)`                                                |

### Public endpoints (no auth required)

| Method | Path               | Handler         |
|--------|--------------------|-----------------|
| GET    | `/`                | service info    |
| GET    | `/health`          | health check    |
| GET    | `/healthz`         | k8s probe       |
| GET    | `/version`         | version info    |
| GET    | `/ready`           | readiness probe |
| POST   | `/auth/rald-sso`   | RALD token exchange |
| GET    | `/auth/silent`     | cookie-based silent session check |

### Auth-gated endpoints (`Authorization: Bearer <RALD_JWT>` + `X-Workspace-ID`)

All paths starting with `/conversations` or `/conversations/*`.

### Verified endpoint responses (post-fix)

```
GET /               → 200 ✅ (service info JSON)
GET /health         → 200 ✅
GET /healthz        → 200 ✅
GET /ready          → 200 ✅
GET /version        → 200 ✅
GET /auth/silent    → 401 ✅ (no cookie → {"valid":false,"reason":"no_session_cookie"})
POST /auth/rald-sso → 400 ✅ (no token → {"error":"rald_token is required"})
GET /conversations  → 401 ✅ (no auth → {"error":"Unauthorized"})
GET /conversations  → 401 ✅ (bad token → {"error":"Unauthorized"})
```

---

## Architecture

```
messenger.rald.cloud  (Cloudflare Worker — pure JSON API, Hono v4.7.11)
│
├── cors (*)
├── dbMiddleware (*)
│
├── sso router    → /auth/rald-sso, /auth/silent        [PUBLIC]
├── health router → /health, /healthz, /version, /ready [PUBLIC]
│
├── conversations → use("/conversations") + use("/conversations/*")  [AUTH]
├── messages      → use("/conversations/*")                          [AUTH]
├── reactions     → use("/conversations/*")                          [AUTH]
├── members       → use("/conversations/*")                          [AUTH]
├── assignments   → use("/conversations/*")                          [AUTH]
├── attachments   → use("/conversations/*")                          [AUTH]
│
└── GET /  → service info JSON                          [PUBLIC]
```

The Messenger frontend SPA is a **separate deployment** (Cloudflare Pages).
`messenger.rald.cloud` is a pure JSON API — it does NOT serve HTML or static files.

---

## Caveats

1. **Hono v4 wildcard semantics differ from v3.** In v4, `/path*` does NOT match
   `/path` exactly (requires at least one trailing character). Always pair the
   exact path with the wildcard: `use("/path", handler); use("/path/*", handler)`.

2. **`/auth/silent` 401 is correct behavior.** It returns
   `{"valid":false,"reason":"no_session_cookie"} [401]` when no `rald_session`
   cookie is present. Frontends treat this as "user is not logged in."

3. **Loop CF Worker is not affected.** `loop-api.rald.cloud` mounts sub-routers at
   explicit prefixes (`app.route("/api/rooms", rooms)`) and uses per-route inline
   `requireAuth()`, so the wildcard bleed class of bug cannot occur there.

4. **Re-deploy triggers automatically** from CI on push to `main` for this worker.
