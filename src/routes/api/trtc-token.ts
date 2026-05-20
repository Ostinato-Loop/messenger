/**
 * TRTC Token Generator — server-side only (never exposed to client).
 *
 * POST /api/trtc-token
 * Body:    { roomId: string; userId: string }
 * Returns: { userSig: string; sdkAppId: number; roomId: string; userId: string }
 *
 * Implements Tencent UserSig v2 (HMAC-SHA256).
 * Secrets live in Cloudflare Worker environment (set via wrangler secret put).
 */
import { createAPIFileRoute } from "@tanstack/react-start/api";
import { createHmac } from "node:crypto";

const TRTC_SDK_APP_ID = Number(process.env.TENCENT_SDKAPPID ?? 0);
const TRTC_SECRET_KEY = process.env.TENCENT_SECRETKEY ?? "";

/**
 * Generate a Tencent UserSig (v2 format) valid for `expire` seconds.
 * Algorithm: https://www.tencentcloud.com/document/product/647/35166
 */
function genUserSig(userId: string, expire = 86400): string {
  const currTime = Math.floor(Date.now() / 1000);
  const rawContent = [
    `TLS.identifier:${userId}`,
    `TLS.sdkappid:${TRTC_SDK_APP_ID}`,
    `TLS.time:${currTime}`,
    `TLS.expire:${expire}`,
    "",
  ].join("\n");

  const sig = createHmac("sha256", TRTC_SECRET_KEY)
    .update(rawContent)
    .digest("base64");

  const jsonStr = JSON.stringify({
    TLS: {
      ver: "2.0",
      identifier: userId,
      sdkappid: TRTC_SDK_APP_ID,
      expire,
      time: currTime,
      sig,
    },
  });

  return Buffer.from(jsonStr, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export const APIRoute = createAPIFileRoute("/api/trtc-token")({
  POST: async ({ request }) => {
    if (!TRTC_SDK_APP_ID || !TRTC_SECRET_KEY) {
      return new Response(
        JSON.stringify({ error: "TRTC credentials not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    let body: { roomId?: string; userId?: string };
    try {
      body = (await request.json()) as { roomId?: string; userId?: string };
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { roomId, userId } = body;
    if (!roomId || !userId) {
      return new Response(
        JSON.stringify({ error: "roomId and userId are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const userSig = genUserSig(userId);
    return new Response(
      JSON.stringify({ userSig, sdkAppId: TRTC_SDK_APP_ID, roomId, userId }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  },
});
