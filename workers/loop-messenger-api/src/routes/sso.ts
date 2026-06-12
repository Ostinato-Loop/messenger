// Loop Messenger API — RALD SSO Route
//
// POST /auth/rald-sso   { rald_token }  → validate + set rald_session cookie
// GET  /auth/me                         → identity from Bearer JWT
// GET  /auth/silent                     → cookie-based silent session + refresh TTL
// POST /auth/logout                     → clear cookie + fire global ecosystem logout
//
// COOKIE-001 (2026-06-09):
//   - POST /auth/rald-sso now sets rald_session HttpOnly cookie.
//   - GET  /auth/silent refreshes cookie TTL on every valid check.
//   - POST /auth/logout clears cookie and fires auth.rald.cloud/logout.
//   - Device registered in auth_devices on every SSO exchange (Sprint 2).
//
// FIX (session-ttl): POST /auth/rald-sso now re-signs a Messenger-scoped
//   session JWT with a full 7-day TTL. Previously it stored the incoming RALD
//   token directly — if that token was a 5-minute Loop handoff token, users
//   were logged out of Messenger after 5 minutes. The re-signed token is
//   returned in the response body as "token" so the frontend can store it.
//
// GLOBAL-LOGOUT-001 (2026-06-09): Messenger logout revokes the RALD ecosystem session.
//
// LILCKY STUDIO LIMITED

import { Hono } from "hono";
import { AppContext, authMiddleware } from "../lib/middleware";
import { verifyJwt, signJwt } from "../lib/auth";

export const sso = new Hono<AppContext>();

/* ── Cookie helpers ──────────────────────────────────────────────────── */

const MSG_COOKIE = "rald_session";

function buildSessionCookie(token: string, maxAgeSec: number): string {
  return `${MSG_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Domain=.rald.cloud; Path=/; Max-Age=${maxAgeSec}`;
}

