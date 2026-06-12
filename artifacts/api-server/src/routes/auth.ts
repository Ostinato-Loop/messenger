import { createHmac, timingSafeEqual } from "crypto";
import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { usersTable, otpRequestsTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import { z } from "zod";
import { logger } from "../lib/logger";
import { sendTermiiOtp } from "../lib/termii";

declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

const router = Router();

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0") && digits.length === 11) {
    return "+234" + digits.slice(1);
  }
  if (!phone.startsWith("+")) {
    return "+" + digits;
  }
  return phone;
}

/**
 * Verify a RALD JWT (HS256) using the shared RALD_JWT_SECRET.
 * Uses Node's built-in crypto — no external JWT library required.
 * Throws on invalid signature, malformed token, or expiry.
 */
function verifyRaldJwt(token: string): Record<string, unknown> {
  const secret = process.env.RALD_JWT_SECRET;
  if (!secret) throw new Error("RALD_JWT_SECRET not configured");

  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Malformed JWT");

  const [headerB64, payloadB64, sigB64] = parts;

  const expected = createHmac("sha256", secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest("base64url");

  let valid = false;
  try {
    valid = timingSafeEqual(Buffer.from(sigB64), Buffer.from(expected));
  } catch {
    throw new Error("Invalid token signature");
  }
  if (!valid) throw new Error("Invalid token signature");

  const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));

  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Token expired");
  }

  return payload;
}

