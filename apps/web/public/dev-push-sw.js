// Development push testing only. No precache or runtime caching.
self.addEventListener("install", (event) => event.waitUntil(self.skipWaiting()));
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("push", (event) => {
  event.waitUntil(
    self.registration.showNotification("Vetify", {
      body: "Tenés un recordatorio en Vetify.",
      icon: "/icons/icon-192.png",
    }),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const existing = windows.find(
        (client) => new URL(client.url).origin === self.location.origin,
      );
      if (existing) {
        await existing.navigate("/avisos");
        await existing.focus();
      } else await self.clients.openWindow("/avisos");
    })(),
  );
});