function clearSessionCookie(): string {
  return `${MSG_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

function parseSessionCookie(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k?.trim() === MSG_COOKIE) return v.join("=").trim() || null;
  }
  return null;
}

/* ── Device registration (Sprint 2) ──────────────────────────────────── */

function parseUserAgent(ua: string): { deviceType: string; deviceName: string; os: string; browser: string } {
  const isIphone  = /iPhone/.test(ua);
  const isIpad    = /iPad/.test(ua);
  const isAndroid = /Android/.test(ua);
  const isMac     = /Macintosh/.test(ua);
  const isWindows = /Windows/.test(ua);
  const deviceType = (isIphone || isAndroid) ? "mobile" : isIpad ? "tablet" : "desktop";
  const os =
    isIphone  ? `iOS ${ua.match(/OS (\d+_\d+)/)?.[1]?.replace("_", ".") ?? ""}`.trim() :
    isAndroid ? `Android ${ua.match(/Android ([\d.]+)/)?.[1] ?? ""}`.trim() :
    isMac     ? "macOS" : isWindows ? "Windows" : "Other";
  const browser =
    /Edg\//.test(ua)     ? "Edge"    :
    /Chrome\//.test(ua)  ? "Chrome"  :
    /Safari\//.test(ua)  ? "Safari"  :
    /Firefox\//.test(ua) ? "Firefox" : "Unknown";
  const deviceName =
    isIphone ? "iPhone" : isIpad ? "iPad" : isAndroid ? "Android" :
    `${browser} on ${os}`;
  return { deviceType, deviceName, os, browser };
}

async function registerDevice(
  sbUrl: string, sbKey: string, userId: string, req: Request,
): Promise<void> {
  try {
    const ua      = req.headers.get("User-Agent") ?? "Unknown";
    const ip      = req.headers.get("CF-Connecting-IP")
                 ?? req.headers.get("X-Forwarded-For")?.split(",")[0]?.trim()
                 ?? "unknown";
    const city    = req.headers.get("cf-ipcity")    ?? null;
    const country = req.headers.get("cf-ipcountry") ?? null;
    const { deviceType, deviceName, os, browser } = parseUserAgent(ua);
    await fetch(`${sbUrl}/rest/v1/auth_devices`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:  `Bearer ${sbKey}`,
        apikey:         sbKey,
        Prefer:         "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        user_id:      userId,
        device_name:  deviceName,
        device_type:  deviceType,
        os,
        browser,
        ip_address:   ip,
        city,
        country,
        last_seen_at: new Date().toISOString(),
        is_trusted:   false,
      }),
    });
  } catch { /* non-fatal */ }
}

/* ── POST /auth/rald-sso ─────────────────────────────────────────────── */

sso.post("/auth/rald-sso", async (c) => {
  const body = await c.req.json<{ rald_token?: string }>().catch(() => ({}));
  if (!body.rald_token) {
    return c.json({ error: "rald_token is required" }, 400);
  }

  const rald = await verifyJwt(body.rald_token, c.env.RALD_JWT_SECRET);
  if (!rald) {
    return c.json({ error: "Invalid or expired RALD token" }, 401);
  }

  // FIX (session-ttl): Re-sign a Messenger-scoped session token with a full 7-day TTL.
  // The incoming rald_token may be a short-lived handoff token (e.g. 5-minute cross-app
  // token from loop.rald.cloud). Storing it verbatim caused users to be logged out of
  // Messenger 5 minutes after arriving from Loop. The re-signed token uses the same
  // RALD_JWT_SECRET so authMiddleware can verify it without changes.
  const TTL_7D = 60 * 60 * 24 * 7;
  const now    = Math.floor(Date.now() / 1000);
  const sessionToken = await signJwt(
    {
      id:     rald.id,
      email:  rald.email  ?? "",
      role:   rald.role   ?? "user",
      source: "messenger-sso",
      iat:    now,
      exp:    now + TTL_7D,
    },
    c.env.RALD_JWT_SECRET,
  );

  // Set HttpOnly cookie with the re-signed session token (7-day TTL)
  c.header("Set-Cookie", buildSessionCookie(sessionToken, TTL_7D));

  // Sprint 2: Register device (non-blocking)
  const sbUrl = c.env.SUPABASE_URL.replace(/\/$/, "");
  const sbKey = c.env.SUPABASE_SERVICE_ROLE_KEY;
  registerDevice(sbUrl, sbKey, rald.id, c.req.raw).catch(() => null);

  return c.json({
    authenticated: true,
    user:    { id: rald.id, email: rald.email ?? null, role: rald.role ?? "user" },
    token:   sessionToken,
    message: "Use the session token as Bearer for all Messenger API calls",
  });
});

/* ── GET /auth/me ────────────────────────────────────────────────────── */

sso.get("/auth/me", authMiddleware, async (c) => {
  const user = c.get("user");
  const db   = c.get("db");
  const email = user.email ?? "";

  const raw = (email.split("@")[0] ?? "").replace(/[._-]/g, " ").trim();
  const fallbackName = raw
    ? raw.replace(/\b\w/g, (l) => l.toUpperCase())
    : "RALD User";

  let displayName = fallbackName;
  let avatar: string | null = null;
  let bio: string | null = null;
  let username: string | null = null;

  try {
    const { data } = await db
      .from("profiles")
      .select("display_name,username,avatar_url,bio")
      .eq("id", user.id)
      .single();
    if (data) {
      displayName = (data.display_name as string | null) ?? (data.username as string | null) ?? fallbackName;
      avatar      = (data.avatar_url as string | null) ?? null;
      bio         = (data.bio as string | null) ?? null;
      username    = (data.username as string | null) ?? null;
    }
  } catch { /* profiles unavailable — use fallback */ }

  return c.json({
    id: user.id, phone: email || null, username, displayName, bio, avatar,
    isOnline: true, lastSeen: null, createdAt: new Date().toISOString(),
    role: user.role ?? "user", source: user.source ?? "rald",
  });
});

/* ── GET /auth/silent ────────────────────────────────────────────────── */
/**
 * Cookie-based silent session. Refreshes cookie TTL on every valid check.
 * COOKIE-001 (2026-06-09): Now also refreshes the cookie TTL.
 */
sso.get("/auth/silent", async (c) => {
  const cookieHeader = c.req.header("Cookie");
  const token = parseSessionCookie(cookieHeader);
  if (!token) {
    return c.json({ valid: false, reason: "no_session_cookie" }, 401);
  }
  const rald = await verifyJwt(token, c.env.RALD_JWT_SECRET);
  if (!rald) {
    c.header("Set-Cookie", clearSessionCookie());
    return c.json({ valid: false, reason: "invalid_or_expired_token" }, 401);
  }

  // COOKIE-001: Refresh cookie TTL (rolling 7-day window)
  const TTL_7D = 60 * 60 * 24 * 7;
  c.header("Set-Cookie", buildSessionCookie(token, TTL_7D));

  return c.json({
    valid: true,
    user:  { id: rald.id, email: rald.email ?? null, role: rald.role ?? "user" },
    token,
  });
});

/* ── POST /auth/logout ───────────────────────────────────────────────── */
/**
 * Clear the Messenger session cookie and fire a non-blocking ecosystem logout.
 *
 * COOKIE-001: Clears rald_session HttpOnly cookie.
 * GLOBAL-LOGOUT-001: Fires auth.rald.cloud/logout — revokes RALD ecosystem session.
 *
 * Accepts Bearer OR cookie for authorization (so logout works even if the
 * Bearer token is stale but the cookie is still valid).
 */
sso.post("/auth/logout", async (c) => {
  const authHeader = c.req.header("Authorization");
  let token: string | null = null;
  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.slice(7);
  } else {
    token = parseSessionCookie(c.req.header("Cookie"));
  }

  // Clear cookie regardless of whether we have a valid token
  c.header("Set-Cookie", clearSessionCookie());

  // GLOBAL-LOGOUT-001: Non-blocking ecosystem session revocation
  if (token) {
    fetch("https://auth.rald.cloud/logout", {
      method:  "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    }).catch(() => null);
  }

  return c.json({ ok: true, message: "Logged out" });
});
