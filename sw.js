const CACHE_NAME = 'qaime-v3';
const ASSETS = [
  '/cosqun-qaime/',
  '/cosqun-qaime/index.html',
  '/cosqun-qaime/offline.html', // Oflayn səhifəni də keşə əlavə edirik
  '/cosqun-qaime/style.css',
  '/cosqun-qaime/app.js',
  '/cosqun-qaime/firebase.js',
  '/cosqun-qaime/manifest.json',
  '/cosqun-qaime/favicon.png',
  '/cosqun-qaime/html2pdf.bundle.min.js'
];

// Quraşdırılma zamanı əsas faylları keşə yığır
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Aktivləşəndə köhnə keşləri təmizləyir
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Sorğuları idarə edir
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request).catch(() => {
        if (event.request.mode === 'navigate') {
          // İnternet olmayanda birbaşa bizim dizayn etdiyimiz oflayn səhifəni göstərir
          return caches.match('/cosqun-qaime/offline.html');
        }
      });
    })
  );
});