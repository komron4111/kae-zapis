// Сервер Nailapp на Cloudflare Workers: аккаунты мастеров, заявки клиентов, уведомления,
// свободное время для страницы клиентов, облачная копия записей и фото. Данные — в D1.
//
// С 2.0.0 у каждого мастера свой аккаунт: телефон и пароль. Пароль на сервер не приходит —
// телефон «растягивает» его (L.passwordSecret), а сервер хранит только хэш результата.
// Телефон мастера дальше входит своим ключом устройства. Всё, что было до аккаунтов, —
// мастер 'legacy' (Арай): номер и пароль она задаёт в приложении («оформить аккаунт»).
// Забытый пароль сбрасывает администратор: код — секрет ADMIN_CODE, а если его нет — ACCESS_CODE.

// Правила свободного времени и проверки заявки — общие с сайтом: один файл
// frontend/logic.js, wrangler включает его в сервер при выкладке.
import * as L from '../../frontend/logic.js';
import { generateVapidKeys, sendPush } from './push.js';
import * as W from './webauthn.js';

const SITE = 'https://nailapp.pages.dev/'; // адрес сайта для подписи уведомлений (VAPID)
// Пока у прежнего мастера нет расписания в базе, свободное время берём из прежнего места.
const GITHUB_OKNA = 'https://raw.githubusercontent.com/komron4111/kae-zapis-okna/main/okna.json';
const LEGACY = 'legacy';
const BACKUPS_KEPT = 30;
const MAX_BACKUP = 1900 * 1024; // в D1 строка не больше 2 МБ
const MAX_PHOTO = 1900 * 1024;
const HOUR = 3600e3;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Expose-Headers': 'X-Backup-Created',
  'Access-Control-Max-Age': '86400',
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    let response;
    try {
      response = await route(request, env, ctx);
    } catch (e) {
      if (e instanceof HttpError) {
        response = json({ error: e.message }, e.status);
      } else {
        console.error(e && e.stack ? e.stack : e);
        const place = `${request.method} ${new URL(request.url).pathname.replace(/^(\/api\/(?:bookings|photos|requests|admin\/masters))\/[^/]+/, '$1/:id')}`;
        ctx.waitUntil(logError(env, 'server', place, (e && e.message) || String(e)).catch(() => {}));
        response = json({ error: 'Ошибка сервера, попробуйте позже' }, 500);
      }
    }
    for (const [name, value] of Object.entries(CORS)) response.headers.set(name, value);
    return response;
  },
};

async function route(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '');
  const method = request.method;
  const slug = url.searchParams.get('m');

  let m;
  // Для всех: страница клиентов (?m=<мастер>), личная ссылка на запись, регистрация и вход.
  if (path === '/api/okna' && method === 'GET') return getOkna(env, slug);
  if (path === '/api/requests' && method === 'POST') return createRequest(request, env, ctx, slug);
  if ((m = path.match(/^\/api\/bookings\/([\w-]{16,64})$/)) && method === 'GET') return getBooking(env, m[1]);
  if (path === '/api/register' && method === 'POST') return register(request, env);
  if (path === '/api/login' && method === 'POST') return login(request, env);
  if (path === '/api/contact' && method === 'GET') return getContact(env);
  if (path === '/api/pair' && method === 'POST') return pair(request, env); // вход по коду, как до 2.0.0
  if (path === '/api/errors' && method === 'POST') return reportError(request, env);

  // Администратор: мастера, сброс пароля, контакт для «Забыли пароль?».
  if (path.startsWith('/api/admin/')) {
    if (path === '/api/admin/passkey/login-options' && method === 'POST') return passkeyLoginOptions(request, env);
    if (path === '/api/admin/passkey/login' && method === 'POST') return passkeyLogin(request, env);
    await authAdmin(request, env);
    if (path === '/api/admin/masters' && method === 'GET') return listMasters(env);
    if (path === '/api/admin/passkeys' && method === 'GET') return listPasskeys(env);
    if (path === '/api/admin/passkey/options' && method === 'POST') return passkeyRegisterOptions(request, env);
    if (path === '/api/admin/passkeys' && method === 'POST') return passkeyRegister(request, env);
    if ((m = path.match(/^\/api\/admin\/passkeys\/([\w-]+)$/)) && method === 'DELETE') return deletePasskey(env, m[1]);
    if ((m = path.match(/^\/api\/admin\/masters\/([\w-]+)\/password$/)) && method === 'POST') return resetPassword(request, env, m[1]);
    if (path === '/api/admin/contact' && method === 'PUT') return putContact(request, env);
    if ((m = path.match(/^\/api\/admin\/masters\/([\w-]+)\/subscription$/)) && method === 'POST') return changeSubscription(request, env, m[1]);
    throw new HttpError(404, 'Не найдено');
  }

  // Дальше — только для телефона мастера, по ключу устройства. me — { deviceId, masterId }.
  const me = await authDevice(request, env);
  if (path === '/api/account' && method === 'GET') return getAccount(env, me);
  if (path === '/api/account/claim' && method === 'POST') return claimAccount(request, env, me);
  if (path === '/api/account/password' && method === 'PUT') return changePassword(request, env, me);
  if (path === '/api/account/session' && method === 'DELETE') return logout(env, me);
  // Подписка закончилась: данные мастера не принимаем и не отдаём, пока администратор её не продлит.
  if (!me.active) throw new HttpError(402, 'Подписка закончилась — продлите её у администратора');
  if (path === '/api/push' && method === 'PUT') return savePush(request, env, me);
  if (path === '/api/schedule' && method === 'PUT') return saveSchedule(request, env, me);
  if (path === '/api/requests' && method === 'GET') return listRequests(env, me);
  if ((m = path.match(/^\/api\/requests\/([\w-]+)\/(confirm|decline)$/)) && method === 'POST') return closeRequest(request, env, me, m[1], m[2]);
  if ((m = path.match(/^\/api\/bookings\/([\w-]{16,64})$/)) && method === 'PUT') return putBooking(request, env, me, m[1]);
  if (path === '/api/backup' && method === 'PUT') return putBackup(request, env, me);
  if (path === '/api/backup' && method === 'GET') return getBackup(env, me);
  if (path === '/api/photos' && method === 'GET') return listPhotos(env, me);
  if ((m = path.match(/^\/api\/photos\/([\w-]+)$/))) {
    if (method === 'PUT') return putPhoto(request, env, me, m[1]);
    if (method === 'GET') return getPhoto(env, me, m[1]);
    if (method === 'DELETE') return deletePhoto(env, me, m[1]);
  }
  throw new HttpError(404, 'Не найдено');
}

