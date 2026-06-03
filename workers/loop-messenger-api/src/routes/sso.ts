// Loop Messenger API — RALD SSO Route
// POST /auth/rald-sso  { rald_token }
// Verifies the RALD JWT locally using RALD_JWT_SECRET (shared with rald-auth-core).
// NO outbound HTTP call — avoids CF Error 522 (Workers cannot call other
// CF-proxied Workers via public hostname).
// Creates/finds the Messenger user record and confirms the token is usable.
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

  // Verify RALD JWT locally — no HTTP call (avoids CF 522 error)
  const raldPayload = await verifyJwt(body.rald_token, c.env.RALD_JWT_SECRET);
  if (!raldPayload) {
    return c.json({ error: "Invalid or expired RALD token" }, 401);
  }

  const raldUser = {
    id:    raldPayload.id,
    email: raldPayload.email ?? undefined,
    phone: undefined as string | undefined,
    role:  raldPayload.role ?? "user",
  };

  const db = c.get("db");

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
        role:    raldUser.role,
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
      role:  raldUser.role,
    },
    message: "RALD token accepted — use it as Bearer for all Messenger API calls",
  });
});
