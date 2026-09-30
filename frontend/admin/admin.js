// Страница администратора Nailapp: все мастера, сброс забытого пароля и свой WhatsApp
// для кнопки «Забыли пароль?». Вход — код администратора (секрет ADMIN_CODE на сервере,
// а если он не задан — ACCESS_CODE). Код нигде не сохраняется: только в памяти открытой
// страницы, чтобы его не прочитал никакой другой код сайта.
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
let masters = [];
let dbSize = null; // размер всей базы, байт
let contact = '';
let query = '';

async function call(method, path, body) {
  const headers = { Authorization: `Admin ${L.bytesToB64u(new TextEncoder().encode(code))}` };
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

function formatDate(iso) {
  const d = new Date(iso);
  return isNaN(d) ? '' : `${d.getDate()} ${L.MONTHS_GEN[d.getMonth()]} ${d.getFullYear()}`;
}

function renderLogin(error = '') {
  view.innerHTML = `
    <h2 class="page-title">Администратор</h2>
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
}

async function load() {
  try {
    const list = await call('GET', '/api/admin/masters');
    masters = list.masters;
    dbSize = list.size;
    try {
      contact = (await (await fetch(`${API}/api/contact`, { cache: 'no-store' })).json()).whatsapp || '';
    } catch (e) { /* покажем пустое поле */ }
    renderList();
  } catch (e) {
    code = '';
    renderLogin(e.message);
  }
}

// 1 234 567 байт → «1,2 МБ», 5 400 → «5 КБ».
function size(bytes) {
  const n = Number(bytes) || 0;
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

// Поиск по имени, ссылке или цифрам номера (от 3 цифр).
function rows() {
  const q = query.trim().toLowerCase();
  const qd = q.replace(/\D/g, '');
  const list = masters.filter(m => !q || m.name.toLowerCase().includes(q) || m.slug.includes(q) || (m.address || '').toLowerCase().includes(q)
    || (qd.length >= 3 && L.phoneDigits(m.phone).includes(qd)));
  return list.map(masterRow).join('') || '<p class="hint list-empty">Никого не нашли</p>';
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
  $('#leave').addEventListener('click', () => {
    code = '';
    renderLogin();
  });
}

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
  const button = e.target.closest('[data-reset]');
  if (button) resetPassword(button.dataset.reset);
});

renderLogin();
