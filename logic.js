// Логика без интерфейса: даты, деньги, отчёт за месяц, телефоны,
// сохранённые клиенты, резервная копия. Проверяется тестами в tests/.

export const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
export const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
export const WEEKDAYS = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
export const WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

// Стартовый прайс без цен: цены Арай вносит сама в «Настройках».
export const DEFAULT_SERVICES = ['Наращивание', 'Маникюр', 'Снятие маникюра', 'Педикюр', 'Маникюр+Педикюр'];
export const DEFAULT_RENT = 70000;

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

// ---------- Сохранённые клиенты ----------
// Отдельной базы клиентов нет: клиент сохраняется вместе с записью,
// а список собирается из записей.

const norm = s => String(s || '').toLowerCase().replace(/ё/g, 'е').trim();

// Один клиент — один номер. Имя и номер берутся из самой свежей записи.
export function pastClients(appointments) {
  const byKey = new Map();
  const sorted = [...appointments].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  for (const a of sorted) {
    const key = phoneDigits(a.phone) || norm(a.name);
    if (key && !byKey.has(key)) byKey.set(key, { name: a.name, phone: a.phone });
  }
  // Запись без номера не дублирует клиента с тем же именем, у которого номер есть.
  const withPhone = new Set();
  for (const c of byKey.values()) if (phoneDigits(c.phone)) withPhone.add(norm(c.name));
  return [...byKey.values()].filter(c => phoneDigits(c.phone) || !withPhone.has(norm(c.name)));
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
  };
}

// Разбирает файл копии и приводит поля к нужным типам.
// Бросает Error с понятным текстом, если это не наша копия.
export function readBackup(text) {
  let obj = null;
  try { obj = JSON.parse(text); } catch (e) { /* не JSON */ }
  if (!obj || obj.app !== BACKUP_APP || !Array.isArray(obj.appointments)) {
    throw new Error('Это не файл копии «Записи Арай»');
  }
  const str = v => (v == null ? '' : String(v));
  const list = v => (Array.isArray(v) ? v : []);
  const appointments = obj.appointments.filter(a => a && DATE_RE.test(a.date)).map((a, i) => ({
    id: str(a.id) || 'r' + i,
    date: a.date,
    time: str(a.time),
    name: str(a.name),
    phone: str(a.phone),
    service: str(a.service),
    total: toMoney(a.total),
    prepaid: toMoney(a.prepaid),
    status: STATUSES.includes(a.status) ? a.status : 'booked',
    note: str(a.note),
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
  return {
    appointments,
    expenses,
    prices,
    rent: rent.length ? rent : [{ from: '2000-01', amount: DEFAULT_RENT }],
    exportedAt: obj.exportedAt || null,
  };
}
