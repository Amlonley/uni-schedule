self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function toUrlCandidate(raw, fallback) {
  if (!raw) return fallback;
  try {
    return new URL(String(raw), self.registration.scope).href;
  } catch {
    return fallback;
  }
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const fallbackUrl = toUrlCandidate("./index.html", self.registration.scope);
  const targetUrl = toUrlCandidate(
    event.notification?.data?.url,
    fallbackUrl,
  );

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientsArr) => {
        for (const client of clientsArr) {
          const clientUrl = toUrlCandidate(client.url, "");
          if (!clientUrl) continue;
          if (
            clientUrl === targetUrl ||
            new URL(clientUrl).pathname === new URL(targetUrl).pathname
          ) {
            return client.focus();
          }
        }
        return self.clients.openWindow(targetUrl);
      }),
  );
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }

  const title = String(payload.title || "University Dashboard");
  const options = {
    body: String(payload.body || ""),
    tag: String(payload.tag || "uni-push"),
    icon: "./notify-icon.svg",
    badge: "./notify-badge.svg",
    vibrate: [240, 110, 260],
    renotify: true,
    requireInteraction: true,
    data:
      payload.data && typeof payload.data === "object"
        ? payload.data
        : { url: "./index.html", source: "push" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});
