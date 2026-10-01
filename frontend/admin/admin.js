// Страница администратора Beautybook (до 2.4.0 — Nailapp). Разделы, в которые проваливаешься, как «Настройки»
// в приложении: «Мастера» (поиск, сортировка, карточка мастера: анкета, записи по месяцам, подписка, сброс
// пароля), «Подписки» (календарь по месяцам: галочка «оплата получена» продлевает доступ на месяц или год,
// шкала до конца подписки, сортировка), «Чат с мастерами», «Уведомления» (с 2.5.0: на телефон администратора —
// сообщения мастеров, новые мастера, «Я оплатил(а)», утренняя сводка по подпискам), «Сервер» (шкалы загрузки, место по мастерам),
// «WhatsApp для мастеров» (куда пишут через «Забыли пароль?»), «Вход по Face ID». Назад — кнопкой «‹»
// или жестом браузера: каждый раздел — запись в истории (history.pushState).
//
// Вход — код администратора (секрет ADMIN_CODE на сервере, а если он не задан — ACCESS_CODE)
// или Face ID / код-пароль телефона (WebAuthn), если администратор включил его на этом устройстве:
// тогда Face ID спрашивается сразу при открытии страницы.
// Ни код, ни вход по Face ID нигде не сохраняются: только в памяти открытой страницы.
//
// Временный пароль придумывает эта страница и «растягивает» его так же, как телефон
// мастера (L.passwordSecret): на сервер уходит только результат.

import * as L from '../logic.js';
import { API_URL, PUBLIC_URL, IS_LOCAL } from '../config.js';
import { phoneMask } from '../phone-input.js';

phoneMask();

let API = API_URL;
try { API = localStorage.getItem('kae:api') || API_URL; } catch (e) { /* приватный режим */ }

const $ = sel => document.querySelector(sel);
const view = $('#view');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const ICONS = {
  calendar: '<rect x="3" y="4.5" width="18" height="16.5" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20.5c.8-3.6 3.3-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M15.5 4.8a3.5 3.5 0 0 1 0 6.4M17.5 15.2c2 .6 3.4 2.4 4 5.3"/>',
  cloud: '<path d="M7 18.5a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.6 1.6 3.8 3.8 0 0 1-.5 7.4z"/>',
  chat: '<path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.6L3 21l1.9-5.4A8.5 8.5 0 1 1 21 11.5z"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  left: '<path d="M15 5l-7 7 7 7"/>',
  right: '<path d="M9 5l7 7-7 7"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2.5"/><path d="M15.5 8.5V6a2.5 2.5 0 0 0-2.5-2.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  instagram: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r=".4"/>',
  bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
};
const icon = name => `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

let code = '';
let session = ''; // вход по Face ID: сеанс на 12 часов
let masters = [];
let dbSize = null; // размер всей базы, байт
let contact = '';
let passkeys = [];
let query = '';
let today = ''; // сегодня по Алматы — с сервера
let subMonth = ''; // месяц в «Подписках», YYYY-MM
let statMonth = ''; // месяц, за который в списке мастеров показаны записи
let masterSort = 'created'; // список мастеров: created | total | link | clients
let subSort = 'created'; // «Подписки»: created | left
let paying = ''; // мастер, которому в «Подписках» выбирают срок оплаты (месяц или год)
let usage = null; // нагрузка за сутки — снимок последней проверки сервера (backend/monitor.mjs)
let chats = null; // переписки с мастерами: последнее сообщение и непрочитанные
let messages = []; // сообщения открытого чата
let chatTimer = null;
let pushInfo = null; // уведомления администратору: { key — ключ сервера, devices — устройства с уведомлениями }
let myEndpoint; // подписка этого устройства: undefined — ещё не проверили, null — нет

// Нажали на уведомление: адрес ?open=chat|master|subs&m=<мастер>. Сначала вход, потом — нужный раздел.
const startParams = new URLSearchParams(location.search);
let pendingOpen = startParams.get('open') ? { page: startParams.get('open'), id: startParams.get('m') || '' } : null;
if (location.search) history.replaceState(null, '', location.pathname);

// Свой Service Worker (область admin/) — только для уведомлений администратору.
const swReady = 'serviceWorker' in navigator ? navigator.serviceWorker.register('sw.js', { scope: './' }).catch(() => null) : Promise.resolve(null);

// Где мы: '' — меню разделов; 'masters', 'master' (карточка masterId), 'subs', 'chats', 'chat' (переписка
// с masterId), 'server', 'contact', 'face'.
let page = '';
let masterId = '';
let resetNote = null; // временный пароль после сброса — показывается в карточке мастера один раз

// Face ID: вызов сервера готовим заранее — iPhone показывает Face ID, только если его
// попросили сразу по нажатию, без ожидания сети.
const canFace = Boolean(window.PublicKeyCredential && navigator.credentials);
let loginOptions = null;
let registerOptions = null;
const FRESH = 4 * 60e3; // вызов живёт на сервере 5 минут

async function request(method, path, body, auth) {
  const headers = auth ? { Authorization: auth } : {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let res;
  try {
    res = await fetch(API + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store' });
  } catch (e) {
    throw new Error('Нет связи. Проверьте интернет');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Ошибка ${res.status}`);
  return data;
}

const call = (method, path, body) => request(method, path, body,
  session ? `Session ${session}` : `Admin ${L.bytesToB64u(new TextEncoder().encode(code))}`);

function formatDate(iso) {
  const d = new Date(iso);
  return isNaN(d) ? '' : `${d.getDate()} ${L.MONTHS_GEN[d.getMonth()]} ${d.getFullYear()}`;
}

const bytes = b64u => L.b64uToBytes(b64u);
const b64 = buffer => L.bytesToB64u(new Uint8Array(buffer));

function deviceName() {
  const ua = navigator.userAgent;
  const kind = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? 'iPad'
    : /Macintosh/.test(ua) ? 'Mac' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : 'Компьютер';
  return `${kind}, ${formatDate(new Date().toISOString())}`;
}

// ---------- Вход ----------

function renderLogin(error = '', auto = false) {
  code = '';
  session = '';
  page = '';
  stopChat();
  view.innerHTML = `
    <h2 class="page-title">Администратор</h2>
    <form class="card page-card" id="code-form" novalidate>
      <p class="hint">Здесь видны все мастера Beautybook: подписки, записи, чат с мастерами, сброс забытого пароля.</p>
      <label>Код администратора<input type="password" name="code" autocomplete="current-password"></label>
      ${error ? `<p class="warn-text">${esc(error)}</p>` : ''}
      <button type="submit" class="btn primary block">Войти</button>
      <button type="button" class="btn small ghost face-small" id="face-login" hidden>${icon('lock')} Войти по Face ID</button>
      <p class="warn-text" id="face-error" hidden></p>
    </form>`;
  $('#code-form').addEventListener('submit', e => {
    e.preventDefault();
    code = e.target.elements.code.value.trim();
    load(true);
  });
  $('#face-login').addEventListener('click', () => faceLogin());
  prepareFaceLogin(auto);
}

