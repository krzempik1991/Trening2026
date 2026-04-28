// ── KrzempiK Service Worker v1 ──
const CACHE_NAME = 'krzempi-v1';

// Zasoby do cache'owania przy instalacji (App Shell)
const APP_SHELL = [
  './',
  './index.html',
];

// Hosty fontów Google – będą cache'owane dynamicznie strategią StaleWhileRevalidate
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

// ── INSTALL ── Pobierz i zapisz App Shell
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(APP_SHELL);
    }).then(function() {
      // Aktywuj nowego SW natychmiast bez czekania na zamknięcie starych kart
      return self.skipWaiting();
    })
  );
});

// ── ACTIVATE ── Wyczyść stare cache
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) { return key !== CACHE_NAME; })
            .map(function(key) { return caches.delete(key); })
      );
    }).then(function() {
      // Przejdź kontrolę nad wszystkimi otwartymi kartami od razu
      return self.clients.claim();
    })
  );
});

// ── FETCH ── Strategia hybrydowa
self.addEventListener('fetch', function(event) {
  const url = new URL(event.request.url);

  // Fonty Google: StaleWhileRevalidate (szybko z cache, odśwież w tle)
  if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }

  // Zasoby aplikacji (index.html, skrypty inline): NetworkFirst z fallbackiem do cache
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // Pozostałe zewnętrzne żądania: przepuść bez ingerencji
});

// ── STRATEGIE ──

// NetworkFirst: próbuj sieci, przy błędzie wróć do cache
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Ostateczny fallback: główny plik aplikacji
    return caches.match('./index.html');
  }
}

// StaleWhileRevalidate: odpowiedz z cache, zaktualizuj cache w tle
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const networkPromise = fetch(request).then(function(networkResponse) {
    if (networkResponse && networkResponse.status === 200) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(function() { return null; });

  return cached || networkPromise;
}
