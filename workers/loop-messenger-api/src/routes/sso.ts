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

function parseSessionCookie(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k?.trim() === 'rald_session') return v.join('=').trim() || null;
  }
  return null;
}

// GET /auth/silent — cookie-based silent session (Phase H, Identity Axiom)
// Called on app mount to check if the rald_session cookie gives a valid session.
sso.get('/auth/silent', async (c) => {
  const cookieHeader = c.req.header('Cookie');
  const token = parseSessionCookie(cookieHeader);
  if (!token) {
    return c.json({ valid: false, reason: 'no_session_cookie' }, 401);
  }
  const rald = await verifyJwt(token, c.env.RALD_JWT_SECRET);
  if (!rald) {
    return c.json({ valid: false, reason: 'invalid_or_expired_token' }, 401);
  }
  return c.json({
    valid: true,
    user: { id: rald.id, email: rald.email ?? null, role: rald.role ?? 'user' },
    token,
  });
});
