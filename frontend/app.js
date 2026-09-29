// Nailapp — интерфейс приложения. Расчёты — в logic.js, архив — в zip.js.
// Данные живут в телефоне (IndexedDB) и сами сохраняются в облако (сервер backend/ на
// Cloudflare): копия записей и фото, свободное время для клиентов, заявки клиентов.

import * as L from './logic.js';
import { makeZip, readZip } from './zip.js';
import { API_URL } from './config.js';
import { phoneMask } from './phone-input.js';

const APP_NAME = 'Nailapp';
const APP_VERSION = '1.6.0';

phoneMask();

// ---------- Мелочи ----------

const $ = (sel, root = document) => root.querySelector(sel);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
// Секрет личной ссылки клиента на запись.
const newToken = () => L.bytesToB64u(crypto.getRandomValues(new Uint8Array(16)));
const today = () => L.ymd(new Date());
const nowMinutes = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const RECORD_FORMS = ['запись', 'записи', 'записей'];
const VISIT_FORMS = ['оплаченная запись', 'оплаченные записи', 'оплаченных записей'];
const REQUEST_FORMS = ['заявка', 'заявки', 'заявок'];

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
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4"/>',
};
const icon = name => `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

function formatDate(iso) {
  const d = new Date(iso);
  return isNaN(d) ? '' : `${d.getDate()} ${L.MONTHS_GEN[d.getMonth()]} ${d.getFullYear()}`;
}

function formatDateTime(iso) {
  const d = new Date(iso);
  return isNaN(d) ? '' : `${d.getDate()} ${L.MONTHS_GEN[d.getMonth()]} в ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
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
    prices: L.DEFAULT_SERVICES.map(name => ({ id: uid(), name, price: 0 })),
    rent: [{ from: '2000-01', amount: L.DEFAULT_RENT }],
    settings: { ...L.DEFAULT_SETTINGS },
    blocks: [],
    clients: [],
    lastBackup: null,
  };
}

function freshCloud() {
  // closing — заявки, подтверждённые без связи: закроем их в облаке при следующем сохранении.
  // bookings — что уже выложено по личным ссылкам клиентов: { token: JSON записи }.
  return { key: '', pushKey: '', pushOn: false, schedulePrint: '', backupPrint: '', savedAt: null, uploaded: [], closing: [], bookings: {}, error: '' };
}

const settings = () => ({ ...L.DEFAULT_SETTINGS, ...data.settings });

async function save() {
  if (storageBroken) {
    toast('Данные не открылись. Закройте приложение и откройте снова');
    return false;
  }
  try {
    await dbSet('data', data);
  } catch (e) {
    toast('Не удалось сохранить. Проверьте свободное место на телефоне');
    return false;
  }
  scheduleSync();
  return true;
}

// Заявки занимают время так же, как записи (в свободном времени и предупреждениях).
function busyList() {
  return data.appointments.concat(requests.map(r => ({
    id: `req:${r.id}`, date: r.date, time: r.time, status: 'booked', name: `${r.name} (заявка)`, phone: r.phone,
  })));
}

// ---------- Экран ----------

// monthAnim — куда уехал календарь при смене месяца ('next' или 'prev'), для анимации.
const ui = { tab: 'records', month: L.monthOf(today()), day: today(), finMonth: L.monthOf(today()), seenToday: today(), clientQuery: '', monthAnim: null };
const view = $('#view'), fab = $('#fab'), sheet = $('#sheet'), viewer = $('#viewer');

const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let installEvent = null;

// Вверху каждого раздела — логотип и название приложения (они в index.html),
// справа — кнопки раздела и переключатель светлого и тёмного режима.
function setHeader(actions = '') {
  const dark = colorMode() === 'dark';
  $('#appbar-actions').innerHTML = `${actions}
    <button class="hbtn round" data-act="toggle-mode" aria-label="${dark ? 'Светлый режим' : 'Тёмный режим'}">${icon(dark ? 'sun' : 'moon')}</button>`;
}

// ---------- Тема и режим ----------
// Тема (розовая, пурпурная, фиолетовая) — в настройках: уходит в облако и копию.
// Светлый или тёмный режим — только для этого телефона; пока его не выбрали
// кнопкой в шапке, он как в настройках телефона. Копию темы и режима в
// localStorage читает index.html, чтобы экран сразу открывался в своих цветах.

const darkQuery = matchMedia('(prefers-color-scheme: dark)');
const colorMode = () => document.documentElement.dataset.mode || (darkQuery.matches ? 'dark' : 'light');
darkQuery.addEventListener('change', () => { if (data) render(); });

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
  const tabs = [['records', 'calendar', 'Записи'], ['clients', 'users', 'Клиенты'], ['finance', 'chart', 'Финансы'], ['settings', 'sliders', 'Настройки']];
  $('#tabbar').innerHTML = tabs.map(([id, ic, label]) =>
    `<button data-tab="${id}"${ui.tab === id ? ' class="active" aria-current="page"' : ''}>${icon(ic)}<span>${label}</span>${id === 'records' && requests.length ? `<i class="tab-badge">${requests.length}</i>` : ''}</button>`).join('');
  fab.hidden = ui.tab !== 'records' && ui.tab !== 'clients';
  fab.dataset.act = ui.tab === 'clients' ? 'new-client' : 'new-appt';
  fab.setAttribute('aria-label', ui.tab === 'clients' ? 'Новый клиент' : 'Новая запись');
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

let swipedAt = 0;

