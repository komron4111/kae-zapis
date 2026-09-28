// Записи Арай — интерфейс приложения. Расчёты — в logic.js, архив копии — в zip.js.
// Данные и фото хранятся только в телефоне (IndexedDB). В интернет уходит только
// свободное время для клиентов (без имён и телефонов) — в репозиторий kae-zapis-okna.

import * as L from './logic.js';
import { makeZip, readZip } from './zip.js';

const APP_VERSION = '1.1.0';

const OKNA_REPO = 'komron4111/kae-zapis-okna';
const OKNA_API = `https://api.github.com/repos/${OKNA_REPO}/contents/okna.json`;
// Шаблон ключа: права и срок заполняются сами, остаётся выбрать репозиторий.
const TOKEN_URL = 'https://github.com/settings/personal-access-tokens/new?name=Zapisi+Arai+okna'
  + '&description=' + encodeURIComponent('Публикация свободного времени из приложения «Записи Арай»')
  + '&target_name=komron4111&expires_in=none&contents=write';

// ---------- Мелочи ----------

const $ = (sel, root = document) => root.querySelector(sel);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const today = () => L.ymd(new Date());
const nowMinutes = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const RECORD_FORMS = ['запись', 'записи', 'записей'];
const VISIT_FORMS = ['оплаченная запись', 'оплаченные записи', 'оплаченных записей'];

