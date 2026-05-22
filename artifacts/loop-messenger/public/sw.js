// Loop Messenger — Production Service Worker v3
// Strategy: cache-first static, network-first API with 4s timeout for 3G/2G resilience
// v3 adds: Web Push notifications for incoming calls + missed call alerts

const CACHE_VERSION = "loop-v3";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const API_CACHE    = `${CACHE_VERSION}-api`;

const STATIC_EXTENSIONS = [".js", ".css", ".woff2", ".woff", ".ttf", ".png", ".svg", ".jpg", ".webp"];
const API_PATHS = ["/api/"];

function isStaticAsset(url) {
  return STATIC_EXTENSIONS.some((ext) => url.pathname.endsWith(ext)) || url.pathname.startsWith("/assets/");
}

function isApiRequest(url) {
  return API_PATHS.some((p) => url.pathname.startsWith(p));
}

// ── Install ────────────────────────────────────────────────────────────────
self.addEventListener("install", () => {
  self.skipWaiting();
});

// ── Activate ───────────────────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== STATIC_CACHE && k !== API_CACHE).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch ──────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (event.request.method !== "GET") return;
  if (url.origin !== self.location.origin && !url.hostname.endsWith("fonts.gstatic.com")) return;

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        const fresh = await fetch(event.request);
        if (fresh.ok) cache.put(event.request, fresh.clone());
        return fresh;
      }).catch(() => new Response("Offline", { status: 503 }))
    );
    return;
  }

  if (isApiRequest(url)) {
    event.respondWith(
      fetch(event.request.clone()).then((res) => {
        if (res.ok) {
          caches.open(API_CACHE).then((c) => c.put(event.request, res.clone()));
        }
        return res;
      }).catch(async () => {
        const cached = await caches.match(event.request);
        return cached || new Response(JSON.stringify({ error: "Offline" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        });
      })
    );
    return;
  }

  event.respondWith(
    fetch(event.request).catch(async () => {
      const cached = await caches.match("/");
      return cached || new Response("Offline", { status: 503 });
    })
  );
});

// ── Push Notifications ─────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }

  if (payload.type === "incoming_call") {
    const callType = payload.callType === "video" ? "Video" : "Voice";
    const callerName = payload.initiatorName || "Someone";

    const title   = `Incoming ${callType} Call`;
    const options = {
      body: `${callerName} is calling you on Loop`,
      icon: "/opengraph.jpg",
      badge: "/favicon.svg",
      tag: `call-${payload.callId}`,
      renotify: true,
      requireInteraction: true,       // keep visible until user acts
      vibrate: [200, 100, 200, 100, 200],
      data: {
        type: "incoming_call",
        callId: payload.callId,
        conversationId: payload.conversationId,
        url: `/chats/${payload.conversationId}`,
      },
      actions: [
        { action: "answer", title: "Answer" },
        { action: "decline", title: "Decline" },
      ],
    };

    event.waitUntil(self.registration.showNotification(title, options));
  }
});

// ── Notification Click ─────────────────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  const notification = event.notification;
  notification.close();

  const data = notification.data || {};

  if (event.action === "decline" && data.callId) {
    // Fire-and-forget reject — best effort while app is in background
    event.waitUntil(
      fetch(`/api/rtc/calls/${data.callId}/reject`, {
        method: "POST",
        credentials: "include",
      }).catch(() => {})
    );
    return;
  }

  // "answer" action or generic click — focus/open the app to the conversation
  const targetUrl = data.url || "/chats";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Focus an existing tab if available
      for (const client of clients) {
        if (client.url.includes(self.location.origin)) {
          client.postMessage({ type: "incoming_call_tap", ...data });
          return client.focus();
        }
      }
      // Otherwise open a new tab
      return self.clients.openWindow(targetUrl);
    })
  );
});