function swipe(root, selector, { axes, move, end, enabled = () => true }) {
  let g = null;
  root.addEventListener('pointerdown', e => {
    const target = e.target.closest(selector);
    if (!target || !e.isPrimary || e.button > 0 || !enabled()) return;
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
  const t = today();
  const monthAnim = ui.monthAnim;
  ui.monthAnim = null;
  setHeader(ui.day !== t ? '<button class="hbtn" data-act="today">Сегодня</button>' : '');
  const counts = {};
  for (const a of data.appointments) if (a.status !== 'cancelled') counts[a.date] = (counts[a.date] || 0) + 1;
  const cells = L.monthGrid(ui.month).map(d => {
    const cls = ['day'];
    if (L.monthOf(d) !== ui.month) cls.push('out');
    if (d === t) cls.push('today');
    if (d === ui.day) cls.push('sel');
    if (L.blockFor(data.blocks, d)) cls.push('off');
    const n = counts[d] || 0;
    const label = L.dayTitle(d) + (n ? `, ${n} ${L.plural(n, RECORD_FORMS)}` : '');
    return `<button class="${cls.join(' ')}" data-act="day" data-day="${d}" aria-label="${label}"><span>${Number(d.slice(8))}</span><i>${n || ''}</i></button>`;
  }).join('');
  const dayRequests = requests.filter(r => r.date === ui.day);
  const list = data.appointments.filter(a => a.date === ui.day);
  const items = [...list.map(a => ({ time: a.time, html: apptCard(a) })), ...dayRequests.map(r => ({ time: r.time, html: requestCard(r, false) }))]
    .sort((a, b) => a.time.localeCompare(b.time));
  const active = list.filter(a => a.status !== 'cancelled').length;
  const block = L.blockFor(data.blocks, ui.day);
  let dayInfo = '';
  if (block) {
    dayInfo = `
      <div class="banner off">${icon('lock')}
        <div class="grow">Запись закрыта${block.note ? `: ${esc(block.note)}` : ''}<small>${blockRange(block)}</small></div>
        <button class="btn small secondary" data-act="edit-block" data-id="${esc(block.id)}">Изменить</button>
      </div>`;
  } else if (ui.day >= t) {
    const times = L.freeTimes(busyList(), ui.day, settings(), ui.day === t ? nowMinutes() : -1);
    dayInfo = `<p class="free-line">${times.length ? `Свободно: ${L.formatRanges(L.toRanges(times))}` : 'Свободного времени нет'}</p>`;
  }
  view.innerHTML = `
    ${banners()}
    ${requests.length ? `
    <section class="requests" id="requests">
      <h2 class="section-title">Новые заявки · ${requests.length}</h2>
      ${requests.map(r => requestCard(r, true)).join('')}
    </section>` : ''}
    <section class="card cal">
      <div class="cal-head">
        <button class="icon-btn" data-act="month" data-delta="-1" aria-label="Предыдущий месяц">${icon('left')}</button>
        <b>${L.monthTitle(ui.month)}</b>
        <button class="icon-btn" data-act="month" data-delta="1" aria-label="Следующий месяц">${icon('right')}</button>
      </div>
      <div class="cal-grid${monthAnim ? ` enter-${monthAnim}` : ''}">${L.WEEKDAYS_SHORT.map(w => `<span class="wd">${w}</span>`).join('')}${cells}</div>
    </section>
    <div class="day-head"><h2>${L.dayTitle(ui.day)}</h2>${active ? `<span>${active} ${L.plural(active, RECORD_FORMS)}</span>` : ''}</div>
    ${dayInfo}
    ${items.length ? items.map(x => x.html).join('') : `
      <div class="empty">
        <p>На этот день записей нет</p>
        <button class="btn secondary small" data-act="new-appt">${icon('plus')} Добавить запись</button>
      </div>`}
    ${!block && ui.day >= t ? `<div class="day-actions"><button class="btn small secondary" data-act="new-block" data-day="${ui.day}">${icon('lock')} Закрыть день для записи</button></div>` : ''}`;
}

function changeMonth(delta) {
  ui.month = L.addMonths(ui.month, delta);
  ui.monthAnim = delta > 0 ? 'next' : 'prev';
  render();
}

// Свайп по календарю влево — следующий месяц, вправо — предыдущий.
// Сетка дней едет за пальцем; если сдвинули мало — возвращается на место.
swipe(view, '.cal', {
  axes: ['x'],
  move(g) {
    const grid = g.target.querySelector('.cal-grid');
    grid.style.transform = `translateX(${g.dx}px)`;
    grid.style.opacity = 1 - Math.min(Math.abs(g.dx) / grid.clientWidth, 1) * 0.7;
  },
  end(g) {
    const grid = g.target.querySelector('.cal-grid');
    const w = grid.clientWidth;
    const flick = Math.abs(g.vx) > 0.4 && Math.sign(g.vx) === Math.sign(g.dx);
    grid.classList.add('settle');
    if (g.cancelled || !(Math.abs(g.dx) > w * 0.25 || flick)) {
      grid.style.transform = '';
      grid.style.opacity = '';
      setTimeout(() => grid.classList.remove('settle'), 200);
      return;
    }
    const delta = g.dx < 0 ? 1 : -1;
    grid.style.transform = `translateX(${-delta * w}px)`;
    grid.style.opacity = 0;
    setTimeout(() => changeMonth(delta), 150);
  },
});

function blockRange(b) {
  return b.from === b.to ? L.shortDate(b.from) : `${L.shortDate(b.from)} – ${L.shortDate(b.to)}`;
}

function apptCard(a) {
  const due = L.balanceDue(a);
  let sum;
  if (a.status === 'paid') {
    sum = `<span class="badge ok">оплачено</span><b>${L.formatMoney(a.total)}</b>`;
  } else if (a.status === 'cancelled') {
    sum = `<span class="badge muted">отмена</span>${a.prepaid ? `<small>предоплата ${L.formatMoney(a.prepaid)}</small>` : ''}`;
  } else {
    const late = a.date < today() && due > 0;
    sum = `${late ? '<span class="badge warn">не оплачено</span>' : '<small>остаток</small>'}<b>${L.formatMoney(due)}</b>`;
  }
  const photos = (a.photos || []).length;
  const details = [
    L.servicesLabel(L.servicesOf(a)),
    a.status === 'booked' && a.prepaid ? `предоплата ${L.formatMoney(a.prepaid)}` : '',
    photos ? `${photos} фото` : '',
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
      <span class="appt-sum"><span class="badge warn">заявка</span></span>
    </button>`;
}

function banners() {
  const out = [];
  if (storageBroken) {
    out.push('<div class="banner bad"><div class="grow">Не удалось открыть сохранённые записи. Закройте приложение полностью и откройте снова — изменения сейчас не сохраняются.</div></div>');
  }
  const touch = matchMedia('(pointer: coarse)').matches;
  if (!isStandalone() && !pref('installHidden') && (installEvent || (isIOS && touch))) {
    const text = installEvent
      ? 'Установите приложение на главный экран — оно будет открываться как обычное.'
      : `Установите приложение: нажмите ${icon('share')} «Поделиться» в Safari, затем «На экран „Домой“».`;
    out.push(`
      <div class="banner">
        <div class="grow">${text}</div>
        ${installEvent ? '<button class="btn small primary" data-act="install">Установить</button>' : ''}
        <button class="icon-btn" data-act="hide-install" aria-label="Скрыть">${icon('close')}</button>
      </div>`);
  }
  if (!data.prices.some(p => p.price > 0)) {
    out.push(`
      <div class="banner">
        <div class="grow">Заполните прайс — тогда сумма будет подставляться в запись сама.</div>
        <button class="btn small secondary" data-act="goto" data-to="settings">Прайс</button>
      </div>`);
  }
  if (!cloud.key) {
    out.push(`
      <div class="banner">
        <div class="grow">Подключите облако: записи и фото будут сохраняться сами, а клиенты смогут оставлять заявки.</div>
        <button class="btn small secondary" data-act="goto" data-to="settings">Подключить</button>
      </div>`);
  } else if (cloud.error) {
    out.push(`
      <div class="banner warn">
        <div class="grow">Облако: ${esc(cloud.error)}. Попробуем снова при следующем изменении.</div>
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

  sheetHtml(src ? 'Запись' : requestId ? 'Подтверждение записи' : 'Новая запись', `
    <form id="appt-form" class="sheet-body" novalidate autocomplete="off">
      ${requestId ? '<p class="hint form-note">Проверьте данные, впишите предоплату и сохраните — запись появится в календаре, а время станет занятым для клиентов.</p>' : ''}
      <div class="row2">
        <label>Дата<input type="date" name="date" value="${esc(a.date)}"></label>
        <label>Время<input type="time" name="time" value="${esc(a.time)}"></label>
      </div>
      <div id="time-hint" class="time-hint"></div>
      <button type="button" class="btn secondary block" data-act="pick-client">${icon('user')} Выбрать клиента</button>
      <div id="client-panel"></div>
      <label>Имя клиента<input name="name" value="${esc(a.name)}" autocapitalize="words" enterkeyhint="done" placeholder="Например, Айгуль"></label>
      <div class="suggest" data-for="name"></div>
      <label>Телефон<input name="phone" type="tel" value="${esc(L.phoneFieldStart(a.phone))}" enterkeyhint="done"></label>
      <div class="suggest" data-for="phone"></div>
      <div class="phone-links" id="phone-links"></div>
      <fieldset>
        <legend>Услуги — можно несколько</legend>
        <div class="chips">${services.map(p => `
          <button type="button" class="chip${chosen.includes(p.name) ? ' on' : ''}" data-act="service" data-name="${esc(p.name)}" data-price="${p.price}">
            ${esc(p.name)}${p.price ? `<small>${L.formatAmount(p.price)}</small>` : ''}
          </button>`).join('')}
        </div>
        <input type="hidden" name="services" value="${esc(JSON.stringify(chosen))}">
      </fieldset>
      <div class="row2">
        <label>Сумма, ₸<input name="total" class="money" inputmode="numeric" enterkeyhint="done" value="${L.formatAmount(a.total)}" placeholder="0"></label>
        <label>Предоплата, ₸<input name="prepaid" class="money" inputmode="numeric" enterkeyhint="done" value="${L.formatAmount(a.prepaid)}" placeholder="0"></label>
      </div>
      <div id="summary" class="summary"></div>
      <fieldset>
        <legend>Статус</legend>
        <div class="seg">${L.STATUSES.map(s => `
          <button type="button" data-act="status" data-status="${s}"${a.status === s ? ' class="on"' : ''}>${L.STATUS_LABELS[s]}</button>`).join('')}
        </div>
        <input type="hidden" name="status" value="${esc(a.status)}">
      </fieldset>
      <label>Заметка<input name="note" value="${esc(a.note)}" enterkeyhint="done" placeholder="Дизайн, длина, пожелания"></label>
      ${src ? `
      <fieldset>
        <legend>Фото результата</legend>
        <div class="thumbs" data-photos-of="${esc(src.id)}">${thumbs(src)}</div>
        <label class="btn small secondary">${icon('camera')} Добавить фото<input type="file" accept="image/*" multiple class="file-input" data-change="photo" data-id="${esc(src.id)}"></label>
      </fieldset>` : ''}
      <p id="appt-warn" class="warn-text" hidden></p>
      <button type="submit" class="btn primary block">${requestId ? 'Подтвердить запись' : 'Сохранить'}</button>
      ${src ? `<button type="button" class="btn danger block" data-act="delete-appt" data-id="${esc(src.id)}">Удалить запись</button>` : ''}
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
const chosenServices = form => JSON.parse(field(form, 'services').value || '[]');
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
    box.innerHTML = `<span>Оплачено полностью</span><b>${L.formatMoney(total)}</b>`;
  } else if (status === 'cancelled') {
    box.className = 'summary muted';
    box.innerHTML = `<span>${prepaid ? `Предоплата ${L.formatMoney(prepaid)} остаётся в приходе. Если вернули её клиенту — поставьте 0.` : 'Запись отменена.'}</span>`;
  } else if (prepaid > total) {
    box.className = 'summary bad';
    box.innerHTML = '<span>Предоплата больше суммы</span>';
  } else {
    box.className = 'summary';
    box.innerHTML = `<span>Остаток к оплате</span><b>${L.formatMoney(total - prepaid)}</b>`;
  }

  const s = settings();
  const busy = busyList();
  const date = field(form, 'date').value, time = field(form, 'time').value;
  const block = date ? L.blockFor(data.blocks, date) : null;
  const hint = $('#time-hint');
  if (!date || date < today() || block) {
    hint.innerHTML = '';
  } else {
    const times = L.freeTimes(busy, date, s, date === today() ? nowMinutes() : -1, selfId(form));
    const ranges = L.toRanges(times);
    hint.innerHTML = times.length
      ? `<span>Свободно: ${L.formatRanges(ranges)}</span>
         <div class="time-chips">${ranges.map(([from]) => `<button type="button" class="chip small" data-act="pick-time" data-time="${from}">${L.shortTime(from)}</button>`).join('')}</div>`
      : '<span>В этот день свободного времени нет</span>';
  }

  const warnings = [];
  if (block) warnings.push(`Этот день закрыт для записи${block.note ? `: ${block.note}` : ''}.`);
  if (date && time) {
    const near = L.conflicts(busy, date, time, s.duration, selfId(form));
    if (near.length) {
      const who = near.map(x => `${x.name || x.phone} в ${L.shortTime(x.time)}`).join(', ');
      warnings.push(`Пересекается с записью: ${who}. Между записями нужно ${L.formatDuration(s.duration)}.`);
    }
    const m = L.toMinutes(time);
    if (m < L.toMinutes(s.dayStart) || m > L.toMinutes(s.lastStart)) {
      warnings.push(`Вне рабочего времени (${L.shortTime(s.dayStart)}–${L.shortTime(s.lastStart)}).`);
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
    const text = reminderText(field(form, 'name').value.trim(), chosenServices(form), date, time) + (token ? ` Ваша запись: ${bookingLink(token)}` : '');
    links.innerHTML = `
      <a class="btn small secondary" href="tel:+${d}">${icon('phone')} Позвонить</a>
      <a class="btn small secondary" href="https://wa.me/${d}?text=${encodeURIComponent(text)}" target="_blank" rel="noopener">${icon('chat')} Напомнить в WhatsApp</a>
      ${saved && saved.status !== 'cancelled' ? `<button type="button" class="btn small secondary" data-act="send-confirmation" data-id="${esc(saved.id)}">${icon('check')} Отправить подтверждение</button>` : ''}`;
  } else {
    links.innerHTML = '';
  }
}

function bookingLink(token) {
  return `${clientLink()}?z=${token}`;
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

function reminderText(name, services, date, time) {
  let text = `Здравствуйте${name ? ', ' + name : ''}!`;
  const what = L.servicesLabel(services).toLowerCase();
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
    : !rec.services.length ? 'Выберите услугу'
    : rec.prepaid > rec.total ? 'Предоплата не может быть больше суммы'
    : '';
  if (error) return toast(error);

  const now = new Date().toISOString();
  const src = data.appointments.find(a => a.id === form.dataset.id);
  let saved = src;
  if (src) {
    Object.assign(src, rec, { updated: now });
    delete src.service;
  } else {
    saved = { id: uid(), ...rec, photos: [], created: now, updated: now };
    if (form.dataset.token) saved.token = form.dataset.token;
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
  toast(src ? 'Запись обновлена' : 'Запись добавлена');
}

// ---------- Заявки клиентов ----------

function openConfirmed(id) {
  pushSheet(() => drawConfirmed(id));
}

function drawConfirmed(id) {
  const a = data.appointments.find(x => x.id === id);
  if (!a) {
    sheetHtml('Запись подтверждена', '<div class="sheet-body"><p class="empty">Запись не найдена</p></div>');
    return;
  }
  const link = bookingLink(a.token);
  const d = L.phoneDigits(a.phone);
  sheetHtml('Запись подтверждена', `
    <div class="sheet-body okna-done">
      <p class="done-mark">✓</p>
      <h2>${esc(a.name || L.formatPhone(a.phone))}</h2>
      <p>${L.dayTitle(a.date)}, ${L.shortTime(a.time)}<br>${esc(L.servicesLabel(L.servicesOf(a)))}</p>
      <p class="hint">Отправьте клиенту подтверждение — в сообщении будет ссылка, по которой он в любое время увидит свою запись.</p>
      ${L.canDial(a.phone) ? `<a class="btn primary block" href="https://wa.me/${d}?text=${encodeURIComponent(L.confirmationText(a, link))}" target="_blank" rel="noopener">${icon('chat')} Отправить подтверждение в WhatsApp</a>` : ''}
      <div class="link-box">${esc(link)}</div>
      <div class="btn-row center">
        <button class="btn small secondary" data-act="copy-booking" data-link="${esc(link)}">${icon('link')} Скопировать ссылку</button>
        <button class="btn small ghost" data-act="close-sheet">Готово</button>
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
    sheetHtml('Заявка', '<div class="sheet-body"><p class="empty">Заявка уже обработана</p></div>');
    return;
  }
  const total = L.servicesTotal(r.services, data.prices);
  const d = L.phoneDigits(r.phone);
  const what = L.servicesLabel(r.services).toLowerCase();
  const text = `Здравствуйте, ${r.name}! Получила вашу заявку на ${L.shortDate(r.date)} в ${L.shortTime(r.time)} (${what}). Чтобы подтвердить запись, внесите, пожалуйста, предоплату.`;
  const near = L.conflicts(data.appointments, r.date, r.time, settings().duration);
  const block = L.blockFor(data.blocks, r.date);
  sheetHtml('Заявка на запись', `
    <div class="sheet-body">
      <div class="card request-info">
        <p class="lead"><b>${esc(r.name)}</b></p>
        <p>${esc(L.formatPhone(r.phone))}</p>
        <p>${L.dayTitle(r.date)}, ${L.shortTime(r.time)}</p>
        <p>${esc(L.servicesLabel(r.services))}${total ? ` · ${L.formatMoney(total)}` : ''}</p>
        ${r.comment ? `<p class="hint">«${esc(r.comment)}»</p>` : ''}
        <p class="hint">Заявка пришла ${formatDateTime(r.created)}</p>
      </div>
      ${near.length || block ? `<p class="warn-text">${block ? 'Этот день закрыт для записи. ' : ''}${near.length ? `Пересекается с записью: ${esc(near.map(x => `${x.name || x.phone} в ${L.shortTime(x.time)}`).join(', '))}.` : ''}</p>` : ''}
      <a class="btn secondary block" href="https://wa.me/${d}?text=${encodeURIComponent(text)}" target="_blank" rel="noopener">${icon('chat')} Написать в WhatsApp</a>
      <p class="hint form-note">Попросите предоплату. Когда она придёт, нажмите «Подтвердить запись».</p>
      <button class="btn primary block" data-act="confirm-request" data-id="${esc(r.id)}">Подтвердить запись</button>
      <button class="btn danger block" data-act="decline-request" data-id="${esc(r.id)}">Отклонить</button>
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
  if (!confirm('Отклонить заявку? Это время снова станет свободным для других клиентов.')) return;
  try {
    await api('POST', `/api/requests/${id}/decline`);
  } catch (e) {
    return toast(`Не удалось отклонить: ${e.message}`);
  }
  requests = requests.filter(r => r.id !== id);
  updateBadge();
  closeSheet();
  render();
  toast('Заявка отклонена');
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
    panel.innerHTML = '<div class="panel"><p class="hint">Сохранённых клиентов пока нет. Впишите имя и телефон ниже — после сохранения записи клиент появится в этом списке.</p></div>';
    return;
  }
  panel.innerHTML = `
    <div class="panel">
      <input type="search" id="client-q" placeholder="Имя или номер" aria-label="Поиск клиента">
      <div id="client-results" class="client-list"></div>
    </div>`;
  const q = $('#client-q');
  const show = () => {
    const found = L.findClients(clients, q.value);
    $('#client-results').innerHTML = found.length ? found.map(personButton).join('') : '<p class="hint">Никого не нашли</p>';
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
        <p>Клиентов пока нет. Они появятся здесь после первой записи — или добавьте клиента сами.</p>
        <button class="btn secondary small" data-act="new-client">${icon('plus')} Добавить клиента</button>
      </div>`;
    return;
  }
  view.innerHTML = `
    <input type="search" id="clients-q" class="search" placeholder="Поиск по имени или номеру" aria-label="Поиск клиента" value="${esc(ui.clientQuery)}">
    <section class="card list" id="clients-list"></section>`;
  const q = $('#clients-q');
  const show = () => {
    ui.clientQuery = q.value;
    const found = L.findClients(clients, q.value);
    $('#clients-list').innerHTML = found.length ? found.map(clientRow).join('') : `
      <div class="list-empty">
        <p class="hint">Никого не нашли</p>
        <button class="btn secondary small" data-act="new-client" data-q="${esc(q.value.trim())}">${icon('plus')} Добавить клиента</button>
      </div>`;
  };
  q.addEventListener('input', show);
  show();
}

function clientRow(c) {
  return `
    <button class="client-row" data-act="open-client" data-key="${esc(c.key)}">
      <span><b>${esc(c.name || L.formatPhone(c.phone))}</b><small>${esc(c.name ? L.formatPhone(c.phone) : '')}</small></span>
      <span class="meta">${c.last ? `${c.visits} ${L.plural(c.visits, RECORD_FORMS)}<small>последняя ${L.shortDate(c.last)}</small>` : 'без записей'}</span>
    </button>`;
}

function openClient(key) {
  pushSheet(() => drawClient(key));
}

function drawClient(key) {
  const c = L.pastClients(data.appointments, data.clients).find(x => x.key === key);
  if (!c) {
    sheetHtml('Клиент', '<div class="sheet-body"><p class="empty">Записей этого клиента больше нет</p></div>');
    return;
  }
  const visits = L.clientVisits(data.appointments, c);
  const d = L.phoneDigits(c.phone);
  const t = today();
  sheetHtml(c.name || L.formatPhone(c.phone), `
    <div class="sheet-body">
      ${c.name && c.phone ? `<p class="client-phone">${esc(L.formatPhone(c.phone))}</p>` : ''}
      ${L.canDial(c.phone) ? `
      <div class="phone-links">
        <a class="btn small secondary" href="tel:+${d}">${icon('phone')} Позвонить</a>
        <a class="btn small secondary" href="https://wa.me/${d}" target="_blank" rel="noopener">${icon('chat')} WhatsApp</a>
      </div>` : ''}
      <button class="btn primary block" data-act="new-appt-for" data-name="${esc(c.name)}" data-phone="${esc(c.phone)}">${icon('plus')} Новая запись</button>
      <h3 class="section-title">Записи · ${visits.length}</h3>
      ${visits.length ? visits.map(a => visitRow(a, t)).join('') : '<p class="hint">Записей пока нет.</p>'}
      ${c.id && !visits.length ? `<button class="btn danger block" data-act="delete-client" data-id="${esc(c.id)}">Удалить клиента</button>` : ''}
    </div>`);
  loadPhotos(sheet);
}

// Новый клиент без записи: имя и телефон. Он появится в списке клиентов
// и в «Выбрать клиента» при записи.
function openNewClient(prefill = {}) {
  pushSheet(() => {
    sheetHtml('Новый клиент', `
      <form id="client-form" class="sheet-body" novalidate autocomplete="off">
        <label>Имя клиента<input name="name" value="${esc(prefill.name)}" autocapitalize="words" enterkeyhint="done" placeholder="Например, Айгуль"></label>
        <label>Телефон<input name="phone" type="tel" value="${esc(L.phoneFieldValue(prefill.phone))}" enterkeyhint="done"></label>
        <p class="hint form-note">Клиент появится в списке и в «Выбрать клиента», когда будете делать запись.</p>
        <button type="submit" class="btn primary block">Сохранить клиента</button>
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
  if (!name && !phone) return toast('Укажите имя или телефон клиента');
  if (phone && L.phoneFieldDigits(phone).length < 10) return toast('Номер телефона неполный');
  const twin = L.findTwin(L.pastClients(data.appointments, data.clients), name, phone);
  if (twin) return toast(`Такой клиент уже есть: ${twin.name || L.formatPhone(twin.phone)}`);
  data.clients = [...(data.clients || []), { id: uid(), name, phone, created: new Date().toISOString() }];
  if (!(await save())) return;
  closeSheet();
  ui.clientQuery = '';
  render();
  toast('Клиент добавлен');
}

function visitRow(a, t) {
  const money = a.status === 'paid' ? `оплачено ${L.formatMoney(a.total)}`
    : a.status === 'cancelled' ? 'отмена'
    : `остаток ${L.formatMoney(L.balanceDue(a))}`;
  const canPhoto = a.date <= t && a.status !== 'cancelled';
  return `
    <div class="visit ${esc(a.status)}">
      <button class="visit-main" data-act="open-appt" data-id="${esc(a.id)}">
        <b>${L.shortDate(a.date)} ${a.date.slice(0, 4)}, ${esc(L.shortTime(a.time))}</b>
        <small>${esc(L.servicesLabel(L.servicesOf(a)))} · ${money}</small>
        ${a.note ? `<small>${esc(a.note)}</small>` : ''}
      </button>
      <div class="thumbs" data-photos-of="${esc(a.id)}">${thumbs(a)}</div>
      ${canPhoto ? `<label class="btn small secondary">${icon('camera')} Фото<input type="file" accept="image/*" multiple class="file-input" data-change="photo" data-id="${esc(a.id)}"></label>` : ''}
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
      <img data-photo="${esc(id)}" alt="Фото результата">
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
  toast('Добавляем фото…');
  let added = 0;
  for (const file of files) {
    try {
      const blob = await compressImage(file);
      const id = uid();
      await dbSet('photo:' + id, { type: 'image/jpeg', data: await blob.arrayBuffer(), created: new Date().toISOString() });
      a.photos = [...(a.photos || []), id];
      added++;
    } catch (e) {
      toast('Не удалось добавить фото');
    }
  }
  if (!added || !(await save())) return;
  refreshPhotoViews(apptId);
  if (ui.tab === 'records') render();
  toast(added > 1 ? `Добавлено фото: ${added}` : 'Фото добавлено');
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
      <button class="icon-btn" data-act="close-viewer" aria-label="Закрыть">${icon('close')}</button>
      <span class="grow viewer-count"></span>
      <button class="btn small" data-act="share-photo">${icon('share')} Поделиться</button>
      <button class="icon-btn" data-act="delete-photo" aria-label="Удалить фото">${icon('trash')}</button>
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
      slide.innerHTML = '<img alt="Фото результата" draggable="false">';
      track.append(slide);
      photoUrl(list[i].photoId).then(url => { if (url) slide.firstChild.src = url; }).catch(() => {});
    }
    slide.style.transform = `translateX(${(i - index) * 100}%)`;
  }
  track.style.transform = '';
  $('.viewer-count', viewer).textContent = list.length > 1 ? `${index + 1} из ${list.length}` : '';
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
  viewer.hidden = true;
  viewer.innerHTML = '';
  viewer.className = 'viewer';
  viewer.removeAttribute('style');
  viewerState = null;
}

swipe(viewer, '.viewer-stage', {
  axes: ['x', 'y'],
  enabled: () => Boolean(viewerState && !viewerState.busy),
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

async function sharePhoto() {
  if (!viewerState) return;
  let { file } = viewerState;
  if (!file) {
    const { photoId } = viewerState.list[viewerState.index];
    const rec = await dbGet('photo:' + photoId).catch(() => null);
    if (!rec) return toast('Фото не найдено');
    file = new File([rec.data], `foto-${photoId}.jpg`, { type: rec.type || 'image/jpeg' });
  }
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file] });
    else downloadFile(file);
  } catch (e) {
    if (e.name !== 'AbortError') toast('Не удалось поделиться фото');
  }
}

async function deletePhoto() {
  if (!viewerState || !confirm('Удалить это фото?')) return;
  const state = viewerState;
  const { apptId, photoId } = state.list[state.index];
  const a = data.appointments.find(x => x.id === apptId);
  if (a) a.photos = (a.photos || []).filter(id => id !== photoId);
  if (!(await save())) return;
  await dbDel('photo:' + photoId).catch(() => {});
  forgetPhoto(photoId);
  refreshPhotoViews(apptId);
  if (ui.tab === 'records') render();
  toast('Фото удалено');
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

// ---------- Закрытые дни ----------

function openBlock(id, day) {
  pushSheet(() => drawBlock(id, day));
}

function drawBlock(id, day) {
  const src = id ? data.blocks.find(b => b.id === id) : null;
  const b = src || { from: day, to: day, note: '' };
  sheetHtml(src ? 'Закрытые дни' : 'Закрыть запись', `
    <form id="block-form" class="sheet-body" novalidate autocomplete="off">
      <p class="hint">В эти дни клиенты не увидят свободного времени по ссылке.</p>
      <div class="row2">
        <label>С<input type="date" name="from" value="${esc(b.from)}"></label>
        <label>По<input type="date" name="to" value="${esc(b.to)}"></label>
      </div>
      <label>Причина (видна только вам)<input name="note" value="${esc(b.note)}" enterkeyhint="done" placeholder="Отпуск, болезнь…"></label>
      <p id="block-warn" class="warn-text" hidden></p>
      <button type="submit" class="btn primary block">${src ? 'Сохранить' : 'Закрыть запись'}</button>
      ${src ? `<button type="button" class="btn danger block" data-act="delete-block" data-id="${esc(src.id)}">Открыть запись снова</button>` : ''}
    </form>`);
  const form = $('#block-form');
  const range = () => {
    const from = field(form, 'from').value, to = field(form, 'to').value || from;
    return from <= to ? [from, to] : [to, from];
  };
  const check = () => {
    const [from, to] = range();
    const n = data.appointments.filter(a => a.status !== 'cancelled' && a.date >= from && a.date <= to).length;
    const warn = $('#block-warn');
    warn.hidden = !n;
    if (n) warn.textContent = `На эти дни уже есть ${n} ${L.plural(n, RECORD_FORMS)} — перенесите или отмените их.`;
  };
  form.addEventListener('input', check);
  check();
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const [from, to] = range();
    if (!from) return toast('Укажите дату');
    const rec = { from, to, note: field(form, 'note').value.trim() };
    if (src) Object.assign(src, rec);
    else data.blocks.push({ id: uid(), ...rec });
    if (!(await save())) return;
    closeSheet();
    render();
    toast(from === to ? 'День закрыт для записи' : 'Дни закрыты для записи');
  });
}

// ---------- Финансы ----------

function renderFinance() {
  setHeader();
  const ym = ui.finMonth;
  const r = L.monthReport(data, ym);
  const expenses = data.expenses.filter(e => L.monthOf(e.date) === ym).sort((a, b) => b.date.localeCompare(a.date));
  view.innerHTML = `
    <div class="month-nav">
      <button class="icon-btn" data-act="fin-month" data-delta="-1" aria-label="Предыдущий месяц">${icon('left')}</button>
      <b>${L.monthTitle(ym)}</b>
      <button class="icon-btn" data-act="fin-month" data-delta="1" aria-label="Следующий месяц">${icon('right')}</button>
    </div>
    <section class="card result ${r.profit < 0 ? 'neg' : 'pos'}">
      <span>Чистая прибыль</span>
      <strong>${L.formatMoney(r.profit)}</strong>
      <small>приход − материалы − аренда</small>
    </section>
    <section class="card lines">
      <div class="line">
        <span>Приход<small>получено от клиентов${r.paidVisits ? ` · ${r.paidVisits} ${L.plural(r.paidVisits, VISIT_FORMS)}` : ''}</small></span>
        <b class="in">${L.formatMoney(r.income)}</b>
      </div>
      <div class="line"><span>Материалы</span><b>${L.formatMoney(-r.materials)}</b></div>
      <div class="line"><span>Аренда<small>каждый месяц, сумма — в «Настройках»</small></span><b>${L.formatMoney(-r.rent)}</b></div>
      ${r.expected ? `
      <div class="line soft">
        <span>Ожидается ещё<small>остатки по записям, которые пока не оплачены</small></span>
        <b>${L.formatMoney(r.expected)}</b>
      </div>` : ''}
    </section>
    <div class="section-head">
      <h2>Расходы на материалы</h2>
      <button class="btn small secondary" data-act="new-expense">${icon('plus')} Добавить</button>
    </div>
    ${expenses.length ? `<section class="card list">${expenses.map(e => `
      <button class="exp" data-act="open-expense" data-id="${esc(e.id)}">
        <span><b>${esc(e.note || 'Материалы')}</b><small>${L.shortDate(e.date)}</small></span>
        <b>${L.formatMoney(e.amount)}</b>
      </button>`).join('')}</section>` : '<div class="empty"><p>В этом месяце расходов на материалы нет</p></div>'}`;
}

function openExpense(id) {
  pushSheet(() => drawExpense(id));
}

function drawExpense(id) {
  const src = id ? data.expenses.find(e => e.id === id) : null;
  const defaultDate = ui.finMonth === L.monthOf(today()) ? today() : `${ui.finMonth}-01`;
  const e = src || { date: defaultDate, amount: 0, note: '' };
  sheetHtml(src ? 'Расход' : 'Расход на материалы', `
    <form id="exp-form" class="sheet-body" novalidate autocomplete="off">
      <label>Сумма, ₸<input name="amount" class="money" inputmode="numeric" enterkeyhint="done" value="${L.formatAmount(e.amount)}" placeholder="0"></label>
      <label>Что купили<input name="note" value="${esc(e.note)}" enterkeyhint="done" placeholder="Гель-лаки, пилки, фрезы…"></label>
      <label>Дата<input type="date" name="date" value="${esc(e.date)}"></label>
      <button type="submit" class="btn primary block">Сохранить</button>
      ${src ? `<button type="button" class="btn danger block" data-act="delete-expense" data-id="${esc(src.id)}">Удалить расход</button>` : ''}
    </form>`);
  const form = $('#exp-form');
  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    const rec = { date: field(form, 'date').value, amount: L.toMoney(field(form, 'amount').value), note: field(form, 'note').value.trim() };
    if (!rec.amount) return toast('Укажите сумму');
    if (!rec.date) return toast('Укажите дату');
    if (src) Object.assign(src, rec);
    else data.expenses.push({ id: uid(), ...rec });
    if (!(await save())) return;
    ui.finMonth = L.monthOf(rec.date);
    closeSheet();
    render();
    toast('Расход сохранён');
  });
}

