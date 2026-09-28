// Офлайн-кэш: приложение открывается без интернета.
// После любой правки файлов увеличьте VERSION — телефоны скачают
// новую версию при следующем запуске приложения.
const VERSION = 'v2';
const CACHE = `zapisi-arai-${VERSION}`;
const FILES = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './logic.js',
  './zip.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(FILES.map(url => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('zapisi-arai-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req)));
});
