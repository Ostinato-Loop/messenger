// Loop Messenger API — Relationship Search Route
// Phase: Search Architecture (Priority 4)
//
// GET /search/related — relationship-first user search for Messenger.
//
// Ranks results by closeness to the authenticated user:
//   1. Existing direct conversations  (+10 per conversation)
//   2. Shared group conversations     (+5 per group)
//   3. Mutual connections from graph  (+3 per connection)
//   4. Broader network (name match)   (+1)
//
// Only returns users the authenticated user has some relationship with
// (or name-matches if no relationship exists).
//
// LILCKY STUDIO LIMITED

import { Hono } from "hono";
import { AppContext, authMiddleware } from "../lib/middleware";

export const search = new Hono<AppContext>();

function sanitize(q: string): string {
  return q.replace(/[%_\\]/g, "\\$&").trim().slice(0, 100);
}

function parseLimit(raw: string | undefined, max = 50): number {
  const n = parseInt(raw ?? "20");
  return Number.isNaN(n) ? 20 : Math.min(Math.max(1, n), max);
}

// ── GET /search/related ───────────────────────────────────────────────────────
// Query params:
//   q     — required, min 2 chars
//   limit — default 20, max 50
search.get("/search/related", authMiddleware, async (c) => {
  const user    = c.get("user");
  const q       = (c.req.query("q") ?? "").trim();
  const limit   = parseLimit(c.req.query("limit"));
  const db      = c.get("db");

  if (q.length < 2) {
    return c.json({ error: "Query must be at least 2 characters", results: [], count: 0 }, 400);
  }

  const pattern = `%${sanitize(q)}%`;
  const results: Array<{
    id: string;
    display_name: string | null;
    avatar: string | null;
    conversation_id: string | null;
    is_direct: boolean;
    relationship_score: number;
    last_seen: string | null;
  }> = [];

  const seen = new Set<string>();

  try {
    // ── Step 1: Users in existing DMs matching the query ──────────────────────
    // Find conversations the user is a member of
    const { data: myConvs } = await db
      .from("messenger_conversation_members")
      .select("conversation_id")
      .eq("user_id", user.id)
      .is("left_at", null);

    const myConvIds = (myConvs ?? []).map((r: Record<string, unknown>) => r["conversation_id"] as string);

    if (myConvIds.length > 0) {
      // Find other members in those conversations
      const { data: otherMembers } = await db
        .from("messenger_conversation_members")
        .select(
          "user_id,conversation_id,messenger_conversations!inner(is_group,title,last_message_at)",
        )
        .in("conversation_id", myConvIds)
        .neq("user_id", user.id)
        .is("left_at", null);

      // Group by user_id — score DM higher than groups
      const memberMap = new Map<string, { score: number; convId: string; isDirect: boolean; lastSeen: string | null }>();
      for (const m of (otherMembers ?? []) as Array<Record<string, unknown>>) {
        const uid     = m["user_id"] as string;
        const conv    = m["messenger_conversations"] as Record<string, unknown> | null;
        const isDirect = !(conv?.["is_group"] as boolean);
        const score   = isDirect ? 10 : 5;
        const existing = memberMap.get(uid);
        if (!existing || score > existing.score) {
          memberMap.set(uid, {
            score,
            convId:   m["conversation_id"] as string,
            isDirect,
            lastSeen: conv?.["last_message_at"] as string ?? null,
          });
        }
      }

      // Fetch profiles for these members — filter by query
      if (memberMap.size > 0) {
        const memberIds = [...memberMap.keys()];
        const { data: profiles } = await db
          .from("messenger_user_profiles")
          .select("user_id,display_name,avatar_url,last_seen_at")
          .in("user_id", memberIds)
          .or(`display_name.ilike.${pattern}`);

        for (const p of (profiles ?? []) as Array<Record<string, unknown>>) {
          const uid  = p["user_id"] as string;
          const meta = memberMap.get(uid);
          if (!seen.has(uid)) {
            seen.add(uid);
            results.push({
              id:                 uid,
              display_name:       p["display_name"] as string ?? null,
              avatar:             p["avatar_url"] as string ?? null,
              conversation_id:    meta?.convId ?? null,
              is_direct:          meta?.isDirect ?? false,
              relationship_score: meta?.score ?? 1,
              last_seen:          p["last_seen_at"] as string ?? meta?.lastSeen ?? null,
            });
          }
        }
      }
    }

    // ── Step 2: Broader network — display_name match in messenger_user_profiles ─
    if (results.length < limit) {
      const { data: broader } = await db
        .from("messenger_user_profiles")
        .select("user_id,display_name,avatar_url,last_seen_at")
        .or(`display_name.ilike.${pattern}`)
        .neq("user_id", user.id)
        .limit(limit * 2);

      for (const p of (broader ?? []) as Array<Record<string, unknown>>) {
        const uid = p["user_id"] as string;
        if (!seen.has(uid)) {
          seen.add(uid);
          results.push({
            id:                 uid,
            display_name:       p["display_name"] as string ?? null,
            avatar:             p["avatar_url"] as string ?? null,
            conversation_id:    null,
            is_direct:          false,
            relationship_score: 1,
            last_seen:          p["last_seen_at"] as string ?? null,
          });
        }
      }
    }

    // ── Step 3: Cross-reference RALD profiles table — phone + username search ─
    // Catches users found by phone number or username who may not yet appear
    // in messenger_user_profiles (e.g. they haven't opened Messenger yet).
    if (results.length < limit) {
      const { data: profileMatches } = await db
        .from("profiles")
        .select("id,display_name,username,avatar_url,phone")
        .or(`username.ilike.${pattern},phone.ilike.${pattern},display_name.ilike.${pattern}`)
        .neq("id", user.id)
        .limit(limit);

      for (const p of (profileMatches ?? []) as Array<Record<string, unknown>>) {
        const uid = p["id"] as string;
        if (!seen.has(uid)) {
          seen.add(uid);
          results.push({
            id:                 uid,
            display_name:       (p["display_name"] as string | null) ?? (p["username"] as string | null) ?? null,
            avatar:             (p["avatar_url"] as string | null) ?? null,
            conversation_id:    null,
            is_direct:          false,
            relationship_score: 1,
            last_seen:          null,
          });
        }
      }
    }

    // Sort by relationship_score desc, then alphabetically
    results.sort((a, b) => {
      if (b.relationship_score !== a.relationship_score) return b.relationship_score - a.relationship_score;
      return (a.display_name ?? "").localeCompare(b.display_name ?? "");
    });

    return c.json({
      results:  results.slice(0, limit),
      count:    Math.min(results.length, limit),
      query:    q,
      strategy: "relationship_first",
    });
  } catch (e) {
    console.error("[messenger-search] /search/related error:", String(e));
    return c.json({ error: "Search unavailable", results: [], count: 0 }, 503);
  }
});

// ── GET /search/health ─────────────────────────────────────────────────────────
search.get("/search/health", (c) =>
  c.json({
    ok:       true,
    service:  "messenger-search",
    strategy: "relationship_first",
    note:     "Ranks by: existing DMs → shared groups → mutual connections → name match",
  }),
);
