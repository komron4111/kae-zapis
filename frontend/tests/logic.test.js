// Тесты logic.js и zip.js. Тесты сервера — в backend/tests/.
// Запуск: открыть tests/ в браузере через локальный сервер (см. frontend/README.md).
import * as L from '../logic.js';
import * as Z from '../zip.js';

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function eq(actual, expected) {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a !== b) throw new Error(`ожидали ${b}, получили ${a}`);
}

function throws(fn, text) {
  try { fn(); } catch (e) {
    if (!e.message.includes(text)) throw new Error(`ошибка «${e.message}» без текста «${text}»`);
    return;
  }
  throw new Error('ожидали ошибку');
}

const NB = ' ';
const appt = (date, status, total, prepaid, extra = {}) =>
  ({ id: date + status + total, date, time: '10:00', name: '', phone: '', service: 'Маникюр', total, prepaid, status, note: '', ...extra });

// ---------- Даты ----------

test('дата по местному времени, без сдвига UTC', () => {
  eq(L.ymd(new Date(2026, 8, 28, 23, 59)), '2026-09-28');
  eq(L.ymd(new Date(2026, 0, 1, 0, 1)), '2026-01-01');
});

test('месяцы через границу года', () => {
  eq(L.addMonths('2026-12', 1), '2027-01');
  eq(L.addMonths('2026-01', -1), '2025-12');
  eq(L.addMonths('2026-09', 0), '2026-09');
});

test('названия месяца и дня', () => {
  eq(L.monthTitle('2026-09'), 'Сентябрь 2026');
  eq(L.dayTitle('2026-09-28'), 'Понедельник, 28 сентября');
  eq(L.shortDate('2026-10-01'), '1 октября');
});

test('сетка сентября 2026: 5 недель с понедельника', () => {
  const g = L.monthGrid('2026-09');
  eq(g.length, 35);
  eq(g[0], '2026-08-31');
  eq(g[1], '2026-09-01');
  eq(g[34], '2026-10-04');
});

test('сетка марта 2026: 6 недель', () => {
  const g = L.monthGrid('2026-03');
  eq(g.length, 42);
  eq(g[0], '2026-02-23');
  eq(g[6], '2026-03-01');
});

test('склонение слова «запись»', () => {
  const f = ['запись', 'записи', 'записей'];
  eq([0, 1, 2, 4, 5, 11, 12, 14, 21, 22, 25, 101, 111].map(n => L.plural(n, f)),
    ['записей', 'запись', 'записи', 'записи', 'записей', 'записей', 'записей', 'записей', 'запись', 'записи', 'записей', 'запись', 'записей']);
});

// ---------- Деньги ----------

test('сумма из поля ввода', () => {
  eq(L.toMoney('12 000'), 12000);
  eq(L.toMoney(''), 0);
  eq(L.toMoney(null), 0);
  eq(L.toMoney(5000), 5000);
  eq(L.toMoney(-300), 0);
  eq(L.toMoney(12.6), 13);
});

test('формат денег', () => {
  eq(L.formatMoney(70000), `70${NB}000${NB}₸`);
  eq(L.formatMoney(-5000), `−5${NB}000${NB}₸`);
  eq(L.formatMoney(0), `0${NB}₸`);
  eq(L.formatMoney(1234567), `1${NB}234${NB}567${NB}₸`);
  eq(L.formatAmount(12000), '12 000');
  eq(L.formatAmount(0), '');
});

test('получено и остаток по статусам', () => {
  const booked = appt('2026-09-10', 'booked', 12000, 5000);
  const paid = appt('2026-09-10', 'paid', 12000, 5000);
  const cancelled = appt('2026-09-10', 'cancelled', 12000, 5000);
  eq([L.received(booked), L.balanceDue(booked)], [5000, 7000]);
  eq([L.received(paid), L.balanceDue(paid)], [12000, 0]);
  eq([L.received(cancelled), L.balanceDue(cancelled)], [5000, 0]);
});

// ---------- Аренда и отчёт ----------

test('аренда 70 000 по умолчанию и смена суммы с месяца', () => {
  const base = [{ from: '2000-01', amount: 70000 }];
  eq(L.rentFor(base, '2026-09'), 70000);
  const changed = L.setRent(base, '2026-10', 80000);
  eq(L.rentFor(changed, '2026-09'), 70000);
  eq(L.rentFor(changed, '2026-10'), 80000);
  eq(L.rentFor(changed, '2027-03'), 80000);
  eq(L.setRent(changed, '2026-10', 75000), [{ from: '2000-01', amount: 70000 }, { from: '2026-10', amount: 75000 }]);
  eq(L.setRent(changed, '2026-09', 60000), [{ from: '2000-01', amount: 70000 }, { from: '2026-09', amount: 60000 }]);
});

test('отчёт за месяц сходится до тенге', () => {
  const data = {
    appointments: [
      appt('2026-09-10', 'paid', 12000, 5000),
      appt('2026-09-20', 'booked', 8000, 3000),
      appt('2026-09-21', 'cancelled', 6000, 2000),
      appt('2026-09-22', 'booked', 7000, 0),
      appt('2026-10-01', 'paid', 9000, 0),
    ],
    expenses: [
      { id: 'e1', date: '2026-09-05', amount: 15000, note: 'Гель-лаки' },
      { id: 'e2', date: '2026-09-18', amount: 4000, note: 'Пилки' },
      { id: 'e3', date: '2026-10-02', amount: 7000, note: '' },
    ],
    rent: [{ from: '2000-01', amount: 70000 }],
  };
  eq(L.monthReport(data, '2026-09'), { income: 17000, materials: 19000, rent: 70000, profit: -72000, expected: 12000, paidVisits: 1 });
  eq(L.monthReport(data, '2026-10'), { income: 9000, materials: 7000, rent: 70000, profit: -68000, expected: 0, paidVisits: 1 });
});

// ---------- Телефоны и поиск ----------

test('номер в международном виде', () => {
  eq(L.phoneDigits('8 (701) 123-45-67'), '77011234567');
  eq(L.phoneDigits('+7 701 123 45 67'), '77011234567');
  eq(L.phoneDigits('7011234567'), '77011234567');
  eq(L.phoneDigits('+998 90 123 45 67'), '998901234567');
});

