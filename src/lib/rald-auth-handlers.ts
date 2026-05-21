/**
   * RALD Auth — Pure Cloudflare Worker request handlers.
   * Imported directly by src/server.ts so they bypass the TanStack Start
   * file-route system entirely and are guaranteed to run in the Worker.
   *
   * All handlers: (request: Request) => Promise<Response>
   */

  import { createClient } from "@supabase/supabase-js";
  import { createHash, randomInt } from "node:crypto";

  // ─── Config ────────────────────────────────────────────────────────────────

  const OTP_TTL_MS     = 5 * 60 * 1000;
  const MAX_ATTEMPTS   = 5;
  const MAX_RESENDS    = 3;
  const RATE_WINDOW_MS = 10 * 60 * 1000;

  // ─── Helpers ───────────────────────────────────────────────────────────────

  function getAdmin() {
    const url = process.env.SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!url || !key) throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set");
    return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
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
      },
    });
  }

  async function audit(
    admin: ReturnType<typeof getAdmin>,
    action: string,
    phone: string,
    meta: Record<string, unknown> = {},
  ) {
    await admin.from("rald_audit_logs").insert({
      action,
      resource_type: "phone_otp",
      resource_id: phone,
      metadata: { phone, ...meta },
    }).then(() => void 0).catch(() => void 0);
  }

  async function sendSms(to: string, otp: string): Promise<{ ok: boolean; detail: unknown }> {
    const base    = (process.env.TERMII_BASE_URL ?? "https://v3.api.termii.com").replace(/\/$/, "");
    const apiKey  = process.env.TERMII_API_KEY!;
    const from    = process.env.TERMII_SENDER_ID ?? "Ostloop";
    const channel = process.env.TERMII_CHANNEL    ?? "generic";
    const toNum   = to.replace(/^\+/, "");

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
            sms: `Your Loop Messenger code is ${otp}. Valid 5 mins. Do not share.`,
            type: "plain", channel: s.channel,
          }),
        });
        const d = await r.json() as Record<string, unknown>;
        if (r.ok) return { ok: true, detail: d };
        last = d;
        const msg = String(d?.message ?? "");
        if (!msg.includes("ApplicationSenderId") && !msg.includes("SenderName")) {
          return { ok: false, detail: d };
        }
        console.warn(`[RALD] sender '${s.from}' rejected (${msg}), retrying…`);
      } catch (e) { last = { error: String(e) }; }
    }
    return { ok: false, detail: last };
  }

  type AUser = { id: string; phone?: string | null; email?: string | null };

  async function getOrCreate(
    admin: ReturnType<typeof getAdmin>,
    phone: string,
  ): Promise<{ user: AUser | null; error: unknown }> {
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

  // ─── Handlers ──────────────────────────────────────────────────────────────

  export async function handleSendOtp(request: Request): Promise<Response> {
    let body: { phone?: string };
    try { body = await request.json() as { phone?: string }; }
    catch { return json({ error: "Invalid JSON" }, 400); }

    if (!body?.phone?.trim()) return json({ error: "phone is required" }, 400);

    const phone = normalise(body.phone);
    const admin = getAdmin();

    const windowStart = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
    const { count } = await admin
      .from("rald_phone_otps")
      .select("*", { count: "exact", head: true })
      .eq("phone", phone)
      .gte("created_at", windowStart);

    if ((count ?? 0) >= MAX_RESENDS) {
      await audit(admin, "send_otp_rate_limited", phone);
      return json({ error: "Too many requests. Please wait 10 minutes." }, 429);
    }

    const otp       = genOtp();
    const codeHash  = sha256(otp);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

    const { error: insertErr } = await admin
      .from("rald_phone_otps")
      .insert({ phone, code_hash: codeHash, expires_at: expiresAt, attempts: 0 });

    if (insertErr) {
      console.error("[RALD/send-otp] DB:", insertErr);
      return json({ error: "Failed to create OTP" }, 500);
    }

    const { ok, detail } = await sendSms(phone, otp);
    if (!ok) {
      console.error("[RALD/send-otp] SMS failed:", detail);
      await admin.from("rald_phone_otps").delete().eq("phone", phone).eq("code_hash", codeHash);
      await audit(admin, "send_otp_sms_failed", phone, { detail: detail as Record<string, unknown> });
      return json({ error: "SMS delivery failed. Please try again." }, 502);
    }

    await audit(admin, "send_otp_success", phone);
    return json({ ok: true, message: "OTP sent" });
  }

  export async function handleVerifyOtp(request: Request): Promise<Response> {
    let body: { phone?: string; otp?: string };
    try { body = await request.json() as { phone?: string; otp?: string }; }
    catch { return json({ error: "Invalid JSON" }, 400); }

    if (!body?.phone?.trim() || !body?.otp?.trim()) {
      return json({ error: "phone and otp are required" }, 400);
    }

    const phone = normalise(body.phone);
    const admin = getAdmin();

    const { data: rec, error: fetchErr } = await admin
      .from("rald_phone_otps")
      .select("*")
      .eq("phone", phone)
      .is("consumed_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

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
        error: remaining > 0
          ? `Wrong code. ${remaining} attempt${remaining !== 1 ? "s" : ""} left.`
          : "Too many failed attempts. Request a new code.",
        remaining,
      }, 400);
    }

    await admin.from("rald_phone_otps").update({ consumed_at: new Date().toISOString() }).eq("id", r.id);

    const { user, error: userErr } = await getOrCreate(admin, phone);
    if (userErr || !user) {
      console.error("[RALD/verify-otp] user error:", userErr);
      return json({ error: "Failed to create account" }, 500);
    }

    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: phoneToEmail(phone),
    });

    if (linkErr || !link?.properties?.hashed_token) {
      console.error("[RALD/verify-otp] link error:", linkErr);
      return json({ error: "Failed to generate session token" }, 500);
    }

    await audit(admin, "verify_otp_success", phone, { userId: user.id });
    return json({ ok: true, token: link.properties.hashed_token, userId: user.id });
  }

  export async function handleResendOtp(request: Request): Promise<Response> {
    let body: { phone?: string };
    try { body = await request.json() as { phone?: string }; }
    catch { return json({ error: "Invalid JSON" }, 400); }

    if (!body?.phone?.trim()) return json({ error: "phone is required" }, 400);

    const phone = normalise(body.phone);
    const admin = getAdmin();

    const windowStart = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
    const { count } = await admin
      .from("rald_phone_otps")
      .select("*", { count: "exact", head: true })
      .eq("phone", phone)
      .gte("created_at", windowStart);

    if ((count ?? 0) >= MAX_RESENDS) {
      await audit(admin, "resend_otp_rate_limited", phone);
      return json({ error: "Too many requests. Please wait 10 minutes." }, 429);
    }

    const otp = genOtp();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();
    await admin.from("rald_phone_otps").insert({ phone, code_hash: sha256(otp), expires_at: expiresAt, attempts: 0 });

    const { ok, detail } = await sendSms(phone, otp);
    if (!ok) {
      await audit(admin, "resend_otp_sms_failed", phone, { detail: detail as Record<string, unknown> });
      return json({ error: "SMS delivery failed. Please try again." }, 502);
    }

    await audit(admin, "resend_otp_success", phone);
    return json({ ok: true, message: "New OTP sent" });
  }

  export async function handleLogout(request: Request): Promise<Response> {
    const auth = request.headers.get("authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json({ error: "No token provided" }, 401);
    const token = auth.slice(7);
    const admin = getAdmin();
    const { error } = await admin.auth.admin.signOut(token, "global");
    if (error) { console.error("[RALD/logout]", error); return json({ error: "Logout failed" }, 500); }
    return json({ ok: true });
  }

  // ─── Cron: OTP Cleanup ─────────────────────────────────────────────────────

  /**
   * Deletes all expired OTP records from rald_phone_otps.
   * Called by the Cloudflare Worker scheduled handler (daily at 02:00 UTC).
   * Prevents unbounded table growth in production.
   */
  export async function cleanExpiredOtps(): Promise<{ deleted: number; error: string | null }> {
    try {
      const admin = getAdmin();
      const now   = new Date().toISOString();

      const { error, count } = await admin
        .from("rald_phone_otps")
        .delete({ count: "exact" })
        .lt("expires_at", now);

      if (error) {
        console.error("[RALD/cron] DB cleanup error:", error);
        return { deleted: 0, error: error.message };
      }

      const deleted = count ?? 0;
      console.log(`[RALD/cron] cleaned ${deleted} expired OTP record(s)`);
      return { deleted, error: null };
    } catch (e) {
      console.error("[RALD/cron] unexpected error:", e);
      return { deleted: 0, error: String(e) };
    }
  }

  // ─── Router ────────────────────────────────────────────────────────────────

  const RALD_ROUTES: Record<string, (req: Request) => Promise<Response>> = {
    "/api/auth/send-otp":   handleSendOtp,
    "/api/auth/verify-otp": handleVerifyOtp,
    "/api/auth/resend-otp": handleResendOtp,
    "/api/auth/logout":     handleLogout,
  };

  export function matchRaldRoute(request: Request): ((req: Request) => Promise<Response>) | null {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      const path = url.pathname.replace(/\/$/, "");
      if (path in RALD_ROUTES) {
        return () => Promise.resolve(new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        }));
      }
    }

    if (request.method !== "POST") return null;

    const path = url.pathname.replace(/\/$/, "");
    return RALD_ROUTES[path] ?? null;
  }
  