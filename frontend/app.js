// Beautybook (до 2.4.0 — Nailapp) — интерфейс приложения. Расчёты — в logic.js, архив — в zip.js.
// Данные живут в телефоне (IndexedDB) и сами сохраняются в облако (сервер backend/ на
// Cloudflare): копия записей и фото, свободное время для клиентов, заявки клиентов.

import * as L from './logic.js';
import { makeZip, readZip } from './zip.js';
import { API_URL, PUBLIC_URL, IS_LOCAL, APP_VERSION } from './config.js';
import { phoneMask } from './phone-input.js';
import * as Install from './install.js';
import { t, getLang, setLang, otherLangLabel } from './i18n.js';

const APP_NAME = 'Beautybook';

phoneMask();

// ---------- Мелочи ----------

const $ = (sel, root = document) => root.querySelector(sel);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
// Секрет личной ссылки клиента на запись.
const newToken = () => L.bytesToB64u(crypto.getRandomValues(new Uint8Array(16)));
const today = () => L.ymd(new Date());
const nowMinutes = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
// Формы слова после числа; четвёртое — по-казахски (там слово после числа не меняется).
const RECORD_FORMS = ['запись', 'записи', 'записей', 'жазылу'];
const VISIT_FORMS = ['оплаченная запись', 'оплаченные записи', 'оплаченных записей', 'төленген жазылу'];
const REQUEST_FORMS = ['заявка', 'заявки', 'заявок', 'өтінім'];
const DAY_FORMS = ['день', 'дня', 'дней', 'күн'];
const YEAR_FORMS = ['год', 'года', 'лет', 'жас'];

const ICONS = {
  calendar: '<rect x="3" y="4.5" width="18" height="16.5" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20.5c.8-3.6 3.3-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M15.5 4.8a3.5 3.5 0 0 1 0 6.4M17.5 15.2c2 .6 3.4 2.4 4 5.3"/>',
  chart: '<path d="M3 21h18M6 17v-5M12 17V6M18 17v-8"/>',
  sliders: '<path d="M4 7h9M19 7h1M4 17h1M11 17h9"/><circle cx="16" cy="7" r="2.5"/><circle cx="8" cy="17" r="2.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  left: '<path d="M15 5l-7 7 7 7"/>',
  right: '<path d="M9 5l7 7-7 7"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  chat: '<path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.6L3 21l1.9-5.4A8.5 8.5 0 1 1 21 11.5z"/>',
  share: '<path d="M12 15V3M8 7l4-4 4 4"/><path d="M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8"/>',
  camera: '<path d="M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  cloud: '<path d="M7 18.5a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.6 1.6 3.8 3.8 0 0 1-.5 7.4z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  instagram: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r=".4"/>',
  gift: '<rect x="3.5" y="9" width="17" height="11.5" rx="1.5"/><path d="M3.5 13h17M12 9v11.5M12 9c-1.2-3.2-5-4.2-5-1.8 0 1.3 1.8 1.8 5 1.8zM12 9c1.2-3.2 5-4.2 5-1.8 0 1.3-1.8 1.8-5 1.8z"/>',
  pin: '<path d="M12 21s-6.5-5.8-6.5-11a6.5 6.5 0 0 1 13 0c0 5.2-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
  edit: '<path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17z"/><path d="M13.5 8.5l3 3"/>',
  tag: '<path d="M3.5 12.3V4.5a1 1 0 0 1 1-1h7.8l8.2 8.2a1 1 0 0 1 0 1.4l-7.8 7.8a1 1 0 0 1-1.4 0z"/><circle cx="8" cy="8" r="1.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  home: '<path d="M4 10.5L12 4l8 6.5V20h-5v-6H9v6H4z"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1 0 1.6-.7 1.6-1.5s-.8-1.3-.8-2.3c0-1 .8-1.7 1.8-1.7H17a4 4 0 0 0 4-4C21 6.7 17 3 12 3z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10.5" cy="7.2" r="1"/><circle cx="15" cy="7.5" r="1"/>',
  archive: '<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M10 13h4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5"/><path d="M5 19.5h14"/>',
};
const icon = name => `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

function formatDate(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const day = `${d.getDate()} ${L.dateMonth(d.getMonth())}`;
  return getLang() === 'kk' ? `${d.getFullYear()} ж. ${day}` : `${day} ${d.getFullYear()}`;
}

function formatDateTime(iso) {
  const d = new Date(iso);
  return isNaN(d) ? '' : t('{date} в {time}', { date: `${d.getDate()} ${L.dateMonth(d.getMonth())}`, time: `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}` });
}

function formatSize(bytes) {
  return bytes < 1e6 ? `${Math.max(1, Math.round(bytes / 1e3))} КБ` : `${(bytes / 1e6).toFixed(1).replace('.', ',')} МБ`;
}

// ---------- Хранилище: IndexedDB в телефоне ----------
// Ключи: 'data' — записи и настройки, 'photo:<id>' — фото,
// 'cloud' — ключ телефона для облака и состояние сохранения (в копию не входит).

const DB_NAME = 'kae-zapis';
let idb = null;

function openIdb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => {
      req.result.onclose = () => { idb = null; };
      resolve(req.result);
    };
    req.onerror = () => reject(req.error);
  });
}

// iOS иногда закрывает соединение с базой, пока приложение в фоне:
// при ошибке открываем базу заново и пробуем ещё раз.
async function withStore(mode, fn) {
  for (let attempt = 0; ; attempt++) {
    try {
      if (!idb) idb = await openIdb();
      return await new Promise((resolve, reject) => {
        const tx = idb.transaction('kv', mode);
        const req = fn(tx.objectStore('kv'));
        tx.oncomplete = () => resolve(req.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } catch (e) {
      idb = null;
      if (attempt) throw e;
    }
  }
}

const dbGet = key => withStore('readonly', store => store.get(key));
const dbSet = (key, value) => withStore('readwrite', store => store.put(value, key));
const dbDel = key => withStore('readwrite', store => store.delete(key));
const dbKeys = () => withStore('readonly', store => store.getAllKeys());

// Настройки вида (скрытые подсказки) — только для этого телефона.
function pref(key, value) {
  try {
    if (value === undefined) return localStorage.getItem(`kae:${key}`);
    localStorage.setItem(`kae:${key}`, value);
  } catch (e) { /* приватный режим — не страшно */ }
  return null;
}

const API = pref('api') || API_URL;

// ---------- Данные ----------

let data = null;
// Данные не прочитались: не сохраняем, чтобы пустой список не затёр настоящий.
let storageBroken = false;
let cloud = freshCloud();
// Заявки клиентов, которые ждут ответа (приходят с сервера).
let requests = [];

function freshData() {
  return {
    appointments: [],
    expenses: [],
    prices: [], // с 2.4.0 мастер (любого направления) заполняет прайс сам
    rent: [{ from: '2000-01', amount: L.DEFAULT_RENT }],
    settings: { ...L.DEFAULT_SETTINGS, themeV: L.THEME_V },
    blocks: [],
    clients: [],
    rentPaid: {}, // оплата аренды: { 'YYYY-MM': 'YYYY-MM-DD' }
    lastBackup: null,
  };
}

function freshCloud() {
  // closing — заявки, подтверждённые без связи: закроем их в облаке при следующем сохранении.
  // bookings — что уже выложено по личным ссылкам клиентов: { token: JSON записи }.
  // account — аккаунт мастера с сервера { name, phone, slug, claimed }; lastPhone — чей аккаунт
  // был на этом телефоне последним (если войдёт другой мастер, чужие данные с телефона уберём).
  // remindPrint — какой список напоминаний о записях уже на сервере (2.8.0).
  return { key: '', pushKey: '', pushOn: false, schedulePrint: '', backupPrint: '', savedAt: null, uploaded: [], closing: [], bookings: {}, error: '', account: null, lastPhone: '', statsPrint: '', remindPrint: '' };
}

const settings = () => ({ ...L.DEFAULT_SETTINGS, ...data.settings });

async function save() {
  if (storageBroken) {
    toast(t('Данные не открылись. Закройте приложение и откройте снова'));
    return false;
  }
  try {
    await dbSet('data', data);
  } catch (e) {
    toast(t('Не удалось сохранить. Проверьте свободное место на телефоне'));
    return false;
  }
  scheduleSync();
  return true;
}

// Заявки занимают время так же, как записи (в свободном времени и предупреждениях).
function busyList() {
  return data.appointments.concat(requests.map(r => ({
    id: `req:${r.id}`, date: r.date, time: r.time, status: 'booked', name: `${r.name} (${t('заявка')})`, phone: r.phone, services: r.services,
  })));
}

// ---------- Экран ----------

// monthAnim, finAnim — куда уехал месяц в календаре и в финансах ('next' или 'prev'), для анимации;
// settingsPage — открытый пункт настроек (null — список пунктов).
const ui = { tab: 'records', month: L.monthOf(today()), day: today(), finMonth: L.monthOf(today()), seenToday: today(), clientQuery: '', monthAnim: null, finAnim: null, settingsPage: null, settingsAnim: null, auth: null, authNote: '', authPhone: '', rentYear: Number(today().slice(0, 4)), rentAnim: null };
const view = $('#view'), fab = $('#fab'), sheet = $('#sheet'), viewer = $('#viewer');

const { isStandalone, isIOS } = Install;

// Вверху каждого раздела — логотип и название приложения (они в index.html),
// справа — кнопки раздела, язык («Қаз» / «Рус») и переключатель светлого и тёмного режима.
function setHeader(actions = '') {
  const dark = colorMode() === 'dark';
  $('#appbar-actions').innerHTML = `${actions}
    <button class="hbtn lang-btn" data-act="toggle-lang" aria-label="${t('Сменить язык')}">${otherLangLabel()}</button>
    <button class="hbtn round" data-act="toggle-mode" aria-label="${dark ? t('Светлый режим') : t('Тёмный режим')}">${icon(dark ? 'sun' : 'moon')}</button>`;
}

// ---------- Тема и режим ----------
// Тема (исходно с 2.9.1 — розово-чёрная, как значок; до этого — пурпурная) — в настройках:
// уходит в облако и копию. Светлый или тёмный режим — только для этого телефона:
// исходно светлый, меняется кнопкой в шапке. Копию темы и режима в localStorage
// читает index.html, чтобы экран сразу открывался в своих цветах.

const colorMode = () => document.documentElement.dataset.mode || 'light';

function applyTheme() {
  const root = document.documentElement;
  const { theme } = settings();
  if (root.dataset.theme !== theme) {
    root.dataset.theme = theme;
    pref('theme', theme);
  }
  // Цвет строки браузера — как у шапки.
  const bar = getComputedStyle(root).getPropertyValue('--bar2').trim();
  if (bar) document.querySelectorAll('meta[name="theme-color"]').forEach(m => { m.content = bar; });
}

function render() {
  applyTheme();
  const gate = authGate();
  document.body.classList.toggle('auth', Boolean(gate));
  if (gate) {
    renderAuth(gate);
    return;
  }
  const tabs = [['records', 'calendar', t('Записи')], ['clients', 'users', t('Клиенты')], ['finance', 'chart', t('Финансы')], ['settings', 'sliders', t('Настройки')]];
  $('#tabbar').innerHTML = tabs.map(([id, ic, label]) =>
    `<button data-tab="${id}"${ui.tab === id ? ' class="active" aria-current="page"' : ''}>${icon(ic)}<span>${label}</span>${id === 'records' && requests.length ? `<i class="tab-badge">${requests.length}</i>` : ''}${id === 'settings' ? chatBadge('tab-badge') : ''}</button>`).join('');
  fab.hidden = ui.tab !== 'records' && ui.tab !== 'clients';
  fab.dataset.act = ui.tab === 'clients' ? 'new-client' : 'new-appt';
  fab.setAttribute('aria-label', ui.tab === 'clients' ? t('Новый клиент') : t('Новая запись'));
  viewer.setAttribute('aria-label', t('Фото результата'));
  if (ui.tab === 'records') renderRecords();
  else if (ui.tab === 'clients') renderClients();
  else if (ui.tab === 'finance') renderFinance();
  else renderSettings();
}

// ---------- Свайпы ----------
// Жест одним пальцем по элементу selector внутри root. Сначала понимаем направление:
// по горизонтали ('x') или по вертикали ('y'). Если оно есть в axes, вызываем move(g)
// на каждое движение и end(g) в конце. В g: target, сдвиг dx и dy, скорость vx и vy
// (пикселей в миллисекунду) и cancelled — жест прервала система.
// skip — внутри этих элементов свой жест, этот свайп там не начинается.
// В поле, где сейчас печатают, свайп тоже не начинается: там палец двигает курсор.

let swipedAt = 0;

function swipe(root, selector, { axes, move, end, enabled = () => true, skip }) {
  let g = null;
  root.addEventListener('pointerdown', e => {
    const target = e.target.closest(selector);
    if (!target || !e.isPrimary || e.button > 0 || !enabled()) return;
    if (skip && e.target.closest(skip)) return;
    const typing = e.target.closest('input, select, textarea');
    if (typing && typing === document.activeElement) return;
    g = { target, id: e.pointerId, x: e.clientX, y: e.clientY, axis: null, dx: 0, dy: 0, vx: 0, vy: 0, cancelled: false, path: [] };
  });
  root.addEventListener('pointermove', e => {
    if (!g || e.pointerId !== g.id) return;
    g.dx = e.clientX - g.x;
    g.dy = e.clientY - g.y;
    if (!g.axis) {
      if (Math.hypot(g.dx, g.dy) < 10) return;
      g.axis = Math.abs(g.dx) > Math.abs(g.dy) ? 'x' : 'y';
      if (!axes.includes(g.axis)) {
        g = null;
        return;
      }
      try { g.target.setPointerCapture(e.pointerId); } catch (err) { /* палец уже отпустили */ }
    }
    g.path.push({ x: e.clientX, y: e.clientY, t: e.timeStamp });
    if (g.path.length > 20) g.path.shift();
    move(g);
  });
  const finish = e => {
    if (!g || e.pointerId !== g.id) return;
    const done = g;
    g = null;
    if (!done.axis) return;
    // Скорость — по последним 100 мс: палец, который остановился, не «бросает».
    const recent = [...done.path, { x: e.clientX, y: e.clientY, t: e.timeStamp }].filter(p => e.timeStamp - p.t <= 100);
    if (recent.length > 1) {
      const a = recent[0], b = recent[recent.length - 1], dt = Math.max(b.t - a.t, 1);
      done.vx = (b.x - a.x) / dt;
      done.vy = (b.y - a.y) / dt;
    }
    done.cancelled = e.type === 'pointercancel';
    swipedAt = Date.now();
    end(done);
  };
  root.addEventListener('pointerup', finish);
  root.addEventListener('pointercancel', finish);
  return {
    // Прервать жест: всё, что сдвинулось, вернётся на место.
    cancel() {
      const done = g;
      g = null;
      if (done && done.axis) end({ ...done, cancelled: true });
    },
  };
}

// После свайпа браузер может прислать «нажатие» на то, что под пальцем, — пропускаем его.
document.addEventListener('click', e => {
  if (Date.now() - swipedAt < 350) {
    e.stopPropagation();
    e.preventDefault();
  }
}, true);

// ---------- Записи ----------

function renderRecords() {
  const now = today();
  const monthAnim = ui.monthAnim;
  ui.monthAnim = null;
  setHeader(ui.day !== now ? `<button class="hbtn" data-act="today">${t('Сегодня')}</button>` : '');
  const counts = {};
  for (const a of data.appointments) if (a.status !== 'cancelled') counts[a.date] = (counts[a.date] || 0) + 1;
  const cells = L.monthGrid(ui.month).map(d => {
    const cls = ['day'];
    if (L.monthOf(d) !== ui.month) cls.push('out');
    if (d === now) cls.push('today');
    if (d === ui.day) cls.push('sel');
    const off = L.blockFor(data.blocks, d), part = !off && L.timeBlocksOn(data.blocks, d).length > 0;
    if (off) cls.push('off');
    if (part) cls.push('part');
    const n = counts[d] || 0;
    const label = L.dayTitle(d) + (n ? `, ${n} ${L.plural(n, RECORD_FORMS)}` : '') + (off ? `, ${t('запись закрыта')}` : part ? `, ${t('есть закрытое время')}` : '');
    return `<button class="${cls.join(' ')}" data-act="day" data-day="${d}" aria-label="${label}"><span>${Number(d.slice(8))}</span><i>${n || ''}</i></button>`;
  }).join('');
  const dayRequests = requests.filter(r => r.date === ui.day);
  const list = data.appointments.filter(a => a.date === ui.day);
  // Закрытое время — в списке дня среди записей, по времени начала.
  const items = [
    ...list.map(a => ({ time: a.time, html: apptCard(a) })),
    ...dayRequests.map(r => ({ time: r.time, html: requestCard(r, false) })),
    ...L.timeBlocksOn(data.blocks, ui.day).map(b => ({ time: b.start, html: closedCard(b) })),
  ].sort((a, b) => a.time.localeCompare(b.time));
  const active = list.filter(a => a.status !== 'cancelled').length;
  const block = L.blockFor(data.blocks, ui.day);
  let dayInfo = '';
  if (block) {
    dayInfo = `
      <div class="banner off">${icon('lock')}
        <div class="grow">${t('Запись закрыта')}${block.note ? `: ${esc(block.note)}` : ''}<small>${blockRange(block)}</small></div>
        <button class="btn small secondary" data-act="edit-block" data-id="${esc(block.id)}">${t('Изменить')}</button>
      </div>`;
  } else if (ui.day >= now) {
    // Время свободно, если в него помещается хотя бы самая короткая услуга прайса.
    const times = L.freeTimes(busyList(), ui.day, settings(), ui.day === now ? nowMinutes() : -1, undefined,
      { prices: data.prices, need: L.shortestService(data.prices, settings()), blocks: data.blocks });
    dayInfo = `<p class="free-line">${times.length ? t('Свободно: {ranges}', { ranges: L.formatRanges(L.toRanges(times)) }) : t('Свободного времени нет')}</p>`;
  }
  view.innerHTML = `
    ${banners()}
    ${requests.length ? `
    <section class="requests" id="requests">
      <h2 class="section-title">${t('Новые заявки')} · ${requests.length}</h2>
      ${requests.map(r => requestCard(r, true)).join('')}
    </section>` : ''}
    <section class="card cal">
      <div class="cal-head">
        <button class="icon-btn" data-act="month" data-delta="-1" aria-label="${t('Предыдущий месяц')}">${icon('left')}</button>
        <b>${L.monthTitle(ui.month)}</b>
        <button class="icon-btn" data-act="month" data-delta="1" aria-label="${t('Следующий месяц')}">${icon('right')}</button>
      </div>
      <div class="cal-grid${monthAnim ? ` enter-${monthAnim}` : ''}">${L.weekdaysShort().map(w => `<span class="wd">${w}</span>`).join('')}${cells}</div>
    </section>
    <div class="day-head"><h2>${L.dayTitle(ui.day)}</h2>${active ? `<span>${active} ${L.plural(active, RECORD_FORMS)}</span>` : ''}</div>
    ${dayInfo}
    ${items.map(x => x.html).join('')}
    ${list.length || dayRequests.length ? '' : `
      <div class="empty">
        <p>${t('На этот день записей нет')}</p>
        <button class="btn secondary small" data-act="new-appt">${icon('plus')} ${t('Добавить запись')}</button>
      </div>`}
    ${!block && ui.day >= now ? `
      <div class="day-actions">
        <button class="btn small secondary" data-act="new-block" data-day="${ui.day}" data-mode="day">${icon('lock')} ${t('Закрыть день')}</button>
        <button class="btn small secondary" data-act="new-block" data-day="${ui.day}" data-mode="time">${icon('clock')} ${t('Закрыть время')}</button>
      </div>` : ''}`;
}

function changeMonth(delta) {
  ui.month = L.addMonths(ui.month, delta);
  ui.monthAnim = delta > 0 ? 'next' : 'prev';
  render();
}

// Свайп влево — следующий месяц, вправо — предыдущий (календарь и финансы).
// Блок едет за пальцем; если сдвинули мало — возвращается на место.
function monthSwipe(selector, part, change) {
  swipe(view, selector, {
    axes: ['x'],
    move(g) {
      const el = part ? g.target.querySelector(part) : g.target;
      el.style.transform = `translateX(${g.dx}px)`;
      el.style.opacity = 1 - Math.min(Math.abs(g.dx) / el.clientWidth, 1) * 0.7;
    },
    end(g) {
      const el = part ? g.target.querySelector(part) : g.target;
      const w = el.clientWidth;
      const flick = Math.abs(g.vx) > 0.4 && Math.sign(g.vx) === Math.sign(g.dx);
      el.classList.add('settle');
      if (g.cancelled || !(Math.abs(g.dx) > w * 0.25 || flick)) {
        el.style.transform = '';
        el.style.opacity = '';
        setTimeout(() => el.classList.remove('settle'), 200);
        return;
      }
      const delta = g.dx < 0 ? 1 : -1;
      el.style.transform = `translateX(${-delta * w}px)`;
      el.style.opacity = 0;
      setTimeout(() => change(delta), 150);
    },
  });
}

monthSwipe('.cal', '.cal-grid', changeMonth);

function blockRange(b) {
  return b.from === b.to ? L.shortDate(b.from) : `${L.shortDate(b.from)} – ${L.shortDate(b.to)}`;
}

// «14:00–16:00 (Врач)» — закрытое время в предупреждениях.
function closedText(list) {
  return list.map(b => `${L.shortTime(b.start)}–${L.shortTime(b.end)}${b.note ? ` (${b.note})` : ''}`).join(', ');
}

function closedCard(b) {
  const details = [b.note, b.from === b.to ? '' : blockRange(b)].filter(Boolean).join(' · ');
  return `
    <button class="appt closed" data-act="edit-block" data-id="${esc(b.id)}">
      <span class="appt-time">${esc(b.start)}</span>
      <span class="appt-main"><b>${t('Закрыто {until}', { until: esc(L.timeTo(b.end)) })}</b>${details ? `<small>${esc(details)}</small>` : ''}</span>
      <span class="appt-sum">${icon('lock')}</span>
    </button>`;
}

function apptCard(a) {
  const due = L.balanceDue(a);
  let sum;
  if (a.status === 'paid') {
    sum = `<span class="badge ok">${t('оплачено')}</span><b>${L.formatMoney(a.total)}</b>`;
  } else if (a.status === 'cancelled') {
    sum = `<span class="badge muted">${t('отмена')}</span>${a.prepaid ? `<small>${t('предоплата {sum}', { sum: L.formatMoney(a.prepaid) })}</small>` : ''}`;
  } else {
    const late = a.date < today() && due > 0;
    sum = `${late ? `<span class="badge warn">${t('не оплачено')}</span>` : `<small>${t('остаток')}</small>`}<b>${L.formatMoney(due)}</b>`;
  }
  const photos = (a.photos || []).length;
  const details = [
    L.servicesLabel(L.servicesOf(a)),
    a.status === 'booked' && a.prepaid ? t('предоплата {sum}', { sum: L.formatMoney(a.prepaid) }) : '',
    photos ? t('{count} фото', { count: photos }) : '',
  ].filter(Boolean).join(' · ');
  return `
    <button class="appt ${esc(a.status)}" data-act="open-appt" data-id="${esc(a.id)}">
      <span class="appt-time">${esc(a.time)}</span>
      <span class="appt-main"><b>${esc(a.name || L.formatPhone(a.phone))}</b><small>${esc(details)}</small></span>
      <span class="appt-sum">${sum}</span>
    </button>`;
}

function requestCard(r, withDate) {
  return `
    <button class="appt request" data-act="open-request" data-id="${esc(r.id)}">
      <span class="appt-time">${esc(r.time)}</span>
      <span class="appt-main"><b>${esc(r.name)}</b><small>${withDate ? `${L.shortDate(r.date)} · ` : ''}${esc(L.servicesLabel(r.services))}</small></span>
      <span class="appt-sum"><span class="badge warn">${t('заявка')}</span></span>
    </button>`;
}

// Новая версия уже скачана (Service Worker сменился, пока приложение открыто) — предлагаем перезапуск.
let updateReady = false;

function banners() {
  const out = [];
  if (updateReady) {
    out.push(`
      <div class="banner">
        <div class="grow">${t('Вышло обновление Beautybook. Нажмите «Обновить» — приложение перезапустится. Если что-то выглядит по-старому, закройте приложение и откройте снова (иногда 2 раза).')}</div>
        <button class="btn small primary" data-act="reload-app">${t('Обновить')}</button>
      </div>`);
  }
  if (storageBroken) {
    out.push(`<div class="banner bad"><div class="grow">${t('Не удалось открыть сохранённые записи. Закройте приложение полностью и откройте снова — изменения сейчас не сохраняются.')}</div></div>`);
  }
  // Ночное окно обновлений (2.8.1): мастера знают, почему приложение может ненадолго не открываться.
  if (!pref('nightNoticeHidden')) {
    out.push(`
      <div class="banner">
        <div class="grow">${t('Обновления Beautybook проходят ночью, с 00:00 до 01:00. В это время приложение может ненадолго не работать — ваши данные сохраняются.')}</div>
        <button class="icon-btn" data-act="hide-night-notice" aria-label="${t('Скрыть')}">${icon('close')}</button>
      </div>`);
  }
  if (!pref('installHidden')) {
    out.push(`
      <div class="banner" data-install-ui${Install.canInstall() ? '' : ' hidden'}>
        <div class="grow">${t('Установите Beautybook на экран «Домой» — приложение будет открываться с иконки, работать без интернета и присылать уведомления о заявках.')}</div>
        <button class="btn small primary" data-act="install">${t('Установить')}</button>
        <button class="icon-btn" data-act="hide-install" aria-label="${t('Скрыть')}">${icon('close')}</button>
      </div>`);
  }
  if (!data.prices.some(p => p.price > 0)) {
    out.push(`
      <div class="banner">
        <div class="grow">${data.prices.length ? t('Заполните цены в прайсе — тогда сумма будет подставляться в запись сама.') : t('Добавьте свои услуги в прайс: название, цену и сколько длится. Клиенты выберут их по вашей ссылке.')}</div>
        <button class="btn small secondary" data-act="goto" data-to="settings" data-page="prices">${t('Прайс')}</button>
      </div>`);
  }
  const sub = subscription();
  const left = L.subscriptionDaysLeft(sub, today());
  if (left !== null && left >= 0 && left <= 3) {
    out.push(`
      <div class="banner warn">
        <div class="grow">${t('Подписка заканчивается {when}. Чтобы приложение не остановилось, продлите её у администратора.', { when: left === 0 ? t('сегодня') : left === 1 ? t('завтра') : esc(L.dateOn(sub.until)) })}</div>
        <button class="btn small secondary" data-act="renew">${t('Продлить')}</button>
      </div>`);
  }
  if (cloud.key && cloud.error) {
    out.push(`
      <div class="banner warn">
        <div class="grow">${t('Облако: {error}. Попробуем снова при следующем изменении.', { error: esc(t(cloud.error)) })}</div>
      </div>`);
  }
  return out.join('');
}

// ---------- Карточка записи ----------

// prefill — данные для новой записи (из карточки клиента или заявки);
// prefill.requestId — запись создаётся из заявки, после сохранения заявка закрывается.
function openAppt(id, prefill = {}) {
  pushSheet(() => drawAppt(id, prefill));
}

function drawAppt(id, prefill) {
  const src = id ? data.appointments.find(a => a.id === id) : null;
  const { requestId, ...fields } = prefill;
  const a = src || { date: ui.day, time: '', name: '', phone: '', services: [], total: 0, prepaid: 0, status: 'booked', note: '', ...fields };
  const chosen = L.servicesOf(a);
  const services = data.prices.filter(p => p.name.trim());
  for (const name of chosen) if (!services.some(p => p.name === name)) services.push({ name, price: 0 });

  sheetHtml(src ? t('Запись') : requestId ? t('Подтверждение записи') : t('Новая запись'), `
    <form id="appt-form" class="sheet-body" novalidate autocomplete="off">
      ${requestId ? `<p class="hint form-note">${t('Проверьте данные, впишите предоплату и сохраните — запись появится в календаре, а время станет занятым для клиентов.')}</p>` : ''}
      <div class="row2">
        <label>${t('Дата')}<input type="date" name="date" value="${esc(a.date)}"></label>
        <label>${t('Время')}<input type="time" name="time" value="${esc(a.time)}"></label>
      </div>
      <div id="time-hint" class="time-hint"></div>
      <button type="button" class="btn secondary block" data-act="pick-client">${icon('user')} ${t('Выбрать клиента')}</button>
      <div id="client-panel"></div>
      <label>${t('Имя клиента')}<input name="name" value="${esc(a.name)}" autocapitalize="words" enterkeyhint="done" placeholder="${t('Например, Айгуль')}"></label>
      <div class="suggest" data-for="name"></div>
      <label>${t('Телефон')}<input name="phone" type="tel" value="${esc(L.phoneFieldStart(a.phone))}" enterkeyhint="done"></label>
      <div class="suggest" data-for="phone"></div>
      <div class="phone-links" id="phone-links"></div>
      ${services.length ? `
      <fieldset>
        <legend>${t('Услуги — можно несколько')}</legend>
        <div class="chips">${services.map(p => `
          <button type="button" class="chip${chosen.includes(p.name) ? ' on' : ''}" data-act="service" data-name="${esc(p.name)}" data-price="${p.price}">
            ${esc(p.name)}${p.price ? `<small>${L.formatAmount(p.price)}</small>` : ''}
          </button>`).join('')}
        </div>
        <input type="hidden" name="services" value="${esc(JSON.stringify(chosen))}">
      </fieldset>` : `
      <label>${t('Услуга')}<input name="service-text" maxlength="60" enterkeyhint="done" placeholder="${t('Например, стрижка')}"></label>
      <p class="hint">${t('Добавьте услуги в «Прайс» — тогда их можно выбирать кнопками, а цена подставится сама.')}</p>`}
      <div class="row2">
        <label>${t('Сумма, ₸')}<input name="total" class="money" inputmode="numeric" enterkeyhint="done" value="${L.formatAmount(a.total)}" placeholder="0"></label>
        <label>${t('Предоплата, ₸')}<input name="prepaid" class="money" inputmode="numeric" enterkeyhint="done" value="${L.formatAmount(a.prepaid)}" placeholder="0"></label>
      </div>
      <div id="summary" class="summary"></div>
      <fieldset>
        <legend>${t('Статус')}</legend>
        <div class="seg">${L.STATUSES.map(s => `
          <button type="button" data-act="status" data-status="${s}"${a.status === s ? ' class="on"' : ''}>${t(L.STATUS_LABELS[s])}</button>`).join('')}
        </div>
        <input type="hidden" name="status" value="${esc(a.status)}">
      </fieldset>
      <label>${t('Заметка')}<input name="note" value="${esc(a.note)}" enterkeyhint="done" placeholder="${t('Пожелания, детали')}"></label>
      ${src ? `
      <fieldset>
        <legend>${t('Фото результата')}</legend>
        <div class="thumbs" data-photos-of="${esc(src.id)}">${thumbs(src)}</div>
        <label class="btn small secondary">${icon('camera')} ${t('Добавить фото')}<input type="file" accept="image/*" multiple class="file-input" data-change="photo" data-id="${esc(src.id)}"></label>
      </fieldset>` : ''}
      <p id="appt-warn" class="warn-text" hidden></p>
      <button type="submit" class="btn primary block">${requestId ? t('Подтвердить запись') : t('Сохранить')}</button>
      ${src ? `<button type="button" class="btn danger block" data-act="delete-appt" data-id="${esc(src.id)}">${t('Удалить запись')}</button>` : ''}
    </form>`);

  const form = $('#appt-form');
  form.dataset.id = src ? src.id : '';
  form.dataset.request = requestId || '';
  form.dataset.token = (src && src.token) || fields.token || '';
  const clients = L.pastClients(data.appointments, data.clients);
  bindSuggest(form, 'name', clients);
  bindSuggest(form, 'phone', clients);
  form.addEventListener('input', () => refreshAppt(form));
  form.addEventListener('submit', e => {
    e.preventDefault();
    saveAppt(form);
  });
  refreshAppt(form);
  loadPhotos(form);
}

const field = (form, name) => form.elements.namedItem(name);
// Услуги записи: кнопки из прайса, а пока прайс пуст — одна услуга текстом (поле «Услуга»).
const chosenServices = form => (field(form, 'services') ? JSON.parse(field(form, 'services').value || '[]')
  : [field(form, 'service-text').value.trim().replace(/\s+/g, ' ').slice(0, 60)].filter(Boolean));
// При редактировании запись (или заявка, из которой она создаётся) не мешает сама себе.
const selfId = form => form.dataset.id || (form.dataset.request ? `req:${form.dataset.request}` : '');

// Пересчитывает остаток, свободное время, предупреждения и ссылки для звонка.
function refreshAppt(form) {
  const total = L.toMoney(field(form, 'total').value);
  const prepaid = L.toMoney(field(form, 'prepaid').value);
  const status = field(form, 'status').value;
  const box = $('#summary');
  if (status === 'paid') {
    box.className = 'summary ok';
    box.innerHTML = `<span>${t('Оплачено полностью')}</span><b>${L.formatMoney(total)}</b>`;
  } else if (status === 'cancelled') {
    box.className = 'summary muted';
    box.innerHTML = `<span>${prepaid ? t('Предоплата {sum} остаётся в приходе. Если вернули её клиенту — поставьте 0.', { sum: L.formatMoney(prepaid) }) : t('Запись отменена.')}</span>`;
  } else if (prepaid > total) {
    box.className = 'summary bad';
    box.innerHTML = `<span>${t('Предоплата больше суммы')}</span>`;
  } else {
    box.className = 'summary';
    box.innerHTML = `<span>${t('Остаток к оплате')}</span><b>${L.formatMoney(total - prepaid)}</b>`;
  }

  const s = settings();
  const busy = busyList();
  const date = field(form, 'date').value, time = field(form, 'time').value;
  // Сколько займёт эта запись: по выбранным услугам; пока их нет — самая короткая услуга.
  const chosen = chosenServices(form);
  const need = chosen.length ? L.servicesDuration(chosen, data.prices, s) : L.shortestService(data.prices, s);
  const block = date ? L.blockFor(data.blocks, date) : null;
  const hint = $('#time-hint');
  if (!date || date < today() || block) {
    hint.innerHTML = '';
  } else {
    const times = L.freeTimes(busy, date, s, date === today() ? nowMinutes() : -1, selfId(form), { prices: data.prices, need, blocks: data.blocks });
    const ranges = L.toRanges(times);
    hint.innerHTML = times.length
      ? `<span>${chosen.length ? t('Свободно для этих услуг ({duration}): {ranges}', { duration: L.formatDuration(need), ranges: L.formatRanges(ranges) }) : t('Свободно: {ranges}', { ranges: L.formatRanges(ranges) })}</span>
         <div class="time-chips">${ranges.map(([from]) => `<button type="button" class="chip small" data-act="pick-time" data-time="${from}">${L.shortTime(from)}</button>`).join('')}</div>`
      : `<span>${t('В этот день свободного времени нет')}</span>`;
  }

  const warnings = [];
  if (block) warnings.push(block.note ? t('Этот день закрыт для записи: {note}.', { note: block.note }) : t('Этот день закрыт для записи.'));
  if (date && time) {
    const near = L.conflicts(busy, date, time, need, selfId(form), { prices: data.prices, settings: s });
    if (near.length) {
      const who = near.map(x => t('{who} в {time}', { who: x.name || x.phone, time: L.shortTime(x.time) })).join(', ');
      warnings.push(t('Пересекается с записью: {who}.', { who }) + (chosen.length ? ` ${t('Эта запись займёт {duration}.', { duration: L.formatDuration(need) })}` : ''));
    }
    const closed = L.closedConflicts(data.blocks, date, time, need);
    if (closed.length) warnings.push(t('Пересекается с закрытым временем: {closed}.', { closed: closedText(closed) }));
    const m = L.toMinutes(time);
    if (m < L.toMinutes(s.dayStart) || m > L.toMinutes(s.lastStart)) {
      warnings.push(t('Вне рабочего времени ({from}–{to}).', { from: L.shortTime(s.dayStart), to: L.shortTime(s.lastStart) }));
    }
  }
  const warn = $('#appt-warn');
  warn.hidden = !warnings.length;
  warn.innerHTML = warnings.map(esc).join('<br>');

  const phone = field(form, 'phone').value;
  const links = $('#phone-links');
  const saved = data.appointments.find(a => a.id === form.dataset.id);
  if (L.canDial(phone)) {
    const d = L.phoneDigits(phone);
    const token = form.dataset.token;
    const text = reminderText(field(form, 'name').value.trim(), chosenServices(form), date, time) + (token ? ` ${t('Ваша запись: {link}', { link: bookingLink(token) })}` : '');
    links.innerHTML = `
      <a class="btn small secondary" href="tel:+${d}">${icon('phone')} ${t('Позвонить')}</a>
      <a class="btn small secondary" href="https://wa.me/${d}?text=${encodeURIComponent(text)}" target="_blank" rel="noopener">${icon('chat')} ${t('Напомнить в WhatsApp')}</a>
      ${saved && saved.status !== 'cancelled' ? `<button type="button" class="btn small secondary" data-act="send-confirmation" data-id="${esc(saved.id)}">${icon('check')} ${t('Отправить подтверждение')}</button>` : ''}`;
  } else {
    links.innerHTML = '';
  }
}

// Личная ссылка клиента на запись — по секрету записи, мастер виден по ней самой.
function bookingLink(token) {
  return `${oknaBase()}?z=${token}`;
}

// «Отправить подтверждение»: у записи появляется личная ссылка клиента,
// WhatsApp открывается сразу по нажатию (иначе iOS его не откроет).
function sendConfirmation(id) {
  const a = data.appointments.find(x => x.id === id);
  if (!a) return;
  if (!a.token) a.token = newToken();
  window.open(`https://wa.me/${L.phoneDigits(a.phone)}?text=${encodeURIComponent(L.confirmationText(a, bookingLink(a.token)))}`, '_blank');
  save();
  scheduleSync(0);
}