// ---------- Настройки ----------

function renderSettings() {
  setHeader();
  const s = settings();
  const rent = L.rentFor(data.rent, L.monthOf(today()));
  view.innerHTML = `
    <section class="card">
      <h2>Облако и заявки</h2>
      ${cloud.key ? cloudPairedHtml() : `
      <p class="hint">Подключите телефон к облаку: записи и фото будут сохраняться сами после каждого изменения, клиенты смогут оставлять заявки по ссылке, а вам будут приходить уведомления. Если телефон потеряется — подключите новый тем же кодом, и всё вернётся.</p>
      <label>Код доступа<input type="password" id="access-code" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Код, который вы задали"></label>
      <button class="btn primary block" data-act="pair">${icon('cloud')} Подключить</button>`}
    </section>

    <section class="card">
      <h2>Прайс</h2>
      <p class="hint">Цена подставляется в запись при выборе услуги, в записи её можно поменять. Клиенты видят эти цены по ссылке.</p>
      <div class="prices">${data.prices.map(p => `
        <div class="price-row">
          <input value="${esc(p.name)}" placeholder="Название услуги" enterkeyhint="done" data-change="price-name" data-id="${esc(p.id)}" aria-label="Услуга">
          <div class="money-wrap">
            <input class="money" inputmode="numeric" enterkeyhint="done" value="${L.formatAmount(p.price)}" placeholder="0" data-change="price" data-id="${esc(p.id)}" aria-label="Цена, тенге"><span>₸</span>
          </div>
          <button class="icon-btn" data-act="price-del" data-id="${esc(p.id)}" aria-label="Удалить услугу">${icon('close')}</button>
        </div>`).join('')}
      </div>
      <button class="btn small secondary" data-act="price-add">${icon('plus')} Добавить услугу</button>
    </section>

    <section class="card">
      <h2>Рабочее время</h2>
      <div class="row2">
        <label>Первая запись с<input type="time" value="${esc(s.dayStart)}" data-change="set-dayStart"></label>
        <label>Последняя запись в<input type="time" value="${esc(s.lastStart)}" data-change="set-lastStart"></label>
      </div>
      <label>Между записями<select data-change="set-duration">${[60, 90, 120, 150, 180, 210, 240].map(m => `
        <option value="${m}"${m === s.duration ? ' selected' : ''}>${L.formatDuration(m)}</option>`).join('')}
      </select></label>
      <p class="hint" id="duration-hint">${durationHint(s.duration)}</p>
    </section>

    <section class="card">
      <h2>Ссылка для клиентов</h2>
      <p class="hint">По ссылке клиенты видят свободное время на 30 дней вперёд, выбирают время и услуги и оставляют заявку. Имена и телефоны других клиентов там не видны.</p>
      <div class="link-box">${esc(clientLink())}</div>
      <div class="btn-row">
        <button class="btn small secondary" data-act="share-link">${icon('share')} Поделиться</button>
        <button class="btn small secondary" data-act="copy-link">${icon('link')} Скопировать</button>
      </div>
      <label>Имя для клиентов<input value="${esc(s.clientName)}" enterkeyhint="done" data-change="set-clientName"></label>
      <label>WhatsApp мастера<input type="tel" value="${esc(L.phoneFieldStart(s.whatsapp))}" enterkeyhint="done" data-change="set-whatsapp"></label>
      <p class="hint">Клиенты увидят кнопку «Написать мастеру» с этим номером.</p>
      ${cloud.key ? '' : '<p class="status warn">Заявки начнут приходить после подключения облака.</p>'}
    </section>

    <section class="card">
      <h2>Аренда</h2>
      <div class="price-row">
        <span class="grow">Каждый месяц</span>
        <div class="money-wrap">
          <input class="money" inputmode="numeric" enterkeyhint="done" value="${L.formatAmount(rent)}" placeholder="0" data-change="rent" aria-label="Аренда в месяц, тенге"><span>₸</span>
        </div>
      </div>
      <p class="hint">Новая сумма действует с текущего месяца, прошлые месяцы не меняются.</p>
    </section>

    <section class="card">
      <h2>Оформление</h2>
      <div class="themes" role="group" aria-label="Тема">${Object.entries(L.THEMES).map(([id, name]) => `
        <button type="button" class="theme-pick${s.theme === id ? ' on' : ''}" data-act="set-theme" data-value="${id}" aria-pressed="${s.theme === id}">
          <span class="swatch" data-theme="${id}"></span>${name}
        </button>`).join('')}
      </div>
      <p class="hint">Тёмный режим для вечера — кнопка с луной вверху справа.</p>
    </section>

    <section class="card">
      <h2>Архив на телефон</h2>
      <p class="hint">${cloud.key ? 'Облако сохраняет всё само. Архив — дополнительная копия файлом, на всякий случай.' : 'Пока облако не подключено, раз в неделю сохраняйте архив — например, отправьте файл себе в Telegram.'}</p>
      <p>Последний архив: <b>${data.lastBackup ? formatDate(data.lastBackup) : 'ещё не сохраняли'}</b></p>
      <button class="btn secondary block" data-act="backup">Сохранить архив</button>
      <label class="btn secondary block">Восстановить из архива<input type="file" class="file-input" accept=".zip,.json,application/zip,application/json" data-change="restore"></label>
    </section>

    <p class="version">${APP_NAME} · версия ${APP_VERSION}</p>`;
}

