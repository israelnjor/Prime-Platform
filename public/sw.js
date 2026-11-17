// Prime Console's service worker: shows a notification for each push (a new report), and opens the
// report when the notification is clicked.
self.addEventListener("push", (event) => {
  let m = { title: "Prime Console", body: "New feedback", url: "/" };
  try { m = { ...m, ...event.data.json() }; } catch { /* plain text */ }
  event.waitUntil(self.registration.showNotification(m.title, {
    body: m.body, icon: "/icon-192.png", badge: "/icon-192.png", tag: m.tag, data: { url: m.url },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) {
      if ("focus" in c) { await c.navigate(url).catch(() => undefined); return c.focus(); }
    }
    return self.clients.openWindow(url);
  })());
});

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
