export interface Env {
  TERMII_API_KEY?: string;
  TERMII_SENDER_ID?: string;
  API_ORIGIN?: string;
  ALLOWED_ORIGINS?: string;
}

const ALWAYS_ALLOWED = [
  "https://messenger.rald.cloud",
  "https://loop-messenger.pages.dev",
];

function resolveCorsOrigin(origin: string | null, env: Env): string {
  if (!origin) return ALWAYS_ALLOWED[0];
  const extras = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const all = [...ALWAYS_ALLOWED, ...extras];
  const ok =
    all.includes(origin) ||
    /^https:\/\/[\w-]+\.rald\.cloud$/.test(origin) ||
    origin.endsWith(".pages.dev") ||
    origin === "http://localhost:3000" ||
    origin === "http://localhost:5173";
  return ok ? origin : ALWAYS_ALLOWED[0];
}

function corsHeaders(origin: string | null, env: Env): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": resolveCorsOrigin(origin, env),
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Cookie, X-Requested-With",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function jsonResponse(data: unknown, status: number, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...extra },
  });
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0") && digits.length === 11) return "+234" + digits.slice(1);
  if (!phone.startsWith("+")) return "+" + digits;
  return phone;
}

async function handleSmsHook(
  request: Request,
  env: Env,
  cors: Record<string, string>,
): Promise<Response> {
  if (!env.TERMII_API_KEY) {
    return jsonResponse({ error: "SMS service not configured" }, 503, cors);
  }

  let body: { phone?: string; message?: string };
  try {
    body = await request.json<{ phone?: string; message?: string }>();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400, cors);
  }

  if (!body.phone || !body.message) {
    return jsonResponse({ error: "phone and message are required" }, 400, cors);
  }

  const phone = normalizePhone(body.phone);

  const termiiRes = await fetch("https://v3.api.termii.com/api/sms/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: phone,
      from: env.TERMII_SENDER_ID ?? "Ostloop",
      sms: body.message,
      type: "plain",
      channel: "dnd",
      api_key: env.TERMII_API_KEY,
    }),
  });

  const result = (await termiiRes.json()) as Record<string, unknown>;
  const termiiOk = !!(result.message_id || result.code === "ok");
  return new Response(JSON.stringify(result), {
    status: termiiOk ? 200 : 502,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

async function proxyToApi(
  request: Request,
  url: URL,
  env: Env,
  cors: Record<string, string>,
): Promise<Response> {
  const origin = env.API_ORIGIN?.replace(/\/$/, "") || "";
  if (!origin) {
    return jsonResponse({ error: "API origin not configured" }, 503, cors);
  }

  const target = `${origin}${url.pathname}${url.search}`;

  const proxyHeaders = new Headers(request.headers);
  proxyHeaders.set("X-Forwarded-For", request.headers.get("CF-Connecting-IP") || "");
  proxyHeaders.set("X-Real-IP", request.headers.get("CF-Connecting-IP") || "");
  proxyHeaders.set("X-Forwarded-Proto", "https");
  proxyHeaders.delete("host");

  const proxyReq = new Request(target, {
    method: request.method,
    headers: proxyHeaders,
    body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
    redirect: "follow",
  });

  let res: Response;
  try {
    res = await fetch(proxyReq);
  } catch {
    return jsonResponse({ error: "Upstream API unavailable. Please try again." }, 503, cors);
  }

  const resHeaders = new Headers(res.headers);
  Object.entries(cors).forEach(([k, v]) => resHeaders.set(k, v));
  resHeaders.set("X-Powered-By", "Loop Messenger / RALD Infra");
  resHeaders.delete("transfer-encoding");

  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: resHeaders,
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const cors = corsHeaders(origin, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    if (url.pathname === "/health" || url.pathname === "/api/healthz") {
      return jsonResponse(
        { status: "ok", worker: "loop-messenger-api", domain: "messenger.rald.cloud", ts: Date.now() },
        200,
        cors,
      );
    }

    if (url.pathname === "/api/sms-hook" && request.method === "POST") {
      return handleSmsHook(request, env, cors);
    }

    return proxyToApi(request, url, env, cors);
  },
};
