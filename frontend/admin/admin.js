// Страница администратора Nailapp. Разделы, в которые проваливаешься, как «Настройки» в приложении:
// «Мастера» (поиск, карточка мастера с подпиской, сброс пароля), «Подписки» (календарь по месяцам:
// галочка «оплата получена» продлевает доступ на месяц), «Сервер» (место в базе), «WhatsApp для мастеров»
// (куда пишут через «Забыли пароль?»), «Вход по Face ID». Назад — кнопкой «‹» или жестом браузера:
// каждый раздел — запись в истории (history.pushState).
//
// Вход — код администратора (секрет ADMIN_CODE на сервере, а если он не задан — ACCESS_CODE)
// или Face ID / код-пароль телефона (WebAuthn), если администратор включил его на этом устройстве.
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

// Где мы: '' — меню разделов; 'masters', 'master' (карточка masterId), 'subs', 'server', 'contact', 'face'.
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

function renderLogin(error = '') {
  code = '';
  session = '';
  page = '';
  view.innerHTML = `
    <h2 class="page-title">Администратор</h2>
    <section class="card page-card" id="face-card" hidden>
      <button type="button" class="btn primary block" id="face-login">Войти по Face ID</button>
      <p class="hint">Или по коду администратора — ниже.</p>
      <p class="warn-text" id="face-error" hidden></p>
    </section>
    <form class="card page-card" id="code-form" novalidate>
      <p class="hint">Здесь видны все мастера Nailapp: можно сбросить забытый пароль и указать свой WhatsApp для кнопки «Забыли пароль?».</p>
      <label>Код администратора<input type="password" name="code" autocomplete="current-password"></label>
      ${error ? `<p class="warn-text">${esc(error)}</p>` : ''}
      <button type="submit" class="btn primary block">Войти</button>
    </form>`;
  $('#code-form').addEventListener('submit', e => {
    e.preventDefault();
    code = e.target.elements.code.value.trim();
    load(true);
  });
  $('#face-login').addEventListener('click', faceLogin);
  prepareFaceLogin();
}

// Есть ли для этого адреса вход по Face ID — тогда показываем кнопку и готовим вызов.
async function prepareFaceLogin() {
  loginOptions = null;
  if (!canFace) return;
  try {
    const options = await request('POST', '/api/admin/passkey/login-options', {});
    if (!options.available) return;
    loginOptions = { ...options, at: Date.now() };
    const card = $('#face-card');
    if (card) card.hidden = false;
  } catch (e) { /* нет связи — остаётся вход по коду */ }
}

function faceError(text) {
  const box = $('#face-error');
  if (!box) return alert(text);
  box.textContent = text;
  box.hidden = !text;
}

async function faceLogin() {
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
    today = list.today || L.ymd(new Date());
    if (!subMonth) subMonth = L.monthOf(today);
    try {
      contact = (await (await fetch(`${API}/api/contact`, { cache: 'no-store' })).json()).whatsapp || '';
    } catch (e) { /* покажем пустое поле */ }
    try {
      passkeys = (await call('GET', '/api/admin/passkeys')).passkeys;
    } catch (e) {
      passkeys = [];
    }
  } catch (e) {
    renderLogin(e.message);
    return;
  }
  if (first) {
    page = '';
    history.replaceState({ page: '' }, '');
  }
  render();
}

// ---------- Разделы ----------

const SECTIONS = {
  masters: ['users', 'Мастера'],
  subs: ['calendar', 'Подписки'],
  server: ['cloud', 'Сервер'],
  contact: ['chat', 'WhatsApp для мастеров'],
  face: ['lock', 'Вход по Face ID'],
};

function summary(id) {
  if (id === 'masters') return `${masters.length} · поиск, адреса, место, сброс пароля`;
  if (id === 'subs') {
    const ym = L.monthOf(today);
    const paid = masters.filter(m => paidIn(m, ym).length).length;
    const off = masters.filter(m => !sub(m).unlimited && !L.subscriptionActive(sub(m), today)).length;
    return `оплатили в этом месяце: ${paid}${off ? ` · закончилась: ${off}` : ''}`;
  }
  if (id === 'server') return dbSize ? `база ${size(dbSize)} из 500 МБ · место по мастерам` : 'место по мастерам';
  if (id === 'contact') return contact ? L.formatPhone(contact) : 'не указан — мастерам некуда писать';
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
  if (page && !SECTIONS[page] && page !== 'master') page = '';
  render('prev');
});