// Есть ли для этого адреса вход по Face ID — тогда показываем маленькую кнопку и готовим вызов.
// auto — страницу только что открыли: Face ID спрашиваем сразу, без нажатия (просьба администратора).
// Если браузер без нажатия спросить не даст или вход отменят, останутся кнопка и код.
async function prepareFaceLogin(auto = false) {
  loginOptions = null;
  if (!canFace) return;
  try {
    const options = await request('POST', '/api/admin/passkey/login-options', {});
    if (!options.available) return;
    loginOptions = { ...options, at: Date.now() };
    const button = $('#face-login');
    if (!button) return;
    button.hidden = false;
    if (auto && document.visibilityState === 'visible') faceLogin(true);
  } catch (e) { /* нет связи — остаётся вход по коду */ }
}

function faceError(text) {
  const box = $('#face-error');
  if (!box) return alert(text);
  box.textContent = text;
  box.hidden = !text;
}

async function faceLogin(auto = false) {
  const options = loginOptions;
  if (!options || Date.now() - options.at > FRESH) {
    faceError('Страница долго была открыта — нажмите «Войти по Face ID» ещё раз');
    prepareFaceLogin();
    return;
  }
  faceError('');
  let credential;
  try {
    credential = await navigator.credentials.get({
      publicKey: {
        challenge: bytes(options.challenge),
        rpId: options.rpId,
        allowCredentials: options.allow.map(id => ({ type: 'public-key', id: bytes(id) })),
        userVerification: 'required',
        timeout: options.timeout,
      },
    });
  } catch (e) {
    prepareFaceLogin();
    if (auto) return; // сам спросить не дали или отменили — есть кнопка и код
    return faceError(e.name === 'NotAllowedError' ? 'Вход по Face ID отменён или не прошёл — нажмите ещё раз или войдите по коду' : `Face ID не сработал: ${e.message}`);
  }
  try {
    const res = await request('POST', '/api/admin/passkey/login', {
      id: b64(credential.rawId),
      clientDataJSON: b64(credential.response.clientDataJSON),
      authenticatorData: b64(credential.response.authenticatorData),
      signature: b64(credential.response.signature),
    });
    session = res.token;
    load(true);
  } catch (e) {
    prepareFaceLogin();
    faceError(e.message);
  }
}

// Данные всех разделов. first — сразу после входа: открыть меню разделов.
async function load(first = false) {
  try {
    const list = await call('GET', '/api/admin/masters');
    masters = list.masters;
    dbSize = list.size;
    usage = list.usage || null;
    today = list.today || L.ymd(new Date());
    if (!subMonth) subMonth = L.monthOf(today);
    if (!statMonth) statMonth = L.monthOf(today);
    try {
      contact = (await (await fetch(`${API}/api/contact`, { cache: 'no-store' })).json()).whatsapp || '';
    } catch (e) { /* покажем пустое поле */ }
    try {
      passkeys = (await call('GET', '/api/admin/passkeys')).passkeys;
    } catch (e) {
      passkeys = [];
    }
    try {
      pushInfo = await call('GET', '/api/admin/push');
    } catch (e) {
      pushInfo = null;
    }
  } catch (e) {
    renderLogin(e.message);
    return;
  }
  if (first) {
    page = '';
    history.replaceState({ page: '' }, '');
  }
  if (myEndpoint === undefined) await checkPush();
  render();
  if (first && pendingOpen) {
    const target = pendingOpen;
    pendingOpen = null;
    openTarget(target);
  }
}

// ---------- Разделы ----------

const SECTIONS = {
  masters: ['users', 'Мастера'],
  subs: ['calendar', 'Подписки'],
  chats: ['chat', 'Чат с мастерами'],
  push: ['bell', 'Уведомления'],
  server: ['cloud', 'Сервер'],
  contact: ['phone', 'WhatsApp для мастеров'],
  face: ['lock', 'Вход по Face ID'],
};

const unreadTotal = () => masters.reduce((n, m) => n + (m.unread || 0), 0);

function summary(id) {
  if (id === 'masters') return `${masters.length} · анкеты, записи по месяцам, сортировка`;
  if (id === 'subs') {
    const ym = L.monthOf(today);
    const paid = masters.filter(m => paidIn(m, ym).length).length;
    const off = masters.filter(m => !sub(m).unlimited && !L.subscriptionActive(sub(m), today)).length;
    return `оплатили в этом месяце: ${paid}${off ? ` · закончилась: ${off}` : ''}`;
  }
  if (id === 'chats') return unreadTotal() ? `новых сообщений: ${unreadTotal()}` : 'вопросы мастеров по оплате и приложению';
  if (id === 'server') return `загрузка ${loadLevel()[1]} · база ${dbSize ? size(dbSize) : '—'} из 500 МБ`;
  if (id === 'contact') return contact ? L.formatPhone(contact) : 'не указан — мастерам некуда писать';
  if (id === 'push') {
    const n = pushInfo ? pushInfo.devices.length : 0;
    return pushHere() ? 'включены на этом устройстве' : n ? `включены: ${n} ${L.plural(n, ['устройство', 'устройства', 'устройств'])}` : 'выключены';
  }
  if (id === 'face') return passkeys.length ? `включён: ${passkeys.length} ${L.plural(passkeys.length, ['устройство', 'устройства', 'устройств'])}` : 'выключен';
  return '';
}

// Провалиться в раздел (или карточку мастера) — запись в истории, чтобы «назад» работал и жестом.
function go(next, id = '') {
  page = next;
  masterId = id;
  resetNote = null;
  history.pushState({ page, masterId }, '');
  render('next');
  scrollTo(0, 0);
}

addEventListener('popstate', e => {
  if (!code && !session) return;
  const state = e.state || {};
  page = state.page || '';
  masterId = state.masterId || '';
  resetNote = null;
  if (page && !SECTIONS[page] && page !== 'master' && page !== 'chat') page = '';
  render('prev');
});

function render(anim) {
  const enter = anim ? ` enter-${anim}` : '';
  if (page !== 'chat') stopChat();
  if (!page) {
    view.innerHTML = `
      <div class="slide-clip"><div class="settings-home${enter}">
        <h2 class="page-title">Администратор</h2>
        <section class="card settings-menu">${Object.entries(SECTIONS).map(([id, [ic, title]]) => `
          <button class="menu-row" data-go="${id}">
            <span class="menu-ico">${icon(ic)}</span>
            <span class="grow"><b>${title}</b><small>${esc(summary(id))}</small></span>
            ${id === 'chats' && unreadTotal() ? `<i class="menu-badge">${unreadTotal()}</i>` : ''}${icon('right')}
          </button>`).join('')}
        </section>
        <button class="btn ghost block" id="leave">Выйти</button>
      </div></div>`;
    return;
  }
  const m = page === 'master' || page === 'chat' ? masters.find(x => x.id === masterId) : null;
  if ((page === 'master' || page === 'chat') && !m) {
    page = 'masters';
    return render();
  }
  const title = m ? esc(m.name || 'Без имени') : SECTIONS[page][1];
  const backTitle = page === 'chat' ? 'Назад' : m ? 'Мастера' : 'Администратор';
  view.innerHTML = `
    <div class="slide-clip"><div class="settings-page${enter}">
      <button class="back-link" data-back>${icon('left')} ${backTitle}</button>
      <h2 class="page-title">${title}</h2>
      ${page === 'chat' ? chatHtml() : m ? masterHtml(m) : page === 'masters' ? mastersHtml() : page === 'subs' ? subsHtml() : page === 'chats' ? chatsHtml()
        : page === 'push' ? pushHtml() : page === 'server' ? serverHtml() : page === 'contact' ? contactHtml() : faceHtml()}
    </div></div>`;
  if (page === 'chat') startChat();
  if (page === 'chats') loadChats();
  if (page === 'masters') {
    const search = $('#q');
    search.addEventListener('input', () => {
      query = search.value;
      $('#masters').innerHTML = rows();
    });
  }
  if (page === 'contact') $('#contact-form').addEventListener('submit', saveContact);
  const untilForm = $('#until-form');
  if (untilForm) untilForm.addEventListener('submit', saveUntil);
  if (page === 'face') prepareRegister();
}

