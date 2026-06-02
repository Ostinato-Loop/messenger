// Loop Messenger — Attachment Metadata Routes
// LILCKY STUDIO LIMITED — G1: metadata layer only (no media processing)

import { Hono } from "hono";
import { createClient } from "@supabase/supabase-js";
import { AppContext, authMiddleware, workspaceMiddleware, conversationAccessMiddleware } from "../lib/middleware";
import { writeAudit } from "../lib/audit";
import { generateId, nowIso } from "../lib/auth";

export const attachments = new Hono<AppContext>();
attachments.use("*", authMiddleware, workspaceMiddleware);

// ── POST /conversations/:id/attachments ───────────────────────────────────
attachments.post("/conversations/:id/attachments", conversationAccessMiddleware, async (c) => {
  const db = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);
  const workspaceId = c.get("workspaceId");
  const user = c.get("user");
  const conversationId = c.req.param("id");

  const body = await c.req.json<{
    filename: string;
    mime_type: string;
    size_bytes: number;
    storage_key: string;
    message_id?: string;
  }>().catch(() => null);
  if (!body?.filename || !body?.mime_type || !body?.storage_key)
    return c.json({ error: "filename, mime_type, and storage_key are required" }, 400);

  const id = generateId();
  const { data, error } = await db
    .from("messenger_message_attachments")
    .insert({
      id,
      message_id:      body.message_id ?? null,
      conversation_id: conversationId,
      workspace_id:    workspaceId,
      uploaded_by:     user.id,
      filename:        body.filename.trim(),
      mime_type:       body.mime_type.trim(),
      size_bytes:      body.size_bytes ?? 0,
      storage_key:     body.storage_key.trim(),
      created_at:      nowIso(),
    })
    .select()
    .single();
  if (error) return c.json({ error: error.message }, 500);

  c.executionCtx.waitUntil(writeAudit(db, {
    workspaceId, actorId: user.id, action: "attachment.uploaded",
    resourceType: "conversation", resourceId: conversationId,
    metadata: { attachment_id: id, filename: body.filename, mime_type: body.mime_type },
  }));
  return c.json({ attachment: data }, 201);
});

// ── GET /conversations/:id/attachments ────────────────────────────────────
attachments.get("/conversations/:id/attachments", conversationAccessMiddleware, async (c) => {
  const db = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);
  const workspaceId = c.get("workspaceId");
  const conversationId = c.req.param("id");

  const { data, error } = await db
    .from("messenger_message_attachments")
    .select("*")
    .eq("conversation_id", conversationId)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ attachments: data ?? [] });
});
