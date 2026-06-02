// Loop Messenger API — Cloudflare Worker
// Deployed at: messenger.rald.cloud | Version: 1.0.0
// Phase G1 — Foundation Implementation
// LILCKY STUDIO LIMITED

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

const VERSION = "1.0.0";

const app = new Hono<AppContext>();

// ── CORS ─────────────────────────────────────────────────────────────────────
app.use("*", cors({
  origin: [
    "https://rald.cloud",
    "https://app.rald.cloud",
    "https://messenger.rald.cloud",
    "https://loop.rald.cloud",
    "https://business.rald.cloud",
    "https://admin.rald.cloud",
    "https://control.rald.cloud",
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

// ── Supabase client per request ───────────────────────────────────────────────
app.use("*", dbMiddleware);

// ── Routes ────────────────────────────────────────────────────────────────────
app.route("/", health);
app.route("/", conversations);
app.route("/", messages);
app.route("/", reactions);
app.route("/", members);
app.route("/", assignments);
app.route("/", attachments);

// ── Root ──────────────────────────────────────────────────────────────────────
app.get("/", (c) =>
  c.json({
    service:     "Loop Messenger API",
    version:     VERSION,
    phase:       "G1 — Foundation",
    owner:       "LILCKY STUDIO LIMITED",
    deployed_at: "messenger.rald.cloud",
    endpoints: {
      health:        "GET /health",
      conversations: "GET|POST /conversations",
      conversation:  "GET|PATCH|DELETE /conversations/:id",
      messages:      "GET|POST /conversations/:id/messages",
      message:       "PATCH|DELETE /conversations/:id/messages/:msgId",
      status:        "PATCH /conversations/:id/messages/:msgId/status",
      reactions:     "GET|POST /conversations/:id/messages/:msgId/reactions",
      reaction:      "DELETE /conversations/:id/messages/:msgId/reactions/:emoji",
      members:       "GET|POST /conversations/:id/members",
      member:        "PATCH|DELETE /conversations/:id/members/:userId",
      assignments:   "GET|POST /conversations/:id/assignments",
      attachments:   "GET|POST /conversations/:id/attachments",
    },
    timestamp: new Date().toISOString(),
  })
);

app.notFound((c) => c.json({ error: "Not found", path: c.req.path }, 404));
app.onError((err, c) => {
  console.error("[messenger] error:", err.message);
  return c.json({ error: "Internal server error" }, 500);
});

export default app;
