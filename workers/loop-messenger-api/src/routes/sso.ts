// Loop Messenger API — RALD SSO Route
// POST /auth/rald-sso  { rald_token }
//
// Messenger is stateless w.r.t. user identity — the RALD JWT IS the session.
// The authMiddleware (lib/middleware.ts) accepts RALD tokens directly via Bearer.
// This endpoint just validates the token locally and returns the identity so
// the frontend knows who it's authenticated as.
//
// NO database writes — messenger_conversations/members use user_id from the JWT.
// LILCKY STUDIO LIMITED

import { Hono } from "hono";
import { AppContext } from "../lib/middleware";
import { verifyJwt } from "../lib/auth";

export const sso = new Hono<AppContext>();

sso.post("/auth/rald-sso", async (c) => {
  const body = await c.req.json<{ rald_token?: string }>().catch(() => ({}));
  if (!body.rald_token) {
    return c.json({ error: "rald_token is required" }, 400);
  }

  // Verify RALD JWT locally using the shared RALD_JWT_SECRET (no HTTP call — avoids CF 522)
  const rald = await verifyJwt(body.rald_token, c.env.RALD_JWT_SECRET);
  if (!rald) {
    return c.json({ error: "Invalid or expired RALD token" }, 401);
  }

  // Messenger is stateless — no user DB row needed.
  // The RALD token is used directly as Bearer for all subsequent API calls.
  // The authMiddleware verifies it on every request.
  return c.json({
    authenticated: true,
    user: {
      id:    rald.id,
      email: rald.email ?? null,
      role:  rald.role ?? "user",
    },
    token: body.rald_token,
    message: "Use the RALD token as Bearer for all Messenger API calls",
  });
});
