/*
 * Offline support for the home-screen app. The build replaces the two
 * placeholders below, so a new deploy gets a new cache name and the old one is
 * thrown away on activation.
 */
const VERSION = "__BUILD_ID__";
const PRECACHE = __PRECACHE__;
const CACHE = `stork-${VERSION}`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((name) => name !== CACHE).map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  if (new URL(request.url).origin !== self.location.origin) return;

  // Navigations go to the network first so a new version is picked up promptly,
  // and fall back to the cached shell when there is no signal.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          const cached = await caches.match("./index.html");
          return cached ?? Response.error();
        }
      })(),
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE);
          await cache.put(request, response.clone());
        }
        return response;
      } catch {
        return Response.error();
      }
    })(),
  );
});

/* ------------------------------------------------------------- reminders */

/*
 * The app works out every reminder in advance and leaves the finished list in
 * IndexedDB; all this has to do is read the clock. It is deliberately stupid,
 * because it runs at a moment the browser picks, long after anyone chose
 * anything, with no way to ask a question.
 *
 * The three names below are the contract with src/storage/idb.ts and
 * src/storage/nudgeStore.ts. Change them there and change them here.
 */
const DB_NAME = "stork";
const STORE = "vault";
const PENDING_KEY = "nudges";
const SAID_KEY = "nudgesSaid";

function withStore(mode, work) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const request = work(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => {
        resolve(request.result);
        db.close();
      };
      request.onerror = () => {
        reject(request.error);
        db.close();
      };
    };
  });
}

/**
 * Says anything whose moment has come and has not been said before. Several
 * reminders can fall due together, so each gets its own tag and none replaces
 * another.
 */
async function speak() {
  const pending = (await withStore("readonly", (store) => store.get(PENDING_KEY))) ?? [];
  const already = new Set((await withStore("readonly", (store) => store.get(SAID_KEY))) ?? []);

  const now = Date.now();
  const due = pending.filter((nudge) => nudge.at <= now && !already.has(nudge.id));
  if (due.length === 0) return;

  for (const nudge of due) {
    await self.registration.showNotification(nudge.title, {
      body: nudge.body,
      tag: nudge.id,
      badge: "./icon-192.png",
      icon: "./icon-192.png",
      data: { url: "./" },
    });
    already.add(nudge.id);
  }

  await withStore("readwrite", (store) => store.put([...already], SAID_KEY));
}

// Chromium only, and only for an installed app: the browser decides when, and
// may decide never. Everything else falls back to the calendar export.
self.addEventListener("periodicsync", (event) => {
  if (event.tag === "stork-nudges") event.waitUntil(speak());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const open = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = open.find((client) => "focus" in client);
      if (existing) return existing.focus();
      return self.clients.openWindow(event.notification.data?.url ?? "./");
    })(),
  );
});