// 1 234 567 байт → «1,2 МБ», 5 400 → «5 КБ».
function size(n) {
  n = Number(n) || 0;
  if (n < 1e6) return `${Math.max(n ? 1 : 0, Math.round(n / 1e3))} КБ`;
  return `${(n / 1e6).toFixed(1).replace('.', ',')} МБ`;
}

const total = st => (st ? st.photoBytes + st.backupBytes + st.otherBytes : 0);

function clientLink(m) {
  return `${new URL(IS_LOCAL ? '../okna/' : 'okna/', IS_LOCAL ? location.href : PUBLIC_URL).href}?m=${encodeURIComponent(m.slug)}`;
}

// ---------- Мастера ----------

const DAY_FORMS = ['день', 'дня', 'дней'];
const RECORD_FORMS = ['запись', 'записи', 'записей'];
const MASTER_SORTS = { created: 'Новые', total: 'Записи', link: 'По ссылке', clients: 'Клиенты' };
const SUB_SORTS = { created: 'По регистрации', left: 'По остатку подписки' };
const EMPTY_STAT = { total: 0, link: 0, manual: 0, clients: 0, sent: 0, confirmed: 0 };
const statOf = (m, ym) => ({ ...EMPTY_STAT, ...((m.stats || {})[ym] || {}) });
const monthShort = ym => `${L.MONTHS[Number(ym.slice(5)) - 1].slice(0, 3).toLowerCase()} ${ym.slice(2, 4)}`;

const sortChips = (kind, options, current) => `
  <div class="chips sort-chips" role="group" aria-label="Сортировка">${Object.entries(options).map(([id, title]) => `
    <button type="button" class="chip small${id === current ? ' on' : ''}" data-sort="${kind}:${id}" aria-pressed="${id === current}">${title}</button>`).join('')}
  </div>`;

const monthNav = (kind, ym) => `
  <div class="month-nav">
    <button class="icon-btn" data-month="-1" data-kind="${kind}" aria-label="Предыдущий месяц">${icon('left')}</button>
    <b>${L.monthTitle(ym)}</b>
    <button class="icon-btn" data-month="1" data-kind="${kind}" aria-label="Следующий месяц">${icon('right')}</button>
  </div>`;

// Поиск по имени, направлению, ссылке, адресу или цифрам номера (от 3 цифр).
// Сортировка: новые сверху; по принятым записям, по записям из заявок по ссылке (за выбранный месяц);
// по числу клиентов в базе мастера.
function rows() {
  const q = query.trim().toLowerCase();
  const qd = q.replace(/\D/g, '');
  const list = masters.filter(m => !q || m.name.toLowerCase().includes(q) || m.slug.includes(q) || (m.address || '').toLowerCase().includes(q)
    || (m.specialty || '').toLowerCase().includes(q) || (qd.length >= 3 && L.phoneDigits(m.phone).includes(qd)));
  const key = { total: m => statOf(m, statMonth).total, link: m => statOf(m, statMonth).link, clients: m => m.clients || 0 }[masterSort];
  const newest = (a, b) => b.created.localeCompare(a.created);
  list.sort(key ? (a, b) => key(b) - key(a) || newest(a, b) : newest);
  return list.map(m => {
    const st = statOf(m, statMonth);
    const about = [m.specialty, m.phone || 'номер не указан', shortAccess(m)].filter(Boolean).join(' · ');
    const nums = `${monthShort(statMonth)}: ${st.total} ${L.plural(st.total, RECORD_FORMS)}, по ссылке ${st.link} · клиентов ${m.clients || 0}`;
    return `
    <button class="menu-row" data-master="${esc(m.id)}">
      <span class="grow"><b>${esc(m.name || 'Без имени')}</b><small>${esc(about)}</small><small>${esc(nums)}</small></span>
      ${m.unread ? `<i class="menu-badge" aria-label="Новых сообщений: ${m.unread}">${m.unread}</i>` : ''}${icon('right')}
    </button>`;
  }).join('') || '<p class="hint list-empty">Никого не нашли</p>';
}

function mastersHtml() {
  return `
    <input type="search" id="q" class="search" placeholder="Имя, направление, номер или адрес" aria-label="Поиск мастера" value="${esc(query)}">
    ${sortChips('master', MASTER_SORTS, masterSort)}
    ${monthNav('stat', statMonth)}
    <section class="card settings-menu" id="masters">${rows()}</section>
    <p class="hint">Записи — принятые за месяц (без отменённых), «по ссылке» — из них пришедшие заявкой со страницы клиентов. Клиенты — все клиенты в базе мастера. Числа присылает приложение мастера при синхронизации.</p>`;
}

// Записи мастера по месяцам за год: принятые, заявки по ссылке (отправлено клиентами / принято), внесённые вручную.
function statsCard(m) {
  const now = L.monthOf(today);
  const months = Array.from({ length: 12 }, (_, i) => L.addMonths(now, -i));
  const lines = months.map(ym => {
    const st = statOf(m, ym);
    if (ym !== now && !st.total && !st.sent) return '';
    return `
        <tr><td>${esc(monthShort(ym))}</td><td>${st.total}</td><td>${st.sent}${st.link ? `<small>принято ${st.link}</small>` : ''}</td><td>${st.manual}</td></tr>`;
  }).join('');
  return `
    <section class="card page-card">
      <h3 class="card-title">Записи по месяцам</h3>
      <table class="stats-table">
        <thead><tr><th>Месяц</th><th>Записей</th><th>Заявок по ссылке</th><th>Внёс сам</th></tr></thead>
        <tbody>${lines}</tbody>
      </table>
      <p class="hint">Записей — принятые в этом месяце (без отменённых). Заявок по ссылке — сколько клиенты отправили со страницы записи; «принято» — сколько из них стали записями. Внёс сам — записи, которые мастер добавил в приложении. Откуда пришла запись, приложение помечает с версии 2.4.0 (октябрь 2026): более ранние записи считаются внесёнными самим мастером.</p>
    </section>`;
}

