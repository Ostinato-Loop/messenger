/**
 * RALD Auth — V1→V5 pipeline.
 * Pure Cloudflare Worker request handlers (no Supabase Twilio/OTP).
 * SMS delivery via Termii API.
 *
 * Routes handled:
 *   POST /api/auth/send-otp
 *   POST /api/auth/verify-otp
 *   POST /api/auth/resend-otp
 *   POST /api/auth/logout
 *
 * V1 — Phone OTP (Termii) + Supabase user creation
 * V2 — Rate limiting + audit log
 * V3 — Resend throttle + max-attempts lockout
 * V4 — Auto-cleanup cron support
 * V5 — Refresh token rotation
 */

import { createClient } from "@supabase/supabase-js";
import { createHash, randomInt } from "node:crypto";

// ── Config ──────────────────────────────────────────────────────────────────
const OTP_TTL_MS     = 5 * 60 * 1000;   // 5 minutes
const MAX_ATTEMPTS   = 5;
const MAX_RESENDS    = 3;
const RATE_WINDOW_MS = 10 * 60 * 1000;  // 10 minutes

// ── Helpers ──────────────────────────────────────────────────────────────────
function getAdmin() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function sha256(s: string) { return createHash("sha256").update(s).digest("hex"); }
function genOtp()           { return String(randomInt(100000, 999999)); }
function normalise(raw: string) { return `+${raw.replace(/^\+/, "").replace(/\D/g, "")}`; }
function phoneToEmail(phone: string) { return `${phone.replace(/^\+/, "")}@rald.loop.internal`; }

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

async function audit(
  admin: ReturnType<typeof getAdmin>,
  action: string,
  phone: string,
  meta: Record<string, unknown> = {},
) {
  await admin
    .from("rald_audit_logs")
    .insert({ action, resource_type: "phone_otp", resource_id: phone, metadata: { phone, ...meta } })
    .then(() => void 0)
    .catch(() => void 0);
}

