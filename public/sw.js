// Matrix client PWA service worker — shell cache with network-first strategy
const VERSION = "matrix-v21-20260422-sendlock";
const SHELL = `${VERSION}-shell`;
const BP = "/Matrix";

const SHELL_URLS = [
  `${BP}/`,
  `${BP}/login`,
  `${BP}/manifest.webmanifest`,
  `${BP}/icon.svg`,
  `${BP}/icon-192.png`,
  `${BP}/icon-512.png`,
  `${BP}/icon-maskable-192.png`,
  `${BP}/icon-maskable-512.png`,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((c) => c.addAll(SHELL_URLS).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(BP)) return;
  // Never cache API / sync traffic
  if (url.pathname.includes("/_matrix/") || url.pathname.includes("/api/")) return;

  event.respondWith(
    (async () => {
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.status === 200 && fresh.type === "basic") {
          const copy = fresh.clone();
          caches.open(SHELL).then((c) => c.put(req, copy)).catch(() => undefined);
        }
        return fresh;
      } catch {
        const cached = await caches.match(req);
        if (cached) return cached;
        return new Response("offline", { status: 503, headers: { "content-type": "text/plain" } });
      }
    })()
  );
});

// Web Push: home server / sygnal can deliver { title, body, roomId } payloads
// once we register at /_matrix/push/r0/pushers. Until then this no-ops.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || data.room_name || "New message";
  const body = data.body || (data.sender_display_name ? `${data.sender_display_name} sent a message` : "");
  const roomId = data.room_id || data.roomId || null;
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag: roomId || "matrix-push",
      icon: `${BP}/icon-192.png`,
      data: { roomId },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = `${BP}/`;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.includes(BP)) return w.focus();
      }
      return self.clients.openWindow(target);
    })
  );
});
