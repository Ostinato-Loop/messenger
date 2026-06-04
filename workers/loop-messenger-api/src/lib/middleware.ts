// Loop Messenger — Middleware
// LILCKY STUDIO LIMITED

import { Context, Next } from "hono";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { verifyJwt, JwtPayload } from "./auth";

export type Bindings = {
  RALD_JWT_SECRET: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  NOTIFY_URL: string;
  SEARCH_URL: string;
  CRM_URL: string;
  INBOX_URL: string;
  ENVIRONMENT: string;
};

export type Variables = {
  user: JwtPayload;
  workspaceId: string;
  db: SupabaseClient;
};

export type AppContext = {
  Bindings: Bindings;
  Variables: Variables;
};

export async function dbMiddleware(c: Context<AppContext>, next: Next) {
  c.set("db", createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY));
  await next();
}

export async function authMiddleware(c: Context<AppContext>, next: Next) {
  const auth = c.req.header("Authorization");
  if (!auth?.startsWith("Bearer ")) return c.json({ error: "Unauthorized" }, 401);
  const token = auth.slice(7);
  const payload = await verifyJwt(token, c.env.RALD_JWT_SECRET);
  if (!payload) return c.json({ error: "Unauthorized" }, 401);
  c.set("user", payload);
  await next();
}

/**
 * workspaceMiddleware — resolves the workspace ID for every authenticated request.
 *
 * Priority (highest → lowest):
 *  1. X-Workspace-ID request header  (business API clients)
 *  2. workspace_id claim in the RALD JWT  (SSO-issued tokens may carry it)
 *  3. Fallback: "consumer"  (Loop Messenger P2P — single shared namespace)
 *
 * The header is now OPTIONAL so the Loop Messenger frontend can work without
 * explicitly setting it.  Business integrations that need multi-tenancy still
 * pass the header as before.
 */
export async function workspaceMiddleware(c: Context<AppContext>, next: Next) {
  const fromHeader  = c.req.header("X-Workspace-ID");
  const fromJwt     = (c.get("user") as JwtPayload | undefined)?.workspace_id;
  const workspaceId = fromHeader ?? fromJwt ?? "consumer";
  c.set("workspaceId", workspaceId);
  await next();
}

/** Verify the authenticated user is a member of the conversation */
export async function conversationAccessMiddleware(c: Context<AppContext>, next: Next) {
  const db = c.get("db");
  const user = c.get("user");
  const workspaceId = c.get("workspaceId");
  const conversationId = c.req.param("id");
  if (!conversationId) return c.json({ error: "conversationId required" }, 400);
  const { data } = await db
    .from("messenger_conversation_members")
    .select("role")
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id)
    .eq("workspace_id", workspaceId)
    .is("left_at", null)
    .single();
  if (!data) return c.json({ error: "Conversation not found or access denied" }, 404);
  await next();
}
