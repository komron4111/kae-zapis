// Тесты logic.js, zip.js и шифрования уведомлений (api/src/push.js).
// Запуск: открыть tests/ в браузере через локальный сервер (см. README).
import * as L from '../logic.js';
import * as Z from '../zip.js';
import * as P from '../api/src/push.js';

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
  eq(s.days[0].times.slice(0, 3), ['09:00', '09:30', '14:30']);
  eq(s.days[1], { date: '2026-10-02', off: true });
  eq(s.days[2].times.length, 23);
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
    prices: [{ id: 'p1', name: 'Маникюр', price: 5000 }],
    rent: [{ from: '2000-01', amount: 70000 }],
    settings: { dayStart: '10:00', lastStart: '19:00', duration: 120, clientName: 'Арай', whatsapp: '+7 700 111 22 33' },
    blocks: [{ id: 'v', from: '2026-10-10', to: '2026-10-12', note: 'Отпуск' }],
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
  eq(copy.appointments[0].photos, ['ph1']);
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
  eq(copy.rent, [{ from: '2000-01', amount: 70000 }]);
  eq(copy.settings, L.DEFAULT_SETTINGS);
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
  eq(s.services, [{ name: 'Маникюр', price: 5000 }]);
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
    date: '2026-10-01', time: '14:30', name: 'Айгуль А.', phone: '+7 701 111 22 33', services: ['Маникюр', 'Педикюр'], comment: 'Френч',
  } });
  const error = patch => L.validateRequest({ ...good, ...patch }, SCHEDULE, CLOCK).error;
  const busy = 'Это время уже занято — выберите другое';
  eq([error({ name: ' ' }), error({ phone: '123' }), error({ services: [] }), error({ services: ['Стрижка'] }), error({ time: '14:00' }), error({ date: '2026-10-02' }), error({ date: 'завтра' })],
    ['Укажите имя', 'Укажите номер телефона', 'Выберите вид работы', 'Такой услуги нет в прайсе', busy, busy, 'Выберите день и время']);
  eq(L.validateRequest(good, SCHEDULE, { date: '2026-10-01', minutes: 900 }).status, 409); // 14:30 уже прошло
});

test('текст уведомления о заявке', () => {
  eq(L.requestSummary({ name: 'Айгуль', date: '2026-10-01', time: '09:30', services: ['Маникюр', 'Педикюр'] }), 'Айгуль · 1 октября в 9:30 · Маникюр + Педикюр');
});

test('base64url туда и обратно', () => {
  const bytes = Uint8Array.from([0, 1, 250, 255, 62, 63, 128]);
  eq([...L.b64uToBytes(L.bytesToB64u(bytes))], [...bytes]);
  eq(L.bytesToB64u(Uint8Array.from([251, 255])), '-_8');
});

// ---------- Шифрование уведомлений ----------

test('шифрование уведомления совпадает с примером RFC 8291 байт в байт', async () => {
  const clean = x => x.replace(/\s+/g, '');
  const asPublic = P.unb64u(clean('BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIg Dll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8'));
  const jwk = { kty: 'EC', crv: 'P-256', x: P.b64u(asPublic.slice(1, 33)), y: P.b64u(asPublic.slice(33, 65)), d: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw' };
  const serverKeys = {
    publicKey: await crypto.subtle.importKey('raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, true, []),
    privateKey: await crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']),
  };
  const subscription = { keys: { p256dh: clean('BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV- JvLexhqUzORcx aOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4'), auth: 'BTBZMqHH6r4Tts7J_aSIgg' } };
  const body = await P.encryptPayload(subscription, P.unb64u('V2hlbiBJIGdyb3cgdXAsIEkgd2FudCB0byBiZSBhIHdhdGVybWVsb24'), { salt: P.unb64u('DGv6ra1nlYgDCS1FRnbzlw'), serverKeys });
  const expected = clean('DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z 9KsN6nGRTbVYI_c7VJSPQTBtkgcy27ml mlMoZIIgDll6e3vCYLocInmYWAmS6Tlz AC8wEqKK6PBru3jl7A8')
    + '|' + clean('8pfeW0KbunFT06SuDKoJH9Ql87S1QUrd irN6GcG7sFz1y1sqLgVi1VhjVkHsUoEs bI_0LpXMuGvnzQ');
  const [header, ciphertext] = expected.split('|');
  eq(P.b64u(body), P.b64u(new Uint8Array([...P.unb64u(header), ...P.unb64u(ciphertext)])));
});

test('подпись VAPID проверяется публичным ключом сервера', async () => {
  const vapid = await P.generateVapidKeys();
  const auth = await P.vapidAuthorization('https://web.push.apple.com/QGd1', vapid, 'https://komron4111.github.io/kae-zapis/', Date.UTC(2026, 8, 29));
  const [, token, key] = auth.match(/^vapid t=([^,]+), k=(.+)$/);
  const [head, claims, signature] = token.split('.');
  const pub = await crypto.subtle.importKey('raw', P.unb64u(key), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  eq(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, P.unb64u(signature), new TextEncoder().encode(`${head}.${claims}`)), true);
  eq(JSON.parse(new TextDecoder().decode(P.unb64u(claims))), { aud: 'https://web.push.apple.com', exp: 1790683200, sub: 'https://komron4111.github.io/kae-zapis/' });
});

// ---------- Архив копии (ZIP) ----------

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