function cloudPairedHtml() {
  const pushState = !('Notification' in window) ? 'unsupported' : Notification.permission === 'granted' && cloud.pushOn ? 'on' : 'off';
  return `
    <div id="cloud-status">${cloudStatusHtml()}</div>
    <div class="cloud-line">
      ${icon('bell')}
      <span class="grow">Уведомления о заявках: <b>${pushState === 'on' ? 'включены' : 'выключены'}</b></span>
    </div>
    ${pushState === 'on' ? '' : `<button class="btn primary block" data-act="enable-push">${icon('bell')} Включить уведомления</button>`}
    ${pushState === 'unsupported' ? `<p class="hint">${isIOS && !isStandalone() ? 'Уведомления работают, когда приложение открыто с экрана «Домой».' : 'Этот браузер не поддерживает уведомления.'}</p>` : ''}
    <div class="btn-row">
      <button class="btn small secondary" data-act="sync-now">Сохранить сейчас</button>
      <button class="btn small secondary" data-act="cloud-restore">Восстановить из облака</button>
      <button class="btn small ghost" data-act="unpair">Отключить</button>
    </div>`;
}

function cloudStatusHtml() {
  if (syncing) return '<p class="status">Сохраняем в облако…</p>';
  if (cloud.error) return `<p class="status bad">Не удалось сохранить: ${esc(cloud.error)}. Попробуем снова.</p>`;
  return `<p class="status ok">${icon('cloud')} Всё сохранено в облаке${cloud.savedAt ? ` · ${formatDateTime(cloud.savedAt)}` : ''}</p>`;
}

