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

/**
 * authMiddleware — Session Standard V2
 *
 * Accepts authentication from two sources (in priority order):
 *
 *   1. Cookie: rald_session (HttpOnly, Secure, SameSite=Lax)
 *      Web clients (Loop Messenger SPA) use credentials:"include" so the
 *      browser sends this cookie automatically on every request. No token
 *      value is ever stored in localStorage or readable by JavaScript.
 *
 *   2. Bearer: Authorization: Bearer <token>
 *      Expo/React Native mobile builds use SecureStore + setAuthTokenGetter.
 *      Business API clients may also pass Bearer tokens directly.
 *
 * Both paths verify the JWT with the same RALD_JWT_SECRET. The payload
 * is stored in the Hono context variable "user" for downstream handlers.
 *
 * V1 note: Previously only Bearer was accepted. The cookie path was added
 * to support the Session Standard V2 cookie-only web clients.
 */
export async function authMiddleware(c: Context<AppContext>, next: Next) {
  let token: string | null = null;

  // Priority 1: rald_session HttpOnly cookie (Session Standard V2 — web clients)
  const cookieHeader = c.req.header("Cookie");
  if (cookieHeader) {
    for (const part of cookieHeader.split(";")) {
      const [k, ...v] = part.trim().split("=");
      if (k?.trim() === "rald_session") {
        token = v.join("=").trim() || null;
        break;
      }
    }
  }

  // Priority 2: Authorization: Bearer <token> (mobile / business API clients)
  if (!token) {
    const auth = c.req.header("Authorization");
    if (auth?.startsWith("Bearer ")) {
      token = auth.slice(7);
    }
  }

  if (!token) return c.json({ error: "Unauthorized" }, 401);

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