// ---------- Мелочи ----------

async function sha256hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function readJson(request, maxBytes) {
  const text = await request.text();
  if (text.length > maxBytes) throw new HttpError(413, 'Слишком большой запрос');
  try {
    const value = JSON.parse(text);
    if (value && typeof value === 'object') return value;
  } catch (e) { /* ниже — понятная ошибка */ }
  throw new HttpError(400, 'Неверный запрос');
}

async function readBytes(request, maxBytes) {
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (!bytes.length) throw new HttpError(400, 'Пустой файл');
  if (bytes.length > maxBytes) throw new HttpError(413, 'Файл слишком большой');
  return bytes;
}

// D1 отдаёт BLOB как ArrayBuffer или как массив чисел — приводим к байтам.
function toBytes(value) {
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  return Uint8Array.from(value || []);
}

// Ограничение попыток: не больше max за windowMs (who — хэш адреса, номера или id мастера).
async function tooMany(env, kind, who, max, windowMs) {
  const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM attempts WHERE kind = ? AND who = ? AND at > ?')
    .bind(kind, who, Date.now() - windowMs).first();
  return row.n >= max;
}

function remember(env, kind, who) {
  return env.DB.prepare('INSERT INTO attempts (kind, who, at) VALUES (?, ?, ?)').bind(kind, who, Date.now()).run();
}

const visitor = request => sha256hex('ip:' + (request.headers.get('CF-Connecting-IP') || 'local'));

// Старые заявки, личные ссылки (через 60 дней после записи), счётчики попыток
// и журнал ошибок (через 14 дней) не храним.
async function cleanup(env, today) {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM requests WHERE date < ?').bind(today),
    env.DB.prepare('DELETE FROM bookings WHERE date < ?').bind(L.addDays(today, -60)),
    env.DB.prepare('DELETE FROM attempts WHERE at < ?').bind(Date.now() - 864e5),
    env.DB.prepare('DELETE FROM errors WHERE at < ?').bind(new Date(Date.now() - 14 * 864e5).toISOString()),
    env.DB.prepare('DELETE FROM challenges WHERE at < ?').bind(Date.now() - CHALLENGE_TTL),
    env.DB.prepare('DELETE FROM admin_sessions WHERE expires < ?').bind(Date.now()),
  ]);
}

// Журнал ошибок — чтобы узнать о сбое раньше, чем мастер или клиент напишут.
// Не больше ERRORS_PER_HOUR записей в час: поток одинаковых ошибок не съест лимит базы.
const ERRORS_PER_HOUR = 300;

async function logError(env, source, place, message) {
  const now = new Date();
  await env.DB.prepare(`
    INSERT INTO errors (at, source, place, message) SELECT ?, ?, ?, ?
    WHERE (SELECT COUNT(*) FROM errors WHERE at > ?) < ?`)
    .bind(now.toISOString(), source, String(place).slice(0, 160), String(message).slice(0, 400), new Date(now - HOUR).toISOString(), ERRORS_PER_HOUR)
    .run();
}

// Ошибка со страницы (frontend/errors.js): приложение мастера, страница клиентов, администратор.
async function reportError(request, env) {
  const who = await visitor(request);
  if (await tooMany(env, 'error', who, 20, HOUR)) return json({ ok: true }); // это только журнал — молча
  const body = await readJson(request, 2048);
  const source = ['app', 'okna', 'admin'].includes(body.source) ? body.source : 'page';
  await remember(env, 'error', who);
  await logError(env, source, String(body.place || ''), String(body.message || ''));
  return json({ ok: true });
}

const newToken = () => L.bytesToB64u(crypto.getRandomValues(new Uint8Array(16)));

// Запись клиента по личной ссылке. Чужую (другого мастера) не перезаписываем.
async function saveBooking(env, masterId, token, booking) {
  const now = new Date().toISOString();
  await env.DB.prepare(`
    INSERT INTO bookings (token, created, updated, status, date, time, name, services, total, prepaid, master_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (token) DO UPDATE SET updated = excluded.updated, status = excluded.status, date = excluded.date,
      time = excluded.time, name = excluded.name, services = excluded.services, total = excluded.total, prepaid = excluded.prepaid
    WHERE bookings.master_id = excluded.master_id`)
    .bind(token, now, now, booking.status, booking.date, booking.time, booking.name, JSON.stringify(booking.services), booking.total, booking.prepaid, masterId)
    .run();
}

async function hasDevice(env, masterId) {
  return Boolean(await env.DB.prepare('SELECT 1 FROM devices WHERE master_id = ? LIMIT 1').bind(masterId).first());
}

async function vapidKeys(env) {
  const row = await env.DB.prepare("SELECT value FROM config WHERE key = 'vapid'").first();
  if (row) return JSON.parse(row.value);
  const keys = await generateVapidKeys();
  await env.DB.prepare("INSERT OR IGNORE INTO config (key, value) VALUES ('vapid', ?)").bind(JSON.stringify(keys)).run();
  const saved = await env.DB.prepare("SELECT value FROM config WHERE key = 'vapid'").first();
  return JSON.parse(saved.value);
}

// ---------- Мастера ----------

// Мастер по ссылке для клиентов: okna/?m=<slug>; без неё — прежний мастер (ссылка Арай до аккаунтов).
async function masterBySlug(env, slug) {
  const s = String(slug || '').trim().toLowerCase();
  const row = s
    ? await env.DB.prepare('SELECT id, name, slug, paid_until, unlimited FROM masters WHERE slug = ?').bind(s).first()
    : await env.DB.prepare('SELECT id, name, slug, paid_until, unlimited FROM masters WHERE id = ?').bind(LEGACY).first();
  if (!row) throw new HttpError(404, 'Мастер не найден — проверьте ссылку');
  return row;
}

// Свободная ссылка по имени: «Арай» → aray, занята — aray-2, aray-3…
async function freeSlug(env, name) {
  const base = L.slugify(name);
  for (let i = 1; i < 100; i++) {
    const slug = i === 1 ? base : `${base}-${i}`;
    if (!(await env.DB.prepare('SELECT 1 FROM masters WHERE slug = ?').bind(slug).first())) return slug;
  }
  return `${base}-${Date.now().toString(36)}`;
}

// ---------- Подписка ----------
// Доступ открыт по paid_until включительно, по времени Алматы (весь Казахстан — UTC+5).
const almatyToday = () => L.masterClock(-300).date;

