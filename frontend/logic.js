// Логика без интерфейса: даты, деньги, рабочее время и свободные окошки,
// заявки клиентов, отчёт за месяц, телефоны, клиенты, резервная копия.
// Общая для приложения, страницы клиентов и сервера (backend/ берёт этот файл при выкладке).
// Проверяется тестами в tests/.

export const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
export const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
export const WEEKDAYS = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
export const WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

// Стартовый прайс без цен: цены Арай вносит сама в «Настройках».
export const DEFAULT_SERVICES = ['Наращивание', 'Маникюр', 'Снятие маникюра', 'Педикюр', 'Маникюр+Педикюр'];
export const DEFAULT_RENT = 70000;

// Рабочее время: запись можно начать с dayStart до lastStart включительно,
// между началами записей — не меньше duration минут (наращивание — 2 ч 30 мин).
export const DEFAULT_SETTINGS = { dayStart: '09:00', lastStart: '20:00', duration: 150, clientName: 'Арай', whatsapp: '', theme: 'plum' };
// Темы оформления: id → название в «Настройках». Цвета — в style.css.
export const THEMES = { rose: 'Розовая', plum: 'Пурпурная', lavender: 'Фиолетовая' };
// Клиентам время предлагается с шагом 30 минут.
export const SLOT_STEP = 30;
// На сколько дней вперёд публикуются свободные окошки.
export const HORIZON_DAYS = 30;

// booked — записана (получена только предоплата), paid — оплачено полностью,
// cancelled — отменена (предоплата остаётся у мастера, если её не вернули).
export const STATUSES = ['booked', 'paid', 'cancelled'];
export const STATUS_LABELS = { booked: 'Записана', paid: 'Оплачено', cancelled: 'Отменена' };

// ---------- Даты ----------
// Только местное время: toISOString() сдвинул бы дату (Казахстан — UTC+5).

const pad2 = n => String(n).padStart(2, '0');

