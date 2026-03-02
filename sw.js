"use strict";

const DB_NAME = "uni_schedule_notify_sw_db_v1";
const DB_STORE = "kv";
const SNAPSHOT_KEY = "snapshot";
const DELIVERED_KEY = "delivered";
const PERIODIC_TAG = "uni-notif-periodic";
const SYNC_TAG = "uni-notif-sync";
const DEFAULT_LATE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;
const DELIVERY_TTL_MS = 45 * 24 * 60 * 60 * 1000;
const DELIVERY_MAX_KEYS = 2400;
const NOTIFY_DEFAULT_TITLE = "University Schedule";
const NOTIFY_ICON = "./assets/svg/notify-icon.svg";
const NOTIFY_BADGE = "./assets/svg/notify-badge.svg";
const NOTIFY_VIBRATE_PATTERN = [240, 120, 280];
const NOTIFY_OPEN_ACTION_ID = "open-app";
const NOTIFY_DISMISS_ACTION_ID = "dismiss";
const NOTIFY_DEFAULT_URL = "./index.html";
const APP_SHELL_CACHE = "uni_schedule_app_shell_v6";
const CROSS_ORIGIN_RUNTIME_CACHE = "uni_schedule_cross_origin_v1";
const APP_SHELL_OFFLINE_FALLBACK_URL = "./offline.html";
const APP_SHELL_REQUIRED_ASSETS = [
  "./",
  "./index.html",
  "./styles/main.css",
  "./src/main.js",
  "./src/app.js",
  "./assets/vendor/tailwindcss-cdn.js",
];
const APP_SHELL_CORE_ASSETS = [
  "./",
  "./index.html",
  "./index.html?source=pwa",
  "./offline.html",
  "./manifest.webmanifest",
  "./styles/main.css",
  "./assets/vendor/tailwindcss-cdn.js",
  "./src/main.js",
  "./src/app.js",
  "./src/data.js",
  "./src/dom.js",
  "./src/events.js",
  "./src/storage.js",
  "./src/tailwind-config.js",
  "./src/utils.js",
  "./assets/icons/apple-touch-icon.png",
  "./assets/icons/favicon-32.png",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-192-maskable.png",
  "./assets/icons/icon-512-maskable.png",
  "./assets/svg/favicon.svg",
  "./assets/svg/notify-icon.svg",
  "./assets/svg/notify-badge.svg",
];
const inMemoryStore = new Map();

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toIsoString(value) {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return new Date().toISOString();
  return dt.toISOString();
}

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("idb-open-failed"));
  });
}

async function idbGet(key) {
  const cleanKey = String(key || "");
  if (typeof indexedDB === "undefined") {
    return inMemoryStore.get(cleanKey);
  }
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readonly");
      const store = tx.objectStore(DB_STORE);
      const req = store.get(cleanKey);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error("idb-get-failed"));
      tx.oncomplete = () => db.close();
      tx.onabort = () => db.close();
      tx.onerror = () => db.close();
    });
  } catch {
    return inMemoryStore.get(cleanKey);
  }
}

async function idbSet(key, value) {
  const cleanKey = String(key || "");
  inMemoryStore.set(cleanKey, value);
  if (typeof indexedDB === "undefined") return true;
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readwrite");
      const store = tx.objectStore(DB_STORE);
      store.put(value, cleanKey);
      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error || new Error("idb-set-failed"));
      };
      tx.onabort = () => {
        db.close();
        reject(tx.error || new Error("idb-set-aborted"));
      };
    });
  } catch {
    return false;
  }
}

function sanitizeEntry(raw, kind = "note") {
  const item = raw && typeof raw === "object" ? raw : {};
  const fireAtMs = toNumber(item.fireAtMs, 0);
  if (fireAtMs <= 0) return null;
  const signature = String(item.signature || "").trim();
  const id = toNumber(item.id, 0);
  const title = String(item.title || "").trim();
  const body = String(item.body || "").trim();
  const tag = String(item.tag || `${kind}-${id || fireAtMs}`).trim();
  const data = item.data && typeof item.data === "object" ? item.data : {};
  return {
    kind,
    id,
    signature,
    fireAtMs,
    title,
    body,
    tag,
    data,
  };
}

