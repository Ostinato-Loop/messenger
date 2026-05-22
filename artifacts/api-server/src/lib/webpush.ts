/**
 * Loop Messenger — Web Push notification helper
 *
 * Uses VAPID authentication (RFC 8292).
 * Required env vars:
 *   VAPID_PUBLIC_KEY   — URL-safe base64 P-256 public key
 *   VAPID_PRIVATE_KEY  — URL-safe base64 P-256 private key
 *   VAPID_SUBJECT      — mailto: or https: contact URI (default: mailto:loop@ostinatoloop.io)
 *
 * Never logs push tokens, auth keys, or endpoint URLs.
 */
import webpush from "web-push";

let initialized = false;

function ensureInit(): boolean {
  if (initialized) return true;
  const publicKey  = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject    = process.env.VAPID_SUBJECT ?? "mailto:loop@ostinatoloop.io";

  if (!publicKey || !privateKey) return false;

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    initialized = true;
    return true;
  } catch (err) {
    console.warn("[webpush] Failed to initialise VAPID:", (err as Error).message);
    return false;
  }
}

export function isWebPushConfigured(): boolean {
  return ensureInit();
}

export interface PushPayload {
  type: string;
  [key: string]: unknown;
}

export interface PushSubscriptionKeys {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/**
 * Send a Web Push notification.
 * Throws "SUBSCRIPTION_EXPIRED" when the browser subscription is gone (410/404).
 */
export async function sendPushNotification(
  subscription: PushSubscriptionKeys,
  payload: PushPayload,
): Promise<void> {
  if (!ensureInit()) return;

  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload), {
      TTL: 60 * 60, // 1 hour — enough for a missed call alert
    });
  } catch (err: any) {
    if (err?.statusCode === 410 || err?.statusCode === 404) {
      throw new Error("SUBSCRIPTION_EXPIRED");
    }
    throw err;
  }
}
