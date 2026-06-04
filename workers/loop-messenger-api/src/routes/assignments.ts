// Loop Messenger — Assignments Routes
// LILCKY STUDIO LIMITED

import { Hono } from "hono";
import { createClient } from "@supabase/supabase-js";
import { AppContext, authMiddleware, workspaceMiddleware, conversationAccessMiddleware } from "../lib/middleware";
import { writeAudit } from "../lib/audit";
import { notifyAssignment } from "../lib/notify";
import { generateId, nowIso } from "../lib/auth";

export const assignments = new Hono<AppContext>();
assignments.use("/conversations*", authMiddleware, workspaceMiddleware);

// ── GET /conversations/:id/assignments ────────────────────────────────────
assignments.get("/conversations/:id/assignments", conversationAccessMiddleware, async (c) => {
  const db = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);
  const workspaceId = c.get("workspaceId");
  const conversationId = c.req.param("id");

  const { data, error } = await db
    .from("messenger_conversation_assignments")
    .select("*")
    .eq("conversation_id", conversationId)
    .eq("workspace_id", workspaceId)
    .order("assigned_at", { ascending: false });
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ assignments: data ?? [] });
});

// ── POST /conversations/:id/assignments ───────────────────────────────────
assignments.post("/conversations/:id/assignments", conversationAccessMiddleware, async (c) => {
  const db = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);
  const workspaceId = c.get("workspaceId");
  const user = c.get("user");
  const conversationId = c.req.param("id");

  // Admin or owner can assign
  const { data: caller } = await db
    .from("messenger_conversation_members").select("role")
    .eq("conversation_id", conversationId).eq("user_id", user.id)
    .eq("workspace_id", workspaceId).is("left_at", null).single();
  if (!caller || !["owner","admin"].includes(caller.role))
    return c.json({ error: "Only conversation owners and admins can assign" }, 403);

  const body = await c.req.json<{ assigned_to: string; team_id?: string; reason?: string }>().catch(() => null);
  if (!body?.assigned_to) return c.json({ error: "assigned_to is required" }, 400);

  // Unassign any active assignment first
  await db.from("messenger_conversation_assignments")
    .update({ unassigned_at: nowIso() })
    .eq("conversation_id", conversationId)
    .eq("workspace_id", workspaceId)
    .is("unassigned_at", null);

  const id = generateId();
  const { data, error } = await db
    .from("messenger_conversation_assignments")
    .insert({
      id,
      conversation_id: conversationId,
      workspace_id:    workspaceId,
      assigned_to:     body.assigned_to,
      assigned_by:     user.id,
      team_id:         body.team_id ?? null,
      reason:          body.reason ?? null,
      assigned_at:     nowIso(),
    })
    .select()
    .single();
  if (error) return c.json({ error: error.message }, 500);

  const jwtToken = c.req.header("Authorization")!.slice(7);
  c.executionCtx.waitUntil(Promise.all([
    notifyAssignment(c.env.NOTIFY_URL, jwtToken, {
      workspaceId, recipientId: body.assigned_to,
      conversationId, assignedBy: user.id,
    }),
    writeAudit(db, {
      workspaceId, actorId: user.id, action: "assignment.created",
      resourceType: "conversation", resourceId: conversationId,
      metadata: { assigned_to: body.assigned_to, team_id: body.team_id },
    }),
  ]));
  return c.json({ assignment: data }, 201);
});
