// Страница для клиентов: свободное время мастера и заявка на запись.
// С параметром ?z=<ссылка> — личная страница клиента с его записью.
// Данные — с сервера заявок (backend/): свободное время уже без занятого другими заявками.

import * as L from '../logic.js';
import { API_URL } from '../config.js';
import { phoneMask } from '../phone-input.js';
import { t, getLang, setLang, otherLangLabel } from '../i18n.js';

phoneMask();

let API = API_URL;
try { API = localStorage.getItem('kae:api') || API_URL; } catch (e) { /* приватный режим */ }

const $ = sel => document.querySelector(sel);
const view = $('#view'), sheet = $('#sheet');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const chevron = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
const closeIcon = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const pinIcon = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>';
const instagramIcon = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r=".4"/></svg>';

// Где принимает мастер: адрес, кнопки 2ГИС и Instagram. Ссылку ещё раз проверяет L.gisLink — только 2ГИС,
// ник — L.instagramName (буквы, цифры, точка и «_»).
function placeHtml(master) {
  const text = L.addressText(master.address), link = L.gisLink(master.gis), insta = L.instagramName(master.instagram);
  if (!text && !link && !insta) return '';
  return `
    <div class="okna-place">
      ${text ? `<p>${pinIcon}<span>${esc(text)}</span></p>` : ''}
      ${link ? `<a class="btn small secondary" href="${esc(link)}" target="_blank" rel="noopener">${t('Открыть в 2ГИС')}</a>` : ''}
      ${insta ? `<a class="btn small secondary" href="https://www.instagram.com/${esc(insta)}/" target="_blank" rel="noopener">${instagramIcon} Instagram</a>` : ''}
    </div>`;
}

// Цвета — как в приложении мастера (тема из его расписания); светлый или тёмный режим — как в телефоне клиента.
// Тему запоминаем, чтобы при следующем открытии страница сразу была в цветах мастера.
const themeKey = slug => `kae-okna:theme:${slug || 'legacy'}`;

function applyTheme(theme, slug) {
  const id = L.THEMES[theme] ? theme : 'plum';
  const root = document.documentElement;
  if (root.dataset.theme !== id) root.dataset.theme = id;
  try { localStorage.setItem(themeKey(slug), id); } catch (e) { /* не страшно */ }
  const style = getComputedStyle(root);
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => {
    const color = style.getPropertyValue(String(m.media).includes('dark') ? '--d-bar2' : '--l-bar2').trim();
    if (color) m.content = color;
  });
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

try {
  const early = new URLSearchParams(location.search).has('z') ? '' : localStorage.getItem(themeKey(MASTER));
  if (early && L.THEMES[early]) document.documentElement.dataset.theme = early;
} catch (e) { /* приватный режим — исходные цвета */ }

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
      return clean && { ...clean, booking: raw.booking === true, legacy: raw.legacy === true, paused: raw.paused === true, slug: String(raw.slug || '').replace(/[^\w-]/g, '') };
    }
    if (res.status === 404) return { missing: true };
  } catch (e) { /* покажем ошибку */ }
  return null;
}