const ICONS = {
  calendar: '<rect x="3" y="4.5" width="18" height="16.5" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20.5c.8-3.6 3.3-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M15.5 4.8a3.5 3.5 0 0 1 0 6.4M17.5 15.2c2 .6 3.4 2.4 4 5.3"/>',
  chart: '<path d="M3 21h18M6 17v-5M12 17V6M18 17v-8"/>',
  sliders: '<path d="M4 7h9M19 7h1M4 17h1M11 17h9"/><circle cx="16" cy="7" r="2.5"/><circle cx="8" cy="17" r="2.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  left: '<path d="M15 5l-7 7 7 7"/>',
  right: '<path d="M9 5l7 7-7 7"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  chat: '<path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.6L3 21l1.9-5.4A8.5 8.5 0 1 1 21 11.5z"/>',
  share: '<path d="M12 15V3M8 7l4-4 4 4"/><path d="M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8"/>',
  camera: '<path d="M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
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
// Ключи: 'data' — записи и настройки, 'publish' — ключ GitHub и статус публикации
// (в копию не входит), 'photo:<id>' — фото.

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

// ---------- Данные ----------

let data = null;
// Данные не прочитались: не сохраняем, чтобы пустой список не затёр настоящий.
let storageBroken = false;
let publish = { token: '', fingerprint: '', at: null, error: '' };

function freshData() {
  return {
    appointments: [],
    expenses: [],
    prices: L.DEFAULT_SERVICES.map(name => ({ id: uid(), name, price: 0 })),
    rent: [{ from: '2000-01', amount: L.DEFAULT_RENT }],
    settings: { ...L.DEFAULT_SETTINGS },
    blocks: [],
    lastBackup: null,
  };
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
  schedulePublish();
  return true;
}

// ---------- Экран ----------

const ui = { tab: 'records', month: L.monthOf(today()), day: today(), finMonth: L.monthOf(today()), seenToday: today(), clientQuery: '' };
const appbar = $('#appbar'), view = $('#view'), fab = $('#fab'), sheet = $('#sheet'), viewer = $('#viewer');

const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let installEvent = null;

function setHeader(title, actions = '') {
  appbar.innerHTML = `<h1>${title}</h1>${actions}`;
}

function render() {
  const tabs = [['records', 'calendar', 'Записи'], ['clients', 'users', 'Клиенты'], ['finance', 'chart', 'Финансы'], ['settings', 'sliders', 'Настройки']];
  $('#tabbar').innerHTML = tabs.map(([id, ic, label]) =>
    `<button data-tab="${id}"${ui.tab === id ? ' class="active" aria-current="page"' : ''}>${icon(ic)}<span>${label}</span></button>`).join('');
  fab.hidden = ui.tab !== 'records';
  if (ui.tab === 'records') renderRecords();
  else if (ui.tab === 'clients') renderClients();
  else if (ui.tab === 'finance') renderFinance();
  else renderSettings();
}

// ---------- Записи ----------

function renderRecords() {
  const t = today();
  setHeader('Записи', ui.day !== t ? '<button class="hbtn" data-act="today">Сегодня</button>' : '');
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
  const list = data.appointments.filter(a => a.date === ui.day).sort((a, b) => a.time.localeCompare(b.time));
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
    const times = L.freeTimes(data.appointments, ui.day, settings(), ui.day === t ? nowMinutes() : -1);
    dayInfo = `<p class="free-line">${times.length ? `Свободно: ${L.formatRanges(L.toRanges(times))}` : 'Свободного времени нет'}</p>`;
  }
  view.innerHTML = `
    ${banners()}
    <section class="card cal">
      <div class="cal-head">
        <button class="icon-btn" data-act="month" data-delta="-1" aria-label="Предыдущий месяц">${icon('left')}</button>
        <b>${L.monthTitle(ui.month)}</b>
        <button class="icon-btn" data-act="month" data-delta="1" aria-label="Следующий месяц">${icon('right')}</button>
      </div>
      <div class="cal-grid">${L.WEEKDAYS_SHORT.map(w => `<span class="wd">${w}</span>`).join('')}${cells}</div>
    </section>
    <div class="day-head"><h2>${L.dayTitle(ui.day)}</h2>${active ? `<span>${active} ${L.plural(active, RECORD_FORMS)}</span>` : ''}</div>
    ${dayInfo}
    ${list.length ? list.map(apptCard).join('') : `
      <div class="empty">
        <p>На этот день записей нет</p>
        <button class="btn secondary small" data-act="new-appt">${icon('plus')} Добавить запись</button>
      </div>`}
    ${!block && ui.day >= t ? `<div class="day-actions"><button class="btn small ghost" data-act="new-block" data-day="${ui.day}">${icon('lock')} Закрыть день для записи</button></div>` : ''}`;
}

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
    a.service,
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
  if (publish.token && publish.error) {
    out.push(`
      <div class="banner warn">
        <div class="grow">Ссылка для клиентов не обновилась: ${esc(publish.error)}.</div>
        <button class="btn small secondary" data-act="goto" data-to="settings">Настройки</button>
      </div>`);
  }
  if (backupDue()) {
    out.push(`
      <div class="banner warn">
        <div class="grow">Записи хранятся только в этом телефоне. Сохраните резервную копию.</div>
        <button class="btn small secondary" data-act="backup">Сохранить</button>
      </div>`);
  }
  return out.join('');
}

function backupDue() {
  if (data.appointments.length < 3) return false;
  return !data.lastBackup || Date.now() - Date.parse(data.lastBackup) > 14 * 864e5;
}

// ---------- Карточка записи ----------

function openAppt(id, prefill = {}) {
  pushSheet(() => drawAppt(id, prefill));
}

