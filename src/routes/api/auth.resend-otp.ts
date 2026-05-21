/**
 * RALD Auth — Resend OTP
 * POST /api/auth/resend-otp
 * Body: { phone: string }
 */
import { createAPIFileRoute } from "@tanstack/react-start/api";
import { createClient } from "@supabase/supabase-js";
import { createHash, randomInt } from "node:crypto";

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_RESENDS = 3;
const RATE_WINDOW_MS = 10 * 60 * 1000;

function getAdmin() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function sha256(s: string) { return createHash("sha256").update(s).digest("hex"); }
function genOtp() { return String(randomInt(100000, 999999)); }
function normalise(raw: string) { return `+${raw.replace(/^\+/, "").replace(/\D/g, "")}`; }

async function audit(admin: ReturnType<typeof getAdmin>, action: string, phone: string, meta = {}) {
  await admin.from("rald_audit_logs").insert({ action, resource_type: "phone_otp", resource_id: phone, metadata: { phone, ...meta } }).then(() => void 0).catch(() => void 0);
}

async function sendSms(to: string, otp: string): Promise<{ ok: boolean; detail: unknown }> {
  const base = (process.env.TERMII_BASE_URL ?? "https://v3.api.termii.com").replace(/\/$/, "");
  const apiKey = process.env.TERMII_API_KEY!;
  const from = process.env.TERMII_SENDER_ID ?? "Ostloop";
  const channel = process.env.TERMII_CHANNEL ?? "generic";
  const toNum = to.replace(/^\+/, "");

  for (const s of [{ from, channel }, { from: "RALD", channel: "generic" }]) {
    try {
      const r = await fetch(`${base}/api/sms/send`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: apiKey, to: toNum, from: s.from, sms: `Your Loop Messenger (RALD Auth) code is ${otp}. Valid 5 mins. Do not share.`, type: "plain", channel: s.channel }),
      });
      const d = await r.json() as Record<string, unknown>;
      if (r.ok) return { ok: true, detail: d };
      const msg = String(d?.message ?? "");
      if (!msg.includes("ApplicationSenderId")) return { ok: false, detail: d };
    } catch (e) { return { ok: false, detail: { error: String(e) } }; }
  }
  return { ok: false, detail: {} };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export const APIRoute = createAPIFileRoute("/api/auth/resend-otp")({
  POST: async ({ request }) => {
    let body: { phone?: string };
    try { body = await request.json() as { phone?: string }; }
    catch { return json({ error: "Invalid JSON" }, 400); }

    if (!body?.phone?.trim()) return json({ error: "phone is required" }, 400);

    const phone = normalise(body.phone);
    const admin = getAdmin();

    const windowStart = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
    const { count } = await admin.from("rald_phone_otps").select("*", { count: "exact", head: true }).eq("phone", phone).gte("created_at", windowStart);
    if ((count ?? 0) >= MAX_RESENDS) {
      await audit(admin, "resend_otp_rate_limited", phone);
      return json({ error: "Too many requests. Please wait 10 minutes." }, 429);
    }

    const otp = genOtp();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();
    await admin.from("rald_phone_otps").insert({ phone, code_hash: sha256(otp), expires_at: expiresAt, attempts: 0 });

    const { ok, detail } = await sendSms(phone, otp);
    if (!ok) {
      await audit(admin, "resend_otp_sms_failed", phone, { detail });
      return json({ error: "SMS delivery failed. Please try again." }, 502);
    }

    await audit(admin, "resend_otp_success", phone);
    return json({ ok: true, message: "New OTP sent via RALD Auth" });
  },
});
