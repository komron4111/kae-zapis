// Офлайн-кэш и уведомления: заявки клиентов и сообщения администратора.
// После любой правки файлов увеличьте VERSION — телефоны скачают
// новую версию при следующем запуске приложения.
const VERSION = 'v34';
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
  './install.js',
  './i18n.js',
  './kk.js',
  './theme-init.js',
  './errors.js',
  './manifest.webmanifest',
  './icons/bb-favicon-64.png',
  './icons/logo-neon.png',
  './icons/bb-192.png',
  './icons/bb-512.png',
  './icons/bb-maskable-512.png',
  './icons/bb-touch-180.png',
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

// Страница для клиентов (okna/), страница администратора (admin/) и их файлы всегда
// берутся из сети: иначе их новый код может встретиться со старым logic.js из кэша приложения.
const OWN_PAGES = /\/(okna|admin)\//;

async function forClientPage(event) {
  if (OWN_PAGES.test(new URL(event.request.url).pathname)) return true;
  const client = event.clientId ? await self.clients.get(event.clientId) : null;
  return Boolean(client && OWN_PAGES.test(new URL(client.url).pathname));
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    if (await forClientPage(event)) return fetch(req);
    return (await caches.match(req, { ignoreSearch: true })) || fetch(req);
  })());
});

// Уведомление с сервера: «Новая заявка на запись», сообщение администратора (kind: 'chat'), напоминание
// о записи ('remind', 2.8.0) или «Вышло обновление» ('update', 2.8.1). Каждое push-сообщение обязательно
// показывается (требование iOS), открытому приложению сообщаем сразу. Значок на иконке — только для заявок и сообщений.
self.addEventListener('push', event => {
  let msg = {};
  try {
    msg = event.data ? event.data.json() : {};
  } catch (e) { /* покажем общий текст */ }
  const chat = msg.kind === 'chat', remind = msg.kind === 'remind', update = msg.kind === 'update';
  const quiet = remind || update; // без значка на иконке
  const show = self.registration.showNotification(msg.title || (chat ? 'Сообщение от администратора' : remind ? 'Напоминание о записи' : update ? 'Вышло обновление Beautybook' : 'Новая заявка на запись'), {
    body: msg.body || (chat ? 'Откройте чат с администратором' : remind ? 'Откройте приложение, чтобы посмотреть запись' : update ? 'Закройте приложение и откройте снова' : 'Откройте приложение, чтобы посмотреть заявку'),
    icon: './icons/bb-192.png',
    badge: './icons/bb-192.png',
    tag: msg.tag || (chat ? 'chat' : remind ? 'remind' : update ? 'update' : 'request'),
    data: { url: msg.url || (chat ? './?open=chat' : quiet ? './' : './?open=requests') },
  });
  const type = chat ? 'new-chat' : update ? 'check-update' : remind ? '' : 'new-request';
  const tell = type ? self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then(list => list.forEach(client => client.postMessage({ type }))) : null;
  const badge = !quiet && self.navigator && self.navigator.setAppBadge ? self.navigator.setAppBadge().catch(() => {}) : null;
  if (update) self.registration.update().catch(() => {}); // сразу скачать новую версию
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
      const day = new URL(url).searchParams.get('d');
      client.postMessage(url.includes('open=chat') ? { type: 'open-chat' } : url.includes('open=day') ? { type: 'open-day', date: day }
        : url.includes('open=requests') ? { type: 'open-requests' } : { type: 'check-update' });
      return;
    }
    await self.clients.openWindow(url);
  })());
});
