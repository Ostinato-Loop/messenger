/**
 * RALD Auth — SMS delivery hook (legacy Supabase custom SMS provider fallback).
 * Primary OTP flow is now handled by the RALD Auth API (/api/auth/send-otp).
 *
 * This endpoint is kept for compatibility if Supabase custom SMS is configured.
 * Configure Supabase: Auth → SMS Providers → Custom
 *   Webhook URL: https://<your-worker>.workers.dev/api/sms-hook
 */
import { createAPIFileRoute } from "@tanstack/react-start/api";

const TERMII_BASE = (process.env.TERMII_BASE_URL || "https://v3.api.termii.com").replace(/\/$/, "");

export const APIRoute = createAPIFileRoute("/api/sms-hook")({
  POST: async ({ request }) => {
    const TERMII_API_KEY = process.env.TERMII_API_KEY;
    const TERMII_SENDER_ID = process.env.TERMII_SENDER_ID || "Ostloop";
    const TERMII_CHANNEL = process.env.TERMII_CHANNEL || "generic";

    if (!TERMII_API_KEY) {
      console.error("[RALD/sms-hook] TERMII_API_KEY not set");
      return new Response(
        JSON.stringify({ error: "SMS service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    let body: { phone?: string; otp?: string };
    try {
      body = (await request.json()) as { phone?: string; otp?: string };
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { phone, otp } = body;
    if (!phone || !otp) {
      return new Response(
        JSON.stringify({ error: "phone and otp are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const to = phone.replace(/^\+/, "").replace(/\D/g, "");

    const res = await fetch(`${TERMII_BASE}/api/sms/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: TERMII_API_KEY,
        to,
        from: TERMII_SENDER_ID,
        sms: `Your Loop Messenger (RALD Auth) code is ${otp}. Valid 5 mins. Do not share.`,
        type: "plain",
        channel: TERMII_CHANNEL,
      }),
    });

    const data = (await res.json()) as Record<string, unknown>;

    if (!res.ok) {
      console.error("[RALD/sms-hook] Termii error:", data);
      return new Response(JSON.stringify({ error: "SMS delivery failed", detail: data }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, detail: data }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  },
});
