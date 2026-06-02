// Loop Messenger — Messages Routes
// LILCKY STUDIO LIMITED

import { Hono } from "hono";
import { createClient } from "@supabase/supabase-js";
import { AppContext, authMiddleware, workspaceMiddleware, conversationAccessMiddleware } from "../lib/middleware";
import { writeAudit } from "../lib/audit";
import { notifyNewMessage, notifyMention } from "../lib/notify";
import { indexMessage } from "../lib/search";
import { generateId, nowIso } from "../lib/auth";

export const messages = new Hono<AppContext>();
messages.use("*", authMiddleware, workspaceMiddleware);

// ── GET /conversations/:id/messages ───────────────────────────────────────
messages.get("/conversations/:id/messages", conversationAccessMiddleware, async (c) => {
  const db = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);
  const workspaceId = c.get("workspaceId");
  const conversationId = c.req.param("id");
  const { before, limit = "50" } = c.req.query();
  const l = Math.min(200, Math.max(1, parseInt(limit)));

  let q = db
    .from("messenger_messages")
    .select("*, reactions:messenger_message_reactions(*), attachments:messenger_message_attachments(*)")
    .eq("conversation_id", conversationId)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(l);

  if (before) q = q.lt("created_at", before);

  const { data, error } = await q;
  if (error) return c.json({ error: error.message }, 500);

  // Null content for soft-deleted messages
  const shaped = (data ?? []).map((m: Record<string, unknown>) =>
    m.deleted_at ? { ...m, content: null } : m
  );
  return c.json({ messages: shaped.reverse() });
});

// ── POST /conversations/:id/messages ──────────────────────────────────────
messages.post("/conversations/:id/messages", conversationAccessMiddleware, async (c) => {
  const db = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);
  const workspaceId = c.get("workspaceId");
  const user = c.get("user");
  const conversationId = c.req.param("id");

  const body = await c.req.json<{
    content: string;
    message_type?: string;
    reply_to_id?: string;
    mention_ids?: string[];
  }>().catch(() => null);
  if (!body?.content?.trim()) return c.json({ error: "content is required" }, 400);

  const msgType = body.message_type ?? "text";
  if (!["text","system","emoji"].includes(msgType))
    return c.json({ error: "Invalid message_type" }, 400);

  const id = generateId();
  const now = nowIso();

  const { data: msg, error } = await db
    .from("messenger_messages")
    .insert({
      id,
      conversation_id: conversationId,
      workspace_id:    workspaceId,
      sender_id:       user.id,
      content:         body.content.trim(),
      message_type:    msgType,
      reply_to_id:     body.reply_to_id ?? null,
      created_at:      now,
      updated_at:      now,
    })
    .select()
    .single();
  if (error) return c.json({ error: error.message }, 500);

  // Update conversation last_message
  const preview = body.content.trim().slice(0, 100);
  await db.from("messenger_conversations").update({
    last_message_at:      now,
    last_message_preview: preview,
    updated_at:           now,
    message_count:        db.rpc("coalesce", {}) as unknown as number, // incremented via DB trigger
  }).eq("id", conversationId).eq("workspace_id", workspaceId);

  // Insert sender status as "sent"
  await db.from("messenger_message_status").insert({
    id: generateId(), message_id: id, user_id: user.id, workspace_id: workspaceId, status: "sent",
  });

  const jwtToken = c.req.header("Authorization")!.slice(7);

  // Non-blocking: notify members, search index, audit
  c.executionCtx.waitUntil((async () => {
    // Get other active members to notify
    const { data: members } = await db
      .from("messenger_conversation_members")
      .select("user_id")
      .eq("conversation_id", conversationId)
      .eq("workspace_id", workspaceId)
      .is("left_at", null)
      .neq("user_id", user.id)
      .eq("is_muted", false);

    const notifyAll = (members ?? []).map((m: { user_id: string }) =>
      notifyNewMessage(c.env.NOTIFY_URL, jwtToken, {
        workspaceId, recipientId: m.user_id, conversationId,
        senderName: user.email, preview,
      })
    );

    // Mention notifications
    const mentionAll = (body.mention_ids ?? []).map(uid =>
      notifyMention(c.env.NOTIFY_URL, jwtToken, {
        workspaceId, recipientId: uid, conversationId,
        senderName: user.email, messageId: id,
      })
    );

    await Promise.all([
      ...notifyAll,
      ...mentionAll,
      indexMessage(c.env.SEARCH_URL, jwtToken, workspaceId, {
        id, conversationId, senderId: user.id, content: body.content.trim(),
      }),
      writeAudit(db, {
        workspaceId, actorId: user.id, action: "message.sent",
        resourceType: "message", resourceId: id,
        metadata: { conversation_id: conversationId, type: msgType },
      }),
    ]);
  })());

  return c.json({ message: msg }, 201);
});

