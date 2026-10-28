// Offline cache: all app files are cached on install; cache-first afterwards.
const VERSION = 'kairos-v2';
const ASSETS = [
  './', 'index.html', 'manifest.webmanifest',
  'src/ui/app.js', 'src/ui/styles.css',
  'src/calc/astro.js', 'src/calc/swara.js', 'src/calc/chinese.js', 'src/calc/tz.js',
  'src/i18n/ru.json', 'src/i18n/en.json',
  'vendor/astronomy.js', 'data/cities.json',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request)));
});
