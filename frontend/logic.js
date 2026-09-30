// Логика без интерфейса: даты, деньги, рабочее время и свободные окошки,
// заявки клиентов, отчёт за месяц, телефоны, клиенты, резервная копия.
// Общая для приложения, страницы клиентов и сервера (backend/ берёт этот файл при выкладке).
// Проверяется тестами в tests/.

export const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
export const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
export const WEEKDAYS = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
export const WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

// Прайс мастера (список от 29.09.2026): услуга и сколько она длится, минут.
// Цен здесь нет — их вносит Арай в «Настройках».
export const DEFAULT_SERVICES = [
  ['Снятие маникюра', 20],
  ['Снятие+Маникюр', 60],
  ['Маникюр с укреплением', 90],
  ['Наращивание', 150],
  ['Снятие педикюра', 20],
  ['Педикюр', 60],
  ['Педикюр с покрытием', 90],
  ['Педикюр со стопой', 90],
  ['Маникюр+Педикюр', 90],
  ['Маникюр с укреплением + Педикюр с покрытием', 150],
  ['Наращивание+Педикюр с покрытием', 210],
  ['Наращивание+Педикюр со стопой', 240],
  ['Маникюр+Педикюр со стопой', 210],
];
export const DEFAULT_RENT = 0; // своя сумма — в «Настройки» → «Аренда» (до 2.2.1 было 70 000 ₸ Арай)

// Рабочее время: запись можно начать с dayStart до lastStart включительно.
// duration — сколько длится услуга, у которой в прайсе не указана длительность.
export const DEFAULT_SETTINGS = { dayStart: '09:00', lastStart: '20:00', duration: 150, clientName: 'Арай', whatsapp: '', address: '', gis: '', theme: 'plum' };
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

// ---------- Длительность услуг ----------

// Сколько минут длится услуга по прайсу; без длительности — duration из настроек.
export function serviceMinutes(name, prices, settings) {
  const p = (prices || []).find(x => x.name === name);
  return p && p.duration > 0 ? p.duration : settings.duration;
}

// Сколько займёт запись: сумма её услуг. Без услуг — duration из настроек.
export function servicesDuration(services, prices, settings) {
  const list = (services || []).filter(Boolean);
  return list.length ? list.reduce((sum, name) => sum + serviceMinutes(name, prices, settings), 0) : settings.duration;
}

// Самая короткая услуга прайса. Пока услуги не выбраны, время свободно,
// если в него помещается хотя бы она.
export function shortestService(prices, settings) {
  const list = (prices || []).filter(p => p.name && p.name.trim()).map(p => (p.duration > 0 ? p.duration : settings.duration));
  return list.length ? Math.min(...list) : settings.duration;
}

// ---------- Свободное время ----------

const activeOn = (items, date, excludeId) => items.filter(a => a.date === date && a.status !== 'cancelled' && a.time && a.id !== excludeId);

// Занятое время дня: [начало, конец) в минутах — записи (кроме отменённых) и заявки.
// Конец — по услугам записи: после снятия маникюра время освобождается через 20 минут.
export function busyIntervals(items, date, prices, settings, excludeId) {
  return activeOn(items, date, excludeId).map(a => {
    const start = toMinutes(a.time);
    return [start, start + servicesDuration(servicesOf(a), prices, settings)];
  }).sort((x, y) => x[0] - y[0]);
}

// Свободные начала записи с шагом SLOT_STEP: не внутри занятого времени, и запись
// длиной need успевает закончиться до следующей. after — минуты: не позже него не предлагаем.
export function freeStarts(busy, settings, need, after = -1) {
  const out = [];
  for (let s = toMinutes(settings.dayStart); s <= toMinutes(settings.lastStart); s += SLOT_STEP) {
    if (s > after && busy.every(([b, e]) => s >= e || s + need <= b)) out.push(fromMinutes(s));
  }
  return out;
}

// Свободное время дня по записям (и заявкам) — для приложения мастера.
// need — сколько длится новая запись (по умолчанию duration из настроек).
export function freeTimes(items, date, settings, after = -1, excludeId, { prices = [], need = settings.duration } = {}) {
  return freeStarts(busyIntervals(items, date, prices, settings, excludeId), settings, need, after);
}

