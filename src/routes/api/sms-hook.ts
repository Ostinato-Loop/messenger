/**
 * RALD Auth — SMS delivery hook for Supabase custom SMS provider.
 *
 * Configure Supabase:  Auth → SMS Providers → Custom
 *   Webhook URL:    https://<your-worker>.workers.dev/api/sms-hook
 *   HTTP method:    POST
 *
 * Supabase sends: { phone: "+234...", otp: "123456" }
 * We relay via Termii (branded as RALD Auth for Loop Messenger).
 */
import { createAPIFileRoute } from "@tanstack/react-start/api";

const TERMII_BASE = "https://api.ng.termii.com";

export const APIRoute = createAPIFileRoute("/api/sms-hook")({
  POST: async ({ request }) => {
    const TERMII_API_KEY = process.env.TERMII_API_KEY;
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

    // Normalise to E.164 digits only (Termii wants no leading +)
    const to = phone.replace(/^\+/, "").replace(/\D/g, "");

    const res = await fetch(`${TERMII_BASE}/api/sms/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: TERMII_API_KEY,
        to,
        from: "Loop",
        sms: `Your Loop Messenger verification code is ${otp}. Valid for 10 minutes. Do not share.`,
        type: "plain",
        channel: "generic",
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