function showCloudStatus() {
  const box = $('#cloud-status');
  if (box) box.innerHTML = cloudStatusHtml();
}

function durationHint(duration) {
  return `Например, клиент записан на 12:00 — следующему приложение предложит время не раньше ${L.shortTime(L.fromMinutes(12 * 60 + duration))}.`;
}

function clientLink() {
  return new URL('okna/', location.href.split('#')[0].split('?')[0]).href;
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
    throw new Error('нет связи с облаком');
  }
  if (res.ok) return res;
  let message = `ошибка ${res.status}`;
  try { message = (await res.json()).error || message; } catch (e) { /* не JSON */ }
  if (res.status === 401 && cloud.key) {
    // Этот телефон отключили (например, подключили другой) — забываем ключ.
    cloud = freshCloud();
    await dbSet('cloud', cloud).catch(() => {});
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
const dataPrint = d => sha256(JSON.stringify([d.appointments, d.expenses, d.prices, d.rent, d.settings, d.blocks, d.clients]));

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
  toast('Загружаем данные из облака…');
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
    prices: copy.prices.length ? copy.prices : freshData().prices,
    rent: copy.rent,
    settings: copy.settings,
    blocks: copy.blocks,
    clients: copy.clients,
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
  toast(missing ? `Данные восстановлены, но ${missing} фото не загрузились` : 'Данные восстановлены из облака');
  scheduleSync(500);
}