// Записи, с которыми пересечётся новая запись в time длиной need.
export function conflicts(items, date, time, need, excludeId, { prices = [], settings = DEFAULT_SETTINGS } = {}) {
  const start = toMinutes(time);
  return activeOn(items, date, excludeId).filter(a => {
    const b = toMinutes(a.time);
    return start < b + servicesDuration(servicesOf(a), prices, settings) && b < start + need;
  });
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

// ---------- Подписка мастера ----------
// Доступ открыт по последний день периода включительно; на следующий день приложение
// просит продлить подписку. Период — месяц: с даты по день перед тем же числом следующего месяца.

// Тот же день через n месяцев; если такого дня нет (31 января → февраль) — последний день месяца.
export function addMonthsToDate(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12), nm = total - ny * 12;
  const last = new Date(ny, nm + 1, 0).getDate();
  return `${ny}-${pad2(nm + 1)}-${pad2(Math.min(d, last))}`;
}

// Последний день месячного периода, который начинается с start.
export function subscriptionEnd(start) {
  return addDays(addMonthsToDate(start, 1), -1);
}

// Следующий оплаченный месяц: сразу после текущего периода, а если доступ уже закончился
// (или его не было) — с сегодняшнего дня.
export function nextPeriod(until, today) {
  const start = until && until >= today ? addDays(until, 1) : today;
  return { start, end: subscriptionEnd(start) };
}

// sub — { until: 'YYYY-MM-DD' | null, unlimited }.
export function subscriptionActive(sub, today) {
  return Boolean(sub && (sub.unlimited || (sub.until && today <= sub.until)));
}

// Сколько дней осталось после сегодняшнего (0 — сегодня последний день). null — бессрочно или без даты.
export function subscriptionDaysLeft(sub, today) {
  if (!sub || sub.unlimited || !sub.until) return null;
  return Math.round((parseYmd(sub.until) - parseYmd(today)) / 864e5);
}

// ---------- Где принимает мастер: адрес и 2ГИС ----------

// Адрес одной строкой, до 150 знаков.
export function addressText(value) {
  return String(value == null ? '' : value).trim().replace(/\s+/g, ' ').slice(0, 150);
}

