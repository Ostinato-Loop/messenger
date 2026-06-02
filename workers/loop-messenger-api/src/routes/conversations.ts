// Loop Messenger — Conversations Routes
// LILCKY STUDIO LIMITED

import { Hono } from "hono";
import { createClient } from "@supabase/supabase-js";
import { AppContext, authMiddleware, workspaceMiddleware } from "../lib/middleware";
import { writeAudit } from "../lib/audit";
import { indexConversation } from "../lib/search";
import { writeCrmActivity } from "../lib/crm";
import { generateId, nowIso } from "../lib/auth";

export const conversations = new Hono<AppContext>();
conversations.use("*", authMiddleware, workspaceMiddleware);

// ── GET /conversations ─────────────────────────────────────────────────────
conversations.get("/conversations", async (c) => {
  const db = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);
  const workspaceId = c.get("workspaceId");
  const user = c.get("user");
  const { status, type, page = "1", limit = "20" } = c.req.query();
  const p = Math.max(1, parseInt(page));
  const l = Math.min(100, Math.max(1, parseInt(limit)));

  // Only return conversations where the user is a member
  const { data: memberRows } = await db
    .from("messenger_conversation_members")
    .select("conversation_id")
    .eq("user_id", user.id)
    .eq("workspace_id", workspaceId)
    .is("left_at", null);

  const ids = (memberRows ?? []).map((r: { conversation_id: string }) => r.conversation_id);
  if (!ids.length) return c.json({ conversations: [], total: 0, page: p, pages: 0 });

  let q = db
    .from("messenger_conversations")
    .select("*", { count: "exact" })
    .in("id", ids)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .range((p - 1) * l, p * l - 1);

  if (status) q = q.eq("status", status);
  if (type)   q = q.eq("conversation_type", type);

  const { data, count, error } = await q;
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ conversations: data ?? [], total: count ?? 0, page: p, pages: Math.ceil((count ?? 0) / l) });
});

// ── POST /conversations ────────────────────────────────────────────────────
conversations.post("/conversations", async (c) => {
  const db = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);
  const workspaceId = c.get("workspaceId");
  const user = c.get("user");

  const body = await c.req.json<{
    conversation_type?: string;
    title?: string;
    description?: string;
    participant_ids?: string[];
    customer_id?: string;
  }>().catch(() => null);
  if (!body) return c.json({ error: "Invalid JSON body" }, 400);

  const type = body.conversation_type ?? "direct";
  if (!["direct","group","team","customer","internal"].includes(type))
    return c.json({ error: "Invalid conversation_type" }, 400);
  if ((type === "group" || type === "team") && !body.title?.trim())
    return c.json({ error: "title is required for group and team conversations" }, 400);

  const id = generateId();
  const now = nowIso();

  const { data: conv, error } = await db
    .from("messenger_conversations")
    .insert({
      id,
      workspace_id:      workspaceId,
      conversation_type: type,
      title:             body.title?.trim() ?? null,
      description:       body.description?.trim() ?? null,
      created_by:        user.id,
      customer_id:       body.customer_id ?? null,
      status:            "active",
      created_at:        now,
      updated_at:        now,
    })
    .select()
    .single();
  if (error) return c.json({ error: error.message }, 500);

  // Add creator as owner member
  const memberIds = [...new Set([user.id, ...(body.participant_ids ?? [])])];
  await db.from("messenger_conversation_members").insert(
    memberIds.map((uid, i) => ({
      id:              generateId(),
      conversation_id: id,
      workspace_id:    workspaceId,
      user_id:         uid,
      role:            i === 0 && uid === user.id ? "owner" : "member",
      joined_at:       now,
    }))
  );

  // Non-blocking: search index + CRM activity + audit
  c.executionCtx.waitUntil(Promise.all([
    indexConversation(c.env.SEARCH_URL, c.req.header("Authorization")!.slice(7), workspaceId, {
      id, title: body.title, type, status: "active",
    }),
    body.customer_id
      ? writeCrmActivity(c.env.CRM_URL, c.req.header("Authorization")!.slice(7), workspaceId, {
          customerId: body.customer_id,
          activityType: "conversation_started",
          metadata: { conversation_id: id, type },
        })
      : Promise.resolve(),
    writeAudit(db, {
      workspaceId, actorId: user.id,
      action: "conversation.created",
      resourceType: "conversation", resourceId: id,
      metadata: { type, participant_count: memberIds.length },
    }),
  ]));

  return c.json({ conversation: conv }, 201);
});