// Напоминание клиенту в WhatsApp — на языке приложения мастера.
function reminderText(name, services, date, time) {
  const what = L.servicesLabel(services).toLowerCase();
  if (getLang() === 'kk') {
    let kk = `Сәлеметсіз бе${name ? ', ' + name : ''}!`;
    if (date && time) kk += ` Жазылуыңызды еске саламын: ${[what, L.shortDate(date), L.shortTime(time)].filter(Boolean).join(', ')}.`;
    return kk;
  }
  let text = `Здравствуйте${name ? ', ' + name : ''}!`;
  if (date && time) text += ` Напоминаю о записи${what ? ' на ' + what : ''}: ${L.shortDate(date)} в ${L.shortTime(time)}.`;
  return text;
}

async function saveAppt(form) {
  const v = name => field(form, name).value;
  const rec = {
    date: v('date'),
    time: v('time'),
    name: v('name').trim(),
    phone: L.phoneFromField(v('phone')),
    services: chosenServices(form),
    total: L.toMoney(v('total')),
    prepaid: L.toMoney(v('prepaid')),
    status: v('status'),
    note: v('note').trim(),
  };
  const error = !rec.date ? 'Укажите дату'
    : !rec.time ? 'Укажите время'
    : !rec.name && !rec.phone ? 'Укажите имя или телефон клиента'
    : !rec.services.length ? (field(form, 'services') ? 'Выберите услугу' : 'Напишите услугу')
    : rec.prepaid > rec.total ? 'Предоплата не может быть больше суммы'
    : '';
  if (error) return toast(t(error));

  const now = new Date().toISOString();
  const src = data.appointments.find(a => a.id === form.dataset.id);
  let saved = src;
  if (src) {
    Object.assign(src, rec, { updated: now });
    delete src.service;
  } else {
    saved = { id: uid(), ...rec, photos: [], created: now, updated: now };
    if (form.dataset.token) saved.token = form.dataset.token;
    if (form.dataset.request) saved.source = 'link'; // клиент записался сам, по ссылке
    data.appointments.push(saved);
  }
  if (!(await save())) return;
  ui.day = rec.date;
  ui.month = L.monthOf(rec.date);
  const requestId = form.dataset.request;
  if (requestId) {
    // Запись создана из заявки: закрываем окна записи и заявки и показываем,
    // как отправить клиенту подтверждение.
    requests = requests.filter(r => r.id !== requestId);
    updateBadge();
    afterSheetsClosed = () => openConfirmed(saved.id);
    closeSheet(2);
    render();
    try {
      // Сначала выкладываем новое свободное время, потом закрываем заявку —
      // иначе на пару секунд это время показалось бы клиентам свободным.
      await syncSchedule();
      const booking = L.publicBooking(saved);
      await api('POST', `/api/requests/${requestId}/confirm`, { token: saved.token, booking });
      cloud.bookings = { ...cloud.bookings, [saved.token]: JSON.stringify(booking) };
      await dbSet('cloud', cloud).catch(() => {});
    } catch (e) {
      cloud.closing = [...(cloud.closing || []), requestId];
      await dbSet('cloud', cloud).catch(() => {});
      scheduleSync(10000);
    }
    return;
  }
  closeSheet();
  render();
  toast(src ? t('Запись обновлена') : t('Запись добавлена'));
}

// ---------- Заявки клиентов ----------

function openConfirmed(id) {
  pushSheet(() => drawConfirmed(id));
}

function drawConfirmed(id) {
  const a = data.appointments.find(x => x.id === id);
  if (!a) {
    sheetHtml(t('Запись подтверждена'), `<div class="sheet-body"><p class="empty">${t('Запись не найдена')}</p></div>`);
    return;
  }
  const link = bookingLink(a.token);
  const d = L.phoneDigits(a.phone);
  sheetHtml(t('Запись подтверждена'), `
    <div class="sheet-body okna-done">
      <p class="done-mark">✓</p>
      <h2>${esc(a.name || L.formatPhone(a.phone))}</h2>
      <p>${L.dayTitle(a.date)}, ${L.shortTime(a.time)}<br>${esc(L.servicesLabel(L.servicesOf(a)))}</p>
      <p class="hint">${t('Отправьте клиенту подтверждение — в сообщении будет ссылка, по которой он в любое время увидит свою запись.')}</p>
      ${L.canDial(a.phone) ? `<a class="btn primary block" href="https://wa.me/${d}?text=${encodeURIComponent(L.confirmationText(a, link))}" target="_blank" rel="noopener">${icon('chat')} ${t('Отправить подтверждение в WhatsApp')}</a>` : ''}
      <div class="link-box">${esc(link)}</div>
      <div class="btn-row center">
        <button class="btn small secondary" data-act="copy-booking" data-link="${esc(link)}">${icon('link')} ${t('Скопировать ссылку')}</button>
        <button class="btn small ghost" data-act="close-sheet">${t('Готово')}</button>
      </div>
    </div>`);
}