function drawAppt(id, prefill) {
  const src = id ? data.appointments.find(a => a.id === id) : null;
  const a = src || { date: ui.day, time: '', name: '', phone: '', service: '', total: 0, prepaid: 0, status: 'booked', note: '', ...prefill };
  const services = data.prices.filter(p => p.name.trim());
  if (a.service && !services.some(p => p.name === a.service)) services.push({ name: a.service, price: 0 });

  sheetHtml(src ? 'Запись' : 'Новая запись', `
    <form id="appt-form" class="sheet-body" novalidate autocomplete="off">
      <div class="row2">
        <label>Дата<input type="date" name="date" value="${esc(a.date)}"></label>
        <label>Время<input type="time" name="time" value="${esc(a.time)}"></label>
      </div>
      <div id="time-hint" class="time-hint"></div>
      <button type="button" class="btn secondary block" data-act="pick-client">${icon('user')} Выбрать клиента</button>
      <div id="client-panel"></div>
      <label>Имя клиента<input name="name" value="${esc(a.name)}" autocapitalize="words" enterkeyhint="done" placeholder="Например, Айгуль"></label>
      <div class="suggest" data-for="name"></div>
      <label>Телефон<input name="phone" type="tel" value="${esc(a.phone)}" enterkeyhint="done" placeholder="+7 700 000 00 00"></label>
      <div class="suggest" data-for="phone"></div>
      <div class="phone-links" id="phone-links"></div>
      <fieldset>
        <legend>Услуга</legend>
        <div class="chips">${services.map(p => `
          <button type="button" class="chip${p.name === a.service ? ' on' : ''}" data-act="service" data-name="${esc(p.name)}" data-price="${p.price}">
            ${esc(p.name)}${p.price ? `<small>${L.formatAmount(p.price)}</small>` : ''}
          </button>`).join('')}
        </div>
        <input type="hidden" name="service" value="${esc(a.service)}">
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
      <button type="submit" class="btn primary block">Сохранить</button>
      ${src ? `<button type="button" class="btn danger block" data-act="delete-appt" data-id="${esc(src.id)}">Удалить запись</button>` : ''}
    </form>`);

  const form = $('#appt-form');
  form.dataset.id = src ? src.id : '';
  const clients = L.pastClients(data.appointments);
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
  const date = field(form, 'date').value, time = field(form, 'time').value;
  const block = date ? L.blockFor(data.blocks, date) : null;
  const hint = $('#time-hint');
  if (!date || date < today() || block) {
    hint.innerHTML = '';
  } else {
    const times = L.freeTimes(data.appointments, date, s, date === today() ? nowMinutes() : -1, form.dataset.id);
    const ranges = L.toRanges(times);
    hint.innerHTML = times.length
      ? `<span>Свободно: ${L.formatRanges(ranges)}</span>
         <div class="time-chips">${ranges.map(([from]) => `<button type="button" class="chip small" data-act="pick-time" data-time="${from}">${L.shortTime(from)}</button>`).join('')}</div>`
      : '<span>В этот день свободного времени нет</span>';
  }

  const warnings = [];
  if (block) warnings.push(`Этот день закрыт для записи${block.note ? `: ${block.note}` : ''}.`);
  if (date && time) {
    const near = L.conflicts(data.appointments, date, time, s.duration, form.dataset.id);
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
  if (L.canDial(phone)) {
    const d = L.phoneDigits(phone);
    const text = reminderText(field(form, 'name').value.trim(), field(form, 'service').value, date, time);
    links.innerHTML = `
      <a class="btn small secondary" href="tel:+${d}">${icon('phone')} Позвонить</a>
      <a class="btn small secondary" href="https://wa.me/${d}?text=${encodeURIComponent(text)}" target="_blank" rel="noopener">${icon('chat')} Напомнить в WhatsApp</a>`;
  } else {
    links.innerHTML = '';
  }
}

function reminderText(name, service, date, time) {
  let text = `Здравствуйте${name ? ', ' + name : ''}!`;
  if (date && time) text += ` Напоминаю о записи${service ? ' на ' + service.toLowerCase() : ''}: ${L.shortDate(date)} в ${L.shortTime(time)}.`;
  return text;
}

async function saveAppt(form) {
  const v = name => field(form, name).value;
  const rec = {
    date: v('date'),
    time: v('time'),
    name: v('name').trim(),
    phone: L.formatPhone(v('phone')),
    service: v('service'),
    total: L.toMoney(v('total')),
    prepaid: L.toMoney(v('prepaid')),
    status: v('status'),
    note: v('note').trim(),
  };
  const error = !rec.date ? 'Укажите дату'
    : !rec.time ? 'Укажите время'
    : !rec.name && !rec.phone ? 'Укажите имя или телефон клиента'
    : !rec.service ? 'Выберите услугу'
    : rec.prepaid > rec.total ? 'Предоплата не может быть больше суммы'
    : '';
  if (error) return toast(error);

  const now = new Date().toISOString();
  const src = data.appointments.find(a => a.id === form.dataset.id);
  if (src) Object.assign(src, rec, { updated: now });
  else data.appointments.push({ id: uid(), ...rec, photos: [], created: now, updated: now });
  if (!(await save())) return;
  ui.day = rec.date;
  ui.month = L.monthOf(rec.date);
  closeSheet();
  render();
  toast(src ? 'Запись обновлена' : 'Запись добавлена');
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
  field(form, 'phone').value = L.formatPhone(phone);
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
  const clients = L.sortByName(L.pastClients(data.appointments));
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
  setHeader('Клиенты');
  const clients = L.sortByName(L.pastClients(data.appointments));
  if (!clients.length) {
    view.innerHTML = '<div class="empty"><p>Клиентов пока нет. Они появятся здесь после первой записи.</p></div>';
    return;
  }
  view.innerHTML = `
    <input type="search" id="clients-q" class="search" placeholder="Поиск по имени или номеру" aria-label="Поиск клиента" value="${esc(ui.clientQuery)}">
    <section class="card list" id="clients-list"></section>`;
  const q = $('#clients-q');
  const show = () => {
    ui.clientQuery = q.value;
    const found = L.findClients(clients, q.value);
    $('#clients-list').innerHTML = found.length ? found.map(clientRow).join('') : '<p class="hint list-empty">Никого не нашли</p>';
  };
  q.addEventListener('input', show);
  show();
}

function clientRow(c) {
  return `
    <button class="client-row" data-act="open-client" data-key="${esc(c.key)}">
      <span><b>${esc(c.name || L.formatPhone(c.phone))}</b><small>${esc(c.name ? L.formatPhone(c.phone) : '')}</small></span>
      <span class="meta">${c.visits} ${L.plural(c.visits, RECORD_FORMS)}<small>последняя ${L.shortDate(c.last)}</small></span>
    </button>`;
}

function openClient(key) {
  pushSheet(() => drawClient(key));
}

function drawClient(key) {
  const c = L.pastClients(data.appointments).find(x => x.key === key);
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
      ${visits.map(a => visitRow(a, t)).join('')}
    </div>`);
  loadPhotos(sheet);
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
        <small>${esc(a.service)} · ${money}</small>
        ${a.note ? `<small>${esc(a.note)}</small>` : ''}
      </button>
      <div class="thumbs" data-photos-of="${esc(a.id)}">${thumbs(a)}</div>
      ${canPhoto ? `<label class="btn small secondary">${icon('camera')} Фото<input type="file" accept="image/*" multiple class="file-input" data-change="photo" data-id="${esc(a.id)}"></label>` : ''}
    </div>`;
}

// ---------- Фото результата ----------
// Фото сжимается до 1280 px по длинной стороне и хранится в IndexedDB
// под ключом 'photo:<id>'; в записи — список id.

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

let viewerState = null;

async function openViewer(apptId, photoId) {
  const rec = await dbGet('photo:' + photoId).catch(() => null);
  if (!rec) return toast('Фото не найдено');
  const file = new File([rec.data], `foto-${photoId}.jpg`, { type: rec.type || 'image/jpeg' });
  viewerState = { apptId, photoId, file };
  viewer.innerHTML = `
    <div class="viewer-bar">
      <button class="icon-btn" data-act="close-viewer" aria-label="Закрыть">${icon('close')}</button>
      <span class="grow"></span>
      <button class="btn small" data-act="share-photo">${icon('share')} Поделиться</button>
      <button class="icon-btn" data-act="delete-photo" aria-label="Удалить фото">${icon('trash')}</button>
    </div>
    <img src="${await photoUrl(photoId)}" alt="Фото результата">`;
  viewer.hidden = false;
}

function closeViewer() {
  viewer.hidden = true;
  viewer.innerHTML = '';
  viewerState = null;
}

async function sharePhoto() {
  if (!viewerState) return;
  const { file } = viewerState;
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file] });
    else downloadFile(file);
  } catch (e) {
    if (e.name !== 'AbortError') toast('Не удалось поделиться фото');
  }
}

