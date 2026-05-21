/**
 * RALD Auth — Send OTP
 * POST /api/auth/send-otp
 * Body: { phone: string }
 *
 * Generates a 6-digit OTP, stores SHA-256 hash in rald_phone_otps,
 * delivers via TERMII SMS. Rate-limited to 3 requests per 10 min per phone.
 */
import { createAPIFileRoute } from "@tanstack/react-start/api";
import { createClient } from "@supabase/supabase-js";
import { createHash, randomInt } from "node:crypto";

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_RESENDS = 3;
const RATE_WINDOW_MS = 10 * 60 * 1000;

function getAdmin() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
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

  const senders = [
    { from, channel },
    { from: "RALD", channel: "generic" },
  ];

  let last: unknown = {};
  for (const s of senders) {
    try {
      const r = await fetch(`${base}/api/sms/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey, to: toNum, from: s.from,
          sms: `Your Loop Messenger (RALD Auth) code is ${otp}. Valid 5 mins. Do not share.`,
          type: "plain", channel: s.channel,
        }),
      });
      const d = await r.json() as Record<string, unknown>;
      if (r.ok) return { ok: true, detail: d };
      last = d;
      const msg = String(d?.message ?? "");
      if (!msg.includes("ApplicationSenderId") && !msg.includes("SenderName")) return { ok: false, detail: d };
      console.warn(`[RALD] sender '${s.from}' rejected, retrying…`);
    } catch (e) { last = { error: String(e) }; }
  }
  return { ok: false, detail: last };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export const APIRoute = createAPIFileRoute("/api/auth/send-otp")({
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
      await audit(admin, "send_otp_rate_limited", phone);
      return json({ error: "Too many requests. Please wait 10 minutes." }, 429);
    }

    const otp = genOtp();
    const codeHash = sha256(otp);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

    const { error: insertErr } = await admin.from("rald_phone_otps").insert({ phone, code_hash: codeHash, expires_at: expiresAt, attempts: 0 });
    if (insertErr) { console.error("[RALD/send-otp] DB:", insertErr); return json({ error: "Failed to create OTP" }, 500); }

    const { ok, detail } = await sendSms(phone, otp);
    if (!ok) {
      console.error("[RALD/send-otp] SMS failed:", detail);
      await admin.from("rald_phone_otps").delete().eq("phone", phone).eq("code_hash", codeHash);
      await audit(admin, "send_otp_sms_failed", phone, { detail });
      return json({ error: "SMS delivery failed. Please try again." }, 502);
    }

    await audit(admin, "send_otp_success", phone);
    return json({ ok: true, message: "OTP sent via RALD Auth" });
  },
});