async function loadRequests() {
  if (!cloud.key) return;
  const res = await api('GET', '/api/requests');
  const closing = cloud.closing || [];
  const fresh = (await res.json()).requests.filter(r => !closing.includes(r.id));
  const changed = JSON.stringify(fresh.map(r => r.id)) !== JSON.stringify(requests.map(r => r.id));
  requests = fresh;
  updateBadge();
  if (changed) {
    renderTabbarOnly();
    if (ui.tab === 'records') render();
  }
}

function renderTabbarOnly() {
  const tab = $('#tabbar [data-tab="records"]');
  if (!tab) return;
  const old = tab.querySelector('.tab-badge');
  if (old) old.remove();
  if (requests.length) tab.insertAdjacentHTML('beforeend', `<i class="tab-badge">${requests.length}</i>`);
}

// Число заявок на значке приложения (iOS 16.4+ для приложения на экране «Домой»).
function updateBadge() {
  try {
    const p = requests.length ? navigator.setAppBadge && navigator.setAppBadge(requests.length) : navigator.clearAppBadge && navigator.clearAppBadge();
    if (p && p.catch) p.catch(() => {});
  } catch (e) { /* значки не поддерживаются */ }
}

function openRequest(id) {
  pushSheet(() => drawRequest(id));
}

function drawRequest(id) {
  const r = requests.find(x => x.id === id);
  if (!r) {
    sheetHtml(t('Заявка'), `<div class="sheet-body"><p class="empty">${t('Заявка уже обработана')}</p></div>`);
    return;
  }
  const total = L.servicesTotal(r.services, data.prices);
  const d = L.phoneDigits(r.phone);
  const what = L.servicesLabel(r.services).toLowerCase();
  const text = t('Здравствуйте, {name}! Ваша заявка получена: {date} в {time} ({what}). Чтобы подтвердить запись, внесите, пожалуйста, предоплату.',
    { name: r.name, date: L.shortDate(r.date), time: L.shortTime(r.time), what });
  const need = L.servicesDuration(r.services, data.prices, settings());
  const near = L.conflicts(data.appointments, r.date, r.time, need, undefined, { prices: data.prices, settings: settings() });
  const block = L.blockFor(data.blocks, r.date);
  const closed = L.closedConflicts(data.blocks, r.date, r.time, need);
  sheetHtml(t('Заявка на запись'), `
    <div class="sheet-body">
      <div class="card request-info">
        <p class="lead"><b>${esc(r.name)}</b></p>
        <p>${esc(L.formatPhone(r.phone))}</p>
        <p>${L.dayTitle(r.date)}, ${L.shortTime(r.time)}</p>
        <p>${esc(L.servicesLabel(r.services))}${total ? ` · ${L.formatMoney(total)}` : ''}</p>
        ${r.comment ? `<p class="hint">«${esc(r.comment)}»</p>` : ''}
        <p class="hint">${t('Заявка пришла: {when}', { when: formatDateTime(r.created) })}</p>
      </div>
      ${near.length || block || closed.length ? `<p class="warn-text">${[
        block ? t('Этот день закрыт для записи.') : '',
        closed.length ? t('Пересекается с закрытым временем: {closed}.', { closed: esc(closedText(closed)) }) : '',
        near.length ? t('Пересекается с записью: {who}.', { who: esc(near.map(x => t('{who} в {time}', { who: x.name || x.phone, time: L.shortTime(x.time) })).join(', ')) }) : '',
      ].filter(Boolean).join(' ')}</p>` : ''}
      <a class="btn secondary block" href="https://wa.me/${d}?text=${encodeURIComponent(text)}" target="_blank" rel="noopener">${icon('chat')} ${t('Написать в WhatsApp')}</a>
      <p class="hint form-note">${t('Попросите предоплату. Когда она придёт, нажмите «Подтвердить запись».')}</p>
      <button class="btn primary block" data-act="confirm-request" data-id="${esc(r.id)}">${t('Подтвердить запись')}</button>
      <button class="btn danger block" data-act="decline-request" data-id="${esc(r.id)}">${t('Отклонить')}</button>
    </div>`);
}

function confirmRequest(id) {
  const r = requests.find(x => x.id === id);
  if (!r) return;
  openAppt(null, {
    requestId: r.id,
    token: r.token || newToken(),
    date: r.date,
    time: r.time,
    name: r.name,
    phone: r.phone,
    services: r.services,
    total: L.servicesTotal(r.services, data.prices),
    note: r.comment,
  });
}

async function declineRequest(id) {
  if (!confirm(t('Отклонить заявку? Это время снова станет свободным для других клиентов.'))) return;
  try {
    await api('POST', `/api/requests/${id}/decline`);
  } catch (e) {
    return toast(t('Не удалось отклонить: {error}', { error: t(e.message) }));
  }
  requests = requests.filter(r => r.id !== id);
  updateBadge();
  closeSheet();
  render();
  toast(t('Заявка отклонена'));
}

// Открыть заявки: из уведомления или по ссылке ?open=requests.
function showRequests() {
  ui.tab = 'records';
  render();
  const open = () => {
    if (requests.length === 1 && sheet.hidden) openRequest(requests[0].id);
    else if (requests.length) $('#requests')?.scrollIntoView({ block: 'start' });
  };
  open();
  loadRequests().then(open).catch(() => {});
}

// ---------- Клиенты ----------
// Отдельной базы клиентов нет: клиент сохраняется вместе с записью.

function personButton(p) {
  const title = p.name || L.formatPhone(p.phone);
  const sub = p.name ? L.formatPhone(p.phone) : '';
  return `<button type="button" class="person" data-act="fill" data-name="${esc(p.name)}" data-phone="${esc(p.phone)}">
    <b>${esc(title)}</b><small>${esc(sub)}</small></button>`;
}

function bindSuggest(form, name, clients) {
  const input = field(form, name);
  const box = form.querySelector(`.suggest[data-for="${name}"]`);
  input.addEventListener('input', () => {
    const q = input.value.trim();
    box.innerHTML = q.length < 2 ? '' : L.findClients(clients, q).slice(0, 5).map(personButton).join('');
  });
  input.addEventListener('blur', () => setTimeout(() => { box.innerHTML = ''; }, 250));
}

function fillClient(form, name, phone) {
  if (name) field(form, 'name').value = name;
  field(form, 'phone').value = L.phoneFieldStart(phone);
  $('#client-panel').innerHTML = '';
  form.querySelectorAll('.suggest').forEach(box => { box.innerHTML = ''; });
  refreshAppt(form);
}

// Список клиентов в карточке записи. Повторное нажатие закрывает его.
function toggleClients() {
  const panel = $('#client-panel');
  if (panel.innerHTML) {
    panel.innerHTML = '';
    return;
  }
  const clients = L.sortByName(L.pastClients(data.appointments, data.clients));
  if (!clients.length) {
    panel.innerHTML = `<div class="panel"><p class="hint">${t('Сохранённых клиентов пока нет. Впишите имя и телефон ниже — после сохранения записи клиент появится в этом списке.')}</p></div>`;
    return;
  }
  panel.innerHTML = `
    <div class="panel">
      <input type="search" id="client-q" placeholder="${t('Имя или номер')}" aria-label="${t('Поиск клиента')}">
      <div id="client-results" class="client-list"></div>
    </div>`;
  const q = $('#client-q');
  const show = () => {
    const found = L.findClients(clients, q.value);
    $('#client-results').innerHTML = found.length ? found.map(personButton).join('') : `<p class="hint">${t('Никого не нашли')}</p>`;
  };
  q.addEventListener('input', show);
  show();
}

function renderClients() {
  setHeader();
  const clients = L.sortByName(L.pastClients(data.appointments, data.clients));
  if (!clients.length) {
    view.innerHTML = `
      <div class="empty">
        <p>${t('Клиентов пока нет. Они появятся здесь после первой записи — или добавьте клиента сами.')}</p>
        <button class="btn secondary small" data-act="new-client">${icon('plus')} ${t('Добавить клиента')}</button>
      </div>`;
    return;
  }
  view.innerHTML = `
    <input type="search" id="clients-q" class="search" placeholder="${t('Поиск по имени или номеру')}" aria-label="${t('Поиск клиента')}" value="${esc(ui.clientQuery)}">
    <section class="card list" id="clients-list"></section>`;
  const q = $('#clients-q');
  const show = () => {
    ui.clientQuery = q.value;
    const found = L.findClients(clients, q.value);
    $('#clients-list').innerHTML = found.length ? found.map(clientRow).join('') : `
      <div class="list-empty">
        <p class="hint">${t('Никого не нашли')}</p>
        <button class="btn secondary small" data-act="new-client" data-q="${esc(q.value.trim())}">${icon('plus')} ${t('Добавить клиента')}</button>
      </div>`;
  };
  q.addEventListener('input', show);
  show();
}

function clientRow(c) {
  return `
    <button class="client-row" data-act="open-client" data-key="${esc(c.key)}">
      <span><b>${esc(c.name || L.formatPhone(c.phone))}</b><small>${esc(c.name ? L.formatPhone(c.phone) : '')}</small></span>
      <span class="meta">${c.last ? `${c.visits} ${L.plural(c.visits, RECORD_FORMS)}<small>${t('последняя {date}', { date: L.shortDate(c.last) })}</small>` : t('без записей')}</span>
    </button>`;
}

function openClient(key) {
  pushSheet(() => drawClient(key));
}

function drawClient(key) {
  const c = L.pastClients(data.appointments, data.clients).find(x => x.key === key);
  if (!c) {
    sheetHtml(t('Клиент'), `<div class="sheet-body"><p class="empty">${t('Записей этого клиента больше нет')}</p></div>`);
    return;
  }
  const visits = L.clientVisits(data.appointments, c);
  const d = L.phoneDigits(c.phone);
  const day = today();
  sheetHtml(c.name || L.formatPhone(c.phone), `
    <div class="sheet-body">
      ${c.name && c.phone ? `<p class="client-phone">${esc(L.formatPhone(c.phone))}</p>` : ''}
      ${L.canDial(c.phone) ? `
      <div class="phone-links">
        <a class="btn small secondary" href="tel:+${d}">${icon('phone')} ${t('Позвонить')}</a>
        <a class="btn small secondary" href="https://wa.me/${d}" target="_blank" rel="noopener">${icon('chat')} WhatsApp</a>
      </div>` : ''}
      ${profileHtml(c, day)}
      <button class="btn primary block" data-act="new-appt-for" data-name="${esc(c.name)}" data-phone="${esc(c.phone)}">${icon('plus')} ${t('Новая запись')}</button>
      <h3 class="section-title">${t('Записи')} · ${visits.length}</h3>
      ${visits.length ? visits.map(a => visitRow(a, day)).join('') : `<p class="hint">${t('Записей пока нет.')}</p>`}
      ${c.id && !visits.length ? `<button class="btn danger block" data-act="delete-client" data-id="${esc(c.id)}">${t('Удалить клиента')}</button>` : ''}
    </div>`);
  loadPhotos(sheet);
}

// О клиенте: Instagram, день рождения, откуда пришёл. Хранится в data.clients
// (у клиента из записей запись там появляется, когда эти данные впервые вносят).
function profileHtml(c, day) {
  const rows = [];
  if (c.instagram) {
    rows.push(`<a class="profile-row" href="https://instagram.com/${esc(c.instagram)}" target="_blank" rel="noopener">${icon('instagram')}<span>@${esc(c.instagram)}</span></a>`);
  }
  if (c.birthday) {
    const age = L.ageOn(c.birthday, day), soon = L.daysToBirthday(c.birthday, day);
    const when = soon === 0 ? ` · ${t('сегодня день рождения!')}` : soon <= 14 ? ` · ${t('через {days}', { days: `${soon} ${L.plural(soon, DAY_FORMS)}` })}` : '';
    rows.push(`<div class="profile-row">${icon('gift')}<span>${L.shortDate(c.birthday)} ${c.birthday.slice(0, 4)}${age == null ? '' : ` · ${age} ${L.plural(age, YEAR_FORMS)}`}${when}</span></div>`);
  }
  if (c.source) rows.push(`<div class="profile-row">${icon('pin')}<span>${t('Откуда: {source}', { source: esc(c.source) })}</span></div>`);
  return `
    <section class="profile">
      ${rows.join('') || `<p class="hint">${t('Instagram, день рождения и откуда пришёл клиент — пока не указаны.')}</p>`}
      <button class="btn small secondary" data-act="edit-client" data-key="${esc(c.key)}">${icon(rows.length ? 'edit' : 'plus')} ${rows.length ? t('Изменить') : t('Добавить')}</button>
    </section>`;
}

function profileFieldsHtml(c = {}) {
  return `
    <label>Instagram<input name="instagram" value="${esc(c.instagram ? '@' + c.instagram : '')}" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done" placeholder="${t('@ник или ссылка на профиль')}"></label>
    <label>${t('День рождения')}<input type="date" name="birthday" value="${esc(c.birthday || '')}"></label>
    <label>${t('Откуда пришёл клиент')}<input name="source" value="${esc(c.source || '')}" enterkeyhint="done" placeholder="${t('Например, Instagram или по рекомендации')}"></label>
    <div class="chips source-chips">${L.CLIENT_SOURCES.map(x => t(x)).map(x => `<button type="button" class="chip small" data-act="pick-source" data-value="${esc(x)}">${esc(x)}</button>`).join('')}</div>`;
}

// Поля карточки из формы; null — Instagram вписан, но на ник не похож.
function readProfile(form) {
  const instagram = field(form, 'instagram').value.trim();
  const profile = L.clientProfile({ instagram, birthday: field(form, 'birthday').value, source: field(form, 'source').value.replace(/:\s*$/, '') });
  return instagram && !profile.instagram ? null : profile;
}

function openClientProfile(key) {
  pushSheet(() => {
    const c = L.pastClients(data.appointments, data.clients).find(x => x.key === key);
    if (!c) {
      sheetHtml(t('Клиент'), `<div class="sheet-body"><p class="empty">${t('Клиент не найден')}</p></div>`);
      return;
    }
    sheetHtml(c.name || L.formatPhone(c.phone), `
      <form id="profile-form" class="sheet-body" novalidate autocomplete="off">
        ${profileFieldsHtml(c)}
        <button type="submit" class="btn primary block">${t('Сохранить')}</button>
      </form>`);
    const form = $('#profile-form');
    form.addEventListener('submit', e => {
      e.preventDefault();
      saveClientProfile(form, c);
    });
  });
}

async function saveClientProfile(form, c) {
  const profile = readProfile(form);
  if (!profile) return toast(t('Instagram: впишите @ник или ссылку на профиль'));
  const list = data.clients || [];
  const saved = c.id ? list.find(x => x.id === c.id) : null;
  const base = saved || { id: uid(), name: c.name, phone: c.phone, created: new Date().toISOString() };
  const entry = { id: base.id, name: base.name, phone: base.phone, created: base.created, ...profile };
  data.clients = saved ? list.map(x => (x.id === saved.id ? entry : x)) : [...list, entry];
  if (!(await save())) return;
  closeSheet(); // назад в карточку — она нарисуется заново
  toast(t('Данные клиента сохранены'));
}

// Новый клиент без записи: имя, телефон и, если известно, Instagram, день рождения,
// откуда пришёл. Он появится в списке клиентов и в «Выбрать клиента» при записи.
function openNewClient(prefill = {}) {
  pushSheet(() => {
    sheetHtml(t('Новый клиент'), `
      <form id="client-form" class="sheet-body" novalidate autocomplete="off">
        <label>${t('Имя клиента')}<input name="name" value="${esc(prefill.name)}" autocapitalize="words" enterkeyhint="done" placeholder="${t('Например, Айгуль')}"></label>
        <label>${t('Телефон')}<input name="phone" type="tel" value="${esc(L.phoneFieldValue(prefill.phone))}" enterkeyhint="done"></label>
        ${profileFieldsHtml()}
        <p class="hint form-note">${t('Клиент появится в списке и в «Выбрать клиента», когда будете делать запись.')}</p>
        <button type="submit" class="btn primary block">${t('Сохранить клиента')}</button>
      </form>`);
    const form = $('#client-form');
    form.addEventListener('submit', e => {
      e.preventDefault();
      saveClient(form);
    });
  });
}

async function saveClient(form) {
  const name = field(form, 'name').value.trim().slice(0, 60);
  const phone = L.phoneFromField(field(form, 'phone').value);
  if (!name && !phone) return toast(t('Укажите имя или телефон клиента'));
  if (phone && L.phoneFieldDigits(phone).length < 10) return toast(t('Номер телефона неполный'));
  const profile = readProfile(form);
  if (!profile) return toast(t('Instagram: впишите @ник или ссылку на профиль'));
  const twin = L.findTwin(L.pastClients(data.appointments, data.clients), name, phone);
  if (twin) return toast(t('Такой клиент уже есть: {name}', { name: twin.name || L.formatPhone(twin.phone) }));
  data.clients = [...(data.clients || []), { id: uid(), name, phone, created: new Date().toISOString(), ...profile }];
  if (!(await save())) return;
  closeSheet();
  ui.clientQuery = '';
  render();
  toast(t('Клиент добавлен'));
}

function visitRow(a, day) {
  const money = a.status === 'paid' ? t('оплачено {sum}', { sum: L.formatMoney(a.total) })
    : a.status === 'cancelled' ? t('отмена')
    : t('остаток {sum}', { sum: L.formatMoney(L.balanceDue(a)) });
  const canPhoto = a.date <= day && a.status !== 'cancelled';
  return `
    <div class="visit ${esc(a.status)}">
      <button class="visit-main" data-act="open-appt" data-id="${esc(a.id)}">
        <b>${L.shortDate(a.date)} ${a.date.slice(0, 4)}, ${esc(L.shortTime(a.time))}</b>
        <small>${esc(L.servicesLabel(L.servicesOf(a)))} · ${money}</small>
        ${a.note ? `<small>${esc(a.note)}</small>` : ''}
      </button>
      <div class="thumbs" data-photos-of="${esc(a.id)}">${thumbs(a)}</div>
      ${canPhoto ? `<label class="btn small secondary">${icon('camera')} ${t('Фото')}<input type="file" accept="image/*" multiple class="file-input" data-change="photo" data-id="${esc(a.id)}"></label>` : ''}
    </div>`;
}

// ---------- Фото результата ----------
// Фото сжимается до 1280 px по длинной стороне и хранится в IndexedDB
// под ключом 'photo:<id>'; в записи — список id. В облако уходит при сохранении.

const photoUrls = new Map();

async function photoUrl(id) {
  if (photoUrls.has(id)) return photoUrls.get(id);
  const rec = await dbGet('photo:' + id);
  if (!rec) return '';
  const url = URL.createObjectURL(new Blob([rec.data], { type: rec.type || 'image/jpeg' }));
  photoUrls.set(id, url);
  return url;
}

function forgetPhoto(id) {
  const url = photoUrls.get(id);
  if (url) URL.revokeObjectURL(url);
  photoUrls.delete(id);
}

function thumbs(a) {
  return (a.photos || []).map(id => `
    <button type="button" class="thumb" data-act="view-photo" data-appt="${esc(a.id)}" data-photo="${esc(id)}">
      <img data-photo="${esc(id)}" alt="${t('Фото результата')}">
    </button>`).join('');
}

// Подставляет картинки в <img data-photo> внутри root.
function loadPhotos(root) {
  root.querySelectorAll('img[data-photo]').forEach(async img => {
    const url = await photoUrl(img.dataset.photo).catch(() => '');
    if (url) img.src = url;
  });
}

function refreshPhotoViews(apptId) {
  const a = data.appointments.find(x => x.id === apptId);
  document.querySelectorAll('[data-photos-of]').forEach(box => {
    if (box.dataset.photosOf !== apptId) return;
    box.innerHTML = a ? thumbs(a) : '';
    loadPhotos(box);
  });
}

function compressImage(file, maxSide = 1280, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('toBlob'))), 'image/jpeg', quality);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image'));
    };
    img.src = url;
  });
}

async function addPhotos(apptId, files) {
  const a = data.appointments.find(x => x.id === apptId);
  if (!a || !files.length) return;
  toast(t('Добавляем фото…'));
  let added = 0;
  for (const file of files) {
    try {
      const blob = await compressImage(file);
      const id = uid();
      await dbSet('photo:' + id, { type: 'image/jpeg', data: await blob.arrayBuffer(), created: new Date().toISOString() });
      a.photos = [...(a.photos || []), id];
      added++;
    } catch (e) {
      toast(t('Не удалось добавить фото'));
    }
  }
  if (!added || !(await save())) return;
  refreshPhotoViews(apptId);
  if (ui.tab === 'records') render();
  toast(added > 1 ? t('Добавлено фото: {count}', { count: added }) : t('Фото добавлено'));
}

// Просмотр фото на весь экран. Свайп влево и вправо — соседние фото того же окна
// (в карточке клиента — фото всех его записей), вверх или вниз — закрыть.
// На странице три слайда: текущее фото и соседние, чтобы их было видно при свайпе.

let viewerState = null; // { list: [{ apptId, photoId }], index, file, busy }

