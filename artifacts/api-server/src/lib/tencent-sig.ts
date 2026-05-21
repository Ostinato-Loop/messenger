/**
 * Tencent TRTC UserSig v2 Generator
 * Reference: https://trtc.io/document/35166
 *
 * Algorithm:
 *   1. Build content string to sign
 *   2. HMAC-SHA256 with secretKey → base64 sig
 *   3. Pack into JSON object
 *   4. zlib deflate-raw compress
 *   5. Base64URL encode
 */
import crypto from "crypto";
import zlib from "zlib";

function base64UrlEncode(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * Generate a Tencent TRTC UserSig for the given user.
 *
 * @param sdkAppId   - TRTC SDK App ID (integer)
 * @param secretKey  - TRTC Secret Key (string)
 * @param userId     - The user's identifier (string)
 * @param expireSeconds - Validity period in seconds (default: 6 months)
 */
export function genTRTCUserSig(
  sdkAppId: number,
  secretKey: string,
  userId: string,
  expireSeconds = 86400 * 180,
): string {
  const currTime = Math.floor(Date.now() / 1000);

  // Step 1: Build string to sign
  const stringToSign = [
    `TLS.identifier:${userId}`,
    `TLS.sdkappid:${sdkAppId}`,
    `TLS.time:${currTime}`,
    `TLS.expire:${expireSeconds}`,
    "",
  ].join("\n");

  // Step 2: HMAC-SHA256 sign
  const sig = crypto
    .createHmac("sha256", secretKey)
    .update(stringToSign)
    .digest("base64");

  // Step 3: Build JSON payload
  const payload = JSON.stringify({
    "TLS.ver": "2.0",
    "TLS.identifier": userId,
    "TLS.sdkappid": sdkAppId,
    "TLS.time": currTime,
    "TLS.expire": expireSeconds,
    "TLS.sig": sig,
  });

  // Step 4: zlib deflate-raw compress
  const compressed = zlib.deflateRawSync(Buffer.from(payload, "utf-8"), {
    level: zlib.constants.Z_BEST_COMPRESSION,
  });

  // Step 5: Base64URL encode
  return base64UrlEncode(compressed);
}

/**
 * Check whether TRTC credentials are configured.
 */
export function isTRTCConfigured(): boolean {
  return !!(process.env.TENCENT_SDKAPPID && process.env.TENCENT_SECRETKEY);
}
