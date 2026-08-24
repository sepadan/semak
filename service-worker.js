// SEMAK v1.0.0 · PWA — cache fail aplikasi sahaja, bukan markah atau API.
const CACHE_VERSION = 'semak-shell-v1.0.0-20260824-4';
const OFFLINE_URL = './offline.html';
const APP_SHELL = [
  './',
  './index.html',
  './src/App.html?v=58',
  OFFLINE_URL,
  './manifest.webmanifest',
  './manifest.webmanifest?v=1.0.0',
  './pwa.js?v=20260824-4',
  './icons/semak-192.png',
  './icons/semak-512.png',
  './icons/semak-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/apple-touch-icon.png?v=1.0.0',
  './icons/favicon-32.png',
  './icons/favicon-32.png?v=1.0.0',
  './icons/favicon-48.png',
  './icons/favicon-48.png?v=1.0.0'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(function (cache) { return cache.addAll(APP_SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.map(function (key) {
          if (key !== CACHE_VERSION && key.indexOf('semak-shell-') === 0) {
            return caches.delete(key);
          }
          return null;
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;

  var url = new URL(request.url);

  // Borang RPC Apps Script, markah, sesi dan data sekolah berada pada asal
  // Google yang berbeza dan tidak pernah melalui cache PWA ini.
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(function () {
        return caches.match(request, { ignoreSearch: true }).then(function (cached) {
          return cached || caches.match(OFFLINE_URL);
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(function (cached) {
      return cached || fetch(request);
    })
  );
});