function openViewer(thumb) {
  const root = thumb.closest('#sheet') || view;
  const list = [...root.querySelectorAll('.thumb[data-act="view-photo"]')].map(b => ({ apptId: b.dataset.appt, photoId: b.dataset.photo }));
  const index = Math.max(0, list.findIndex(p => p.photoId === thumb.dataset.photo));
  viewerState = { list, index, file: null, busy: false };
  viewer.className = 'viewer';
  viewer.removeAttribute('style');
  viewer.innerHTML = `
    <div class="viewer-bar">
      <button class="icon-btn" data-act="close-viewer" aria-label="${t('Закрыть')}">${icon('close')}</button>
      <span class="grow viewer-count"></span>
      <button class="btn small" data-act="share-photo">${icon('share')} ${t('Поделиться')}</button>
      <button class="icon-btn" data-act="delete-photo" aria-label="${t('Удалить фото')}">${icon('trash')}</button>
    </div>
    <div class="viewer-stage"><div class="viewer-track"></div></div>`;
  viewer.hidden = false;
  showPhoto();
}

function showPhoto() {
  const state = viewerState;
  const { list, index } = state;
  const track = $('.viewer-track', viewer);
  const near = [index - 1, index, index + 1].filter(i => i >= 0 && i < list.length);
  for (const el of [...track.children]) if (!near.includes(Number(el.dataset.index))) el.remove();
  for (const i of near) {
    let slide = $(`.viewer-slide[data-index="${i}"]`, track);
    if (!slide) {
      slide = document.createElement('div');
      slide.className = 'viewer-slide';
      slide.dataset.index = i;
      slide.innerHTML = `<img alt="${t('Фото результата')}" draggable="false">`;
      track.append(slide);
      photoUrl(list[i].photoId).then(url => { if (url) slide.firstChild.src = url; }).catch(() => {});
    }
    slide.style.transform = `translateX(${(i - index) * 100}%)`;
  }
  track.style.transform = '';
  $('.viewer-count', viewer).textContent = list.length > 1 ? t('{index} из {total}', { index: index + 1, total: list.length }) : '';
  // Файл для «Поделиться» готовим заранее: iPhone открывает меню, только если
  // share() вызван сразу по нажатию.
  const { photoId } = list[index];
  state.file = null;
  dbGet('photo:' + photoId).then(rec => {
    if (rec && viewerState === state && list[state.index].photoId === photoId) {
      state.file = new File([rec.data], `foto-${photoId}.jpg`, { type: rec.type || 'image/jpeg' });
    }
  }).catch(() => {});
}

const currentSlide = () => viewerState && $(`.viewer-slide[data-index="${viewerState.index}"]`, viewer);

// Анимация в конце жеста: включаем плавность, меняем вид, через 250 мс — then().
function settleViewer(change, then) {
  const state = viewerState;
  state.busy = true;
  viewer.classList.add('settle');
  change();
  setTimeout(() => {
    if (viewerState !== state) return;
    viewer.classList.remove('settle');
    state.busy = false;
    if (then) then();
  }, 250);
}

// Плавно закрыть: фото уезжает вверх или вниз (direction = -1 или 1) или просто гаснет.
function hideViewer(direction = 0) {
  if (!viewerState || viewerState.busy) return;
  const slide = currentSlide();
  settleViewer(() => {
    if (direction && slide) slide.style.transform = `translateY(${direction * viewer.clientHeight}px) scale(.8)`;
    else viewer.style.opacity = 0;
    viewer.style.backgroundColor = 'rgba(0, 0, 0, 0)';
    $('.viewer-bar', viewer).style.opacity = 0;
  }, closeViewer);
}

function closeViewer() {
  pinch.points.clear();
  pinch.start = null;
  viewer.hidden = true;
  viewer.innerHTML = '';
  viewer.className = 'viewer';
  viewer.removeAttribute('style');
  viewerState = null;
}

const viewerSwipe = swipe(viewer, '.viewer-stage', {
  axes: ['x', 'y'],
  enabled: () => Boolean(viewerState && !viewerState.busy && !pinch.start),
  move(g) {
    const { list, index } = viewerState;
    if (g.axis === 'x') {
      // У первого и последнего фото тянется туго: дальше листать некуда.
      const edge = (g.dx > 0 && index === 0) || (g.dx < 0 && index === list.length - 1);
      $('.viewer-track', viewer).style.transform = `translateX(${edge ? g.dx / 3 : g.dx}px)`;
      return;
    }
    const slide = currentSlide();
    if (!slide) return;
    const k = Math.min(Math.abs(g.dy) / viewer.clientHeight, 1);
    slide.style.transform = `translateY(${g.dy}px) scale(${1 - k * 0.3})`;
    viewer.style.backgroundColor = `rgba(0, 0, 0, ${Math.max(1 - k * 2.5, 0)})`;
    $('.viewer-bar', viewer).style.opacity = Math.max(1 - k * 4, 0);
  },
  end(g) {
    const state = viewerState;
    const { list, index } = state;
    if (g.axis === 'x') {
      const w = viewer.clientWidth;
      const step = g.dx < 0 ? 1 : -1;
      const flick = Math.abs(g.vx) > 0.35 && Math.sign(g.vx) === Math.sign(g.dx);
      const go = !g.cancelled && (Math.abs(g.dx) > w * 0.2 || flick) && list[index + step];
      const track = $('.viewer-track', viewer);
      settleViewer(() => { track.style.transform = go ? `translateX(${-step * w}px)` : ''; }, () => {
        if (!go) return;
        state.index += step;
        showPhoto();
      });
      return;
    }
    const flick = Math.abs(g.vy) > 0.5 && Math.sign(g.vy) === Math.sign(g.dy);
    if (!g.cancelled && (Math.abs(g.dy) > 100 || flick)) {
      hideViewer(g.dy < 0 ? -1 : 1);
      return;
    }
    const slide = currentSlide();
    settleViewer(() => {
      if (slide) slide.style.transform = 'translateX(0)';
      viewer.style.backgroundColor = '';
      $('.viewer-bar', viewer).style.opacity = '';
    });
  },
});

// Два пальца на фото: развести — увеличить, свести — уменьшить. Отпустили —
// фото плавно возвращается к обычному размеру. Пока пальцев два, свайпы не работают.
const pinch = { points: new Map(), start: null };

function pinchNow() {
  const [a, b] = [...pinch.points.values()];
  return { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
}

viewer.addEventListener('pointerdown', e => {
  if (!viewerState || !e.target.closest('.viewer-stage')) return;
  pinch.points.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch.points.size !== 2 || pinch.start) return;
  viewerSwipe.cancel(); // первый палец мог уже начать свайп
  const img = currentSlide() && currentSlide().querySelector('img');
  if (!img) return;
  const { dist, mid } = pinchNow();
  const box = img.getBoundingClientRect();
  img.classList.remove('unzoom');
  img.style.transformOrigin = `${mid.x - box.left}px ${mid.y - box.top}px`;
  pinch.start = { img, dist: dist || 1, mid };
}, true);

viewer.addEventListener('pointermove', e => {
  if (!pinch.points.has(e.pointerId)) return;
  pinch.points.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (!pinch.start || pinch.points.size < 2) return;
  const { dist, mid } = pinchNow();
  const scale = Math.min(Math.max(dist / pinch.start.dist, 0.6), 5);
  pinch.start.img.style.transform = `translate(${mid.x - pinch.start.mid.x}px, ${mid.y - pinch.start.mid.y}px) scale(${scale})`;
}, true);

function liftFinger(e) {
  if (!pinch.points.delete(e.pointerId) || !pinch.start || pinch.points.size >= 2) return;
  const { img } = pinch.start;
  pinch.start = null;
  img.classList.add('unzoom');
  img.style.transform = '';
  setTimeout(() => img.classList.remove('unzoom'), 300);
}
viewer.addEventListener('pointerup', liftFinger, true);
viewer.addEventListener('pointercancel', liftFinger, true);
// iPhone: двумя пальцами увеличиваем фото, а не всю страницу.
viewer.addEventListener('gesturestart', e => e.preventDefault());

async function sharePhoto() {
  if (!viewerState) return;
  let { file } = viewerState;
  if (!file) {
    const { photoId } = viewerState.list[viewerState.index];
    const rec = await dbGet('photo:' + photoId).catch(() => null);
    if (!rec) return toast(t('Фото не найдено'));
    file = new File([rec.data], `foto-${photoId}.jpg`, { type: rec.type || 'image/jpeg' });
  }
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file] });
    else downloadFile(file);
  } catch (e) {
    if (e.name !== 'AbortError') toast(t('Не удалось поделиться фото'));
  }
}

async function deletePhoto() {
  if (!viewerState || !confirm(t('Удалить это фото?'))) return;
  const state = viewerState;
  const { apptId, photoId } = state.list[state.index];
  const a = data.appointments.find(x => x.id === apptId);
  if (a) a.photos = (a.photos || []).filter(id => id !== photoId);
  if (!(await save())) return;
  await dbDel('photo:' + photoId).catch(() => {});
  forgetPhoto(photoId);
  refreshPhotoViews(apptId);
  if (ui.tab === 'records') render();
  toast(t('Фото удалено'));
  if (viewerState !== state) return;
  // Остаёмся в просмотре на соседнем фото; если фото больше нет — закрываем.
  state.list.splice(state.index, 1);
  if (!state.list.length) return closeViewer();
  state.index = Math.min(state.index, state.list.length - 1);
  $('.viewer-track', viewer).innerHTML = '';
  showPhoto();
}

// Удаляет фото, на которые не ссылается ни одна запись.
async function cleanupPhotos() {
  const used = new Set(data.appointments.flatMap(a => a.photos || []));
  const keys = await dbKeys().catch(() => []);
  for (const key of keys) {
    if (typeof key !== 'string' || !key.startsWith('photo:')) continue;
    const id = key.slice(6);
    if (used.has(id)) continue;
    await dbDel(key).catch(() => {});
    forgetPhoto(id);
  }
}

// ---------- Закрытые дни и закрытое время ----------
// Закрыть можно дни целиком или часть дня: время с … до … в один день или в каждый из нескольких.

// mode — что закрываем в новом блоке: 'day' (весь день) или 'time' (часть дня).
function openBlock(id, day, mode) {
  pushSheet(() => drawBlock(id, day, mode));
}

function drawBlock(id, day, mode = 'day') {
  const src = id ? data.blocks.find(b => b.id === id) : null;
  const b = src || { from: day, to: day, note: '' };
  const timed = src ? L.isTimeBlock(src) : mode === 'time';
  sheetHtml(src ? (timed ? t('Закрытое время') : t('Закрытые дни')) : t('Закрыть запись'), `
    <form id="block-form" class="sheet-body" novalidate autocomplete="off">
      <div class="seg two">
        <button type="button" data-act="block-mode" data-mode="day"${timed ? '' : ' class="on"'}>${t('Весь день')}</button>
        <button type="button" data-act="block-mode" data-mode="time"${timed ? ' class="on"' : ''}>${t('Часть дня')}</button>
      </div>
      <input type="hidden" name="mode" value="${timed ? 'time' : 'day'}">
      <p id="block-hint" class="hint form-note"></p>
      <div class="row2">
        <label>${t('С')}<input type="date" name="from" value="${esc(b.from)}"></label>
        <label>${t('По')}<input type="date" name="to" value="${esc(b.to)}"></label>
      </div>
      <div id="block-time" class="row2">
        <label>${t('Время с')}<input type="time" name="start" value="${esc(b.start || '')}"></label>
        <label>${t('до')}<input type="time" name="end" value="${esc(b.end || '')}"></label>
      </div>
      <div id="block-free" class="time-hint"></div>
      <label>${t('Причина (видна только вам)')}<input name="note" value="${esc(b.note)}" enterkeyhint="done"></label>
      <p id="block-warn" class="warn-text" hidden></p>
      <button type="submit" class="btn primary block">${src ? t('Сохранить') : t('Закрыть запись')}</button>
      ${src ? `<button type="button" class="btn danger block" data-act="delete-block" data-id="${esc(src.id)}">${t('Открыть запись снова')}</button>` : ''}
    </form>`);
  const form = $('#block-form');
  form.dataset.id = src ? src.id : '';
  form.addEventListener('input', () => refreshBlock(form));
  form.addEventListener('submit', e => {
    e.preventDefault();
    saveBlock(form);
  });
  refreshBlock(form);
}

// Что закрывается по форме: { from, to, note }, у части дня ещё start и end.
function blockFromForm(form) {
  const v = name => field(form, name).value;
  const from = v('from'), to = v('to') || from;
  const rec = { from: from <= to ? from : to, to: from <= to ? to : from, note: v('note').trim() };
  if (v('mode') === 'time') Object.assign(rec, { start: v('start'), end: v('end') });
  return rec;
}

// Подсказка по выбранному, свободное время, которое останется клиентам, и записи, которые попадут в закрытое.
function refreshBlock(form) {
  const rec = blockFromForm(form);
  const timed = field(form, 'mode').value === 'time';
  const ready = Boolean(rec.from) && (!timed || L.isTimeWindow(rec.start, rec.end));
  $('#block-time').hidden = !timed;
  $('#block-hint').textContent = timed ? t('В эти часы клиенты не смогут записаться по ссылке.') : t('В эти дни клиенты не увидят свободного времени по ссылке.');
  field(form, 'note').placeholder = timed ? t('Учёба, врач…') : t('Отпуск, болезнь…');

  const free = $('#block-free');
  free.textContent = '';
  if (timed && ready && rec.from === rec.to && rec.from >= today() && !L.blockFor(data.blocks, rec.from)) {
    const s = settings();
    const blocks = [...data.blocks.filter(b => b.id !== form.dataset.id), rec];
    const times = L.freeTimes(busyList(), rec.from, s, rec.from === today() ? nowMinutes() : -1, undefined,
      { prices: data.prices, need: L.shortestService(data.prices, s), blocks });
    free.textContent = times.length ? t('Останется свободно: {ranges}', { ranges: L.formatRanges(L.toRanges(times)) }) : t('Свободного времени в этот день не останется');
  }

  const n = ready ? L.blockConflicts(data.appointments, rec, { prices: data.prices, settings: settings() }).length : 0;
  const warn = $('#block-warn');
  warn.hidden = !n;
  if (n) warn.textContent = t(timed ? 'На это время уже есть {count} — перенесите или отмените.' : 'На эти дни уже есть {count} — перенесите или отмените.', { count: `${n} ${L.plural(n, RECORD_FORMS)}` });
}

async function saveBlock(form) {
  const rec = blockFromForm(form);
  const timed = 'start' in rec;
  const error = !rec.from ? 'Укажите дату'
    : timed && (!rec.start || !rec.end) ? 'Укажите время'
    : timed && !L.isTimeWindow(rec.start, rec.end) ? 'Время «до» должно быть позже, чем «с»'
    : '';
  if (error) return toast(t(error));
  const src = data.blocks.find(b => b.id === form.dataset.id);
  if (src) {
    delete src.start; // часть дня могли поменять на весь день
    delete src.end;
    Object.assign(src, rec);
  } else {
    data.blocks.push({ id: uid(), ...rec });
  }
  if (!(await save())) return;
  // Показываем закрытое: если его дни — не открытый сейчас день, переходим к первому.
  if (ui.day < rec.from || ui.day > rec.to) {
    ui.day = rec.from;
    ui.month = L.monthOf(rec.from);
  }
  closeSheet();
  render();
  toast(timed ? t('Время закрыто для записи') : rec.from === rec.to ? t('День закрыт для записи') : t('Дни закрыты для записи'));
}

// ---------- Финансы ----------

function renderFinance() {
  setHeader();
  const ym = ui.finMonth;
  const anim = ui.finAnim;
  ui.finAnim = null;
  const r = L.monthReport(data, ym);
  const expenses = data.expenses.filter(e => L.monthOf(e.date) === ym).sort((a, b) => b.date.localeCompare(a.date));
  view.innerHTML = `
    <div class="slide-clip"><div class="fin-page${anim ? ` enter-${anim}` : ''}">
    <div class="month-nav">
      <button class="icon-btn" data-act="fin-month" data-delta="-1" aria-label="${t('Предыдущий месяц')}">${icon('left')}</button>
      <b>${L.monthTitle(ym)}</b>
      <button class="icon-btn" data-act="fin-month" data-delta="1" aria-label="${t('Следующий месяц')}">${icon('right')}</button>
    </div>
    <section class="card result ${r.profit < 0 ? 'neg' : 'pos'}">
      <span>${t('Чистая прибыль')}</span>
      <strong>${L.formatMoney(r.profit)}</strong>
      <small>${t('приход − материалы − аренда')}</small>
    </section>
    <section class="card lines">
      <div class="line">
        <span>${t('Приход')}<small>${t('получено от клиентов')}${r.paidVisits ? ` · ${r.paidVisits} ${L.plural(r.paidVisits, VISIT_FORMS)}` : ''}</small></span>
        <b class="in">${L.formatMoney(r.income)}</b>
      </div>
      <div class="line"><span>${t('Материалы')}</span><b>${L.formatMoney(-r.materials)}</b></div>
      <button class="line line-btn" data-act="rent-month" data-month="${ym}">
        <span>${t('Аренда')}<small>${rentPaid(ym) ? t('оплачена {date}', { date: L.shortDate(rentPaid(ym)) }) : t('оплата не отмечена — нажмите, чтобы отметить')}</small></span>
        <b>${L.formatMoney(-r.rent)}</b>
      </button>
      ${r.expected ? `
      <div class="line soft">
        <span>${t('Ожидается ещё')}<small>${t('остатки по записям, которые пока не оплачены')}</small></span>
        <b>${L.formatMoney(r.expected)}</b>
      </div>` : ''}
    </section>
    <div class="section-head">
      <h2>${t('Расходы на материалы')}</h2>
      <button class="btn small secondary" data-act="new-expense">${icon('plus')} ${t('Добавить')}</button>
    </div>
    ${expenses.length ? `<section class="card list">${expenses.map(e => `
      <button class="exp" data-act="open-expense" data-id="${esc(e.id)}">
        <span><b>${esc(e.note || t('Материалы'))}</b><small>${L.shortDate(e.date)}</small></span>
        <b>${L.formatMoney(e.amount)}</b>
      </button>`).join('')}</section>` : `<div class="empty"><p>${t('В этом месяце расходов на материалы нет')}</p></div>`}
    </div></div>`;
}

function changeFinMonth(delta) {
  ui.finMonth = L.addMonths(ui.finMonth, delta);
  ui.finAnim = delta > 0 ? 'next' : 'prev';
  render();
}

monthSwipe('.fin-page', null, changeFinMonth);

function openExpense(id) {
  pushSheet(() => drawExpense(id));
}

function drawExpense(id) {
  const src = id ? data.expenses.find(e => e.id === id) : null;
  const defaultDate = ui.finMonth === L.monthOf(today()) ? today() : `${ui.finMonth}-01`;
  const e = src || { date: defaultDate, amount: 0, note: '' };
  sheetHtml(src ? t('Расход') : t('Расход на материалы'), `
    <form id="exp-form" class="sheet-body" novalidate autocomplete="off">
      <label>${t('Сумма, ₸')}<input name="amount" class="money" inputmode="numeric" enterkeyhint="done" value="${L.formatAmount(e.amount)}" placeholder="0"></label>
      <label>${t('Что купили')}<input name="note" value="${esc(e.note)}" enterkeyhint="done" placeholder="${t('Материалы, расходники, инструменты…')}"></label>
      <label>${t('Дата')}<input type="date" name="date" value="${esc(e.date)}"></label>
      <button type="submit" class="btn primary block">${t('Сохранить')}</button>
      ${src ? `<button type="button" class="btn danger block" data-act="delete-expense" data-id="${esc(src.id)}">${t('Удалить расход')}</button>` : ''}
    </form>`);
  const form = $('#exp-form');
  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    const rec = { date: field(form, 'date').value, amount: L.toMoney(field(form, 'amount').value), note: field(form, 'note').value.trim() };
    if (!rec.amount) return toast(t('Укажите сумму'));
    if (!rec.date) return toast(t('Укажите дату'));
    if (src) Object.assign(src, rec);
    else data.expenses.push({ id: uid(), ...rec });
    if (!(await save())) return;
    ui.finMonth = L.monthOf(rec.date);
    closeSheet();
    render();
    toast(t('Расход сохранён'));
  });
}

// ---------- Настройки ----------

// Главный экран — список пунктов; каждый пункт открывается отдельно (ui.settingsPage).
const SETTINGS_PAGES = {
  account: ['user', 'Аккаунт'],
  cloud: ['cloud', 'Облако и заявки'],
  remind: ['bell', 'Напоминания о записях'],
  prices: ['tag', 'Прайс'],
  hours: ['clock', 'Рабочее время'],
  link: ['link', 'Ссылка для клиентов'],
  rent: ['home', 'Аренда'],
  look: ['palette', 'Оформление и язык'],
  archive: ['archive', 'Архив на телефон'],
};
const SERVICE_FORMS = ['услуга', 'услуги', 'услуг', 'қызмет'];
const HOUR_FORMS = ['час', 'часа', 'часов', 'сағат'];
// Напоминания о записях (2.8.0): «За 1 день», «За 2 часа», «За неделю», «Не напоминать».
const remindLabel = (n, forms) => (!n ? t('Не напоминать') : n === 7 && forms === DAY_FORMS ? t('За неделю') : t('За {count}', { count: `${n} ${L.plural(n, forms)}` }));
const LANG_NAMES = { ru: 'Русский', kk: 'Қазақша' }; // названия языков — всегда на своём языке