// ── PATCH /conversations/:id/messages/:msgId ──────────────────────────────
messages.patch("/conversations/:id/messages/:msgId", conversationAccessMiddleware, async (c) => {
  const db = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);
  const workspaceId = c.get("workspaceId");
  const user = c.get("user");
  const msgId = c.req.param("msgId");

  const body = await c.req.json<{ content: string }>().catch(() => null);
  if (!body?.content?.trim()) return c.json({ error: "content is required" }, 400);

  // Only sender can edit their own message
  const { data: existing } = await db
    .from("messenger_messages")
    .select("sender_id, deleted_at")
    .eq("id", msgId).eq("workspace_id", workspaceId).single();
  if (!existing || existing.deleted_at) return c.json({ error: "Message not found" }, 404);
  if (existing.sender_id !== user.id) return c.json({ error: "You can only edit your own messages" }, 403);

  const { data, error } = await db
    .from("messenger_messages")
    .update({ content: body.content.trim(), updated_at: nowIso() })
    .eq("id", msgId).eq("workspace_id", workspaceId)
    .select().single();
  if (error) return c.json({ error: error.message }, 500);

  c.executionCtx.waitUntil(writeAudit(db, {
    workspaceId, actorId: user.id, action: "message.edited",
    resourceType: "message", resourceId: msgId,
  }));
  return c.json({ message: data });
});

// ── DELETE /conversations/:id/messages/:msgId (soft delete) ───────────────
messages.delete("/conversations/:id/messages/:msgId", conversationAccessMiddleware, async (c) => {
  const db = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);
  const workspaceId = c.get("workspaceId");
  const user = c.get("user");
  const conversationId = c.req.param("id");
  const msgId = c.req.param("msgId");

  const { data: existing } = await db
    .from("messenger_messages")
    .select("sender_id, deleted_at")
    .eq("id", msgId).eq("workspace_id", workspaceId).single();
  if (!existing || existing.deleted_at) return c.json({ error: "Message not found" }, 404);

  // Sender OR conversation owner/admin can delete
  const canDelete = existing.sender_id === user.id;
  if (!canDelete) {
    const { data: member } = await db
      .from("messenger_conversation_members")
      .select("role").eq("conversation_id", conversationId)
      .eq("user_id", user.id).eq("workspace_id", workspaceId).is("left_at", null).single();
    if (!member || !["owner","admin"].includes(member.role))
      return c.json({ error: "Insufficient permissions" }, 403);
  }

  // Soft delete: null out content
  await db.from("messenger_messages")
    .update({ deleted_at: nowIso(), content: null, updated_at: nowIso() })
    .eq("id", msgId).eq("workspace_id", workspaceId);

  c.executionCtx.waitUntil(writeAudit(db, {
    workspaceId, actorId: user.id, action: "message.deleted",
    resourceType: "message", resourceId: msgId,
    metadata: { conversation_id: conversationId },
  }));
  return c.json({ ok: true });
});

// ── PATCH /conversations/:id/messages/:msgId/status ───────────────────────
messages.patch("/conversations/:id/messages/:msgId/status", conversationAccessMiddleware, async (c) => {
  const db = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);
  const workspaceId = c.get("workspaceId");
  const user = c.get("user");
  const msgId = c.req.param("msgId");

  const body = await c.req.json<{ status: string }>().catch(() => null);
  if (!body?.status || !["delivered","read","failed"].includes(body.status))
    return c.json({ error: "status must be delivered, read, or failed" }, 400);

  await db.from("messenger_message_status").upsert(
    { id: generateId(), message_id: msgId, user_id: user.id, workspace_id: workspaceId, status: body.status, updated_at: nowIso() },
    { onConflict: "message_id,user_id" }
  );
  return c.json({ ok: true, status: body.status });
});