test('красивый номер', () => {
  eq(L.formatPhone('87011234567'), '+7 701 123 45 67');
  eq(L.formatPhone('+998 90 123 45 67'), '+998 90 123 45 67');
  eq(L.formatPhone(''), '');
  eq([L.canDial('123'), L.canDial('8701 123 45 67')], [false, true]);
});

test('поле телефона: «+7» на месте, номер группами по 3-3-2-2', () => {
  eq(L.phoneFieldValue(''), '+7 ');
  eq(L.phoneFieldValue('+7 '), '+7 ');
  eq(L.phoneFieldValue('+7 7011'), '+7 701 1');
  eq(L.phoneFieldValue('+7 70112345'), '+7 701 123 45');
  eq(L.phoneFieldValue('+7 701 123 45 678'), '+7 701 123 45 67');
  // стёрли пробел, «+» или «7» у приставки — она возвращается
  eq(L.phoneFieldValue('+7701 123'), '+7 701 123');
  eq(L.phoneFieldValue('7 701 123'), '+7 701 123');
  eq(L.phoneFieldValue('+ 701 123'), '+7 701 123');
  // вставили номер целиком
  eq(L.phoneFieldValue('8 (701) 123-45-67'), '+7 701 123 45 67');
  eq(L.phoneFieldValue('87011234567'), '+7 701 123 45 67');
  eq(L.phoneFieldValue('+77011234567'), '+7 701 123 45 67');
  eq(L.phoneFieldValue('7011234567'), '+7 701 123 45 67');
});

test('поле телефона: что показать и что сохранить', () => {
  eq(L.phoneFieldStart(''), '+7 ');
  eq(L.phoneFieldStart('8 701 123 45 67'), '+7 701 123 45 67');
  eq(L.phoneFieldStart('+998 90 123 45 67'), '+998 90 123 45 67');
  eq(L.phoneFromField('+7 '), '');
  eq(L.phoneFromField('+7 701 123 45 67'), '+7 701 123 45 67');
  eq(L.phoneFromField('+7 701 12'), '+7 701 12');
  eq(L.phoneFieldDigits('+7 701 12'), '70112');
});

test('клиенты, добавленные вручную: в общем списке и без повторов', () => {
  const list = L.pastClients([
    appt('2026-09-01', 'paid', 1, 0, { name: 'Айгуль', phone: '+7 701 123 45 67' }),
  ], [
    { id: 'm1', name: 'Айгуль Н.', phone: '87011234567' },
    { id: 'm2', name: 'Жанна', phone: '+7 702 000 00 01' },
    { id: 'm3', name: 'Мира', phone: '' },
  ]);
  eq(list.map(c => [c.name, c.visits, c.last, c.id || '']), [
    ['Айгуль', 1, '2026-09-01', 'm1'],
    ['Жанна', 0, '', 'm2'],
    ['Мира', 0, '', 'm3'],
  ]);
  eq([L.findTwin(list, '', '8 702 000 00 01').name, L.findTwin(list, 'мира', '').name, L.findTwin(list, 'Лейла', '')], ['Жанна', 'Мира', undefined]);
});

test('клиенты из записей: без повторов, данные из свежей записи', () => {
  const list = L.pastClients([
    appt('2026-08-01', 'paid', 1, 0, { name: 'Айгуль', phone: '8 701 123 45 67' }),
    appt('2026-09-01', 'paid', 1, 0, { name: 'Айгуль А.', phone: '+7 701 123 45 67' }),
    appt('2026-08-15', 'paid', 1, 0, { name: 'Дана', phone: '' }),
    appt('2026-09-10', 'booked', 1, 0, { name: 'Дана', phone: '8 705 555 44 33' }),
    appt('2026-08-20', 'cancelled', 1, 0, { name: 'Сауле', phone: '' }),
  ]);
  eq(list, [
    { key: '77055554433', name: 'Дана', phone: '8 705 555 44 33', visits: 2, last: '2026-09-10' },
    { key: '77011234567', name: 'Айгуль А.', phone: '+7 701 123 45 67', visits: 2, last: '2026-09-01' },
    { key: 'сауле', name: 'Сауле', phone: '', visits: 0, last: '2026-08-20' },
  ]);
});

test('история клиента: все его записи, свежие первыми', () => {
  const list = [
    appt('2026-08-15', 'paid', 1, 0, { id: 'c', name: 'Дана', phone: '' }),
    appt('2026-09-10', 'booked', 1, 0, { id: 'd', name: 'Дана', phone: '8 705 555 44 33' }),
    appt('2026-09-01', 'paid', 1, 0, { id: 'e', name: 'Дана', phone: '8 777 000 00 00' }),
  ];
  eq(L.clientVisits(list, { name: 'Дана', phone: '+7 705 555 44 33' }).map(a => a.id), ['d', 'c']);
});

test('список клиентов по алфавиту, клиент без имени — по номеру', () => {
  const sorted = L.sortByName([
    { name: 'Сауле', phone: '' },
    { name: 'Айгуль', phone: '' },
    { name: '', phone: '+7 700 000 00 00' },
    { name: 'Дана', phone: '' },
  ]);
  eq(sorted.map(c => c.name || c.phone), ['+7 700 000 00 00', 'Айгуль', 'Дана', 'Сауле']);
});

test('поиск клиента по имени (ё = е) и по номеру с восьмёркой', () => {
  const clients = [
    { name: 'Айгуль', phone: '+7 701 123 45 67' },
    { name: 'Алёна', phone: '+7 777 000 11 22' },
    { name: 'Дана', phone: '' },
  ];
  const names = q => L.findClients(clients, q).map(c => c.name);
  eq(names('ален'), ['Алёна']);
  eq(names('АЙГ'), ['Айгуль']);
  eq(names('8701'), ['Айгуль']);
  eq(names('+7 777'), ['Алёна']);
  eq(names('70'), []);
  eq(names(''), ['Айгуль', 'Алёна', 'Дана']);
});

// ---------- Рабочее время и свободные окошки ----------

const S = { ...L.DEFAULT_SETTINGS }; // 9:00–20:00, между записями 2 ч 30 мин

test('минуты и время', () => {
  eq([L.toMinutes('09:00'), L.toMinutes('14:30'), L.fromMinutes(870), L.shortTime('09:30'), L.shortTime('14:00')],
    [540, 870, '14:30', '9:30', '14:00']);
  eq([L.formatDuration(150), L.formatDuration(120), L.formatDuration(45)], ['2 ч 30 мин', '2 ч', '45 мин']);
});

