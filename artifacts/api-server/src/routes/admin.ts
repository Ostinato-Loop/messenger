import { Router, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import {
  usersTable,
  messagesTable,
  otpRequestsTable,
  conversationsTable,
} from "@workspace/db";
import { count, gte, eq, desc, ilike, or, sql } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

// ── Admin Auth Middleware ─────────────────────────────────────────────────────

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const userId = (req.session as any).userId as number | undefined;
  if (!userId) return void res.status(401).json({ error: "Unauthorized" });

  try {
    const [user] = await db
      .select({ id: usersTable.id, phone: usersTable.phone, displayName: usersTable.displayName })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!user) return void res.status(401).json({ error: "Unauthorized" });

    const adminPhones = (process.env.ADMIN_PHONES ?? "")
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);

    if (adminPhones.length > 0 && !adminPhones.includes(user.phone)) {
      return void res.status(403).json({ error: "Forbidden — not an admin" });
    }

    (req as any).adminUser = user;
    next();
  } catch (err) {
    logger.error({ err }, "Admin middleware error");
    next(err);
  }
}

router.use(requireAdmin);

// ── GET /admin/stats ──────────────────────────────────────────────────────────

router.get("/stats", async (_req: Request, res: Response) => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);

  const [totalUsers]         = await db.select({ count: count() }).from(usersTable);
  const [todayUsers]         = await db.select({ count: count() }).from(usersTable).where(gte(usersTable.createdAt, todayStart));
  const [onlineUsers]        = await db.select({ count: count() }).from(usersTable).where(eq(usersTable.isOnline, true));
  const [totalMessages]      = await db.select({ count: count() }).from(messagesTable);
  const [todayMessages]      = await db.select({ count: count() }).from(messagesTable).where(gte(messagesTable.createdAt, todayStart));
  const [totalConversations] = await db.select({ count: count() }).from(conversationsTable);
  const [totalOtps]          = await db.select({ count: count() }).from(otpRequestsTable);
  const [todayOtps]          = await db.select({ count: count() }).from(otpRequestsTable).where(gte(otpRequestsTable.createdAt, todayStart));

  const activeSessions = await db.execute(
    sql`SELECT COUNT(*) AS cnt FROM user_sessions WHERE expire > NOW()`
  );
  const activeSessionCount = Number((activeSessions.rows[0] as any)?.cnt ?? 0);

  // Daily new-user counts for last 7 days
  const dailySignups = await db.execute(sql`
    SELECT DATE(created_at) AS day, COUNT(*) AS cnt
    FROM users
    WHERE created_at >= ${weekStart}
    GROUP BY DATE(created_at)
    ORDER BY day
  `);

  // Daily message counts for last 7 days
  const dailyMessages = await db.execute(sql`
    SELECT DATE(created_at) AS day, COUNT(*) AS cnt
    FROM messages
    WHERE created_at >= ${weekStart}
    GROUP BY DATE(created_at)
    ORDER BY day
  `);

  res.json({
    users: {
      total: Number(totalUsers.count),
      today: Number(todayUsers.count),
      online: Number(onlineUsers.count),
    },
    messages: {
      total: Number(totalMessages.count),
      today: Number(todayMessages.count),
    },
    conversations: { total: Number(totalConversations.count) },
    otp: {
      total: Number(totalOtps.count),
      today: Number(todayOtps.count),
    },
    sessions: { active: activeSessionCount },
    charts: {
      dailySignups: (dailySignups.rows as any[]).map((r) => ({
        day: r.day,
        count: Number(r.cnt),
      })),
      dailyMessages: (dailyMessages.rows as any[]).map((r) => ({
        day: r.day,
        count: Number(r.cnt),
      })),
    },
  });
});

// ── GET /admin/users?page=1&q=search ──────────────────────────────────────────

