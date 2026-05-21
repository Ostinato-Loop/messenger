import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { matchRaldRoute, cleanExpiredOtps } from "@/lib/rald-auth-handlers";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => ((m as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry)),
    );
  }
  return serverEntryPromise;
}

function brandedErrorResponse(): Response {
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isCatastrophicSsrErrorBody(body: string, responseStatus: number): boolean {
  let payload: unknown;
  try { payload = JSON.parse(body); } catch { return false; }
  if (!payload || Array.isArray(payload) || typeof payload !== "object") return false;
  const fields = payload as Record<string, unknown>;
  const expectedKeys = new Set(["message", "status", "unhandled"]);
  if (!Object.keys(fields).every((key) => expectedKeys.has(key))) return false;
  return (
    fields.unhandled === true &&
    fields.message === "HTTPError" &&
    (fields.status === undefined || fields.status === responseStatus)
  );
}

async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;
  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) return response;
  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return brandedErrorResponse();
}

export default {
  // ── HTTP requests ─────────────────────────────────────────────────────────
  async fetch(request: Request, env: unknown, ctx: unknown) {
    // Inject env secrets into process.env for RALD handlers
    if (env && typeof env === "object") {
      const e = env as Record<string, string>;
      for (const key of [
        "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_PUBLISHABLE_KEY",
        "TERMII_API_KEY", "TERMII_BASE_URL", "TERMII_SENDER_ID", "TERMII_CHANNEL",
      ]) {
        if (e[key] && !process.env[key]) process.env[key] = e[key];
      }
    }

    // RALD Auth API — intercepted before TanStack Start
    try {
      const raldHandler = matchRaldRoute(request);
      if (raldHandler) return await raldHandler(request);
    } catch (error) {
      console.error("[RALD/server] handler error:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Everything else → TanStack Start (SSR + static assets)
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return brandedErrorResponse();
    }
  },

  // ── Cron trigger (daily at 02:00 UTC) ────────────────────────────────────
  async scheduled(_event: unknown, _env: unknown, ctx: { waitUntil: (p: Promise<unknown>) => void }): Promise<void> {
    ctx.waitUntil(
      cleanExpiredOtps().then(({ deleted, error }) => {
        if (error) console.error("[cron/cleanup] OTP cleanup failed:", error);
        else console.log(`[cron/cleanup] deleted ${deleted} expired OTP record(s)`);
      }),
    );
  },
};
