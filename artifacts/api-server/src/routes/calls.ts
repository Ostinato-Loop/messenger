/**
 * Call signaling routes — Tencent TRTC V2
 *
 * POST /api/rtc/calls/start           — Initiate a voice/video call
 * POST /api/rtc/calls/:callId/answer  — Accept incoming call
 * POST /api/rtc/calls/:callId/reject  — Reject incoming call
 * POST /api/rtc/calls/:callId/end     — End an active call
 * GET  /api/rtc/calls/pending         — Poll for incoming calls (respondent)
 * GET  /api/rtc/calls/:callId         — Get call details
 */
import { Router, Request, Response } from "express";
import { z } from "zod";
import { db, callsTable, pushSubscriptionsTable, usersTable } from "@workspace/db";
import { eq, and, or } from "drizzle-orm";
import { genTRTCUserSig, isTRTCConfigured } from "../lib/tencent-sig";
import { sendPushNotification, isWebPushConfigured } from "../lib/webpush";
import { randomUUID } from "crypto";

const router = Router();

function getRtcCredentials(userId: number) {
  const sdkAppId = parseInt(process.env.TENCENT_SDKAPPID!, 10);
  const secretKey = process.env.TENCENT_SECRETKEY!;
  const trtcUserId = `loop_${userId}`;
  const userSig = genTRTCUserSig(sdkAppId, secretKey, trtcUserId, 86400 * 7);
  return { sdkAppId, userId: trtcUserId, userSig };
}

/**
 * Fire-and-forget: send a Web Push notification to all of a user's subscriptions.
 * Automatically cleans up expired/gone subscriptions (410/404).
 */
async function notifyUserOfCall(
  respondentId: number,
  payload: {
    type: "incoming_call";
    callId: number;
    roomId: string;
    callType: "voice" | "video";
    initiatorId: number;
    initiatorName: string;
    conversationId: number;
  },
): Promise<void> {
  if (!isWebPushConfigured()) return;

  const subs = await db
    .select()
    .from(pushSubscriptionsTable)
    .where(eq(pushSubscriptionsTable.userId, respondentId));

  for (const sub of subs) {
    sendPushNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      payload,
    ).catch((err: Error) => {
      if (err.message === "SUBSCRIPTION_EXPIRED") {
        db.delete(pushSubscriptionsTable)
          .where(eq(pushSubscriptionsTable.endpoint, sub.endpoint))
          .catch(() => {});
      }
    });
  }
}