// Ссылка на место в 2ГИС. Из текста «Поделиться» берём первую ссылку; можно и без https://.
// Подходят только адреса 2ГИС (2gis.kz, go.2gis.com и т. п.) — чужую ссылку клиентам не покажем.
// Возвращает https-ссылку или пусто.
export function gisLink(value) {
  const text = String(value == null ? '' : value);
  const found = text.match(/https?:\/\/[^\s<>"'«»]+/i) || text.match(/(?:^|\s)((?:[a-z0-9-]+\.)*2gis\.[a-z]{2,4}\/[^\s<>"'«»]*)/i);
  if (!found) return '';
  let url;
  try {
    url = new URL(found[1] && !/^https?:/i.test(found[0]) ? `https://${found[1]}` : found[0]);
  } catch (e) {
    return '';
  }
  if (!/^https?:$/.test(url.protocol) || !/(^|\.)2gis\.[a-z]{2,4}$/i.test(url.hostname) || url.username || url.password) return '';
  url.protocol = 'https:';
  return url.href.length <= 600 ? url.href : '';
}

// Что видят клиенты: занятое время на days дней вперёд (без имён и телефонов),
// рабочие часы и услуги с ценами и длительностью. Свободное время страница клиентов
// и сервер считают сами — под выбранные услуги. Прошедшее время сегодня отсекается там же.
export function buildSchedule(data, now = new Date(), days = HORIZON_DAYS) {
  const s = { ...DEFAULT_SETTINGS, ...data.settings };
  const prices = data.prices || [];
  const first = ymd(now);
  const list = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(first, i);
    list.push(blockFor(data.blocks, date) ? { date, off: true } : { date, busy: busyIntervals(data.appointments, date, prices, s) });
  }
  return {
    app: BACKUP_APP,
    kind: 'okna',
    v: 2,
    name: s.clientName,
    whatsapp: phoneDigits(s.whatsapp),
    address: addressText(s.address),
    gis: gisLink(s.gis),
    dayStart: s.dayStart,
    lastStart: s.lastStart,
    duration: s.duration,
    tzOffset: now.getTimezoneOffset(),
    services: prices.filter(p => p.name && p.name.trim()).map(p => ({ name: p.name.trim(), price: p.price, duration: p.duration > 0 ? p.duration : 0 })),
    updated: now.toISOString(),
    days: list,
  };
}

// Расписание приходит на сервер с телефона мастера как есть, а мастеров много. Всё, что
// увидят клиенты, пропускаем по образцу: даты, время и числа — строго своего вида,
// строки — обрезаны, лишние поля — отброшены. null — это не расписание.
export function cleanSchedule(raw) {
  if (!raw || typeof raw !== 'object' || raw.kind !== 'okna' || !Array.isArray(raw.days)) return null;
  const int = (v, min, max, def) => (Number.isFinite(v) && Math.round(v) >= min && Math.round(v) <= max ? Math.round(v) : def);
  const text = (v, max) => String(v == null ? '' : v).trim().replace(/\s+/g, ' ').slice(0, max);
  const interval = x => Array.isArray(x) && Number.isFinite(x[0]) && Number.isFinite(x[1]) && x[0] >= 0 && x[1] >= x[0] && x[1] <= 2880;
  const days = raw.days.slice(0, 62).filter(d => d && typeof d === 'object' && DATE_RE.test(d.date)).map(d => {
    if (d.off) return { date: d.date, off: true };
    if (Array.isArray(d.busy)) return { date: d.date, busy: d.busy.filter(interval).slice(0, 100).map(x => [Math.round(x[0]), Math.round(x[1])]) };
    return { date: d.date, times: (Array.isArray(d.times) ? d.times : []).filter(t => TIME_RE.test(t)).slice(0, 100) };
  });
  const updated = new Date(typeof raw.updated === 'string' ? raw.updated : 0);
  return {
    app: BACKUP_APP,
    kind: 'okna',
    v: int(raw.v, 1, 9, 1),
    name: text(raw.name, 40),
    whatsapp: phoneDigits(raw.whatsapp).slice(0, 15),
    address: addressText(raw.address),
    gis: gisLink(raw.gis),
    dayStart: TIME_RE.test(raw.dayStart) ? raw.dayStart : DEFAULT_SETTINGS.dayStart,
    lastStart: TIME_RE.test(raw.lastStart) ? raw.lastStart : DEFAULT_SETTINGS.lastStart,
    duration: int(raw.duration, 5, 720, DEFAULT_SETTINGS.duration),
    tzOffset: int(raw.tzOffset, -900, 900, 0),
    services: (Array.isArray(raw.services) ? raw.services : []).slice(0, 60)
      .filter(p => p && typeof p === 'object')
      .map(p => ({ name: String(p.name == null ? '' : p.name).trim().slice(0, 80), price: toMoney(p.price), duration: int(p.duration, 0, 720, 0) }))
      .filter(p => p.name),
    updated: isNaN(updated) ? new Date(0).toISOString() : updated.toISOString(),
    days,
  };
}

// Рабочие часы из расписания.
export function scheduleSettings(schedule) {
  return {
    dayStart: TIME_RE.test(schedule.dayStart) ? schedule.dayStart : DEFAULT_SETTINGS.dayStart,
    lastStart: TIME_RE.test(schedule.lastStart) ? schedule.lastStart : DEFAULT_SETTINGS.lastStart,
    duration: schedule.duration > 0 ? schedule.duration : DEFAULT_SETTINGS.duration,
  };
}

// Свободные начала в день расписания для записи длиной need.
// Расписание прежнего вида (до 1.8.0) — готовый список времени.
export function scheduleTimes(schedule, day, need, after = -1) {
  if (!day || day.off) return [];
  if (!Array.isArray(day.busy)) return (day.times || []).filter(t => toMinutes(t) > after);
  return freeStarts(day.busy, scheduleSettings(schedule), need, after);
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
// holds — { date, time, services }.
export function applyHolds(schedule, holds) {
  const byDate = {};
  for (const h of holds) (byDate[h.date] = byDate[h.date] || []).push(h);
  const settings = scheduleSettings(schedule);
  return {
    ...schedule,
    days: schedule.days.map(d => {
      if (d.off || !byDate[d.date]) return d;
      if (!Array.isArray(d.busy)) {
        // Расписание прежнего вида: между началами — duration.
        return { ...d, times: d.times.filter(t => byDate[d.date].every(h => Math.abs(toMinutes(h.time) - toMinutes(t)) >= settings.duration)) };
      }
      const held = byDate[d.date].map(h => {
        const start = toMinutes(h.time);
        return [start, start + servicesDuration(h.services, schedule.services, settings)];
      });
      return { ...d, busy: [...d.busy, ...held].sort((x, y) => x[0] - y[0]) };
    }),
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
  const settings = scheduleSettings(schedule);
  const v2 = Boolean(day && Array.isArray(day.busy));
  const duration = v2 ? servicesDuration(services, schedule.services, settings) : settings.duration;
  const after = b.date === clock.date ? clock.minutes : -1;
  if (!day || day.off || past || !scheduleTimes(schedule, day, duration, after).includes(b.time)) {
    // Время свободно, но выбранные услуги не успеют закончиться до следующей записи.
    const fitsShort = v2 && !past && scheduleTimes(schedule, day, shortestService(schedule.services, settings), after).includes(b.time);
    return fail(fitsShort ? 'На это время выбранные услуги не поместятся — выберите время раньше или меньше услуг' : 'Это время уже занято — выберите другое', 409);
  }
  const comment = String(b.comment || '').trim().slice(0, 300);
  return { ok: true, request: { date: b.date, time: b.time, name, phone: formatPhone(digits), services, comment, duration } };
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

// ---------- Аккаунт мастера ----------

// Ссылка мастера для клиентов по имени: «Арай» → «aray», «Айгүл Нұр» → «aygul-nur».
const TRANSLIT = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
  н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya', ә: 'a', ғ: 'g', қ: 'q', ң: 'n', ө: 'o', ұ: 'u', ү: 'u', һ: 'h', і: 'i',
};

export function slugify(name) {
  const slug = [...String(name || '').toLowerCase()].map(ch => (ch in TRANSLIT ? TRANSLIT[ch] : ch)).join('')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24).replace(/-+$/, '');
  return slug || 'master';
}

// Пароль на сервер не уходит: телефон «растягивает» его (PBKDF2-SHA-256, PASSWORD_ROUNDS шагов,
// соль — номер телефона), сервер хранит только хэш результата. Подбирать пароль по украденной
// базе долго, а серверу не нужно тратить на это время.
export const PASSWORD_ROUNDS = 200000;

export async function passwordSecret(phone, password) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(String(password)), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode('nailapp:' + phoneDigits(phone)), iterations: PASSWORD_ROUNDS }, key, 256);
  return bytesToB64u(new Uint8Array(bits));
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
// Список клиентов собирается из записей. Отдельно хранятся клиенты, которых мастер
// добавила вручную, и данные карточки (Instagram, день рождения, откуда пришёл):
// data.clients — {id, name, phone, created, instagram?, birthday?, source?}.

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
    let c = byKey.get(key);
    if (!c) byKey.set(key, c = { key, name: s.name, phone: s.phone, visits: 0, last: '' });
    c.id = s.id;
    for (const f of PROFILE_FIELDS) if (s[f]) c[f] = s[f];
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
    for (const f of PROFILE_FIELDS) if (c[f] && !owner[f]) owner[f] = c[f];
  }
  return out;
}