function masterHtml(m) {
  const st = m.storage || { photos: 0, photoBytes: 0, backups: 0, backupBytes: 0, otherBytes: 0 };
  const gis = L.gisLink(m.gis);
  const link = clientLink(m);
  if (resetNote && resetNote.id === m.id) {
    const text = `Здравствуйте, ${m.name}! Ваш временный пароль для входа в Beautybook: ${resetNote.temp}. Войдите по своему номеру ${m.phone} и смените пароль: «Настройки» → «Аккаунт» → «Сменить пароль».`;
    return `
      <section class="card page-card">
        <h3 class="card-title">Пароль сброшен</h3>
        <p>Временный пароль для <b>${esc(m.name)}</b> (${esc(m.phone)}):</p>
        <p class="temp-password">${esc(resetNote.temp)}</p>
        <p class="hint">Отправьте его мастеру. После входа мастер сменит пароль в «Настройки» → «Аккаунт». Второй раз этот пароль здесь не покажется.</p>
        <a class="btn primary block" href="https://wa.me/${L.phoneDigits(m.phone)}?text=${encodeURIComponent(text)}" target="_blank" rel="noopener">Отправить в WhatsApp</a>
      </section>`;
  }
  return `
    <section class="card page-card">
      <div class="line"><span>Направление</span><b>${esc(m.specialty || 'не указано')}</b></div>
      <div class="line"><span>Телефон</span><b>${esc(m.phone || 'не указан')}</b></div>
      <div class="line"><span>Kaspi для счёта</span><b>${m.kaspi ? `${esc(m.kaspi)} <button class="icon-btn copy-btn" data-copy="${esc(L.phoneDigits(m.kaspi).slice(-10))}" aria-label="Скопировать номер Kaspi">${icon('copy')}</button>` : 'не указан'}</b></div>
      <div class="line"><span>Клиентов в базе</span><b>${m.clients || 0}</b></div>
      <div class="line"><span>Зарегистрирован</span><b>${esc(formatDate(m.created))}</b></div>
      <div class="line"><span>Аккаунт</span><b>${m.claimed ? 'оформлен' : 'не оформлен'}</b></div>
      <div class="line"><span>Приложение</span><b>${m.devices ? 'подключено' : 'сейчас не в приложении'}</b></div>
      <div class="line"><span>Адрес</span><b>${esc(m.address || 'не указан')}</b></div>
      <div class="btn-row">
        ${gis ? `<a class="btn small secondary" href="${esc(gis)}" target="_blank" rel="noopener">Открыть в 2ГИС</a>` : ''}
        ${m.instagram ? `<a class="btn small secondary" href="https://www.instagram.com/${esc(m.instagram)}/" target="_blank" rel="noopener">${icon('instagram')} @${esc(m.instagram)}</a>` : ''}
        <button class="btn small secondary" data-chat="${esc(m.id)}">${icon('chat')} Написать${m.unread ? ` · ${m.unread}` : ''}</button>
      </div>
    </section>
    ${statsCard(m)}
    <section class="card page-card">
      <h3 class="card-title">Ссылка для клиентов</h3>
      <div class="link-box">${esc(link)}</div>
      <a class="btn small secondary" href="${esc(link)}" target="_blank" rel="noopener">Открыть</a>
    </section>
    ${subscriptionCard(m)}
    <section class="card page-card">
      <h3 class="card-title">Данные на сервере — ${size(total(st))}</h3>
      <div class="line"><span>Фото, ${st.photos} шт.</span><b>${size(st.photoBytes)}</b></div>
      <div class="line"><span>Копии данных, ${st.backups} шт.</span><b>${size(st.backupBytes)}</b></div>
      <div class="line"><span>Прочее (расписание, записи клиентов)</span><b>${size(st.otherBytes)}</b></div>
    </section>
    ${m.phone ? `<button class="btn secondary block" data-reset="${esc(m.id)}">Сбросить пароль</button>` : ''}`;
}

// ---------- Подписки ----------

const sub = m => m.subscription || { until: null, unlimited: false, periods: [] };
const fullDate = d => `${L.shortDate(d)} ${d.slice(0, 4)}`;
const almatyDate = iso => L.masterClock(-300, Date.parse(iso)).date; // когда отмечено — по Алматы
const PLAN_NAMES = { month: 'месяц', year: 'год' };

function accessText(m) {
  const s = sub(m);
  if (s.unlimited) return 'бессрочно';
  if (!s.until) return 'подписки нет';
  const left = L.subscriptionDaysLeft(s, today);
  if (left < 0) return `закончилась ${fullDate(s.until)} — доступ приостановлен`;
  return `доступ до ${fullDate(s.until)}${left <= 7 ? ` · осталось ${left} ${L.plural(left, DAY_FORMS)}` : ''}`;
}

function shortAccess(m) {
  const s = sub(m);
  if (s.unlimited) return 'бессрочно';
  if (!s.until) return '';
  return L.subscriptionActive(s, today) ? `до ${L.shortDate(s.until)}` : 'подписка закончилась';
}

// Оплаты, отмеченные в месяце ym, и дни доступа, которые на него приходятся.
const paidIn = (m, ym) => sub(m).periods.filter(p => p.kind === 'paid' && almatyDate(p.marked).startsWith(ym));
function coverage(m, ym) {
  const first = `${ym}-01`, last = L.addDays(L.addMonthsToDate(first, 1), -1);
  const ps = sub(m).periods.filter(p => p.from <= last && p.to >= first);
  if (!ps.length) return null;
  return { from: ps.map(p => p.from).sort()[0], to: ps.map(p => p.to).sort().pop() };
}

// Шкала из 10 овалов. Подписка: от красного к зелёному, каждый овал — 3 дня из последних 30;
// чем ближе конец, тем меньше горит овалов и тем они краснее. Нагрузка (rev): от зелёного к красному.
function pills(lit, label, rev = false) {
  return `<span class="pills${rev ? ' rev' : ''}" role="img" aria-label="${esc(label)}">${Array.from({ length: 10 }, (_, i) => `<i${i < lit ? ' class="on"' : ''}></i>`).join('')}</span>`;
}

const daysLeft = m => (sub(m).unlimited ? Infinity : sub(m).until ? L.subscriptionDaysLeft(sub(m), today) : -Infinity);

function subScale(m) {
  const left = daysLeft(m);
  if (left === Infinity) return `<div class="sub-scale">${pills(10, 'Доступ бессрочный')}<small>бессрочно</small></div>`;
  if (left < 0) return `<div class="sub-scale">${pills(0, 'Подписка закончилась')}<small>закончилась</small></div>`;
  const days = left + 1; // дней доступа, считая сегодняшний
  return `<div class="sub-scale">${pills(Math.min(10, Math.ceil(days / 3)), `Доступ до ${fullDate(sub(m).until)}`)}<small>до ${esc(sub(m).until.slice(0, 4) === today.slice(0, 4) ? L.shortDate(sub(m).until) : fullDate(sub(m).until))}</small></div>`;
}

// Галочку поставили — выбрать срок оплаты (тариф «Про»: месяц или год).
function planChoice(m) {
  const option = plan => {
    const t = L.TARIFF[plan], next = L.nextPeriod(sub(m).until, today, t.months);
    return `<button type="button" class="btn small ${plan === 'month' ? 'primary' : 'secondary'}" data-pay-plan="${plan}" data-id="${esc(m.id)}">${t.title} · ${L.formatMoney(t.price)} → до ${esc(fullDate(next.end))}</button>`;
  };
  return `
        <div class="plan-choice">
          <small>Оплата получена — за какой срок?</small>
          <div class="btn-row">${option('month')}${option('year')}<button type="button" class="btn small ghost" data-pay-plan="">Отмена</button></div>
        </div>`;
}