test('пустой день: свободно с 9:00 до 20:00 каждые 30 минут', () => {
  const times = L.freeTimes([], '2026-10-01', S);
  eq([times.length, times[0], times[times.length - 1]], [23, '09:00', '20:00']);
  eq(L.formatRanges(L.toRanges(times)), '9:00–20:00');
});

test('запись в 12:00: следующая не раньше 14:30, до неё — не позже 9:30', () => {
  const list = [appt('2026-10-01', 'booked', 0, 0, { id: 'x', time: '12:00' })];
  const times = L.freeTimes(list, '2026-10-01', S);
  eq(times.slice(0, 3), ['09:00', '09:30', '14:30']);
  eq(L.formatRanges(L.toRanges(times)), '9:00–9:30, 14:30–20:00');
});

test('отменённая запись время не занимает, запись не мешает сама себе', () => {
  const list = [
    appt('2026-10-01', 'cancelled', 0, 0, { id: 'c', time: '12:00' }),
    appt('2026-10-01', 'booked', 0, 0, { id: 'b', time: '15:00' }),
  ];
  eq(L.freeTimes(list, '2026-10-01', S, -1, 'b').length, 23);
  eq(L.conflicts(list, '2026-10-01', '13:00', 150).map(a => a.id), ['b']);
  eq(L.conflicts(list, '2026-10-01', '12:30', 150), []);
  eq(L.conflicts(list, '2026-10-01', '13:00', 150, 'b'), []);
});

test('сегодня прошедшее время не предлагается', () => {
  eq(L.freeTimes([], '2026-10-01', S, L.toMinutes('18:10')), ['18:30', '19:00', '19:30', '20:00']);
});

test('закрытые дни включают обе границы', () => {
  const blocks = [{ id: 'v', from: '2026-10-10', to: '2026-10-20', note: 'Отпуск' }];
  eq([L.blockFor(blocks, '2026-10-09'), L.blockFor(blocks, '2026-10-10').id, L.blockFor(blocks, '2026-10-20').id, L.blockFor(blocks, '2026-10-21')],
    [null, 'v', 'v', null]);
});

test('расписание для клиентов: без имён и телефонов, закрытые дни помечены', () => {
  const data = {
    appointments: [appt('2026-10-01', 'booked', 0, 0, { id: 'a', time: '12:00', name: 'Айгуль', phone: '+7 701 123 45 67' })],
    blocks: [{ id: 'v', from: '2026-10-02', to: '2026-10-02', note: 'Болезнь' }],
    settings: { ...L.DEFAULT_SETTINGS, whatsapp: '8 700 111 22 33' },
  };
  const s = L.buildSchedule(data, new Date(2026, 9, 1, 10, 0), 3);
  eq([s.kind, s.name, s.whatsapp, s.duration], ['okna', 'Арай', '77001112233', 150]);
  eq(s.days.map(d => d.date), ['2026-10-01', '2026-10-02', '2026-10-03']);
  eq(s.days[0].busy, [[720, 870]]); // услуги нет в прайсе — 2 ч 30 мин по умолчанию
  eq(L.scheduleTimes(s, s.days[0], 150).slice(0, 3), ['09:00', '09:30', '14:30']);
  eq(s.days[1], { date: '2026-10-02', off: true });
  eq(L.scheduleTimes(s, s.days[2], 150).length, 23);
  const text = JSON.stringify(s);
  eq([text.includes('Айгуль'), text.includes('1234567'), text.includes('Болезнь')], [false, false, false]);
});

test('«сейчас» считается по часам мастера', () => {
  // 19:30 по UTC — в Казахстане (UTC+5) уже 00:30 следующего дня
  eq(L.masterClock(-300, Date.UTC(2026, 8, 28, 19, 30)), { date: '2026-09-29', minutes: 30 });
});

// ---------- Резервная копия ----------

test('копия сохраняется и читается обратно', () => {
  const data = {
    appointments: [appt('2026-09-10', 'paid', 12000, 5000, { name: 'Айгуль', phone: '+7 701 123 45 67', photos: ['ph1'] })],
    expenses: [{ id: 'e1', date: '2026-09-05', amount: 15000, note: 'Гель-лаки' }],
    prices: [{ id: 'p1', name: 'Маникюр', price: 5000, duration: 60 }],
    rent: [{ from: '2000-01', amount: 70000 }],
    settings: { dayStart: '10:00', lastStart: '19:00', duration: 120, clientName: 'Арай', whatsapp: '+7 700 111 22 33', address: 'Абая 10', gis: 'https://go.2gis.com/abc12', theme: 'lavender' },
    blocks: [{ id: 'v', from: '2026-10-10', to: '2026-10-12', note: 'Отпуск' }],
    clients: [{ id: 'c1', name: 'Жанна', phone: '+7 702 000 00 01', created: '2026-09-28T10:00:00.000Z' }],
  };
  const copy = L.readBackup(JSON.stringify(L.makeBackup(data, new Date(Date.UTC(2026, 8, 28)))));
  eq(copy.exportedAt, '2026-09-28T00:00:00.000Z');
  eq(copy.appointments[0].total, 12000);
  eq(copy.appointments[0].name, 'Айгуль');
  eq(copy.expenses, data.expenses);
  eq(copy.prices, data.prices);
  eq(copy.rent, data.rent);
  eq(copy.settings, data.settings);
  eq(copy.blocks, data.blocks);
  eq(copy.clients, data.clients);
  eq(copy.appointments[0].photos, ['ph1']);
});

test('тема оформления в копии: своя сохраняется, неизвестная — пурпурная (исходная)', () => {
  const read = theme => L.readBackup(JSON.stringify({ app: 'kae-zapis', appointments: [], settings: { theme } })).settings.theme;
  eq([read('lavender'), read('rose'), read('neon'), read(undefined)], ['lavender', 'rose', 'plum', 'plum']);
  eq(Object.keys(L.THEMES), ['rose', 'plum', 'lavender']);
});

test('чужой файл не принимается', () => {
  throws(() => L.readBackup('не json'), 'Это не файл копии');
  throws(() => L.readBackup('{"app":"другое","appointments":[]}'), 'Это не файл копии');
});

