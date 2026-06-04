// Loop Messenger API — Cloudflare Worker
// Deployed at: messenger.rald.cloud | Version: 1.2.0
// Phase G1 — Foundation + G.12 RALD SSO + G.13 Consumer API (/api prefix)
// LILCKY STUDIO LIMITED
//
// Routes are mounted at BOTH / and /api:
//  /          → business API clients sending X-Workspace-ID
//  /api       → Loop Messenger SPA (generated client with orval baseUrl="/api")
//
// This dual-mount means no changes are needed in the frontend build config.

import { Hono } from "hono";
import { cors } from "hono/cors";
import { AppContext, dbMiddleware } from "./lib/middleware";
import { health } from "./routes/health";
import { conversations } from "./routes/conversations";
import { messages } from "./routes/messages";
import { reactions } from "./routes/reactions";
import { members } from "./routes/members";
import { assignments } from "./routes/assignments";
import { attachments } from "./routes/attachments";
import { sso } from "./routes/sso";
import { users } from "./routes/users";
import { search } from "./routes/search";

const VERSION = "1.2.0";

const app = new Hono<AppContext>();

app.use("*", cors({
  origin: [
    "https://rald.cloud",
    "https://app.rald.cloud",
    "https://messenger.rald.cloud",
    "https://loop.rald.cloud",
    "https://sv.rald.cloud",
    "https://business.rald.cloud",
    "https://admin.rald.cloud",
    "https://control.rald.cloud",
    "https://profiles.rald.cloud",
    "https://loop-messenger.pages.dev",
    "https://rald-control-center.pages.dev",
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:3001",
  ],
  allowHeaders: ["Authorization", "Content-Type", "X-Workspace-ID", "X-Request-ID"],
  allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  credentials: true,
}));

app.use("*", dbMiddleware);

// ── Mount at / (direct API, backward compat) ──────────────────────────────
app.route("/", sso);
app.route("/", health);
app.route("/", conversations);
app.route("/", messages);
app.route("/", reactions);
app.route("/", members);
app.route("/", assignments);
app.route("/", attachments);
app.route("/", users);
app.route("/", search);

// ── Mount at /api (Loop Messenger SPA — generated client uses baseUrl="/api") ─
// Each sub-router's internal middleware paths (e.g. "/conversations") are
// relative to the mount point, so they correctly guard /api/conversations.
app.route("/api", sso);
app.route("/api", health);
app.route("/api", conversations);
app.route("/api", messages);
app.route("/api", reactions);
app.route("/api", members);
app.route("/api", assignments);
app.route("/api", attachments);
app.route("/api", users);
app.route("/api", search);

// ── Root info ─────────────────────────────────────────────────────────────
app.get("/", (c) =>
  c.json({
    service:     "Loop Messenger API",
    version:     VERSION,
    phase:       "G1 + G.12 SSO + G.13 Consumer /api prefix",
    owner:       "LILCKY STUDIO LIMITED",
    deployed_at: "messenger.rald.cloud",
    endpoints: {
      sso:            "POST /auth/rald-sso",
      me:             "GET  /auth/me",
      silent:         "GET  /auth/silent",
      health:         "GET  /health",
      userSearch:     "GET  /users/search?q=",
      user:           "GET  /users/:id",
      conversations:  "GET|POST /conversations",
      conversation:   "GET|PATCH|DELETE /conversations/:id",
      convStats:      "GET  /conversations/stats",
      convRead:       "POST /conversations/:id/read",
      messages:       "GET|POST /conversations/:id/messages",
      message:        "PATCH|DELETE /conversations/:id/messages/:msgId",
      reactions:      "GET|POST /conversations/:id/messages/:msgId/reactions",
      members:        "GET|POST /conversations/:id/members",
      assignments:    "GET|POST /conversations/:id/assignments",
      attachments:    "GET|POST /conversations/:id/attachments",
    },
    note: "All routes also available under /api/* for SPA client compatibility.",
    timestamp: new Date().toISOString(),
  })
);

app.notFound((c) => c.json({ error: "Not found", path: c.req.path }, 404));
app.onError((err, c) => {
  console.error("[messenger] error:", err.message);
  return c.json({ error: "Internal server error" }, 500);
});

export default {
  async fetch(req: Request, env: Bindings, ctx: ExecutionContext): Promise<Response> {
    // ── FAIL FAST — exit 503 if critical secrets missing ─────────────────────
    const missing: string[] = [];
    if (!env.RALD_JWT_SECRET)           missing.push("RALD_JWT_SECRET");
    if (!env.SUPABASE_URL)              missing.push("SUPABASE_URL");
    if (!env.SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
    if (missing.length) {
      console.error("[FATAL] loop-messenger-api: missing secrets:", missing.join(", "));
      return new Response(
        JSON.stringify({ error: "Service misconfigured", missing, service: "loop-messenger-api" }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }
    return app.fetch(req, env, ctx);
  },
};
