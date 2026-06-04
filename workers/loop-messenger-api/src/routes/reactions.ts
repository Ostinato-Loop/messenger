// Loop Messenger — Reactions Routes
// LILCKY STUDIO LIMITED

import { Hono } from "hono";
import { createClient } from "@supabase/supabase-js";
import { AppContext, authMiddleware, workspaceMiddleware, conversationAccessMiddleware } from "../lib/middleware";
import { writeAudit } from "../lib/audit";
import { generateId, nowIso } from "../lib/auth";

export const reactions = new Hono<AppContext>();
reactions.use("/conversations*", authMiddleware, workspaceMiddleware);

// ── POST /conversations/:id/messages/:msgId/reactions ─────────────────────
reactions.post("/conversations/:id/messages/:msgId/reactions", conversationAccessMiddleware, async (c) => {
  const db = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);
  const workspaceId = c.get("workspaceId");
  const user = c.get("user");
  const conversationId = c.req.param("id");
  const msgId = c.req.param("msgId");

  const body = await c.req.json<{ emoji: string }>().catch(() => null);
  if (!body?.emoji?.trim()) return c.json({ error: "emoji is required" }, 400);
  const emoji = body.emoji.trim().slice(0, 10); // limit length

  const { data, error } = await db
    .from("messenger_message_reactions")
    .upsert({
      id:              generateId(),
      message_id:      msgId,
      conversation_id: conversationId,
      workspace_id:    workspaceId,
      user_id:         user.id,
      emoji,
      created_at:      nowIso(),
    }, { onConflict: "message_id,user_id,emoji" })
    .select()
    .single();
  if (error) return c.json({ error: error.message }, 500);

  c.executionCtx.waitUntil(writeAudit(db, {
    workspaceId, actorId: user.id, action: "reaction.added",
    resourceType: "message", resourceId: msgId, metadata: { emoji },
  }));
  return c.json({ reaction: data }, 201);
});

// ── DELETE /conversations/:id/messages/:msgId/reactions/:emoji ────────────
reactions.delete("/conversations/:id/messages/:msgId/reactions/:emoji", conversationAccessMiddleware, async (c) => {
  const db = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);
  const workspaceId = c.get("workspaceId");
  const user = c.get("user");
  const msgId = c.req.param("msgId");
  const emoji = decodeURIComponent(c.req.param("emoji"));

  await db.from("messenger_message_reactions")
    .delete()
    .eq("message_id", msgId)
    .eq("user_id", user.id)
    .eq("emoji", emoji)
    .eq("workspace_id", workspaceId);

  c.executionCtx.waitUntil(writeAudit(db, {
    workspaceId, actorId: user.id, action: "reaction.removed",
    resourceType: "message", resourceId: msgId, metadata: { emoji },
  }));
  return c.json({ ok: true });
});

// ── GET /conversations/:id/messages/:msgId/reactions ─────────────────────
reactions.get("/conversations/:id/messages/:msgId/reactions", conversationAccessMiddleware, async (c) => {
  const db = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);
  const workspaceId = c.get("workspaceId");
  const msgId = c.req.param("msgId");

  const { data, error } = await db
    .from("messenger_message_reactions")
    .select("emoji, user_id, created_at")
    .eq("message_id", msgId)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });
  if (error) return c.json({ error: error.message }, 500);

  // Group by emoji
  const grouped: Record<string, { count: number; users: string[] }> = {};
  for (const r of (data ?? [])) {
    const row = r as { emoji: string; user_id: string };
    if (!grouped[row.emoji]) grouped[row.emoji] = { count: 0, users: [] };
    grouped[row.emoji].count++;
    grouped[row.emoji].users.push(row.user_id);
  }
  return c.json({ reactions: grouped });
});