function sanitizeSnapshot(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const notesRaw = Array.isArray(src.notes) ? src.notes : [];
  const examsRaw = Array.isArray(src.exams) ? src.exams : [];
  const notes = notesRaw
    .map((item) => sanitizeEntry(item, "note"))
    .filter(Boolean)
    .sort((a, b) => a.fireAtMs - b.fireAtMs)
    .slice(0, 600);
  const exams = examsRaw
    .map((item) => sanitizeEntry(item, "exam"))
    .filter(Boolean)
    .sort((a, b) => a.fireAtMs - b.fireAtMs)
    .slice(0, 600);
  return {
    version: toNumber(src.version, 1),
    generatedAt: toIsoString(src.generatedAt),
    lateGraceMs: Math.max(60 * 1000, toNumber(src.lateGraceMs, DEFAULT_LATE_GRACE_MS)),
    pageUrl: String(src.pageUrl || "").trim(),
    notes,
    exams,
  };
}

function normalizeDeliveredMap(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const out = {};
  Object.entries(src).forEach(([key, value]) => {
    const cleanKey = String(key || "").trim();
    if (!cleanKey) return;
    if (typeof value === "string" && value.trim()) {
      out[cleanKey] = value.trim();
      return;
    }
    if (value && typeof value === "object") {
      const stamp = String(value.at || value.ts || value.time || "").trim();
      if (stamp) out[cleanKey] = stamp;
    }
  });
  return out;
}

function buildDeliveryKey(entry) {
  const sig = String(entry?.signature || "").trim();
  const fallback = String(entry?.tag || `${entry?.kind || "notif"}-${entry?.id || entry?.fireAtMs || "x"}`).trim();
  return `${String(entry?.kind || "notif").trim()}:${sig || fallback}`;
}

function pruneDeliveredMap(delivered, nowMs = Date.now()) {
  const source = normalizeDeliveredMap(delivered);
  const entries = Object.entries(source).filter(([, stamp]) => {
    const ts = new Date(String(stamp || "")).getTime();
    if (!Number.isFinite(ts) || ts <= 0) return false;
    return nowMs - ts <= DELIVERY_TTL_MS;
  });
  entries.sort((a, b) => {
    const aTs = new Date(String(a[1] || "")).getTime();
    const bTs = new Date(String(b[1] || "")).getTime();
    return bTs - aTs;
  });
  const compact = {};
  entries.slice(0, DELIVERY_MAX_KEYS).forEach(([k, stamp]) => {
    compact[k] = stamp;
  });
  return compact;
}

function toNotificationUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw, self.location.origin);
    if (url.origin !== self.location.origin) return self.location.origin;
    return url.href;
  } catch {
    return "";
  }
}

function buildNotificationPayload(base = {}, fallbackUrl = "") {
  const src = base && typeof base === "object" ? base : {};
  const dataSrc = src.data && typeof src.data === "object" ? src.data : {};
  const ts = toNumber(src.timestamp, Date.now());
  const safeTimestamp = ts > 0 ? ts : Date.now();
  const url = toNotificationUrl(
    dataSrc.url || String(fallbackUrl || "").trim() || NOTIFY_DEFAULT_URL,
  );
  const actions =
    Array.isArray(src.actions) && src.actions.length > 0
      ? src.actions.slice(0, 2)
      : [
          { action: NOTIFY_OPEN_ACTION_ID, title: "Open App" },
          { action: NOTIFY_DISMISS_ACTION_ID, title: "Dismiss" },
        ];

  return {
    body: String(src.body || "").trim(),
    tag: String(src.tag || "").trim(),
    renotify: src.renotify !== false,
    requireInteraction: src.requireInteraction !== false,
    timestamp: safeTimestamp,
    icon: String(src.icon || NOTIFY_ICON).trim() || NOTIFY_ICON,
    badge: String(src.badge || NOTIFY_BADGE).trim() || NOTIFY_BADGE,
    vibrate:
      Array.isArray(src.vibrate) && src.vibrate.length > 0
        ? src.vibrate
        : NOTIFY_VIBRATE_PATTERN,
    lang: "fa",
    dir: "rtl",
    actions,
    data: {
      ...dataSrc,
      url: url || self.location.origin,
      source: String(dataSrc.source || "uni-schedule-sw").trim() || "uni-schedule-sw",
    },
  };
}

