/**
 * RALD Auth — Logout
 * POST /api/auth/logout
 * Headers: Authorization: Bearer <access_token>
 */
import { createAPIFileRoute } from "@tanstack/react-start/api";
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export const APIRoute = createAPIFileRoute("/api/auth/logout")({
  POST: async ({ request }) => {
    const auth = request.headers.get("authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json({ error: "No token provided" }, 401);
    const token = auth.slice(7);
    const admin = getAdmin();
    const { error } = await admin.auth.admin.signOut(token, "global");
    if (error) { console.error("[RALD/logout]", error); return json({ error: "Logout failed" }, 500); }
    return json({ ok: true });
  },
});
