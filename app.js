// Записи Арай — интерфейс приложения. Расчёты — в logic.js.
// Данные хранятся только в телефоне (IndexedDB), сервера нет.

import * as L from './logic.js';

const APP_VERSION = '1.0.0';

// ---------- Мелочи ----------

const $ = (sel, root = document) => root.querySelector(sel);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const today = () => L.ymd(new Date());
const RECORD_FORMS = ['запись', 'записи', 'записей'];
const VISIT_FORMS = ['оплаченная запись', 'оплаченные записи', 'оплаченных записей'];

const ICONS = {
  calendar: '<rect x="3" y="4.5" width="18" height="16.5" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
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
};
const icon = name => `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

function formatDate(iso) {
  const d = new Date(iso);
  return isNaN(d) ? '' : `${d.getDate()} ${L.MONTHS_GEN[d.getMonth()]} ${d.getFullYear()}`;
}

// ---------- Хранилище: IndexedDB в телефоне ----------

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

function freshData() {
  return {
    appointments: [],
    expenses: [],
    prices: L.DEFAULT_SERVICES.map(name => ({ id: uid(), name, price: 0 })),
    rent: [{ from: '2000-01', amount: L.DEFAULT_RENT }],
    lastBackup: null,
  };
}

async function save() {
  if (storageBroken) {
    toast('Данные не открылись. Закройте приложение и откройте снова');
    return false;
  }
  try {
    await dbSet('data', data);
    return true;
  } catch (e) {
    toast('Не удалось сохранить. Проверьте свободное место на телефоне');
    return false;
  }
}

// ---------- Экран ----------

const ui = { tab: 'records', month: L.monthOf(today()), day: today(), finMonth: L.monthOf(today()), seenToday: today() };
const appbar = $('#appbar'), view = $('#view'), fab = $('#fab'), sheet = $('#sheet');

const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let installEvent = null;

function setHeader(title, actions = '') {
  appbar.innerHTML = `<h1>${title}</h1>${actions}`;
}

function render() {
  const tabs = [['records', 'calendar', 'Записи'], ['finance', 'chart', 'Финансы'], ['settings', 'sliders', 'Настройки']];
  $('#tabbar').innerHTML = tabs.map(([id, ic, label]) =>
    `<button data-tab="${id}"${ui.tab === id ? ' class="active" aria-current="page"' : ''}>${icon(ic)}<span>${label}</span></button>`).join('');
  fab.hidden = ui.tab !== 'records';
  if (ui.tab === 'records') renderRecords();
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
    const n = counts[d] || 0;
    const label = L.dayTitle(d) + (n ? `, ${n} ${L.plural(n, RECORD_FORMS)}` : '');
    return `<button class="${cls.join(' ')}" data-act="day" data-day="${d}" aria-label="${label}"><span>${Number(d.slice(8))}</span><i>${n || ''}</i></button>`;
  }).join('');
  const list = data.appointments.filter(a => a.date === ui.day).sort((a, b) => a.time.localeCompare(b.time));
  const active = list.filter(a => a.status !== 'cancelled').length;
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
    ${list.length ? list.map(apptCard).join('') : `
      <div class="empty">
        <p>На этот день записей нет</p>
        <button class="btn secondary small" data-act="new-appt">${icon('plus')} Добавить запись</button>
      </div>`}`;
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
  const details = [a.service, a.status === 'booked' && a.prepaid ? `предоплата ${L.formatMoney(a.prepaid)}` : ''].filter(Boolean).join(' · ');
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

