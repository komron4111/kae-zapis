// Уведомления администратора Beautybook (с 2.5.0): сообщения мастеров, новые мастера,
// «Я оплатил(а)» и утренняя сводка по подпискам. Страница администратора без кэша — работает
// только с интернетом, поэтому здесь нет офлайн-файлов, только уведомления.
// Свой Service Worker с областью admin/: подписка на уведомления у администратора своя,
// отдельно от приложения мастера.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

// Каждое push-сообщение обязательно показывается (требование iOS); открытой странице сообщаем сразу.
self.addEventListener('push', event => {
  let msg = {};
  try {
    msg = event.data ? event.data.json() : {};
  } catch (e) { /* покажем общий текст */ }
  const show = self.registration.showNotification(msg.title || 'Beautybook', {
    body: msg.body || 'Откройте страницу администратора',
    icon: '../icons/bb-admin-192.png',
    badge: '../icons/bb-admin-192.png',
    tag: msg.tag || 'admin',
    data: { url: msg.url || './' },
  });
  const tell = self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then(list => list.forEach(client => client.postMessage({ type: 'push', kind: msg.kind || '' })));
  const badge = self.navigator && self.navigator.setAppBadge ? self.navigator.setAppBadge().catch(() => {}) : null;
  event.waitUntil(Promise.all([show, tell, badge]));
});

// Нажали на уведомление: открытая страница переходит куда нужно (чат, карточка мастера, подписки),
// иначе страница открывается по адресу из уведомления.
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || './', self.registration.scope).href;
  event.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of list) {
      if (!client.url.startsWith(self.registration.scope)) continue;
      await client.focus();
      client.postMessage({ type: 'open', url });
      return;
    }
    await self.clients.openWindow(url);
  })());
});