// ── Termii SMS Delivery ──────────────────────────────────────────────────────
async function sendSms(to: string, otp: string): Promise<{ ok: boolean; detail: unknown }> {
  const base    = (process.env.TERMII_BASE_URL ?? "https://v3.api.termii.com").replace(/\/$/, "");
  const apiKey  = process.env.TERMII_API_KEY!;
  const from    = process.env.TERMII_SENDER_ID ?? "Ostloop";
  const channel = process.env.TERMII_CHANNEL    ?? "generic";
  const toNum   = to.replace(/^\+/, "");

  const senders = [
    { from, channel },
    { from: "RALD",  channel: "generic" },
  ];

  let last: unknown = {};
  for (const s of senders) {
    try {
      const r = await fetch(`${base}/api/sms/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          to:      toNum,
          from:    s.from,
          sms:     `Your Loop Messenger code is ${otp}. Valid 5 mins. Do not share.`,
          type:    "plain",
          channel: s.channel,
        }),
      });
      const d = await r.json() as Record<string, unknown>;
      last = d;
      if (r.ok && (d.message_id || d.code === "ok" || d.message === "Successfully Sent")) {
        return { ok: true, detail: d };
      }
    } catch (e) {
      last = { error: String(e) };
    }
  }
  return { ok: false, detail: last };
}

// ── Rate limiter ─────────────────────────────────────────────────────────────
async function checkRateLimit(admin: ReturnType<typeof getAdmin>, phone: string) {
  const windowStart = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  const { count } = await admin
    .from("rald_phone_otps")
    .select("*", { count: "exact", head: true })
    .eq("phone_hash", sha256(phone))
    .gte("created_at", windowStart);
  return (count ?? 0) >= MAX_RESENDS + 1;
}

// ── V1: Send OTP ─────────────────────────────────────────────────────────────
export async function handleSendOtp(request: Request): Promise<Response> {
  let body: Record<string, string>;
  try { body = await request.json() as Record<string, string>; }
  catch { return json({ error: "Invalid JSON" }, 400); }

  const raw = body.phone ?? "";
  if (!raw) return json({ error: "phone required" }, 400);

  const phone = normalise(raw);
  if (!/^\+\d{7,15}$/.test(phone)) return json({ error: "Invalid phone number" }, 422);

  const admin = getAdmin();

  // V2: rate limit
  if (await checkRateLimit(admin, phone)) {
    await audit(admin, "send_otp_rate_limited", phone);
    return json({ error: "Too many attempts. Try again in 10 minutes." }, 429);
  }

  const otp        = genOtp();
  const otpHash    = sha256(otp);
  const phoneHash  = sha256(phone);
  const expiresAt  = new Date(Date.now() + OTP_TTL_MS).toISOString();

  // Store OTP
  const { error: dbErr } = await admin.from("rald_phone_otps").insert({
    phone_hash: phoneHash,
    otp_hash:   otpHash,
    expires_at: expiresAt,
    attempts:   0,
    resends:    0,
  });
  if (dbErr) {
    console.error("[RALD/send] DB error:", dbErr);
    return json({ error: "Internal error" }, 500);
  }

  // Send via Termii
  const { ok, detail } = await sendSms(phone, otp);
  if (!ok) {
    console.error("[RALD/send] Termii error:", detail);
    await audit(admin, "send_otp_sms_failed", phone, { detail });
    return json({ error: "Failed to send SMS. Check Termii config." }, 502);
  }

  await audit(admin, "send_otp_success", phone);
  return json({ ok: true, message: "Code sent" });
}

// ── V1: Verify OTP ────────────────────────────────────────────────────────────
export async function handleVerifyOtp(request: Request): Promise<Response> {
  let body: Record<string, string>;
  try { body = await request.json() as Record<string, string>; }
  catch { return json({ error: "Invalid JSON" }, 400); }

  const raw = body.phone ?? "";
  const otp = (body.otp ?? "").trim();
  const mode = (body.mode ?? "signin") as "signin" | "join" | "reset";

  if (!raw || !otp) return json({ error: "phone and otp required" }, 400);

  const phone     = normalise(raw);
  const phoneHash = sha256(phone);
  const otpHash   = sha256(otp);
  const now       = new Date().toISOString();

  const admin = getAdmin();

  const { data: rows, error: fetchErr } = await admin
    .from("rald_phone_otps")
    .select("*")
    .eq("phone_hash", phoneHash)
    .gt("expires_at", now)
    .order("created_at", { ascending: false })
    .limit(1);

  if (fetchErr || !rows?.length) {
    await audit(admin, "verify_otp_not_found", phone);
    return json({ error: "Code expired or not found. Request a new one." }, 404);
  }

  const row = rows[0] as Record<string, unknown>;

  // V3: max attempts
  if ((row.attempts as number) >= MAX_ATTEMPTS) {
    await audit(admin, "verify_otp_locked", phone);
    return json({ error: "Too many failed attempts. Request a new code." }, 429);
  }

  if (row.otp_hash !== otpHash) {
    await admin.from("rald_phone_otps").update({ attempts: (row.attempts as number) + 1 }).eq("id", row.id);
    await audit(admin, "verify_otp_wrong", phone, { attempts: (row.attempts as number) + 1 });
    return json({ error: "Invalid code" }, 401);
  }

  // ── OTP correct — create or sign in Supabase user ─────────────────────────
  const email    = phoneToEmail(phone);
  const password = sha256(`rald:${phone}:${process.env.SUPABASE_SERVICE_ROLE_KEY}`);

  let userId: string | undefined;
  let accessToken: string | undefined;
  let refreshToken: string | undefined;

  if (mode === "join") {
    // Create new user
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      phone,
      email_confirm: true,
      phone_confirm: true,
      user_metadata: { phone, rald_auth: true },
    });
    if (createErr && createErr.message.includes("already registered")) {
      // User exists, sign in instead
    } else if (createErr) {
      console.error("[RALD/verify] create user error:", createErr);
      return json({ error: "Account creation failed" }, 500);
    } else {
      userId = created.user?.id;
    }
  }

  // Sign in (always — covers both signin and join)
  const { data: signIn, error: signInErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  // Fall back to email+password sign in via public client
  const pubUrl = process.env.SUPABASE_URL!;
  const pubKey = process.env.SUPABASE_PUBLISHABLE_KEY!;

  if (!pubKey) {
    // Return userId only (caller can use it for custom JWT)
    await admin.from("rald_phone_otps").delete().eq("id", row.id);
    await audit(admin, "verify_otp_success", phone, { mode });
    return json({ ok: true, phone, mode });
  }

  const pubClient = createClient(pubUrl, pubKey, { auth: { persistSession: false } });
  const { data: session, error: sessionErr } = await pubClient.auth.signInWithPassword({ email, password });

  if (sessionErr) {
    // User may not exist yet for signin mode — create then sign in
    await admin.auth.admin.createUser({ email, password, phone, email_confirm: true, phone_confirm: true });
    const { data: sess2, error: err2 } = await pubClient.auth.signInWithPassword({ email, password });
    if (err2) {
      console.error("[RALD/verify] final signin error:", err2);
      return json({ error: "Auth failed. Contact support." }, 500);
    }
    accessToken  = sess2.session?.access_token;
    refreshToken = sess2.session?.refresh_token;
    userId       = sess2.user?.id;
  } else {
    accessToken  = session.session?.access_token;
    refreshToken = session.session?.refresh_token;
    userId       = session.user?.id;
  }

  // Ensure messenger_profiles row
  if (userId) {
    await admin.from("messenger_profiles").upsert({
      user_id:  userId,
      phone,
      onboarding_completed: mode === "signin",
    }, { onConflict: "user_id", ignoreDuplicates: false });
  }

  // Delete used OTP
  await admin.from("rald_phone_otps").delete().eq("id", row.id);
  await audit(admin, "verify_otp_success", phone, { mode, userId });

  return json({ ok: true, access_token: accessToken, refresh_token: refreshToken, user_id: userId, mode });
}

// ── V3: Resend OTP ────────────────────────────────────────────────────────────
export async function handleResendOtp(request: Request): Promise<Response> {
  let body: Record<string, string>;
  try { body = await request.json() as Record<string, string>; }
  catch { return json({ error: "Invalid JSON" }, 400); }

  const phone = normalise(body.phone ?? "");
  if (!phone) return json({ error: "phone required" }, 400);

  const admin = getAdmin();

  if (await checkRateLimit(admin, phone)) {
    return json({ error: "Too many requests. Wait 10 minutes." }, 429);
  }

  // Delegate to send
  return handleSendOtp(new Request(request.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  }));
}

// ── V5: Logout ────────────────────────────────────────────────────────────────
export async function handleLogout(request: Request): Promise<Response> {
  const auth = request.headers.get("Authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/, "").trim();
  if (!token) return json({ ok: true });

  try {
    const url = process.env.SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const sb  = createClient(url, key, { auth: { persistSession: false } });
    await sb.auth.admin.signOut(token);
  } catch (e) {
    console.warn("[RALD/logout] sign-out error:", e);
  }

  return json({ ok: true });
}

// ── V4: Cleanup cron ─────────────────────────────────────────────────────────
export async function cleanExpiredOtps(): Promise<{ deleted: number; error: string | null }> {
  try {
    const admin = getAdmin();
    const now   = new Date().toISOString();
    const { error, count } = await admin
      .from("rald_phone_otps")
      .delete({ count: "exact" })
      .lt("expires_at", now);
    if (error) return { deleted: 0, error: error.message };
    return { deleted: count ?? 0, error: null };
  } catch (e) {
    return { deleted: 0, error: String(e) };
  }
}

// ── Router ────────────────────────────────────────────────────────────────────
const RALD_ROUTES: Record<string, (req: Request) => Promise<Response>> = {
  "/api/auth/send-otp":   handleSendOtp,
  "/api/auth/verify-otp": handleVerifyOtp,
  "/api/auth/resend-otp": handleResendOtp,
  "/api/auth/logout":     handleLogout,
};

export function matchRaldRoute(request: Request): ((req: Request) => Promise<Response>) | null {
  const url  = new URL(request.url);
  const path = url.pathname.replace(/\/$/, "");

  if (request.method === "OPTIONS" && path in RALD_ROUTES) {
    return () => Promise.resolve(new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin":  "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    }));
  }

  if (request.method !== "POST") return null;
  return RALD_ROUTES[path] ?? null;
}
