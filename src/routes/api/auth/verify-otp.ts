/**
 * RALD Auth — Verify OTP
 * POST /api/auth/verify-otp
 * Body: { phone: string; otp: string }
 *
 * Verifies OTP hash, creates/fetches Supabase user,
 * returns a hashed_token for supabase.auth.verifyOtp({ type: "magiclink" }).
 */
import { createAPIFileRoute } from "@tanstack/react-start/api";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

const MAX_ATTEMPTS = 5;

function getAdmin() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function sha256(s: string) { return createHash("sha256").update(s).digest("hex"); }
function normalise(raw: string) { return `+${raw.replace(/^\+/, "").replace(/\D/g, "")}`; }
function phoneToEmail(phone: string) { return `${phone.replace(/^\+/, "")}@rald.loop.internal`; }

async function audit(admin: ReturnType<typeof getAdmin>, action: string, phone: string, meta = {}) {
  await admin.from("rald_audit_logs").insert({ action, resource_type: "phone_otp", resource_id: phone, metadata: { phone, ...meta } }).then(() => void 0).catch(() => void 0);
}

type AUser = { id: string; phone?: string | null; email?: string | null };

async function getOrCreate(admin: ReturnType<typeof getAdmin>, phone: string): Promise<{ user: AUser | null; error: unknown }> {
  const email = phoneToEmail(phone);
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const users = (data as unknown as { users?: AUser[] })?.users ?? [];
  const found = users.find(u => u.phone === phone || u.email === email);
  if (found) return { user: found, error: null };
  const { data: newU, error } = await admin.auth.admin.createUser({
    email, email_confirm: true,
    phone, phone_confirm: true,
    user_metadata: { phone, rald_auth: true },
  });
  return { user: (newU?.user as AUser | null) ?? null, error };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export const APIRoute = createAPIFileRoute("/api/auth/verify-otp")({
  POST: async ({ request }) => {
    let body: { phone?: string; otp?: string };
    try { body = await request.json() as { phone?: string; otp?: string }; }
    catch { return json({ error: "Invalid JSON" }, 400); }

    if (!body?.phone?.trim() || !body?.otp?.trim()) return json({ error: "phone and otp are required" }, 400);

    const phone = normalise(body.phone);
    const admin = getAdmin();

    const { data: rec, error: fetchErr } = await admin
      .from("rald_phone_otps").select("*")
      .eq("phone", phone).is("consumed_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }).limit(1).maybeSingle();

    if (fetchErr || !rec) {
      await audit(admin, "verify_otp_not_found", phone);
      return json({ error: "No valid OTP found. Request a new code." }, 400);
    }

    const r = rec as { id: string; code_hash: string; attempts: number };

    if (r.attempts >= MAX_ATTEMPTS) {
      await audit(admin, "verify_otp_max_attempts", phone);
      return json({ error: "Too many failed attempts. Request a new code." }, 429);
    }

    if (sha256(body.otp.trim()) !== r.code_hash) {
      const newAttempts = r.attempts + 1;
      await admin.from("rald_phone_otps").update({ attempts: newAttempts }).eq("id", r.id);
      const remaining = MAX_ATTEMPTS - newAttempts;
      await audit(admin, "verify_otp_wrong_code", phone, { attempts: newAttempts, remaining });
      return json({
        error: remaining > 0 ? `Wrong code. ${remaining} attempt${remaining !== 1 ? "s" : ""} left.` : "Too many failed attempts. Request a new code.",
        remaining,
      }, 400);
    }

    await admin.from("rald_phone_otps").update({ consumed_at: new Date().toISOString() }).eq("id", r.id);

    const { user, error: userErr } = await getOrCreate(admin, phone);
    if (userErr || !user) { console.error("[RALD/verify-otp] user error:", userErr); return json({ error: "Failed to create account" }, 500); }

    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: "magiclink", email: phoneToEmail(phone) });
    if (linkErr || !link?.properties?.hashed_token) { console.error("[RALD/verify-otp] link error:", linkErr); return json({ error: "Failed to generate session token" }, 500); }

    await audit(admin, "verify_otp_success", phone, { userId: user.id });

    return json({ ok: true, token: link.properties.hashed_token, userId: user.id });
  },
});
