// Change this version name whenever you push new updates to force a refresh!
const CACHE_NAME = 'rift-metro-v6-stable'; 

const ASSETS_TO_CACHE = [
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './favicon.png'
];

// INSTALL: Cache files and FORCE immediate takeover
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Forces the new service worker to activate immediately
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE)).catch((err) => console.log("Cache failed:", err))
  );
});

// ACTIVATE: Delete old caches to prevent JS mismatch errors
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => clients.claim()) // Take control of all open browser tabs
  );
});

// FETCH: Network-first approach for critical logic, cache fallback
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request).then((cached) => {
        if (cached) return cached;
        if (event.request.mode === 'navigate') return caches.match('./index.html');
      });
    })
  );
});
