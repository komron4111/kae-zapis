// Страница администратора Nailapp: все мастера, сброс забытого пароля и свой WhatsApp
// для кнопки «Забыли пароль?». Вход — код администратора (секрет ADMIN_CODE на сервере,
// а если он не задан — ACCESS_CODE) или Face ID / код-пароль телефона (WebAuthn), если
// администратор включил его на этом устройстве. Ни код, ни вход по Face ID нигде не
// сохраняются: только в памяти открытой страницы, чтобы их не прочитал другой код сайта.
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

let code = '';
let session = ''; // вход по Face ID: сеанс на 12 часов
let masters = [];
let dbSize = null; // размер всей базы, байт
let contact = '';
let passkeys = [];
let query = '';

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
    load();
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
    load();
  } catch (e) {
    prepareFaceLogin();
    faceError(e.message);
  }
}

async function load() {
  try {
    const list = await call('GET', '/api/admin/masters');
    masters = list.masters;
    dbSize = list.size;
    try {
      contact = (await (await fetch(`${API}/api/contact`, { cache: 'no-store' })).json()).whatsapp || '';
    } catch (e) { /* покажем пустое поле */ }
    try {
      passkeys = (await call('GET', '/api/admin/passkeys')).passkeys;
    } catch (e) {
      passkeys = [];
    }
    renderList();
  } catch (e) {
    renderLogin(e.message);
  }
}

// ---------- Мастера ----------

// 1 234 567 байт → «1,2 МБ», 5 400 → «5 КБ».
function size(n) {
  n = Number(n) || 0;
  if (n < 1e6) return `${Math.max(n ? 1 : 0, Math.round(n / 1e3))} КБ`;
  return `${(n / 1e6).toFixed(1).replace('.', ',')} МБ`;
}

// Сколько места данные мастера занимают на сервере: фото, копии, прочее (расписание, личные ссылки).
function storageLine(st) {
  if (!st) return '';
  const total = st.photoBytes + st.backupBytes + st.otherBytes;
  return `на сервере ${size(total)}: фото ${st.photos} шт. — ${size(st.photoBytes)}, копии ${st.backups} — ${size(st.backupBytes)}, прочее ${size(st.otherBytes)}`;
}

function masterRow(m) {
  const link = `${new URL(IS_LOCAL ? '../okna/' : 'okna/', IS_LOCAL ? location.href : PUBLIC_URL).href}?m=${encodeURIComponent(m.slug)}`;
  const notes = [m.claimed ? '' : 'аккаунт не оформлен', m.devices ? '' : 'сейчас не в приложении'].filter(Boolean).join(' · ');
  return `
    <div class="admin-master">
      <div class="grow">
        <b>${esc(m.name || 'Без имени')}</b>
        <small>${esc(m.phone || 'номер ещё не указан')} · с ${esc(formatDate(m.created))}</small>
        <small><a href="${esc(link)}" target="_blank" rel="noopener">ссылка: ${esc(m.slug)}</a>${notes ? ` · ${esc(notes)}` : ''}</small>
        <small>${m.address ? esc(m.address) : 'адрес не указан'}${L.gisLink(m.gis) ? ` · <a href="${esc(L.gisLink(m.gis))}" target="_blank" rel="noopener">2ГИС</a>` : ''}</small>
        <small>${esc(storageLine(m.storage))}</small>
      </div>
      ${m.phone ? `<button class="btn small secondary" data-reset="${esc(m.id)}">Сбросить пароль</button>` : ''}
    </div>`;
}

// Поиск по имени, ссылке, адресу или цифрам номера (от 3 цифр).
function rows() {
  const q = query.trim().toLowerCase();
  const qd = q.replace(/\D/g, '');
  const list = masters.filter(m => !q || m.name.toLowerCase().includes(q) || m.slug.includes(q) || (m.address || '').toLowerCase().includes(q)
    || (qd.length >= 3 && L.phoneDigits(m.phone).includes(qd)));
  return list.map(masterRow).join('') || '<p class="hint list-empty">Никого не нашли</p>';
}

