// Loop Messenger — Account Provisioning (Internal)
// Called by rald-event-bus identity provisioning chain when identity.created fires.
// Creates a messenger profile for a new RALD user.
// POST /internal/accounts/provision
// LILCKY STUDIO LIMITED

import { Hono }       from "hono";
import { AppContext } from "../lib/middleware";

export const provision = new Hono<AppContext>();

provision.post("/internal/accounts/provision", async (c) => {
  const internalSecret = c.req.header("X-Internal-Secret");
  const hmacSig        = c.req.header("X-RALD-Signature");

  const env = c.env as Record<string, string | undefined>;
  const secretOk = internalSecret && env.RALD_INTERNAL_SECRET && internalSecret === env.RALD_INTERNAL_SECRET;
  const hmacOk   = !!hmacSig && !!env.RALD_INTERNAL_SECRET;

  if (!secretOk && !hmacOk) {
    return c.json({ error: "Forbidden", code: "UNAUTHORIZED" }, 403);
  }

  const rawBody = await c.req.text();
  let body: { user_id?: string; rald_id?: string; display_name?: string; payload?: Record<string, unknown> };
  try {
    const parsed = JSON.parse(rawBody) as Record<string, unknown>;
    body = (parsed.payload as typeof body) ?? (parsed as typeof body);
  } catch {
    return c.json({ error: "Invalid JSON body", code: "BAD_REQUEST" }, 400);
  }

  if (!body.user_id) {
    return c.json({ error: "user_id is required", code: "MISSING_FIELDS" }, 400);
  }

  const db = c.get("db");
  if (!db) return c.json({ error: "Database unavailable", code: "DB_ERROR" }, 503);

  // Idempotency
  const { data: existing } = await db
    .from("messenger_profiles")
    .select("user_id")
    .eq("user_id", body.user_id)
    .maybeSingle();

  if (existing) {
    return c.json({ ok: true, user_id: body.user_id, idempotent: true });
  }

  const handle   = body.rald_id ?? body.user_id.split("-")[0];
  const username = `${handle}@rald`;

  const { error } = await db.from("messenger_profiles").insert({
    user_id:      body.user_id,
    username,
    display_name: body.display_name ?? handle,
    avatar_url:   null,
    bio:          null,
    is_active:    true,
    created_at:   new Date().toISOString(),
    updated_at:   new Date().toISOString(),
  });

  if (error) {
    if (error.code === "23505") {
      const fallback = `${handle}_${Date.now().toString(36)}@rald`;
      const { error: retryErr } = await db.from("messenger_profiles").insert({
        user_id: body.user_id, username: fallback,
        display_name: body.display_name ?? handle,
        avatar_url: null, bio: null, is_active: true,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      });
      if (retryErr) return c.json({ error: "Failed to provision account", code: "DB_ERROR" }, 500);
      return c.json({ ok: true, user_id: body.user_id, username: fallback, idempotent: false }, 201);
    }
    console.error("[accounts/provision]", error.message);
    return c.json({ error: "Failed to provision account", code: "DB_ERROR" }, 500);
  }

  return c.json({ ok: true, user_id: body.user_id, username, idempotent: false }, 201);
});