// Коротко о том, что внутри пункта, — видно, не открывая его.
function settingsSummary(page) {
  const s = settings();
  if (page === 'account') {
    const sub = subscription();
    return cloud.account ? `${cloud.account.phone}${sub && sub.until && !sub.unlimited ? ` · ${t('подписка {until}', { until: L.dateUntil(sub.until) })}` : ''} · ${t('пароль и выход')}` : t('Вход по номеру и паролю');
  }
  if (page === 'cloud') return !cloud.key ? t('Не подключено') : cloud.pushOn ? t('Подключено, уведомления включены') : t('Подключено');
  if (page === 'remind') {
    const on = [s.remindDays && remindLabel(s.remindDays, DAY_FORMS), s.remindHours && remindLabel(s.remindHours, HOUR_FORMS)].filter(Boolean);
    return on.length ? `${on.join(' · ')}${cloud.pushOn ? '' : ` · ${t('уведомления выключены')}`}` : t('Выключены');
  }
  if (page === 'prices') return data.prices.length ? `${data.prices.length} ${L.plural(data.prices.length, SERVICE_FORMS)}` : t('Услуг пока нет');
  if (page === 'hours') return `${L.shortTime(s.dayStart)}–${L.shortTime(s.lastStart)}`;
  if (page === 'link') return s.whatsapp ? `${s.clientName} · ${L.formatPhone(s.whatsapp)}` : s.clientName || t('Свободное время и заявки');
  if (page === 'rent') {
    const month = L.monthOf(today());
    return `${t('{sum} в месяц', { sum: L.formatMoney(L.rentFor(data.rent, month)) })} · ${L.monthName(Number(month.slice(5)) - 1).toLowerCase()} ${rentPaid(month) ? t('оплачен') : t('не оплачен')}`;
  }
  if (page === 'look') return `${t(L.THEMES[s.theme])}, ${colorMode() === 'dark' ? t('тёмный режим') : t('светлый режим')} · ${LANG_NAMES[getLang()]}`;
  return data.lastBackup ? t('Последний — {date}', { date: formatDate(data.lastBackup) }) : t('Ещё не сохраняли');
}

function renderSettings() {
  setHeader();
  const page = SETTINGS_PAGES[ui.settingsPage] ? ui.settingsPage : null;
  const anim = ui.settingsAnim;
  ui.settingsAnim = null;
  const enter = anim ? ` enter-${anim}` : '';
  if (!page) {
    view.innerHTML = `
      <div class="slide-clip"><div class="settings-home${enter}">
      <section class="card settings-menu">${Object.entries(SETTINGS_PAGES).map(([id, [ic, title]]) => `
        <button class="menu-row" data-act="settings-page" data-page="${id}">
          <span class="menu-ico">${icon(ic)}</span>
          <span class="grow"><b>${t(title)}</b><small>${esc(settingsSummary(id))}</small></span>
          ${icon('right')}
        </button>`).join('')}
      </section>
      <section class="card settings-menu" data-install-ui${Install.canInstall() ? '' : ' hidden'}>
        <button class="menu-row" data-act="install">
          <span class="menu-ico">${icon('download')}</span>
          <span class="grow"><b>${t('Установить на экран «Домой»')}</b><small>${t('Открывать с иконки, как обычное приложение')}</small></span>
          ${icon('right')}
        </button>
      </section>
      ${cloud.key ? `<section class="card settings-menu">
        <button class="menu-row" data-act="open-chat">
          <span class="menu-ico">${icon('chat')}</span>
          <span class="grow"><b>${t('Чат с администратором')}</b><small>${t('Вопросы по оплате, подписке и работе приложения')}</small></span>
          ${chatBadge('menu-badge')}${icon('right')}
        </button>
      </section>` : ''}
      <p class="version">${t('{app} · версия {version}', { app: APP_NAME, version: APP_VERSION })}<br>${t('Обновления — ночью, с 00:00 до 01:00')}</p>
      </div></div>`;
    return;
  }
  view.innerHTML = `
    <div class="slide-clip"><div class="settings-page${enter}">
    <button class="back-link" data-act="settings-page" data-page="">${icon('left')} ${t('Настройки')}</button>
    <h2 class="page-title">${t(SETTINGS_PAGES[page][1])}</h2>
    ${settingsPageHtml(page)}
    </div></div>`;
  const profile = $('#auth-form');
  if (profile) {
    profile.addEventListener('submit', e => {
      e.preventDefault();
      submitAuth(profile);
    });
  }
}

// Открыть пункт настроек (page) или вернуться к списку (null).
// Пункт въезжает справа, список при возврате — слева.
function openSettingsPage(page) {
  ui.settingsPage = page;
  ui.settingsAnim = page ? 'next' : 'prev';
  render();
  scrollTo(0, 0);
}

// Внутри пункта свайп вправо — назад к списку, как «‹ Настройки».
// Страница едет за пальцем; сдвинули мало — возвращается. В сетке аренды свой свайп (годы).
swipe(view, '.settings-page', {
  axes: ['x'],
  skip: '.rent-cal',
  move(g) {
    const dx = Math.max(0, g.dx);
    g.target.style.transform = `translateX(${dx}px)`;
    g.target.style.opacity = 1 - Math.min(dx / g.target.clientWidth, 1) * 0.5;
  },
  end(g) {
    const el = g.target;
    const w = el.clientWidth;
    const flick = g.vx > 0.4 && g.dx > 0;
    el.classList.add('settle');
    if (g.cancelled || !(g.dx > w * 0.3 || flick)) {
      el.style.transform = '';
      el.style.opacity = '';
      setTimeout(() => el.classList.remove('settle'), 200);
      return;
    }
    el.style.transform = `translateX(${w}px)`;
    el.style.opacity = 0;
    setTimeout(() => openSettingsPage(null), 150);
  },
});

const card = (html, cls = '') => `<section class="card page-card${cls}">${html}</section>`;
// Длительность услуги в прайсе, минут; 0 — «по умолчанию» (из «Рабочего времени»).
const DURATIONS = [20, 30, 40, 45, 60, 75, 90, 105, 120, 150, 180, 210, 240, 270, 300];

function settingsPageHtml(page) {
  const s = settings();
  switch (page) {
    case 'account': {
      const a = cloud.account || {};
      return card(`
      <div class="line"><span>${t('Имя для клиентов')}</span><b>${esc(s.clientName || a.name || '')}</b></div>
      <div class="line"><span>${t('Телефон для входа')}</span><b>${esc(a.phone || '')}</b></div>
      <div class="line"><span>${t('Подписка')}</span><b>${esc(subscriptionText(subscription()))}</b></div>
      <details class="terms"><summary>${t('Условия подписки')}</summary>${termsHtml()}</details>
      <p class="hint">${t('В приложение входят по этому номеру и паролю. Имя видят клиенты по вашей ссылке — поменять его можно в «Ссылке для клиентов». Забыли пароль — его восстановит администратор.')}</p>
      <button class="btn secondary block" data-act="change-password">${icon('lock')} ${t('Сменить пароль')}</button>
      <button class="btn danger block" data-act="logout">${t('Выйти из аккаунта')}</button>`) + card(`
      <h3 class="card-title">${t('Где вы принимаете')}</h3>
      <label>${t('Адрес')}<input value="${esc(s.address)}" maxlength="150" autocomplete="street-address" enterkeyhint="done" placeholder="${t('Город, улица, дом, этаж или кабинет')}" data-change="set-address"></label>
      <label>${t('Ссылка на 2ГИС')}<input type="url" inputmode="url" value="${esc(s.gis)}" enterkeyhint="done" placeholder="https://go.2gis.com/…" data-change="set-gis"></label>
      <p class="hint">${t('В 2ГИС найдите свой салон или дом → «Поделиться» → «Копировать ссылку» и вставьте сюда. Адрес и кнопку «Открыть в 2ГИС» увидят клиенты по вашей ссылке и в своей записи.')}</p>
      ${s.gis ? `<a class="btn small secondary" href="${esc(s.gis)}" target="_blank" rel="noopener">${t('Проверить ссылку в 2ГИС')}</a>` : ''}`) + card(`
      <h3 class="card-title">${t('Анкета')}</h3>
      <form id="auth-form" data-kind="profile" novalidate>
        ${specialtyField(a.specialty || s.specialty)}
        ${kaspiField(a.kaspi || s.kaspi)}
        ${instagramField(s.instagram)}
        <p class="warn-text" id="auth-error" hidden></p>
        <button type="submit" class="btn secondary block">${t('Сохранить анкету')}</button>
      </form>`);
    }
    case 'cloud':
      return card(cloud.key ? cloudPairedHtml() : `<p class="hint">${t('Войдите в аккаунт — записи и фото начнут сохраняться в облако сами.')}</p>`);
    case 'remind': {
      const select = (name, list, forms, value) => `<select data-change="set-${name}">${list.map(n => `
        <option value="${n}"${n === value ? ' selected' : ''}>${remindLabel(n, forms)}</option>`).join('')}
      </select>`;
      return card(`
      <p class="hint">${t('Перед каждой записью на этот телефон придёт уведомление — даже если приложение закрыто. Об отменённых записях не напоминаем.')}</p>
      <label>${t('За сколько дней до записи')}${select('remindDays', L.REMIND_DAYS, DAY_FORMS, s.remindDays)}</label>
      <label>${t('За сколько часов до записи')}${select('remindHours', L.REMIND_HOURS, HOUR_FORMS, s.remindHours)}</label>
      ${pushStatusHtml()}`);
    }
    case 'prices':
      return card(`
      <p class="hint">${t('Цена подставляется в запись при выборе услуги, в записи её можно поменять. Клиенты видят эти цены по ссылке. По длительности услуги приложение понимает, когда после записи снова будет свободно.')}</p>
      ${data.prices.length ? '' : `<p class="empty">${t('Услуг пока нет. Добавьте свои: название, цену и сколько длится услуга.')}</p>`}
      <div class="prices">${data.prices.map(p => `
        <div class="price-item">
          <div class="price-row">
            <input value="${esc(p.name)}" placeholder="${t('Название услуги')}" enterkeyhint="done" data-change="price-name" data-id="${esc(p.id)}" aria-label="${t('Услуга')}">
            <button class="icon-btn" data-act="price-del" data-id="${esc(p.id)}" aria-label="${t('Удалить услугу')}">${icon('close')}</button>
          </div>
          <div class="price-row">
            <div class="money-wrap">
              <input class="money" inputmode="numeric" enterkeyhint="done" value="${L.formatAmount(p.price)}" placeholder="0" data-change="price" data-id="${esc(p.id)}" aria-label="${t('Цена, ₸')}"><span>₸</span>
            </div>
            <select data-change="price-duration" data-id="${esc(p.id)}" aria-label="${t('Сколько длится')}">
              <option value="0">${t('Время: по умолчанию ({duration})', { duration: L.formatDuration(s.duration) })}</option>${[...new Set([...DURATIONS, p.duration || 0])].filter(Boolean).sort((a, b) => a - b).map(m => `
              <option value="${m}"${m === p.duration ? ' selected' : ''}>${L.formatDuration(m)}</option>`).join('')}
            </select>
          </div>
        </div>`).join('')}
      </div>
      <button class="btn small secondary" data-act="price-add">${icon('plus')} ${t('Добавить услугу')}</button>`);
    case 'hours':
      return card(`
      <div class="row2">
        <label>${t('Первая запись с')}<input type="time" value="${esc(s.dayStart)}" data-change="set-dayStart"></label>
        <label>${t('Последняя запись в')}<input type="time" value="${esc(s.lastStart)}" data-change="set-lastStart"></label>
      </div>
      <label>${t('Если у услуги не указано время')}<select data-change="set-duration">${[60, 90, 120, 150, 180, 210, 240].map(m => `
        <option value="${m}"${m === s.duration ? ' selected' : ''}>${L.formatDuration(m)}</option>`).join('')}
      </select></label>
      <p class="hint" id="duration-hint">${durationHint(s.duration)}</p>`);
    case 'link':
      return card(`
      <p class="hint">${t('По ссылке клиенты видят свободное время на 30 дней вперёд, выбирают время и услуги и оставляют заявку. Имена и телефоны других клиентов там не видны.')}</p>
      <div class="link-box">${esc(clientLink())}</div>
      <div class="btn-row">
        <button class="btn small secondary" data-act="share-link">${icon('share')} ${t('Поделиться')}</button>
        <button class="btn small secondary" data-act="copy-link">${icon('link')} ${t('Скопировать')}</button>
      </div>
      <label>${t('Имя для клиентов')}<input value="${esc(s.clientName)}" enterkeyhint="done" data-change="set-clientName"></label>
      <label>${t('WhatsApp мастера')}<input type="tel" value="${esc(L.phoneFieldStart(s.whatsapp))}" enterkeyhint="done" data-change="set-whatsapp"></label>
      <p class="hint">${t('Клиенты увидят кнопку «Написать мастеру в WhatsApp» с этим номером.')}</p>
      ${cloud.key ? '' : `<p class="status warn">${t('Заявки начнут приходить после подключения облака.')}</p>`}`);
    case 'rent':
      return card(`
      <div class="price-row">
        <span class="grow">${t('Каждый месяц')}</span>
        <div class="money-wrap">
          <input class="money" inputmode="numeric" enterkeyhint="done" value="${L.formatAmount(L.rentFor(data.rent, L.monthOf(today())))}" placeholder="0" data-change="rent" aria-label="${t('Аренда в месяц, ₸')}"><span>₸</span>
        </div>
      </div>
      <p class="hint">${t('Новая сумма действует с текущего месяца, прошлые месяцы не меняются.')}</p>`) + rentYearHtml();
    case 'look':
      return card(`
      <div class="themes" role="group" aria-label="${t('Тема')}">${Object.entries(L.THEMES).map(([id, name]) => `
        <button type="button" class="theme-pick${s.theme === id ? ' on' : ''}" data-act="set-theme" data-value="${id}" aria-pressed="${s.theme === id}">
          <span class="swatch" data-theme="${id}"></span>${t(name)}
        </button>`).join('')}
      </div>
      <p class="hint">${t('Тёмный режим для вечера — кнопка с луной вверху справа.')}</p>`) + card(`
      <h3 class="card-title">${t('Язык')}</h3>
      <div class="seg two" role="group" aria-label="${t('Язык')}">${Object.entries(LANG_NAMES).map(([id, name]) => `
        <button type="button" data-act="set-lang" data-value="${id}"${getLang() === id ? ' class="on"' : ''} aria-pressed="${getLang() === id}">${name}</button>`).join('')}
      </div>
      <p class="hint">${t('Язык меняется только на этом телефоне. Клиенты на странице записи выбирают язык сами.')}</p>`);
    default:
      return card(`
      <p class="hint">${cloud.key ? t('Облако сохраняет всё само. Архив — дополнительная копия файлом, на всякий случай.') : t('Пока облако не подключено, раз в неделю сохраняйте архив — например, отправьте файл себе в Telegram.')}</p>
      <p>${t('Последний архив:')} <b>${data.lastBackup ? formatDate(data.lastBackup) : t('ещё не сохраняли')}</b></p>
      <button class="btn secondary block" data-act="backup">${t('Сохранить архив')}</button>
      <label class="btn secondary block">${t('Восстановить из архива')}<input type="file" class="file-input" accept=".zip,.json,application/zip,application/json" data-change="restore"></label>`);
  }
}

// ---------- Оплата аренды ----------
// График по месяцам года: отмечено ли, что аренда оплачена, и когда.
// data.rentPaid — { 'YYYY-MM': 'YYYY-MM-DD' }. Год листается стрелками и свайпом.

const rentPaid = month => (data.rentPaid || {})[month] || '';
const dayMonth = date => `${Number(date.slice(8))}.${date.slice(5, 7)}`;

function rentYearHtml() {
  const year = ui.rentYear;
  const anim = ui.rentAnim;
  ui.rentAnim = null;
  const current = L.monthOf(today());
  const cells = L.MONTHS.map((_, i) => {
    const name = L.monthName(i);
    const month = `${year}-${String(i + 1).padStart(2, '0')}`;
    const paid = rentPaid(month);
    const state = paid ? 'paid' : month === current ? 'due' : month < current ? 'past' : 'future';
    const note = paid ? t('оплачено {date}', { date: dayMonth(paid) }) : state === 'due' ? t('не оплачено') : state === 'past' ? t('не отмечено') : '';
    return `
      <button class="rent-month ${state}" data-act="rent-month" data-month="${month}" aria-label="${name} ${year}: ${note || t('ещё не наступил')}">
        <b>${name}</b><small>${L.formatAmount(L.rentFor(data.rent, month))} ₸</small><i>${paid ? icon('check') : ''}${note}</i>
      </button>`;
  }).join('');
  const paidCount = L.MONTHS.filter((_, i) => rentPaid(`${year}-${String(i + 1).padStart(2, '0')}`)).length;
  return card(`
    <div class="rent-head">
      <h3>${t('Оплата аренды')}</h3>
      <div class="year-nav">
        <button class="icon-btn" data-act="rent-year" data-delta="-1" aria-label="${t('Предыдущий год')}">${icon('left')}</button>
        <b>${year}</b>
        <button class="icon-btn" data-act="rent-year" data-delta="1" aria-label="${t('Следующий год')}">${icon('right')}</button>
      </div>
    </div>
    <div class="rent-cal"><div class="rent-grid${anim ? ` enter-${anim}` : ''}">${cells}</div></div>
    <p class="hint">${t('Оплачено месяцев: {count} из 12. Нажмите на месяц, чтобы отметить оплату или снять отметку.', { count: paidCount })}</p>`, ' rent-card');
}

function changeRentYear(delta) {
  ui.rentYear += delta;
  ui.rentAnim = delta > 0 ? 'next' : 'prev';
  render();
}

monthSwipe('.rent-cal', '.rent-grid', changeRentYear);

function openRentMonth(month) {
  pushSheet(() => {
    const paid = rentPaid(month);
    sheetHtml(t('Аренда · {month}', { month: L.monthTitle(month) }), `
      <form id="rent-form" class="sheet-body" novalidate>
        <p class="lead"><b>${L.formatMoney(L.rentFor(data.rent, month))}</b></p>
        <p class="hint">${paid ? t('Оплата отмечена: {date}.', { date: `${L.shortDate(paid)} ${paid.slice(0, 4)}` }) : t('Оплата за этот месяц ещё не отмечена.')}</p>
        <label>${t('Дата оплаты')}<input type="date" name="date" value="${esc(paid || today())}"></label>
        <button type="submit" class="btn primary block">${paid ? t('Сохранить дату') : t('Оплатил (-а)')}</button>
        ${paid ? `<button type="button" class="btn danger block" data-act="rent-unpaid" data-month="${month}">${t('Снять отметку')}</button>` : ''}
      </form>`);
    const form = $('#rent-form');
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const date = field(form, 'date').value;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return toast(t('Укажите дату оплаты'));
      data.rentPaid = { ...(data.rentPaid || {}), [month]: date };
      if (!(await save())) return;
      closeSheet();
      render();
      toast(t('Аренда за {month} отмечена', { month: L.monthName(Number(month.slice(5)) - 1).toLowerCase() }));
    });
  });
}

// Уведомления на этом телефоне (о заявках и напоминания о записях): 'on' | 'off' | 'unsupported'.
const pushState = () => (!('Notification' in window) ? 'unsupported' : Notification.permission === 'granted' && cloud.pushOn ? 'on' : 'off');

// «Напоминания о записях»: включены ли уведомления, а если нет — кнопка «Включить уведомления».
function pushStatusHtml() {
  const state = pushState();
  if (state === 'on') return `<p class="status ok">${icon('bell')} ${t('Уведомления включены — напоминания придут на этот телефон.')}</p>`;
  if (state === 'unsupported') return `<p class="status warn">${isIOS && !isStandalone() ? t('Уведомления работают, только если приложение установлено на экран «Домой».') : t('Этот браузер не поддерживает уведомления.')}</p>`;
  return `<p class="status warn">${t('Чтобы напоминания приходили, включите уведомления.')}</p>
      <button class="btn primary block" data-act="enable-push">${icon('bell')} ${t('Включить уведомления')}</button>`;
}

function cloudPairedHtml() {
  const state = pushState();
  return `
    <div id="cloud-status">${cloudStatusHtml()}</div>
    <div class="cloud-line">
      ${icon('bell')}
      <span class="grow">${t('Уведомления:')} <b>${state === 'on' ? t('включены') : t('выключены')}</b></span>
    </div>
    ${state === 'on' ? '' : `<button class="btn primary block" data-act="enable-push">${icon('bell')} ${t('Включить уведомления')}</button>`}
    ${state === 'unsupported' ? `<p class="hint">${isIOS && !isStandalone() ? t('Уведомления работают, только если приложение установлено на экран «Домой».') : t('Этот браузер не поддерживает уведомления.')}</p>` : ''}
    <div class="btn-row">
      <button class="btn small secondary" data-act="sync-now">${t('Сохранить сейчас')}</button>
      <button class="btn small secondary" data-act="cloud-restore">${t('Восстановить из облака')}</button>
    </div>`;
}

function cloudStatusHtml() {
  if (syncing) return `<p class="status">${t('Сохраняем в облако…')}</p>`;
  if (cloud.error) return `<p class="status bad">${t('Не удалось сохранить: {error}. Попробуем снова.', { error: esc(cloud.error) })}</p>`;
  return `<p class="status ok">${icon('cloud')} ${t('Всё сохранено в облаке')}${cloud.savedAt ? ` · ${formatDateTime(cloud.savedAt)}` : ''}</p>`;
}

function showCloudStatus() {
  const box = $('#cloud-status');
  if (box) box.innerHTML = cloudStatusHtml();
}