async function deletePhoto() {
  if (!viewerState || !confirm('Удалить это фото?')) return;
  const { apptId, photoId } = viewerState;
  const a = data.appointments.find(x => x.id === apptId);
  if (a) a.photos = (a.photos || []).filter(id => id !== photoId);
  if (!(await save())) return;
  await dbDel('photo:' + photoId).catch(() => {});
  forgetPhoto(photoId);
  closeViewer();
  refreshPhotoViews(apptId);
  if (ui.tab === 'records') render();
  toast('Фото удалено');
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
  setHeader('Финансы');
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
  setHeader('Настройки');
  const s = settings();
  const rent = L.rentFor(data.rent, L.monthOf(today()));
  view.innerHTML = `
    <section class="card">
      <h2>Прайс</h2>
      <p class="hint">Цена подставляется в запись при выборе услуги. В самой записи её можно поменять.</p>
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
      <p class="hint">По ссылке клиенты видят свободное время на 30 дней вперёд. Имена и телефоны клиентов там не видны.</p>
      <div class="link-box">${esc(clientLink())}</div>
      <div class="btn-row">
        <button class="btn small secondary" data-act="share-link">${icon('share')} Поделиться</button>
        <button class="btn small secondary" data-act="copy-link">${icon('link')} Скопировать</button>
      </div>
      <label>Имя для клиентов<input value="${esc(s.clientName)}" enterkeyhint="done" data-change="set-clientName"></label>
      <label>WhatsApp для записи<input type="tel" value="${esc(s.whatsapp)}" enterkeyhint="done" placeholder="+7 700 000 00 00" data-change="set-whatsapp"></label>
      <p class="hint">Клиент нажмёт на время — и откроется WhatsApp с сообщением на этот номер.</p>
      <div id="publish-status">${publishStatusHtml()}</div>
      ${publish.token ? `
      <div class="btn-row">
        <button class="btn small secondary" data-act="publish-now">Обновить сейчас</button>
        <button class="btn small ghost" data-act="token-remove">Отключить</button>
      </div>` : `
      <div class="panel">
        <p><b>Подключение — один раз.</b> Чтобы ссылка обновлялась сама, приложению нужен ключ GitHub.</p>
        <ol class="steps">
          <li><a href="${TOKEN_URL}" target="_blank" rel="noopener">Откройте страницу создания ключа</a> и войдите в GitHub.</li>
          <li>В разделе «Repository access» выберите «Only select repositories» → <b>kae-zapis-okna</b>.</li>
          <li>Нажмите «Generate token», скопируйте ключ и вставьте сюда.</li>
        </ol>
        <label>Ключ GitHub<input type="password" id="token-input" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="github_pat_…"></label>
        <button class="btn primary block" data-act="token-save">Подключить</button>
      </div>`}
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
      <h2>Резервная копия</h2>
      <p class="hint">Все записи и фото хранятся только в этом телефоне. Раз в неделю сохраняйте копию — например, отправьте файл себе в Telegram или WhatsApp. Если телефон потеряется или сменится, всё восстановится из копии.</p>
      <p>Последняя копия: <b>${data.lastBackup ? formatDate(data.lastBackup) : 'ещё не сохраняли'}</b></p>
      <button class="btn primary block" data-act="backup">Сохранить копию</button>
      <label class="btn secondary block">Восстановить из копии<input type="file" class="file-input" accept=".zip,.json,application/zip,application/json" data-change="restore"></label>
    </section>

    <p class="version">Записи Арай · версия ${APP_VERSION}</p>`;
}

