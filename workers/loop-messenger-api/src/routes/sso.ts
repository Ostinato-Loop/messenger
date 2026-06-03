// Loop Messenger API — RALD SSO Route
// POST /auth/rald-sso  { rald_token }
// Validates the inbound RALD token against auth.rald.cloud, creates/finds the
// Messenger user record, and confirms the token is usable for all API calls.
// The RALD JWT is signed with RALD_JWT_SECRET — the same secret used by
// authMiddleware — so no token exchange is needed; the caller can use
// rald_token directly as the Bearer token for all subsequent requests.
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

  const meRes = await fetch(`${raldAuthUrl}/auth/me`, {
    headers: { Authorization: `Bearer ${body.rald_token}` },
  });

  if (!meRes.ok) {
    return c.json({ error: "Invalid or expired RALD token" }, 401);
  }

  const raldUser = await meRes.json() as {
    id: string;
    email?: string;
    phone?: string;
    name?: string | null;
    role?: string;
  };

  const db = c.get("db");

  // Upsert user in Messenger's Supabase user table
  const phone = raldUser.phone ?? null;
  const email = raldUser.email ?? null;

  const { data: existing } = await db
    .from("users")
    .select("id, phone, email")
    .or(
      [
        raldUser.id    ? `rald_id.eq.${raldUser.id}`   : null,
        phone          ? `phone.eq.${phone}`            : null,
        email          ? `email.eq.${email}`            : null,
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
        phone:    phone,
        email:    email,
        rald_id:  raldUser.id,
        name:     raldUser.name ?? null,
        role:     raldUser.role ?? "user",
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