router.get("/users", async (req: Request, res: Response) => {
  const page  = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = 25;
  const offset = (page - 1) * limit;
  const q = (req.query.q as string | undefined)?.trim() ?? "";

  const whereClause = q
    ? or(
        ilike(usersTable.displayName, `%${q}%`),
        ilike(usersTable.phone, `%${q}%`),
      )
    : undefined;

  const users = await db
    .select()
    .from(usersTable)
    .where(whereClause)
    .orderBy(desc(usersTable.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db
    .select({ total: count() })
    .from(usersTable)
    .where(whereClause);

  res.json({
    users: users.map((u) => ({
      id: u.id,
      phone: u.phone,
      displayName: u.displayName,
      bio: u.bio,
      avatar: u.avatar,
      isOnline: u.isOnline,
      lastSeen: u.lastSeen?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString(),
    })),
    total: Number(total),
    page,
    totalPages: Math.ceil(Number(total) / limit),
  });
});

// ── DELETE /admin/users/:id/sessions — revoke all sessions for a user ─────────

router.delete("/users/:id/sessions", async (req: Request, res: Response) => {
  const userId = parseInt(req.params.id as string, 10);
  if (!userId) return void res.status(400).json({ error: "Invalid user id" });

  await db.execute(
    sql`DELETE FROM user_sessions WHERE (sess->>'userId')::int = ${userId}`
  );
  logger.info({ userId }, "Admin: revoked all sessions for user");
  res.json({ ok: true });
});

// ── GET /admin/otp?page=1 ─────────────────────────────────────────────────────

router.get("/otp", async (req: Request, res: Response) => {
  const page  = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = 25;
  const offset = (page - 1) * limit;

  const logs = await db
    .select()
    .from(otpRequestsTable)
    .orderBy(desc(otpRequestsTable.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db.select({ total: count() }).from(otpRequestsTable);

  const now = new Date();
  res.json({
    logs: logs.map((o) => ({
      id: o.id,
      phone: o.phone,
      attempts: o.attempts,
      expiresAt: o.expiresAt.toISOString(),
      createdAt: o.createdAt.toISOString(),
      expired: o.expiresAt < now,
    })),
    total: Number(total),
    page,
    totalPages: Math.ceil(Number(total) / limit),
  });
});

// ── GET /admin/sessions ───────────────────────────────────────────────────────

router.get("/sessions", async (_req: Request, res: Response) => {
  const result = await db.execute(sql`
    SELECT sid, sess, expire
    FROM user_sessions
    WHERE expire > NOW()
    ORDER BY expire DESC
    LIMIT 100
  `);

  res.json({
    sessions: (result.rows as any[]).map((s) => ({
      sid: s.sid,
      userId: s.sess?.userId ?? null,
      expire: s.expire,
    })),
    total: result.rows.length,
  });
});

// ── DELETE /admin/sessions/:sid ───────────────────────────────────────────────

router.delete("/sessions/:sid", async (req: Request, res: Response) => {
  const { sid } = req.params;
  await db.execute(sql`DELETE FROM user_sessions WHERE sid = ${sid}`);
  logger.info({ sid }, "Admin: revoked session");
  res.json({ ok: true });
});

// ── DELETE /admin/otp/expired — flush expired OTP records ────────────────────

router.delete("/otp/expired", async (_req: Request, res: Response) => {
  const result = await db.execute(
    sql`DELETE FROM otp_requests WHERE expires_at < NOW() RETURNING id`
  );
  logger.info({ count: result.rows.length }, "Admin: flushed expired OTP records");
  res.json({ ok: true, deleted: result.rows.length });
});

// ── GET /admin/config — read non-secret runtime config ───────────────────────

router.get("/config", (_req: Request, res: Response) => {
  res.json({
    termiiSenderId: process.env.TERMII_SENDER_ID ?? "N-Alert",
    termiiChannel: process.env.TERMII_CHANNEL ?? "dnd",
    nodeEnv: process.env.NODE_ENV ?? "development",
    adminPhonesConfigured: (process.env.ADMIN_PHONES ?? "") !== "",
    supabaseUrl: process.env.SUPABASE_URL ?? null,
    supabaseRealtimeEnabled: !!(process.env.SUPABASE_URL),
    vapidConfigured: !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
    rtcConfigured: !!(process.env.TENCENT_SDKAPPID && process.env.TENCENT_SECRETKEY),
    version: process.env.npm_package_version ?? "0.0.0",
  });
});

export default router;
