// Loop Messenger — Health Routes
// LILCKY STUDIO LIMITED

import { Hono } from "hono";
import { AppContext } from "../lib/middleware";

const VERSION = "1.0.0";

export const health = new Hono<AppContext>();

health.get("/health", (c) =>
  c.json({
    status:      "ok",
    service:     "loop-messenger-api",
    version:     VERSION,
    environment: c.env.ENVIRONMENT ?? "production",
    owner:       "LILCKY STUDIO LIMITED",
    timestamp:   new Date().toISOString(),
  })
);

health.get("/healthz", (c) => c.json({ status: "ok" }));

health.get("/version", (c) =>
  c.json({ service: "loop-messenger-api", version: VERSION })
);

health.get("/ready", (c) =>
  c.json({
    ready: !!(c.env.RALD_JWT_SECRET && c.env.SUPABASE_URL && c.env.SUPABASE_SERVICE_ROLE_KEY),
    checks: {
      jwt:      !!c.env.RALD_JWT_SECRET,
      supabase: !!c.env.SUPABASE_URL && !!c.env.SUPABASE_SERVICE_ROLE_KEY,
      notify:   !!c.env.NOTIFY_URL,
      search:   !!c.env.SEARCH_URL,
      crm:      !!c.env.CRM_URL,
    },
  })
);