async function broadcastDeliveredState(deliveredMap) {
  const payload = {
    type: "UNI_SCHEDULE_NOTIF_DELIVERED_STATE",
    payload: normalizeDeliveredMap(deliveredMap),
  };
  let clients = [];
  try {
    clients = await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    });
  } catch {
    clients = [];
  }
  for (const client of clients) {
    try {
      client.postMessage(payload);
    } catch {}
  }
}

async function runNotificationCheck(reason = "sw-check") {
  const snapshotRaw = await idbGet(SNAPSHOT_KEY);
  const snapshot = sanitizeSnapshot(snapshotRaw);
  const nowMs = Date.now();
  const lateGraceMs = Math.max(
    60 * 1000,
    toNumber(snapshot.lateGraceMs, DEFAULT_LATE_GRACE_MS),
  );

  let delivered = normalizeDeliveredMap(await idbGet(DELIVERED_KEY));
  let changed = false;
  let shownCount = 0;

  const entries = []
    .concat(Array.isArray(snapshot.notes) ? snapshot.notes : [])
    .concat(Array.isArray(snapshot.exams) ? snapshot.exams : [])
    .sort((a, b) => toNumber(a.fireAtMs, 0) - toNumber(b.fireAtMs, 0));

  for (const entry of entries) {
    const fireAtMs = toNumber(entry.fireAtMs, 0);
    if (fireAtMs <= 0) continue;
    if (nowMs < fireAtMs) continue;
    if (nowMs - fireAtMs > lateGraceMs) continue;

    const deliveryKey = buildDeliveryKey(entry);
    if (delivered[deliveryKey]) continue;

    const title = String(entry.title || NOTIFY_DEFAULT_TITLE).trim();
    const payload = buildNotificationPayload(
      {
        body: String(entry.body || "").trim(),
        tag: String(entry.tag || deliveryKey).trim(),
        renotify: true,
        requireInteraction: true,
        timestamp: fireAtMs,
        data: {
          ...(entry.data && typeof entry.data === "object" ? entry.data : {}),
          source: "uni-schedule-sw",
          reason: String(reason || "sw-check").trim(),
          fireAtMs,
        },
      },
      entry?.data?.url || snapshot.pageUrl || NOTIFY_DEFAULT_URL,
    );

    try {
      await self.registration.showNotification(title || NOTIFY_DEFAULT_TITLE, payload);
      delivered[deliveryKey] = new Date().toISOString();
      changed = true;
      shownCount += 1;
    } catch {}
  }

  const pruned = pruneDeliveredMap(delivered, nowMs);
  if (JSON.stringify(pruned) !== JSON.stringify(delivered)) {
    changed = true;
  }
  delivered = pruned;

  if (changed) {
    await idbSet(DELIVERED_KEY, delivered);
    await broadcastDeliveredState(delivered);
  }

  return { shownCount, changed };
}

async function safeRunNotificationCheck(reason = "sw-check") {
  try {
    return await runNotificationCheck(reason);
  } catch {
    return { shownCount: 0, changed: false };
  }
}

async function respondDeliveredState(portLike = null, sourceLike = null) {
  const delivered = normalizeDeliveredMap(await idbGet(DELIVERED_KEY));
  const message = {
    type: "UNI_SCHEDULE_NOTIF_DELIVERED_STATE",
    payload: delivered,
  };
  if (portLike && typeof portLike.postMessage === "function") {
    try {
      portLike.postMessage(message);
      return;
    } catch {}
  }
  if (sourceLike && typeof sourceLike.postMessage === "function") {
    try {
      sourceLike.postMessage(message);
    } catch {}
  }
}

function toAppAssetUrl(pathLike = "./") {
  try {
    const base = self.registration?.scope || self.location.origin;
    return new URL(String(pathLike || "./"), base).toString();
  } catch {
    return String(pathLike || "./");
  }
}

function isStaticCacheCandidate(requestLike) {
  const destination = String(requestLike?.destination || "").toLowerCase();
  if (
    destination === "style" ||
    destination === "script" ||
    destination === "image" ||
    destination === "font" ||
    destination === "manifest"
  ) {
    return true;
  }
  let pathname = "";
  try {
    pathname = String(
      new URL(String(requestLike?.url || ""), self.location.origin).pathname || "",
    );
  } catch {
    pathname = "";
  }
  return /\.(?:css|js|mjs|json|webmanifest|svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|otf)$/i.test(
    pathname,
  );
}

