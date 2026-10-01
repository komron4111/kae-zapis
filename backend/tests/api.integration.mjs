// Проверка сервера целиком на компьютере: аккаунты мастеров и то, что их данные не смешиваются.
// 1. В папке backend: ~/.local/node/bin/node ~/.local/node/bin/wrangler dev --port 8787
// 2. В другом окне:  ~/.local/node/bin/node tests/api.integration.mjs
// Код доступа берётся из .dev.vars (ACCESS_CODE), он же — код администратора, пока ADMIN_CODE не задан.
// Скрипт создаёт тестовых мастеров с номерами +7 790… в локальной базе.
// Сервер пускает не больше 5 регистраций в час с одного адреса. Перед повторным запуском
// очистите счётчики в локальной базе:
//   ~/.local/node/bin/node ~/.local/node/bin/wrangler d1 execute kae-zapis --local --command "DELETE FROM attempts"

import fs from 'node:fs';
import * as L from '../../frontend/logic.js';
import * as T from './soft-authenticator.mjs';

const API = process.env.API || 'http://127.0.0.1:8787';
const CODE = (fs.readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8').match(/ACCESS_CODE=(.+)/) || [])[1].trim();
const RUN = String(Date.now()).slice(-6); // свой набор номеров на каждый запуск
const phone = n => `+7 790 ${RUN.slice(0, 3)} ${RUN.slice(3, 5)} ${n}`;

let failed = 0;
const check = (name, ok, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`);
  if (!ok) failed++;
};
const newKey = () => L.bytesToB64u(crypto.getRandomValues(new Uint8Array(32)));
async function call(method, path, { body, key, admin } = {}) {
  const headers = {};
  if (key) headers.Authorization = `Bearer ${key}`;
  if (admin) headers.Authorization = `Admin ${L.bytesToB64u(new TextEncoder().encode(admin))}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(API + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const type = res.headers.get('content-type') || '';
  return { status: res.status, data: type.includes('json') ? await res.json() : await res.text() };
}

const today = L.ymd(new Date()), d1 = L.addDays(today, 1);
const schedule = (name, prices) => L.buildSchedule({
  appointments: [], blocks: [], settings: { ...L.DEFAULT_SETTINGS, clientName: name, whatsapp: '+7 700 000 00 01' },
  prices: prices.map(([n, duration]) => ({ id: n, name: n, price: 1000, duration })),
}, new Date(), 3);

// ---------- Регистрация ----------
const A = { name: 'Тест Айгерим', phone: phone('01'), password: 'пароль-А1', key: newKey() };
const B = { name: 'Тест Бота', phone: phone('02'), password: 'пароль-Б2', key: newKey() };
for (const m of [A, B]) m.secret = await L.passwordSecret(m.phone, m.password);

// Анкета (2.4.0): направление и номер Kaspi для счёта за подписку — обязательны.
const PROFILE = { specialty: 'Маникюр и педикюр', kaspi: '+7 700 111 22 33' };
let r = await call('POST', '/api/register', { body: { name: 'Без номера', phone: '+7 701', secret: A.secret, key: newKey(), ...PROFILE } });
check('неполный номер — 400', r.status === 400, r.data.error);
r = await call('POST', '/api/register', { body: { name: A.name, phone: A.phone, secret: A.secret, key: newKey() } });
check('приложение без анкеты (до 2.4.0) — 400 «Обновите приложение»', r.status === 400 && /Обновите/.test(r.data.error), r.data.error);
r = await call('POST', '/api/register', { body: { name: A.name, phone: A.phone, secret: A.secret, key: newKey(), specialty: '  ', kaspi: PROFILE.kaspi } });
check('без направления — 400', r.status === 400 && /направление/.test(r.data.error), r.data.error);
r = await call('POST', '/api/register', { body: { name: A.name, phone: A.phone, secret: A.secret, key: newKey(), specialty: 'Барбер', kaspi: '+7 700' } });
check('неполный номер Kaspi — 400', r.status === 400 && /Kaspi/.test(r.data.error), r.data.error);
r = await call('POST', '/api/register', { body: { name: A.name, phone: A.phone, secret: A.secret, key: A.key, ...PROFILE } });
check('регистрация мастера А', r.status === 201 && r.data.account.claimed && r.data.account.name === A.name, JSON.stringify(r.data.account));
check('в аккаунте — направление и номер Kaspi', r.data.account.specialty === PROFILE.specialty && r.data.account.kaspi === L.formatPhone(PROFILE.kaspi), JSON.stringify(r.data.account));
A.slug = r.data.account && r.data.account.slug;
r = await call('POST', '/api/register', { body: { name: B.name, phone: B.phone, secret: B.secret, key: B.key, specialty: 'Барбер', kaspi: B.phone } });
check('регистрация мастера Б', r.status === 201);
B.slug = r.data.account && r.data.account.slug;
check('у мастеров свои ссылки', Boolean(A.slug && B.slug && A.slug !== B.slug), `${A.slug} / ${B.slug}`);
r = await call('POST', '/api/register', { body: { name: 'Двойник', phone: A.phone, secret: A.secret, key: newKey(), ...PROFILE } });
check('тот же номер второй раз — 409', r.status === 409, r.data.error);

// ---------- Вход ----------
r = await call('POST', '/api/login', { body: { phone: A.phone, secret: B.secret, key: newKey() } });
check('чужой пароль — 403', r.status === 403, r.data.error);
const oldKey = A.key;
A.key = newKey();
r = await call('POST', '/api/login', { body: { phone: A.phone, secret: A.secret, key: A.key } });
check('вход мастера А', r.status === 200 && r.data.account.slug === A.slug);
r = await call('GET', '/api/account', { key: oldKey });
check('прежний телефон мастера А отключён — 401', r.status === 401, r.data.error);
r = await call('GET', '/api/account', { key: A.key });
check('аккаунт: имя, номер, ссылка', r.status === 200 && r.data.account.phone === L.formatPhone(A.phone), JSON.stringify(r.data.account));

// ---------- Данные мастеров не смешиваются ----------
const LOOK = { instagram: 'aigerim.nails', specialty: 'Маникюр', theme: 'graphite' };
r = await call('PUT', '/api/schedule', { key: A.key, body: { ...schedule('Айгерим', [['Маникюр', 60]]), address: 'Алматы, Абая 10', gis: 'https://go.2gis.com/test1', ...LOOK } });
check('расписание мастера А', r.status === 200);
r = await call('PUT', '/api/schedule', { key: B.key, body: schedule('Бота', [['Педикюр', 90]]) });
check('расписание мастера Б', r.status === 200);
r = await call('GET', `/api/okna?m=${A.slug}`);
check('ссылка А — время и услуги А', r.status === 200 && r.data.name === 'Айгерим' && r.data.services[0].name === 'Маникюр' && r.data.booking === true);
check('ссылка А — адрес и 2ГИС', r.data.address === 'Алматы, Абая 10' && r.data.gis === 'https://go.2gis.com/test1', `${r.data.address} | ${r.data.gis}`);
check('ссылка А — Instagram, направление и тема мастера', r.data.instagram === LOOK.instagram && r.data.specialty === LOOK.specialty && r.data.theme === LOOK.theme,
  `${r.data.instagram} | ${r.data.specialty} | ${r.data.theme}`);
r = await call('GET', `/api/okna?m=${B.slug}`);
check('ссылка Б — услуги Б', r.status === 200 && r.data.services[0].name === 'Педикюр');
const evil = '"><img src=x onerror=alert(1)>';
const dirty = { ...schedule('Бота', [['Педикюр', 90]]), whatsapp: `7701${evil}`, extra: evil, gis: 'javascript:alert(1)', instagram: evil, theme: evil, specialty: evil };
dirty.days = [...dirty.days, { date: evil, busy: [] }, { date: d1, times: [evil] }];
dirty.services = [...dirty.services, { name: 'Педикюр+', price: evil, duration: evil }];
r = await call('PUT', '/api/schedule', { key: B.key, body: dirty });
check('расписание с чужим кодом принято', r.status === 200);
r = await call('GET', `/api/okna?m=${B.slug}`);
check('клиенты получают его очищенным', r.status === 200 && !JSON.stringify(r.data).includes('<img') && !('extra' in r.data)
  && r.data.whatsapp === '77011' && r.data.gis === '' && r.data.services[1].price === 1 && r.data.services[1].duration === 0
  && r.data.instagram === '' && r.data.theme === 'plum', JSON.stringify(r.data).slice(0, 200));
r = await call('PUT', '/api/schedule', { key: B.key, body: { kind: 'okna' } });
check('не расписание — 400', r.status === 400, r.data.error);
r = await call('PUT', '/api/schedule', { key: B.key, body: schedule('Бота', [['Педикюр', 90]]) });
r = await call('GET', '/api/okna?m=net-takogo-mastera');
check('неизвестная ссылка — 404', r.status === 404, r.data.error);

r = await call('POST', `/api/requests?m=${A.slug}`, { body: { date: d1, time: '10:00', name: 'Клиентка', phone: '+7 701 555 44 33', services: ['Маникюр'] } });
check('заявка мастеру А', r.status === 201, JSON.stringify(r.data));
const token = r.data.token;
r = await call('GET', '/api/requests', { key: A.key });
const reqA = r.data.requests || [];
check('А видит свою заявку', reqA.length === 1 && reqA[0].services[0] === 'Маникюр');
r = await call('GET', '/api/requests', { key: B.key });
check('Б чужую заявку не видит', (r.data.requests || []).length === 0);
r = await call('POST', `/api/requests/${reqA[0].id}/decline`, { key: B.key });
check('Б не может отклонить заявку А', r.status === 200 && r.data.found === false);
r = await call('GET', `/api/bookings/${token}`);
check('личная ссылка: мастер и его ссылка', r.status === 200 && r.data.status === 'pending' && r.data.master.slug === A.slug && r.data.master.name === 'Айгерим');
check('личная ссылка: адрес и 2ГИС мастера', r.data.master.address === 'Алматы, Абая 10' && r.data.master.gis === 'https://go.2gis.com/test1');
check('личная ссылка: Instagram и тема мастера', r.data.master.instagram === LOOK.instagram && r.data.master.theme === LOOK.theme && r.data.master.specialty === LOOK.specialty);
r = await call('POST', `/api/requests/${reqA[0].id}/confirm`, { key: A.key, body: { token, booking: { date: d1, time: '10:00', name: 'Клиентка', services: ['Маникюр'], total: 1000, prepaid: 0 } } });
check('А подтверждает заявку', r.status === 200 && r.data.found === true);
r = await call('PUT', `/api/bookings/${token}`, { key: B.key, body: { status: 'cancelled', date: d1, time: '10:00', name: 'x', services: [], total: 0, prepaid: 0 } });
check('Б не может изменить запись А — 403', r.status === 403, r.data.error);
r = await call('GET', `/api/bookings/${token}`);
check('запись А не тронута', r.data.status === 'confirmed');

r = await fetch(`${API}/api/backup`, { method: 'PUT', headers: { Authorization: `Bearer ${A.key}`, 'Content-Type': 'application/json' }, body: '{"app":"kae-zapis","appointments":[]}' });
check('копия мастера А', r.status === 200);
r = await call('GET', '/api/backup', { key: B.key });
check('Б копию А не получает — 404', r.status === 404);
r = await fetch(`${API}/api/photos/foto-a-${RUN}`, { method: 'PUT', headers: { Authorization: `Bearer ${A.key}`, 'Content-Type': 'image/jpeg' }, body: new Uint8Array([1, 2, 3]) });
check('фото мастера А', r.status === 200);
r = await call('GET', `/api/photos/foto-a-${RUN}`, { key: B.key });
check('Б фото А не получает — 404', r.status === 404);
r = await call('GET', '/api/photos', { key: B.key });
check('в списке фото Б нет фото А', !(r.data.ids || []).includes(`foto-a-${RUN}`));

// ---------- Смена пароля ----------
const newA = await L.passwordSecret(A.phone, 'новый-пароль-А');
r = await call('PUT', '/api/account/password', { key: A.key, body: { old: B.secret, secret: newA } });
check('смена пароля с неверным текущим — 403', r.status === 403, r.data.error);
r = await call('PUT', '/api/account/password', { key: A.key, body: { old: A.secret, secret: newA } });
check('смена пароля', r.status === 200);
r = await call('POST', '/api/login', { body: { phone: A.phone, secret: A.secret, key: newKey() } });
check('старый пароль больше не подходит', r.status === 403);
A.key = newKey();
r = await call('POST', '/api/login', { body: { phone: A.phone, secret: newA, key: A.key } });
check('вход с новым паролем', r.status === 200);

// ---------- Администратор ----------
r = await call('GET', '/api/admin/masters', { admin: 'неверный-код-123' });
check('неверный код администратора — 403', r.status === 403, r.data.error);
r = await call('GET', '/api/admin/masters', { admin: CODE });
const listed = (r.data.masters || []).find(m => m.slug === B.slug);
check('администратор видит мастеров', r.status === 200 && Boolean(listed) && listed.phone === L.formatPhone(B.phone), `всего ${(r.data.masters || []).length}`);
const listedA = (r.data.masters || []).find(m => m.slug === A.slug);
check('администратор видит адрес, 2ГИС и объём данных мастера', Boolean(listedA) && listedA.address === 'Алматы, Абая 10' && listedA.gis === 'https://go.2gis.com/test1'
  && listedA.storage.photos === 1 && listedA.storage.photoBytes === 3 && listedA.storage.backups === 1 && listedA.storage.backupBytes > 0 && listedA.storage.otherBytes > 0,
  JSON.stringify(listedA && listedA.storage));
check('администратор видит размер базы', r.data.size === null || r.data.size > 0, String(r.data.size));
check('администратор видит направление и номер Kaspi', listedA.specialty === PROFILE.specialty && listedA.kaspi === L.formatPhone(PROFILE.kaspi), `${listedA.specialty} | ${listedA.kaspi}`);
check('снимок нагрузки для «Сервера» — есть поле usage', 'usage' in r.data, JSON.stringify(r.data.usage));
const tempB = await L.passwordSecret(B.phone, 'временный-7x');
r = await call('POST', `/api/admin/masters/${listed.id}/password`, { admin: CODE, body: { secret: tempB } });
check('администратор сбрасывает пароль Б', r.status === 200);
r = await call('GET', '/api/account', { key: B.key });
check('после сброса телефон Б отключён — 401', r.status === 401);
B.key = newKey();
r = await call('POST', '/api/login', { body: { phone: B.phone, secret: tempB, key: B.key } });
check('Б входит с временным паролем', r.status === 200);
r = await call('PUT', '/api/admin/contact', { admin: CODE, body: { whatsapp: '+7 700 000 00 09' } });
check('администратор задаёт свой WhatsApp', r.status === 200);
r = await call('GET', '/api/contact');
check('«Забыли пароль?» видит WhatsApp администратора', r.data.whatsapp === '77000000009');

// ---------- Подписки ----------
const todayKz = L.masterClock(-300).date; // подписка — по времени Алматы
const trialEnd = L.trialPeriod(todayKz).end;
r = await call('GET', '/api/account', { key: A.key });
const firstSub = r.data.account && r.data.account.subscription;
check('7 дней бесплатно после регистрации', Boolean(firstSub) && firstSub.kind === 'trial' && firstSub.from === todayKz && firstSub.until === trialEnd
  && trialEnd === L.addDays(todayKz, 6) && firstSub.active === true, JSON.stringify(firstSub));
const aId = (await call('GET', '/api/admin/masters', { admin: CODE })).data.masters.find(m => m.slug === A.slug).id;
const subCall = (id, body) => call('POST', `/api/admin/masters/${id}/subscription`, { admin: CODE, body });
r = await subCall(aId, { action: 'extend' });
check('оплата за месяц — ещё месяц от конца бесплатных дней', r.status === 200 && r.data.subscription.until === L.subscriptionEnd(L.addDays(trialEnd, 1)), JSON.stringify(r.data.subscription && r.data.subscription.until));
r = await subCall(aId, { action: 'undo' });
check('отменить оплату — снова до конца бесплатных дней', r.status === 200 && r.data.subscription.until === trialEnd);
r = await subCall(aId, { action: 'until', value: L.addDays(todayKz, -1) });
check('администратор сократил доступ до вчера', r.status === 200 && r.data.subscription.active === false);
r = await call('GET', '/api/requests', { key: A.key });
check('подписка закончилась — данные мастера закрыты (402)', r.status === 402, r.data.error);
r = await call('GET', '/api/account', { key: A.key });
check('аккаунт открывается и говорит, что подписка закончилась', r.status === 200 && r.data.account.subscription.active === false);
r = await call('GET', `/api/okna?m=${A.slug}`);
check('ссылка для клиентов на паузе', r.status === 200 && r.data.paused === true && r.data.booking === false && r.data.days.length === 0 && r.data.name === 'Айгерим', JSON.stringify(r.data).slice(0, 160));
r = await call('POST', `/api/requests?m=${A.slug}`, { body: { date: d1, time: '11:00', name: 'Клиентка', phone: '+7 701 555 44 33', services: ['Маникюр'] } });
check('заявки не принимаются — 503', r.status === 503, r.data.error);
r = await call('GET', `/api/bookings/${token}`);
check('личная ссылка клиента работает и на паузе', r.status === 200 && r.data.status === 'confirmed');
r = await call('PUT', '/api/account/profile', { key: A.key, body: { specialty: 'Барбер', kaspi: '+7 700 999 88 77' } });
check('анкета меняется и после окончания подписки', r.status === 200 && r.data.account.specialty === 'Барбер' && r.data.account.kaspi === L.formatPhone('+7 700 999 88 77'), JSON.stringify(r.data.account || r.data));
r = await call('PUT', '/api/account/profile', { key: A.key, body: { specialty: 'Барбер', kaspi: '123' } });
check('анкета: неполный номер Kaspi — 400', r.status === 400, r.data.error);
r = await call('POST', '/api/chat', { key: A.key, body: { text: 'Здравствуйте! Хочу продлить подписку' } });
check('чат: мастер пишет администратору и после окончания подписки', r.status === 201 && r.data.messages.length === 1 && r.data.messages[0].author === 'master', JSON.stringify(r.data));
r = await subCall(aId, { action: 'extend' });
check('оплата после окончания — месяц с сегодняшнего дня', r.status === 200 && r.data.subscription.until === L.subscriptionEnd(todayKz) && r.data.subscription.active === true, r.data.subscription && r.data.subscription.until);
r = await call('GET', '/api/requests', { key: A.key });
check('доступ вернулся', r.status === 200);
r = await subCall(aId, { action: 'extend', plan: 'year' });
const yearEnd = L.nextPeriod(L.subscriptionEnd(todayKz), todayKz, 12).end;
check('оплата за год — ещё 12 месяцев', r.status === 200 && r.data.subscription.until === yearEnd, r.data.subscription && r.data.subscription.until);
r = await call('GET', '/api/admin/masters', { admin: CODE });
const yearPaid = r.data.masters.find(m => m.id === aId).subscription.periods.find(p => p.plan === 'year');
check('у оплаты — срок и сумма тарифа', Boolean(yearPaid) && yearPaid.amount === L.TARIFF.year.price && yearPaid.to === yearEnd, JSON.stringify(yearPaid));
r = await subCall(aId, { action: 'undo' });
check('отменить оплату за год', r.status === 200 && r.data.subscription.until === L.subscriptionEnd(todayKz), r.data.subscription && r.data.subscription.until);
r = await subCall(aId, { action: 'unlimited', value: true });
check('бессрочный доступ', r.status === 200 && r.data.subscription.unlimited === true && r.data.subscription.active === true);
r = await subCall(aId, { action: 'unlimited', value: false });
r = await subCall(aId, { action: 'until', value: '2026-02-30' });
check('неверная дата — 400', r.status === 400, r.data.error);
r = await call('GET', '/api/admin/masters', { admin: CODE });
const withSub = r.data.masters.find(m => m.id === aId);
check('администратор видит периоды подписки и сегодняшний день', r.data.today === todayKz && withSub.subscription.periods.some(p => p.kind === 'paid' && p.from === todayKz));

// ---------- Чат мастера с администратором ----------
r = await call('GET', '/api/admin/chats', { admin: CODE });
const chatA = (r.data.chats || []).find(c => c.masterId === aId);
check('администратор видит новое сообщение мастера А', r.status === 200 && Boolean(chatA) && chatA.unread === 1 && chatA.last.author === 'master', JSON.stringify(chatA));
r = await call('GET', '/api/admin/masters', { admin: CODE });
check('в списке мастеров — число непрочитанных', r.data.masters.find(m => m.id === aId).unread === 1);
r = await call('GET', `/api/admin/chats/${aId}`, { admin: CODE });
check('администратор читает переписку', r.status === 200 && r.data.messages.length === 1);
r = await call('GET', '/api/admin/chats', { admin: CODE });
check('прочитанное — без счётчика', r.data.chats.find(c => c.masterId === aId).unread === 0);
r = await call('POST', `/api/admin/chats/${aId}`, { admin: CODE, body: { text: 'Счёт выставлен в Kaspi' } });
check('администратор отвечает', r.status === 201 && r.data.messages.length === 2 && r.data.messages[1].author === 'admin');
r = await call('GET', '/api/account', { key: A.key });
check('у мастера — непрочитанный ответ', r.data.account.chatUnread === 1, String(r.data.account.chatUnread));
r = await call('GET', '/api/chat', { key: A.key });
check('мастер читает ответ; его сообщение — прочитано', r.status === 200 && r.data.messages.length === 2 && r.data.messages[0].seen === true);
r = await call('GET', '/api/account', { key: A.key });
check('после чтения счётчик обнулился', r.data.account.chatUnread === 0);
r = await call('GET', '/api/chat', { key: B.key });
check('Б не видит переписку А', r.status === 200 && r.data.messages.length === 0);
r = await call('POST', '/api/chat', { key: A.key, body: { text: '   ' } });
check('пустое сообщение — 400', r.status === 400, r.data.error);
r = await call('POST', '/api/admin/chats/net-takogo-mastera', { admin: CODE, body: { text: 'проверка' } });
check('сообщение неизвестному мастеру — 404', r.status === 404, r.data.error);
r = await call('GET', '/api/chat');
check('чат без ключа устройства — 401', r.status === 401);

// ---------- Записи по месяцам для администратора ----------
const ymNow = todayKz.slice(0, 7);
r = await call('PUT', '/api/stats', { key: A.key, body: { months: { [ymNow]: { total: 5, link: 7, clients: 4 }, 'не месяц': { total: 9 } }, clients: 12 } });
check('приложение присылает числа записей', r.status === 200, JSON.stringify(r.data));
r = await call('GET', '/api/admin/masters', { admin: CODE });
const statsA = r.data.masters.find(m => m.id === aId);
const nowStat = statsA.stats[ymNow] || {};
check('администратор видит записи месяца и клиентов (по ссылке — не больше всех)', statsA.clients === 12 && nowStat.total === 5 && nowStat.link === 5 && nowStat.manual === 0 && !statsA.stats['не месяц'],
  JSON.stringify(statsA.stats));
const reqStat = statsA.stats[d1.slice(0, 7)] || {};
check('заявки по ссылке считает сервер: отправлена и принята', reqStat.sent >= 1 && reqStat.confirmed >= 1, JSON.stringify(reqStat));
r = await call('PUT', '/api/stats', { body: { months: {}, clients: 1 } });
check('статистика без ключа устройства — 401', r.status === 401);

// ---------- Вход администратора по Face ID (программный «телефон») ----------
const ORIGIN = 'http://localhost:8765';
const adminHeader = { Authorization: `Admin ${L.bytesToB64u(new TextEncoder().encode(CODE))}` };
const post = async (path, body, headers = {}, origin = ORIGIN) => {
  const res = await fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, ...headers }, body: JSON.stringify(body) });
  return { status: res.status, data: await res.json().catch(() => ({})) };
};
r = await call('GET', '/api/admin/passkeys', { admin: CODE });
for (const k of (r.data.passkeys || []).filter(k => k.site === 'localhost')) {
  await fetch(`${API}/api/admin/passkeys/${k.id}`, { method: 'DELETE', headers: adminHeader }); // ключи прошлых запусков
}
r = await post('/api/admin/passkey/login-options', {});
check('без ключей вход по Face ID не предлагается', r.status === 200 && r.data.available === false, JSON.stringify(r.data));
r = await post('/api/admin/passkey/options', {});
check('включить Face ID без кода нельзя — 403', r.status === 403, r.data.error);
r = await post('/api/admin/passkey/options', {}, adminHeader);
const reg = r.data;
check('данные для нового ключа', r.status === 200 && reg.rp.id === 'localhost' && Boolean(reg.challenge));
const phoneKey = await T.create({ challenge: L.b64uToBytes(reg.challenge), rp: reg.rp }, ORIGIN);
r = await post('/api/admin/passkeys', { ...T.registrationJson(phoneKey), name: 'Тестовый телефон' }, adminHeader);
check('Face ID включён', r.status === 200, JSON.stringify(r.data));
r = await post('/api/admin/passkeys', { ...T.registrationJson(phoneKey), name: 'повтор' }, adminHeader);
check('тот же вызов второй раз — отказ', r.status === 403, r.data.error);
r = await post('/api/admin/passkey/login-options', {});
const opts = r.data;
check('вход по Face ID предлагается', opts.available === true && opts.rpId === 'localhost' && opts.allow.includes(phoneKey.id));
const signed = await T.get({ challenge: L.b64uToBytes(opts.challenge), rpId: opts.rpId, allowCredentials: opts.allow.map(id => ({ type: 'public-key', id: L.b64uToBytes(id) })) }, ORIGIN);
r = await post('/api/admin/passkey/login', T.assertionJson(signed));
const faceToken = r.data.token;
check('вход по Face ID', r.status === 200 && Boolean(faceToken), JSON.stringify(r.data));
r = await fetch(`${API}/api/admin/masters`, { headers: { Authorization: `Session ${faceToken}` } });
check('после Face ID администратор видит мастеров без кода', r.status === 200);
r = await post('/api/admin/passkey/login', T.assertionJson(signed));
check('та же подпись второй раз — отказ', r.status === 403, r.data.error);
r = await post('/api/admin/passkey/login-options', {}, {}, 'https://evil.example');
check('с чужого сайта — 403', r.status === 403, r.data.error);
r = await fetch(`${API}/api/admin/masters`, { headers: { Authorization: `Session ${'x'.repeat(43)}` } });
check('чужой сеанс — 401', r.status === 401);
r = await fetch(`${API}/api/admin/passkeys/${phoneKey.id}`, { method: 'DELETE', headers: { Authorization: `Session ${faceToken}` } });
check('убрать Face ID', r.status === 200);
r = await post('/api/admin/passkey/login-options', {});
check('после «Убрать» вход по Face ID не предлагается', r.data.available === false);

