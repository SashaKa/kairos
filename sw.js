// Offline support: network first (fresh files when online), cache as fallback offline.
const VERSION = 'kairos-v7';
const ASSETS = [
  './', 'index.html', 'manifest.webmanifest',
  'src/ui/app.js', 'src/ui/styles.css',
  'src/calc/astro.js', 'src/calc/swara.js', 'src/calc/chinese.js', 'src/calc/tz.js',
  'src/i18n/ru.json', 'src/i18n/en.json',
  'vendor/astronomy.js', 'data/cities.json',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION)
    .then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }))
  );
});
