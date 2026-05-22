/**
 * Loop Messenger — Web Push notification service
 *
 * Handles:
 *   - Requesting browser notification permission
 *   - Subscribing to push via PushManager
 *   - Registering the subscription with the API
 *   - Unsubscribing cleanly on logout
 *
 * No VAPID key is hardcoded here — it is fetched from the API at runtime,
 * so frontend builds are environment-agnostic.
 */

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

async function apiFetch(path: string, opts?: RequestInit) {
  return fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...opts,
  });
}

/** Convert the URL-safe base64 VAPID key to a Uint8Array for PushManager. */
function urlBase64ToUint8Array(base64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    bytes[i] = raw.charCodeAt(i);
  }
  return bytes.buffer;
}

/** Fetch VAPID public key from the API (never embedded in build). */
async function getVapidPublicKey(): Promise<string | null> {
  try {
    const res = await apiFetch("/api/notifications/push/vapid-key");
    if (!res.ok) return null;
    const data = (await res.json()) as { enabled: boolean; publicKey?: string };
    return data.enabled && data.publicKey ? data.publicKey : null;
  } catch {
    return null;
  }
}

/**
 * Request permission + subscribe + register with server.
 * Safe to call multiple times — re-uses an existing subscription if present.
 * No-op if push is not supported, permission denied, or VAPID not configured.
 */
export async function initPushNotifications(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

  let permission = Notification.permission;
  if (permission === "default") {
    permission = await Notification.requestPermission();
  }
  if (permission !== "granted") return;

  const publicKey = await getVapidPublicKey();
  if (!publicKey) return;

  try {
    const reg = await navigator.serviceWorker.ready;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    const json = sub.toJSON() as {
      endpoint: string;
      keys?: { p256dh: string; auth: string };
    };
    if (!json.keys?.p256dh || !json.keys?.auth) return;

    await apiFetch("/api/notifications/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        userAgent: navigator.userAgent.slice(0, 200),
      }),
    });
  } catch (err) {
    console.warn("[push] Failed to subscribe:", err);
  }
}

/**
 * Unsubscribe from push and remove the subscription from the server.
 * Call this on logout.
 */
export async function unsubscribePushNotifications(): Promise<void> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;

    const endpoint = sub.endpoint;
    await sub.unsubscribe();

    await apiFetch("/api/notifications/push/unsubscribe", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint }),
    }).catch(() => {});
  } catch {
    // Best-effort — don't crash on logout
  }
}
