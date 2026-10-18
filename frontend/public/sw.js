self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) {}
  event.waitUntil(self.registration.showNotification(data.title || "ARUN ENTERPRISES", {
    body: data.body || "Please record your punch.",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: data.tag || "punch-reminder",
    renotify: true,
    vibrate: [200, 100, 200],
    data: { url: data.url || "/employee" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      const w = wins.find((x) => x.url.startsWith(self.location.origin));
      if (w) { w.navigate(target).catch(() => {}); return w.focus(); }
      return self.clients.openWindow(target);
    })
  );
});