async function pairDevice() {
  const code = $('#access-code').value.trim();
  if (code.length < 8) return toast('Код доступа — не короче 8 символов');
  const key = L.bytesToB64u(crypto.getRandomValues(new Uint8Array(32)));
  let res, body = {};
  try {
    res = await fetch(`${API}/api/pair`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, key, name: 'Телефон мастера' }) });
    body = await res.json().catch(() => ({}));
  } catch (e) {
    return toast('Нет связи с облаком. Проверьте интернет');
  }
  if (!res.ok) return toast(body.error || 'Не удалось подключить');
  cloud = { ...freshCloud(), key, pushKey: body.pushKey };
  await dbSet('cloud', cloud).catch(() => {});

  // Новый телефон: если в облаке есть копия — предлагаем восстановить её.
  let remote = null;
  try {
    remote = await fetchCloudBackup();
  } catch (e) { /* покажем ниже как ошибку сохранения */ }
  if (remote && (remote.copy.appointments.length || remote.copy.clients.length)) {
    const n = remote.copy.appointments.length;
    const question = data.appointments.length
      ? `В облаке есть копия от ${formatDateTime(remote.created)}: ${n} ${L.plural(n, RECORD_FORMS)}. Заменить данные этого телефона копией из облака? «Отмена» — оставить данные телефона и сохранить их в облако.`
      : `В облаке есть копия от ${formatDateTime(remote.created)}: ${n} ${L.plural(n, RECORD_FORMS)}. Восстановить её на этом телефоне?`;
    if (confirm(question)) {
      await applyCloudBackup(remote.copy);
      return;
    }
  }
  render();
  toast('Телефон подключён к облаку');
  syncNow();
}