// ── POST /auth/send-otp ───────────────────────────────────────────────────────
router.post("/send-otp", async (req: Request, res: Response) => {
  const schema = z.object({ phone: z.string().min(8) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return void res.status(400).json({ error: "Invalid phone number" });
  }

  const phone = normalizePhone(parsed.data.phone);

  // Rate limit: block if a valid OTP already exists
  const recent = await db
    .select()
    .from(otpRequestsTable)
    .where(
      and(
        eq(otpRequestsTable.phone, phone),
        gt(otpRequestsTable.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (recent.length > 0) {
    const secondsLeft = Math.ceil(
      (recent[0].expiresAt.getTime() - Date.now()) / 1000,
    );
    return void res.status(429).json({
      error: "OTP already sent. Please wait before requesting a new one.",
      cooldownSeconds: secondsLeft,
    });
  }

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  const [inserted] = await db
    .insert(otpRequestsTable)
    .values({ phone, code, expiresAt })
    .returning();

  const smsResult = await sendTermiiOtp(phone, code);

  if (!smsResult.ok) {
    logger.warn({ errMsg: smsResult.error }, "SMS OTP delivery failed");

    if (process.env.NODE_ENV !== "production") {
      // Dev mode: keep OTP in DB so devOtp can still be verified
      return void res.json({
        message: "OTP sent (dev mode — SMS skipped)",
        cooldownSeconds: 600,
        devOtp: code,
      });
    }

    // Production: roll back so user can retry immediately
    await db.delete(otpRequestsTable).where(eq(otpRequestsTable.id, inserted.id));
    return void res.status(502).json({
      error: "SMS delivery failed. Please try again.",
    });
  }

  return void res.json({ message: "OTP sent successfully", cooldownSeconds: 600 });
});

// ── POST /auth/verify-otp ────────────────────────────────────────────────────
router.post("/verify-otp", async (req: Request, res: Response) => {
  const schema = z.object({ phone: z.string(), code: z.string() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return void res.status(400).json({ error: "Invalid request" });
  }

  const phone = normalizePhone(parsed.data.phone);

  const otpRecord = await db
    .select()
    .from(otpRequestsTable)
    .where(
      and(
        eq(otpRequestsTable.phone, phone),
        gt(otpRequestsTable.expiresAt, new Date()),
      ),
    )
    .orderBy(otpRequestsTable.createdAt)
    .limit(1);

  if (otpRecord.length === 0) {
    return void res
      .status(400)
      .json({ error: "OTP expired or not found. Please request a new one." });
  }

  const otp = otpRecord[0];

  if (otp.attempts >= 5) {
    await db.delete(otpRequestsTable).where(eq(otpRequestsTable.id, otp.id));
    return void res
      .status(400)
      .json({ error: "Too many attempts. Please request a new OTP." });
  }

  if (otp.code !== parsed.data.code) {
    await db
      .update(otpRequestsTable)
      .set({ attempts: otp.attempts + 1 })
      .where(eq(otpRequestsTable.id, otp.id));
    return void res.status(400).json({ error: "Invalid OTP code." });
  }

  // Valid OTP — delete it and create/find user
  await db.delete(otpRequestsTable).where(eq(otpRequestsTable.id, otp.id));

  let user = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.phone, phone))
    .limit(1);

  let isNewUser = false;
  if (user.length === 0) {
    const created = await db
      .insert(usersTable)
      .values({
        phone,
        displayName: phone.replace("+", "").slice(-8),
        isOnline: true,
      })
      .returning();
    user = created;
    isNewUser = true;
  } else {
    await db
      .update(usersTable)
      .set({ isOnline: true, lastSeen: new Date() })
      .where(eq(usersTable.id, user[0].id));
  }

  const u = user[0];
  req.session.userId = u.id;

  return void res.json({
    user: {
      id: u.id,
      phone: u.phone,
      displayName: u.displayName,
      bio: u.bio,
      avatar: u.avatar,
      isOnline: true,
      lastSeen: u.lastSeen?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString(),
    },
    isNewUser,
  });
});

// ── POST /auth/rald-sso ───────────────────────────────────────────────────────
//
// Phase 1 RALD SSO bridge (additive — phone-OTP auth is unchanged).
//
// Accepts a RALD JWT (issued by auth.rald.cloud / rald-auth-core).
// Looks up the Messenger user in order:
//   1. By rald_id = sub     → returning linked user (fast path)
//   2. By phone             → existing phone user, links rald_id (bridge)
//   3. Creates new user     → phone required in token; falls back to placeholder
//
// Sets the standard Express session (req.session.userId) so all downstream
// middleware and socket auth work identically to the OTP path.
//
// Required env: RALD_JWT_SECRET (shared HS256 secret with rald-auth-core)
//
router.post("/rald-sso", async (req: Request, res: Response) => {
  const schema = z.object({ rald_token: z.string().min(10) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return void res.status(400).json({ error: "rald_token is required" });
  }

  let payload: Record<string, unknown>;
  try {
    payload = verifyRaldJwt(parsed.data.rald_token);
  } catch (err) {
    logger.warn({ err }, "RALD SSO: JWT verification failed");
    return void res.status(401).json({ error: "Invalid or expired RALD token" });
  }

  const raldId = payload.sub as string | undefined;
  if (!raldId) {
    return void res.status(400).json({ error: "RALD token missing sub claim" });
  }

  const raldPhone =
    typeof payload.phone === "string" ? normalizePhone(payload.phone) : null;
  const raldDisplayName =
    typeof payload.display_name === "string"
      ? payload.display_name
      : typeof payload.username === "string"
        ? payload.username
        : null;

  try {
    // ── 1. Fast path: already linked ─────────────────────────────────────────
    const byRaldId = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.raldId, raldId))
      .limit(1);

    if (byRaldId.length > 0) {
      const u = byRaldId[0];
      await db
        .update(usersTable)
        .set({ isOnline: true, lastSeen: new Date() })
        .where(eq(usersTable.id, u.id));
      req.session.userId = u.id;
      logger.info({ userId: u.id, raldId }, "RALD SSO: existing linked user");
      return void res.json({
        user: formatUser({ ...u, isOnline: true }),
        linked: false,
        isNewUser: false,
      });
    }

    // ── 2. Bridge: phone match — link rald_id to existing account ────────────
    if (raldPhone) {
      const byPhone = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.phone, raldPhone))
        .limit(1);

      if (byPhone.length > 0) {
        const u = byPhone[0];
        await db
          .update(usersTable)
          .set({ raldId, isOnline: true, lastSeen: new Date() })
          .where(eq(usersTable.id, u.id));
        req.session.userId = u.id;
        logger.info({ userId: u.id, raldId }, "RALD SSO: phone-matched, rald_id linked");
        return void res.json({
          user: formatUser({ ...u, raldId, isOnline: true }),
          linked: true,
          isNewUser: false,
        });
      }
    }

    // ── 3. Create new Messenger user ─────────────────────────────────────────
    if (!raldPhone) {
      // RALD token has no phone — cannot create a phoneless Messenger account
      // without schema changes. Require phone OTP first, then link via
      // POST /auth/rald-sso/link.
      return void res.status(409).json({
        error: "No Messenger account found for this RALD identity. " +
          "Complete phone verification first, then POST /auth/rald-sso/link.",
        code: "PHONE_REQUIRED",
      });
    }

    const displayName = raldDisplayName ?? raldPhone.replace("+", "").slice(-8);
    const [created] = await db
      .insert(usersTable)
      .values({ phone: raldPhone, displayName, raldId, isOnline: true })
      .returning();

    req.session.userId = created.id;
    logger.info({ userId: created.id, raldId }, "RALD SSO: new user created");
    return void res.json({
      user: formatUser(created),
      linked: true,
      isNewUser: true,
    });
  } catch (err) {
    logger.error({ err }, "RALD SSO: database error");
    return void res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /auth/rald-sso/link ─────────────────────────────────────────────────
//
// Links an active Messenger session (established via phone-OTP) to a RALD
// identity. Safe to call repeatedly — idempotent if already linked to the
// same rald_id.
//
// Flow: user completes phone-OTP → calls this with their RALD token →
//       rald_id written to their row → future logins use the fast path above.
//
router.post("/rald-sso/link", async (req: Request, res: Response) => {
  const userId = req.session.userId;
  if (!userId) {
    return void res.status(401).json({ error: "Unauthorized — complete phone login first" });
  }

  const schema = z.object({ rald_token: z.string().min(10) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return void res.status(400).json({ error: "rald_token is required" });
  }

  let payload: Record<string, unknown>;
  try {
    payload = verifyRaldJwt(parsed.data.rald_token);
  } catch (err) {
    logger.warn({ err }, "RALD SSO link: JWT verification failed");
    return void res.status(401).json({ error: "Invalid or expired RALD token" });
  }

  const raldId = payload.sub as string | undefined;
  if (!raldId) {
    return void res.status(400).json({ error: "RALD token missing sub claim" });
  }

  try {
    // Conflict check: is this rald_id already linked to a *different* account?
    const conflict = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.raldId, raldId))
      .limit(1);

    if (conflict.length > 0 && conflict[0].id !== userId) {
      return void res.status(409).json({
        error: "This RALD identity is already linked to a different account",
        code: "RALD_ID_CONFLICT",
      });
    }

    const [updated] = await db
      .update(usersTable)
      .set({ raldId })
      .where(eq(usersTable.id, userId))
      .returning();

    logger.info({ userId, raldId }, "RALD SSO link: rald_id linked to session user");
    return void res.json({ ok: true, raldId, user: formatUser(updated) });
  } catch (err) {
    logger.error({ err }, "RALD SSO link: database error");
    return void res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /auth/me ─────────────────────────────────────────────────────────────
router.get("/me", async (req: Request, res: Response) => {
  const userId = req.session.userId;
  if (!userId) {
    return void res.status(401).json({ error: "Unauthorized" });
  }

  const user = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (user.length === 0) {
    return void res.status(401).json({ error: "User not found" });
  }

  return void res.json(formatUser(user[0]));
});

// ── POST /auth/logout ─────────────────────────────────────────────────────────
router.post("/logout", async (req: Request, res: Response) => {
  const userId = req.session.userId;
  if (userId) {
    await db
      .update(usersTable)
      .set({ isOnline: false, lastSeen: new Date() })
      .where(eq(usersTable.id, userId));
  }
  req.session.destroy(() => {});
  return void res.json({ ok: true });
});

// ── PATCH /auth/profile ───────────────────────────────────────────────────────
router.patch("/profile", async (req: Request, res: Response) => {
  const userId = req.session.userId;
  if (!userId) {
    return void res.status(401).json({ error: "Unauthorized" });
  }

  const schema = z.object({
    displayName: z.string().min(1).optional(),
    bio: z.string().nullable().optional(),
    avatar: z.string().nullable().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return void res.status(400).json({ error: "Invalid input" });
  }

  const [updated] = await db
    .update(usersTable)
    .set(parsed.data)
    .where(eq(usersTable.id, userId))
    .returning();

  return void res.json(formatUser(updated));
});

// ── Shared serializer ─────────────────────────────────────────────────────────
function formatUser(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    phone: u.phone,
    displayName: u.displayName,
    bio: u.bio,
    avatar: u.avatar,
    isOnline: u.isOnline,
    lastSeen: u.lastSeen?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
    raldId: u.raldId ?? null,
  };
}

export default router;
