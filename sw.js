const CACHE_NAME = 'rift-metro-v4';
const ASSETS_TO_CACHE = [
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './favicon.png',
  './logo.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).catch(() => {
      if (event.request.mode === 'navigate') return caches.match('./index.html');
    }))
  );
});
