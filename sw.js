const CACHE_NAME = 'literia-offline-v3';
const STATIC_ASSETS = [
  './',
  './index.html',
  './favicon.svg',
  './icon.svg',
  './icons.svg',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[ServiceWorker] Pre-cache partial fail (will cache on demand):', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[ServiceWorker] Deleting old cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Skip non-GET requests and non-http(s) schemes (e.g. chrome-extension:)
  if (req.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }

  // Network-first for navigate (HTML documents) and scripts to prevent stale bundles
  if (req.mode === 'navigate' || req.destination === 'script' || req.destination === 'style') {
    event.respondWith(
      fetch(req)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          if (req.mode === 'navigate') {
            const fallback = await caches.match('./index.html');
            if (fallback) return fallback;
            return caches.match('/');
          }
          return new Response('', { status: 408, statusText: 'Request timed out' });
        })
    );
    return;
  }

  // Stale-while-revalidate for images, fonts, and other static assets
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return networkRes;
        })
        .catch(() => cached);

      return cached || fetchPromise;
    })
  );
});