function render(anim) {
  const enter = anim ? ` enter-${anim}` : '';
  if (!page) {
    view.innerHTML = `
      <div class="slide-clip"><div class="settings-home${enter}">
        <h2 class="page-title">Администратор</h2>
        <section class="card settings-menu">${Object.entries(SECTIONS).map(([id, [ic, title]]) => `
          <button class="menu-row" data-go="${id}">
            <span class="menu-ico">${icon(ic)}</span>
            <span class="grow"><b>${title}</b><small>${esc(summary(id))}</small></span>
            ${icon('right')}
          </button>`).join('')}
        </section>
        <button class="btn ghost block" id="leave">Выйти</button>
      </div></div>`;
    return;
  }
  const m = page === 'master' ? masters.find(x => x.id === masterId) : null;
  if (page === 'master' && !m) {
    page = 'masters';
    return render();
  }
  const title = m ? esc(m.name || 'Без имени') : SECTIONS[page][1];
  const backTitle = m ? 'Мастера' : 'Администратор';
  view.innerHTML = `
    <div class="slide-clip"><div class="settings-page${enter}">
      <button class="back-link" data-back>${icon('left')} ${backTitle}</button>
      <h2 class="page-title">${title}</h2>
      ${m ? masterHtml(m) : page === 'masters' ? mastersHtml() : page === 'subs' ? subsHtml() : page === 'server' ? serverHtml() : page === 'contact' ? contactHtml() : faceHtml()}
    </div></div>`;
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

// Поиск по имени, ссылке, адресу или цифрам номера (от 3 цифр).
function rows() {
  const q = query.trim().toLowerCase();
  const qd = q.replace(/\D/g, '');
  const list = masters.filter(m => !q || m.name.toLowerCase().includes(q) || m.slug.includes(q) || (m.address || '').toLowerCase().includes(q)
    || (qd.length >= 3 && L.phoneDigits(m.phone).includes(qd)));
  return list.map(m => `
    <button class="menu-row" data-master="${esc(m.id)}">
      <span class="grow"><b>${esc(m.name || 'Без имени')}</b><small>${esc([m.phone || 'номер не указан', shortAccess(m), m.address, `${size(total(m.storage))} на сервере`].filter(Boolean).join(' · '))}</small></span>
      ${icon('right')}
    </button>`).join('') || '<p class="hint list-empty">Никого не нашли</p>';
}

function mastersHtml() {
  return `
    <input type="search" id="q" class="search" placeholder="Имя, номер, ссылка или адрес" aria-label="Поиск мастера" value="${esc(query)}">
    <section class="card settings-menu" id="masters">${rows()}</section>`;
}

function masterHtml(m) {
  const st = m.storage || { photos: 0, photoBytes: 0, backups: 0, backupBytes: 0, otherBytes: 0 };
  const gis = L.gisLink(m.gis);
  const link = clientLink(m);
  if (resetNote && resetNote.id === m.id) {
    const text = `Здравствуйте, ${m.name}! Ваш временный пароль для входа в Nailapp: ${resetNote.temp}. Войдите по своему номеру ${m.phone} и смените пароль: «Настройки» → «Аккаунт» → «Сменить пароль».`;
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
      <div class="line"><span>Телефон</span><b>${esc(m.phone || 'не указан')}</b></div>
      <div class="line"><span>Зарегистрирован</span><b>${esc(formatDate(m.created))}</b></div>
      <div class="line"><span>Аккаунт</span><b>${m.claimed ? 'оформлен' : 'не оформлен'}</b></div>
      <div class="line"><span>Приложение</span><b>${m.devices ? 'подключено' : 'сейчас не в приложении'}</b></div>
      <div class="line"><span>Адрес</span><b>${esc(m.address || 'не указан')}</b></div>
      ${gis ? `<a class="btn small secondary" href="${esc(gis)}" target="_blank" rel="noopener">Открыть в 2ГИС</a>` : ''}
    </section>
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
const DAY_FORMS = ['день', 'дня', 'дней'];

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

// Календарь по месяцам: все мастера, зарегистрированные к концу месяца, в порядке регистрации.
// Галочка — оплата получена в этом месяце; ставить и снимать — только в текущем.
function subsHtml() {
  const current = subMonth === L.monthOf(today);
  const last = L.addDays(L.addMonthsToDate(`${subMonth}-01`, 1), -1);
  const list = masters.filter(m => almatyDate(m.created) <= last).sort((a, b) => a.created.localeCompare(b.created));
  const paidCount = list.filter(m => paidIn(m, subMonth).length).length;
  const rows = list.map(m => {
    const s = sub(m);
    const paid = paidIn(m, subMonth);
    const cov = coverage(m, subMonth);
    const status = s.unlimited ? 'бессрочно' : current ? accessText(m) : cov ? `доступ с ${L.shortDate(cov.from)} по ${fullDate(cov.to)}` : 'без доступа';
    const note = paid.length ? `оплата ${paid.map(p => L.shortDate(almatyDate(p.marked))).join(', ')}` : '';
    const off = !s.unlimited && current && !L.subscriptionActive(s, today);
    return `
      <div class="sub-row${off ? ' off' : ''}">
        <input type="checkbox" class="sub-check" data-pay="${esc(m.id)}" aria-label="Оплата от ${esc(m.name)} получена" ${paid.length ? 'checked' : ''} ${current && !s.unlimited ? '' : 'disabled'}>
        <button class="sub-info grow" data-master="${esc(m.id)}"><b>${esc(m.name || 'Без имени')}</b><small>${esc([status, note].filter(Boolean).join(' · '))}</small></button>
      </div>`;
  }).join('');
  return `
    <div class="month-nav">
      <button class="icon-btn" data-month="-1" aria-label="Предыдущий месяц">${icon('left')}</button>
      <b>${L.monthTitle(subMonth)}</b>
      <button class="icon-btn" data-month="1" aria-label="Следующий месяц">${icon('right')}</button>
    </div>
    <p class="hint">Оплатили${current ? ' в этом месяце' : ''}: ${paidCount} из ${list.length}.</p>
    <section class="card list">${rows || '<p class="hint list-empty">В этом месяце мастеров ещё не было</p>'}</section>
    <p class="hint">Галочка — «оплата получена»: доступ мастера продлевается на месяц — от конца текущего периода, а если он уже закончился, с сегодняшнего дня. Отметили по ошибке — снимите галочку. Отмечать можно в текущем месяце. Нажмите на мастера — там все его периоды, бессрочный доступ и дата окончания.</p>`;
}

// Подписка в карточке мастера: сейчас, все периоды, продлить, отменить, дата, бессрочно.
function subscriptionCard(m) {
  const s = sub(m);
  const next = L.nextPeriod(s.until, today);
  const kinds = { trial: 'первый месяц', manual: 'изменено вручную' };
  const periods = [...s.periods].reverse().map(p => `
    <div class="line"><span>${esc(L.shortDate(p.from))} – ${esc(fullDate(p.to))}</span><b>${esc(p.kind === 'paid' ? `оплата ${L.shortDate(almatyDate(p.marked))}` : kinds[p.kind] || p.kind)}</b></div>`).join('');
  const hasPaid = s.periods.some(p => p.kind === 'paid');
  return `
    <section class="card page-card">
      <h3 class="card-title">Подписка</h3>
      <div class="line"><span>Сейчас</span><b>${esc(accessText(m))}</b></div>
      ${periods}
      ${s.unlimited ? '' : `<button class="btn primary block" data-sub="extend">Оплата получена — продлить до ${esc(fullDate(next.end))}</button>`}
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

// Галочка в календаре: поставить — оплата получена (+ месяц), снять — отменить последнюю оплату.
async function togglePayment(id, want) {
  const m = masters.find(x => x.id === id);
  if (!m) return;
  if (want) {
    const next = L.nextPeriod(sub(m).until, today);
    if (!confirm(`Оплата от ${m.name} получена? Доступ продлится до ${fullDate(next.end)}.`)) return;
    return changeSubscription(id, { action: 'extend' });
  }
  if (!confirm(`Снять отметку об оплате от ${m.name}? Последний оплаченный месяц отменится.`)) return;
  return changeSubscription(id, { action: 'undo' });
}

function subscriptionAction(action) {
  const m = masters.find(x => x.id === masterId);
  if (!m) return;
  const s = sub(m);
  if (action === 'extend') return togglePayment(m.id, true);
  if (action === 'undo') return togglePayment(m.id, false);
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

// ---------- Сервер ----------

function serverHtml() {
  const byStorage = [...masters].sort((a, b) => total(b.storage) - total(a.storage));
  return `
    <section class="card page-card">
      ${dbSize ? `<div class="line"><span>Вся база</span><b>${esc(size(dbSize))} из 500 МБ (${Math.round(dbSize / 5e6)}%)</b></div>` : ''}
      <p class="hint">Бесплатный тариф Cloudflare: база до 500 МБ, в сутки — 100 000 запросов к серверу и 100 000 записей в базу. Больше всего места займут фото. Если подойдём к пределу, придёт уведомление проверки.</p>
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
  const target = e.target.closest('[data-go], [data-master], [data-back], [data-reset], [data-unkey], [data-month], [data-sub], #add-face, #leave');
  if (!target) return;
  if (target.dataset.month) {
    subMonth = L.addMonths(subMonth, Number(target.dataset.month));
    render();
    return;
  }
  if (target.dataset.sub) return subscriptionAction(target.dataset.sub);
  if (target.dataset.go) go(target.dataset.go);
  else if (target.dataset.master) go('master', target.dataset.master);
  else if ('back' in target.dataset) history.back();
  else if (target.dataset.reset) resetPassword(target.dataset.reset);
  else if (target.dataset.unkey) removeFace(target.dataset.unkey);
  else if (target.id === 'add-face') addFace();
  else if (target.id === 'leave') renderLogin();
});

view.addEventListener('change', e => {
  const box = e.target.closest('[data-pay]');
  if (!box) return;
  const want = box.checked;
  box.checked = !want; // галочка встанет, когда сервер подтвердит
  togglePayment(box.dataset.pay, want);
});

renderLogin();
