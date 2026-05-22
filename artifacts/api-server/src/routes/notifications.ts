/**
 * Notification routes — Web Push subscription management
 *
 * GET    /api/notifications/push/vapid-key   — return VAPID public key (or enabled:false)
 * POST   /api/notifications/push/subscribe   — register a push subscription
 * DELETE /api/notifications/push/unsubscribe — remove a push subscription
 */
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { db, pushSubscriptionsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { isWebPushConfigured } from "../lib/webpush";

const router = Router();

// GET /notifications/push/vapid-key
router.get("/push/vapid-key", (_req: Request, res: Response) => {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!publicKey || !isWebPushConfigured()) {
    return void res.json({ enabled: false });
  }
  return void res.json({ enabled: true, publicKey });
});

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  userAgent: z.string().max(200).optional(),
});

// POST /notifications/push/subscribe
router.post("/push/subscribe", async (req: Request, res: Response) => {
  const me = (req.session as any).userId as number | undefined;
  if (!me) return void res.status(401).json({ error: "Unauthorized" });

  const parsed = subscribeSchema.safeParse(req.body);
  if (!parsed.success) {
    return void res.status(400).json({ error: "Invalid subscription payload" });
  }

  const { endpoint, keys, userAgent } = parsed.data;

  await db
    .insert(pushSubscriptionsTable)
    .values({
      userId: me,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: userAgent ?? null,
    })
    .onConflictDoUpdate({
      target: pushSubscriptionsTable.endpoint,
      set: {
        userId: me,
        p256dh: keys.p256dh,
        auth: keys.auth,
        updatedAt: new Date(),
      },
    });

  return void res.status(201).json({ ok: true });
});

// DELETE /notifications/push/unsubscribe
router.delete("/push/unsubscribe", async (req: Request, res: Response) => {
  const me = (req.session as any).userId as number | undefined;
  if (!me) return void res.status(401).json({ error: "Unauthorized" });

  const parsed = z.object({ endpoint: z.string().url() }).safeParse(req.body);
  if (!parsed.success) {
    return void res.status(400).json({ error: "Invalid payload" });
  }

  await db
    .delete(pushSubscriptionsTable)
    .where(
      and(
        eq(pushSubscriptionsTable.endpoint, parsed.data.endpoint),
        eq(pushSubscriptionsTable.userId, me),
      ),
    );

  return void res.json({ ok: true });
});

export default router;