async function periodsOf(env, masterId) {
  const { results } = await env.DB.prepare('SELECT start_date, end_date, kind, created FROM subscriptions WHERE master_id = ? ORDER BY start_date, id')
    .bind(masterId).all();
  return results.map(r => ({ from: r.start_date, to: r.end_date, kind: r.kind, marked: r.created }));
}

// Что видит мастер: текущий период (или последний), до какого дня доступ, открыт ли он сейчас.
function subscriptionJson(m, periods) {
  const today = almatyToday();
  const sub = { until: m.paid_until || null, unlimited: Boolean(m.unlimited) };
  const current = periods.find(p => p.from <= today && today <= p.to) || periods[periods.length - 1] || null;
  return { ...sub, from: current ? current.from : null, kind: current ? current.kind : null, active: L.subscriptionActive(sub, today) };
}

const accountJson = (m, periods = []) => ({
  name: m.name, phone: m.phone ? L.formatPhone(m.phone) : '', slug: m.slug, claimed: Boolean(m.pass_hash),
  subscription: subscriptionJson(m, periods),
});
const hashSecret = (salt, secret) => sha256hex(`${salt}:${secret}`);

function readName(body) {
  const name = String(body.name || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  if (!name) throw new HttpError(400, 'Укажите имя');
  return name;
}

function readPhone(body) {
  const phone = L.phoneDigits(body.phone);
  if (!/^7\d{10}$/.test(phone)) throw new HttpError(400, 'Укажите номер телефона полностью');
  return phone;
}

// Секрет — пароль, растянутый на телефоне (base64url, 43 знака). Сам пароль сюда не приходит.
function readSecret(value) {
  const secret = String(value || '');
  if (!/^[\w-]{40,100}$/.test(secret)) throw new HttpError(400, 'Неверный пароль');
  return secret;
}

function readKey(body) {
  const key = String(body.key || '');
  if (!/^[\w-]{40,100}$/.test(key)) throw new HttpError(400, 'Неверный ключ устройства');
  return key;
}

async function deviceRow(env, masterId, key, name) {
  return env.DB.prepare('INSERT INTO devices (id, key_hash, name, created, master_id) VALUES (?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), await sha256hex(key), String(name || 'Телефон мастера').slice(0, 60), new Date().toISOString(), masterId);
}

// Один телефон на аккаунт: вход на новом телефоне отключает прежний (например, потерянный).
async function startSession(env, masterId, key, name) {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM devices WHERE master_id = ?').bind(masterId),
    await deviceRow(env, masterId, key, name),
  ]);
}

