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
conversations.use("/conversations", authMiddleware, workspaceMiddleware);
conversations.use("/conversations/*", authMiddleware, workspaceMiddleware);

// ── Helpers ────────────────────────────────────────────────────────────────

/** Fetch member rows + optional profile data for a set of conversation IDs */
async function enrichConversations(
  db: ReturnType<typeof createClient>,
  convRows: Record<string, unknown>[],
  userId: string,
  workspaceId: string
) {
  if (!convRows.length) return [];

  const ids = convRows.map((r) => (r as { id: string }).id);

  // All members for these conversations
  const { data: allMembers } = await db
    .from("messenger_conversation_members")
    .select("conversation_id, user_id, role, joined_at, last_read_at, unread_count")
    .in("conversation_id", ids)
    .eq("workspace_id", workspaceId)
    .is("left_at", null);

  // Unique user IDs across all members
  const memberUserIds = [...new Set((allMembers ?? []).map((m: Record<string, unknown>) => m.user_id as string))];

  // Fetch profiles (may not exist in all deployments — fail gracefully)
  let profileMap: Record<string, Record<string, unknown>> = {};
  if (memberUserIds.length) {
    const { data: profileData } = await db
      .from("profiles")
      .select("id, username, display_name, avatar_url, is_verified, phone")
      .in("id", memberUserIds);
    for (const p of (profileData ?? []) as Record<string, unknown>[]) {
      profileMap[p.id as string] = p;
    }
  }

  // Unread count for the requesting user (from their member row)
  const unreadMap: Record<string, number> = {};
  const lastReadMap: Record<string, string | null> = {};
  for (const m of (allMembers ?? []) as Record<string, unknown>[]) {
    if ((m.user_id as string) === userId) {
      unreadMap[m.conversation_id as string]    = (m.unread_count as number) ?? 0;
      lastReadMap[m.conversation_id as string]  = (m.last_read_at as string | null) ?? null;
    }
  }

  return convRows.map((conv) => {
    const c = conv as Record<string, unknown>;
    const convMembers = ((allMembers ?? []) as Record<string, unknown>[])
      .filter((m) => (m.conversation_id as string) === (c.id as string))
      .map((m) => {
        const profile = profileMap[m.user_id as string];
        return {
          userId:     m.user_id,
          role:       m.role,
          joinedAt:   m.joined_at,
          lastReadAt: m.last_read_at ?? null,
          user: {
            id:          m.user_id,
            phone:       profile?.phone ?? null,
            displayName: (profile?.display_name as string | null) ?? (profile?.username as string | null) ?? "User",
            bio:         null,
            avatar:      (profile?.avatar_url as string | null) ?? null,
            isOnline:    false,
            isVerified:  (profile?.is_verified as boolean | null) ?? false,
            lastSeen:    null,
            createdAt:   c.created_at,
          },
        };
      });

    const lastMsg = c.last_message_preview
      ? {
          id:        null,
          content:   c.last_message_preview as string,
          createdAt: (c.last_message_at as string) ?? null,
          senderId:  null,
        }
      : null;

    return {
      id:          c.id,
      type:        (c.conversation_type as string) ?? "direct",
      name:        (c.title as string | null) ?? null,
      avatar:      null,
      createdAt:   c.created_at,
      status:      c.status,
      members:     convMembers,
      lastMessage: lastMsg,
      unreadCount: unreadMap[c.id as string] ?? 0,
    };
  });
}

// ── GET /conversations ─────────────────────────────────────────────────────
// Returns an enriched array (not wrapped) matching the generated API client's
// expected shape:
//   ConversationSummary[] where each item has .type .name .members .unreadCount
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
  if (!ids.length) return c.json([]);

  let q = db
    .from("messenger_conversations")
    .select("*")
    .in("id", ids)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .range((p - 1) * l, p * l - 1);

  if (status) q = q.eq("status", status);
  if (type)   q = q.eq("conversation_type", type);

  const { data, error } = await q;
  if (error) return c.json({ error: error.message }, 500);

  const enriched = await enrichConversations(db, data ?? [], user.id, workspaceId);
  return c.json(enriched);
});

// ── GET /conversations/stats ───────────────────────────────────────────────
// Returns unread counts for the logged-in user. Must be registered BEFORE
// /conversations/:id to prevent "stats" from matching the :id parameter.
conversations.get("/conversations/stats", async (c) => {
  const db = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);
  const workspaceId = c.get("workspaceId");
  const user = c.get("user");

  const { data: memberRows } = await db
    .from("messenger_conversation_members")
    .select("conversation_id, unread_count")
    .eq("user_id", user.id)
    .eq("workspace_id", workspaceId)
    .is("left_at", null);

  const rows = (memberRows ?? []) as { conversation_id: string; unread_count: number | null }[];
  const totalUnread = rows.reduce((sum, r) => sum + (r.unread_count ?? 0), 0);

  return c.json({
    totalConversations:  rows.length,
    totalUnread,
    unreadConversations: rows.filter((r) => (r.unread_count ?? 0) > 0).length,
  });
});