function isCrossOriginFontOrStyleRequest(requestLike, requestUrl) {
  if (!requestLike || !requestUrl) return false;
  if (requestUrl.origin === self.location.origin) return false;
  const destination = String(requestLike.destination || "").toLowerCase();
  if (destination === "font" || destination === "style") return true;
  const host = String(requestUrl.hostname || "").toLowerCase();
  if (host.includes("fonts.googleapis.com") || host.includes("fonts.gstatic.com")) {
    return true;
  }
  return false;
}

async function handleCrossOriginRuntimeFetch(request) {
  if (typeof caches === "undefined") {
    return fetch(request);
  }
  const cache = await caches.open(CROSS_ORIGIN_RUNTIME_CACHE);
  const cached = await cache.match(request);
  try {
    const response = await fetch(request);
    if (response && (response.ok || response.type === "opaque")) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    if (cached) return cached;
    return new Response("", { status: 503, statusText: "Offline" });
  }
}

async function precacheAppShell() {
  if (typeof caches === "undefined") return;
  const cache = await caches.open(APP_SHELL_CACHE);
  const urls = Array.from(
    new Set(APP_SHELL_CORE_ASSETS.map((entry) => toAppAssetUrl(entry))),
  );
  const requiredUrls = new Set(
    APP_SHELL_REQUIRED_ASSETS.map((entry) => toAppAssetUrl(entry)),
  );
  const cachedOkMap = new Map();
  for (const url of urls) {
    let ok = false;
    try {
      const req = new Request(url, { cache: "reload" });
      const response = await fetch(req);
      if (response && (response.ok || response.type === "opaque")) {
        await cache.put(url, response.clone());
        ok = true;
      }
    } catch {}
    if (!ok) {
      try {
        const fallback = await cache.match(url, { ignoreSearch: true });
        ok = Boolean(fallback);
      } catch {
        ok = false;
      }
    }
    cachedOkMap.set(url, ok);
  }
  const missingRequired = [];
  requiredUrls.forEach((url) => {
    if (!cachedOkMap.get(url)) missingRequired.push(url);
  });
  if (missingRequired.length > 0) {
    console.warn("SW precache: missing required assets", missingRequired);
  }
}

async function cleanupLegacyAppShellCaches() {
  if (typeof caches === "undefined") return;
  const keys = await caches.keys();
  await Promise.all(
    keys.map((key) => {
      if (!/^uni_schedule_app_shell_/i.test(String(key || ""))) return null;
      if (key === APP_SHELL_CACHE) return null;
      return caches.delete(key);
    }),
  );
}

async function readCachedResponse(request) {
  if (typeof caches === "undefined") return null;
  try {
    const direct = await caches.match(request, { ignoreSearch: true });
    if (direct) return direct;
  } catch {}
  return null;
}

async function storeResponseInCache(request, response) {
  if (typeof caches === "undefined") return;
  if (!response || response.status !== 200) return;
  if (response.type === "opaque") return;
  try {
    const cache = await caches.open(APP_SHELL_CACHE);
    await cache.put(request, response.clone());
  } catch {}
}