export function ymd(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function parseYmd(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function monthOf(dateStr) {
  return dateStr.slice(0, 7);
}

export function addMonths(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

export function monthTitle(ym) {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export function dayTitle(dateStr) {
  const d = parseYmd(dateStr);
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
}

export function shortDate(dateStr) {
  const d = parseYmd(dateStr);
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
}

export function addDays(dateStr, n) {
  const d = parseYmd(dateStr);
  d.setDate(d.getDate() + n);
  return ymd(d);
}

// Клетки календаря: недели с понедельника, 5 или 6 строк.
export function monthGrid(ym) {
  const [y, m] = ym.split('-').map(Number);
  const shift = (new Date(y, m - 1, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(y, m, 0).getDate();
  const cells = Math.ceil((shift + daysInMonth) / 7) * 7;
  const out = [];
  for (let i = 0; i < cells; i++) out.push(ymd(new Date(y, m - 1, 1 - shift + i)));
  return out;
}

// plural(5, ['запись', 'записи', 'записей']) → 'записей'
export function plural(n, forms) {
  const n10 = n % 10, n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return forms[0];
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return forms[1];
  return forms[2];
}

// ---------- Услуги: в одной записи может быть несколько ----------

// Старые записи хранили одну услугу строкой в поле service.
export function servicesOf(a) {
  if (Array.isArray(a.services)) return a.services;
  return a.service ? [a.service] : [];
}

export function servicesLabel(list) {
  return list.join(' + ');
}

// Сумма по прайсу; услуги, которых в прайсе нет, не считаются.
export function servicesTotal(names, prices) {
  return names.reduce((sum, name) => {
    const p = prices.find(x => x.name === name);
    return sum + (p ? p.price : 0);
  }, 0);
}

// ---------- Деньги: целые тенге ----------

// «12 000» → 12000. В поле суммы вводятся только цифры.
export function toMoney(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  const digits = String(value == null ? '' : value).replace(/\D/g, '').slice(0, 9);
  return digits ? parseInt(digits, 10) : 0;
}

function groupDigits(n, sep) {
  return String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

// 70000 → «70 000 ₸», −5000 → «−5 000 ₸» (неразрывные пробелы).
export function formatMoney(n) {
  return `${n < 0 ? '−' : ''}${groupDigits(n, ' ')} ₸`;
}

// Для полей ввода: 12000 → «12 000», 0 → пусто.
export function formatAmount(n) {
  return n ? groupDigits(n, ' ') : '';
}

// ---------- Запись: сколько получено и сколько осталось ----------

export function received(a) {
  return a.status === 'paid' ? a.total : a.prepaid;
}

export function balanceDue(a) {
  return a.status === 'booked' ? Math.max(a.total - a.prepaid, 0) : 0;
}

// ---------- Аренда: каждая сумма действует с месяца from ----------

export function rentFor(history, ym) {
  let best = null;
  for (const r of history) if (r.from <= ym && (!best || r.from > best.from)) best = r;
  return best ? best.amount : 0;
}

// Новая сумма с месяца ym; прошлые месяцы сохраняют старую.
export function setRent(history, ym, amount) {
  return history.filter(r => r.from < ym).concat({ from: ym, amount });
}

// ---------- Отчёт за месяц ----------
// Приход — деньги, реально полученные по записям месяца:
// полная сумма оплаченных записей и предоплаты остальных.

export function monthReport(data, ym) {
  let income = 0, expected = 0, paidVisits = 0;
  for (const a of data.appointments) {
    if (monthOf(a.date) !== ym) continue;
    income += received(a);
    expected += balanceDue(a);
    if (a.status === 'paid') paidVisits++;
  }
  let materials = 0;
  for (const e of data.expenses) if (monthOf(e.date) === ym) materials += e.amount;
  const rent = rentFor(data.rent, ym);
  return { income, materials, rent, profit: income - materials - rent, expected, paidVisits };
}

// ---------- Время ----------

export function toMinutes(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + (m || 0);
}

export function fromMinutes(min) {
  return `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`;
}

// '09:00' → '9:00'
export function shortTime(hhmm) {
  return String(hhmm).replace(/^0(\d)/, '$1');
}

// 150 → '2 ч 30 мин'
export function formatDuration(min) {
  const h = Math.floor(min / 60), m = min % 60;
  return [h ? `${h} ч` : '', m ? `${m} мин` : ''].filter(Boolean).join(' ');
}

// ---------- Закрытые дни и свободное время ----------

// Блок записи: { id, from, to, note } — даты включительно.
export function blockFor(blocks, date) {
  return (blocks || []).find(b => b.from <= date && date <= b.to) || null;
}

function busyStarts(appointments, date, excludeId) {
  return appointments.filter(a => a.date === date && a.status !== 'cancelled' && a.time && a.id !== excludeId);
}

// Записи, которые мешают начать новую в time: между началами меньше duration.
export function conflicts(appointments, date, time, duration, excludeId) {
  const t = toMinutes(time);
  return busyStarts(appointments, date, excludeId).filter(a => Math.abs(toMinutes(a.time) - t) < duration);
}

// Свободное время начала записи в этот день, с шагом SLOT_STEP.
// after — минуты: время не позже него не предлагается (для сегодняшнего дня).
export function freeTimes(appointments, date, settings, after = -1, excludeId) {
  const busy = busyStarts(appointments, date, excludeId).map(a => toMinutes(a.time));
  const out = [];
  for (let s = toMinutes(settings.dayStart); s <= toMinutes(settings.lastStart); s += SLOT_STEP) {
    if (s > after && busy.every(b => Math.abs(b - s) >= settings.duration)) out.push(fromMinutes(s));
  }
  return out;
}

// ['09:00', '09:30', '14:30'] → [['09:00', '09:30'], ['14:30', '14:30']]
export function toRanges(times) {
  const ranges = [];
  for (const t of times) {
    const last = ranges[ranges.length - 1];
    if (last && toMinutes(t) - toMinutes(last[1]) === SLOT_STEP) last[1] = t;
    else ranges.push([t, t]);
  }
  return ranges;
}

// → '9:00–9:30, 14:30'
export function formatRanges(ranges) {
  return ranges.map(([a, b]) => (a === b ? shortTime(a) : `${shortTime(a)}–${shortTime(b)}`)).join(', ');
}

// Что видят клиенты: свободное время на days дней вперёд, без имён и телефонов.
// Прошедшее время сегодняшнего дня страница клиентов отсекает сама.
export function buildSchedule(data, now = new Date(), days = HORIZON_DAYS) {
  const s = { ...DEFAULT_SETTINGS, ...data.settings };
  const first = ymd(now);
  const list = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(first, i);
    list.push(blockFor(data.blocks, date) ? { date, off: true } : { date, times: freeTimes(data.appointments, date, s) });
  }
  return {
    app: BACKUP_APP,
    kind: 'okna',
    name: s.clientName,
    whatsapp: phoneDigits(s.whatsapp),
    duration: s.duration,
    tzOffset: now.getTimezoneOffset(),
    services: (data.prices || []).filter(p => p.name && p.name.trim()).map(p => ({ name: p.name.trim(), price: p.price })),
    updated: now.toISOString(),
    days: list,
  };
}

// «Сейчас» по часам мастера: tzOffset — как getTimezoneOffset() на её телефоне.
export function masterClock(tzOffset, nowMs = Date.now()) {
  const d = new Date(nowMs - tzOffset * 60000);
  return {
    date: `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`,
    minutes: d.getUTCHours() * 60 + d.getUTCMinutes(),
  };
}

// ---------- Заявки клиентов ----------

// Заявки, которые ждут подтверждения, занимают время так же, как записи.
export function applyHolds(schedule, holds) {
  const byDate = {};
  for (const h of holds) (byDate[h.date] = byDate[h.date] || []).push(toMinutes(h.time));
  return {
    ...schedule,
    days: schedule.days.map(d => (d.off || !byDate[d.date] ? d : {
      ...d,
      times: d.times.filter(t => byDate[d.date].every(h => Math.abs(h - toMinutes(t)) >= schedule.duration)),
    })),
  };
}

// Проверяет заявку клиента по опубликованному расписанию (уже с учётом других заявок).
// clock — «сейчас» по часам мастера. Возвращает { ok: true, request } или { ok: false, status, error }.
export function validateRequest(body, schedule, clock) {
  const fail = (error, status = 400) => ({ ok: false, status, error });
  const b = body && typeof body === 'object' ? body : {};
  const name = String(b.name || '').trim().replace(/\s+/g, ' ');
  if (!name || name.length > 60) return fail('Укажите имя');
  const digits = phoneDigits(b.phone);
  if (digits.length < 10 || digits.length > 15) return fail('Укажите номер телефона');
  const known = (schedule.services || []).map(x => x.name);
  const services = [...new Set((Array.isArray(b.services) ? b.services : []).map(x => String(x).trim()).filter(Boolean))];
  if (!services.length) return fail('Выберите вид работы');
  if (services.length > 10 || services.some(x => (known.length ? !known.includes(x) : x.length > 60))) return fail('Такой услуги нет в прайсе');
  if (!DATE_RE.test(b.date) || !TIME_RE.test(b.time)) return fail('Выберите день и время');
  const day = (schedule.days || []).find(d => d.date === b.date);
  const past = b.date < clock.date || (b.date === clock.date && toMinutes(b.time) <= clock.minutes);
  if (!day || day.off || past || !(day.times || []).includes(b.time)) return fail('Это время уже занято — выберите другое', 409);
  const comment = String(b.comment || '').trim().slice(0, 300);
  return { ok: true, request: { date: b.date, time: b.time, name, phone: formatPhone(digits), services, comment } };
}

// ---------- Личная ссылка клиента на запись ----------

// Что видит клиент по своей ссылке: pending — заявка ждёт ответа,
// confirmed — подтверждена, done — состоялась, cancelled — отменена, declined — отклонена.
export const BOOKING_STATUSES = ['confirmed', 'done', 'cancelled', 'declined'];

export function publicBooking(a) {
  return {
    status: a.status === 'paid' ? 'done' : a.status === 'cancelled' ? 'cancelled' : 'confirmed',
    date: a.date,
    time: a.time,
    name: a.name,
    services: servicesOf(a),
    total: a.total,
    prepaid: a.prepaid,
  };
}

// Проверка записи, которую телефон мастера выкладывает для клиента. null — неверная.
export function normalizeBooking(b) {
  if (!b || typeof b !== 'object' || !BOOKING_STATUSES.includes(b.status) || !DATE_RE.test(b.date) || !TIME_RE.test(b.time)) return null;
  return {
    status: b.status,
    date: b.date,
    time: b.time,
    name: String(b.name || '').trim().slice(0, 60),
    services: (Array.isArray(b.services) ? b.services : []).map(x => String(x).trim().slice(0, 60)).filter(Boolean).slice(0, 10),
    total: toMoney(b.total),
    prepaid: toMoney(b.prepaid),
  };
}

// Сообщение клиенту в WhatsApp после подтверждения записи.
export function confirmationText(a, link) {
  const what = servicesLabel(servicesOf(a)).toLowerCase();
  let text = `Здравствуйте${a.name ? ', ' + a.name : ''}! Ваша запись подтверждена: ${shortDate(a.date)} в ${shortTime(a.time)}${what ? ` (${what})` : ''}.`;
  if (a.prepaid) text += ` Предоплата ${formatMoney(a.prepaid)} получена.`;
  return `${text} Ваша запись: ${link}`;
}

// «Айгуль · 30 сентября в 14:30 · Маникюр + Педикюр» — для уведомления мастеру.
export function requestSummary(r) {
  return `${r.name} · ${shortDate(r.date)} в ${shortTime(r.time)} · ${servicesLabel(r.services)}`;
}

// ---------- base64url (ключи уведомлений и устройства) ----------

export function bytesToB64u(bytes) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64uToBytes(str) {
  const s = String(str).replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(s + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

// ---------- Телефоны ----------

// Цифры номера в международном виде: «8 (701) 123-45-67» → «77011234567».
export function phoneDigits(phone) {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.length === 11 && d[0] === '8') d = '7' + d.slice(1);
  else if (d.length === 10 && (d[0] === '7' || d[0] === '9')) d = '7' + d;
  return d;
}

// «+7 701 123 45 67» для номеров +7, остальные — как ввели.
export function formatPhone(phone) {
  const d = phoneDigits(phone);
  if (d.length === 11 && d[0] === '7') return `+7 ${d.slice(1, 4)} ${d.slice(4, 7)} ${d.slice(7, 9)} ${d.slice(9)}`;
  return String(phone || '').trim();
}

export function canDial(phone) {
  return phoneDigits(phone).length >= 10;
}

// Поле ввода телефона: «+7» в начале не меняется, дальше до 10 цифр
// группами «705 102 70 37». Вставленный номер «8 705…», «+7 (705)…», «7705…» приводится к тому же виду.
export const PHONE_PREFIX = '+7 ';

export function phoneFieldDigits(value) {
  const s = String(value || '').trim();
  let d;
  if (s.startsWith('+7')) d = s.slice(2).replace(/\D/g, '');
  else if (/^7\s/.test(s)) d = s.slice(1).replace(/\D/g, ''); // стёрли «+» у «+7»
  else {
    d = s.replace(/\D/g, '');
    if (d.length === 11 && (d[0] === '7' || d[0] === '8')) d = d.slice(1);
  }
  return d.slice(0, 10);
}

export function phoneFieldValue(value) {
  const d = phoneFieldDigits(value);
  return PHONE_PREFIX + [d.slice(0, 3), d.slice(3, 6), d.slice(6, 8), d.slice(8, 10)].filter(Boolean).join(' ');
}

// Что показать в поле: пустое — «+7 », номер +7 — по группам, другой номер — как был.
export function phoneFieldStart(phone) {
  if (!String(phone || '').trim()) return PHONE_PREFIX;
  const d = phoneDigits(phone);
  return d.length === 11 && d[0] === '7' ? phoneFieldValue('+' + d) : String(phone).trim();
}

// Что сохранить из поля: одно «+7» — номера нет.
export function phoneFromField(value) {
  return phoneFieldDigits(value) ? phoneFieldValue(value) : '';
}

// ---------- Сохранённые клиенты ----------
// Список клиентов собирается из записей. Отдельно хранятся только клиенты,
// которых мастер добавила вручную, без записи: data.clients — {id, name, phone, created}.

const norm = s => String(s || '').toLowerCase().replace(/ё/g, 'е').trim();

const newestFirst = (a, b) => (b.date + b.time).localeCompare(a.date + a.time);

// Один клиент — один номер (без номера — одно имя). Имя и номер берутся
// из самой свежей записи. visits — записи без отменённых, last — дата последней.
// saved — клиенты, добавленные вручную: у кого записей нет, visits = 0 и last = '';
// id — номер такого клиента в data.clients (по нему его можно удалить).
export function pastClients(appointments, saved = []) {
  const byKey = new Map();
  for (const a of [...appointments].sort(newestFirst)) {
    const key = phoneDigits(a.phone) || norm(a.name);
    if (!key) continue;
    let c = byKey.get(key);
    if (!c) byKey.set(key, c = { key, name: a.name, phone: a.phone, visits: 0, last: a.date });
    if (a.status !== 'cancelled') c.visits++;
  }
  for (const s of saved) {
    const key = phoneDigits(s.phone) || norm(s.name);
    if (!key) continue;
    const c = byKey.get(key);
    if (c) c.id = s.id;
    else byKey.set(key, { key, name: s.name, phone: s.phone, visits: 0, last: '', id: s.id });
  }
  // Записи без номера с тем же именем, что у клиента с номером, — это он же.
  const byName = new Map();
  for (const c of byKey.values()) if (phoneDigits(c.phone)) byName.set(norm(c.name), c);
  const out = [];
  for (const c of byKey.values()) {
    const owner = !phoneDigits(c.phone) && byName.get(norm(c.name));
    if (!owner) {
      out.push(c);
      continue;
    }
    owner.visits += c.visits;
    if (c.last > owner.last) owner.last = c.last;
    if (c.id && !owner.id) owner.id = c.id;
  }
  return out;
}

// Такой клиент уже есть? По номеру, а если номера нет — по имени.
export function findTwin(clients, name, phone) {
  const pd = phoneDigits(phone);
  return pd ? clients.find(c => phoneDigits(c.phone) === pd) : clients.find(c => norm(c.name) === norm(name));
}

// Все записи клиента, свежие первыми (по тем же правилам, что pastClients).
export function clientVisits(appointments, client) {
  const pd = phoneDigits(client.phone), name = norm(client.name);
  return appointments.filter(a => {
    const d = phoneDigits(a.phone);
    return d ? d === pd : norm(a.name) === name;
  }).sort(newestFirst);
}

export function sortByName(clients) {
  const label = c => c.name || c.phone;
  return [...clients].sort((a, b) => label(a).localeCompare(label(b), 'ru'));
}

// Поиск по имени (ё = е) или по цифрам номера (от 3 цифр, можно с 8 в начале).
export function findClients(clients, query) {
  const q = norm(query);
  if (!q) return clients;
  const qd = q.replace(/\D/g, '');
  return clients.filter(c => {
    if (norm(c.name).includes(q)) return true;
    if (qd.length < 3) return false;
    const pd = phoneDigits(c.phone);
    return pd.includes(qd) || (qd[0] === '8' && pd.includes('7' + qd.slice(1)));
  });
}

// ---------- Резервная копия ----------

export const BACKUP_APP = 'kae-zapis';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function makeBackup(data, now = new Date()) {
  return {
    app: BACKUP_APP,
    format: 1,
    exportedAt: now.toISOString(),
    appointments: data.appointments,
    expenses: data.expenses,
    prices: data.prices,
    rent: data.rent,
    settings: data.settings,
    blocks: data.blocks,
    clients: data.clients || [],
  };
}

// Разбирает файл копии и приводит поля к нужным типам.
// Бросает Error с понятным текстом, если это не наша копия.
export function readBackup(text) {
  let obj = null;
  try { obj = JSON.parse(text); } catch (e) { /* не JSON */ }
  if (!obj || obj.app !== BACKUP_APP || !Array.isArray(obj.appointments)) {
    throw new Error('Это не файл копии Nailapp');
  }
  const str = v => (v == null ? '' : String(v));
  const list = v => (Array.isArray(v) ? v : []);
  const appointments = obj.appointments.filter(a => a && DATE_RE.test(a.date)).map((a, i) => ({
    id: str(a.id) || 'r' + i,
    date: a.date,
    time: str(a.time),
    name: str(a.name),
    phone: str(a.phone),
    services: (Array.isArray(a.services) ? a.services : a.service ? [a.service] : []).map(x => str(x).trim()).filter(Boolean),
    total: toMoney(a.total),
    prepaid: toMoney(a.prepaid),
    status: STATUSES.includes(a.status) ? a.status : 'booked',
    note: str(a.note),
    photos: list(a.photos).filter(id => typeof id === 'string' && /^[\w-]+$/.test(id)),
    created: a.created || null,
    updated: a.updated || null,
  }));
  const expenses = list(obj.expenses).filter(e => e && DATE_RE.test(e.date)).map((e, i) => ({
    id: str(e.id) || 'e' + i, date: e.date, amount: toMoney(e.amount), note: str(e.note),
  }));
  const prices = list(obj.prices).filter(p => p && p.name).map((p, i) => ({
    id: str(p.id) || 'p' + i, name: str(p.name), price: toMoney(p.price),
  }));
  const rent = list(obj.rent).filter(r => r && /^\d{4}-\d{2}$/.test(r.from)).map(r => ({
    from: r.from, amount: toMoney(r.amount),
  }));
  const blocks = list(obj.blocks).filter(b => b && DATE_RE.test(b.from) && DATE_RE.test(b.to)).map((b, i) => ({
    id: str(b.id) || 'b' + i,
    from: b.from < b.to ? b.from : b.to,
    to: b.from < b.to ? b.to : b.from,
    note: str(b.note),
  }));
  const clients = list(obj.clients).filter(c => c && (str(c.name).trim() || phoneDigits(c.phone))).map((c, i) => ({
    id: str(c.id) || 'c' + i, name: str(c.name).trim(), phone: str(c.phone), created: c.created || null,
  }));
  return {
    appointments,
    expenses,
    prices,
    rent: rent.length ? rent : [{ from: '2000-01', amount: DEFAULT_RENT }],
    settings: readSettings(obj.settings),
    blocks,
    clients,
    exportedAt: obj.exportedAt || null,
  };
}

const TIME_RE = /^\d{2}:\d{2}$/;

function readSettings(src) {
  const s = src && typeof src === 'object' ? src : {};
  const out = { ...DEFAULT_SETTINGS };
  if (TIME_RE.test(s.dayStart)) out.dayStart = s.dayStart;
  if (TIME_RE.test(s.lastStart)) out.lastStart = s.lastStart;
  const duration = Math.round(Number(s.duration));
  if (duration >= 15 && duration <= 600) out.duration = duration;
  if (typeof s.clientName === 'string') out.clientName = s.clientName;
  if (typeof s.whatsapp === 'string') out.whatsapp = s.whatsapp;
  if (typeof s.theme === 'string' && Object.keys(THEMES).includes(s.theme)) out.theme = s.theme;
  return out;
}