function durationHint(duration) {
  return t('Сколько длится каждая услуга, указано в «Прайсе». Следующую запись можно поставить, когда закончатся услуги предыдущей: например, после услуги на 30 минут — через полчаса. Если у услуги время не указано, считается, что она длится {duration}.', { duration: L.formatDuration(duration) });
}

// Ссылка для клиентов — своя у каждого мастера: okna/?m=<slug>, на основном адресе сайта.
const oknaBase = () => new URL('okna/', IS_LOCAL ? location.href.split('#')[0].split('?')[0] : PUBLIC_URL).href;

function clientLink() {
  const slug = cloud.account && cloud.account.slug;
  return slug ? `${oknaBase()}?m=${encodeURIComponent(slug)}` : oknaBase();
}

// ---------- Облако ----------

async function api(method, path, body, type) {
  const headers = {};
  if (cloud.key) headers.Authorization = `Bearer ${cloud.key}`;
  let payload = body;
  if (body !== undefined) {
    if (!(body instanceof Uint8Array) && typeof body !== 'string') {
      payload = JSON.stringify(body);
      type = 'application/json';
    }
    headers['Content-Type'] = type || 'application/json';
  }
  let res;
  try {
    res = await fetch(API + path, { method, headers, body: payload, cache: 'no-store' });
  } catch (e) {
    const error = new Error(t('нет связи с облаком'));
    error.offline = true;
    throw error;
  }
  if (res.ok) return res;
  // Сервер отвечает по-русски, перевод — по словарю (kk.js).
  let message = t('ошибка {status}', { status: res.status });
  try { message = t((await res.json()).error || message); } catch (e) { /* не JSON */ }
  if (res.status === 402 && cloud.key) setTimeout(refreshAccount, 0);
  if (res.status === 401 && cloud.key) {
    // Вошли в аккаунт на другом телефоне или администратор сбросил пароль — снова вход.
    // Данные на телефоне остаются: если войдёт тот же мастер, их можно будет сохранить.
    cloud = { ...freshCloud(), lastPhone: (cloud.account && cloud.account.phone) || cloud.lastPhone };
    await dbSet('cloud', cloud).catch(() => {});
    ui.auth = 'login';
    ui.authNote = message;
    render();
  }
  const error = new Error(message);
  error.status = res.status;
  throw error;
}

async function sha256(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return L.bytesToB64u(new Uint8Array(digest));
}

async function gzip(text) {
  if (typeof CompressionStream === 'undefined') return null;
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gunzip(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}

// Отпечаток данных без даты выгрузки: без изменений копию заново не отправляем.
const dataPrint = d => sha256(JSON.stringify([d.appointments, d.expenses, d.prices, d.rent, d.settings, d.blocks, d.clients, d.rentPaid]));

let syncTimer = null, syncing = false, syncAgain = false;

function scheduleSync(delay = 2500) {
  if (!cloud.key || storageBroken) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(syncNow, delay);
}

// Сохраняет в облако копию данных, новые фото и свободное время для клиентов,
// забирает новые заявки. Каждый шаг — отдельно: ошибка в одном не мешает другим.
async function syncNow() {
  if (!cloud.key || !data) return;
  if (syncing) {
    syncAgain = true;
    return;
  }
  syncing = true;
  showCloudStatus();
  const errors = [];
  const step = async fn => {
    try {
      await fn();
    } catch (e) {
      errors.push(e.message);
    }
  };

  await step(async () => {
    const print = await dataPrint(data);
    if (print === cloud.backupPrint) return;
    const text = JSON.stringify(L.makeBackup(data));
    const packed = await gzip(text);
    await api('PUT', '/api/backup', packed || text, packed ? 'application/gzip' : 'application/json');
    cloud.backupPrint = print;
    cloud.savedAt = new Date().toISOString();
  });
  await step(syncSchedule);
  await step(syncReminders);
  await step(async () => {
    const ids = new Set(data.appointments.flatMap(a => a.photos || []));
    for (const id of ids) {
      if (cloud.uploaded.includes(id)) continue;
      const rec = await dbGet('photo:' + id).catch(() => null);
      if (!rec) continue;
      await api('PUT', `/api/photos/${id}`, new Uint8Array(rec.data), 'image/jpeg');
      cloud.uploaded.push(id);
    }
    for (const id of [...cloud.uploaded]) {
      if (ids.has(id)) continue;
      await api('DELETE', `/api/photos/${id}`);
      cloud.uploaded = cloud.uploaded.filter(x => x !== id);
    }
  });
  await step(async () => {
    for (const id of [...(cloud.closing || [])]) {
      await api('POST', `/api/requests/${id}/confirm`);
      cloud.closing = cloud.closing.filter(x => x !== id);
    }
  });
  await step(syncBookings);
  await step(syncStats);
  await step(loadRequests);

  syncing = false;
  if (cloud.key) {
    cloud.error = errors[0] || '';
    await dbSet('cloud', cloud).catch(() => {});
  }
  showCloudStatus();
  if (syncAgain) {
    syncAgain = false;
    syncNow();
  }
}

// Свободное время для клиентов (с ценами прайса) — только если оно изменилось.
async function syncSchedule() {
  const schedule = L.buildSchedule(data);
  const print = JSON.stringify({ ...schedule, updated: '' });
  if (print === cloud.schedulePrint) return;
  await api('PUT', '/api/schedule', schedule);
  cloud.schedulePrint = print;
}

// Напоминания о записях (2.8.0): ближайшие напоминания — на сервер, он пришлёт их уведомлениями в нужное
// время, даже когда приложение закрыто. Только если уведомления включены и список изменился.
async function syncReminders() {
  if (!cloud.pushOn) return;
  const payload = { items: L.reminderItems(data.appointments, settings(), Date.now()), tz: new Date().getTimezoneOffset() };
  const print = JSON.stringify(payload);
  if (print === cloud.remindPrint) return;
  await api('PUT', '/api/reminders', payload);
  cloud.remindPrint = print;
}

// Личные ссылки клиентов: перенос, оплата, отмена сразу видны клиенту.
// Если запись удалили, клиент увидит «Запись отменена».
async function syncBookings() {
  const sent = { ...(cloud.bookings || {}) };
  const current = {};
  for (const a of data.appointments) if (a.token) current[a.token] = JSON.stringify(L.publicBooking(a));
  for (const [token, json] of Object.entries(current)) {
    if (sent[token] === json) continue;
    await api('PUT', `/api/bookings/${token}`, JSON.parse(json));
    sent[token] = json;
    cloud.bookings = { ...sent };
  }
  for (const [token, json] of Object.entries(sent)) {
    if (current[token]) continue;
    await api('PUT', `/api/bookings/${token}`, { ...JSON.parse(json), status: 'cancelled' });
    delete sent[token];
    cloud.bookings = { ...sent };
  }
}

async function fetchCloudBackup() {
  let res;
  try {
    res = await api('GET', '/api/backup');
  } catch (e) {
    if (e.status === 404) return null;
    throw e;
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  const gz = (res.headers.get('Content-Type') || '').includes('gzip');
  return { copy: L.readBackup(gz ? await gunzip(bytes) : new TextDecoder().decode(bytes)), created: res.headers.get('X-Backup-Created') };
}

// Заменяет данные телефона копией из облака (вместе с фото).
async function applyCloudBackup(copy) {
  toast(t('Загружаем данные из облака…'));
  const ids = [...new Set(copy.appointments.flatMap(a => a.photos))];
  let missing = 0;
  for (const id of ids) {
    if (await dbGet('photo:' + id).catch(() => null)) continue;
    try {
      const res = await api('GET', `/api/photos/${id}`);
      await dbSet('photo:' + id, { type: 'image/jpeg', data: await res.arrayBuffer(), created: null });
    } catch (e) {
      missing++;
    }
  }
  data = {
    appointments: copy.appointments,
    expenses: copy.expenses,
    prices: copy.prices,
    rent: copy.rent,
    settings: copy.settings,
    blocks: copy.blocks,
    clients: copy.clients,
    rentPaid: copy.rentPaid,
    lastBackup: data.lastBackup,
  };
  await dbSet('data', data);
  cloud.backupPrint = await dataPrint(data);
  cloud.uploaded = ids;
  cloud.schedulePrint = '';
  cloud.bookings = Object.fromEntries(data.appointments.filter(a => a.token).map(a => [a.token, JSON.stringify(L.publicBooking(a))]));
  await dbSet('cloud', cloud).catch(() => {});
  await cleanupPhotos();
  render();
  toast(missing ? t('Данные восстановлены, но не загрузилось фото: {count}', { count: missing }) : t('Данные восстановлены из облака'));
  scheduleSync(500);
}

// ---------- Аккаунт: регистрация, вход, оформление, пароль, выход ----------
// Без аккаунта приложением не пользуются. Прежний мастер (телефон подключён по коду,
// как до 2.0.0) оформляет аккаунт: номер, имя и пароль — данные и ссылка остаются.

function authGate() {
  if (!cloud.key) return ui.auth || (cloud.lastPhone ? 'login' : 'welcome'); // сервер вывел из аккаунта — сразу вход
  if (cloud.account && !cloud.account.claimed) return 'claim';
  // Анкета (с 2.4.0) — по аккаунту, который уже прислал сервер 2.4.0: в сохранённом раньше поля specialty нет,
  // и без связи старые данные не закроют приложение.
  if (cloud.account && 'specialty' in cloud.account && (!cloud.account.specialty || !cloud.account.kaspi)) return 'profile';
  if (!subscriptionOk()) return 'expired';
  return null;
}

const chatUnread = () => (cloud.account && cloud.account.chatUnread) || 0;
const chatBadge = cls => `<i class="${cls} chat-badge"${chatUnread() ? '' : ' hidden'}>${chatUnread()}</i>`;

// Прочитали сообщения — убрать число со всех значков чата.
function updateChatBadge() {
  const n = chatUnread();
  document.querySelectorAll('.chat-badge').forEach(b => {
    b.textContent = n;
    b.hidden = !n;
  });
}

// Условия подписки — при регистрации, в анкете, в «Аккаунте» и в окне «Продлите подписку».
function termsHtml() {
  const tariff = L.TARIFF;
  return `
    <ul class="terms-list">
      <li>${t('Первые {days} дней после регистрации — бесплатно, со всеми возможностями.', { days: L.TRIAL_DAYS })}</li>
      <li>${t('Дальше — тариф «Про»: <b>{month} в месяц</b> или <b>{year} в год</b> (два месяца в подарок).', { month: L.formatMoney(tariff.month.price), year: L.formatMoney(tariff.year.price) })}</li>
      <li>${t('Оплата — через Kaspi.kz: администратор выставляет счёт на номер Kaspi из вашей анкеты, вы оплачиваете его в приложении Kaspi.')}</li>
      <li>${t('После оплаты доступ продлевается на оплаченный срок: от конца текущего периода, а если он уже закончился — со дня оплаты.')}</li>
      <li>${t('За 3 дня до окончания приложение напомнит о продлении.')}</li>
      <li>${t('На следующий день после окончания приложение и онлайн-запись для ваших клиентов приостанавливаются. Все данные сохраняются и снова доступны после оплаты; личные ссылки клиентов на уже сделанные записи работают.')}</li>
      <li>${t('Вопросы по оплате — в чате с администратором («Настройки» → «Чат с администратором»).')}</li>
    </ul>`;
}

// Направление мастера: подсказки кнопками, можно вписать своё.
function specialtyField(value) {
  return `
    <label>${t('Ваше направление')}<input name="specialty" value="${esc(value || '')}" maxlength="40" autocapitalize="sentences" enterkeyhint="next" placeholder="${t('Например, парикмахер')}"></label>
    <div class="chips small-chips">${L.SPECIALTIES.map(x => (getLang() === 'kk' ? L.SPECIALTIES_KK[x] : x)).map(x => `<button type="button" class="chip small" data-act="pick-specialty" data-value="${esc(x)}">${esc(x)}</button>`).join('')}</div>`;
}

const kaspiField = value => `<label>${t('Номер Kaspi для оплаты подписки')}<input type="tel" name="kaspi" autocomplete="tel" value="${esc(L.phoneFieldStart(value))}" enterkeyhint="next"></label>
    <p class="hint">${t('На этот номер администратор выставит счёт в Kaspi.kz за подписку.')}</p>`;

const instagramField = value => `<label>${t('Instagram (необязательно)')}<input name="instagram" value="${esc(value ? '@' + value : '')}" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="next" placeholder="${t('@ваш_ник')}"></label>
    <p class="hint">${t('Клиенты увидят кнопку Instagram на вашей странице записи.')}</p>`;

const termsAgree = () => `
    <details class="terms"><summary>${t('Условия подписки')}</summary>${termsHtml()}</details>
    <label class="check"><input type="checkbox" name="terms"> ${t('Принимаю условия подписки')}</label>`;

// Подписка (2.2.0): даты приходят с сервера, а проверяем по дате телефона — окно
// «Продлите подписку» появится на следующий день после окончания и без связи.
const subscription = () => (cloud.account && cloud.account.subscription) || null;
const subscriptionOk = () => {
  const sub = subscription();
  return !sub || L.subscriptionActive(sub, today());
};
// Даты с годом на языке приложения: «7 октября 2026» / «2026 ж. 7 қазан» (logic.js).
const { fullDateOn, fullDateUntil, dateRange } = L;

function subscriptionText(sub) {
  if (!sub) return t('нет данных — проверим, когда появится интернет');
  if (sub.unlimited) return t('бессрочная');
  if (!sub.until) return t('не оформлена');
  const left = L.subscriptionDaysLeft(sub, today());
  const span = sub.from && sub.from <= sub.until ? dateRange(sub.from, sub.until) : fullDateUntil(sub.until);
  if (left < 0) return t('закончилась {date}', { date: fullDateOn(sub.until) });
  return left <= 7 ? `${span} · ${t('осталось {count}', { count: `${left} ${L.plural(left, DAY_FORMS)}` })}` : span;
}

const newDeviceKey = () => L.bytesToB64u(crypto.getRandomValues(new Uint8Array(32)));
const deviceName = () => (/iphone/i.test(navigator.userAgent) ? 'iPhone' : /ipad/i.test(navigator.userAgent) ? 'iPad' : /android/i.test(navigator.userAgent) ? 'Android' : 'Браузер');
const hasLocalData = () => Boolean(data.appointments.length || (data.clients || []).length || data.expenses.length);

function renderAuth(screen) {
  setHeader();
  fab.hidden = true;
  $('#tabbar').innerHTML = '';
  const note = ui.authNote ? `<p class="status warn">${esc(ui.authNote)}</p>` : '';
  const passwordFields = `
    <label>${t('Пароль')}<input type="password" name="password" autocomplete="new-password" enterkeyhint="next" placeholder="${t('Не короче 6 символов')}"></label>
    <label>${t('Пароль ещё раз')}<input type="password" name="password2" autocomplete="new-password" enterkeyhint="done"></label>`;
  const phoneField = (phone = '') => `<label>${t('Номер телефона')}<input type="tel" name="phone" autocomplete="username" value="${esc(L.phoneFieldStart(phone))}" enterkeyhint="next"></label>`;
  const st = settings();
  const placeFields = `
    <label>${t('Адрес, где вы принимаете')}<input name="address" value="${esc(st.address || '')}" maxlength="150" autocomplete="street-address" enterkeyhint="next" placeholder="${t('Город, улица, дом, этаж или кабинет')}"></label>
    <label>${t('Ссылка на ваше место в 2ГИС')}<input name="gis" type="url" inputmode="url" value="${esc(st.gis || '')}" enterkeyhint="next" placeholder="https://go.2gis.com/…"></label>
    <p class="hint">${t('В 2ГИС найдите свой салон или дом → «Поделиться» → «Копировать ссылку» и вставьте сюда. Адрес и кнопку «Открыть в 2ГИС» увидят клиенты.')}</p>`;
  let html;
  if (screen === 'register') {
    html = `
      <h2 class="page-title">${t('Новый аккаунт')}</h2>
      <form class="card page-card" id="auth-form" data-kind="register" novalidate>
        <label>${t('Ваше имя')}<input name="name" autocomplete="name" autocapitalize="words" enterkeyhint="next" placeholder="${t('Так вас увидят клиенты')}"></label>
        ${phoneField(ui.authPhone)}
        ${specialtyField(st.specialty)}
        <p class="hint">${t('Прайс заполнится услугами вашего направления — останется вписать цены.')}</p>
        ${kaspiField(st.kaspi || ui.authPhone)}
        ${instagramField(st.instagram)}
        ${placeFields}
        ${passwordFields}
        ${termsAgree()}
        <p class="warn-text" id="auth-error" hidden></p>
        <button type="submit" class="btn primary block">${t('Создать аккаунт')}</button>
      </form>
      <button class="btn ghost block" data-act="auth" data-screen="login">${t('Уже есть аккаунт? Войти')}</button>`;
  } else if (screen === 'login') {
    html = `
      <h2 class="page-title">${t('Вход')}</h2>
      ${note}
      <form class="card page-card" id="auth-form" data-kind="login" novalidate>
        ${phoneField(ui.authPhone || cloud.lastPhone)}
        <label>${t('Пароль')}<input type="password" name="password" autocomplete="current-password" enterkeyhint="done"></label>
        <p class="warn-text" id="auth-error" hidden></p>
        <button type="submit" class="btn primary block">${t('Войти')}</button>
      </form>
      <button class="btn ghost block" data-act="auth" data-screen="forgot">${t('Забыли пароль?')}</button>
      <button class="btn ghost block" data-act="auth" data-screen="register">${t('Нет аккаунта? Создать')}</button>`;
  } else if (screen === 'forgot') {
    html = `
      <h2 class="page-title">${t('Забыли пароль?')}</h2>
      <section class="card page-card">
        <p>${t('Пароль восстанавливает администратор Beautybook: он пришлёт временный пароль. Войдите с ним и смените пароль: «Настройки» → «Аккаунт» → «Сменить пароль».')}</p>
        <div id="contact-box"><p class="hint">${t('Загружаем контакт администратора…')}</p></div>
      </section>
      <button class="btn ghost block" data-act="auth" data-screen="login">${t('Назад ко входу')}</button>`;
  } else if (screen === 'expired') {
    const sub = subscription();
    html = `
      <h2 class="page-title">${t('Продлите подписку')}</h2>
      <section class="card page-card">
        <p>${sub && sub.until ? t('Подписка на Beautybook закончилась {date}. Приложение и онлайн-запись для клиентов приостановлены — все ваши данные сохранены.', { date: esc(fullDateOn(sub.until)) }) : t('Подписка на Beautybook закончилась. Приложение и онлайн-запись для клиентов приостановлены — все ваши данные сохранены.')}</p>
        <p class="hint">${t('Тариф «Про»: {month} в месяц или {year} в год. Напишите администратору — он выставит счёт в Kaspi.kz на ваш номер, а после оплаты приложение снова откроется.', { month: L.formatMoney(L.TARIFF.month.price), year: L.formatMoney(L.TARIFF.year.price) })}</p>
        <button class="btn primary block" data-act="open-chat">${icon('chat')} ${t('Чат с администратором')} ${chatBadge('btn-badge')}</button>
        <div id="contact-box"><p class="hint">${t('Загружаем контакт администратора…')}</p></div>
        <button class="btn secondary block" data-act="check-subscription">${t('Я оплатил(а) — проверить')}</button>
      </section>
      <details class="terms card page-card"><summary>${t('Условия подписки')}</summary>${termsHtml()}</details>`;
  } else if (screen === 'profile') {
    const a = cloud.account || {};
    html = `
      <h2 class="page-title">${t('Дополните анкету')}</h2>
      <section class="card page-card">
        <p>${t('Приложение теперь называется Beautybook и подходит мастерам всех направлений красоты. Укажите ваше направление и номер Kaspi, на который администратор будет выставлять счёт за подписку.')}</p>
      </section>
      <form class="card page-card" id="auth-form" data-kind="profile" novalidate>
        ${specialtyField(a.specialty || st.specialty)}
        ${kaspiField(a.kaspi || st.kaspi || a.phone)}
        ${instagramField(st.instagram)}
        ${termsAgree()}
        <p class="warn-text" id="auth-error" hidden></p>
        <button type="submit" class="btn primary block">${t('Сохранить и продолжить')}</button>
      </form>`;
  } else if (screen === 'claim') {
    html = `
      <h2 class="page-title">${t('Ваш аккаунт')}</h2>
      <section class="card page-card">
        <p>${t('В Beautybook теперь вход по номеру телефона и паролю. Укажите свой номер и придумайте пароль — все ваши записи, клиенты и ссылка для клиентов останутся.')}</p>
      </section>
      <form class="card page-card" id="auth-form" data-kind="claim" novalidate>
        <label>${t('Ваше имя')}<input name="name" autocomplete="name" autocapitalize="words" enterkeyhint="next" value="${esc(settings().clientName || '')}" placeholder="${t('Так вас увидят клиенты')}"></label>
        ${phoneField()}
        ${placeFields}
        ${passwordFields}
        <p class="warn-text" id="auth-error" hidden></p>
        <button type="submit" class="btn primary block">${t('Сохранить и продолжить')}</button>
      </form>`;
  } else {
    html = `
      <section class="auth-hero">
        <img src="icons/bb-192.png" alt="" width="112" height="112">
        <h2>Beautybook</h2>
        <p>${t('Записи, клиенты и финансы для мастеров красоты. Клиенты сами записываются по вашей ссылке.')}</p>
      </section>
      ${note}
      <section class="card page-card install-offer" data-install-ui${Install.canInstall() ? '' : ' hidden'}>
        <button class="btn primary block" data-act="install"><span>${icon('download')} ${t('Установить на экран «Домой»')}</span></button>
        <p class="hint">${t('Приложение будет открываться с иконки, как обычное, и присылать уведомления о заявках.')}${isIOS ? ` ${t('На iPhone лучше сначала установить приложение, а аккаунт создать уже в нём.')}` : ''}</p>
      </section>
      <button class="btn ${Install.canInstall() ? 'secondary' : 'primary'} block" data-act="auth" data-screen="register">${t('Создать аккаунт')}</button>
      <button class="btn secondary block" data-act="auth" data-screen="login">${t('Войти')}</button>`;
  }
  view.innerHTML = `<div class="auth-page">${html}</div>`;
  const form = $('#auth-form');
  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault();
      submitAuth(form);
    });
  }
  if (screen === 'forgot' || screen === 'expired') showContact(screen);
}

