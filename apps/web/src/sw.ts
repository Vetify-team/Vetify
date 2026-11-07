import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkOnly, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Health and personal data is never stored on the device: every API
    // request goes to the network, before any of the default cache rules
    // can match it.
    {
      matcher: ({ url }) =>
        url.origin === self.location.origin && url.pathname.startsWith("/api/"),
      handler: new NetworkOnly(),
    },
    ...defaultCache,
  ],
  // Offline, any navigation falls back to this page instead of the
  // browser's error screen.
  fallbacks: {
    entries: [
      {
        url: "/sin-conexion",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();

// Payloads contain no pet or health data; details are loaded after authentication.
self.addEventListener("push", (event: PushEvent) => {
  event.waitUntil(
    self.registration.showNotification("Vetify", {
      body: "Tenés un recordatorio en Vetify.",
      icon: "/icons/icon-192.png",
    }),
  );
});
self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const existing = windows.find(
        (client) => new URL(client.url).origin === self.location.origin,
      ) as WindowClient | undefined;
      if (existing) {
        await existing.navigate("/avisos");
        await existing.focus();
      } else await self.clients.openWindow("/avisos");
    })(),
  );
});