async function register(request, env) {
  const who = await visitor(request);
  if (await tooMany(env, 'register', who, 5, HOUR)) throw new HttpError(429, 'Слишком много регистраций подряд. Попробуйте через час');
  const body = await readJson(request, 2048);
  const name = readName(body);
  const phone = readPhone(body);
  const secret = readSecret(body.secret);
  const key = readKey(body);
  await remember(env, 'register', who);
  if (await env.DB.prepare('SELECT 1 FROM masters WHERE phone = ?').bind(phone).first()) {
    throw new HttpError(409, 'Этот номер уже зарегистрирован — войдите по нему');
  }
  const id = crypto.randomUUID(), salt = newToken(), now = new Date().toISOString();
  const first = L.nextPeriod(null, almatyToday()); // первый месяц — с дня регистрации
  const master = { name, phone, slug: await freeSlug(env, name), pass_hash: await hashSecret(salt, secret), paid_until: first.end, unlimited: 0 };
  try {
    await env.DB.prepare('INSERT INTO masters (id, phone, name, slug, pass_hash, pass_salt, created, updated, paid_until) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, phone, name, master.slug, master.pass_hash, salt, now, now, first.end).run();
  } catch (e) {
    // Два запроса с одним номером одновременно: второй упирается в UNIQUE.
    if (/UNIQUE/i.test(String(e && e.message))) throw new HttpError(409, 'Этот номер уже зарегистрирован — войдите по нему');
    throw e;
  }
  await env.DB.prepare("INSERT INTO subscriptions (master_id, start_date, end_date, kind, created) VALUES (?, ?, ?, 'trial', ?)")
    .bind(id, first.start, first.end, now).run();
  await startSession(env, id, key, body.device);
  return json({ ok: true, account: accountJson(master, [{ from: first.start, to: first.end, kind: 'trial', marked: now }]), pushKey: (await vapidKeys(env)).publicKey }, 201);
}

async function login(request, env) {
  const who = await visitor(request);
  const body = await readJson(request, 2048);
  const phone = readPhone(body);
  const secret = readSecret(body.secret);
  const key = readKey(body);
  const byPhone = await sha256hex('phone:' + phone);
  if (await tooMany(env, 'login', who, 10, HOUR) || await tooMany(env, 'login-phone', byPhone, 20, HOUR)) {
    throw new HttpError(429, 'Слишком много попыток входа. Попробуйте через час или напишите администратору');
  }
  const master = await env.DB.prepare('SELECT id, name, phone, slug, pass_hash, pass_salt, paid_until, unlimited FROM masters WHERE phone = ?').bind(phone).first();
  if (!master || !master.pass_hash || await hashSecret(master.pass_salt, secret) !== master.pass_hash) {
    await remember(env, 'login', who);
    await remember(env, 'login-phone', byPhone);
    throw new HttpError(403, 'Неверный номер или пароль');
  }
  await startSession(env, master.id, key, body.device);
  return json({ ok: true, account: accountJson(master, await periodsOf(env, master.id)), pushKey: (await vapidKeys(env)).publicKey });
}

async function getAccount(env, me) {
  const master = await env.DB.prepare('SELECT name, phone, slug, pass_hash, paid_until, unlimited FROM masters WHERE id = ?').bind(me.masterId).first();
  if (!master) throw new HttpError(401, 'Аккаунт не найден — войдите заново');
  return json({ account: accountJson(master, await periodsOf(env, me.masterId)) });
}

// Прежний мастер (до 2.0.0) задаёт номер, имя и пароль — дальше входит, как все.
async function claimAccount(request, env, me) {
  const master = await env.DB.prepare('SELECT name, phone, slug, pass_hash, paid_until, unlimited FROM masters WHERE id = ?').bind(me.masterId).first();
  if (!master) throw new HttpError(401, 'Аккаунт не найден — войдите заново');
  if (master.pass_hash) throw new HttpError(409, 'Аккаунт уже оформлен');
  const body = await readJson(request, 2048);
  const name = readName(body);
  const phone = readPhone(body);
  const secret = readSecret(body.secret);
  if (await env.DB.prepare('SELECT 1 FROM masters WHERE phone = ? AND id <> ?').bind(phone, me.masterId).first()) {
    throw new HttpError(409, 'Этот номер уже занят другим аккаунтом — напишите администратору');
  }
  const salt = newToken(), hash = await hashSecret(salt, secret);
  await env.DB.prepare('UPDATE masters SET phone = ?, name = ?, pass_hash = ?, pass_salt = ?, updated = ? WHERE id = ?')
    .bind(phone, name, hash, salt, new Date().toISOString(), me.masterId).run();
  return json({ ok: true, account: accountJson({ ...master, name, phone, pass_hash: hash }, await periodsOf(env, me.masterId)) });
}

async function changePassword(request, env, me) {
  if (await tooMany(env, 'password', me.masterId, 5, HOUR)) throw new HttpError(429, 'Слишком много попыток. Попробуйте через час');
  const body = await readJson(request, 2048);
  const old = readSecret(body.old);
  const secret = readSecret(body.secret);
  const master = await env.DB.prepare('SELECT pass_hash, pass_salt FROM masters WHERE id = ?').bind(me.masterId).first();
  if (!master || !master.pass_hash) throw new HttpError(409, 'Сначала оформите аккаунт');
  if (await hashSecret(master.pass_salt, old) !== master.pass_hash) {
    await remember(env, 'password', me.masterId);
    throw new HttpError(403, 'Текущий пароль неверный');
  }
  const salt = newToken();
  await env.DB.prepare('UPDATE masters SET pass_hash = ?, pass_salt = ?, updated = ? WHERE id = ?')
    .bind(await hashSecret(salt, secret), salt, new Date().toISOString(), me.masterId).run();
  return json({ ok: true });
}

async function logout(env, me) {
  await env.DB.prepare('DELETE FROM devices WHERE id = ?').bind(me.deviceId).run();
  return json({ ok: true });
}

// Вход по коду доступа, как до 2.0.0 (старые версии приложения), — к прежнему мастеру
// и только пока его аккаунт не оформлен.
async function pair(request, env) {
  const who = await visitor(request);
  if (await tooMany(env, 'pair', who, 5, HOUR)) throw new HttpError(429, 'Слишком много попыток. Попробуйте через час');
  const body = await readJson(request, 2048);
  const code = String(env.ACCESS_CODE || '');
  if (code.length < 8) throw new HttpError(503, 'Код доступа ещё не задан на сервере');
  // Сравниваем хэши, чтобы время ответа не выдавало совпавшие символы.
  if (await sha256hex(String(body.code || '').trim()) !== await sha256hex(code)) {
    await remember(env, 'pair', who);
    throw new HttpError(403, 'Неверный код доступа');
  }
  const legacy = await env.DB.prepare('SELECT pass_hash FROM masters WHERE id = ?').bind(LEGACY).first();
  if (legacy && legacy.pass_hash) throw new HttpError(410, 'Вход по коду больше не работает — обновите приложение и войдите по номеру и паролю');
  // Подключённый телефон не отключаем: в новом приложении по коду уже не войти,
  // и прежний мастер остался бы без доступа, пока не оформит аккаунт.
  await (await deviceRow(env, LEGACY, readKey(body), body.name)).run();
  return json({ ok: true, pushKey: (await vapidKeys(env)).publicKey });
}

async function authDevice(request, env) {
  const m = (request.headers.get('Authorization') || '').match(/^Bearer ([\w-]{40,100})$/);
  if (!m) throw new HttpError(401, 'Войдите в аккаунт');
  const row = await env.DB.prepare(`SELECT d.id, d.master_id, m.paid_until, m.unlimited FROM devices d
    LEFT JOIN masters m ON m.id = d.master_id WHERE d.key_hash = ?`).bind(await sha256hex(m[1])).first();
  if (!row) throw new HttpError(401, 'Вы вошли в аккаунт на другом телефоне или пароль сменили — войдите снова');
  return { deviceId: row.id, masterId: row.master_id, active: L.subscriptionActive({ until: row.paid_until, unlimited: row.unlimited }, almatyToday()) };
}

// ---------- Администратор ----------

// Код приходит в заголовке «Admin <base64url кода>»: так он может быть и по-русски.
async function authAdmin(request, env) {
  // После входа по Face ID страница присылает сеанс (12 часов) вместо кода.
  const session = (request.headers.get('Authorization') || '').match(/^Session ([\w-]{40,100})$/);
  if (session) {
    const row = await env.DB.prepare('SELECT expires FROM admin_sessions WHERE hash = ?').bind(await sha256hex(session[1])).first();
    if (row && row.expires > Date.now()) return;
    throw new HttpError(401, 'Вход по Face ID устарел — войдите снова');
  }
  const code = String(env.ADMIN_CODE || env.ACCESS_CODE || '');
  if (code.length < 8) throw new HttpError(503, 'Код администратора не задан на сервере');
  const who = await visitor(request);
  if (await tooMany(env, 'admin', who, 5, HOUR)) throw new HttpError(429, 'Слишком много попыток. Попробуйте через час');
  const m = (request.headers.get('Authorization') || '').match(/^Admin ([\w-]+)$/);
  let given = '';
  try {
    given = m ? new TextDecoder().decode(L.b64uToBytes(m[1])).trim() : '';
  } catch (e) { /* неверная кодировка — как неверный код */ }
  if (await sha256hex(given) !== await sha256hex(code)) {
    await remember(env, 'admin', who);
    throw new HttpError(403, 'Неверный код администратора');
  }
}

// ---------- Вход администратора по Face ID (WebAuthn) ----------
// Администратор один раз входит по коду и включает Face ID на своём телефоне; дальше страница
// администратора открывается по Face ID или код-паролю телефона. Сеанс — 12 часов, только в памяти страницы.

// Где открыта страница администратора (заголовок Origin). Ключ Face ID привязан к этому адресу.
const ADMIN_ORIGINS = ['https://nailapp.pages.dev', 'https://komron4111.github.io'];
const CHALLENGE_TTL = 5 * 60e3;
const ADMIN_SESSION = 12 * HOUR;

function adminOrigin(request) {
  const origin = request.headers.get('Origin') || '';
  if (ADMIN_ORIGINS.includes(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin)) return origin;
  throw new HttpError(403, 'Вход по Face ID работает только на странице администратора Nailapp');
}

// Одноразовый вызов: 32 случайных байта. Всего в базе не больше 1000 — поток запросов её не раздует.
async function newChallenge(env, kind) {
  const value = L.bytesToB64u(crypto.getRandomValues(new Uint8Array(32)));
  const { meta } = await env.DB.prepare('INSERT INTO challenges (value, kind, at) SELECT ?, ?, ? WHERE (SELECT COUNT(*) FROM challenges) < 1000')
    .bind(value, kind, Date.now()).run();
  if (!meta.changes) throw new HttpError(429, 'Слишком много попыток. Попробуйте через несколько минут');
  return value;
}

// Вызов из ответа телефона должен быть нашим, свежим и ещё не использованным.
async function useChallenge(env, clientDataJSON, kind) {
  let value = '';
  try {
    value = String(JSON.parse(new TextDecoder().decode(W.unb64u(clientDataJSON))).challenge || '');
  } catch (e) { /* ниже — «вход устарел» */ }
  const row = value && await env.DB.prepare('DELETE FROM challenges WHERE value = ? AND kind = ? RETURNING at').bind(value, kind).first();
  if (!row || row.at < Date.now() - CHALLENGE_TTL) throw new HttpError(403, 'Вход устарел — нажмите ещё раз');
  return value;
}

const adminKeys = (env, rpId) => env.DB.prepare("SELECT id FROM passkeys WHERE owner = 'admin' AND rp_id = ?").bind(rpId).all();

// Для кнопки «Войти по Face ID»: есть ли ключи для этого адреса и вызов для подписи.
async function passkeyLoginOptions(request, env) {
  const rpId = new URL(adminOrigin(request)).hostname;
  const { results } = await adminKeys(env, rpId);
  if (!results.length) return json({ available: false });
  return json({ available: true, challenge: await newChallenge(env, 'login'), rpId, allow: results.map(r => r.id), timeout: 120000 });
}

async function passkeyLogin(request, env) {
  const origin = adminOrigin(request);
  const who = await visitor(request);
  if (await tooMany(env, 'admin', who, 5, HOUR)) throw new HttpError(429, 'Слишком много попыток. Попробуйте через час');
  const body = await readJson(request, 8192);
  const challenge = await useChallenge(env, body.clientDataJSON, 'login');
  const key = await env.DB.prepare("SELECT id, rp_id, public_key FROM passkeys WHERE id = ? AND owner = 'admin'").bind(String(body.id || '')).first();
  try {
    if (!key || key.rp_id !== new URL(origin).hostname) throw new Error('нет такого ключа');
    await W.verifyAssertion(body, { challenge, origin, rpId: key.rp_id, jwk: JSON.parse(key.public_key) });
  } catch (e) {
    await remember(env, 'admin', who);
    throw new HttpError(403, 'Не получилось войти по Face ID — войдите по коду администратора');
  }
  const token = L.bytesToB64u(crypto.getRandomValues(new Uint8Array(32)));
  const expires = Date.now() + ADMIN_SESSION;
  await env.DB.batch([
    env.DB.prepare('INSERT INTO admin_sessions (hash, expires) VALUES (?, ?)').bind(await sha256hex(token), expires),
    env.DB.prepare('UPDATE passkeys SET used = ? WHERE id = ?').bind(new Date().toISOString(), key.id),
  ]);
  return json({ token, expires });
}

async function listPasskeys(env) {
  const { results } = await env.DB.prepare("SELECT id, rp_id, name, created, used FROM passkeys WHERE owner = 'admin' ORDER BY created").all();
  return json({ passkeys: results.map(r => ({ id: r.id, site: r.rp_id, name: r.name, created: r.created, used: r.used })) });
}

// Для кнопки «Включить вход по Face ID»: вызов и данные нового ключа.
async function passkeyRegisterOptions(request, env) {
  const rpId = new URL(adminOrigin(request)).hostname;
  const { results } = await adminKeys(env, rpId);
  return json({
    challenge: await newChallenge(env, 'register'),
    rp: { id: rpId, name: 'Nailapp' },
    user: { id: L.bytesToB64u(new TextEncoder().encode('nailapp-admin')), name: 'Администратор Nailapp', displayName: 'Администратор Nailapp' },
    exclude: results.map(r => r.id),
    timeout: 120000,
  });
}

async function passkeyRegister(request, env) {
  const origin = adminOrigin(request);
  const body = await readJson(request, 16384);
  const challenge = await useChallenge(env, body.clientDataJSON, 'register');
  let key;
  try {
    key = await W.verifyRegistration(body, { challenge, origin });
  } catch (e) {
    throw new HttpError(400, `Не получилось включить вход по Face ID: ${e.message}`);
  }
  const { n } = await env.DB.prepare("SELECT COUNT(*) AS n FROM passkeys WHERE owner = 'admin'").first();
  if (n >= 10) throw new HttpError(409, 'Уже 10 устройств с входом по Face ID — уберите лишние');
  await env.DB.prepare('INSERT OR REPLACE INTO passkeys (id, owner, rp_id, public_key, name, created) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(key.id, 'admin', key.rpId, JSON.stringify(key.jwk), String(body.name || '').slice(0, 60), new Date().toISOString()).run();
  return json({ ok: true, id: key.id });
}

async function deletePasskey(env, id) {
  await env.DB.prepare("DELETE FROM passkeys WHERE id = ? AND owner = 'admin'").bind(id).run();
  return json({ ok: true });
}

// Мастера для администратора: кто, где принимает и сколько места его данные занимают на сервере
// (фото, копии; «прочее» — расписание и записи клиентов по личным ссылкам). size — вся база.
async function listMasters(env) {
  const { results, meta } = await env.DB.prepare(`
    SELECT m.id, m.name, m.phone, m.slug, m.created, m.pass_hash <> '' AS claimed, m.paid_until, m.unlimited,
      (SELECT COUNT(*) FROM devices d WHERE d.master_id = m.id) AS devices,
      s.updated AS active, json_extract(s.value, '$.address') AS address, json_extract(s.value, '$.gis') AS gis,
      (SELECT COUNT(*) FROM photos p WHERE p.master_id = m.id) AS photos,
      (SELECT COALESCE(SUM(LENGTH(p.data)), 0) FROM photos p WHERE p.master_id = m.id) AS photo_bytes,
      (SELECT COUNT(*) FROM backups b WHERE b.master_id = m.id) AS backups,
      (SELECT COALESCE(SUM(LENGTH(b.data)), 0) FROM backups b WHERE b.master_id = m.id) AS backup_bytes,
      COALESCE(LENGTH(s.value), 0)
        + (SELECT COALESCE(SUM(LENGTH(k.name) + LENGTH(k.services) + 120), 0) FROM bookings k WHERE k.master_id = m.id) AS other_bytes
    FROM masters m LEFT JOIN schedules s ON s.master_id = m.id
    ORDER BY m.created DESC`).all();
  const { results: all } = await env.DB.prepare('SELECT id, master_id, start_date, end_date, kind, created FROM subscriptions ORDER BY start_date, id').all();
  const periods = {};
  for (const p of all) (periods[p.master_id] = periods[p.master_id] || []).push({ id: p.id, from: p.start_date, to: p.end_date, kind: p.kind, marked: p.created });
  return json({
    today: almatyToday(),
    size: (meta && meta.size_after) || null,
    masters: results.map(r => ({
      id: r.id, name: r.name, phone: r.phone ? L.formatPhone(r.phone) : '', slug: r.slug, created: r.created,
      claimed: Boolean(r.claimed), devices: r.devices, active: r.active || null,
      address: L.addressText(r.address), gis: L.gisLink(r.gis),
      storage: { photos: r.photos, photoBytes: r.photo_bytes, backups: r.backups, backupBytes: r.backup_bytes, otherBytes: r.other_bytes },
      subscription: { ...subscriptionJson(r, periods[r.id] || []), periods: periods[r.id] || [] },
    })),
  });
}

// Новый пароль задаёт администратор: страница администратора придумывает временный пароль
// и растягивает его так же, как телефон мастера. Прежний телефон мастера отключается.
async function resetPassword(request, env, id) {
  const master = await env.DB.prepare('SELECT phone FROM masters WHERE id = ?').bind(id).first();
  if (!master) throw new HttpError(404, 'Мастер не найден');
  if (!master.phone) throw new HttpError(409, 'У мастера ещё нет номера — аккаунт не оформлен');
  const secret = readSecret((await readJson(request, 2048)).secret);
  const salt = newToken();
  await env.DB.batch([
    env.DB.prepare('UPDATE masters SET pass_hash = ?, pass_salt = ?, updated = ? WHERE id = ?')
      .bind(await hashSecret(salt, secret), salt, new Date().toISOString(), id),
    env.DB.prepare('DELETE FROM devices WHERE master_id = ?').bind(id),
  ]);
  return json({ ok: true });
}

// Подписка мастера — решает администратор:
//   extend — оплата получена: ещё месяц (от конца текущего периода или с сегодняшнего дня);
//   undo — отменить последнюю отмеченную оплату (отметили по ошибке);
//   unlimited — бессрочный доступ вкл./выкл. (value);
//   until — доступ до даты (value, YYYY-MM-DD): продлить или сократить вручную.
async function changeSubscription(request, env, id) {
  const master = await env.DB.prepare('SELECT id, name, phone, slug, pass_hash, paid_until, unlimited FROM masters WHERE id = ?').bind(id).first();
  if (!master) throw new HttpError(404, 'Мастер не найден');
  const body = await readJson(request, 1024);
  const today = almatyToday(), now = new Date().toISOString();
  if (body.action === 'extend') {
    const next = L.nextPeriod(master.paid_until, today);
    await env.DB.batch([
      env.DB.prepare("INSERT INTO subscriptions (master_id, start_date, end_date, kind, created) VALUES (?, ?, ?, 'paid', ?)").bind(id, next.start, next.end, now),
      env.DB.prepare('UPDATE masters SET paid_until = ? WHERE id = ?').bind(next.end, id),
    ]);
  } else if (body.action === 'undo') {
    const last = await env.DB.prepare("SELECT id FROM subscriptions WHERE master_id = ? AND kind = 'paid' ORDER BY id DESC LIMIT 1").bind(id).first();
    if (!last) throw new HttpError(409, 'Отмеченных оплат нет');
    await env.DB.batch([
      env.DB.prepare('DELETE FROM subscriptions WHERE id = ?').bind(last.id),
      env.DB.prepare('UPDATE masters SET paid_until = (SELECT MAX(end_date) FROM subscriptions WHERE master_id = ?) WHERE id = ?').bind(id, id),
    ]);
  } else if (body.action === 'unlimited') {
    await env.DB.prepare('UPDATE masters SET unlimited = ? WHERE id = ?').bind(body.value ? 1 : 0, id).run();
  } else if (body.action === 'until') {
    const until = String(body.value || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(until) || L.addDays(until, 0) !== until) throw new HttpError(400, 'Неверная дата');
    const steps = [env.DB.prepare('UPDATE masters SET paid_until = ? WHERE id = ?').bind(until, id)];
    if (!master.paid_until || until > master.paid_until) {
      // Продлили вручную — период от конца прежнего (или с сегодняшнего дня) до новой даты.
      const from = master.paid_until && master.paid_until >= today ? L.addDays(master.paid_until, 1) : today;
      if (from <= until) steps.push(env.DB.prepare("INSERT INTO subscriptions (master_id, start_date, end_date, kind, created) VALUES (?, ?, ?, 'manual', ?)").bind(id, from, until, now));
    } else {
      // Сократили — периоды после новой даты обрезаем, чтобы календарь совпадал с доступом.
      steps.push(env.DB.prepare('DELETE FROM subscriptions WHERE master_id = ? AND start_date > ?').bind(id, until));
      steps.push(env.DB.prepare('UPDATE subscriptions SET end_date = ? WHERE master_id = ? AND end_date > ?').bind(until, id, until));
    }
    await env.DB.batch(steps);
  } else {
    throw new HttpError(400, 'Неизвестное действие');
  }
  const fresh = await env.DB.prepare('SELECT paid_until, unlimited FROM masters WHERE id = ?').bind(id).first();
  const periods = await periodsOf(env, id);
  return json({ ok: true, subscription: { ...subscriptionJson(fresh, periods), periods } });
}

// Куда писать, если забыли пароль: WhatsApp администратора.
async function getContact(env) {
  const row = await env.DB.prepare("SELECT value FROM config WHERE key = 'contact'").first();
  return json({ whatsapp: row ? row.value : '' });
}

async function putContact(request, env) {
  const digits = L.phoneDigits((await readJson(request, 1024)).whatsapp);
  if (digits && !/^7\d{10}$/.test(digits)) throw new HttpError(400, 'Укажите номер WhatsApp полностью');
  await env.DB.prepare("INSERT OR REPLACE INTO config (key, value) VALUES ('contact', ?)").bind(digits).run();
  return json({ ok: true, whatsapp: digits });
}

// ---------- Страница клиентов ----------

// Расписание проверяется и при выдаче: в базе может лежать сохранённое до проверки.
async function loadSchedule(env, masterId) {
  const row = await env.DB.prepare('SELECT value FROM schedules WHERE master_id = ?').bind(masterId).first();
  if (row) return L.cleanSchedule(JSON.parse(row.value));
  if (masterId !== LEGACY) return null;
  try {
    const res = await fetch(GITHUB_OKNA, { cf: { cacheTtl: 60 } });
    if (res.ok) return L.cleanSchedule(await res.json());
  } catch (e) { /* нет расписания — страница покажет «скоро появится» */ }
  return null;
}

// Заявки мастера, которые ждут ответа: занимают время по своим услугам.
async function holds(env, masterId) {
  const { results } = await env.DB.prepare('SELECT date, time, services FROM requests WHERE master_id = ?').bind(masterId).all();
  return results.map(r => ({ date: r.date, time: r.time, services: JSON.parse(r.services || '[]') }));
}

const masterActive = master => L.subscriptionActive({ until: master.paid_until, unlimited: master.unlimited }, almatyToday());

async function getOkna(env, slug) {
  const master = await masterBySlug(env, slug);
  const schedule = await loadSchedule(env, master.id);
  const legacy = master.id === LEGACY; // прежняя ссылка Арай (до аккаунтов)
  // Подписка мастера закончилась: время не показываем (оно не обновляется), только связь с мастером.
  if (!masterActive(master)) {
    const s = schedule || {};
    return json({ app: 'kae-zapis', kind: 'okna', v: 2, name: s.name || master.name, whatsapp: s.whatsapp || '', address: s.address || '', gis: s.gis || '',
      slug: master.slug, legacy, paused: true, booking: false, days: [], updated: s.updated || new Date(0).toISOString() });
  }
  if (!schedule) return json({ app: 'kae-zapis', kind: 'okna', name: master.name, slug: master.slug, legacy, days: [], booking: false });
  // booking: заявки принимаем, только когда у мастера есть телефон, на который они придут.
  return json({ ...L.applyHolds(schedule, await holds(env, master.id)), slug: master.slug, legacy, booking: await hasDevice(env, master.id) });
}

async function createRequest(request, env, ctx, slug) {
  const who = await visitor(request);
  if (await tooMany(env, 'request', who, 5, HOUR)) {
    throw new HttpError(429, 'Слишком много заявок подряд. Попробуйте через час или напишите мастеру в WhatsApp');
  }
  const body = await readJson(request, 8 * 1024);
  if (body.website) return json({ ok: true }, 201); // скрытое поле заполняют только боты
  const master = await masterBySlug(env, slug);
  if (!masterActive(master)) throw new HttpError(503, 'Онлайн-запись к мастеру временно недоступна — напишите мастеру в WhatsApp');
  const schedule = await loadSchedule(env, master.id);
  if (!schedule || !(await hasDevice(env, master.id))) throw new HttpError(503, 'Запись через сайт пока не работает — напишите мастеру в WhatsApp');

  const clock = L.masterClock(schedule.tzOffset || 0);
  await cleanup(env, clock.date);
  const check = L.validateRequest(body, L.applyHolds(schedule, await holds(env, master.id)), clock);
  if (!check.ok) throw new HttpError(check.status, check.error);

  const r = check.request;
  const id = crypto.randomUUID();
  const token = newToken(); // личная ссылка клиента на эту заявку и будущую запись
  const minutes = L.toMinutes(r.time);
  const fallback = L.scheduleSettings(schedule).duration; // у заявок до 1.8.0 длительности нет
  // Вставляем, только если никто не успел оставить этому мастеру заявку, которая пересекается по времени.
  const result = await env.DB.prepare(`
    INSERT INTO requests (id, created, date, time, minutes, name, phone, services, comment, token, duration, master_id)
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    WHERE NOT EXISTS (SELECT 1 FROM requests WHERE master_id = ? AND date = ? AND minutes < ?
      AND ? < minutes + (CASE WHEN duration > 0 THEN duration ELSE ? END))`)
    .bind(id, new Date().toISOString(), r.date, r.time, minutes, r.name, r.phone, JSON.stringify(r.services), r.comment, token, r.duration, master.id,
      master.id, r.date, minutes + r.duration, minutes, fallback)
    .run();
  if (!result.meta.changes) throw new HttpError(409, 'Это время только что заняли — выберите другое');
  await remember(env, 'request', who);
  ctx.waitUntil(notifyMaster(env, master.id, { id, ...r }));
  return json({ ok: true, token }, 201);
}

async function notifyMaster(env, masterId, r) {
  const { results } = await env.DB.prepare('SELECT id, push FROM devices WHERE master_id = ? AND push IS NOT NULL').bind(masterId).all();
  if (!results.length) return;
  const vapid = await vapidKeys(env);
  const payload = JSON.stringify({ title: 'Новая заявка на запись', body: L.requestSummary(r), tag: `request-${r.id}`, url: './?open=requests' });
  for (const device of results) {
    try {
      const res = await sendPush(JSON.parse(device.push), payload, vapid, SITE);
      if (res.status === 404 || res.status === 410) {
        await env.DB.prepare('UPDATE devices SET push = NULL WHERE id = ?').bind(device.id).run();
      } else if (!res.ok) {
        console.error('push', res.status, await res.text());
      }
    } catch (e) {
      console.error('push', e && e.stack ? e.stack : e);
    }
  }
}

// Личная ссылка клиента: заявка (ждёт ответа) или запись. Мастер — тот, чья это запись.
async function getBooking(env, token) {
  const b = await env.DB.prepare('SELECT status, date, time, name, services, total, prepaid, updated, master_id FROM bookings WHERE token = ?').bind(token).first();
  const r = b ? null : await env.DB.prepare('SELECT date, time, name, services, created, master_id FROM requests WHERE token = ?').bind(token).first();
  if (!b && !r) throw new HttpError(404, 'Запись не найдена');
  const masterId = (b || r).master_id;
  const row = await env.DB.prepare('SELECT name, slug FROM masters WHERE id = ?').bind(masterId).first();
  const schedule = await loadSchedule(env, masterId);
  const master = {
    name: (schedule && schedule.name) || (row && row.name) || 'Мастер',
    whatsapp: (schedule && schedule.whatsapp) || '',
    address: (schedule && schedule.address) || '',
    gis: (schedule && schedule.gis) || '',
    slug: row ? row.slug : '',
  };
  if (b) {
    const { master_id: _, ...booking } = b;
    return json({ ...booking, services: JSON.parse(b.services), master });
  }
  const services = JSON.parse(r.services);
  const total = L.servicesTotal(services, (schedule && schedule.services) || []);
  return json({ status: 'pending', date: r.date, time: r.time, name: r.name, services, total, prepaid: 0, updated: r.created, master });
}

// ---------- Для телефона мастера ----------

async function savePush(request, env, me) {
  const sub = await readJson(request, 4096);
  // http://localhost — только для проверки на компьютере разработчика.
  if (!/^(https:\/\/|http:\/\/localhost[:/])/.test(sub.endpoint || '') || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
    throw new HttpError(400, 'Неверная подписка на уведомления');
  }
  const clean = { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } };
  await env.DB.prepare('UPDATE devices SET push = ? WHERE id = ?').bind(JSON.stringify(clean), me.deviceId).run();
  return json({ ok: true });
}

// Расписание мастера для клиентов. Имя из него — и имя мастера в аккаунте.
async function saveSchedule(request, env, me) {
  const schedule = L.cleanSchedule(await readJson(request, 64 * 1024));
  if (!schedule) throw new HttpError(400, 'Неверное расписание');
  const now = new Date().toISOString();
  const name = schedule.name;
  await env.DB.batch([
    env.DB.prepare('INSERT OR REPLACE INTO schedules (master_id, value, updated) VALUES (?, ?, ?)').bind(me.masterId, JSON.stringify(schedule), now),
    env.DB.prepare('UPDATE masters SET name = ? WHERE id = ? AND ? <> \'\'').bind(name, me.masterId, name),
  ]);
  return json({ ok: true });
}

async function listRequests(env, me) {
  const schedule = await loadSchedule(env, me.masterId);
  await cleanup(env, L.masterClock(schedule ? schedule.tzOffset || 0 : -300).date);
  const { results } = await env.DB.prepare(
    'SELECT id, created, date, time, name, phone, services, comment, token FROM requests WHERE master_id = ? ORDER BY date, time').bind(me.masterId).all();
  return json({ requests: results.map(r => ({ ...r, services: JSON.parse(r.services) })) });
}

// «Подтвердить»: заявка становится записью по той же личной ссылке клиента (данные записи
// присылает телефон). «Отклонить»: клиент по ссылке увидит, что заявку не приняли.
async function closeRequest(request, env, me, id, action) {
  const body = await readJson(request, 4096).catch(() => ({}));
  const r = await env.DB.prepare('SELECT date, time, name, services, token FROM requests WHERE id = ? AND master_id = ?').bind(id, me.masterId).first();
  const token = /^[\w-]{16,64}$/.test(body.token || '') ? body.token : r && r.token;
  if (token) {
    const booking = action === 'confirm'
      ? L.normalizeBooking({ ...body.booking, status: 'confirmed' })
      : r && L.normalizeBooking({ status: 'declined', date: r.date, time: r.time, name: r.name, services: JSON.parse(r.services) });
    if (booking) await saveBooking(env, me.masterId, token, booking);
  }
  const result = await env.DB.prepare('DELETE FROM requests WHERE id = ? AND master_id = ?').bind(id, me.masterId).run();
  return json({ ok: true, found: result.meta.changes > 0, token: token || null });
}

// Телефон мастера обновляет запись клиента: перенос, изменение услуг, оплата, отмена.
async function putBooking(request, env, me, token) {
  const booking = L.normalizeBooking(await readJson(request, 4096));
  if (!booking) throw new HttpError(400, 'Неверная запись');
  const owner = await env.DB.prepare('SELECT master_id FROM bookings WHERE token = ?').bind(token).first();
  if (owner && owner.master_id !== me.masterId) throw new HttpError(403, 'Это запись другого мастера');
  await saveBooking(env, me.masterId, token, booking);
  return json({ ok: true });
}

async function putBackup(request, env, me) {
  const format = request.headers.get('Content-Type') === 'application/gzip' ? 'gzip' : 'json';
  const bytes = await readBytes(request, MAX_BACKUP);
  const created = new Date().toISOString();
  // Храним несколько последних копий мастера: если на телефоне что-то пошло не так, есть к чему вернуться.
  await env.DB.batch([
    env.DB.prepare('INSERT INTO backups (created, format, data, master_id) VALUES (?, ?, ?, ?)').bind(created, format, bytes, me.masterId),
    env.DB.prepare('DELETE FROM backups WHERE master_id = ? AND id NOT IN (SELECT id FROM backups WHERE master_id = ? ORDER BY id DESC LIMIT ?)')
      .bind(me.masterId, me.masterId, BACKUPS_KEPT),
  ]);
  return json({ ok: true, created });
}

async function getBackup(env, me) {
  const row = await env.DB.prepare('SELECT created, format, data FROM backups WHERE master_id = ? ORDER BY id DESC LIMIT 1').bind(me.masterId).first();
  if (!row) throw new HttpError(404, 'В облаке пока нет копии');
  return new Response(toBytes(row.data), {
    headers: {
      'Content-Type': row.format === 'gzip' ? 'application/gzip' : 'application/json',
      'X-Backup-Created': row.created,
      'Cache-Control': 'no-store',
    },
  });
}

async function listPhotos(env, me) {
  const { results } = await env.DB.prepare('SELECT id FROM photos WHERE master_id = ?').bind(me.masterId).all();
  return json({ ids: results.map(r => r.id) });
}

async function putPhoto(request, env, me, id) {
  const bytes = await readBytes(request, MAX_PHOTO);
  await env.DB.prepare(`
    INSERT INTO photos (id, created, data, master_id) VALUES (?, ?, ?, ?)
    ON CONFLICT (id) DO UPDATE SET created = excluded.created, data = excluded.data WHERE photos.master_id = excluded.master_id`)
    .bind(id, new Date().toISOString(), bytes, me.masterId).run();
  return json({ ok: true });
}

async function getPhoto(env, me, id) {
  const row = await env.DB.prepare('SELECT data FROM photos WHERE id = ? AND master_id = ?').bind(id, me.masterId).first();
  if (!row) throw new HttpError(404, 'Фото не найдено');
  return new Response(toBytes(row.data), { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store' } });
}

async function deletePhoto(env, me, id) {
  await env.DB.prepare('DELETE FROM photos WHERE id = ? AND master_id = ?').bind(id, me.masterId).run();
  return json({ ok: true });
}