function whatsappLink(text) {
  return `https://wa.me/${L.phoneDigits(schedule.whatsapp)}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

// Что сейчас на экране — чтобы перерисовать его на другом языке (кнопка «Қаз» / «Рус» в шапке).
let redraw = () => {};
const show = draw => {
  redraw = draw;
  draw();
};
const message = (text, extra = '') => show(() => {
  view.innerHTML = `<div class="empty"><p>${t(text)}</p>${extra ? extra() : ''}</div>`;
});
const reloadButton = () => `<button class="btn secondary small" data-reload>${t('Обновить')}</button>`;

function drawHeader() {
  const box = $('#appbar-actions');
  if (box) box.innerHTML = `<button class="hbtn lang-btn" data-lang-toggle aria-label="${t('Сменить язык')}">${otherLangLabel()}</button>`;
}

function render() {
  redraw = render;
  const s = schedule;
  const name = s.name || t('Мастер');
  document.title = t('Запись — {name}', { name });
  applyTheme(s.theme, MASTER || s.slug);
  // Шапка — как в приложении (логотип и Beautybook, в okna/index.html), имя и направление мастера — в заголовке.
  const title = `<h2 class="okna-title">${t('Запись к мастеру: {name}', { name: esc(name) })}${s.specialty ? `<small>${esc(L.specialtyName(s.specialty))}</small>` : ''}</h2>`;
  // Подписка мастера на Beautybook закончилась: онлайн-запись на паузе, записаться — через WhatsApp.
  if (s.paused) {
    view.innerHTML = `
      ${title}
      ${placeHtml(s)}
      <section class="card page-card">
        <p>${t('Онлайн-запись к этому мастеру временно недоступна.')}</p>
        ${s.whatsapp ? `<a class="btn primary block" href="${esc(whatsappLink(t('Здравствуйте! Хочу записаться к вам.')))}" target="_blank" rel="noopener">${t('Написать мастеру в WhatsApp')}</a>` : `<p class="hint">${t('Свяжитесь с мастером, чтобы записаться.')}</p>`}
      </section>`;
    return;
  }

  const clock = L.masterClock(s.tzOffset || 0);
  // Время свободно, если в него помещается хотя бы самая короткая услуга;
  // подходят ли выбранные услуги, форма проверит после выбора.
  const need = L.shortestService(s.services, L.scheduleSettings(s));
  const days = (s.days || []).filter(d => d.date >= clock.date).map(d => ({
    ...d,
    times: L.scheduleTimes(s, d, need, d.date === clock.date ? clock.minutes : -1),
  })).filter(d => d.date > clock.date || d.off || d.times.length); // сегодня без времени — не показываем
  if (!days.length) {
    view.innerHTML = `${title}<div class="empty"><p>${t('Свободное время скоро появится. Загляните позже.')}</p></div>`;
    return;
  }

  if (!openDay || !days.some(d => d.date === openDay && d.times.length)) {
    openDay = (days.find(d => d.times.length) || {}).date || null;
  }
  const updated = new Date(s.updated);
  const stale = Date.now() - updated > 3 * 864e5;
  const rows = days.map(d => {
    const summary = d.off ? t('запись закрыта') : d.times.length ? L.formatRanges(L.toRanges(d.times)) : t('всё занято');
    if (!d.times.length) {
      return `
        <section class="card okna-day none">
          <div class="okna-head"><span><b>${L.dayTitle(d.date)}</b><small>${esc(summary)}</small></span></div>
        </section>`;
    }
    const open = d.date === openDay;
    const chips = d.times.map(time => (s.booking
      ? `<button type="button" class="chip" data-date="${esc(d.date)}" data-time="${esc(time)}">${esc(L.shortTime(time))}</button>`
      : s.whatsapp
        ? `<a class="chip" href="${esc(whatsappLink(t('Здравствуйте! Хочу записаться к вам: {date}, {time}.', { date: L.shortDate(d.date), time: L.shortTime(time) })))}" target="_blank" rel="noopener">${esc(L.shortTime(time))}</a>`
        : `<span class="chip">${esc(L.shortTime(time))}</span>`)).join('');
    return `
      <section class="card okna-day${open ? ' open' : ''}" data-day="${esc(d.date)}">
        <button class="okna-head" aria-expanded="${open}">
          <span><b>${L.dayTitle(d.date)}</b><small>${t('свободно: {ranges}', { ranges: esc(summary) })}</small></span>${chevron}
        </button>
        <div class="chips okna-times"${open ? '' : ' hidden'}>${chips}</div>
      </section>`;
  }).join('');

  const intro = s.booking
    ? t('Выберите день и время начала, затем укажите имя, телефон и услуги.')
    : s.whatsapp ? t('Выберите день и время начала — откроется WhatsApp, чтобы записаться.') : t('Чтобы записаться, напишите мастеру.');
  // Записи, оставленные до аккаунтов (без m), — у прежнего мастера.
  const mine = myBookings().filter(b => b.date >= clock.date && (b.m ? b.m === s.slug : Boolean(s.legacy)));
  view.innerHTML = `
    ${title}
    ${placeHtml(s)}
    ${mine.length ? `
    <section class="my-bookings">
      <h2 class="section-title">${t('Мои записи')}</h2>
      ${mine.map(b => {
        const [tone, label] = MINE_STATUS[b.status] || [];
        return `<a class="card my-booking" href="${esc(bookingUrl(b.token))}"><b>${L.dayTitle(b.date)}, ${esc(L.shortTime(b.time))}</b><small>${esc(L.servicesLabel(b.services || []))}</small>${label ? `<span class="badge ${tone}">${t(label)}</span>` : ''}</a>`;
      }).join('')}
    </section>` : ''}
    <p class="okna-intro">${intro} ${s.v >= 2 ? t('Сколько займёт запись, покажем после выбора услуг.') : t('Одна запись занимает до {duration}.', { duration: L.formatDuration(s.duration || 150) })}
      ${s.whatsapp ? `<br><a href="${esc(whatsappLink(''))}" target="_blank" rel="noopener">${t('Написать мастеру в WhatsApp')}</a>` : ''}</p>
    ${stale ? `<div class="banner warn"><div class="grow">${t('Расписание давно не обновлялось — уточните время у мастера.')}</div></div>` : ''}
    ${rows}
    <p class="okna-foot">${t('Обновлено {date} в {time}', { date: `${updated.getDate()} ${L.dateMonth(updated.getMonth())}`, time: `${updated.getHours()}:${String(updated.getMinutes()).padStart(2, '0')}` })}</p>`;
}

// ---------- Заявка ----------

function openForm(date, time) {
  const me = remembered();
  const services = schedule.services || [];
  sheet.setAttribute('aria-label', t('Заявка на запись'));
  sheet.innerHTML = `
    <header class="sheet-head">
      <button type="button" class="icon-btn" data-close aria-label="${t('Закрыть')}">${closeIcon}</button>
      <h2>${t('Запись')}</h2>
      <span></span>
    </header>
    <form id="request-form" class="sheet-body" novalidate autocomplete="on">
      <p class="lead"><b>${L.dayTitle(date)}, ${esc(L.shortTime(time))}</b></p>
      <label>${t('Ваше имя')}<input name="name" autocomplete="name" autocapitalize="words" enterkeyhint="next" value="${esc(me.name)}" placeholder="${t('Например, Айгуль')}"></label>
      <label>${t('Телефон (WhatsApp)')}<input name="phone" type="tel" autocomplete="tel" enterkeyhint="done" value="${esc(L.phoneFieldStart(me.phone))}"></label>
      ${services.length ? `
      <fieldset>
        <legend>${t('Что будем делать — можно несколько')}</legend>
        <div class="chips">${services.map(p => `
          <button type="button" class="chip" data-service="${esc(p.name)}" data-price="${L.toMoney(p.price)}">
            ${esc(p.name)}${p.price ? `<small>${L.formatAmount(p.price)} ₸</small>` : ''}
          </button>`).join('')}
        </div>
      </fieldset>` : `
      <label>${t('Что будем делать')}<input name="service" maxlength="60" enterkeyhint="next" placeholder="${t('Например, стрижка')}"></label>`}
      <div class="summary" id="total" hidden></div>
      <p id="fit-warn" class="warn-text" hidden></p>
      <label>${t('Комментарий (необязательно)')}<input name="comment" enterkeyhint="done" maxlength="300" placeholder="${t('Пожелания мастеру')}"></label>
      <input name="website" class="trap" tabindex="-1" autocomplete="off" aria-hidden="true">
      <p id="form-error" class="warn-text" hidden></p>
      <button type="submit" class="btn primary block">${t('Отправить заявку')}</button>
      <p class="hint form-note">${t('Мастер получит заявку и напишет вам в WhatsApp, чтобы подтвердить запись.')}</p>
    </form>`;
  sheet.hidden = false;
  document.documentElement.classList.add('locked');
  history.pushState({ form: true }, '');

  const form = $('#request-form');
  // Прайс мастера пуст (новый мастер ещё не заполнил) — клиент пишет услугу сам; сервер примет её как текст.
  const chosen = () => (services.length ? [...form.querySelectorAll('.chip.on')].map(c => c.dataset.service)
    : [form.elements.namedItem('service').value.trim().replace(/\s+/g, ' ').slice(0, 60)].filter(Boolean));
  // Сколько займут услуги и успеют ли они до следующей записи (расписание с 1.8.0).
  const day = (schedule.days || []).find(d => d.date === date);
  const timed = Boolean(day && Array.isArray(day.busy));
  const minutesOf = names => L.servicesDuration(names, schedule.services, L.scheduleSettings(schedule));
  const fits = names => {
    if (!timed || !names.length) return true;
    const clock = L.masterClock(schedule.tzOffset || 0);
    return L.scheduleTimes(schedule, day, minutesOf(names), date === clock.date ? clock.minutes : -1).includes(time);
  };
  const tooLong = t('На {time} эти услуги не поместятся — до следующей записи не хватит времени. Выберите время пораньше или меньше услуг.', { time: L.shortTime(time) });
  form.addEventListener('click', e => {
    const chip = e.target.closest('.chip[data-service]');
    if (!chip) return;
    chip.classList.toggle('on');
    const names = chosen();
    const sum = [...form.querySelectorAll('.chip.on')].reduce((total, c) => total + Number(c.dataset.price), 0);
    const minutes = timed && names.length ? minutesOf(names) : 0;
    const box = $('#total');
    box.hidden = !sum && !minutes;
    box.innerHTML = `<span>${sum ? t('Примерная стоимость') : t('Время')}${minutes ? `<small>${t('займёт около {duration}', { duration: L.formatDuration(minutes) })}</small>` : ''}</span><b>${sum ? L.formatMoney(sum) : ''}</b>`;
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
      : !body.services.length ? (services.length ? 'Выберите, что будем делать' : 'Напишите, что будем делать')
      : !fits(body.services) ? tooLong
      : '';
    if (error) return showError(error);
    const button = form.querySelector('button[type=submit]');
    button.disabled = true;
    button.textContent = t('Отправляем…');
    let res, answer = {};
    try {
      res = await fetch(withMaster(`${API}/api/requests`), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      answer = await res.json().catch(() => ({}));
    } catch (err) {
      res = null;
    }
    button.disabled = false;
    button.textContent = t('Отправить заявку');
    if (!res) return showError('Нет интернета. Проверьте связь и попробуйте ещё раз');
    if (!res.ok) {
      showError(answer.error || 'Не удалось отправить заявку'); // сервер отвечает по-русски — перевод по словарю
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
  box.textContent = t(message);
  box.hidden = false;
  box.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

function showDone(date, time, services, token) {
  sheet.querySelector('.sheet-body').outerHTML = `
    <div class="sheet-body okna-done">
      <p class="done-mark">✓</p>
      <h2>${t('Заявка отправлена')}</h2>
      <p>${L.dayTitle(date)}, ${esc(L.shortTime(time))}<br>${esc(L.servicesLabel(services))}</p>
      <p class="hint">${t('{name} напишет вам в WhatsApp, чтобы подтвердить запись.', { name: esc(schedule.name || t('Мастер')) })}${token ? ` ${t('По ссылке «Моя запись» видно, подтверждена ли она.')}` : ''}</p>
      ${token ? `<a class="btn secondary block" href="${bookingUrl(token)}">${t('Моя запись')}</a>` : ''}
      <button type="button" class="btn primary block" data-close>${t('Готово')}</button>
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
  redraw = () => renderBooking(b);
  const master = (b.master && b.master.name) || t('Мастер');
  document.title = t('Моя запись — {name}', { name: master });
  applyTheme(b.master && b.master.theme, b.master && b.master.slug);
  const [tone, label] = BOOKING_STATUS[b.status] || BOOKING_STATUS.pending;
  const due = Math.max((b.total || 0) - (b.prepaid || 0), 0);
  const active = b.status === 'pending' || b.status === 'confirmed';
  const whatsapp = L.phoneDigits(b.master && b.master.whatsapp);
  view.innerHTML = `
    <h2 class="okna-title">${t('Моя запись')}<small>${t('мастер {name}', { name: esc(master) })}</small></h2>
    <p class="status ${tone} booking-status">${t(label)}</p>
    <section class="card booking-card${active ? '' : ' past'}">
      <p class="lead"><b>${L.dayTitle(b.date)}, ${esc(L.shortTime(b.time))}</b></p>
      <p>${esc(L.servicesLabel(b.services || []))}</p>
      ${b.total ? `
      <div class="line"><span>${b.status === 'pending' ? t('Примерная стоимость') : t('Стоимость')}</span><b>${L.formatMoney(b.total)}</b></div>
      ${b.prepaid ? `<div class="line"><span>${t('Предоплата')}</span><b>${L.formatMoney(b.prepaid)}</b></div>` : ''}
      ${b.status === 'confirmed' && b.prepaid ? `<div class="line"><span>${t('Останется оплатить')}</span><b>${L.formatMoney(due)}</b></div>` : ''}` : ''}
    </section>
    ${placeHtml(b.master || {})}
    ${b.status === 'pending' ? `<p class="hint">${t('{name} напишет вам в WhatsApp, чтобы подтвердить запись. Эта страница обновится сама.', { name: esc(master) })}</p>` : ''}
    ${b.status === 'declined' ? `<p class="hint">${t('Выберите другое время или напишите мастеру.')}</p>` : ''}
    ${whatsapp ? `<a class="btn secondary block" href="https://wa.me/${whatsapp}" target="_blank" rel="noopener">${t('Написать мастеру в WhatsApp')}</a>` : ''}
    <a class="btn ${active ? 'ghost' : 'primary'} block" href="${esc(withMaster(location.pathname, b.master && b.master.slug))}">${active ? t('Свободное время') : t('Выбрать другое время')}</a>
    <p class="okna-foot">${t('Сохраните эту страницу — на ней всегда видна ваша запись.')}</p>`;
}

