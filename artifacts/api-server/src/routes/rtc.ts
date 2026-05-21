/**
 * RTC routes — Tencent TRTC UserSig generation
 * POST /api/rtc/token  → generate UserSig for a room
 * GET  /api/rtc/status → TRTC configuration status
 */
import { Router, Request, Response } from "express";
import { z } from "zod";
import { genTRTCUserSig, isTRTCConfigured } from "../lib/tencent-sig";

const router = Router();

// GET /rtc/status — check whether TRTC is configured
router.get("/status", (_req: Request, res: Response) => {
  return void res.json({
    configured: isTRTCConfigured(),
    sdkAppId: process.env.TENCENT_SDKAPPID
      ? parseInt(process.env.TENCENT_SDKAPPID, 10)
      : null,
  });
});

// POST /rtc/token — generate TRTC UserSig for a room session
router.post("/token", async (req: Request, res: Response) => {
  const userId = (req.session as any).userId;
  if (!userId) {
    return void res.status(401).json({ error: "Unauthorized" });
  }

  if (!isTRTCConfigured()) {
    return void res.status(503).json({
      error: "RTC not configured",
      message: "TENCENT_SDKAPPID and TENCENT_SECRETKEY must be set.",
    });
  }

  const schema = z.object({
    roomId: z.string().min(1).max(64),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return void res.status(400).json({ error: "roomId is required" });
  }

  const sdkAppId = parseInt(process.env.TENCENT_SDKAPPID!, 10);
  const secretKey = process.env.TENCENT_SECRETKEY!;
  const trtcUserId = `loop_${userId}`;

  try {
    const userSig = genTRTCUserSig(sdkAppId, secretKey, trtcUserId);
    return void res.json({
      sdkAppId,
      userId: trtcUserId,
      userSig,
      roomId: parsed.data.roomId,
      expireAt: Math.floor(Date.now() / 1000) + 86400 * 180,
    });
  } catch (err) {
    return void res.status(500).json({ error: "Failed to generate RTC token" });
  }
});

export default router;
