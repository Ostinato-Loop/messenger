// Loop Messenger — Service Worker
// Strategy: cache-first for static assets, network-first for API

const CACHE_VERSION = "loop-v1";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const API_CACHE = `${CACHE_VERSION}-api`;

const STATIC_EXTENSIONS = [".js", ".css", ".woff2", ".woff", ".ttf", ".png", ".svg", ".jpg", ".webp"];
const API_PATHS = ["/api/"];

function isStaticAsset(url) {
  return STATIC_EXTENSIONS.some((ext) => url.pathname.endsWith(ext)) || url.pathname.startsWith("/assets/");
}

function isApiRequest(url) {
  return API_PATHS.some((p) => url.pathname.startsWith(p));
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== STATIC_CACHE && k !== API_CACHE).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never intercept non-GET or cross-origin requests we don't control
  if (event.request.method !== "GET") return;
  if (url.origin !== self.location.origin && !url.hostname.endsWith("fonts.gstatic.com")) return;

  if (isStaticAsset(url)) {
    // Cache-first: static hashed assets never change
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
    // Network-first: API always fresh, fall back to cache on 3G timeout
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

  // HTML shell — network first, fall back to cached shell
  event.respondWith(
    fetch(event.request).catch(async () => {
      const cached = await caches.match("/");
      return cached || new Response("Offline", { status: 503 });
    })
  );
});
