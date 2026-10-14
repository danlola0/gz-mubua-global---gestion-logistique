// Service worker of the installable application (PWA).
// - Pages: network first (always the latest version online), cached copy if offline.
// - Built files (/assets/…, content-hashed): cache first.
// - Other files of the site (logo, icons): cached copy, refreshed in the background.
// - Supabase (API, authentication, photos) is never cached: data always comes live
//   from the server.
// Any cache problem falls back to the network, so the site always keeps working.
const CACHE = 'gz-mubua-v1';
const PRECACHE = ['/', '/index.html', '/manifest.webmanifest', '/logo.png', '/logo-mark.png', '/favicon.png', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .catch(() => undefined)
      .then(() => self.clients.claim())
  );
});

const fromCache = (request) => caches.match(request).catch(() => undefined);

const putInCache = (request, response) => {
  if (response && response.ok && response.type === 'basic') {
    const copy = response.clone();
    caches
      .open(CACHE)
      .then((cache) => cache.put(request, copy))
      .catch(() => undefined);
  }
  return response;
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Supabase and other services: untouched

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => putInCache('/index.html', response))
        .catch(() => fromCache('/index.html').then((cached) => cached || Response.error()))
    );
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(fromCache(request).then((cached) => cached || fetch(request).then((response) => putInCache(request, response))));
    return;
  }

  event.respondWith(
    fromCache(request).then((cached) => {
      const network = fetch(request)
        .then((response) => putInCache(request, response))
        .catch(() => cached || Response.error());
      return cached || network;
    })
  );
});