// Календарь по месяцам: все мастера, зарегистрированные к концу месяца, — по порядку регистрации
// или по остатку подписки (у кого кончается раньше — сверху). Галочка — оплата получена в этом месяце;
// ставить и снимать — только в текущем.
function subsHtml() {
  const current = subMonth === L.monthOf(today);
  const last = L.addDays(L.addMonthsToDate(`${subMonth}-01`, 1), -1);
  const list = masters.filter(m => almatyDate(m.created) <= last).sort((a, b) => a.created.localeCompare(b.created));
  if (subSort === 'left') list.sort((a, b) => daysLeft(a) - daysLeft(b) || a.created.localeCompare(b.created));
  const paidCount = list.filter(m => paidIn(m, subMonth).length).length;
  const income = list.reduce((sum, m) => sum + paidIn(m, subMonth).reduce((t, p) => t + (p.amount || 0), 0), 0);
  const rows = list.map(m => {
    const s = sub(m);
    const paid = paidIn(m, subMonth);
    const cov = coverage(m, subMonth);
    const status = s.unlimited ? 'бессрочно' : current ? accessText(m) : cov ? `доступ с ${L.shortDate(cov.from)} по ${fullDate(cov.to)}` : 'без доступа';
    const note = paid.length ? `оплата ${paid.map(p => `${L.shortDate(almatyDate(p.marked))}${p.plan ? ` за ${PLAN_NAMES[p.plan] || p.plan}` : ''}`).join(', ')}` : '';
    const off = !s.unlimited && current && !L.subscriptionActive(s, today);
    return `
      <div class="sub-row${off ? ' off' : ''}">
        <input type="checkbox" class="sub-check" data-pay="${esc(m.id)}" aria-label="Оплата от ${esc(m.name)} получена" ${paid.length ? 'checked' : ''} ${current && !s.unlimited ? '' : 'disabled'}>
        <div class="grow sub-main">
          <button class="sub-info" data-master="${esc(m.id)}"><b>${esc(m.name || 'Без имени')}</b><small>${esc([status, note].filter(Boolean).join(' · '))}</small></button>
          ${current ? subScale(m) : ''}
          ${current && paying === m.id ? planChoice(m) : ''}
        </div>
      </div>`;
  }).join('');
  return `
    ${monthNav('sub', subMonth)}
    ${sortChips('sub', SUB_SORTS, subSort)}
    <p class="hint">Оплатили${current ? ' в этом месяце' : ''}: ${paidCount} из ${list.length}${income ? ` · получено ${L.formatMoney(income)}` : ''}.</p>
    <section class="card list">${rows || '<p class="hint list-empty">В этом месяце мастеров ещё не было</p>'}</section>
    <p class="hint">Галочка — «оплата получена»: выберите срок — месяц (${L.formatMoney(L.TARIFF.month.price)}) или год (${L.formatMoney(L.TARIFF.year.price)}). Доступ продлится от конца текущего периода, а если он уже закончился — с сегодняшнего дня. Отметили по ошибке — снимите галочку. Шкала под мастером — сколько осталось до конца подписки: каждый овал — 3 дня, красные — конец близко. Отмечать можно в текущем месяце. Нажмите на мастера — там все его периоды, бессрочный доступ и дата окончания.</p>`;
}

// Подписка в карточке мастера: сейчас, все периоды, продлить, отменить, дата, бессрочно.
function subscriptionCard(m) {
  const s = sub(m);
  const kinds = { trial: 'пробный период', manual: 'изменено вручную' };
  const paidText = p => `оплата ${L.shortDate(almatyDate(p.marked))}${p.plan ? ` за ${PLAN_NAMES[p.plan] || p.plan}` : ''}${p.amount ? `, ${L.formatMoney(p.amount)}` : ''}`;
  const periods = [...s.periods].reverse().map(p => `
    <div class="line"><span>${esc(L.shortDate(p.from))} – ${esc(fullDate(p.to))}</span><b>${esc(p.kind === 'paid' ? paidText(p) : kinds[p.kind] || p.kind)}</b></div>`).join('');
  const hasPaid = s.periods.some(p => p.kind === 'paid');
  const extend = plan => {
    const t = L.TARIFF[plan], next = L.nextPeriod(s.until, today, t.months);
    return `<button class="btn ${plan === 'month' ? 'primary' : 'secondary'} block" data-sub="extend-${plan}">Оплата за ${PLAN_NAMES[plan]} (${L.formatMoney(t.price)}) — до ${esc(fullDate(next.end))}</button>`;
  };
  return `
    <section class="card page-card">
      <h3 class="card-title">Подписка</h3>
      <div class="line"><span>Сейчас</span><b>${esc(accessText(m))}</b></div>
      ${subScale(m)}
      ${periods}
      ${s.unlimited ? '' : extend('month') + extend('year')}
      ${hasPaid && !s.unlimited ? '<button class="btn ghost block" data-sub="undo">Отменить последнюю оплату</button>' : ''}
      ${s.unlimited ? '' : `
      <form id="until-form" class="until-form" novalidate>
        <label>Доступ до<input type="date" name="until" value="${esc(s.until || '')}"></label>
        <button type="submit" class="btn small secondary">Сохранить</button>
      </form>`}
      <button class="btn ghost block" data-sub="unlimited">${s.unlimited ? 'Отключить бессрочный доступ' : 'Сделать доступ бессрочным'}</button>
    </section>`;
}

async function changeSubscription(id, body) {
  try {
    await call('POST', `/api/admin/masters/${encodeURIComponent(id)}/subscription`, body);
  } catch (e) {
    return alert(e.message);
  }
  await load();
}

// Оплата получена: продлить на месяц или год (plan). Спрашиваем подтверждение в карточке мастера;
// в «Подписках» подтверждение — выбор срока после галочки.
async function extendSubscription(id, plan, ask = true) {
  const m = masters.find(x => x.id === id);
  const t = L.TARIFF[plan];
  if (!m || !t) return;
  const next = L.nextPeriod(sub(m).until, today, t.months);
  if (ask && !confirm(`Оплата от ${m.name} за ${PLAN_NAMES[plan]} (${L.formatMoney(t.price)}) получена? Доступ продлится до ${fullDate(next.end)}.`)) return;
  paying = '';
  return changeSubscription(id, { action: 'extend', plan });
}

// Сняли галочку — отменить последнюю отмеченную оплату.
async function undoPayment(id) {
  const m = masters.find(x => x.id === id);
  if (!m || !confirm(`Снять отметку об оплате от ${m.name}? Последняя отмеченная оплата отменится.`)) return;
  return changeSubscription(id, { action: 'undo' });
}

function subscriptionAction(action) {
  const m = masters.find(x => x.id === masterId);
  if (!m) return;
  const s = sub(m);
  if (action === 'extend-month') return extendSubscription(m.id, 'month');
  if (action === 'extend-year') return extendSubscription(m.id, 'year');
  if (action === 'undo') return undoPayment(m.id);
  if (action === 'unlimited') {
    const on = !s.unlimited;
    if (!confirm(on ? `Сделать доступ ${m.name} бессрочным? Подписка больше не будет заканчиваться.` : `Отключить бессрочный доступ ${m.name}? Доступ будет до ${s.until ? fullDate(s.until) : 'сегодня'}.`)) return;
    return changeSubscription(m.id, { action: 'unlimited', value: on });
  }
}

async function saveUntil(e) {
  e.preventDefault();
  const m = masters.find(x => x.id === masterId);
  const value = e.target.elements.until.value;
  if (!m || !value) return;
  const note = value < today ? ' Доступ сразу приостановится.' : '';
  if (!confirm(`Доступ ${m.name} — до ${fullDate(value)}?${note}`)) return;
  return changeSubscription(m.id, { action: 'until', value });
}

// ---------- Чат с мастерами ----------
// Мастер пишет из «Настройки» → «Чат с администратором»; ответ приходит ему уведомлением.
// Открытый чат проверяет новые сообщения раз в 10 секунд, пока страница на экране.