test('кривые поля в копии приводятся к нужному виду', () => {
  const copy = L.readBackup(JSON.stringify({
    app: 'kae-zapis',
    appointments: [
      { date: '2026-09-10', total: '12000', prepaid: 5000, status: 'constructor' },
      { date: 'вчера', total: 1 },
    ],
  }));
  eq(copy.appointments.length, 1);
  eq([copy.appointments[0].id, copy.appointments[0].total, copy.appointments[0].status], ['r0', 12000, 'booked']);
  eq(copy.rent, [{ from: '2000-01', amount: L.DEFAULT_RENT }]); // своя аренда не указана — по умолчанию (0 с 2.2.1)
  eq(copy.settings, L.DEFAULT_SETTINGS);
  eq(copy.clients, []);
});

test('кривые настройки, закрытые дни и фото в копии', () => {
  const copy = L.readBackup(JSON.stringify({
    app: 'kae-zapis',
    appointments: [{ date: '2026-09-10', photos: ['ok1', '../x', 5] }],
    settings: { dayStart: '9', lastStart: '21:00', duration: 'abc' },
    blocks: [{ from: '2026-10-12', to: '2026-10-10' }, { from: 'завтра', to: '2026-10-10' }],
  }));
  eq(copy.appointments[0].photos, ['ok1']);
  eq([copy.settings.dayStart, copy.settings.lastStart, copy.settings.duration], ['09:00', '21:00', 150]);
  eq(copy.blocks, [{ id: 'b0', from: '2026-10-10', to: '2026-10-12', note: '' }]);
});

// ---------- Несколько услуг и заявки клиентов ----------

test('услуги: старая запись с одной услугой и новая со списком', () => {
  eq(L.servicesOf({ service: 'Маникюр' }), ['Маникюр']);
  eq(L.servicesOf({ services: ['Маникюр', 'Педикюр'] }), ['Маникюр', 'Педикюр']);
  eq(L.servicesOf({}), []);
  eq(L.servicesLabel(['Маникюр', 'Педикюр']), 'Маникюр + Педикюр');
  const prices = [{ name: 'Маникюр', price: 5000 }, { name: 'Педикюр', price: 7000 }];
  eq(L.servicesTotal(['Маникюр', 'Педикюр', 'Стрижка'], prices), 12000);
});

test('копия: старая запись с одной услугой читается как список', () => {
  const copy = L.readBackup(JSON.stringify({ app: 'kae-zapis', appointments: [
    { date: '2026-09-10', service: 'Наращивание' },
    { date: '2026-09-11', services: ['Маникюр', ' ', 'Педикюр'] },
  ] }));
  eq(copy.appointments.map(a => a.services), [['Наращивание'], ['Маникюр', 'Педикюр']]);
});

test('клиенты видят услуги с ценами из прайса', () => {
  const s = L.buildSchedule({ appointments: [], blocks: [], settings: {}, prices: [{ name: 'Маникюр', price: 5000 }, { name: ' ', price: 0 }] }, new Date(2026, 9, 1), 1);
  eq(s.services, [{ name: 'Маникюр', price: 5000, duration: 0 }]);
});

