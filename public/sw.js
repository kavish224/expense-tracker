// Minimal offline shell service worker (network-first for navigation).
const CACHE = "expense-v4";
const SHELL = ["/", "/manifest.webmanifest", "/icon.svg", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  // Never cache API responses.
  if (new URL(req.url).pathname.startsWith("/api")) return;
  // Only proxy same-origin requests. Re-issuing a cross-origin request (Clerk's
  // scripts/images, Cloudflare's Turnstile) through this SW's own fetch() makes
  // Chrome re-evaluate it under connect-src instead of the resource's normal
  // directive (script-src/img-src/frame-src) — a mismatch that's near-impossible
  // to keep in sync with a third party's CSP requirements. Cross-origin requests
  // are better left to the browser's default (uninterrupted) handling.
  if (new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match("/")))
  );
});