function durationHint(duration) {
  return `Например, клиент записан на 12:00 — следующему приложение предложит время не раньше ${L.shortTime(L.fromMinutes(12 * 60 + duration))}.`;
}

function clientLink() {
  return new URL('okna/', location.href.split('#')[0]).href;
}

function publishStatusHtml() {
  if (!publish.token) return '<p class="status warn">Ссылка пока не обновляется: подключите ключ GitHub.</p>';
  if (publishing) return '<p class="status">Выкладываем свободное время…</p>';
  if (publish.error) return `<p class="status bad">Не удалось выложить: ${esc(publish.error)}. Попробуем снова при следующем изменении.</p>`;
  return `<p class="status ok">Свободное время на сайте актуально${publish.at ? ` (выложено ${formatDateTime(publish.at)})` : ''}.</p>`;
}

// ---------- Свободное время для клиентов: публикация на GitHub ----------

let publishTimer = null, publishing = false, publishAgain = false;

function schedulePublish(delay = 2500) {
  if (!publish.token || storageBroken) return;
  clearTimeout(publishTimer);
  publishTimer = setTimeout(publishNow, delay);
}

function showPublishStatus() {
  const box = $('#publish-status');
  if (box) box.innerHTML = publishStatusHtml();
}

async function publishNow() {
  if (!publish.token || !data) return;
  if (publishing) {
    publishAgain = true;
    return;
  }
  publishing = true;
  showPublishStatus();
  try {
    const schedule = L.buildSchedule(data);
    // Время выгрузки не в счёт: без изменений в расписании файл не перезаписываем.
    const fingerprint = JSON.stringify({ ...schedule, updated: '' });
    if (fingerprint !== publish.fingerprint) {
      await putOkna(JSON.stringify(schedule, null, 1));
      publish.fingerprint = fingerprint;
      publish.at = new Date().toISOString();
    }
    publish.error = '';
  } catch (e) {
    publish.error = e.message;
  }
  publishing = false;
  await dbSet('publish', publish).catch(() => {});
  showPublishStatus();
  if (publishAgain) {
    publishAgain = false;
    publishNow();
  }
}

