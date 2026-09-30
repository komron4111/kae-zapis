// Ошибки страницы — в журнал на сервере (POST /api/errors), чтобы администратор узнал о сбое
// раньше, чем мастер или клиент напишут. Обычный скрипт, не модуль: подключается до app.js,
// okna.js и admin.js и ловит даже то, из-за чего модуль не загрузился.
// Личных данных нет: только текст ошибки, страница без ?m= и ?z=, файл и строка.
// Не больше 5 сообщений за открытие страницы; сбои связи не отправляем — это не ошибки сайта.
(() => {
  let api = 'https://kae-zapis-api.kae-zapis.workers.dev'; // тот же адрес, что API_URL в config.js
  try { api = localStorage.getItem('kae:api') || api; } catch (e) { /* приватный режим */ }
  const source = (document.currentScript && document.currentScript.dataset.source) || 'page';
  const sent = new Set();
  const file = url => String(url || '').split(/[?#]/)[0].split('/').slice(-2).join('/');
  const NOISE = /AbortError|NotAllowedError|Failed to fetch|Load failed|NetworkError|network error|aborted|нет связи/i;

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

  addEventListener('error', e => {
    const el = e.target;
    // Не загрузился скрипт или стиль сайта — например, после выкладки на телефоне смешались версии.
    if (el && el !== window && (el.tagName === 'SCRIPT' || el.tagName === 'LINK')) send(`не загрузился ${file(el.src || el.href)}`, 'файл');
    else if (el === window || !el || !el.tagName) send(e.message, `${file(e.filename)}:${e.lineno}`);
  }, true);
  addEventListener('unhandledrejection', e => {
    const r = e.reason;
    send((r && (r.name === 'AbortError' ? 'AbortError' : r.message)) || String(r), 'promise');
  });
})();