// WhatsApp администратора для «Забыли пароль?» и «Продлите подписку» (задаётся на странице администратора).
async function showContact(kind = 'forgot') {
  let whatsapp = '';
  try {
    whatsapp = (await (await api('GET', '/api/contact')).json()).whatsapp || '';
  } catch (e) { /* нет связи — покажем общий текст */ }
  const box = $('#contact-box');
  if (!box) return;
  const phone = (cloud.account && cloud.account.phone) || ui.authPhone || cloud.lastPhone || '';
  const text = kind === 'forgot'
    ? t('Здравствуйте! Не могу войти в Beautybook: не помню пароль. Мой номер для входа: {phone}', { phone })
    : t('Здравствуйте! Хочу продлить подписку на Beautybook. Мой номер для входа: {phone}', { phone });
  box.innerHTML = whatsapp
    ? `<a class="btn primary block" href="https://wa.me/${whatsapp}?text=${encodeURIComponent(text)}" target="_blank" rel="noopener">${icon('chat')} ${t('Написать администратору в WhatsApp')}</a>`
    : `<p class="hint">${t('Напишите администратору Beautybook — тому, кто дал вам ссылку на приложение.')}</p>`;
}

function authError(message) {
  message = t(message);
  const box = $('#auth-error');
  if (!box) return toast(message);
  box.textContent = message;
  box.hidden = false;
}

async function submitAuth(form) {
  const kind = form.dataset.kind;
  const value = name => (field(form, name) ? field(form, name).value : '');
  const name = value('name').trim().replace(/\s+/g, ' ').slice(0, 40);
  const phone = L.phoneFromField(value('phone'));
  const password = value('password');
  const address = L.addressText(value('address'));
  const gis = L.gisLink(value('gis'));
  const specialty = L.specialtyText(value('specialty'));
  const kaspi = L.phoneFromField(value('kaspi'));
  const instagram = L.instagramName(value('instagram'));
  const terms = field(form, 'terms') ? field(form, 'terms').checked : true;
  if (kind === 'profile') return saveProfileForm(form, { specialty, kaspi, instagram, terms });
  const error = kind !== 'login' && !name ? 'Укажите имя — его увидят клиенты'
    : L.phoneFieldDigits(phone).length < 10 ? 'Укажите номер телефона полностью'
    : kind === 'register' && !specialty ? 'Укажите ваше направление'
    : kind === 'register' && L.phoneFieldDigits(kaspi).length < 10 ? 'Укажите номер Kaspi полностью — на него придёт счёт за подписку'
    : kind === 'register' && value('instagram').trim() && !instagram ? 'Не похоже на Instagram — впишите ник, например @ваш_ник'
    : kind !== 'login' && !address ? 'Укажите адрес, где вы принимаете'
    : kind !== 'login' && !gis ? 'Вставьте ссылку на своё место в 2ГИС: в 2ГИС «Поделиться» → «Копировать ссылку»'
    : password.length < 6 ? 'Пароль — не короче 6 символов'
    : kind !== 'login' && password !== value('password2') ? 'Пароли не совпадают'
    : kind === 'register' && !terms ? 'Отметьте согласие с условиями подписки'
    : '';
  if (error) return authError(error);
  const button = form.querySelector('button[type=submit]');
  const label = button.textContent;
  button.disabled = true;
  button.textContent = kind === 'login' ? t('Входим…') : t('Сохраняем…');
  try {
    // Пароль «растягиваем» здесь, на сервер уходит только результат.
    const secret = await L.passwordSecret(phone, password);
    if (kind === 'claim') {
      const res = await (await api('POST', '/api/account/claim', { name, phone, secret })).json();
      cloud.account = res.account;
      cloud.lastPhone = res.account.phone;
      await dbSet('cloud', cloud).catch(() => {});
      data.settings = { ...settings(), clientName: name, address, gis, whatsapp: settings().whatsapp || phone };
      await save();
      render();
      toast(t('Аккаунт готов. Входите по номеру и паролю'));
      scheduleSync(0);
      return;
    }
    const key = newDeviceKey();
    const res = await (await api('POST', kind === 'login' ? '/api/login' : '/api/register', { name, phone, secret, key, device: deviceName(), specialty, kaspi })).json();
    // На телефоне данные другого мастера (он вышел не через «Выйти») — убираем их.
    if (cloud.lastPhone && cloud.lastPhone !== res.account.phone) await clearLocalData();
    cloud = { ...freshCloud(), key, pushKey: res.pushKey, account: res.account, lastPhone: res.account.phone };
    await dbSet('cloud', cloud).catch(() => {});
    ui.auth = null;
    ui.authNote = '';
    ui.authPhone = '';
    if (kind === 'register') {
      data.settings = { ...settings(), clientName: name, address, gis, whatsapp: settings().whatsapp || phone, specialty, kaspi, instagram };
      const seeded = seedPrices(specialty);
      await save();
      render();
      toast(seeded ? t('Аккаунт создан. В прайс добавлены услуги вашего направления — впишите цены') : t('Аккаунт создан'));
      scheduleSync(0);
      return;
    }
    await restoreAfterLogin();
  } catch (e) {
    authError(e.offline ? 'Нет связи. Проверьте интернет и попробуйте ещё раз' : e.message);
  } finally {
    button.disabled = false;
    button.textContent = label;
  }
}

// Прайс по направлению (с 2.5.0): пустой прайс заполняется услугами направления мастера,
// цены — 0, мастер впишет их сам. Прайс, в котором уже есть услуги, не трогаем.
function seedPrices(specialty) {
  if (data.prices.length) return false;
  const list = L.servicesForSpecialty(specialty);
  if (!list.length) return false;
  data.prices = list.map(([name, duration]) => ({ id: uid(), name, price: 0, duration }));
  return true;
}

// Анкета (направление, номер Kaspi, Instagram): «Дополните анкету» и «Аккаунт».
async function saveProfileForm(form, { specialty, kaspi, instagram, terms }) {
  const typedInstagram = field(form, 'instagram') ? field(form, 'instagram').value.trim() : '';
  const error = !specialty ? 'Укажите ваше направление'
    : L.phoneFieldDigits(kaspi).length < 10 ? 'Укажите номер Kaspi полностью — на него придёт счёт за подписку'
    : typedInstagram && !instagram ? 'Не похоже на Instagram — впишите ник, например @ваш_ник'
    : !terms ? 'Отметьте согласие с условиями подписки'
    : '';
  if (error) return authError(error);
  const button = form.querySelector('button[type=submit]');
  button.disabled = true;
  try {
    const { account } = await (await api('PUT', '/api/account/profile', { specialty, kaspi })).json();
    cloud.account = account;
    await dbSet('cloud', cloud).catch(() => {});
    data.settings = { ...settings(), specialty, kaspi, instagram };
    const seeded = seedPrices(specialty);
    await save();
    render();
    toast(seeded ? t('Анкета сохранена. В прайс добавлены услуги вашего направления — впишите цены') : t('Анкета сохранена'));
    scheduleSync(0);
  } catch (e) {
    authError(e.offline ? 'Нет связи. Проверьте интернет и попробуйте ещё раз' : e.message);
  } finally {
    button.disabled = false;
  }
}

// Вошли: если в облаке есть копия — берём её (данные телефона, если они есть, — с вопросом).
async function restoreAfterLogin() {
  let remote = null;
  try {
    remote = await fetchCloudBackup();
  } catch (e) { /* нет копии или связи — останутся данные телефона */ }
  if (remote) {
    const n = remote.copy.appointments.length;
    const ask = t('В облаке есть копия ({date}): {count}. Заменить данные этого телефона копией из облака? Если отменить, данные телефона останутся и сохранятся в облако.', { date: formatDateTime(remote.created), count: `${n} ${L.plural(n, RECORD_FORMS)}` });
    if (!hasLocalData() || confirm(ask)) {
      await applyCloudBackup(remote.copy);
      return;
    }
  }
  render();
  toast(t('Вы вошли'));
  scheduleSync(0);
}

// Аккаунт с сервера: прежний мастер увидит «оформить аккаунт», у остальных обновятся имя и ссылка.
async function refreshAccount() {
  if (!cloud.key) return;
  try {
    const { account } = await (await api('GET', '/api/account')).json();
    const changed = JSON.stringify(account) !== JSON.stringify(cloud.account);
    cloud.account = account;
    if (account.claimed) cloud.lastPhone = account.phone;
    await dbSet('cloud', cloud).catch(() => {});
    if (changed) render();
  } catch (e) { /* нет связи — проверим позже */ }
}

function openChangePassword() {
  pushSheet(() => {
    sheetHtml(t('Смена пароля'), `
      <form id="password-form" class="sheet-body" novalidate>
        <input type="text" name="username" autocomplete="username" value="${esc((cloud.account && cloud.account.phone) || '')}" hidden>
        <label>${t('Текущий пароль')}<input type="password" name="old" autocomplete="current-password" enterkeyhint="next"></label>
        <label>${t('Новый пароль')}<input type="password" name="password" autocomplete="new-password" enterkeyhint="next" placeholder="${t('Не короче 6 символов')}"></label>
        <label>${t('Новый пароль ещё раз')}<input type="password" name="password2" autocomplete="new-password" enterkeyhint="done"></label>
        <p class="warn-text" id="auth-error" hidden></p>
        <button type="submit" class="btn primary block">${t('Сменить пароль')}</button>
      </form>`);
    const form = $('#password-form');
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const old = field(form, 'old').value, password = field(form, 'password').value;
      const error = !old ? 'Впишите текущий пароль'
        : password.length < 6 ? 'Новый пароль — не короче 6 символов'
        : password !== field(form, 'password2').value ? 'Новые пароли не совпадают'
        : '';
      if (error) return authError(error);
      const button = form.querySelector('button[type=submit]');
      button.disabled = true;
      button.textContent = t('Сохраняем…');
      try {
        const phone = cloud.account.phone;
        await api('PUT', '/api/account/password', { old: await L.passwordSecret(phone, old), secret: await L.passwordSecret(phone, password) });
        closeSheet();
        toast(t('Пароль изменён'));
      } catch (err) {
        authError(err.message);
        button.disabled = false;
        button.textContent = t('Сменить пароль');
      }
    });
  });
}

// Выход: сначала всё сохраняем в облако, потом убираем данные с телефона —
// на нём может войти другой мастер.
async function logoutAccount() {
  if (!confirm(t('Выйти из аккаунта? Данные сохранятся в облаке и вернутся, когда вы войдёте снова. С этого телефона они будут удалены.'))) return;
  toast(t('Сохраняем в облако…'));
  await syncNow();
  if (cloud.error && !confirm(t('Не удалось сохранить в облако ({error}). Если выйти сейчас, последние изменения пропадут. Всё равно выйти?', { error: cloud.error }))) return;
  try {
    await api('DELETE', '/api/account/session');
  } catch (e) { /* уже вышли или нет связи — ключ всё равно забываем */ }
  await clearLocalData();
  cloud = freshCloud();
  await dbSet('cloud', cloud).catch(() => {});
  ui.tab = 'records';
  ui.settingsPage = null;
  ui.auth = 'welcome';
  ui.authNote = '';
  ui.authPhone = '';
  render();
  scrollTo(0, 0);
  toast(t('Вы вышли из аккаунта'));
}

// ---------- Чат с администратором ----------
// Сообщения хранятся на сервере; пока окно открыто и приложение на экране — проверяем новые раз в 10 секунд.

let chatTimer = null;

function chatBubbles(messages) {
  if (!messages.length) return `<p class="hint chat-empty">${t('Напишите администратору: вопрос по оплате, подписке или работе приложения.')}</p>`;
  return messages.map(m => `
    <div class="bubble ${m.author === 'master' ? 'mine' : 'theirs'}">
      <p>${esc(m.text).replace(/\n/g, '<br>')}</p>
      <small>${esc(formatDateTime(m.created))}${m.author === 'master' && m.seen ? ` · ${t('прочитано')}` : ''}</small>
    </div>`).join('');
}

async function loadChat() {
  const list = $('#chat-list');
  if (!list) return stopChat();
  try {
    const { messages } = await (await api('GET', '/api/chat')).json();
    // Окно листается целиком (sheet); новые сообщения показываем, если читали самый низ.
    const atBottom = sheet.scrollHeight - sheet.scrollTop - sheet.clientHeight < 60;
    list.innerHTML = chatBubbles(messages);
    if (atBottom || !list.dataset.loaded) sheet.scrollTop = sheet.scrollHeight;
    list.dataset.loaded = '1';
    if (cloud.account && cloud.account.chatUnread) {
      cloud.account.chatUnread = 0;
      await dbSet('cloud', cloud).catch(() => {});
      updateChatBadge();
    }
  } catch (e) {
    if (!list.dataset.loaded) list.innerHTML = `<p class="hint chat-empty">${esc(e.offline ? t('Нет связи — сообщения появятся, когда интернет вернётся') : e.message)}</p>`;
  }
}

function stopChat() {
  clearInterval(chatTimer);
  chatTimer = null;
}

function openChat() {
  pushSheet(() => {
    sheetHtml(t('Чат с администратором'), `
      <div class="sheet-body chat-body">
        <div class="chat" id="chat-list"><p class="hint chat-empty">${t('Загружаем сообщения…')}</p></div>
        <form id="chat-form" class="chat-form" novalidate>
          <textarea name="text" rows="2" maxlength="2000" placeholder="${t('Сообщение администратору')}" aria-label="${t('Сообщение')}"></textarea>
          <button type="submit" class="btn primary">${t('Отправить')}</button>
        </form>
      </div>`);
    const form = $('#chat-form');
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const box = field(form, 'text');
      const text = box.value.trim();
      if (!text) return;
      const button = form.querySelector('button');
      button.disabled = true;
      try {
        const { messages } = await (await api('POST', '/api/chat', { text })).json();
        box.value = '';
        $('#chat-list').innerHTML = chatBubbles(messages);
        sheet.scrollTop = sheet.scrollHeight;
      } catch (err) {
        toast(err.offline ? t('Нет связи — сообщение не отправлено') : err.message);
      } finally {
        button.disabled = false;
      }
    });
    loadChat();
    stopChat();
    chatTimer = setInterval(() => {
      if (!$('#chat-list')) return stopChat();
      if (document.visibilityState === 'visible') loadChat();
    }, 10000);
  });
}

// «Продлить» из предупреждения: WhatsApp администратора с готовым текстом.
async function renewSubscription() {
  let whatsapp = '';
  try {
    whatsapp = (await (await api('GET', '/api/contact')).json()).whatsapp || '';
  } catch (e) { /* нет связи */ }
  if (!whatsapp) return toast(t('Напишите администратору в чат: «Настройки» → «Чат с администратором»'));
  const phone = (cloud.account && cloud.account.phone) || '';
  location.href = `https://wa.me/${whatsapp}?text=${encodeURIComponent(t('Здравствуйте! Хочу продлить подписку на Beautybook. Мой номер для входа: {phone}', { phone }))}`;
}

// Числа записей по месяцам — администратору (без имён и телефонов), только когда изменились.
async function syncStats() {
  if (!cloud.account || !cloud.account.claimed) return;
  const payload = L.statsPayload(data, today());
  const print = JSON.stringify(payload);
  if (print === cloud.statsPrint) return;
  await api('PUT', '/api/stats', payload);
  cloud.statsPrint = print;
}

// Убрать с телефона данные мастера: записи, фото, заявки.
async function clearLocalData() {
  for (const key of await dbKeys().catch(() => [])) {
    if (typeof key === 'string' && key.startsWith('photo:')) await dbDel(key).catch(() => {});
  }
  for (const id of [...photoUrls.keys()]) forgetPhoto(id);
  data = freshData();
  requests = [];
  await dbSet('data', data).catch(() => {});
  updateBadge();
}

async function restoreFromCloud() {
  let remote;
  try {
    remote = await fetchCloudBackup();
  } catch (e) {
    return toast(t('Не удалось загрузить: {error}', { error: e.message }));
  }
  if (!remote) return toast(t('В облаке пока нет копии'));
  const n = remote.copy.appointments.length;
  if (!confirm(t('Восстановить копию из облака ({date}, {count})? Данные на телефоне заменятся.', { date: formatDateTime(remote.created), count: `${n} ${L.plural(n, RECORD_FORMS)}` }))) return;
  await applyCloudBackup(remote.copy);
}

// Включение уведомлений: запрос разрешения должен идти сразу после нажатия (требование iOS).
async function enablePush() {
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return toast(isIOS && !isStandalone() ? t('Уведомления работают, только если приложение установлено на экран «Домой».') : t('Этот браузер не поддерживает уведомления.'));
  }
  let permission = 'denied';
  try {
    permission = await Notification.requestPermission();
  } catch (e) { /* ниже — понятное сообщение */ }
  if (permission !== 'granted') {
    return toast(t('Уведомления не разрешены. Включить их можно так: «Настройки» iPhone → «Уведомления» → Beautybook'));
  }
  try {
    await subscribePush();
    cloud.pushOn = true;
    await dbSet('cloud', cloud).catch(() => {});
    render();
    toast(t('Уведомления включены'));
    scheduleSync(0); // напоминания о записях — сразу на сервер
  } catch (e) {
    toast(t('Не удалось включить уведомления: {error}', { error: e.message }));
  }
}

async function subscribePush() {
  const reg = await navigator.serviceWorker.ready;
  const options = { userVisibleOnly: true, applicationServerKey: L.b64uToBytes(cloud.pushKey) };
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe(options);
  } else {
    // Подписка на другой ключ сервера не подойдёт — оформляем заново.
    const current = sub.options && sub.options.applicationServerKey;
    if (current && L.bytesToB64u(new Uint8Array(current)) !== cloud.pushKey) {
      await sub.unsubscribe();
      sub = await reg.pushManager.subscribe(options);
    }
  }
  // lang — на каком языке присылать уведомления (с 2.7.0).
  await api('PUT', '/api/push', { ...sub.toJSON(), lang: getLang() });
}

// ---------- Архив на телефон: ZIP с data.json и фото ----------

let pendingBackup = null;

// Сначала собираем файл, потом отдельной кнопкой отправляем: iOS разрешает
// «Поделиться» только сразу после нажатия, а сборка с фото занимает время.
async function prepareBackup() {
  toast(t('Готовим архив…'));
  const files = [{ name: 'data.json', data: new TextEncoder().encode(JSON.stringify(L.makeBackup(data))) }];
  for (const a of data.appointments) {
    for (const id of a.photos || []) {
      const rec = await dbGet('photo:' + id).catch(() => null);
      if (rec) files.push({ name: `photos/${id}.jpg`, data: new Uint8Array(rec.data) });
    }
  }
  pendingBackup = new File([makeZip(files)], `nailapp-${today()}.zip`, { type: 'application/zip' });
  const n = data.appointments.length, photos = files.length - 1;
  pushSheet(() => sheetHtml(t('Архив'), `
    <div class="sheet-body">
      <p class="lead">${t('Архив готов: {records}, {photos} фото, {size}.', { records: `${n} ${L.plural(n, RECORD_FORMS)}`, photos, size: formatSize(pendingBackup.size) })}</p>
      <p class="hint">${t('Отправьте файл себе в Telegram или WhatsApp либо сохраните в «Файлы». Восстановить: «Настройки» → «Архив на телефон» → «Восстановить из архива».')}</p>
      <button class="btn primary block" data-act="send-backup">${icon('share')} ${t('Отправить или сохранить')}</button>
    </div>`));
}

async function sendBackup() {
  const file = pendingBackup;
  if (!file) return;
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: t('Архив: {app}', { app: APP_NAME }) });
    else downloadFile(file);
  } catch (e) {
    if (e.name !== 'AbortError') toast(t('Не удалось сохранить архив'));
    return;
  }
  pendingBackup = null;
  data.lastBackup = new Date().toISOString();
  await save();
  closeSheet();
  render();
  toast(t('Архив сохранён'));
}

