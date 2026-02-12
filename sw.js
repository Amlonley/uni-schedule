self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// (اختیاری) اگر خواستی از داخل SW نوتیف بدهی
self.addEventListener("message", (event) => {
  if (event.data?.type === "notify") {
    self.registration.showNotification(event.data.title || "Notification", {
      body: event.data.body || "",
    });
  }
});