async function restoreFromCloud() {
  let remote;
  try {
    remote = await fetchCloudBackup();
  } catch (e) {
    return toast(`Не удалось загрузить: ${e.message}`);
  }
  if (!remote) return toast('В облаке пока нет копии');
  const n = remote.copy.appointments.length;
  if (!confirm(`Восстановить копию из облака от ${formatDateTime(remote.created)} (${n} ${L.plural(n, RECORD_FORMS)})? Данные на телефоне заменятся.`)) return;
  await applyCloudBackup(remote.copy);
}

// Включение уведомлений: запрос разрешения должен идти сразу после нажатия (требование iOS).
async function enablePush() {
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return toast(isIOS && !isStandalone() ? 'Уведомления работают, когда приложение открыто с экрана «Домой»' : 'Этот браузер не поддерживает уведомления');
  }
  let permission = 'denied';
  try {
    permission = await Notification.requestPermission();
  } catch (e) { /* ниже — понятное сообщение */ }
  if (permission !== 'granted') {
    return toast('Уведомления не разрешены. Их можно включить: Настройки iPhone → Уведомления → это приложение');
  }
  try {
    await subscribePush();
    cloud.pushOn = true;
    await dbSet('cloud', cloud).catch(() => {});
    render();
    toast('Уведомления о заявках включены');
  } catch (e) {
    toast(`Не удалось включить уведомления: ${e.message}`);
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
  await api('PUT', '/api/push', sub.toJSON());
}

async function unpair() {
  if (!confirm('Отключить этот телефон от облака? Данные на телефоне останутся, но перестанут сохраняться в облако, а заявки — приходить.')) return;
  cloud = freshCloud();
  requests = [];
  updateBadge();
  await dbSet('cloud', cloud).catch(() => {});
  render();
}

// ---------- Архив на телефон: ZIP с data.json и фото ----------

let pendingBackup = null;

// Сначала собираем файл, потом отдельной кнопкой отправляем: iOS разрешает
// «Поделиться» только сразу после нажатия, а сборка с фото занимает время.
async function prepareBackup() {
  toast('Готовим архив…');
  const files = [{ name: 'data.json', data: new TextEncoder().encode(JSON.stringify(L.makeBackup(data))) }];
  for (const a of data.appointments) {
    for (const id of a.photos || []) {
      const rec = await dbGet('photo:' + id).catch(() => null);
      if (rec) files.push({ name: `photos/${id}.jpg`, data: new Uint8Array(rec.data) });
    }
  }
  pendingBackup = new File([makeZip(files)], `nailapp-${today()}.zip`, { type: 'application/zip' });
  const n = data.appointments.length, photos = files.length - 1;
  pushSheet(() => sheetHtml('Архив', `
    <div class="sheet-body">
      <p class="lead">Архив готов: ${n} ${L.plural(n, RECORD_FORMS)}, ${photos} фото, ${formatSize(pendingBackup.size)}.</p>
      <p class="hint">Отправьте файл себе в Telegram или WhatsApp либо сохраните в «Файлы». Восстановить: «Настройки» → «Восстановить из архива».</p>
      <button class="btn primary block" data-act="send-backup">${icon('share')} Отправить или сохранить</button>
    </div>`));
}