async function putOkna(text) {
  const headers = { Authorization: `Bearer ${publish.token}`, Accept: 'application/vnd.github+json' };
  const request = async (method, body) => {
    let res;
    try {
      res = await fetch(OKNA_API, { method, headers: body ? { ...headers, 'Content-Type': 'application/json' } : headers, body, cache: 'no-store' });
    } catch (e) {
      throw new Error('нет интернета');
    }
    if (res.status === 401) throw new Error('ключ GitHub не подходит или отозван');
    return res;
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    const current = await request('GET');
    if (!current.ok && current.status !== 404) throw new Error(`GitHub ответил ${current.status}`);
    const sha = current.ok ? (await current.json()).sha : undefined;
    const res = await request('PUT', JSON.stringify({ message: 'Свободное время обновлено', content: toBase64(text), ...(sha ? { sha } : {}) }));
    if (res.ok) return;
    // Файл успели изменить (или он появился) — берём свежий sha и повторяем.
    if (res.status === 409 || res.status === 422) continue;
    if (res.status === 403 || res.status === 404) throw new Error('у ключа нет доступа к репозиторию kae-zapis-okna');
    throw new Error(`GitHub ответил ${res.status}`);
  }
  throw new Error('GitHub не принял файл');
}

function toBase64(text) {
  let binary = '';
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

// ---------- Резервная копия: ZIP с data.json и фото ----------

let pendingBackup = null;

// Сначала собираем файл, потом отдельной кнопкой отправляем: iOS разрешает
// «Поделиться» только сразу после нажатия, а сборка с фото занимает время.
async function prepareBackup() {
  toast('Готовим копию…');
  const files = [{ name: 'data.json', data: new TextEncoder().encode(JSON.stringify(L.makeBackup(data))) }];
  for (const a of data.appointments) {
    for (const id of a.photos || []) {
      const rec = await dbGet('photo:' + id).catch(() => null);
      if (rec) files.push({ name: `photos/${id}.jpg`, data: new Uint8Array(rec.data) });
    }
  }
  pendingBackup = new File([makeZip(files)], `zapisi-arai-${today()}.zip`, { type: 'application/zip' });
  const n = data.appointments.length, photos = files.length - 1;
  pushSheet(() => sheetHtml('Резервная копия', `
    <div class="sheet-body">
      <p class="lead">Копия готова: ${n} ${L.plural(n, RECORD_FORMS)}, ${photos} фото, ${formatSize(pendingBackup.size)}.</p>
      <p class="hint">Отправьте файл себе в Telegram или WhatsApp либо сохраните в «Файлы». Восстановить: «Настройки» → «Восстановить из копии».</p>
      <button class="btn primary block" data-act="send-backup">${icon('share')} Отправить или сохранить</button>
    </div>`));
}

async function sendBackup() {
  const file = pendingBackup;
  if (!file) return;
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: 'Копия: Записи Арай' });
    else downloadFile(file);
  } catch (e) {
    if (e.name !== 'AbortError') toast('Не удалось сохранить копию');
    return;
  }
  pendingBackup = null;
  data.lastBackup = new Date().toISOString();
  await save();
  closeSheet();
  render();
  toast('Копия сохранена');
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
  if (!confirm(`Восстановить копию${when}? В ней ${count}. Текущие данные в приложении заменятся.`)) return;
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