function chatsHtml() {
  return `
    <p class="hint">Вопросы мастеров по оплате, подписке и работе приложения. Ваш ответ придёт мастеру уведомлением. Написать первым можно из карточки мастера — кнопка «Написать».</p>
    <section class="card settings-menu" id="chats">${chatRows()}</section>`;
}

function chatRows() {
  if (!chats) return '<p class="hint list-empty">Загружаем…</p>';
  return chats.map(c => `
    <button class="menu-row" data-chat="${esc(c.masterId)}">
      <span class="grow"><b>${esc(c.name || 'Без имени')}</b><small>${esc(`${c.last.author === 'admin' ? 'Вы: ' : ''}${c.last.text}`)}</small></span>
      ${c.unread ? `<i class="menu-badge" aria-label="Новых сообщений: ${c.unread}">${c.unread}</i>` : ''}${icon('right')}
    </button>`).join('') || '<p class="hint list-empty">Сообщений пока нет</p>';
}

async function loadChats() {
  try {
    chats = (await call('GET', '/api/admin/chats')).chats;
  } catch (e) {
    const box = $('#chats');
    if (box && !chats) box.innerHTML = `<p class="hint list-empty">${esc(e.message)}</p>`;
    return;
  }
  for (const m of masters) {
    const c = chats.find(x => x.masterId === m.id);
    m.unread = c ? c.unread : 0;
  }
  const box = $('#chats');
  if (box) box.innerHTML = chatRows();
}

function formatTime(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return d.toLocaleString('ru-RU', { timeZone: 'Asia/Almaty', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
}

function bubbles() {
  if (!messages.length) return '<p class="hint chat-empty">Сообщений пока нет — напишите мастеру первым.</p>';
  return messages.map(x => `
    <div class="bubble ${x.author === 'admin' ? 'mine' : 'theirs'}">
      <p>${esc(x.text).replace(/\n/g, '<br>')}</p>
      <small>${esc(formatTime(x.created))}${x.author === 'admin' && x.seen ? ' · прочитано' : ''}</small>
    </div>`).join('');
}

function chatHtml() {
  return `
    <div class="chat" id="chat-list">${bubbles()}</div>
    <form id="chat-form" class="chat-form" novalidate>
      <textarea name="text" rows="2" maxlength="2000" placeholder="Сообщение мастеру" aria-label="Сообщение"></textarea>
      <button type="submit" class="btn primary">Отправить</button>
    </form>`;
}

function showMessages(list, scroll) {
  const box = $('#chat-list');
  if (!box) return;
  const atBottom = innerHeight + scrollY >= document.documentElement.scrollHeight - 80;
  messages = list;
  box.innerHTML = bubbles();
  if (scroll || atBottom) scrollTo(0, document.documentElement.scrollHeight);
}

async function loadMessages(first = false) {
  const id = masterId;
  try {
    const list = (await call('GET', `/api/admin/chats/${encodeURIComponent(id)}`)).messages;
    if (page !== 'chat' || masterId !== id) return;
    showMessages(list, first);
    const m = masters.find(x => x.id === id);
    if (m) m.unread = 0;
    if (chats) chats.forEach(c => { if (c.masterId === id) c.unread = 0; });
  } catch (e) {
    if (first) $('#chat-list').innerHTML = `<p class="hint chat-empty">${esc(e.message)}</p>`;
  }
}

function startChat() {
  messages = [];
  $('#chat-list').innerHTML = '<p class="hint chat-empty">Загружаем сообщения…</p>';
  const form = $('#chat-form');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const box = form.elements.text;
    const text = box.value.trim();
    if (!text) return;
    const button = form.querySelector('button');
    button.disabled = true;
    try {
      const list = (await call('POST', `/api/admin/chats/${encodeURIComponent(masterId)}`, { text })).messages;
      box.value = '';
      showMessages(list, true);
    } catch (err) {
      alert(err.message);
    } finally {
      button.disabled = false;
    }
  });
  loadMessages(true);
  stopChat();
  chatTimer = setInterval(() => {
    if (document.visibilityState === 'visible') loadMessages();
  }, 10000);
}

function stopChat() {
  clearInterval(chatTimer);
  chatTimer = null;
}

// ---------- Уведомления администратору (2.5.0) ----------
// На iPhone уведомления приходят странице, открытой с экрана «Домой» (iOS 16.4+), и разрешение
// спрашивается только сразу по нажатию — поэтому ключ сервера страница берёт заранее (load).

const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const pushHere = () => Boolean(myEndpoint && pushInfo && pushInfo.devices.some(d => d.endpoint === myEndpoint));

// Почему уведомления здесь не включить: '' — можно.
function pushBlocker() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return isIOS && !standalone() ? 'home' : 'browser';
  if (Notification.permission === 'denied') return 'denied';
  return '';
}

async function checkPush() {
  try {
    const reg = await swReady;
    const sub = reg && reg.pushManager ? await reg.pushManager.getSubscription() : null;
    myEndpoint = sub ? sub.endpoint : null;
  } catch (e) {
    myEndpoint = null;
  }
}

function pushHtml() {
  const devices = (pushInfo && pushInfo.devices) || [];
  const blocker = pushBlocker();
  const status = blocker === 'home'
    ? '<p class="status warn">На iPhone уведомления приходят, когда страница открыта с экрана «Домой»: в Safari нажмите «Поделиться» → «На экран „Домой“», откройте «BB Админ» с иконки и включите уведомления здесь.</p>'
    : blocker === 'browser' ? '<p class="status warn">Этот браузер не умеет получать уведомления.</p>'
    : blocker === 'denied' ? '<p class="status bad">Уведомления запрещены в настройках телефона: Настройки → Уведомления → BB Админ.</p>'
    : pushHere() ? `<p class="status ok">${icon('check')} Включены на этом устройстве</p>
      <button class="btn secondary block" data-push="test">Прислать пробное уведомление</button>
      <button class="btn ghost block" data-push="off">Выключить на этом устройстве</button>`
    : '<button class="btn primary block" data-push="on">Включить уведомления на этом устройстве</button>';
  return `
    <section class="card page-card">
      <p class="hint">Уведомления приходят на телефон, даже когда страница закрыта:</p>
      <ul class="terms-list">
        <li>мастер написал в чат;</li>
        <li>зарегистрировался новый мастер;</li>
        <li>мастер нажал «Я оплатил(а)» — проверьте Kaspi и отметьте оплату;</li>
        <li>каждое утро в 9:00 — у кого подписка кончается сегодня или завтра и у кого закончилась вчера.</li>
      </ul>
      ${status}
    </section>
    ${devices.length ? `
    <h3 class="section-title">Устройства с уведомлениями</h3>
    <section class="card list">${devices.map(d => `
      <div class="admin-master">
        <div class="grow"><b>${esc(d.name || 'Устройство')}${d.endpoint === myEndpoint ? ' · это устройство' : ''}</b><small>включены ${esc(formatDate(d.created))}</small></div>
        <button class="btn small ghost" data-push-remove="${esc(d.endpoint)}">Убрать</button>
      </div>`).join('')}
    </section>` : ''}`;
}

async function swRegistration() {
  const reg = await swReady;
  if (!reg) throw new Error('не удалось подключить уведомления — перезагрузите страницу');
  const worker = reg.active || reg.waiting || reg.installing;
  if (!reg.active && worker) {
    await new Promise(resolve => worker.addEventListener('statechange', () => worker.state === 'activated' && resolve()));
  }
  return reg;
}

