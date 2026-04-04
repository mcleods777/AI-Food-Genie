const CACHE_NAME = "food-genie-v2";
const STATIC_ASSETS = [
  "/",
  "/pantry",
  "/groceries",
  "/recipes",
  "/meal-planner",
  "/shopping-list",
  "/audit",
  "/manifest.json",
  "/icon.svg",
];

// Install — cache core app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate — clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch — network-first for API, cache-first for static assets
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== "GET") return;

  // API requests: network-first (try network, fall back to cache)
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Static assets & pages: network-first, fall back to cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Push notification received
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "Food Genie";
  const options = {
    body: data.body || "You have a new meal assignment",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-72x72.png",
    data: { url: data.url || "/autopilot" },
    actions: data.actions || [
      { action: "accept", title: "Sounds good" },
      { action: "skip", title: "Not tonight" },
    ],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification action tapped
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/autopilot";

  if (event.action === "accept" || event.action === "skip") {
    event.waitUntil(
      fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          response: event.action === "accept" ? "accept" : "skip",
          channel: "push",
          date: new Date().toISOString().split("T")[0],
        }),
      })
        .then(() => self.clients.openWindow(url))
        .catch(() => self.clients.openWindow(url))
    );
  } else {
    event.waitUntil(self.clients.openWindow(url));
  }
});
