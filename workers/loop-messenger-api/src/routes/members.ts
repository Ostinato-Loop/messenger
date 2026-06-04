// Loop Messenger — Conversation Members Routes
// LILCKY STUDIO LIMITED

import { Hono } from "hono";
import { createClient } from "@supabase/supabase-js";
import { AppContext, authMiddleware, workspaceMiddleware, conversationAccessMiddleware } from "../lib/middleware";
import { writeAudit } from "../lib/audit";
import { generateId, nowIso } from "../lib/auth";

export const members = new Hono<AppContext>();
members.use("/conversations/*", authMiddleware, workspaceMiddleware);

// ── GET /conversations/:id/members ────────────────────────────────────────
members.get("/conversations/:id/members", conversationAccessMiddleware, async (c) => {
  const db = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);
  const workspaceId = c.get("workspaceId");
  const conversationId = c.req.param("id");

  const { data, error } = await db
    .from("messenger_conversation_members")
    .select("*")
    .eq("conversation_id", conversationId)
    .eq("workspace_id", workspaceId)
    .is("left_at", null)
    .order("joined_at", { ascending: true });
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ members: data ?? [] });
});

// ── POST /conversations/:id/members ───────────────────────────────────────
members.post("/conversations/:id/members", conversationAccessMiddleware, async (c) => {
  const db = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);
  const workspaceId = c.get("workspaceId");
  const user = c.get("user");
  const conversationId = c.req.param("id");

  // Only owner or admin can add members
  const { data: caller } = await db
    .from("messenger_conversation_members")
    .select("role").eq("conversation_id", conversationId)
    .eq("user_id", user.id).eq("workspace_id", workspaceId).is("left_at", null).single();
  if (!caller || !["owner","admin"].includes(caller.role))
    return c.json({ error: "Only conversation owners and admins can add members" }, 403);

  const body = await c.req.json<{ user_id: string; role?: string }>().catch(() => null);
  if (!body?.user_id) return c.json({ error: "user_id is required" }, 400);
  const role = body.role && ["admin","member","guest"].includes(body.role) ? body.role : "member";

  // Prevent duplicate (restore if left)
  const { data: existing } = await db
    .from("messenger_conversation_members")
    .select("id, left_at").eq("conversation_id", conversationId)
    .eq("user_id", body.user_id).eq("workspace_id", workspaceId).maybeSingle();

  if (existing && !existing.left_at)
    return c.json({ error: "User is already a member" }, 409);

  if (existing?.left_at) {
    await db.from("messenger_conversation_members")
      .update({ left_at: null, role, joined_at: nowIso() })
      .eq("id", existing.id);
  } else {
    await db.from("messenger_conversation_members").insert({
      id: generateId(), conversation_id: conversationId,
      workspace_id: workspaceId, user_id: body.user_id,
      role, joined_at: nowIso(),
    });
  }

  c.executionCtx.waitUntil(writeAudit(db, {
    workspaceId, actorId: user.id, action: "member.added",
    resourceType: "conversation", resourceId: conversationId,
    metadata: { added_user: body.user_id, role },
  }));
  return c.json({ ok: true, user_id: body.user_id, role }, 201);
});

// ── PATCH /conversations/:id/members/:userId ──────────────────────────────
members.patch("/conversations/:id/members/:userId", conversationAccessMiddleware, async (c) => {
  const db = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);
  const workspaceId = c.get("workspaceId");
  const user = c.get("user");
  const conversationId = c.req.param("id");
  const targetUserId = c.req.param("userId");

  const { data: caller } = await db
    .from("messenger_conversation_members").select("role")
    .eq("conversation_id", conversationId).eq("user_id", user.id)
    .eq("workspace_id", workspaceId).is("left_at", null).single();
  if (!caller || !["owner","admin"].includes(caller.role))
    return c.json({ error: "Insufficient permissions" }, 403);

  const body = await c.req.json<{ role?: string; is_muted?: boolean; is_archived?: boolean }>().catch(() => null);
  if (!body) return c.json({ error: "Invalid body" }, 400);
  const updates: Record<string, unknown> = {};
  if (body.role && ["admin","member","guest"].includes(body.role)) updates.role = body.role;
  if (body.is_muted !== undefined) updates.is_muted = body.is_muted;
  if (body.is_archived !== undefined) updates.is_archived = body.is_archived;
  if (!Object.keys(updates).length) return c.json({ error: "Nothing to update" }, 400);

  await db.from("messenger_conversation_members").update(updates)
    .eq("conversation_id", conversationId).eq("user_id", targetUserId).eq("workspace_id", workspaceId);

  c.executionCtx.waitUntil(writeAudit(db, {
    workspaceId, actorId: user.id, action: "member.role_changed",
    resourceType: "conversation", resourceId: conversationId,
    metadata: { target_user: targetUserId, updates },
  }));
  return c.json({ ok: true });
});

// ── DELETE /conversations/:id/members/:userId ─────────────────────────────
members.delete("/conversations/:id/members/:userId", conversationAccessMiddleware, async (c) => {
  const db = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);
  const workspaceId = c.get("workspaceId");
  const user = c.get("user");
  const conversationId = c.req.param("id");
  const targetUserId = c.req.param("userId");

  // Can remove self (leave) or owner/admin can remove others
  if (targetUserId !== user.id) {
    const { data: caller } = await db
      .from("messenger_conversation_members").select("role")
      .eq("conversation_id", conversationId).eq("user_id", user.id)
      .eq("workspace_id", workspaceId).is("left_at", null).single();
    if (!caller || !["owner","admin"].includes(caller.role))
      return c.json({ error: "Insufficient permissions" }, 403);
  }

  await db.from("messenger_conversation_members")
    .update({ left_at: nowIso() })
    .eq("conversation_id", conversationId)
    .eq("user_id", targetUserId)
    .eq("workspace_id", workspaceId);

  const action = targetUserId === user.id ? "member.left" : "member.removed";
  c.executionCtx.waitUntil(writeAudit(db, {
    workspaceId, actorId: user.id, action,
    resourceType: "conversation", resourceId: conversationId,
    metadata: { target_user: targetUserId },
  }));
  return c.json({ ok: true });
});