// Разрешение спрашиваем первым делом, прямо по нажатию (иначе iPhone не покажет вопрос).
async function enablePush() {
  if (pushBlocker()) return render();
  let permission = 'denied';
  try {
    permission = await Notification.requestPermission();
  } catch (e) { /* ниже — понятное сообщение */ }
  if (permission !== 'granted') {
    render();
    return alert('Уведомления не разрешены. Их можно включить: Настройки → Уведомления → BB Админ');
  }
  try {
    const reg = await swRegistration();
    if (!pushInfo || !pushInfo.key) pushInfo = await call('GET', '/api/admin/push');
    let sub = await reg.pushManager.getSubscription();
    const current = sub && sub.options && sub.options.applicationServerKey;
    if (sub && current && L.bytesToB64u(new Uint8Array(current)) !== pushInfo.key) {
      await sub.unsubscribe(); // подписка на другой ключ сервера не подойдёт
      sub = null;
    }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: L.b64uToBytes(pushInfo.key) });
    pushInfo = await call('PUT', '/api/admin/push', { subscription: sub.toJSON(), name: deviceName() });
    myEndpoint = sub.endpoint;
    render();
  } catch (e) {
    alert(`Не удалось включить уведомления: ${e.message}`);
  }
}

async function disablePush() {
  try {
    const reg = await swReady;
    const sub = reg && reg.pushManager ? await reg.pushManager.getSubscription() : null;
    if (sub) {
      pushInfo = await call('DELETE', '/api/admin/push', { endpoint: sub.endpoint });
      await sub.unsubscribe().catch(() => {});
    }
    myEndpoint = null;
    render();
  } catch (e) {
    alert(e.message);
  }
}

async function removePushDevice(endpoint) {
  const d = ((pushInfo && pushInfo.devices) || []).find(x => x.endpoint === endpoint);
  if (!d || !confirm(`Не присылать уведомления на «${d.name || 'устройство'}»?`)) return;
  try {
    pushInfo = await call('DELETE', '/api/admin/push', { endpoint });
    render();
  } catch (e) {
    alert(e.message);
  }
}

async function testPush() {
  try {
    const { sent } = await call('POST', '/api/admin/push/test', {});
    alert(sent ? `Отправлено (устройств: ${sent}) — уведомление придёт через несколько секунд` : 'Не отправилось: служба уведомлений не приняла подписку. Выключите и включите уведомления заново');
  } catch (e) {
    alert(e.message);
  }
}

// Куда вести после нажатия на уведомление.
function openTarget({ page: to, id }) {
  if ((to === 'chat' || to === 'master') && masters.some(m => m.id === id)) go(to, id);
  else if (SECTIONS[to]) go(to);
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', e => {
    const msg = e.data || {};
    if (msg.type === 'open') {
      const url = new URL(msg.url, location.href);
      const target = { page: url.searchParams.get('open') || '', id: url.searchParams.get('m') || '' };
      if (code || session) openTarget(target);
      else pendingOpen = target;
    }
    if (msg.type === 'push' && (code || session)) {
      // Пришло уведомление, пока страница открыта: обновить то, что на экране.
      if (page === 'chat') loadMessages();
      else if (page === 'chats') loadChats();
      else if (!page) load();
    }
  });
}

// Число на иконке «BB Админ» убираем, когда страницу открыли.
const clearBadge = () => {
  try {
    const p = navigator.clearAppBadge && navigator.clearAppBadge();
    if (p && p.catch) p.catch(() => {});
  } catch (e) { /* значки не поддерживаются */ }
};
clearBadge();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') clearBadge();
});

// ---------- Сервер ----------

// Бесплатный тариф Cloudflare: база до 500 МБ, в сутки — 100 000 запросов к серверу, 100 000 записанных
// и 5 000 000 прочитанных строк. Суточные цифры приносит проверка сервера (monitor.mjs, 9:00, 15:00, 21:00).
const FREE = { size: 500e6, requests: 100000, rowsWritten: 100000, rowsRead: 5000000 };
const REVIEW_MASTERS = 30; // на 30 мастерах решаем про платный тариф
const num = n => Math.round(Number(n) || 0).toLocaleString('ru-RU');

function loads() {
  const u = usage || {};
  return [
    ['База данных', dbSize || u.size || 0, FREE.size, v => `${size(v)} из 500 МБ`],
    usage && ['Запросы к серверу за сутки', u.requests, FREE.requests, v => `${num(v)} из ${num(FREE.requests)}`],
    usage && ['Записано строк в базу за сутки', u.rowsWritten, FREE.rowsWritten, v => `${num(v)} из ${num(FREE.rowsWritten)}`],
    usage && ['Прочитано строк за сутки', u.rowsRead, FREE.rowsRead, v => `${num(v)} из ${num(FREE.rowsRead)}`],
  ].filter(Boolean);
}

// Общая загрузка — по самой большой доле лимита.
function loadLevel() {
  const worst = Math.max(0, ...loads().map(([, value, max]) => (Number(value) || 0) / max));
  return worst >= 0.8 ? ['bad', 'высокая'] : worst >= 0.5 ? ['warn', 'средняя'] : ['ok', 'низкая'];
}

function loadScale(title, value, max, text) {
  const share = (Number(value) || 0) / max;
  const percent = share > 0 && share < 0.01 ? '<1' : String(Math.round(share * 100));
  const lit = share > 0 ? Math.min(10, Math.max(1, Math.ceil(share * 10))) : 0;
  return `
      <div class="load-row">
        <div class="load-head"><span>${esc(title)}</span><b>${esc(text(value))} · ${percent}%</b></div>
        ${pills(lit, `${title}: ${percent}%`, true)}
      </div>`;
}

function serverHtml() {
  const [tone, word] = loadLevel();
  const when = usage && usage.at ? formatTime(usage.at) : '';
  const byStorage = [...masters].sort((a, b) => total(b.storage) - total(a.storage));
  return `
    <section class="card page-card">
      <h3 class="card-title">Загрузка: <span class="load-level ${tone}">${word}</span></h3>
      ${loads().map(([title, value, max, text]) => loadScale(title, value, max, text)).join('')}
      ${loadScale(`Мастера (на ${REVIEW_MASTERS} решаем про платный тариф)`, masters.length, REVIEW_MASTERS, v => `${v} из ${REVIEW_MASTERS}`)}
      <p class="hint">Бесплатный тариф Cloudflare: база до 500 МБ, в сутки — 100 000 запросов к серверу и 100 000 записей в базу. Зелёные овалы — запас большой, красные — подходим к пределу. ${when ? `Суточные цифры — по проверке сервера ${esc(when)}.` : 'Суточные цифры появятся после ближайшей проверки сервера (9:00, 15:00, 21:00).'} Если подойдём к пределу, придёт уведомление проверки.</p>
    </section>
    <h3 class="section-title">Место по мастерам</h3>
    <section class="card settings-menu">${byStorage.map(m => `
      <button class="menu-row" data-master="${esc(m.id)}">
        <span class="grow"><b>${esc(m.name || 'Без имени')}</b><small>фото ${m.storage ? m.storage.photos : 0} шт. · копии ${m.storage ? m.storage.backups : 0}</small></span>
        <b>${size(total(m.storage))}</b>
        ${icon('right')}
      </button>`).join('') || '<p class="hint list-empty">Мастеров пока нет</p>'}
    </section>`;
}

// ---------- WhatsApp для мастеров ----------

