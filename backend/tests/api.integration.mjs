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

let r = await call('POST', '/api/register', { body: { name: 'Без номера', phone: '+7 701', secret: A.secret, key: newKey() } });
check('неполный номер — 400', r.status === 400, r.data.error);
r = await call('POST', '/api/register', { body: { name: A.name, phone: A.phone, secret: A.secret, key: A.key } });
check('регистрация мастера А', r.status === 201 && r.data.account.claimed && r.data.account.name === A.name, JSON.stringify(r.data.account));
A.slug = r.data.account && r.data.account.slug;
r = await call('POST', '/api/register', { body: { name: B.name, phone: B.phone, secret: B.secret, key: B.key } });
check('регистрация мастера Б', r.status === 201);
B.slug = r.data.account && r.data.account.slug;
check('у мастеров свои ссылки', Boolean(A.slug && B.slug && A.slug !== B.slug), `${A.slug} / ${B.slug}`);
r = await call('POST', '/api/register', { body: { name: 'Двойник', phone: A.phone, secret: A.secret, key: newKey() } });
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
r = await call('PUT', '/api/schedule', { key: A.key, body: { ...schedule('Айгерим', [['Маникюр', 60]]), address: 'Алматы, Абая 10', gis: 'https://go.2gis.com/test1' } });
check('расписание мастера А', r.status === 200);
r = await call('PUT', '/api/schedule', { key: B.key, body: schedule('Бота', [['Педикюр', 90]]) });
check('расписание мастера Б', r.status === 200);
r = await call('GET', `/api/okna?m=${A.slug}`);
check('ссылка А — время и услуги А', r.status === 200 && r.data.name === 'Айгерим' && r.data.services[0].name === 'Маникюр' && r.data.booking === true);
check('ссылка А — адрес и 2ГИС', r.data.address === 'Алматы, Абая 10' && r.data.gis === 'https://go.2gis.com/test1', `${r.data.address} | ${r.data.gis}`);
r = await call('GET', `/api/okna?m=${B.slug}`);
check('ссылка Б — услуги Б', r.status === 200 && r.data.services[0].name === 'Педикюр');
const evil = '"><img src=x onerror=alert(1)>';
const dirty = { ...schedule('Бота', [['Педикюр', 90]]), whatsapp: `7701${evil}`, extra: evil, gis: 'javascript:alert(1)' };
dirty.days = [...dirty.days, { date: evil, busy: [] }, { date: d1, times: [evil] }];
dirty.services = [...dirty.services, { name: 'Педикюр+', price: evil, duration: evil }];
r = await call('PUT', '/api/schedule', { key: B.key, body: dirty });
check('расписание с чужим кодом принято', r.status === 200);
r = await call('GET', `/api/okna?m=${B.slug}`);
check('клиенты получают его очищенным', r.status === 200 && !JSON.stringify(r.data).includes('<img') && !('extra' in r.data)
  && r.data.whatsapp === '77011' && r.data.gis === '' && r.data.services[1].price === 1 && r.data.services[1].duration === 0, JSON.stringify(r.data).slice(0, 200));
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
const tempB = await L.passwordSecret(B.phone, 'временный-7x');
r = await call('POST', `/api/admin/masters/${listed.id}/password`, { admin: CODE, body: { secret: tempB } });
check('администратор сбрасывает пароль Б', r.status === 200);
r = await call('GET', '/api/account', { key: B.key });
check('после сброса телефон Б отключён — 401', r.status === 401);
r = await call('POST', '/api/login', { body: { phone: B.phone, secret: tempB, key: newKey() } });
check('Б входит с временным паролем', r.status === 200);
r = await call('PUT', '/api/admin/contact', { admin: CODE, body: { whatsapp: '+7 700 000 00 09' } });
check('администратор задаёт свой WhatsApp', r.status === 200);
r = await call('GET', '/api/contact');
check('«Забыли пароль?» видит WhatsApp администратора', r.data.whatsapp === '77000000009');

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