async function handleNavigationFetch(request) {
  const cached = await readCachedResponse(request);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      await storeResponseInCache(request, response);
      try {
        const cache = await caches.open(APP_SHELL_CACHE);
        await cache.put(toAppAssetUrl("./index.html"), response.clone());
      } catch {}
    }
    return response;
  } catch {
    if (cached) return cached;
    const fallbackIndex = await readCachedResponse(toAppAssetUrl("./index.html"));
    if (fallbackIndex) return fallbackIndex;
    const fallbackRoot = await readCachedResponse(toAppAssetUrl("./"));
    if (fallbackRoot) return fallbackRoot;
    const fallbackOffline = await readCachedResponse(
      toAppAssetUrl(APP_SHELL_OFFLINE_FALLBACK_URL),
    );
    if (fallbackOffline) return fallbackOffline;
    return new Response("Offline", {
      status: 503,
      statusText: "Offline",
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

async function handleStaticFetch(request) {
  const cached = await readCachedResponse(request);
  const networkPromise = fetch(request)
    .then(async (response) => {
      if (response && response.ok) {
        await storeResponseInCache(request, response);
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    networkPromise.catch(() => {});
    return cached;
  }
  const networkResponse = await networkPromise;
  if (networkResponse) return networkResponse;
  return fetch(request);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      try {
        await precacheAppShell();
      } catch {}
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await cleanupLegacyAppShellCaches();
      await self.clients.claim();
      await safeRunNotificationCheck("activate");
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (!request || request.method !== "GET") return;
  let requestUrl = null;
  try {
    requestUrl = new URL(request.url);
  } catch {
    return;
  }
  if (isCrossOriginFontOrStyleRequest(request, requestUrl)) {
    event.respondWith(handleCrossOriginRuntimeFetch(request));
    return;
  }
  if (requestUrl.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(handleNavigationFetch(request));
    return;
  }
  if (isStaticCacheCandidate(request)) {
    event.respondWith(handleStaticFetch(request));
    return;
  }
  event.respondWith(fetch(request));
});

self.addEventListener("message", (event) => {
  const data = event.data && typeof event.data === "object" ? event.data : {};
  const type = String(data.type || "")
    .trim()
    .toUpperCase();
  if (!type) return;

  if (type === "UNI_SCHEDULE_NOTIF_SYNC_SNAPSHOT") {
    event.waitUntil(
      (async () => {
        const snapshot = sanitizeSnapshot(data.payload);
        await idbSet(SNAPSHOT_KEY, snapshot);
        await safeRunNotificationCheck("snapshot-sync");
        await respondDeliveredState(event.ports?.[0] || null, event.source || null);
      })(),
    );
    return;
  }

  if (type === "UNI_SCHEDULE_NOTIF_FETCH_DELIVERED") {
    event.waitUntil(
      respondDeliveredState(event.ports?.[0] || null, event.source || null),
    );
    return;
  }

  if (type === "UNI_SCHEDULE_NOTIF_CHECK_NOW") {
    const reason = String(data.reason || "message-check").trim() || "message-check";
    event.waitUntil(safeRunNotificationCheck(reason));
    return;
  }

  if (type === "UNI_SCHEDULE_NOTIF_CLEAR_STATE") {
    event.waitUntil(
      (async () => {
        await idbSet(DELIVERED_KEY, {});
        await respondDeliveredState(event.ports?.[0] || null, event.source || null);
      })(),
    );
  }
});

self.addEventListener("sync", (event) => {
  if (String(event.tag || "").trim() !== SYNC_TAG) return;
  event.waitUntil(safeRunNotificationCheck("sync-event"));
});

self.addEventListener("periodicsync", (event) => {
  if (String(event.tag || "").trim() !== PERIODIC_TAG) return;
  event.waitUntil(safeRunNotificationCheck("periodic-sync"));
});

self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let payload = null;
      try {
        payload = event.data ? event.data.json() : null;
      } catch {}

      if (payload && typeof payload === "object") {
        const mode = String(payload.type || "").trim().toLowerCase();
        if (mode === "uni-schedule-notif-sync") {
          await safeRunNotificationCheck("push-sync");
          return;
        }
        const title = String(payload.title || "University Schedule").trim();
        const body = String(payload.body || "").trim();
        if (title || body) {
          try {
            const notifyPayload = buildNotificationPayload(
              {
                body,
                tag: String(payload.tag || "uni-push-generic"),
                renotify: true,
                requireInteraction: true,
                timestamp: Date.now(),
                icon: payload.icon,
                badge: payload.badge,
                data:
                  payload.data && typeof payload.data === "object" ? payload.data : {},
              },
              payload?.data?.url || NOTIFY_DEFAULT_URL,
            );
            await self.registration.showNotification(
              title || NOTIFY_DEFAULT_TITLE,
              notifyPayload,
            );
          } catch {}
          return;
        }
      }

      await safeRunNotificationCheck("push-fallback");
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const action = String(event.action || "").trim();
      if (action === NOTIFY_DISMISS_ACTION_ID) return;
      const targetUrl = String(event.notification?.data?.url || "").trim();
      const sameOriginTarget = targetUrl || self.location.origin;
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of clients) {
        try {
          if ("focus" in client) {
            await client.focus();
            if (targetUrl && "navigate" in client) {
              await client.navigate(sameOriginTarget);
            }
            return;
          }
        } catch {}
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(sameOriginTarget || self.location.origin);
      }
    })(),
  );
});