function downloadFile(file) {
  const url = URL.createObjectURL(file);
  const link = Object.assign(document.createElement('a'), { href: url, download: file.name });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

async function restoreBackup(file) {
  if (!file) return;
  let copy, photos = [];
  try {
    const head = new Uint8Array(await file.slice(0, 2).arrayBuffer());
    if (head[0] === 0x50 && head[1] === 0x4b) { // «PK» — архив ZIP
      const entries = await readZip(file);
      const json = entries.find(e => e.name === 'data.json');
      if (!json) throw new Error(t('Это не архив Beautybook'));
      copy = L.readBackup(await json.blob.text());
      photos = entries.filter(e => /^photos\/[\w-]+\.jpg$/.test(e.name));
    } else {
      copy = L.readBackup(await file.text()); // старая копия без фото
    }
  } catch (e) {
    return toast(t(e.message));
  }
  const count = `${copy.appointments.length} ${L.plural(copy.appointments.length, RECORD_FORMS)}${photos.length ? t(' и {count} фото', { count: photos.length }) : ''}`;
  const ask = copy.exportedAt
    ? t('Восстановить архив от {date}? В нём {count}. Текущие данные в приложении заменятся.', { date: formatDate(copy.exportedAt), count })
    : t('Восстановить архив? В нём {count}. Текущие данные в приложении заменятся.', { count });
  if (!confirm(ask)) return;
  toast(t('Восстанавливаем…'));
  try {
    for (const p of photos) {
      const id = p.name.slice(7, -4);
      await dbSet('photo:' + id, { type: 'image/jpeg', data: await p.blob.arrayBuffer(), created: null });
    }
  } catch (e) {
    return toast(t('Не хватило места для фото'));
  }
  data = {
    appointments: copy.appointments,
    expenses: copy.expenses,
    prices: copy.prices,
    rent: copy.rent,
    settings: copy.settings,
    blocks: copy.blocks,
    clients: copy.clients,
    rentPaid: copy.rentPaid,
    lastBackup: copy.exportedAt,
  };
  if (!(await save())) return;
  await cleanupPhotos();
  render();
  toast(t('Данные восстановлены'));
}

// ---------- Окна поверх экрана ----------
// Окна открываются стопкой: из карточки клиента — запись, после сохранения
// снова карточка. Кнопка «Назад» на Android закрывает верхнее окно.

const sheets = [];

function pushSheet(draw) {
  if (sheets.length) sheets[sheets.length - 1].scroll = sheet.scrollTop;
  sheets.push({ draw, scroll: 0 });
  history.pushState({ sheet: sheets.length }, '');
  showSheet();
}

function showSheet() {
  const top = sheets[sheets.length - 1];
  if (!top) {
    hideSheet();
    return;
  }
  sheet.hidden = false;
  document.documentElement.classList.add('locked');
  top.draw();
  sheet.scrollTop = top.scroll;
}

function sheetHtml(title, body) {
  sheet.innerHTML = `
    <header class="sheet-head">
      <button type="button" class="icon-btn" data-act="close-sheet" aria-label="${t('Закрыть')}">${icon('close')}</button>
      <h2>${esc(title)}</h2>
      <span></span>
    </header>${body}`;
}

function hideSheet() {
  sheet.hidden = true;
  sheet.innerHTML = '';
  document.documentElement.classList.remove('locked');
}

function closeSheet(levels = 1) {
  const n = Math.min(levels, sheets.length);
  if (n) history.go(-n);
}

// Что открыть, когда закроются все окна (например, «Запись подтверждена»).
let afterSheetsClosed = null;

// Глубина стопки хранится в истории: «Назад» на несколько окон закрывает их все.
addEventListener('popstate', () => {
  const depth = (history.state && history.state.sheet) || 0;
  while (sheets.length > depth) sheets.pop();
  closeViewer();
  showSheet();
  if (!sheets.length && afterSheetsClosed) {
    const next = afterSheetsClosed;
    afterSheetsClosed = null;
    next();
  }
});

let toastTimer = null;
function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
}

// ---------- Действия ----------

const actions = {
  'today': () => { ui.day = today(); ui.month = L.monthOf(ui.day); render(); },
  'month': el => changeMonth(Number(el.dataset.delta)),
  'day': el => { ui.day = el.dataset.day; ui.month = L.monthOf(ui.day); render(); },
  'new-appt': () => openAppt(null),
  'new-appt-for': el => openAppt(null, { name: el.dataset.name, phone: el.dataset.phone, date: today() }),
  // Из пустого поиска: введённое имя или номер сразу попадает в форму.
  'new-client': el => {
    const q = el.dataset.q || '';
    openNewClient(q.replace(/\D/g, '').length >= 3 ? { phone: q } : { name: q });
  },
  'edit-client': el => openClientProfile(el.dataset.key),
  // Подсказка «откуда пришёл»: для рекомендации сразу можно дописать, кто посоветовал.
  'pick-source': el => {
    const input = field(el.closest('form'), 'source');
    const recommended = el.dataset.value === t('По рекомендации');
    input.value = recommended ? `${el.dataset.value}: ` : el.dataset.value;
    if (recommended) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  },
  'delete-client': async el => {
    if (!confirm(t('Удалить клиента из списка?'))) return;
    data.clients = (data.clients || []).filter(c => c.id !== el.dataset.id);
    if (!(await save())) return;
    closeSheet();
    render();
    toast(t('Клиент удалён'));
  },
  'open-appt': el => openAppt(el.dataset.id),
  'close-sheet': () => closeSheet(),
  'pick-client': () => toggleClients(),
  'fill': el => fillClient(el.closest('form'), el.dataset.name, el.dataset.phone),
  'pick-time': el => {
    const form = el.closest('form');
    field(form, 'time').value = el.dataset.time;
    refreshAppt(form);
  },
  'service': el => {
    const form = el.closest('form');
    el.classList.toggle('on');
    const chips = [...form.querySelectorAll('.chip[data-act="service"].on')];
    field(form, 'services').value = JSON.stringify(chips.map(c => c.dataset.name));
    const sum = chips.reduce((total, c) => total + Number(c.dataset.price), 0);
    if (sum) field(form, 'total').value = L.formatAmount(sum);
    refreshAppt(form);
  },
  'status': el => {
    const form = el.closest('form');
    form.querySelectorAll('.seg button').forEach(b => b.classList.toggle('on', b === el));
    field(form, 'status').value = el.dataset.status;
    refreshAppt(form);
  },
  'delete-appt': async el => {
    if (!confirm(t('Удалить эту запись вместе с её фото?'))) return;
    const a = data.appointments.find(x => x.id === el.dataset.id);
    data.appointments = data.appointments.filter(x => x !== a);
    if (!(await save())) return;
    for (const id of (a && a.photos) || []) {
      await dbDel('photo:' + id).catch(() => {});
      forgetPhoto(id);
    }
    closeSheet();
    render();
    toast(t('Запись удалена'));
  },
  'open-request': el => openRequest(el.dataset.id),
  'send-confirmation': el => sendConfirmation(el.dataset.id),
  'copy-booking': async el => {
    try {
      await navigator.clipboard.writeText(el.dataset.link);
      toast(t('Ссылка скопирована'));
    } catch (e) {
      toast(t('Не удалось скопировать — выделите ссылку пальцем'));
    }
  },
  'confirm-request': el => confirmRequest(el.dataset.id),
  'decline-request': el => declineRequest(el.dataset.id),
  'open-client': el => openClient(el.dataset.key),
  'view-photo': el => openViewer(el),
  'close-viewer': () => hideViewer(),
  'share-photo': () => sharePhoto(),
  'delete-photo': () => deletePhoto(),
  'new-block': el => openBlock(null, el.dataset.day, el.dataset.mode),
  'edit-block': el => openBlock(el.dataset.id),
  // Весь день или часть дня (время с … до …).
  'block-mode': el => {
    const form = el.closest('form');
    form.querySelectorAll('.seg button').forEach(b => b.classList.toggle('on', b === el));
    field(form, 'mode').value = el.dataset.mode;
    refreshBlock(form);
  },
  'delete-block': async el => {
    const timed = L.isTimeBlock(data.blocks.find(b => b.id === el.dataset.id));
    if (!confirm(timed ? t('Открыть это время для записи снова?') : t('Открыть запись в эти дни снова?'))) return;
    data.blocks = data.blocks.filter(b => b.id !== el.dataset.id);
    if (!(await save())) return;
    closeSheet();
    render();
    toast(t('Запись снова открыта'));
  },
  'fin-month': el => changeFinMonth(Number(el.dataset.delta)),
  'new-expense': () => openExpense(null),
  'open-expense': el => openExpense(el.dataset.id),
  'delete-expense': async el => {
    if (!confirm(t('Удалить этот расход?'))) return;
    data.expenses = data.expenses.filter(e => e.id !== el.dataset.id);
    await save();
    closeSheet();
    render();
    toast(t('Расход удалён'));
  },
  'price-add': async () => {
    data.prices.push({ id: uid(), name: '', price: 0, duration: 0 });
    await save();
    render();
    const inputs = view.querySelectorAll('[data-change="price-name"]');
    inputs[inputs.length - 1].focus();
  },
  'price-del': async el => {
    const p = data.prices.find(x => x.id === el.dataset.id);
    if (!p || !confirm(t('Удалить «{name}» из прайса? Старые записи не изменятся.', { name: p.name || t('услугу без названия') }))) return;
    data.prices = data.prices.filter(x => x !== p);
    await save();
    render();
  },
  'share-link': async () => {
    const url = clientLink();
    if (!navigator.share) return actions['copy-link']();
    try {
      await navigator.share({ title: t('Онлайн-запись'), url });
    } catch (e) { /* отменили */ }
  },
  'copy-link': async () => {
    try {
      await navigator.clipboard.writeText(clientLink());
      toast(t('Ссылка скопирована'));
    } catch (e) {
      toast(t('Не удалось скопировать — выделите ссылку пальцем'));
    }
  },
  'enable-push': () => enablePush(),
  'sync-now': () => {
    cloud.backupPrint = '';
    cloud.schedulePrint = '';
    syncNow();
  },
  'cloud-restore': () => restoreFromCloud(),
  'backup': () => prepareBackup(),
  'send-backup': () => sendBackup(),
  'goto': el => { ui.tab = el.dataset.to; ui.settingsPage = el.dataset.page || null; render(); scrollTo(0, 0); },
  'settings-page': el => openSettingsPage(el.dataset.page || null),
  'rent-year': el => changeRentYear(Number(el.dataset.delta)),
  'rent-month': el => openRentMonth(el.dataset.month),
  'rent-unpaid': async el => {
    if (!confirm(t('Снять отметку об оплате аренды за этот месяц?'))) return;
    const rest = { ...(data.rentPaid || {}) };
    delete rest[el.dataset.month];
    data.rentPaid = rest;
    if (!(await save())) return;
    closeSheet();
    render();
    toast(t('Отметка снята'));
  },
  'install': () => Install.install({
    name: APP_NAME,
    icon: 'icons/bb-192.png',
    // На iPhone у приложения с экрана «Домой» свои данные: войти нужно ещё раз (записи вернутся из облака).
    after: !isIOS ? t('Потом открывайте Beautybook с иконки на экране «Домой».')
      : cloud.key ? t('Потом откройте Beautybook с иконки на экране «Домой» и войдите по номеру и паролю — записи вернутся из облака.')
      : t('Потом откройте Beautybook с иконки на экране «Домой» и создайте аккаунт (или войдите) уже там.'),
  }),
  'hide-install': () => { pref('installHidden', '1'); render(); },
  'hide-night-notice': () => { pref('nightNoticeHidden', '1'); render(); },
  'reload-app': () => location.reload(),
  'auth': el => {
    // Набранный номер переходит на следующий экран («Забыли пароль?», «Создать»).
    const typed = $('#auth-form input[name=phone]');
    if (typed && L.phoneFromField(typed.value)) ui.authPhone = L.phoneFromField(typed.value);
    ui.auth = el.dataset.screen;
    ui.authNote = '';
    render();
    scrollTo(0, 0);
  },
  'change-password': () => openChangePassword(),
  'open-chat': () => openChat(),
  'pick-specialty': el => {
    const input = el.closest('form, .card, .page-card').querySelector('input[name=specialty]');
    if (input) input.value = el.dataset.value;
  },
  'check-subscription': async el => {
    el.disabled = true;
    await refreshAccount();
    el.disabled = false;
    if (subscriptionOk()) {
      render();
      toast(t('Подписка продлена — приложение снова работает'));
      scheduleSync(0);
    } else {
      // Администратору — уведомление: мастер говорит, что оплатил (с 2.5.0).
      api('POST', '/api/account/paid').catch(() => {});
      toast(t('Оплата пока не отмечена — мы напомнили администратору. Когда он отметит оплату, приложение откроется'));
    }
  },
  'renew': () => renewSubscription(),
  'logout': () => logoutAccount(),
  'toggle-mode': () => {
    const mode = colorMode() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.mode = mode;
    pref('mode', mode);
    render();
  },
  'set-theme': el => {
    data.settings = { ...settings(), theme: el.dataset.value };
    render();
    save();
  },
  // Язык: кнопка «Қаз/Рус» в шапке и выбор в «Оформлении и языке».
  'toggle-lang': () => changeLang(getLang() === 'kk' ? 'ru' : 'kk'),
  'set-lang': el => changeLang(el.dataset.value),
};

function changeLang(next) {
  if (next === getLang()) return;
  setLang(next);
  render();
  // Уведомления о заявках приходят на языке приложения — сообщаем серверу новый язык.
  if (cloud.key && cloud.pushOn && 'Notification' in window && Notification.permission === 'granted') subscribePush().catch(() => {});
}

async function onChange(el) {
  const p = data.prices.find(x => x.id === el.dataset.id);
  const s = settings();
  switch (el.dataset.change) {
    case 'price-name':
      if (p) { p.name = el.value.trim(); if (await save()) toast(t('Прайс сохранён')); }
      break;
    case 'price':
      if (p) { p.price = L.toMoney(el.value); if (await save()) toast(t('Прайс сохранён')); }
      break;
    case 'price-duration':
      if (p) { p.duration = L.toDuration(el.value); if (await save()) toast(t('Прайс сохранён')); }
      break;
    case 'rent':
      data.rent = L.setRent(data.rent, L.monthOf(today()), L.toMoney(el.value));
      if (await save()) toast(t('Аренда сохранена'));
      break;
    case 'set-dayStart':
    case 'set-lastStart': {
      const next = { ...s, [el.dataset.change.slice(4)]: el.value };
      if (!el.value || L.toMinutes(next.dayStart) >= L.toMinutes(next.lastStart)) {
        el.value = s[el.dataset.change.slice(4)];
        return toast(t('Первая запись должна быть раньше последней'));
      }
      data.settings = next;
      if (await save()) toast(t('Рабочее время сохранено'));
      break;
    }
    case 'set-remindDays':
    case 'set-remindHours':
      data.settings = { ...s, [el.dataset.change.slice(4)]: Number(el.value) };
      if (await save()) toast(t('Сохранено'));
      break;
    case 'set-duration':
      data.settings = { ...s, duration: Number(el.value) };
      $('#duration-hint').textContent = durationHint(data.settings.duration);
      if (await save()) toast(t('Сохранено'));
      break;
    case 'set-clientName':
      data.settings = { ...s, clientName: el.value.trim() };
      if (await save()) toast(t('Сохранено'));
      break;
    case 'set-whatsapp':
      data.settings = { ...s, whatsapp: L.phoneFromField(el.value) };
      el.value = L.phoneFieldStart(data.settings.whatsapp);
      if (await save()) toast(t('Сохранено'));
      break;
    case 'set-address':
      data.settings = { ...s, address: L.addressText(el.value) };
      el.value = data.settings.address;
      if (await save()) toast(data.settings.address ? t('Адрес сохранён') : t('Адрес убран'));
      break;
    case 'set-gis': {
      const gis = L.gisLink(el.value);
      if (el.value.trim() && !gis) {
        el.value = s.gis;
        return toast(t('Это не ссылка 2ГИС. В 2ГИС: «Поделиться» → «Копировать ссылку»'));
      }
      data.settings = { ...s, gis };
      if (await save()) toast(gis ? t('Ссылка 2ГИС сохранена') : t('Ссылка убрана'));
      render(); // кнопка «Проверить ссылку»
      break;
    }
    case 'photo':
      await addPhotos(el.dataset.id, [...el.files]);
      el.value = '';
      break;
    case 'restore':
      await restoreBackup(el.files[0]);
      el.value = '';
      break;
  }
}

document.addEventListener('click', e => {
  const tab = e.target.closest('[data-tab]');
  if (tab) {
    ui.tab = tab.dataset.tab;
    if (ui.tab === 'settings') ui.settingsPage = null; // «Настройки» — всегда к списку пунктов
    render();
    scrollTo(0, 0);
    return;
  }
  const el = e.target.closest('[data-act]');
  if (el && actions[el.dataset.act]) actions[el.dataset.act](el);
});

document.addEventListener('change', e => {
  if (e.target.dataset && e.target.dataset.change) onChange(e.target);
});

// Поля сумм: при вводе только цифры, после ввода — «12 000».
const isMoney = el => el.classList && el.classList.contains('money');
document.addEventListener('focusin', e => {
  if (isMoney(e.target)) e.target.value = e.target.value.replace(/\D/g, '');
});
document.addEventListener('focusout', e => {
  if (isMoney(e.target)) e.target.value = L.formatAmount(L.toMoney(e.target.value));
});
document.addEventListener('input', e => {
  if (!isMoney(e.target)) return;
  const digits = e.target.value.replace(/\D/g, '');
  if (digits !== e.target.value) e.target.value = digits;
});

// «Ввод» на клавиатуре прячет её, а не отправляет форму раньше времени.
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
    e.preventDefault();
    e.target.blur();
  }
});

// Браузер предложил установку или приложение установили — показать или убрать кнопки «Установить».
Install.onInstallChange(() => {
  document.querySelectorAll('[data-install-ui]').forEach(el => { el.hidden = !Install.canInstall(); });
});

addEventListener('online', () => scheduleSync(500));

// Есть ли новая версия: iPhone часто не перезапускает приложение, а будит его — проверяем при каждом возвращении.
function checkForUpdate() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.getRegistration().then(reg => reg && reg.update()).catch(() => {});
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !data) return;
  checkForUpdate();
  scheduleSync(800);
  refreshAccount();
  // Приложение могли не закрывать несколько дней: «сегодня» должно сдвинуться.
  const now = today();
  if (now === ui.seenToday) return;
  if (ui.day === ui.seenToday) { ui.day = now; ui.month = L.monthOf(now); }
  if (ui.finMonth === L.monthOf(ui.seenToday)) ui.finMonth = L.monthOf(now);
  ui.seenToday = now;
  if (sheet.hidden) render();
});

// Нажали на напоминание о записи — открыть её день в «Записях».
function openDay(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !data) return;
  ui.tab = 'records';
  ui.settingsPage = null;
  ui.day = date;
  ui.month = L.monthOf(date);
  render();
  scrollTo(0, 0);
}

// ---------- Запуск ----------

async function start() {
  if (history.state && history.state.sheet) history.replaceState(null, '');
  fab.innerHTML = icon('plus');
  let stored = null;
  try {
    stored = await dbGet('data');
    cloud = { ...freshCloud(), ...((await dbGet('cloud')) || {}) };
  } catch (e) {
    storageBroken = true;
  }
  data = Object.assign(freshData(), stored || {});
  data.settings = { ...L.DEFAULT_SETTINGS, ...data.settings };
  // Раньше у записи была одна услуга в поле service — переводим в список.
  let migrated = false;
  for (const a of data.appointments) {
    if (Array.isArray(a.services)) continue;
    a.services = a.service ? [a.service] : [];
    delete a.service;
    migrated = true;
  }
  if (stored && !pref('plumDefault')) {
    if (data.settings.theme === 'rose') {
      data.settings.theme = 'plum';
      migrated = true;
    }
    pref('plumDefault', '1');
  }
  // 2.9.1: исходная тема — розово-чёрная, как значок. Прежняя исходная (пурпурная) меняется на неё один раз;
  // выбранная потом пурпурная остаётся (отметка themeV в настройках). Копии из облака меняет L.readBackup.
  if (stored && L.upgradeTheme(data.settings)) migrated = true;
  render();
  if (migrated) save();
  // Ключ GitHub от прежней версии больше не нужен — удаляем его с телефона.
  if (!storageBroken) dbDel('publish').catch(() => {});

  if ('serviceWorker' in navigator) {
    // Новая версия: Service Worker сменился, пока приложение открыто, — баннер «Вышло обновление».
    // При самой первой установке смены нет (раньше страницей никто не управлял).
    const hadController = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || updateReady) return;
      updateReady = true;
      if (sheet.hidden) render();
      else toast(t('Вышло обновление Beautybook. Нажмите «Обновить» — приложение перезапустится. Если что-то выглядит по-старому, закройте приложение и откройте снова (иногда 2 раза).'));
    });
    navigator.serviceWorker.register('./sw.js').catch(() => {});
    navigator.serviceWorker.addEventListener('message', e => {
      if (!e.data) return;
      if (e.data.type === 'check-update') checkForUpdate();
      if (e.data.type === 'open-requests') showRequests();
      if (e.data.type === 'new-request') loadRequests().catch(() => {});
      if (e.data.type === 'new-chat') {
        refreshAccount();
        if ($('#chat-list')) loadChat();
      }
      if (e.data.type === 'open-chat' && cloud.key) openChat();
      if (e.data.type === 'open-day') openDay(e.data.date);
    });
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  const params = new URLSearchParams(location.search);
  if (params.has('open')) {
    history.replaceState(history.state, '', location.pathname);
    if (params.get('open') === 'requests' && cloud.key) showRequests();
    if (params.get('open') === 'chat' && cloud.key) openChat();
    if (params.get('open') === 'day') openDay(params.get('d'));
  }
  // Подписка на уведомления могла обновиться (например, после перезагрузки iPhone).
  if (cloud.key && cloud.pushOn && 'Notification' in window && Notification.permission === 'granted') {
    subscribePush().catch(() => {});
  }
  refreshAccount();
  scheduleSync(1000);
}

start();