// ---------- Журнал ошибок ----------
r = await fetch(`${API}/api/errors`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ source: 'okna', place: '/okna/ okna.js:1', message: `проверка журнала ${RUN}` }) });
check('ошибка со страницы принята', r.status === 200);
r = await fetch(`${API}/api/errors`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'не json' });
check('непонятное сообщение об ошибке — 400', r.status === 400);

// ---------- Прежний мастер (до 2.0.0) ----------
r = await call('GET', '/api/okna');
check('ссылка без ?m — прежний мастер', r.status === 200 && r.data.slug === 'aray');
const legacyKey = newKey();
r = await call('POST', '/api/pair', { body: { code: CODE, key: legacyKey, name: 'старое приложение' } });
if (r.status === 410) {
  check('аккаунт прежнего мастера уже оформлен — вход по коду закрыт (410)', true);
} else {
  check('старое приложение входит по коду, пока аккаунт не оформлен', r.status === 200, JSON.stringify(r.data));
  r = await call('POST', '/api/pair', { body: { code: CODE, key: newKey(), name: 'второй телефон' } });
  check('второй вход по коду', r.status === 200);
  r = await call('GET', '/api/account', { key: legacyKey });
  check('вход по коду не отключает уже подключённый телефон', r.status === 200);
  check('аккаунт прежнего мастера ещё не оформлен', r.status === 200 && r.data.account.claimed === false && r.data.account.slug === 'aray');
  const L1 = { phone: phone('09'), password: 'пароль-Арай' };
  r = await call('POST', '/api/account/claim', { key: legacyKey, body: { name: 'Арай', phone: L1.phone, secret: await L.passwordSecret(L1.phone, L1.password) } });
  check('прежний мастер оформляет аккаунт', r.status === 200 && r.data.account.claimed === true && r.data.account.slug === 'aray');
  r = await call('POST', '/api/pair', { body: { code: CODE, key: newKey() } });
  check('после этого вход по коду закрыт — 410', r.status === 410, r.data.error);
  r = await call('POST', '/api/login', { body: { phone: L1.phone, secret: await L.passwordSecret(L1.phone, L1.password), key: newKey() } });
  check('прежний мастер входит по номеру и паролю', r.status === 200 && r.data.account.slug === 'aray');
}

console.log(failed ? `\nОшибок: ${failed}` : '\nВсе проверки сервера пройдены');
process.exit(failed ? 1 : 0);