const SCHEDULE = {
  duration: 150,
  services: [{ name: 'Маникюр', price: 5000 }, { name: 'Педикюр', price: 7000 }],
  days: [
    { date: '2026-10-01', times: ['09:00', '09:30', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'] },
    { date: '2026-10-02', off: true },
  ],
};
const CLOCK = { date: '2026-09-30', minutes: 600 };

test('заявка занимает время для других клиентов', () => {
  const held = L.applyHolds(SCHEDULE, [{ date: '2026-10-01', time: '14:30' }]);
  eq(held.days[0].times, ['09:00', '09:30', '17:00']);
  eq(held.days[1], { date: '2026-10-02', off: true });
});

test('проверка заявки клиента', () => {
  const good = { date: '2026-10-01', time: '14:30', name: '  Айгуль   А. ', phone: '8 701 111 22 33', services: ['Маникюр', 'Маникюр', 'Педикюр'], comment: 'Френч' };
  eq(L.validateRequest(good, SCHEDULE, CLOCK), { ok: true, request: {
    date: '2026-10-01', time: '14:30', name: 'Айгуль А.', phone: '+7 701 111 22 33', services: ['Маникюр', 'Педикюр'], comment: 'Френч', duration: 150,
  } });
  const error = patch => L.validateRequest({ ...good, ...patch }, SCHEDULE, CLOCK).error;
  const busy = 'Это время уже занято — выберите другое';
  eq([error({ name: ' ' }), error({ phone: '123' }), error({ services: [] }), error({ services: ['Стрижка'] }), error({ time: '14:00' }), error({ date: '2026-10-02' }), error({ date: 'завтра' })],
    ['Укажите имя', 'Укажите номер телефона', 'Выберите вид работы', 'Такой услуги нет в прайсе', busy, busy, 'Выберите день и время']);
  eq(L.validateRequest(good, SCHEDULE, { date: '2026-10-01', minutes: 900 }).status, 409); // 14:30 уже прошло
});

// ---------- Длительность услуг (1.8.0) ----------

const PRICES = L.DEFAULT_SERVICES.map(([name, duration], i) => ({ id: 'p' + i, name, price: 0, duration }));
const at = (time, services, extra = {}) => ({ id: time, date: '2026-10-01', time, status: 'booked', services, ...extra });
const freeWith = (items, need) => L.formatRanges(L.toRanges(L.freeTimes(items, '2026-10-01', S, -1, undefined, { prices: PRICES, need })));

test('длительность записи — по услугам из прайса', () => {
  eq(L.servicesDuration(['Снятие маникюра'], PRICES, S), 20);
  eq(L.servicesDuration(['Снятие маникюра', 'Педикюр'], PRICES, S), 80);
  eq(L.servicesDuration(['Стрижка'], PRICES, S), 150); // нет в прайсе — по умолчанию
  eq(L.servicesDuration([], PRICES, S), 150);
  eq(L.shortestService(PRICES, S), 20);
  eq(L.shortestService([{ name: 'Маникюр', price: 0 }], S), 150);
});

test('свободное время — от услуги предыдущей записи', () => {
  const short = L.shortestService(PRICES, S);
  eq(freeWith([at('12:00', ['Снятие маникюра'])], short), '9:00–11:30, 12:30–20:00');
  eq(freeWith([at('12:00', ['Наращивание'])], short), '9:00–11:30, 14:30–20:00');
  eq(freeWith([at('12:00', ['Наращивание+Педикюр со стопой'])], short), '9:00–11:30, 16:00–20:00');
  // Новой записи на 2 ч 30 мин нужно закончить до 12:00 — начать не позже 9:30.
  eq(freeWith([at('12:00', ['Снятие маникюра'])], 150), '9:00–9:30, 12:30–20:00');
  eq(L.conflicts([at('12:00', ['Снятие маникюра'])], '2026-10-01', '12:30', 60, undefined, { prices: PRICES, settings: S }), []);
  eq(L.conflicts([at('12:00', ['Наращивание'])], '2026-10-01', '14:00', 60, undefined, { prices: PRICES, settings: S }).map(a => a.id), ['12:00']);
});

const SCHEDULE2 = L.buildSchedule({
  appointments: [at('12:00', ['Снятие маникюра'], { name: 'Айгуль' })],
  blocks: [],
  settings: { ...L.DEFAULT_SETTINGS },
  prices: PRICES,
}, new Date(2026, 9, 1, 8, 0), 2);

test('расписание v2: занятое время и длительности услуг, без имён', () => {
  eq([SCHEDULE2.v, SCHEDULE2.dayStart, SCHEDULE2.lastStart, SCHEDULE2.duration], [2, '09:00', '20:00', 150]);
  eq(SCHEDULE2.days[0].busy, [[720, 740]]);
  eq(SCHEDULE2.services[0], { name: 'Снятие маникюра', price: 0, duration: 20 });
  eq(JSON.stringify(SCHEDULE2).includes('Айгуль'), false);
  eq(L.scheduleTimes(SCHEDULE2, SCHEDULE2.days[0], 20).slice(5, 7), ['11:30', '12:30']);
  eq(L.scheduleTimes(SCHEDULE2, SCHEDULE2.days[0], 20, L.toMinutes('19:00')), ['19:30', '20:00']);
});

test('расписание v2: заявка занимает время по своим услугам', () => {
  const held = L.applyHolds(SCHEDULE2, [{ date: '2026-10-01', time: '15:00', services: ['Педикюр'] }]);
  eq(held.days[0].busy, [[720, 740], [900, 960]]);
  eq(L.scheduleTimes(held, held.days[0], 20).includes('15:30'), false);
  eq(L.scheduleTimes(held, held.days[0], 20).includes('16:00'), true);
});

test('расписание v2: проверка заявки с учётом длительности услуг', () => {
  const clock = { date: '2026-09-30', minutes: 600 };
  const good = { date: '2026-10-01', time: '10:00', name: 'Дана', phone: '8 701 111 22 33', services: ['Педикюр'] };
  eq(L.validateRequest(good, SCHEDULE2, clock).request.duration, 60);
  eq(L.validateRequest({ ...good, time: '12:30' }, SCHEDULE2, clock).ok, true); // снятие маникюра закончилось в 12:20
  const long = L.validateRequest({ ...good, time: '11:00', services: ['Наращивание'] }, SCHEDULE2, clock);
  eq([long.status, long.error], [409, 'На это время выбранные услуги не поместятся — выберите время раньше или меньше услуг']);
  eq(L.validateRequest({ ...good, time: '12:00' }, SCHEDULE2, clock).error, 'Это время уже занято — выберите другое');
});

// ---------- Закрытое время (2.3.0) ----------

const CLOSED = [
  { id: 'd', from: '2026-10-10', to: '2026-10-12', note: 'Отпуск' },
  { id: 'e', from: '2026-10-01', to: '2026-10-03', note: 'Учёба', start: '18:00', end: '20:00' },
  { id: 'm', from: '2026-10-01', to: '2026-10-01', note: 'Врач', start: '14:00', end: '16:00' },
];

test('закрытое время не закрывает день, а занимает часы в каждый из своих дней', () => {
  eq([L.isTimeBlock(CLOSED[0]), L.isTimeBlock(CLOSED[1])], [false, true]);
  eq([L.blockFor(CLOSED, '2026-10-01'), L.blockFor(CLOSED, '2026-10-11').id], [null, 'd']);
  eq(L.timeBlocksOn(CLOSED, '2026-10-01').map(b => b.id), ['m', 'e']);
  eq([L.closedIntervals(CLOSED, '2026-10-01'), L.closedIntervals(CLOSED, '2026-10-03'), L.closedIntervals(CLOSED, '2026-10-04')],
    [[[840, 960], [1080, 1200]], [[1080, 1200]], []]);
});

test('время для закрытия: начало раньше конца, в пределах суток', () => {
  eq([['14:00', '16:00'], ['16:00', '14:00'], ['14:00', '14:00'], ['14:00', ''], ['23:00', '24:00'], ['9:00', '10:00']].map(([a, b]) => L.isTimeWindow(a, b)),
    [true, false, false, false, false, false]);
});

test('свободное время: запись заканчивается до закрытых часов, после них снова свободно', () => {
  const free = (date, need) => L.formatRanges(L.toRanges(L.freeTimes([], date, S, -1, undefined, { need, blocks: CLOSED })));
  eq(free('2026-10-01', 20), '9:00–13:30, 16:00–17:30, 20:00'); // закрыто 14–16 и 18–20, в 20:00 уже открыто
  eq(free('2026-10-01', 150), '9:00–11:30, 20:00');
  eq(free('2026-10-02', 20), '9:00–17:30, 20:00');
  eq(free('2026-10-04', 20), '9:00–20:00');
});

test('запись или заявка в закрытое время: с чем пересекается', () => {
  eq(L.closedConflicts(CLOSED, '2026-10-01', '13:30', 60).map(b => b.id), ['m']);
  eq(L.closedConflicts(CLOSED, '2026-10-01', '13:00', 60), []); // заканчивается ровно к 14:00
  eq(L.closedConflicts(CLOSED, '2026-10-01', '16:00', 150).map(b => b.id), ['e']);
  eq(L.closedConflicts(CLOSED, '2026-10-02', '14:00', 60), []);
});

test('записи, которые попадут в закрываемые дни или время', () => {
  const list = [
    at('12:00', ['Наращивание']), // до 14:30 — заходит на закрытое с 14:00
    at('16:00', ['Снятие маникюра']),
    at('15:00', ['Педикюр'], { status: 'cancelled' }),
    at('15:00', ['Педикюр'], { date: '2026-10-02' }),
  ];
  const time = { from: '2026-10-01', to: '2026-10-01', start: '14:00', end: '16:00' };
  const found = block => L.blockConflicts(list, block, { prices: PRICES, settings: S }).map(a => `${a.date} ${a.time}`);
  eq(found(time), ['2026-10-01 12:00']);
  eq(found({ ...time, to: '2026-10-02' }), ['2026-10-01 12:00', '2026-10-02 15:00']);
  eq(found({ from: '2026-10-01', to: '2026-10-01' }), ['2026-10-01 12:00', '2026-10-01 16:00']); // весь день
});

test('расписание для клиентов: закрытое время занято, как запись, причина не видна', () => {
  const s = L.buildSchedule({
    appointments: [at('12:00', ['Снятие маникюра'], { name: 'Айгуль' })],
    blocks: CLOSED,
    settings: { ...L.DEFAULT_SETTINGS },
    prices: PRICES,
  }, new Date(2026, 9, 1, 8, 0), 4);
  eq(s.days.map(d => d.busy), [[[720, 740], [840, 960], [1080, 1200]], [[1080, 1200]], [[1080, 1200]], []]);
  eq([JSON.stringify(s).includes('Врач'), JSON.stringify(s).includes('Учёба')], [false, false]);
  eq(L.cleanSchedule(s), s);
  const clock = { date: '2026-09-30', minutes: 600 };
  const req = { date: '2026-10-01', name: 'Дана', phone: '8 701 111 22 33', services: ['Педикюр'] };
  eq(L.validateRequest({ ...req, time: '14:30' }, s, clock).error, 'Это время уже занято — выберите другое');
  eq(L.validateRequest({ ...req, time: '13:30' }, s, clock).error, 'На это время выбранные услуги не поместятся — выберите время раньше или меньше услуг');
  eq(L.validateRequest({ ...req, time: '16:00' }, s, clock).ok, true);
});

test('копия: закрытое время сохраняется, с неверным временем — не берётся', () => {
  const copy = L.readBackup(JSON.stringify({ app: 'kae-zapis', appointments: [], blocks: [
    ...CLOSED,
    { id: 'x', from: '2026-10-05', to: '2026-10-05', start: '16:00', end: '14:00' },
    { id: 'y', from: '2026-10-05', to: '2026-10-05', start: '16:00' },
  ] }));
  eq(copy.blocks, CLOSED);
});

test('прайс мастера: новые услуги добавляются, цены и названия прежних остаются', () => {
  let n = 0;
  const merged = L.mergePrices([
    { id: 'a', name: 'Маникюр', price: 8000 },
    { id: 'b', name: 'Наращивание', price: 15000 },
    { id: 'c', name: 'маникюр + педикюр', price: 16000 },
  ], L.DEFAULT_SERVICES, () => 'n' + n++);
  eq(merged.length, 14);
  eq(merged.find(p => p.id === 'b'), { id: 'b', name: 'Наращивание', price: 15000, duration: 150 });
  eq(merged.find(p => p.id === 'c'), { id: 'c', name: 'маникюр + педикюр', price: 16000, duration: 90 });
  eq(merged[0], { id: 'n0', name: 'Снятие маникюра', price: 0, duration: 20 });
  eq(merged[merged.length - 1], { id: 'a', name: 'Маникюр', price: 8000 }); // нет в списке — в конце, как была
});

test('прайс мастера: пустые прежние услуги (без цены и времени) убираются', () => {
  const phone = ['Наращивание', 'Маникюр', 'Снятие', 'Педикюр', 'Маникюр+Педикюр'].map((name, i) => ({ id: 'o' + i, name, price: 0 }));
  let n = 0;
  const merged = L.mergePrices(phone, L.DEFAULT_SERVICES, () => 'n' + n++);
  eq(merged.map(p => p.name), L.DEFAULT_SERVICES.map(([name]) => name));
  eq(merged.find(p => p.name === 'Наращивание').id, 'o0'); // прежняя услуга, не новая
});

// ---------- Карточка клиента (1.10.0) ----------

test('Instagram: ник из @ника и из ссылки на профиль', () => {
  eq(['@Aigul.Nails', 'https://www.instagram.com/aigul.nails/?igsh=abc', 'instagram.com/aigul_nails', 'не ник', ''].map(L.instagramName),
    ['aigul.nails', 'aigul.nails', 'aigul_nails', '', '']);
});

test('день рождения: возраст и сколько дней осталось', () => {
  eq([L.ageOn('1992-03-12', '2026-09-29'), L.ageOn('1992-10-01', '2026-09-29'), L.ageOn('', '2026-09-29')], [34, 33, null]);
  eq([L.daysToBirthday('1992-10-01', '2026-09-29'), L.daysToBirthday('1992-09-29', '2026-09-29'), L.daysToBirthday('1992-09-28', '2026-09-29')], [2, 0, 364]);
  eq(L.daysToBirthday('2000-02-29', '2027-02-27'), 2); // в обычный год — 1 марта
});

test('карточка клиента: поля переходят к клиенту из записей и сохраняются в копии', () => {
  const list = L.pastClients([appt('2026-09-01', 'paid', 1, 0, { name: 'Айгуль', phone: '+7 701 123 45 67' })],
    [{ id: 'm', name: 'Айгуль', phone: '87011234567', instagram: 'aigul', birthday: '1992-10-01', source: 'Instagram' }]);
  eq([list.length, list[0].visits, list[0].id, list[0].instagram, list[0].birthday, list[0].source], [1, 1, 'm', 'aigul', '1992-10-01', 'Instagram']);
  const copy = L.readBackup(JSON.stringify({ app: 'kae-zapis', appointments: [], clients: [
    { id: 'm', name: 'Айгуль', phone: '+7 701 123 45 67', instagram: 'https://instagram.com/Aigul/', birthday: '1992-10-01', source: ' По рекомендации: Дана ' },
    { id: 'k', name: 'Мира', phone: '', instagram: 'не ник', birthday: 'вчера', source: '' },
  ] }));
  eq(copy.clients, [
    { id: 'm', name: 'Айгуль', phone: '+7 701 123 45 67', created: null, instagram: 'aigul', birthday: '1992-10-01', source: 'По рекомендации: Дана' },
    { id: 'k', name: 'Мира', phone: '', created: null },
  ]);
});

// ---------- Аккаунт мастера (2.0.0) ----------

test('ссылка мастера из имени: латиница, казахские буквы, пустое — master', () => {
  eq(['Арай', 'Айгүл Нұр', 'Жанна-Мари  ', '  ', 'Nail Studio 24'].map(L.slugify), ['aray', 'aygul-nur', 'zhanna-mari', 'master', 'nail-studio-24']);
  eq(L.slugify('Щедрая Юлия Ёлкина Длинное Имя').length <= 24, true);
});

test('пароль растягивается одинаково на любом телефоне и зависит от номера', async () => {
  const secret = await L.passwordSecret('+7 701 123 45 67', 'секрет12');
  eq(secret, 'TEGwxNssEt480MDCHeSX8fBkgm16boPWzkHcvX1-Vp0');
  eq(await L.passwordSecret('87011234567', 'секрет12'), secret);
  eq((await L.passwordSecret('+7 702 123 45 67', 'секрет12')) === secret, false);
});

test('копия: длительность услуг и отметки об оплате аренды', () => {
  const copy = L.readBackup(JSON.stringify({
    app: 'kae-zapis',
    appointments: [],
    prices: [{ id: 'p', name: 'Педикюр', price: 7000, duration: 60 }, { id: 'q', name: 'Маникюр', price: 5000, duration: 'много' }],
    rentPaid: { '2026-09': '2026-09-05', '2026-10': 'завтра', 'сентябрь': '2026-09-01' },
  }));
  eq(copy.prices.map(p => p.duration), [60, 0]);
  eq(copy.rentPaid, { '2026-09': '2026-09-05' });
  eq(L.readBackup(JSON.stringify({ app: 'kae-zapis', appointments: [] })).rentPaid, {});
});

test('текст уведомления о заявке', () => {
  eq(L.requestSummary({ name: 'Айгуль', date: '2026-10-01', time: '09:30', services: ['Маникюр', 'Педикюр'] }), 'Айгуль · 1 октября в 9:30 · Маникюр + Педикюр');
});

test('base64url туда и обратно', () => {
  const bytes = Uint8Array.from([0, 1, 250, 255, 62, 63, 128]);
  eq([...L.b64uToBytes(L.bytesToB64u(bytes))], [...bytes]);
  eq(L.bytesToB64u(Uint8Array.from([251, 255])), '-_8');
});

// ---------- Личная ссылка клиента ----------

test('что видит клиент по ссылке: статус записи мастера', () => {
  const a = appt('2026-10-01', 'booked', 12000, 3000, { time: '15:00', name: 'Айгуль', services: ['Маникюр', 'Педикюр'] });
  eq(L.publicBooking(a), { status: 'confirmed', date: '2026-10-01', time: '15:00', name: 'Айгуль', services: ['Маникюр', 'Педикюр'], total: 12000, prepaid: 3000 });
  eq([L.publicBooking({ ...a, status: 'paid' }).status, L.publicBooking({ ...a, status: 'cancelled' }).status], ['done', 'cancelled']);
});

test('проверка записи для клиента на сервере', () => {
  const good = { status: 'confirmed', date: '2026-10-01', time: '15:00', name: ' Айгуль ', services: ['Маникюр', ' ', 5], total: '12000', prepaid: 3000 };
  eq(L.normalizeBooking(good), { status: 'confirmed', date: '2026-10-01', time: '15:00', name: 'Айгуль', services: ['Маникюр', '5'], total: 12000, prepaid: 3000 });
  eq([L.normalizeBooking({ ...good, status: 'booked' }), L.normalizeBooking({ ...good, date: 'завтра' }), L.normalizeBooking(null)], [null, null, null]);
});

test('сообщение клиенту о подтверждении записи', () => {
  const a = { name: 'Айгуль', date: '2026-10-01', time: '09:30', services: ['Маникюр', 'Педикюр'], prepaid: 3000 };
  eq(L.confirmationText(a, 'https://x/okna/?z=abc'),
    `Здравствуйте, Айгуль! Ваша запись подтверждена: 1 октября в 9:30 (маникюр + педикюр). Предоплата 3${NB}000${NB}₸ получена. Ваша запись: https://x/okna/?z=abc`);
  eq(L.confirmationText({ ...a, name: '', prepaid: 0 }, 'L'), 'Здравствуйте! Ваша запись подтверждена: 1 октября в 9:30 (маникюр + педикюр). Ваша запись: L');
});

// ---------- Архив копии (ZIP) ----------

test('расписание для клиентов: настоящее проходит без изменений', () => {
  const s = L.buildSchedule({
    appointments: [{ id: 'a', date: '2026-10-01', time: '10:00', status: 'booked', services: ['Маникюр'] }],
    blocks: [{ id: 'b', from: '2026-10-02', to: '2026-10-02' }],
    settings: { ...L.DEFAULT_SETTINGS, clientName: 'Мадина', whatsapp: '+7 701 123 45 67', address: '  Алматы,  Абая 10, 3 этаж ', gis: 'Салон https://go.2gis.com/abc12' },
    prices: [{ id: 'p', name: 'Маникюр', price: 5000, duration: 60 }],
  }, new Date(2026, 9, 1, 9, 0), 3);
  eq([s.address, s.gis], ['Алматы, Абая 10, 3 этаж', 'https://go.2gis.com/abc12']);
  eq(L.cleanSchedule(s), s);
});

test('ссылка 2ГИС: только адреса 2ГИС и только https', () => {
  eq(L.gisLink('https://go.2gis.com/abc12'), 'https://go.2gis.com/abc12');
  eq(L.gisLink('Салон «Нега», Абая 10 https://go.2gis.com/abc12'), 'https://go.2gis.com/abc12');
  eq(L.gisLink('2gis.kz/almaty/firm/70000001'), 'https://2gis.kz/almaty/firm/70000001');
  eq(L.gisLink('http://2gis.kz/x?a=1'), 'https://2gis.kz/x?a=1');
  eq(L.gisLink('https://almaty.2gis.kz/firm/1'), 'https://almaty.2gis.kz/firm/1');
  for (const bad of ['', 'просто текст', 'javascript:alert(1)', 'https://evil.com/?2gis.kz', 'https://2gis.kz.evil.com/', 'https://evil2gis.kz/', 'https://user:pw@2gis.kz/']) {
    eq(L.gisLink(bad), '');
  }
  eq(L.addressText(`  ул.\n Абая   10 ${'д'.repeat(200)}`).length, 150);
});

test('адрес и 2ГИС сохраняются в копии', () => {
  const copy = L.readBackup(JSON.stringify({ app: 'kae-zapis', appointments: [], settings: { address: ' Абая  10 ', gis: '2gis.kz/almaty/firm/1' } }));
  eq([copy.settings.address, copy.settings.gis], ['Абая 10', 'https://2gis.kz/almaty/firm/1']);
  const evil = L.readBackup(JSON.stringify({ app: 'kae-zapis', appointments: [], settings: { gis: 'javascript:alert(1)' } }));
  eq(evil.settings.gis, '');
});

test('расписание для клиентов: чужой код и мусор не проходят', () => {
  const evil = '"><img src=x onerror=alert(1)>';
  const s = L.cleanSchedule({
    kind: 'okna', v: 2, name: `  Мастер ${evil}  `, whatsapp: '<b>+7 (701) 123-45-67</b>',
    dayStart: evil, lastStart: '21:00', duration: evil, tzOffset: 'x', updated: evil, extra: evil,
    services: [{ name: evil, price: evil, duration: evil }, { name: '', price: 100 }, 'строка', null],
    days: [
      { date: evil, busy: [] },
      { date: '2026-10-01\n', busy: [] },
      { date: '2026-10-02', busy: [[600, 660], [evil, 700], [900, 10000], [-5, 30]] },
      { date: '2026-10-03', times: ['10:00', evil, '1:00'] },
      { date: '2026-10-04', off: evil },
    ],
  });
  eq(s.name, 'Мастер "><img src=x onerror=alert(1)>'); // строку экранирует страница, здесь — только длина
  eq(s.whatsapp, '77011234567');
  eq([s.dayStart, s.lastStart, s.duration, s.tzOffset, s.updated], ['09:00', '21:00', 150, 0, '1970-01-01T00:00:00.000Z']);
  eq(s.services, [{ name: evil, price: 1, duration: 0 }]);
  eq(s.days, [
    { date: '2026-10-02', busy: [[600, 660]] },
    { date: '2026-10-03', times: ['10:00'] },
    { date: '2026-10-04', off: true },
  ]);
  eq('extra' in s, false);
  eq(L.cleanSchedule({ kind: 'okna' }), null);
  eq(L.cleanSchedule({ kind: 'other', days: [] }), null);
  eq(L.cleanSchedule('okna'), null);
});

test('подписка: месяц с даты, конец месяца, февраль', () => {
  eq(L.addMonthsToDate('2026-01-31', 1), '2026-02-28');
  eq(L.addMonthsToDate('2024-01-31', 1), '2024-02-29');
  eq(L.addMonthsToDate('2026-12-15', 1), '2027-01-15');
  eq(L.addMonthsToDate('2026-03-31', -1), '2026-02-28');
  eq(L.subscriptionEnd('2026-09-30'), '2026-10-29');
  eq(L.subscriptionEnd('2026-10-20'), '2026-11-19');
  eq(L.subscriptionEnd('2026-01-31'), '2026-02-27');
});

test('подписка: продление от конца периода или с сегодняшнего дня', () => {
  eq(L.nextPeriod('2026-10-29', '2026-10-10'), { start: '2026-10-30', end: '2026-11-29' }); // ещё идёт — продолжаем
  eq(L.nextPeriod('2026-10-10', '2026-10-10'), { start: '2026-10-11', end: '2026-11-10' }); // последний день
  eq(L.nextPeriod('2026-10-01', '2026-10-10'), { start: '2026-10-10', end: '2026-11-09' }); // закончилась — с сегодня
  eq(L.nextPeriod(null, '2026-10-10'), { start: '2026-10-10', end: '2026-11-09' });
});

test('подписка: доступ по последний день включительно', () => {
  eq(L.subscriptionActive({ until: '2026-10-29' }, '2026-10-29'), true);
  eq(L.subscriptionActive({ until: '2026-10-29' }, '2026-10-30'), false);
  eq(L.subscriptionActive({ until: null, unlimited: true }, '2030-01-01'), true);
  eq(L.subscriptionActive(null, '2026-10-01'), false);
  eq(L.subscriptionDaysLeft({ until: '2026-10-29' }, '2026-10-26'), 3);
  eq(L.subscriptionDaysLeft({ until: '2026-10-29' }, '2026-10-30'), -1);
  eq(L.subscriptionDaysLeft({ until: '2026-10-29', unlimited: true }, '2026-10-26'), null);
});

test('контрольная сумма CRC32', () => {
  eq(Z.crc32(new TextEncoder().encode('The quick brown fox jumps over the lazy dog')), 0x414FA339);
  eq(Z.crc32(new Uint8Array()), 0);
});

test('архив копии: записали и прочитали обратно', async () => {
  const files = [
    { name: 'data.json', data: new TextEncoder().encode('{"app":"kae-zapis","привет":1}') },
    { name: 'photos/abc.jpg', data: new Uint8Array([255, 216, 255, 0, 1, 2, 3]) },
  ];
  const entries = await Z.readZip(Z.makeZip(files, new Date(2026, 8, 28, 12, 0)));
  eq(entries.map(e => e.name), ['data.json', 'photos/abc.jpg']);
  eq(await entries[0].blob.text(), '{"app":"kae-zapis","привет":1}');
  eq([...new Uint8Array(await entries[1].blob.arrayBuffer())], [255, 216, 255, 0, 1, 2, 3]);
});

test('не архив — понятная ошибка', async () => {
  let message = '';
  try {
    await Z.readZip(new Blob(['просто текст']));
  } catch (e) {
    message = e.message;
  }
  eq(message, 'Это не архив копии');
});

// ---------- Итог ----------

const results = [];
for (const t of tests) {
  try {
    await t.fn();
    results.push({ name: t.name, ok: true });
  } catch (e) {
    results.push({ name: t.name, ok: false, error: e.message });
  }
}
const failed = results.filter(r => !r.ok);
document.getElementById('summary').textContent = failed.length
  ? `Ошибок: ${failed.length} из ${results.length}`
  : `Все тесты пройдены: ${results.length}`;
document.getElementById('summary').className = failed.length ? 'fail' : 'ok';
document.body.dataset.status = failed.length ? 'fail' : 'pass';
document.getElementById('list').innerHTML = results
  .map(r => `<li class="${r.ok ? 'ok' : 'fail'}">${r.ok ? '✓' : '✗'} ${r.name}${r.ok ? '' : ' — ' + r.error}</li>`)
  .join('');