// ── POST /conversations ────────────────────────────────────────────────────
conversations.post("/conversations", async (c) => {
  const db = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);
  const workspaceId = c.get("workspaceId");
  const user = c.get("user");

  const body = await c.req.json<{
    type?: string;
    conversation_type?: string;
    name?: string;
    title?: string;
    description?: string;
    memberIds?: (string | number)[];
    participant_ids?: string[];
    customer_id?: string;
  }>().catch(() => null);
  if (!body) return c.json({ error: "Invalid JSON body" }, 400);

  // Accept both "type"/"name" (generated client) and "conversation_type"/"title" (direct API)
  const convType  = body.type ?? body.conversation_type ?? "direct";
  const convTitle = body.name?.trim() ?? body.title?.trim() ?? null;
  const memberIds = body.memberIds?.map(String) ?? body.participant_ids ?? [];

  if (!["direct", "group", "team", "customer", "internal"].includes(convType))
    return c.json({ error: "Invalid conversation type" }, 400);
  if ((convType === "group" || convType === "team") && !convTitle)
    return c.json({ error: "name is required for group conversations" }, 400);

  const id  = generateId();
  const now = nowIso();

  const { data: conv, error } = await db
    .from("messenger_conversations")
    .insert({
      id,
      workspace_id:      workspaceId,
      conversation_type: convType,
      title:             convTitle,
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

  // Add creator + participants as members
  const allMemberIds = [...new Set([user.id, ...memberIds])];
  await db.from("messenger_conversation_members").insert(
    allMemberIds.map((uid, i) => ({
      id:              generateId(),
      conversation_id: id,
      workspace_id:    workspaceId,
      user_id:         uid,
      role:            i === 0 && uid === user.id ? "owner" : "member",
      joined_at:       now,
    }))
  );

  c.executionCtx.waitUntil(Promise.all([
    indexConversation(c.env.SEARCH_URL, c.req.header("Authorization")!.slice(7), workspaceId, {
      id, title: convTitle, type: convType, status: "active",
    }),
    body.customer_id
      ? writeCrmActivity(c.env.CRM_URL, c.req.header("Authorization")!.slice(7), workspaceId, {
          customerId: body.customer_id,
          activityType: "conversation_started",
          metadata: { conversation_id: id, type: convType },
        })
      : Promise.resolve(),
    writeAudit(db, {
      workspaceId, actorId: user.id,
      action: "conversation.created",
      resourceType: "conversation", resourceId: id,
      metadata: { type: convType, participant_count: allMemberIds.length },
    }),
  ]));

  // Return in the same enriched format as GET /conversations
  const [enriched] = await enrichConversations(db, [conv], user.id, workspaceId);
  return c.json(enriched ?? conv, 201);
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

  const [enriched] = await enrichConversations(db, [data], user.id, workspaceId);
  return c.json(enriched ?? data);
});

// ── POST /conversations/:id/read ───────────────────────────────────────────
// Marks the conversation as read for the current user.
conversations.post("/conversations/:id/read", async (c) => {
  const db = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);
  const user = c.get("user");
  const workspaceId = c.get("workspaceId");
  const id = c.req.param("id");

  // Update last_read_at and reset unread_count (columns may not exist — ignore error)
  await db
    .from("messenger_conversation_members")
    .update({ last_read_at: nowIso(), unread_count: 0, updated_at: nowIso() })
    .eq("conversation_id", id)
    .eq("user_id", user.id)
    .eq("workspace_id", workspaceId);

  return c.json({ ok: true });
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
  if (!member || !["owner", "admin"].includes(member.role as string))
    return c.json({ error: "Insufficient permissions" }, 403);

  const body = await c.req.json<{ title?: string; name?: string; description?: string; status?: string }>().catch(() => null);
  if (!body) return c.json({ error: "Invalid JSON body" }, 400);

  const updates: Record<string, unknown> = { updated_at: nowIso() };
  const newTitle = body.name?.trim() ?? body.title?.trim();
  if (newTitle !== undefined) updates.title = newTitle;
  if (body.description !== undefined) updates.description = body.description.trim();
  if (body.status && ["active", "archived", "closed"].includes(body.status)) updates.status = body.status;

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
  return c.json(data);
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
  if (!member || (member as { role: string }).role !== "owner")
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
