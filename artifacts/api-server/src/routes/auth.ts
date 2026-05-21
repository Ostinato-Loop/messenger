import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import {
  usersTable,
  otpRequestsTable,
} from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import { z } from "zod";

const router = Router();

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

async function sendTermiiOtp(phone: string, code: string): Promise<void> {
  const apiKey = process.env.TERMII_API_KEY;
  const senderId = process.env.TERMII_SENDER_ID || "N-Alert";

  if (!apiKey) {
    throw new Error("TERMII_API_KEY not configured");
  }

  const response = await fetch("https://v3.api.termii.com/api/sms/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: phone,
      from: senderId,
      sms: `Your Loop Messenger verification code is: ${code}. Valid for 10 minutes. Do not share this code.`,
      type: "plain",
      channel: "generic",
      api_key: apiKey,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`TERMII error: ${err}`);
  }
}

// POST /auth/send-otp
router.post("/send-otp", async (req: Request, res: Response) => {
  const schema = z.object({ phone: z.string().min(8) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return void res.status(400).json({ error: "Invalid phone number" });
  }

  const phone = normalizePhone(parsed.data.phone);

  // Rate limit: check last OTP was sent > 60s ago
  const recent = await db
    .select()
    .from(otpRequestsTable)
    .where(
      and(
        eq(otpRequestsTable.phone, phone),
        gt(otpRequestsTable.expiresAt, new Date())
      )
    )
    .limit(1);

  if (recent.length > 0) {
    const secondsLeft = Math.ceil(
      (recent[0].expiresAt.getTime() - Date.now()) / 1000
    );
    return void res.status(429).json({
      error: "OTP already sent. Please wait before requesting a new one.",
      cooldownSeconds: secondsLeft,
    });
  }

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await db.insert(otpRequestsTable).values({ phone, code, expiresAt });

  try {
    await sendTermiiOtp(phone, code);
  } catch (err) {
    // In dev, log the OTP so it can be tested without TERMII credits
    console.log(`[DEV] OTP for ${phone}: ${code}`);
  }

  return void res.json({ message: "OTP sent successfully", cooldownSeconds: 600 });
});

// POST /auth/verify-otp
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
        gt(otpRequestsTable.expiresAt, new Date())
      )
    )
    .orderBy(otpRequestsTable.createdAt)
    .limit(1);

  if (otpRecord.length === 0) {
    return void res.status(400).json({ error: "OTP expired or not found. Please request a new one." });
  }

  const otp = otpRecord[0];

  if (otp.attempts >= 5) {
    await db.delete(otpRequestsTable).where(eq(otpRequestsTable.id, otp.id));
    return void res.status(400).json({ error: "Too many attempts. Please request a new OTP." });
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
  (req.session as any).userId = u.id;

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

// GET /auth/me
router.get("/me", async (req: Request, res: Response) => {
  const userId = (req.session as any).userId;
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

  const u = user[0];
  return void res.json({
    id: u.id,
    phone: u.phone,
    displayName: u.displayName,
    bio: u.bio,
    avatar: u.avatar,
    isOnline: u.isOnline,
    lastSeen: u.lastSeen?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
  });
});

// POST /auth/logout
router.post("/logout", async (req: Request, res: Response) => {
  const userId = (req.session as any).userId;
  if (userId) {
    await db
      .update(usersTable)
      .set({ isOnline: false, lastSeen: new Date() })
      .where(eq(usersTable.id, userId));
  }
  req.session.destroy(() => {});
  return void res.json({ ok: true });
});

// PATCH /auth/profile
router.patch("/profile", async (req: Request, res: Response) => {
  const userId = (req.session as any).userId;
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

  const updated = await db
    .update(usersTable)
    .set(parsed.data)
    .where(eq(usersTable.id, userId))
    .returning();

  const u = updated[0];
  return void res.json({
    id: u.id,
    phone: u.phone,
    displayName: u.displayName,
    bio: u.bio,
    avatar: u.avatar,
    isOnline: u.isOnline,
    lastSeen: u.lastSeen?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
  });
});

export default router;