async function sendBackup() {
  const file = pendingBackup;
  if (!file) return;
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: `Архив: ${APP_NAME}` });
    else downloadFile(file);
  } catch (e) {
    if (e.name !== 'AbortError') toast('Не удалось сохранить архив');
    return;
  }
  pendingBackup = null;
  data.lastBackup = new Date().toISOString();
  await save();
  closeSheet();
  render();
  toast('Архив сохранён');
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
      if (!json) throw new Error('В архиве нет записей');
      copy = L.readBackup(await json.blob.text());
      photos = entries.filter(e => /^photos\/[\w-]+\.jpg$/.test(e.name));
    } else {
      copy = L.readBackup(await file.text()); // старая копия без фото
    }
  } catch (e) {
    return toast(e.message);
  }
  const when = copy.exportedAt ? ` от ${formatDate(copy.exportedAt)}` : '';
  const count = `${copy.appointments.length} ${L.plural(copy.appointments.length, RECORD_FORMS)}${photos.length ? ` и ${photos.length} фото` : ''}`;
  if (!confirm(`Восстановить архив${when}? В нём ${count}. Текущие данные в приложении заменятся.`)) return;
  toast('Восстанавливаем…');
  try {
    for (const p of photos) {
      const id = p.name.slice(7, -4);
      await dbSet('photo:' + id, { type: 'image/jpeg', data: await p.blob.arrayBuffer(), created: null });
    }
  } catch (e) {
    return toast('Не хватило места для фото');
  }
  data = {
    appointments: copy.appointments,
    expenses: copy.expenses,
    prices: copy.prices.length ? copy.prices : freshData().prices,
    rent: copy.rent,
    settings: copy.settings,
    blocks: copy.blocks,
    clients: copy.clients,
    lastBackup: copy.exportedAt,
  };
  if (!(await save())) return;
  await cleanupPhotos();
  render();
  toast('Данные восстановлены');
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
      <button type="button" class="icon-btn" data-act="close-sheet" aria-label="Закрыть">${icon('close')}</button>
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
  'delete-client': async el => {
    if (!confirm('Удалить клиента из списка?')) return;
    data.clients = (data.clients || []).filter(c => c.id !== el.dataset.id);
    if (!(await save())) return;
    closeSheet();
    render();
    toast('Клиент удалён');
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
    if (!confirm('Удалить эту запись вместе с её фото?')) return;
    const a = data.appointments.find(x => x.id === el.dataset.id);
    data.appointments = data.appointments.filter(x => x !== a);
    if (!(await save())) return;
    for (const id of (a && a.photos) || []) {
      await dbDel('photo:' + id).catch(() => {});
      forgetPhoto(id);
    }
    closeSheet();
    render();
    toast('Запись удалена');
  },
  'open-request': el => openRequest(el.dataset.id),
  'send-confirmation': el => sendConfirmation(el.dataset.id),
  'copy-booking': async el => {
    try {
      await navigator.clipboard.writeText(el.dataset.link);
      toast('Ссылка скопирована');
    } catch (e) {
      toast('Не удалось скопировать — выделите ссылку пальцем');
    }
  },
  'confirm-request': el => confirmRequest(el.dataset.id),
  'decline-request': el => declineRequest(el.dataset.id),
  'open-client': el => openClient(el.dataset.key),
  'view-photo': el => openViewer(el),
  'close-viewer': () => hideViewer(),
  'share-photo': () => sharePhoto(),
  'delete-photo': () => deletePhoto(),
  'new-block': el => openBlock(null, el.dataset.day),
  'edit-block': el => openBlock(el.dataset.id),
  'delete-block': async el => {
    if (!confirm('Открыть запись в эти дни снова?')) return;
    data.blocks = data.blocks.filter(b => b.id !== el.dataset.id);
    if (!(await save())) return;
    closeSheet();
    render();
    toast('Запись снова открыта');
  },
  'fin-month': el => { ui.finMonth = L.addMonths(ui.finMonth, Number(el.dataset.delta)); render(); },
  'new-expense': () => openExpense(null),
  'open-expense': el => openExpense(el.dataset.id),
  'delete-expense': async el => {
    if (!confirm('Удалить этот расход?')) return;
    data.expenses = data.expenses.filter(e => e.id !== el.dataset.id);
    await save();
    closeSheet();
    render();
    toast('Расход удалён');
  },
  'price-add': async () => {
    data.prices.push({ id: uid(), name: '', price: 0 });
    await save();
    render();
    const inputs = view.querySelectorAll('[data-change="price-name"]');
    inputs[inputs.length - 1].focus();
  },
  'price-del': async el => {
    const p = data.prices.find(x => x.id === el.dataset.id);
    if (!p || !confirm(`Удалить «${p.name || 'услугу без названия'}» из прайса? Старые записи не изменятся.`)) return;
    data.prices = data.prices.filter(x => x !== p);
    await save();
    render();
  },
  'share-link': async () => {
    const url = clientLink();
    if (!navigator.share) return actions['copy-link']();
    try {
      await navigator.share({ title: 'Запись на маникюр', url });
    } catch (e) { /* отменили */ }
  },
  'copy-link': async () => {
    try {
      await navigator.clipboard.writeText(clientLink());
      toast('Ссылка скопирована');
    } catch (e) {
      toast('Не удалось скопировать — выделите ссылку пальцем');
    }
  },
  'pair': () => pairDevice(),
  'unpair': () => unpair(),
  'enable-push': () => enablePush(),
  'sync-now': () => {
    cloud.backupPrint = '';
    cloud.schedulePrint = '';
    syncNow();
  },
  'cloud-restore': () => restoreFromCloud(),
  'backup': () => prepareBackup(),
  'send-backup': () => sendBackup(),
  'goto': el => { ui.tab = el.dataset.to; render(); scrollTo(0, 0); },
  'install': async () => {
    if (!installEvent) return;
    installEvent.prompt();
    await installEvent.userChoice;
    installEvent = null;
    render();
  },
  'hide-install': () => { pref('installHidden', '1'); render(); },
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
};

async function onChange(el) {
  const p = data.prices.find(x => x.id === el.dataset.id);
  const s = settings();
  switch (el.dataset.change) {
    case 'price-name':
      if (p) { p.name = el.value.trim(); if (await save()) toast('Прайс сохранён'); }
      break;
    case 'price':
      if (p) { p.price = L.toMoney(el.value); if (await save()) toast('Прайс сохранён'); }
      break;
    case 'rent':
      data.rent = L.setRent(data.rent, L.monthOf(today()), L.toMoney(el.value));
      if (await save()) toast('Аренда сохранена');
      break;
    case 'set-dayStart':
    case 'set-lastStart': {
      const next = { ...s, [el.dataset.change.slice(4)]: el.value };
      if (!el.value || L.toMinutes(next.dayStart) >= L.toMinutes(next.lastStart)) {
        el.value = s[el.dataset.change.slice(4)];
        return toast('Первая запись должна быть раньше последней');
      }
      data.settings = next;
      if (await save()) toast('Рабочее время сохранено');
      break;
    }
    case 'set-duration':
      data.settings = { ...s, duration: Number(el.value) };
      $('#duration-hint').textContent = durationHint(data.settings.duration);
      if (await save()) toast('Сохранено');
      break;
    case 'set-clientName':
      data.settings = { ...s, clientName: el.value.trim() };
      if (await save()) toast('Сохранено');
      break;
    case 'set-whatsapp':
      data.settings = { ...s, whatsapp: L.phoneFromField(el.value) };
      el.value = L.phoneFieldStart(data.settings.whatsapp);
      if (await save()) toast('Сохранено');
      break;
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

addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  installEvent = e;
  if (data && ui.tab === 'records') render();
});

addEventListener('appinstalled', () => {
  installEvent = null;
  if (data) render();
});

addEventListener('online', () => scheduleSync(500));

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !data) return;
  scheduleSync(800);
  // Приложение могли не закрывать несколько дней: «сегодня» должно сдвинуться.
  const t = today();
  if (t === ui.seenToday) return;
  if (ui.day === ui.seenToday) { ui.day = t; ui.month = L.monthOf(t); }
  if (ui.finMonth === L.monthOf(ui.seenToday)) ui.finMonth = L.monthOf(t);
  ui.seenToday = t;
  if (sheet.hidden) render();
});

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
  render();
  if (migrated) save();
  // Ключ GitHub от прежней версии больше не нужен — удаляем его с телефона.
  if (!storageBroken) dbDel('publish').catch(() => {});

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
    navigator.serviceWorker.addEventListener('message', e => {
      if (!e.data) return;
      if (e.data.type === 'open-requests') showRequests();
      if (e.data.type === 'new-request') loadRequests().catch(() => {});
    });
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  const params = new URLSearchParams(location.search);
  if (params.has('open')) {
    history.replaceState(history.state, '', location.pathname);
    if (params.get('open') === 'requests' && cloud.key) showRequests();
  }
  // Подписка на уведомления могла обновиться (например, после перезагрузки iPhone).
  if (cloud.key && cloud.pushOn && 'Notification' in window && Notification.permission === 'granted') {
    subscribePush().catch(() => {});
  }
  scheduleSync(1000);
}

start();
