// Loop Messenger API — RALD SSO Route
// POST /auth/rald-sso  { rald_token }
// Validates the inbound RALD token via POST auth.rald.cloud/sso/verify
// (server-to-server, no authMiddleware on the auth server side).
// Creates/finds the Messenger user record and confirms the token is
// usable for all subsequent API calls as a Bearer token.
// LILCKY STUDIO LIMITED

import { Hono } from "hono";
import { AppContext } from "../lib/middleware";

const RALD_AUTH_DEFAULT = "https://auth.rald.cloud";

export const sso = new Hono<AppContext>();

sso.post("/auth/rald-sso", async (c) => {
  const body = await c.req.json<{ rald_token?: string }>().catch(() => ({}));
  if (!body.rald_token) {
    return c.json({ error: "rald_token is required" }, 400);
  }

  const raldAuthUrl = (c.env.RALD_AUTH_URL as string | undefined) ?? RALD_AUTH_DEFAULT;

  // Validate via POST /sso/verify — no authMiddleware, pure JWT verification
  let verifyRes: Response;
  try {
    verifyRes = await fetch(`${raldAuthUrl}/sso/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: body.rald_token }),
    });
  } catch (err) {
    console.error("[messenger-sso] sso/verify fetch error:", err);
    return c.json({ error: "Auth service unreachable" }, 502);
  }

  if (!verifyRes.ok) {
    return c.json({ error: "Invalid or expired RALD token" }, 401);
  }

  const verifyData = await verifyRes.json() as {
    valid: boolean;
    user?: {
      id: string;
      email?: string;
      phone?: string;
      name?: string | null;
      role?: string;
    };
  };

  if (!verifyData.valid || !verifyData.user) {
    return c.json({ error: "Invalid or expired RALD token" }, 401);
  }

  const raldUser = verifyData.user;
  const db = c.get("db");

  // Upsert user in Messenger's Supabase user table
  const phone = raldUser.phone ?? null;
  const email = raldUser.email ?? null;

  const { data: existing } = await db
    .from("users")
    .select("id, phone, email")
    .or(
      [
        raldUser.id ? `rald_id.eq.${raldUser.id}` : null,
        phone       ? `phone.eq.${phone}`          : null,
        email       ? `email.eq.${email}`          : null,
      ].filter(Boolean).join(",")
    )
    .limit(1);

  let userId: string;

  if (existing && existing.length > 0) {
    userId = existing[0].id;
    // Keep rald_id in sync
    await db
      .from("users")
      .update({ rald_id: raldUser.id, updated_at: new Date().toISOString() })
      .eq("id", userId);
  } else {
    const { data: created, error } = await db
      .from("users")
      .insert({
        phone:   phone,
        email:   email,
        rald_id: raldUser.id,
        name:    raldUser.name ?? null,
        role:    raldUser.role ?? "user",
      })
      .select("id")
      .single();

    if (error || !created) {
      console.error("[messenger-sso] create user error:", error?.message);
      return c.json({ error: "Failed to create Messenger user" }, 500);
    }
    userId = created.id;
  }

  return c.json({
    authenticated: true,
    user: {
      id:    userId,
      phone: phone,
      email: email,
      role:  raldUser.role ?? "user",
    },
    message: "RALD token accepted — use it as Bearer for all Messenger API calls",
  });
});
