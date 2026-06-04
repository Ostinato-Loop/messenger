// Loop Messenger API — Users Routes
// GET /users/search?q=... — search RALD profiles for user lookup in new-conversation dialogs
// GET /users/:userId   — fetch a single user's public profile
//
// User identity lives in the RALD Profiles service (same Supabase project for
// single-tenant RALD deployments).  We query the `profiles` table directly using
// the Messenger service-role key.  If the table doesn't exist (multi-tenant
// deployments with a separate Profiles DB) we return an empty result gracefully
// rather than erroring — the caller can still start a conversation by user ID.
//
// LILCKY STUDIO LIMITED

import { Hono } from "hono";
import { createClient } from "@supabase/supabase-js";
import { AppContext, authMiddleware, workspaceMiddleware } from "../lib/middleware";

export const users = new Hono<AppContext>();

users.use("/users", authMiddleware, workspaceMiddleware);
users.use("/users/*", authMiddleware, workspaceMiddleware);

function mapProfile(p: Record<string, unknown>) {
  return {
    id:          p.id,
    phone:       p.phone ?? null,
    displayName: (p.display_name as string | null) ?? (p.username as string | null) ?? "RALD User",
    bio:         (p.bio as string | null) ?? null,
    avatar:      (p.avatar_url as string | null) ?? null,
    isOnline:    false,
    isVerified:  (p.is_verified as boolean | null) ?? false,
    lastSeen:    null,
    createdAt:   (p.created_at as string | null) ?? new Date().toISOString(),
  };
}

// GET /users/search?q=...
users.get("/users/search", async (c) => {
  const q = (c.req.query("q") ?? "").trim();
  if (!q || q.length < 2) return c.json([]);

  const db = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data, error } = await db
    .from("profiles")
    .select("id, username, display_name, bio, avatar_url, is_verified, phone, created_at")
    .or(`username.ilike.%${q}%,display_name.ilike.%${q}%,phone.ilike.%${q}%`)
    .limit(25);

  if (error) {
    // profiles table may live in a separate DB — return empty, do not crash.
    console.warn("[users/search] profiles table not accessible:", error.message);
    return c.json([]);
  }

  return c.json((data ?? []).map(mapProfile));
});

// GET /users/:userId
users.get("/users/:userId", async (c) => {
  const userId = c.req.param("userId");
  const db = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data, error } = await db
    .from("profiles")
    .select("id, username, display_name, bio, avatar_url, is_verified, phone, created_at")
    .eq("id", userId)
    .single();

  if (error || !data) return c.json({ error: "User not found" }, 404);
  return c.json(mapProfile(data as Record<string, unknown>));
});