// ── GET /conversations/:id ─────────────────────────────────────────────────
conversations.get("/conversations/:id", async (c) => {
  const db = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);
  const workspaceId = c.get("workspaceId");
  const user = c.get("user");
  const id = c.req.param("id");

  // Verify membership
  const { data: member } = await db
    .from("messenger_conversation_members")
    .select("role")
    .eq("conversation_id", id)
    .eq("user_id", user.id)
    .eq("workspace_id", workspaceId)
    .is("left_at", null)
    .single();
  if (!member) return c.json({ error: "Conversation not found or access denied" }, 404);

  const { data, error } = await db
    .from("messenger_conversations")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .single();
  if (error || !data) return c.json({ error: "Conversation not found" }, 404);
  return c.json({ conversation: data, your_role: member.role });
});

// ── PATCH /conversations/:id ───────────────────────────────────────────────
conversations.patch("/conversations/:id", async (c) => {
  const db = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);
  const workspaceId = c.get("workspaceId");
  const user = c.get("user");
  const id = c.req.param("id");

  const { data: member } = await db
    .from("messenger_conversation_members")
    .select("role")
    .eq("conversation_id", id).eq("user_id", user.id)
    .eq("workspace_id", workspaceId).is("left_at", null).single();
  if (!member || !["owner","admin"].includes(member.role))
    return c.json({ error: "Insufficient permissions" }, 403);

  const body = await c.req.json<{ title?: string; description?: string; status?: string }>().catch(() => null);
  if (!body) return c.json({ error: "Invalid JSON body" }, 400);
  const updates: Record<string, unknown> = { updated_at: nowIso() };
  if (body.title !== undefined) updates.title = body.title.trim();
  if (body.description !== undefined) updates.description = body.description.trim();
  if (body.status && ["active","archived","closed"].includes(body.status)) updates.status = body.status;

  const { data, error } = await db
    .from("messenger_conversations")
    .update(updates)
    .eq("id", id).eq("workspace_id", workspaceId)
    .select().single();
  if (error) return c.json({ error: error.message }, 500);
  c.executionCtx.waitUntil(writeAudit(db, {
    workspaceId, actorId: user.id, action: "conversation.updated",
    resourceType: "conversation", resourceId: id, metadata: updates,
  }));
  return c.json({ conversation: data });
});

// ── DELETE /conversations/:id (soft delete/archive) ────────────────────────
conversations.delete("/conversations/:id", async (c) => {
  const db = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);
  const workspaceId = c.get("workspaceId");
  const user = c.get("user");
  const id = c.req.param("id");

  const { data: member } = await db
    .from("messenger_conversation_members")
    .select("role").eq("conversation_id", id).eq("user_id", user.id)
    .eq("workspace_id", workspaceId).is("left_at", null).single();
  if (!member || member.role !== "owner")
    return c.json({ error: "Only the conversation owner can delete it" }, 403);

  await db.from("messenger_conversations")
    .update({ deleted_at: nowIso(), status: "closed", updated_at: nowIso() })
    .eq("id", id).eq("workspace_id", workspaceId);

  c.executionCtx.waitUntil(writeAudit(db, {
    workspaceId, actorId: user.id, action: "conversation.deleted",
    resourceType: "conversation", resourceId: id,
  }));
  return c.json({ ok: true });
});