async function startBooking(token) {
  const b = await loadBooking(token);
  if (!b) return message('Не удалось загрузить запись. Проверьте интернет.', reloadButton);
  if (b.missing) {
    show(() => {
      view.innerHTML = `<h2 class="okna-title">${t('Моя запись')}</h2><div class="empty"><p>${t('Запись не найдена. Возможно, ссылка устарела.')}</p><a class="btn secondary small" href="${esc(location.pathname)}">${t('Свободное время')}</a></div>`;
    });
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
  drawHeader();
  const token = new URLSearchParams(location.search).get('z');
  message(token ? 'Загружаем запись…' : 'Загружаем свободное время…');
  if (token) {
    startBooking(token);
    return;
  }
  schedule = await load();
  if (schedule && schedule.missing) return message('Мастер не найден. Проверьте ссылку — её можно попросить у мастера.');
  if (!schedule || schedule.kind !== 'okna') return message('Не удалось загрузить свободное время. Проверьте интернет.', reloadButton);
  render();
  refreshMine();
  // Пока страница открыта, время могли занять — обновляем раз в минуту (свёрнутую — когда к ней вернутся).
  const update = () => { if (sheet.hidden && document.visibilityState === 'visible') refresh(); };
  setInterval(update, 60000);
  document.addEventListener('visibilitychange', update);
}

// Кнопки «Обновить» на экранах ошибок (встроенный onclick запрещён политикой безопасности страницы)
// и язык в шапке: страница сразу перерисовывается на другом языке.
document.addEventListener('click', e => {
  if (e.target.closest('[data-reload]')) location.reload();
  if (e.target.closest('[data-lang-toggle]')) {
    setLang(getLang() === 'kk' ? 'ru' : 'kk');
    drawHeader();
    redraw();
  }
});

start();
