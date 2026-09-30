// Страница для клиентов: свободное время мастера и заявка на запись.
// С параметром ?z=<ссылка> — личная страница клиента с его записью.
// Данные — с сервера заявок (backend/): свободное время уже без занятого другими заявками.

import * as L from '../logic.js';
import { API_URL } from '../config.js';
import { phoneMask } from '../phone-input.js';

phoneMask();

let API = API_URL;
try { API = localStorage.getItem('kae:api') || API_URL; } catch (e) { /* приватный режим */ }

const $ = sel => document.querySelector(sel);
const view = $('#view'), sheet = $('#sheet');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const chevron = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
const closeIcon = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const pinIcon = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>';

// Где принимает мастер: адрес и кнопка 2ГИС. Ссылку ещё раз проверяет L.gisLink — только 2ГИС.
function placeHtml(address, gis) {
  const text = L.addressText(address), link = L.gisLink(gis);
  if (!text && !link) return '';
  return `
    <div class="okna-place">
      ${text ? `<p>${pinIcon}<span>${esc(text)}</span></p>` : ''}
      ${link ? `<a class="btn small secondary" href="${esc(link)}" target="_blank" rel="noopener">Открыть в 2ГИС</a>` : ''}
    </div>`;
}

let schedule = null;
let openDay = null;

// Имя и телефон клиента запоминаются на его же телефоне — чтобы не вводить снова.
function remembered() {
  try { return JSON.parse(localStorage.getItem('kae-okna:me') || '{}'); } catch (e) { return {}; }
}

function remember(me) {
  try { localStorage.setItem('kae-okna:me', JSON.stringify(me)); } catch (e) { /* не страшно */ }
}

// Личные ссылки на записи, оставленные с этого телефона: показываем их над расписанием.
function myBookings() {
  try { return JSON.parse(localStorage.getItem('kae-okna:bookings') || '[]'); } catch (e) { return []; }
}

function saveBookings(list) {
  try { localStorage.setItem('kae-okna:bookings', JSON.stringify(list.slice(0, 10))); } catch (e) { /* не страшно */ }
}

function rememberBooking(entry) {
  saveBookings([entry, ...myBookings().filter(b => b.token !== entry.token)]);
}

// Мастер этой страницы: okna/?m=<slug>. Без него — прежняя ссылка Арай (до аккаунтов).
const MASTER = (new URLSearchParams(location.search).get('m') || '').trim().toLowerCase();
const withMaster = (url, slug = MASTER) => (slug ? `${url}${url.includes('?') ? '&' : '?'}m=${encodeURIComponent(slug)}` : url);

const bookingEntry = (token, b) => ({ token, m: (b.master && b.master.slug) || MASTER, date: b.date, time: b.time, services: b.services || [], status: b.status });
const bookingUrl = token => `${location.pathname}?z=${encodeURIComponent(token)}`;

// Мастер могла подтвердить, перенести или отменить запись — сверяем «Мои записи» с сервером.
async function refreshMine() {
  const today = L.masterClock(schedule.tzOffset || 0).date;
  let list = myBookings(), changed = false;
  for (const entry of list.filter(b => b.date >= today)) {
    const b = await loadBooking(entry.token);
    if (!b) break; // нет связи — покажем то, что знаем
    const next = b.missing ? null : bookingEntry(entry.token, b);
    if (JSON.stringify(next) === JSON.stringify(entry)) continue;
    list = next ? list.map(x => (x.token === entry.token ? next : x)) : list.filter(x => x.token !== entry.token);
    changed = true;
  }
  if (!changed) return;
  saveBookings(list);
  render();
}

// Расписание проверяет сервер; здесь — ещё раз, по тому же образцу (L.cleanSchedule):
// страница показывает то, что прислал телефон мастера.
async function load() {
  try {
    const res = await fetch(withMaster(`${API}/api/okna`), { cache: 'no-store' });
    if (res.ok) {
      const raw = await res.json();
      const clean = L.cleanSchedule(raw);
      return clean && { ...clean, booking: raw.booking === true, legacy: raw.legacy === true, slug: String(raw.slug || '').replace(/[^\w-]/g, '') };
    }
    if (res.status === 404) return { missing: true };
  } catch (e) { /* покажем ошибку */ }
  return null;
}