// POST /rtc/calls/start
router.post("/start", async (req: Request, res: Response) => {
  const me = (req.session as any).userId as number | undefined;
  if (!me) return void res.status(401).json({ error: "Unauthorized" });

  const schema = z.object({
    conversationId: z.number().int().positive(),
    respondentId: z.number().int().positive(),
    type: z.enum(["voice", "video"]).default("voice"),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: "Invalid body", detail: parsed.error.flatten() });

  const { conversationId, respondentId, type } = parsed.data;

  // Check for existing active/pending call in this conversation
  const existing = await db
    .select()
    .from(callsTable)
    .where(
      and(
        eq(callsTable.conversationId, conversationId),
        or(eq(callsTable.status, "pending"), eq(callsTable.status, "active"))
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return void res.status(409).json({ error: "A call is already active in this conversation" });
  }

  const roomId = `loop_${conversationId}_${Date.now()}`;

  const [call] = await db.insert(callsTable).values({
    conversationId,
    initiatorId: me,
    respondentId,
    type,
    roomId,
  }).returning();

  let rtcCredentials = null;
  if (isTRTCConfigured()) {
    rtcCredentials = getRtcCredentials(me);
  }

  // Fetch initiator name for the push notification
  const [initiator] = await db
    .select({ displayName: usersTable.displayName })
    .from(usersTable)
    .where(eq(usersTable.id, me))
    .limit(1);

  // Fire-and-forget push notification to the respondent
  notifyUserOfCall(respondentId, {
    type: "incoming_call",
    callId: call.id,
    roomId: call.roomId,
    callType: call.type,
    initiatorId: me,
    initiatorName: initiator?.displayName ?? "Someone",
    conversationId,
  });

  return void res.status(201).json({
    callId: call.id,
    roomId: call.roomId,
    type: call.type,
    status: call.status,
    rtc: rtcCredentials,
  });
});

// POST /rtc/calls/:callId/answer
router.post("/:callId/answer", async (req: Request, res: Response) => {
  const me = (req.session as any).userId as number | undefined;
  if (!me) return void res.status(401).json({ error: "Unauthorized" });

  const callId = parseInt(String(req.params.callId), 10);
  if (isNaN(callId)) return void res.status(400).json({ error: "Invalid callId" });

  const [call] = await db
    .select()
    .from(callsTable)
    .where(and(eq(callsTable.id, callId), eq(callsTable.status, "pending")))
    .limit(1);

  if (!call) return void res.status(404).json({ error: "Call not found or no longer pending" });
  if (call.respondentId !== me) return void res.status(403).json({ error: "Not your call to answer" });

  await db.update(callsTable)
    .set({ status: "active", startedAt: new Date() })
    .where(eq(callsTable.id, callId));

  let rtcCredentials = null;
  if (isTRTCConfigured()) {
    rtcCredentials = getRtcCredentials(me);
  }

  return void res.json({
    callId,
    roomId: call.roomId,
    type: call.type,
    status: "active",
    rtc: rtcCredentials,
  });
});

// POST /rtc/calls/:callId/reject
router.post("/:callId/reject", async (req: Request, res: Response) => {
  const me = (req.session as any).userId as number | undefined;
  if (!me) return void res.status(401).json({ error: "Unauthorized" });

  const callId = parseInt(String(req.params.callId), 10);
  if (isNaN(callId)) return void res.status(400).json({ error: "Invalid callId" });

  const [call] = await db
    .select()
    .from(callsTable)
    .where(and(eq(callsTable.id, callId), eq(callsTable.status, "pending")))
    .limit(1);

  if (!call) return void res.status(404).json({ error: "Call not found or no longer pending" });
  if (call.respondentId !== me) return void res.status(403).json({ error: "Not your call" });

  await db.update(callsTable)
    .set({ status: "rejected", endedAt: new Date() })
    .where(eq(callsTable.id, callId));

  return void res.json({ callId, status: "rejected" });
});

// POST /rtc/calls/:callId/end
router.post("/:callId/end", async (req: Request, res: Response) => {
  const me = (req.session as any).userId as number | undefined;
  if (!me) return void res.status(401).json({ error: "Unauthorized" });

  const callId = parseInt(String(req.params.callId), 10);
  if (isNaN(callId)) return void res.status(400).json({ error: "Invalid callId" });

  const [call] = await db
    .select()
    .from(callsTable)
    .where(
      and(
        eq(callsTable.id, callId),
        or(eq(callsTable.status, "pending"), eq(callsTable.status, "active"))
      )
    )
    .limit(1);

  if (!call) return void res.status(404).json({ error: "Call not found or already ended" });
  if (call.initiatorId !== me && call.respondentId !== me) {
    return void res.status(403).json({ error: "Not your call" });
  }

  const endedAt = new Date();
  let durationSeconds: number | undefined;
  if (call.startedAt) {
    durationSeconds = Math.round((endedAt.getTime() - call.startedAt.getTime()) / 1000);
  }

  await db.update(callsTable)
    .set({ status: "ended", endedAt, durationSeconds })
    .where(eq(callsTable.id, callId));

  return void res.json({ callId, status: "ended", durationSeconds: durationSeconds ?? 0 });
});

// GET /rtc/calls/pending — poll for incoming calls
router.get("/pending", async (req: Request, res: Response) => {
  const me = (req.session as any).userId as number | undefined;
  if (!me) return void res.status(401).json({ error: "Unauthorized" });

  const pending = await db
    .select()
    .from(callsTable)
    .where(and(eq(callsTable.respondentId, me), eq(callsTable.status, "pending")))
    .limit(1);

  return void res.json({ calls: pending });
});

// GET /rtc/calls/:callId — get call status
router.get("/:callId", async (req: Request, res: Response) => {
  const me = (req.session as any).userId as number | undefined;
  if (!me) return void res.status(401).json({ error: "Unauthorized" });

  const callId = parseInt(String(req.params.callId), 10);
  if (isNaN(callId)) return void res.status(400).json({ error: "Invalid callId" });

  const [call] = await db
    .select()
    .from(callsTable)
    .where(
      and(
        eq(callsTable.id, callId),
        or(eq(callsTable.initiatorId, me), eq(callsTable.respondentId, me))
      )
    )
    .limit(1);

  if (!call) return void res.status(404).json({ error: "Call not found" });
  return void res.json(call);
});

export default router;
