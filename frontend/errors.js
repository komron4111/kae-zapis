// Ошибки страницы — в журнал на сервере (POST /api/errors), чтобы администратор узнал о сбое
// раньше, чем мастер или клиент напишут. Обычный скрипт, не модуль: подключается до app.js,
// okna.js и admin.js и ловит даже то, из-за чего модуль не загрузился.
// Личных данных нет: только текст ошибки, страница без ?m= и ?z=, файл и строка.
// Не больше 5 сообщений за открытие страницы; сбои связи не отправляем — это не ошибки сайта.
(() => {
  // Тот же адрес, что API_URL в config.js: на beautybook.kz — сам сайт, на прежних адресах — Cloudflare.
  let api = /^(www\.)?beautybook\.kz$/.test(location.hostname) ? location.origin : 'https://kae-zapis-api.kae-zapis.workers.dev';
  try { api = localStorage.getItem('kae:api') || api; } catch (e) { /* приватный режим */ }
  const source = (document.currentScript && document.currentScript.dataset.source) || 'page';
  const sent = new Set();
  const file = url => String(url || '').split(/[?#]/)[0].split('/').slice(-2).join('/');
  // Сбои связи — не ошибки сайта; «Script error.» без файла — чужой скрипт (расширение браузера).
  const NOISE = /AbortError|NotAllowedError|Failed to fetch|Load failed|NetworkError|network error|aborted|нет связи|^Script error\.?$/i;

  function send(message, place) {
    message = String(message || '').slice(0, 400);
    const key = `${message}|${place}`;
    if (!message || NOISE.test(message) || sent.has(key) || sent.size >= 5) return;
    sent.add(key);
    const body = JSON.stringify({ source, place: `${location.pathname} ${place}`.slice(0, 160), message });
    try {
      navigator.sendBeacon(`${api}/api/errors`, new Blob([body], { type: 'text/plain' }));
    } catch (e) { /* не страшно */ }
  }

  const own = url => {
    try { return new URL(url, location.href).origin === location.origin; } catch (e) { return false; }
  };

  addEventListener('error', e => {
    const el = e.target;
    if (el && el !== window && (el.tagName === 'SCRIPT' || el.tagName === 'LINK')) {
      // Не загрузился скрипт или стиль сайта — например, после выкладки на телефоне смешались версии.
      // Чужие файлы пропускаем: Instagram и Facebook во встроенном браузере вставляют свой скрипт
      // (connect.facebook.net/en_US/pcm.js), политика безопасности его не пускает — это не сбой сайта.
      const url = el.src || el.href;
      if (own(url)) send(`не загрузился ${file(url)}`, 'файл');
    } else if (el === window || !el || !el.tagName) send(e.message, `${file(e.filename)}:${e.lineno}`);
  }, true);
  addEventListener('unhandledrejection', e => {
    const r = e.reason;
    send((r && (r.name === 'AbortError' ? 'AbortError' : r.message)) || String(r), 'promise');
  });
})();