function closeSheet() {
  if (sheets.length) history.back();
}

addEventListener('popstate', () => {
  sheets.pop();
  closeViewer();
  showSheet();
});

let toastTimer = null;
function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2800);
}

// ---------- Действия ----------

const actions = {
  'today': () => { ui.day = today(); ui.month = L.monthOf(ui.day); render(); },
  'month': el => { ui.month = L.addMonths(ui.month, Number(el.dataset.delta)); render(); },
  'day': el => { ui.day = el.dataset.day; ui.month = L.monthOf(ui.day); render(); },
  'new-appt': () => openAppt(null),
  'new-appt-for': el => openAppt(null, { name: el.dataset.name, phone: el.dataset.phone, date: today() }),
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
    form.querySelectorAll('.chip[data-act="service"]').forEach(c => c.classList.toggle('on', c === el));
    field(form, 'service').value = el.dataset.name;
    const price = Number(el.dataset.price);
    if (price) field(form, 'total').value = L.formatAmount(price);
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
  'open-client': el => openClient(el.dataset.key),
  'view-photo': el => openViewer(el.dataset.appt, el.dataset.photo),
  'close-viewer': () => closeViewer(),
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
      await navigator.share({ title: 'Свободное время для записи', url });
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
  'token-save': async () => {
    const token = $('#token-input').value.trim();
    if (!/^(github_pat_|ghp_)\w+$/.test(token)) return toast('Это не похоже на ключ GitHub');
    publish = { token, fingerprint: '', at: null, error: '' };
    await dbSet('publish', publish).catch(() => {});
    render();
    publishNow();
  },
  'token-remove': async () => {
    if (!confirm('Отключить обновление ссылки? Клиенты будут видеть последнее выложенное время.')) return;
    publish = { token: '', fingerprint: '', at: null, error: '' };
    await dbSet('publish', publish).catch(() => {});
    render();
  },
  'publish-now': () => {
    publish.fingerprint = '';
    publishNow();
  },
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
      el.value = L.formatPhone(el.value);
      data.settings = { ...s, whatsapp: el.value };
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

addEventListener('online', () => schedulePublish(500));

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !data) return;
  schedulePublish(1000);
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
    publish = { ...publish, ...((await dbGet('publish')) || {}) };
  } catch (e) {
    storageBroken = true;
  }
  data = Object.assign(freshData(), stored || {});
  data.settings = { ...L.DEFAULT_SETTINGS, ...data.settings };
  render();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  schedulePublish(1500);
}

start();