// Карточка «Вход по Face ID»: устройства, на которых он включён, и кнопка для этого устройства.
function faceCard() {
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
      <h3 class="card-title">Вход по Face ID</h3>
      <p class="hint">Чтобы не вводить код каждый раз, включите на этом устройстве вход по Face ID (или Touch ID, или код-паролю телефона). Ключ хранится в «Связке ключей» Apple и появится на других ваших устройствах Apple; сервер знает только его открытую часть.</p>
      ${keys ? `<div class="list">${keys}</div>` : ''}
      ${canFace ? '<button class="btn secondary block" id="add-face">Включить вход по Face ID на этом устройстве</button>' : '<p class="hint">Этот браузер не умеет входить по Face ID.</p>'}
    </section>`;
}

function renderList() {
  view.innerHTML = `
    <h2 class="page-title">Мастера · ${masters.length}</h2>
    ${dbSize ? `<p class="hint">Вся база на сервере: ${esc(size(dbSize))} из 500 МБ бесплатного тарифа (${Math.round(dbSize / 5e6)}%).</p>` : ''}
    <input type="search" id="q" class="search" placeholder="Имя, номер, ссылка или адрес" aria-label="Поиск мастера" value="${esc(query)}">
    <section class="card list" id="masters">${rows()}</section>
    <section class="card page-card">
      <h3 class="card-title">Ваш WhatsApp для мастеров</h3>
      <p class="hint">Мастер, который забыл пароль, нажмёт «Забыли пароль?» и напишет вам сюда.</p>
      <form id="contact-form" novalidate>
        <label>WhatsApp администратора<input type="tel" name="whatsapp" value="${esc(L.phoneFieldStart(contact))}"></label>
        <button type="submit" class="btn secondary block">Сохранить</button>
      </form>
    </section>
    ${faceCard()}
    <button class="btn ghost block" id="leave">Выйти</button>`;
  const search = $('#q');
  search.addEventListener('input', () => {
    query = search.value;
    $('#masters').innerHTML = rows();
  });
  $('#contact-form').addEventListener('submit', async e => {
    e.preventDefault();
    const whatsapp = L.phoneFromField(e.target.elements.whatsapp.value);
    try {
      contact = (await call('PUT', '/api/admin/contact', { whatsapp })).whatsapp;
      alert(contact ? 'Сохранено: мастера будут писать на этот номер' : 'Номер убран');
    } catch (err) {
      alert(err.message);
    }
  });
  const add = $('#add-face');
  if (add) add.addEventListener('click', addFace);
  $('#leave').addEventListener('click', () => renderLogin());
  prepareRegister();
}

// ---------- Включить и убрать вход по Face ID ----------

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
  const text = `Здравствуйте, ${m.name}! Ваш временный пароль для входа в Nailapp: ${temp}. Войдите по своему номеру ${m.phone} и смените пароль: «Настройки» → «Аккаунт» → «Сменить пароль».`;
  view.innerHTML = `
    <h2 class="page-title">Пароль сброшен</h2>
    <section class="card page-card">
      <p>Временный пароль для <b>${esc(m.name)}</b> (${esc(m.phone)}):</p>
      <p class="temp-password">${esc(temp)}</p>
      <p class="hint">Отправьте его мастеру. После входа мастер сменит пароль в «Настройки» → «Аккаунт». Второй раз этот пароль здесь не покажется.</p>
      <a class="btn primary block" href="https://wa.me/${L.phoneDigits(m.phone)}?text=${encodeURIComponent(text)}" target="_blank" rel="noopener">Отправить в WhatsApp</a>
    </section>
    <button class="btn ghost block" id="back">К списку мастеров</button>`;
  $('#back').addEventListener('click', load);
}

view.addEventListener('click', e => {
  const reset = e.target.closest('[data-reset]');
  if (reset) resetPassword(reset.dataset.reset);
  const unkey = e.target.closest('[data-unkey]');
  if (unkey) removeFace(unkey.dataset.unkey);
});

renderLogin();