function contactHtml() {
  return `
    <section class="card page-card">
      <p class="hint">Мастер, который забыл пароль, нажмёт «Забыли пароль?» и напишет вам сюда.</p>
      <form id="contact-form" novalidate>
        <label>WhatsApp администратора<input type="tel" name="whatsapp" value="${esc(L.phoneFieldStart(contact))}"></label>
        <button type="submit" class="btn secondary block">Сохранить</button>
      </form>
    </section>`;
}

async function saveContact(e) {
  e.preventDefault();
  const whatsapp = L.phoneFromField(e.target.elements.whatsapp.value);
  try {
    contact = (await call('PUT', '/api/admin/contact', { whatsapp })).whatsapp;
    alert(contact ? 'Сохранено: мастера будут писать на этот номер' : 'Номер убран');
  } catch (err) {
    alert(err.message);
  }
}

// ---------- Вход по Face ID: устройства, включить, убрать ----------

function faceHtml() {
  const keys = passkeys.map(k => `
    <div class="admin-master">
      <div class="grow">
        <b>${esc(k.name || 'Устройство')}</b>
        <small>${esc(k.site)} · ${k.used ? `последний вход ${esc(formatDate(k.used))}` : 'ещё не входили'}</small>
      </div>
      <button class="btn small ghost" data-unkey="${esc(k.id)}">Убрать</button>
    </div>`).join('');
  return `
    <section class="card page-card">
      <p class="hint">Чтобы не вводить код каждый раз, включите на этом устройстве вход по Face ID (или Touch ID, или код-паролю телефона). Ключ хранится в «Связке ключей» Apple и появится на других ваших устройствах Apple; сервер знает только его открытую часть.</p>
      ${keys ? `<div class="list">${keys}</div>` : ''}
      ${canFace ? '<button class="btn secondary block" id="add-face">Включить вход по Face ID на этом устройстве</button>' : '<p class="hint">Этот браузер не умеет входить по Face ID.</p>'}
    </section>`;
}

async function prepareRegister() {
  registerOptions = null;
  if (!canFace) return;
  try {
    registerOptions = { ...(await call('POST', '/api/admin/passkey/options', {})), at: Date.now() };
  } catch (e) { /* нет связи — кнопка скажет */ }
}

async function addFace() {
  const options = registerOptions;
  if (!options || Date.now() - options.at > FRESH) {
    alert('Страница долго была открыта — нажмите кнопку ещё раз');
    prepareRegister();
    return;
  }
  let credential;
  try {
    credential = await navigator.credentials.create({
      publicKey: {
        challenge: bytes(options.challenge),
        rp: options.rp,
        user: { id: bytes(options.user.id), name: options.user.name, displayName: options.user.displayName },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', residentKey: 'preferred', userVerification: 'required' },
        attestation: 'none',
        excludeCredentials: options.exclude.map(id => ({ type: 'public-key', id: bytes(id) })),
        timeout: options.timeout,
      },
    });
  } catch (e) {
    prepareRegister();
    if (e.name === 'InvalidStateError') return alert('На этом устройстве вход по Face ID уже включён');
    return alert(e.name === 'NotAllowedError' ? 'Не включено: Face ID отменён или не прошёл' : `Не получилось: ${e.message}`);
  }
  try {
    await call('POST', '/api/admin/passkeys', {
      id: b64(credential.rawId),
      clientDataJSON: b64(credential.response.clientDataJSON),
      attestationObject: b64(credential.response.attestationObject),
      name: deviceName(),
    });
  } catch (e) {
    prepareRegister();
    return alert(e.message);
  }
  alert('Готово: в следующий раз войдите по Face ID');
  load();
}

async function removeFace(id) {
  const k = passkeys.find(x => x.id === id);
  if (!k || !confirm(`Убрать вход по Face ID для «${k.name || 'устройства'}»? На этом устройстве снова понадобится код администратора. В «Связке ключей» ключ можно удалить и вручную: Настройки → Пароли.`)) return;
  try {
    await call('DELETE', `/api/admin/passkeys/${encodeURIComponent(id)}`);
  } catch (e) {
    return alert(e.message);
  }
  load();
}

// ---------- Сброс пароля мастеру ----------

// Временный пароль: 8 знаков без похожих (0/o, 1/l/i).
function tempPassword() {
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789';
  return [...crypto.getRandomValues(new Uint8Array(8))].map(b => abc[b % abc.length]).join('');
}

async function resetPassword(id) {
  const m = masters.find(x => x.id === id);
  if (!m || !confirm(`Сбросить пароль мастеру ${m.name} (${m.phone})? Мастер выйдет из приложения и войдёт с временным паролем.`)) return;
  const temp = tempPassword();
  try {
    await call('POST', `/api/admin/masters/${encodeURIComponent(id)}/password`, { secret: await L.passwordSecret(m.phone, temp) });
  } catch (e) {
    alert(e.message);
    return;
  }
  resetNote = { id, temp };
  render();
  scrollTo(0, 0);
}

view.addEventListener('click', e => {
  const target = e.target.closest('[data-go], [data-master], [data-back], [data-reset], [data-unkey], [data-month], [data-sub], [data-sort], [data-chat], [data-copy], [data-pay-plan], [data-push], [data-push-remove], #add-face, #leave');
  if (!target) return;
  if (target.dataset.push === 'on') return enablePush();
  if (target.dataset.push === 'off') return disablePush();
  if (target.dataset.push === 'test') return testPush();
  if (target.dataset.pushRemove) return removePushDevice(target.dataset.pushRemove);
  if (target.dataset.month) {
    const step = Number(target.dataset.month);
    if (target.dataset.kind === 'stat') statMonth = L.addMonths(statMonth, step);
    else {
      subMonth = L.addMonths(subMonth, step);
      paying = '';
    }
    render();
    return;
  }
  if (target.dataset.sort) {
    const [kind, value] = target.dataset.sort.split(':');
    if (kind === 'master') masterSort = value;
    else subSort = value;
    render();
    return;
  }
  if ('payPlan' in target.dataset) {
    if (!target.dataset.payPlan) {
      paying = '';
      render();
      return;
    }
    return extendSubscription(target.dataset.id, target.dataset.payPlan, false);
  }
  if (target.dataset.copy) return copyText(target, target.dataset.copy);
  if (target.dataset.sub) return subscriptionAction(target.dataset.sub);
  if (target.dataset.go) go(target.dataset.go);
  else if (target.dataset.chat) go('chat', target.dataset.chat);
  else if (target.dataset.master) go('master', target.dataset.master);
  else if ('back' in target.dataset) history.back();
  else if (target.dataset.reset) resetPassword(target.dataset.reset);
  else if (target.dataset.unkey) removeFace(target.dataset.unkey);
  else if (target.id === 'add-face') addFace();
  else if (target.id === 'leave') renderLogin();
});

// Номер Kaspi — в буфер обмена (10 цифр без +7: так его вставляют в счёт Kaspi).
async function copyText(button, text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    return alert(`Скопируйте вручную: ${text}`);
  }
  button.innerHTML = icon('check');
  setTimeout(() => { button.innerHTML = icon('copy'); }, 1500);
}

view.addEventListener('change', e => {
  const box = e.target.closest('[data-pay]');
  if (!box) return;
  const want = box.checked;
  box.checked = !want; // галочка встанет, когда сервер подтвердит
  if (want) {
    paying = box.dataset.pay; // сначала — за какой срок оплата
    render();
  } else {
    undoPayment(box.dataset.pay);
  }
});

renderLogin('', true);