// Приводит прайс к списку услуг мастера [название, минуты]: совпавшие по названию
// получают длительность (цена и название остаются), новые — с ценой 0.
// Порядок — как в списке. Прежние услуги не из списка остаются в конце, только если
// у них есть цена или длительность; пустые (без цены и времени) убираются.
export function mergePrices(prices, list, makeId) {
  const key = name => norm(name).replace(/\s*\+\s*/g, '+');
  const rest = [...prices];
  const merged = list.map(([name, duration]) => {
    const i = rest.findIndex(p => key(p.name) === key(name));
    if (i < 0) return { id: makeId(), name, price: 0, duration };
    const [p] = rest.splice(i, 1);
    return { ...p, duration: p.duration > 0 ? p.duration : duration };
  });
  return [...merged, ...rest.filter(p => p.price > 0 || p.duration > 0)];
}

// ---------- Карточка клиента: Instagram, день рождения, откуда пришёл ----------

// Подсказки для «Откуда пришёл клиент» (можно вписать и своё).
export const CLIENT_SOURCES = ['Instagram', 'TikTok', '2ГИС', 'По рекомендации', 'Вывеска'];
const PROFILE_FIELDS = ['instagram', 'birthday', 'source'];

// «@aigul.nails», «https://www.instagram.com/aigul.nails/?igsh=…» → «aigul.nails».
// Если не похоже на ник Instagram — ''.
export function instagramName(value) {
  let name = String(value || '').trim();
  const link = name.match(/instagram\.com\/([^/?#\s]+)/i);
  if (link) name = link[1];
  name = name.replace(/^@+/, '');
  return /^[A-Za-z0-9._]{1,30}$/.test(name) ? name.toLowerCase() : '';
}

// Сколько лет исполнилось к дате today (даты — 'YYYY-MM-DD').
export function ageOn(birthday, today) {
  if (!DATE_RE.test(birthday || '')) return null;
  let age = Number(today.slice(0, 4)) - Number(birthday.slice(0, 4));
  if (today.slice(5) < birthday.slice(5)) age--;
  return age >= 0 && age < 120 ? age : null;
}

// Через сколько дней ближайший день рождения (0 — сегодня). 29 февраля в обычный год — 1 марта.
export function daysToBirthday(birthday, today) {
  if (!DATE_RE.test(birthday || '')) return null;
  const [, bm, bd] = birthday.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  const now = Date.UTC(ty, tm - 1, td);
  let next = Date.UTC(ty, bm - 1, bd);
  if (next < now) next = Date.UTC(ty + 1, bm - 1, bd);
  return Math.round((next - now) / 864e5);
}

// Поля карточки клиента из копии или формы: только правильные и непустые.
export function clientProfile(src) {
  const out = {};
  const instagram = instagramName(src && src.instagram);
  if (instagram) out.instagram = instagram;
  if (src && DATE_RE.test(src.birthday)) out.birthday = src.birthday;
  const source = String((src && src.source) || '').trim().slice(0, 60);
  if (source) out.source = source;
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
    rentPaid: data.rentPaid || {},
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
    id: str(p.id) || 'p' + i, name: str(p.name), price: toMoney(p.price), duration: toDuration(p.duration),
  }));
  const rentPaid = {};
  for (const [month, date] of Object.entries(obj.rentPaid && typeof obj.rentPaid === 'object' ? obj.rentPaid : {})) {
    if (/^\d{4}-\d{2}$/.test(month) && DATE_RE.test(date)) rentPaid[month] = date;
  }
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
    id: str(c.id) || 'c' + i, name: str(c.name).trim(), phone: str(c.phone), created: c.created || null, ...clientProfile(c),
  }));
  return {
    appointments,
    expenses,
    prices,
    rent: rent.length ? rent : [{ from: '2000-01', amount: DEFAULT_RENT }],
    settings: readSettings(obj.settings),
    blocks,
    clients,
    rentPaid,
    exportedAt: obj.exportedAt || null,
  };
}

const TIME_RE = /^\d{2}:\d{2}$/;

// Длительность услуги в минутах: 5–600, иначе 0 — «не указана».
export function toDuration(value) {
  const m = Math.round(Number(value));
  return m >= 5 && m <= 600 ? m : 0;
}

function readSettings(src) {
  const s = src && typeof src === 'object' ? src : {};
  const out = { ...DEFAULT_SETTINGS };
  if (TIME_RE.test(s.dayStart)) out.dayStart = s.dayStart;
  if (TIME_RE.test(s.lastStart)) out.lastStart = s.lastStart;
  const duration = Math.round(Number(s.duration));
  if (duration >= 15 && duration <= 600) out.duration = duration;
  if (typeof s.clientName === 'string') out.clientName = s.clientName;
  if (typeof s.whatsapp === 'string') out.whatsapp = s.whatsapp;
  if (typeof s.address === 'string') out.address = addressText(s.address);
  if (typeof s.gis === 'string') out.gis = gisLink(s.gis);
  if (typeof s.theme === 'string' && Object.keys(THEMES).includes(s.theme)) out.theme = s.theme;
  return out;
}
