// UNICO CRM — service worker
// Caches the app shell so the console still opens (and shows your last
// synced data from localStorage) when there is no internet connection.
// Requests to your Google Apps Script sync URL are NOT cached — those
// always go straight to the network so sync data stays live.

const CACHE_NAME = 'unico-crm-v2';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only manage caching for same-origin app-shell requests.
  // Cross-origin requests (Google Apps Script sync calls) pass straight
  // through to the network, untouched.
  if (url.origin !== self.location.origin) {
    return;
  }

  // The page itself (navigating to '/' or index.html) is network-first:
  // always try to fetch the latest version first, so a newly-uploaded
  // update is visible the very next time the app is opened, not two
  // reloads later. Only fall back to the cached copy when there's no
  // internet at all — that's what keeps the app usable offline.
  const isPageRequest = event.request.mode === 'navigate' ||
    url.pathname.endsWith('/') || url.pathname.endsWith('index.html');

  if (isPageRequest) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Everything else (icons, manifest) can stay cache-first — these rarely
  // change and it keeps the app snappy offline.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
