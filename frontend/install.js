// «Установить на экран „Домой“» (с 2.6.0) — для приложения мастера и страницы администратора.
// Android и Chrome на компьютере: браузер сам умеет ставить приложение (событие beforeinstallprompt) —
// кнопка сразу открывает его окно «Установить». iPhone: сайт не может установить себя сам (так решила
// Apple) — кнопка показывает короткую подсказку: «Поделиться» → «На экран „Домой“» → «Добавить»,
// со стрелкой туда, где эта кнопка у браузера. Во встроенных браузерах Instagram, Telegram и т. п.
// установить нельзя — подсказка просит открыть ссылку в Safari или Chrome.
// По-казахски кнопки браузера названы так, как они подписаны на телефоне (чаще всего по-русски).

import { t } from './i18n.js';

let deferred = null; // отложенное предложение браузера установить приложение
let installed = false;
const listeners = new Set();
const notify = () => listeners.forEach(fn => {
  try { fn(); } catch (e) { /* не страшно */ }
});

addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); // вместо полоски браузера — наша кнопка
  deferred = e;
  notify();
});
addEventListener('appinstalled', () => {
  deferred = null;
  installed = true;
  notify();
});

// Изменилось, можно ли установить (браузер предложил установку или приложение установлено).
export const onInstallChange = fn => listeners.add(fn);

export const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

const ua = navigator.userAgent;
export const isIOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
const isIPad = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
const isAndroid = /Android/.test(ua);
const IN_APP = [['Instagram', /Instagram/], ['Facebook', /FBAN|FBAV|FB_IAB|FBIOS/], ['Telegram', /Telegram/],
  ['TikTok', /TikTok|musical_ly|BytedanceWebview/], ['ВКонтакте', /VKClient|vkontakte/i], ['WhatsApp', /WhatsApp/]];
const inApp = (IN_APP.find(([, re]) => re.test(ua)) || [])[0] || '';
const iosOtherBrowser = isIOS && /CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser/.test(ua);
const safariVersion = Number((ua.match(/Version\/(\d+)/) || [])[1] || 0); // Safari 26 (iOS 26) — «•••» внизу справа

// Показывать ли кнопку: не в установленном приложении; на телефоне — всегда (на iPhone — с подсказкой),
// на компьютере — только если браузер умеет установить сам.
export function canInstall() {
  if (installed || isStandalone()) return false;
  return Boolean(deferred) || isIOS || isAndroid;
}

// Нажали «Установить». opts: name — как называется приложение, icon — значок, after — что сделать потом.
export async function install(opts = {}) {
  if (deferred) {
    const event = deferred;
    deferred = null;
    try {
      event.prompt();
      const choice = await event.userChoice;
      notify();
      return choice.outcome; // 'accepted' | 'dismissed'
    } catch (e) { /* окно не открылось — покажем подсказку */ }
  }
  openGuide(opts);
  return 'guide';
}

const svg = path => `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
const SHARE = svg('<path d="M12 15V3M8 7l4-4 4 4"/><path d="M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8"/>');
const ADD = svg('<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M12 8v8M8 12h8"/>');
const ARROW = svg('<path d="M12 3v16M5 12l7 7 7-7"/>');
const CLOSE = svg('<path d="M6 6l12 12M18 6L6 18"/>');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Шаги для этого браузера и где у него нужная кнопка (стрелка).
function guide() {
  if (inApp) {
    return {
      arrow: 'top-right',
      copy: true,
      steps: [
        t('Ссылка открыта внутри {app} — отсюда на экран «Домой» не добавить.', { app: inApp }),
        isIOS ? t('Нажмите «•••» или «⋮» вверху справа и выберите «Открыть в Safari». Или скопируйте ссылку и вставьте её в Safari.')
          : t('Нажмите «•••» или «⋮» вверху справа и выберите «Открыть в браузере». Или скопируйте ссылку и вставьте её в Chrome.'),
        t('В браузере нажмите «Установить» ещё раз.'),
      ],
    };
  }
  if (isIOS && iosOtherBrowser) {
    return {
      arrow: 'top-right',
      copy: true,
      steps: [
        t('Нажмите {icon} «Поделиться» — в Chrome это значок в адресной строке.', { icon: SHARE }),
        t('Выберите {icon} «На экран „Домой“». Если такого пункта нет — откройте ссылку в Safari.', { icon: ADD }),
        t('Нажмите «Добавить».'),
      ],
    };
  }
  if (isIOS) {
    const compact = safariVersion >= 26 && !isIPad;
    return {
      arrow: isIPad ? 'top-right' : compact ? 'bottom-right' : 'bottom-center',
      steps: [
        compact ? t('Нажмите «•••» внизу справа, затем {icon} «Поделиться».', { icon: SHARE })
          : isIPad ? t('Нажмите {icon} «Поделиться» вверху справа (если его не видно — «•••»).', { icon: SHARE })
          : t('Нажмите {icon} «Поделиться» внизу экрана (если его не видно — «•••»).', { icon: SHARE }),
        t('Пролистайте вниз и выберите {icon} «На экран „Домой“».', { icon: ADD }),
        t('Нажмите «Добавить» вверху справа.'),
      ],
    };
  }
  return {
    arrow: 'top-right',
    steps: [
      t('Откройте меню браузера «⋮» вверху справа.'),
      t('Выберите «Установить приложение» или «Добавить на главный экран».'),
      t('Нажмите «Установить». Если ссылка открыта в Instagram, WhatsApp или Telegram, сначала выберите «Открыть в Chrome».'),
    ],
  };
}

export function closeGuide() {
  const box = document.querySelector('.install-guide');
  if (box) box.remove();
  const arrow = document.querySelector('.install-arrow');
  if (arrow) arrow.remove();
}

function openGuide({ name = 'Beautybook', icon = '', after = '' } = {}) {
  closeGuide();
  const g = guide();
  const box = document.createElement('div');
  box.className = `install-guide${g.arrow.startsWith('bottom') ? ' at-top' : ''}`;
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', t('Установка на экран «Домой»'));
  box.innerHTML = `
    <div class="install-card">
      <button type="button" class="icon-btn install-close" data-install-close aria-label="${t('Закрыть')}">${CLOSE}</button>
      ${icon ? `<img class="install-icon" src="${esc(icon)}" alt="" width="72" height="72">` : ''}
      <h2>${t('Установить {name} на экран «Домой»', { name: esc(name) })}</h2>
      <ol class="install-steps">${g.steps.map(step => `<li>${step}</li>`).join('')}</ol>
      ${g.copy ? `<button type="button" class="btn secondary block" data-install-copy>${t('Скопировать ссылку')}</button>` : ''}
      ${after ? `<p class="hint install-after">${esc(after)}</p>` : ''}
      <button type="button" class="btn primary block" data-install-close>${t('Понятно')}</button>
    </div>`;
  const arrow = document.createElement('div');
  arrow.className = `install-arrow ${g.arrow}`;
  arrow.setAttribute('aria-hidden', 'true');
  arrow.innerHTML = ARROW;
  document.body.append(box, arrow);
  box.addEventListener('click', async e => {
    if (e.target === box || e.target.closest('[data-install-close]')) return closeGuide();
    const copy = e.target.closest('[data-install-copy]');
    if (!copy) return;
    const link = location.origin + location.pathname;
    try {
      await navigator.clipboard.writeText(link);
      copy.textContent = isIOS ? t('Скопировано — вставьте в Safari') : t('Скопировано — вставьте в Chrome');
    } catch (err) {
      copy.textContent = link; // выделите и скопируйте вручную
    }
  });
}
