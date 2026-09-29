// Офлайн-кэш и уведомления о заявках.
// После любой правки файлов увеличьте VERSION — телефоны скачают
// новую версию при следующем запуске приложения.
const VERSION = 'v6';
const CACHE = `zapisi-arai-${VERSION}`;
const FILES = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './logic.js',
  './zip.js',
  './config.js',
  './phone-input.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/logo-neon.png',
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

// Уведомление с сервера: «Новая заявка на запись». Каждое push-сообщение
// обязательно показывается (требование iOS), открытому приложению сообщаем сразу.
self.addEventListener('push', event => {
  let msg = {};
  try {
    msg = event.data ? event.data.json() : {};
  } catch (e) { /* покажем общий текст */ }
  const show = self.registration.showNotification(msg.title || 'Новая заявка на запись', {
    body: msg.body || 'Откройте приложение, чтобы посмотреть заявку',
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    tag: msg.tag || 'request',
    data: { url: msg.url || './?open=requests' },
  });
  const tell = self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then(list => list.forEach(client => client.postMessage({ type: 'new-request' })));
  const badge = self.navigator && self.navigator.setAppBadge ? self.navigator.setAppBadge().catch(() => {}) : null;
  event.waitUntil(Promise.all([show, tell, badge]));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = new URL(event.notification.data && event.notification.data.url || './?open=requests', self.registration.scope).href;
  event.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of list) {
      if (!client.url.startsWith(self.registration.scope) || client.url.includes('/okna/')) continue;
      await client.focus();
      client.postMessage({ type: 'open-requests' });
      return;
    }
    await self.clients.openWindow(url);
  })());
});
