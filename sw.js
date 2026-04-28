// KrzempiK Dieta — Service Worker v1.0
const CACHE_NAME = 'krzempik-dieta-v1';

// Pliki do cache'owania przy instalacji
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap'
];

// ── INSTALACJA: pobierz i zapisz wszystkie zasoby ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        // Jeśli font Google nie ładuje się offline — pomijamy, reszta musi być
        console.warn('SW install partial fail:', err);
        return cache.addAll(['./', './index.html', './manifest.json']);
      });
    }).then(() => self.skipWaiting())
  );
});

// ── AKTYWACJA: usuń stare wersje cache ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: Cache-first dla lokalnych, Network-first dla zewnętrznych ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Zasoby lokalne — cache first
  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => {
          // Offline fallback — zwróć index.html
          return caches.match('./index.html');
        });
      })
    );
    return;
  }

  // Google Fonts i inne zewnętrzne — network first, fallback cache
  event.respondWith(
    fetch(event.request).then(response => {
      if (response && response.status === 200) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
      }
      return response;
    }).catch(() => {
      return caches.match(event.request);
    })
  );
});

// ── PUSH: opcjonalne powiadomienia (przyszłość) ──
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