function openAppt(id) {
  const src = id ? data.appointments.find(a => a.id === id) : null;
  const a = src || { date: ui.day, time: '', name: '', phone: '', service: '', total: 0, prepaid: 0, status: 'booked', note: '' };
  const services = data.prices.filter(p => p.name.trim());
  if (a.service && !services.some(p => p.name === a.service)) services.push({ name: a.service, price: 0 });

  openSheet(src ? 'Запись' : 'Новая запись', `
    <form id="appt-form" class="sheet-body" novalidate autocomplete="off">
      <div class="row2">
        <label>Дата<input type="date" name="date" value="${esc(a.date)}"></label>
        <label>Время<input type="time" name="time" value="${esc(a.time)}"></label>
      </div>
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
      <p id="dup-warn" class="warn-text" hidden></p>
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
}

const field = (form, name) => form.elements.namedItem(name);

// Пересчитывает остаток, предупреждения и ссылки для звонка.
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

  const date = field(form, 'date').value, time = field(form, 'time').value;
  const dup = time && data.appointments.find(x =>
    x.id !== form.dataset.id && x.status !== 'cancelled' && x.date === date && x.time === time);
  const warn = $('#dup-warn');
  warn.hidden = !dup;
  if (dup) warn.textContent = `На ${time} уже есть запись: ${dup.name || dup.phone}`;

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
  if (date && time) text += ` Напоминаю о записи${service ? ' на ' + service.toLowerCase() : ''}: ${L.shortDate(date)} в ${time}.`;
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
  else data.appointments.push({ id: uid(), ...rec, created: now, updated: now });
  if (!(await save())) return;
  ui.day = rec.date;
  ui.month = L.monthOf(rec.date);
  closeSheet();
  render();
  toast(src ? 'Запись обновлена' : 'Запись добавлена');
}

// ---------- Клиенты ----------
// Клиент сохраняется вместе с записью. В следующий раз его выбирают кнопкой
// «Выбрать клиента» или из подсказки при вводе имени или номера.

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

// Сохранённые клиенты по алфавиту, с поиском. Повторное нажатие закрывает список.
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
  const src = id ? data.expenses.find(e => e.id === id) : null;
  const defaultDate = ui.finMonth === L.monthOf(today()) ? today() : `${ui.finMonth}-01`;
  const e = src || { date: defaultDate, amount: 0, note: '' };
  openSheet(src ? 'Расход' : 'Расход на материалы', `
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
      <p class="hint">Все записи хранятся только в этом телефоне. Раз в неделю сохраняйте копию — например, отправьте файл себе в Telegram или WhatsApp. Если телефон потеряется или сменится, всё восстановится из копии.</p>
      <p>Последняя копия: <b>${data.lastBackup ? formatDate(data.lastBackup) : 'ещё не сохраняли'}</b></p>
      <button class="btn primary block" data-act="backup">Сохранить копию</button>
      <label class="btn secondary block">Восстановить из копии<input type="file" class="file-input" accept=".json,application/json" data-change="restore"></label>
    </section>

    <p class="version">Записи Арай · версия ${APP_VERSION}</p>`;
}

async function backup() {
  const name = `zapisi-arai-${today()}.json`;
  const file = new File([JSON.stringify(L.makeBackup(data))], name, { type: 'application/json' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Копия: Записи Арай' });
    } else {
      const url = URL.createObjectURL(file);
      const link = Object.assign(document.createElement('a'), { href: url, download: name });
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    }
  } catch (e) {
    if (e.name !== 'AbortError') toast('Не удалось сохранить копию');
    return;
  }
  data.lastBackup = new Date().toISOString();
  await save();
  render();
  toast('Копия сохранена');
}

async function restoreBackup(file) {
  if (!file) return;
  let copy;
  try {
    copy = L.readBackup(await file.text());
  } catch (e) {
    return toast(e.message);
  }
  const when = copy.exportedAt ? ` от ${formatDate(copy.exportedAt)}` : '';
  const count = `${copy.appointments.length} ${L.plural(copy.appointments.length, RECORD_FORMS)}`;
  if (!confirm(`Восстановить копию${when}? В ней ${count}. Текущие данные в приложении заменятся.`)) return;
  data = {
    appointments: copy.appointments,
    expenses: copy.expenses,
    prices: copy.prices.length ? copy.prices : freshData().prices,
    rent: copy.rent,
    lastBackup: copy.exportedAt,
  };
  if (!(await save())) return;
  render();
  toast('Данные восстановлены');
}

// ---------- Окно поверх экрана ----------
// Кнопка «Назад» на Android закрывает окно, а не приложение.

function openSheet(title, body) {
  sheet.innerHTML = `
    <header class="sheet-head">
      <button type="button" class="icon-btn" data-act="close-sheet" aria-label="Закрыть">${icon('close')}</button>
      <h2>${title}</h2>
      <span></span>
    </header>${body}`;
  sheet.hidden = false;
  sheet.scrollTop = 0;
  document.documentElement.classList.add('locked');
  if (!(history.state && history.state.sheet)) history.pushState({ sheet: true }, '');
}

function hideSheet() {
  sheet.hidden = true;
  sheet.innerHTML = '';
  document.documentElement.classList.remove('locked');
}

function closeSheet() {
  if (history.state && history.state.sheet) history.back();
  else hideSheet();
}

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
  'open-appt': el => openAppt(el.dataset.id),
  'close-sheet': () => closeSheet(),
  'pick-client': () => toggleClients(),
  'fill': el => fillClient(el.closest('form'), el.dataset.name, el.dataset.phone),
  'service': el => {
    const form = el.closest('form');
    form.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === el));
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
    if (!confirm('Удалить эту запись?')) return;
    data.appointments = data.appointments.filter(a => a.id !== el.dataset.id);
    await save();
    closeSheet();
    render();
    toast('Запись удалена');
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
  'backup': () => backup(),
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

addEventListener('popstate', hideSheet);

addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  installEvent = e;
  if (data && ui.tab === 'records') render();
});

addEventListener('appinstalled', () => {
  installEvent = null;
  if (data) render();
});

// Приложение могли не закрывать несколько дней: «сегодня» должно сдвинуться.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !data) return;
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
  } catch (e) {
    storageBroken = true;
  }
  data = Object.assign(freshData(), stored || {});
  render();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
}

start();