function whatsappLink(text) {
  return `https://wa.me/${L.phoneDigits(schedule.whatsapp)}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

function render() {
  const s = schedule;
  const name = s.name || 'Мастер';
  document.title = `Запись — ${name}`;
  // Шапка — как в приложении (логотип и Nailapp, в okna/index.html), имя мастера — в заголовке.
  const title = `<h2 class="okna-title">Запись к мастеру ${esc(name)}</h2>`;

  const clock = L.masterClock(s.tzOffset || 0);
  // Время свободно, если в него помещается хотя бы самая короткая услуга;
  // подходят ли выбранные услуги, форма проверит после выбора.
  const need = L.shortestService(s.services, L.scheduleSettings(s));
  const days = (s.days || []).filter(d => d.date >= clock.date).map(d => ({
    ...d,
    times: L.scheduleTimes(s, d, need, d.date === clock.date ? clock.minutes : -1),
  })).filter(d => d.date > clock.date || d.off || d.times.length); // сегодня без времени — не показываем
  if (!days.length) {
    view.innerHTML = `${title}<div class="empty"><p>Свободное время скоро появится. Загляните позже.</p></div>`;
    return;
  }

  if (!openDay || !days.some(d => d.date === openDay && d.times.length)) {
    openDay = (days.find(d => d.times.length) || {}).date || null;
  }
  const updated = new Date(s.updated);
  const stale = Date.now() - updated > 3 * 864e5;
  const rows = days.map(d => {
    const summary = d.off ? 'нет записи' : d.times.length ? L.formatRanges(L.toRanges(d.times)) : 'всё занято';
    if (!d.times.length) {
      return `
        <section class="card okna-day none">
          <div class="okna-head"><span><b>${L.dayTitle(d.date)}</b><small>${esc(summary)}</small></span></div>
        </section>`;
    }
    const open = d.date === openDay;
    const chips = d.times.map(t => (s.booking
      ? `<button type="button" class="chip" data-date="${esc(d.date)}" data-time="${esc(t)}">${esc(L.shortTime(t))}</button>`
      : s.whatsapp
        ? `<a class="chip" href="${esc(whatsappLink(`Здравствуйте! Хочу записаться ${L.shortDate(d.date)} в ${L.shortTime(t)}.`))}" target="_blank" rel="noopener">${esc(L.shortTime(t))}</a>`
        : `<span class="chip">${esc(L.shortTime(t))}</span>`)).join('');
    return `
      <section class="card okna-day${open ? ' open' : ''}" data-day="${esc(d.date)}">
        <button class="okna-head" aria-expanded="${open}">
          <span><b>${L.dayTitle(d.date)}</b><small>свободно: ${esc(summary)}</small></span>${chevron}
        </button>
        <div class="chips okna-times"${open ? '' : ' hidden'}>${chips}</div>
      </section>`;
  }).join('');

  const intro = s.booking
    ? 'Выберите день и время начала — затем имя, телефон и услуги.'
    : s.whatsapp ? 'Выберите день и время начала — откроется WhatsApp, чтобы записаться.' : 'Чтобы записаться, напишите мастеру.';
  // Записи, оставленные до аккаунтов (без m), — у прежнего мастера.
  const mine = myBookings().filter(b => b.date >= clock.date && (b.m ? b.m === s.slug : Boolean(s.legacy)));
  view.innerHTML = `
    ${title}
    ${placeHtml(s.address, s.gis)}
    ${mine.length ? `
    <section class="my-bookings">
      <h2 class="section-title">Мои записи</h2>
      ${mine.map(b => {
        const [tone, label] = MINE_STATUS[b.status] || [];
        return `<a class="card my-booking" href="${esc(bookingUrl(b.token))}"><b>${L.dayTitle(b.date)}, ${esc(L.shortTime(b.time))}</b><small>${esc(L.servicesLabel(b.services || []))}</small>${label ? `<span class="badge ${tone}">${label}</span>` : ''}</a>`;
      }).join('')}
    </section>` : ''}
    <p class="okna-intro">${intro} ${s.v >= 2 ? 'Сколько займёт запись, покажем после выбора услуг.' : `Одна запись занимает до ${L.formatDuration(s.duration || 150)}.`}
      ${s.whatsapp ? `<br><a href="${esc(whatsappLink(''))}" target="_blank" rel="noopener">Написать мастеру в WhatsApp</a>` : ''}</p>
    ${stale ? '<div class="banner warn"><div class="grow">Расписание давно не обновлялось — уточните время у мастера.</div></div>' : ''}
    ${rows}
    <p class="okna-foot">Обновлено ${updated.getDate()} ${L.MONTHS_GEN[updated.getMonth()]} в ${updated.getHours()}:${String(updated.getMinutes()).padStart(2, '0')}</p>`;
}

// ---------- Заявка ----------

function openForm(date, time) {
  const me = remembered();
  const services = schedule.services || [];
  sheet.innerHTML = `
    <header class="sheet-head">
      <button type="button" class="icon-btn" data-close aria-label="Закрыть">${closeIcon}</button>
      <h2>Запись</h2>
      <span></span>
    </header>
    <form id="request-form" class="sheet-body" novalidate autocomplete="on">
      <p class="lead"><b>${L.dayTitle(date)}, ${esc(L.shortTime(time))}</b></p>
      <label>Ваше имя<input name="name" autocomplete="name" autocapitalize="words" enterkeyhint="next" value="${esc(me.name)}" placeholder="Например, Айгуль"></label>
      <label>Телефон (WhatsApp)<input name="phone" type="tel" autocomplete="tel" enterkeyhint="done" value="${esc(L.phoneFieldStart(me.phone))}"></label>
      <fieldset>
        <legend>Что будем делать — можно несколько</legend>
        <div class="chips">${services.map(p => `
          <button type="button" class="chip" data-service="${esc(p.name)}" data-price="${L.toMoney(p.price)}">
            ${esc(p.name)}${p.price ? `<small>${L.formatAmount(p.price)} ₸</small>` : ''}
          </button>`).join('')}
        </div>
      </fieldset>
      <div class="summary" id="total" hidden></div>
      <p id="fit-warn" class="warn-text" hidden></p>
      <label>Комментарий (необязательно)<input name="comment" enterkeyhint="done" maxlength="300" placeholder="Дизайн, длина, пожелания"></label>
      <input name="website" class="trap" tabindex="-1" autocomplete="off" aria-hidden="true">
      <p id="form-error" class="warn-text" hidden></p>
      <button type="submit" class="btn primary block">Отправить заявку</button>
      <p class="hint form-note">Мастер получит заявку и напишет вам в WhatsApp, чтобы подтвердить запись.</p>
    </form>`;
  sheet.hidden = false;
  document.documentElement.classList.add('locked');
  history.pushState({ form: true }, '');

  const form = $('#request-form');
  const chosen = () => [...form.querySelectorAll('.chip.on')].map(c => c.dataset.service);
  // Сколько займут услуги и успеют ли они до следующей записи (расписание с 1.8.0).
  const day = (schedule.days || []).find(d => d.date === date);
  const timed = Boolean(day && Array.isArray(day.busy));
  const minutesOf = names => L.servicesDuration(names, schedule.services, L.scheduleSettings(schedule));
  const fits = names => {
    if (!timed || !names.length) return true;
    const clock = L.masterClock(schedule.tzOffset || 0);
    return L.scheduleTimes(schedule, day, minutesOf(names), date === clock.date ? clock.minutes : -1).includes(time);
  };
  const tooLong = `На ${L.shortTime(time)} эти услуги не поместятся — до следующей записи не хватит времени. Выберите время раньше или меньше услуг.`;
  form.addEventListener('click', e => {
    const chip = e.target.closest('.chip[data-service]');
    if (!chip) return;
    chip.classList.toggle('on');
    const names = chosen();
    const sum = [...form.querySelectorAll('.chip.on')].reduce((t, c) => t + Number(c.dataset.price), 0);
    const minutes = timed && names.length ? minutesOf(names) : 0;
    const box = $('#total');
    box.hidden = !sum && !minutes;
    box.innerHTML = `<span>${sum ? 'Примерная стоимость' : 'Время'}${minutes ? `<small>займёт около ${L.formatDuration(minutes)}</small>` : ''}</span><b>${sum ? L.formatMoney(sum) : ''}</b>`;
    const warn = $('#fit-warn');
    warn.hidden = fits(names);
    warn.textContent = tooLong;
  });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const v = name => form.elements.namedItem(name).value;
    const body = { date, time, name: v('name').trim(), phone: v('phone'), services: chosen(), comment: v('comment').trim(), website: v('website') };
    const error = !body.name ? 'Укажите имя'
      : L.phoneFieldDigits(body.phone).length < 10 ? 'Укажите номер телефона полностью'
      : !body.services.length ? 'Выберите вид работы'
      : !fits(body.services) ? tooLong
      : '';
    if (error) return showError(error);
    const button = form.querySelector('button[type=submit]');
    button.disabled = true;
    button.textContent = 'Отправляем…';
    let res, answer = {};
    try {
      res = await fetch(withMaster(`${API}/api/requests`), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      answer = await res.json().catch(() => ({}));
    } catch (err) {
      res = null;
    }
    button.disabled = false;
    button.textContent = 'Отправить заявку';
    if (!res) return showError('Нет интернета. Проверьте связь и попробуйте ещё раз');
    if (!res.ok) {
      showError(answer.error || 'Не удалось отправить заявку');
      if (res.status === 409) refresh();
      return;
    }
    remember({ name: body.name, phone: body.phone });
    if (answer.token) rememberBooking({ token: answer.token, m: MASTER || schedule.slug || '', date, time, services: body.services, status: 'pending' });
    showDone(date, time, body.services, answer.token);
    refresh();
  });
}

function showError(message) {
  const box = $('#form-error');
  box.textContent = message;
  box.hidden = false;
  box.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

function showDone(date, time, services, token) {
  sheet.querySelector('.sheet-body').outerHTML = `
    <div class="sheet-body okna-done">
      <p class="done-mark">✓</p>
      <h2>Заявка отправлена</h2>
      <p>${L.dayTitle(date)}, ${esc(L.shortTime(time))}<br>${esc(L.servicesLabel(services))}</p>
      <p class="hint">${esc(schedule.name || 'Мастер')} напишет вам в WhatsApp, чтобы подтвердить запись.${token ? ' По ссылке «Моя запись» видно, подтверждена ли она.' : ''}</p>
      ${token ? `<a class="btn secondary block" href="${bookingUrl(token)}">Моя запись</a>` : ''}
      <button type="button" class="btn primary block" data-close>Готово</button>
    </div>`;
}

// ---------- Личная страница клиента: его запись ----------

const BOOKING_STATUS = {
  pending: ['warn', 'Заявка ждёт подтверждения мастера'],
  confirmed: ['ok', 'Запись подтверждена'],
  done: ['ok', 'Запись состоялась. Спасибо!'],
  cancelled: ['bad', 'Запись отменена'],
  declined: ['bad', 'Мастер не смог принять заявку на это время'],
};

// Коротко — для списка «Мои записи».
const MINE_STATUS = {
  pending: ['warn', 'ждёт подтверждения'],
  confirmed: ['ok', 'подтверждена'],
  done: ['muted', 'состоялась'],
  cancelled: ['bad', 'отменена'],
  declined: ['bad', 'не принята'],
};

async function loadBooking(token) {
  try {
    const res = await fetch(`${API}/api/bookings/${encodeURIComponent(token)}`, { cache: 'no-store' });
    if (res.ok) return await res.json();
    if (res.status === 404) return { missing: true };
  } catch (e) { /* покажем ошибку */ }
  return null;
}

function renderBooking(b) {
  const master = (b.master && b.master.name) || 'Мастер';
  document.title = `Моя запись — ${master}`;
  const [tone, label] = BOOKING_STATUS[b.status] || BOOKING_STATUS.pending;
  const due = Math.max((b.total || 0) - (b.prepaid || 0), 0);
  const active = b.status === 'pending' || b.status === 'confirmed';
  const whatsapp = L.phoneDigits(b.master && b.master.whatsapp);
  view.innerHTML = `
    <h2 class="okna-title">Моя запись<small>мастер ${esc(master)}</small></h2>
    <p class="status ${tone} booking-status">${label}</p>
    <section class="card booking-card${active ? '' : ' past'}">
      <p class="lead"><b>${L.dayTitle(b.date)}, ${esc(L.shortTime(b.time))}</b></p>
      <p>${esc(L.servicesLabel(b.services || []))}</p>
      ${b.total ? `
      <div class="line"><span>${b.status === 'pending' ? 'Примерная стоимость' : 'Стоимость'}</span><b>${L.formatMoney(b.total)}</b></div>
      ${b.prepaid ? `<div class="line"><span>Предоплата</span><b>${L.formatMoney(b.prepaid)}</b></div>` : ''}
      ${b.status === 'confirmed' && b.prepaid ? `<div class="line"><span>Останется оплатить</span><b>${L.formatMoney(due)}</b></div>` : ''}` : ''}
    </section>
    ${placeHtml(b.master && b.master.address, b.master && b.master.gis)}
    ${b.status === 'pending' ? `<p class="hint">${esc(master)} напишет вам в WhatsApp, чтобы подтвердить запись. Эта страница обновится сама.</p>` : ''}
    ${b.status === 'declined' ? '<p class="hint">Выберите другое время или напишите мастеру.</p>' : ''}
    ${whatsapp ? `<a class="btn secondary block" href="https://wa.me/${whatsapp}" target="_blank" rel="noopener">Написать мастеру в WhatsApp</a>` : ''}
    <a class="btn ${active ? 'ghost' : 'primary'} block" href="${esc(withMaster(location.pathname, b.master && b.master.slug))}">${active ? 'Свободное время' : 'Выбрать другое время'}</a>
    <p class="okna-foot">Сохраните эту страницу — по ней всегда видна ваша запись.</p>`;
}

async function startBooking(token) {
  const b = await loadBooking(token);
  if (!b) {
    view.innerHTML = '<div class="empty"><p>Не удалось загрузить запись. Проверьте интернет.</p><button class="btn secondary small" onclick="location.reload()">Обновить</button></div>';
    return;
  }
  if (b.missing) {
    view.innerHTML = `<h2 class="okna-title">Моя запись</h2><div class="empty"><p>Запись не найдена. Возможно, ссылка устарела.</p><a class="btn secondary small" href="${esc(location.pathname)}">Свободное время</a></div>`;
    return;
  }
  renderBooking(b);
  rememberBooking(bookingEntry(token, b));
  // Пока клиент смотрит, мастер могла подтвердить или перенести запись. Свёрнутая
  // вкладка сервер не спрашивает — обновимся, когда клиент к ней вернётся.
  const update = async () => {
    if (document.visibilityState !== 'visible') return;
    const fresh = await loadBooking(token);
    if (fresh && !fresh.missing) renderBooking(fresh);
  };
  setInterval(update, 30000);
  document.addEventListener('visibilitychange', update);
}

function closeForm() {
  if (history.state && history.state.form) history.back();
  else hideForm();
}

function hideForm() {
  sheet.hidden = true;
  sheet.innerHTML = '';
  document.documentElement.classList.remove('locked');
}

addEventListener('popstate', hideForm);

sheet.addEventListener('click', e => {
  if (e.target.closest('[data-close]')) closeForm();
});

view.addEventListener('click', e => {
  const time = e.target.closest('button.chip[data-time]');
  if (time) {
    openForm(time.dataset.date, time.dataset.time);
    return;
  }
  const head = e.target.closest('button.okna-head');
  if (!head) return;
  const day = head.closest('.okna-day');
  const open = !day.classList.contains('open');
  day.classList.toggle('open', open);
  head.setAttribute('aria-expanded', String(open));
  day.querySelector('.okna-times').hidden = !open;
  if (open) openDay = day.dataset.day;
});

// «Ввод» на клавиатуре прячет её, а не отправляет форму раньше времени.
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
    e.preventDefault();
    e.target.blur();
  }
});

async function refresh() {
  const fresh = await load();
  if (fresh && fresh.kind === 'okna') {
    schedule = fresh;
    render();
  }
}

async function start() {
  if (history.state && history.state.form) history.replaceState(null, '');
  const token = new URLSearchParams(location.search).get('z');
  if (token) {
    startBooking(token);
    return;
  }
  schedule = await load();
  if (schedule && schedule.missing) {
    view.innerHTML = '<div class="empty"><p>Мастер не найден. Проверьте ссылку — её можно попросить у мастера.</p></div>';
    return;
  }
  if (!schedule || schedule.kind !== 'okna') {
    view.innerHTML = `
      <div class="empty">
        <p>Не удалось загрузить свободное время. Проверьте интернет.</p>
        <button class="btn secondary small" onclick="location.reload()">Обновить</button>
      </div>`;
    return;
  }
  render();
  refreshMine();
  // Пока страница открыта, время могли занять — обновляем раз в минуту (свёрнутую — когда к ней вернутся).
  const update = () => { if (sheet.hidden && document.visibilityState === 'visible') refresh(); };
  setInterval(update, 60000);
  document.addEventListener('visibilitychange', update);
}

start();
