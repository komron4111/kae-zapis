// Сервер «Записи Арай» на Cloudflare Workers: заявки клиентов, уведомления мастеру,
// свободное время для страницы клиентов, облачная копия записей и фото. Данные — в D1.
// Телефон мастера один раз подключается по коду доступа (секрет ACCESS_CODE)
// и дальше входит своим ключом устройства.

import * as L from '../../logic.js';
import { generateVapidKeys, sendPush } from './push.js';

const SITE = 'https://komron4111.github.io/kae-zapis/';
// Пока телефон мастера не подключён, свободное время берём из прежнего места.
const GITHUB_OKNA = 'https://raw.githubusercontent.com/komron4111/kae-zapis-okna/main/okna.json';
const BACKUPS_KEPT = 30;
const MAX_BACKUP = 1900 * 1024; // в D1 строка не больше 2 МБ
const MAX_PHOTO = 1900 * 1024;

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
        response = json({ error: 'Ошибка сервера, попробуйте позже' }, 500);
      }
    }
    for (const [name, value] of Object.entries(CORS)) response.headers.set(name, value);
    return response;
  },
};

async function route(request, env, ctx) {
  const path = new URL(request.url).pathname.replace(/\/+$/, '');
  const method = request.method;

  let m;
  // Для всех: страница клиентов, личная ссылка на запись и подключение телефона.
  if (path === '/api/okna' && method === 'GET') return getOkna(env);
  if (path === '/api/requests' && method === 'POST') return createRequest(request, env, ctx);
  if (path === '/api/pair' && method === 'POST') return pair(request, env);
  if ((m = path.match(/^\/api\/bookings\/([\w-]{16,64})$/)) && method === 'GET') return getBooking(env, m[1]);

  // Дальше — только для подключённого телефона мастера.
  const deviceId = await authDevice(request, env);
  if (path === '/api/push' && method === 'PUT') return savePush(request, env, deviceId);
  if (path === '/api/schedule' && method === 'PUT') return saveSchedule(request, env);
  if (path === '/api/requests' && method === 'GET') return listRequests(env);
  if ((m = path.match(/^\/api\/requests\/([\w-]+)\/(confirm|decline)$/)) && method === 'POST') return closeRequest(request, env, m[1], m[2]);
  if ((m = path.match(/^\/api\/bookings\/([\w-]{16,64})$/)) && method === 'PUT') return putBooking(request, env, m[1]);
  if (path === '/api/backup' && method === 'PUT') return putBackup(request, env);
  if (path === '/api/backup' && method === 'GET') return getBackup(env);
  if (path === '/api/photos' && method === 'GET') return listPhotos(env);
  if ((m = path.match(/^\/api\/photos\/([\w-]+)$/))) {
    if (method === 'PUT') return putPhoto(request, env, m[1]);
    if (method === 'GET') return getPhoto(env, m[1]);
    if (method === 'DELETE') return deletePhoto(env, m[1]);
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

// Ограничение попыток: не больше max за windowMs с одного адреса.
async function tooMany(env, kind, who, max, windowMs) {
  const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM attempts WHERE kind = ? AND who = ? AND at > ?')
    .bind(kind, who, Date.now() - windowMs).first();
  return row.n >= max;
}

function remember(env, kind, who) {
  return env.DB.prepare('INSERT INTO attempts (kind, who, at) VALUES (?, ?, ?)').bind(kind, who, Date.now()).run();
}

const visitor = request => sha256hex('ip:' + (request.headers.get('CF-Connecting-IP') || 'local'));

// Старые заявки, личные ссылки (через 60 дней после записи) и счётчики попыток не храним.
async function cleanup(env, today) {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM requests WHERE date < ?').bind(today),
    env.DB.prepare('DELETE FROM bookings WHERE date < ?').bind(L.addDays(today, -60)),
    env.DB.prepare('DELETE FROM attempts WHERE at < ?').bind(Date.now() - 864e5),
  ]);
}

const newToken = () => L.bytesToB64u(crypto.getRandomValues(new Uint8Array(16)));

async function saveBooking(env, token, booking) {
  const now = new Date().toISOString();
  await env.DB.prepare(`
    INSERT INTO bookings (token, created, updated, status, date, time, name, services, total, prepaid)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (token) DO UPDATE SET updated = excluded.updated, status = excluded.status, date = excluded.date,
      time = excluded.time, name = excluded.name, services = excluded.services, total = excluded.total, prepaid = excluded.prepaid`)
    .bind(token, now, now, booking.status, booking.date, booking.time, booking.name, JSON.stringify(booking.services), booking.total, booking.prepaid)
    .run();
}

async function hasDevice(env) {
  return Boolean(await env.DB.prepare('SELECT 1 FROM devices LIMIT 1').first());
}

async function vapidKeys(env) {
  const row = await env.DB.prepare("SELECT value FROM config WHERE key = 'vapid'").first();
  if (row) return JSON.parse(row.value);
  const keys = await generateVapidKeys();
  await env.DB.prepare("INSERT OR IGNORE INTO config (key, value) VALUES ('vapid', ?)").bind(JSON.stringify(keys)).run();
  const saved = await env.DB.prepare("SELECT value FROM config WHERE key = 'vapid'").first();
  return JSON.parse(saved.value);
}

// ---------- Страница клиентов ----------

async function loadSchedule(env) {
  const row = await env.DB.prepare("SELECT value FROM config WHERE key = 'schedule'").first();
  if (row) return JSON.parse(row.value);
  try {
    const res = await fetch(GITHUB_OKNA, { cf: { cacheTtl: 60 } });
    if (res.ok) {
      const schedule = await res.json();
      if (schedule && schedule.kind === 'okna') return schedule;
    }
  } catch (e) { /* нет расписания — страница покажет «скоро появится» */ }
  return null;
}

async function holds(env) {
  const { results } = await env.DB.prepare('SELECT date, time FROM requests').all();
  return results;
}

async function getOkna(env) {
  const schedule = await loadSchedule(env);
  if (!schedule) return json({ app: 'kae-zapis', kind: 'okna', days: [], booking: false });
  // booking: заявки принимаем, только когда подключён телефон мастера.
  return json({ ...L.applyHolds(schedule, await holds(env)), booking: await hasDevice(env) });
}

async function createRequest(request, env, ctx) {
  const who = await visitor(request);
  if (await tooMany(env, 'request', who, 5, 3600e3)) {
    throw new HttpError(429, 'Слишком много заявок подряд. Попробуйте через час или напишите мастеру в WhatsApp');
  }
  const body = await readJson(request, 8 * 1024);
  if (body.website) return json({ ok: true }, 201); // скрытое поле заполняют только боты
  const schedule = await loadSchedule(env);
  if (!schedule || !(await hasDevice(env))) throw new HttpError(503, 'Запись через сайт пока не работает — напишите мастеру в WhatsApp');

  const clock = L.masterClock(schedule.tzOffset || 0);
  await cleanup(env, clock.date);
  const check = L.validateRequest(body, L.applyHolds(schedule, await holds(env)), clock);
  if (!check.ok) throw new HttpError(check.status, check.error);

  const r = check.request;
  const id = crypto.randomUUID();
  const token = newToken(); // личная ссылка клиента на эту заявку и будущую запись
  const minutes = L.toMinutes(r.time);
  // Вставляем, только если рядом по времени никто не успел оставить другую заявку.
  const result = await env.DB.prepare(`
    INSERT INTO requests (id, created, date, time, minutes, name, phone, services, comment, token)
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    WHERE NOT EXISTS (SELECT 1 FROM requests WHERE date = ? AND ABS(minutes - ?) < ?)`)
    .bind(id, new Date().toISOString(), r.date, r.time, minutes, r.name, r.phone, JSON.stringify(r.services), r.comment, token,
      r.date, minutes, schedule.duration || L.DEFAULT_SETTINGS.duration)
    .run();
  if (!result.meta.changes) throw new HttpError(409, 'Это время только что заняли — выберите другое');
  await remember(env, 'request', who);
  ctx.waitUntil(notifyMaster(env, { id, ...r }));
  return json({ ok: true, token }, 201);
}

async function notifyMaster(env, r) {
  const { results } = await env.DB.prepare('SELECT id, push FROM devices WHERE push IS NOT NULL').all();
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

// ---------- Подключение телефона мастера ----------

async function pair(request, env) {
  const who = await visitor(request);
  if (await tooMany(env, 'pair', who, 5, 3600e3)) throw new HttpError(429, 'Слишком много попыток. Попробуйте через час');
  const body = await readJson(request, 2048);
  const code = String(env.ACCESS_CODE || '');
  if (code.length < 8) throw new HttpError(503, 'Код доступа ещё не задан на сервере');
  // Сравниваем хэши, чтобы время ответа не выдавало совпавшие символы.
  if (await sha256hex(String(body.code || '').trim()) !== await sha256hex(code)) {
    await remember(env, 'pair', who);
    throw new HttpError(403, 'Неверный код доступа');
  }
  const key = String(body.key || '');
  if (!/^[\w-]{40,100}$/.test(key)) throw new HttpError(400, 'Неверный ключ устройства');
  // Подключён только один телефон: при новом подключении прежний (например, потерянный) отключается.
  await env.DB.batch([
    env.DB.prepare('DELETE FROM devices'),
    env.DB.prepare('INSERT INTO devices (id, key_hash, name, created) VALUES (?, ?, ?, ?)')
      .bind(crypto.randomUUID(), await sha256hex(key), String(body.name || '').slice(0, 60), new Date().toISOString()),
  ]);
  return json({ ok: true, pushKey: (await vapidKeys(env)).publicKey });
}

async function authDevice(request, env) {
  const m = (request.headers.get('Authorization') || '').match(/^Bearer ([\w-]{40,100})$/);
  if (!m) throw new HttpError(401, 'Телефон не подключён к облаку');
  const row = await env.DB.prepare('SELECT id FROM devices WHERE key_hash = ?').bind(await sha256hex(m[1])).first();
  if (!row) throw new HttpError(401, 'Телефон отключён от облака — подключите его заново');
  return row.id;
}

async function savePush(request, env, deviceId) {
  const sub = await readJson(request, 4096);
  // http://localhost — только для проверки на компьютере разработчика.
  if (!/^(https:\/\/|http:\/\/localhost[:/])/.test(sub.endpoint || '') || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
    throw new HttpError(400, 'Неверная подписка на уведомления');
  }
  const clean = { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } };
  await env.DB.prepare('UPDATE devices SET push = ? WHERE id = ?').bind(JSON.stringify(clean), deviceId).run();
  return json({ ok: true });
}

// ---------- Для телефона мастера ----------

async function saveSchedule(request, env) {
  const schedule = await readJson(request, 64 * 1024);
  if (schedule.kind !== 'okna' || !Array.isArray(schedule.days)) throw new HttpError(400, 'Неверное расписание');
  await env.DB.prepare("INSERT OR REPLACE INTO config (key, value) VALUES ('schedule', ?)").bind(JSON.stringify(schedule)).run();
  return json({ ok: true });
}

async function listRequests(env) {
  const schedule = await loadSchedule(env);
  await cleanup(env, L.masterClock(schedule ? schedule.tzOffset || 0 : -300).date);
  const { results } = await env.DB.prepare(
    'SELECT id, created, date, time, name, phone, services, comment, token FROM requests ORDER BY date, time').all();
  return json({ requests: results.map(r => ({ ...r, services: JSON.parse(r.services) })) });
}

// «Подтвердить»: заявка становится записью по той же личной ссылке клиента (данные записи
// присылает телефон). «Отклонить»: клиент по ссылке увидит, что заявку не приняли.
async function closeRequest(request, env, id, action) {
  const body = await readJson(request, 4096).catch(() => ({}));
  const r = await env.DB.prepare('SELECT date, time, name, services, token FROM requests WHERE id = ?').bind(id).first();
  const token = /^[\w-]{16,64}$/.test(body.token || '') ? body.token : r && r.token;
  if (token) {
    const booking = action === 'confirm'
      ? L.normalizeBooking({ ...body.booking, status: 'confirmed' })
      : r && L.normalizeBooking({ status: 'declined', date: r.date, time: r.time, name: r.name, services: JSON.parse(r.services) });
    if (booking) await saveBooking(env, token, booking);
  }
  const result = await env.DB.prepare('DELETE FROM requests WHERE id = ?').bind(id).run();
  return json({ ok: true, found: result.meta.changes > 0, token: token || null });
}

// Телефон мастера обновляет запись клиента: перенос, изменение услуг, оплата, отмена.
async function putBooking(request, env, token) {
  const booking = L.normalizeBooking(await readJson(request, 4096));
  if (!booking) throw new HttpError(400, 'Неверная запись');
  await saveBooking(env, token, booking);
  return json({ ok: true });
}

// Личная ссылка клиента: заявка (ждёт ответа) или запись.
async function getBooking(env, token) {
  const schedule = await loadSchedule(env);
  const master = { name: (schedule && schedule.name) || 'Мастер', whatsapp: (schedule && schedule.whatsapp) || '' };
  const b = await env.DB.prepare('SELECT status, date, time, name, services, total, prepaid, updated FROM bookings WHERE token = ?').bind(token).first();
  if (b) return json({ ...b, services: JSON.parse(b.services), master });
  const r = await env.DB.prepare('SELECT date, time, name, services, created FROM requests WHERE token = ?').bind(token).first();
  if (r) {
    const services = JSON.parse(r.services);
    const total = L.servicesTotal(services, (schedule && schedule.services) || []);
    return json({ status: 'pending', date: r.date, time: r.time, name: r.name, services, total, prepaid: 0, updated: r.created, master });
  }
  throw new HttpError(404, 'Запись не найдена');
}

async function putBackup(request, env) {
  const format = request.headers.get('Content-Type') === 'application/gzip' ? 'gzip' : 'json';
  const bytes = await readBytes(request, MAX_BACKUP);
  const created = new Date().toISOString();
  // Храним несколько последних копий: если на телефоне что-то пошло не так, есть к чему вернуться.
  await env.DB.batch([
    env.DB.prepare('INSERT INTO backups (created, format, data) VALUES (?, ?, ?)').bind(created, format, bytes),
    env.DB.prepare('DELETE FROM backups WHERE id NOT IN (SELECT id FROM backups ORDER BY id DESC LIMIT ?)').bind(BACKUPS_KEPT),
  ]);
  return json({ ok: true, created });
}

async function getBackup(env) {
  const row = await env.DB.prepare('SELECT created, format, data FROM backups ORDER BY id DESC LIMIT 1').first();
  if (!row) throw new HttpError(404, 'В облаке пока нет копии');
  return new Response(toBytes(row.data), {
    headers: {
      'Content-Type': row.format === 'gzip' ? 'application/gzip' : 'application/json',
      'X-Backup-Created': row.created,
      'Cache-Control': 'no-store',
    },
  });
}

async function listPhotos(env) {
  const { results } = await env.DB.prepare('SELECT id FROM photos').all();
  return json({ ids: results.map(r => r.id) });
}

async function putPhoto(request, env, id) {
  const bytes = await readBytes(request, MAX_PHOTO);
  await env.DB.prepare('INSERT OR REPLACE INTO photos (id, created, data) VALUES (?, ?, ?)')
    .bind(id, new Date().toISOString(), bytes).run();
  return json({ ok: true });
}

async function getPhoto(env, id) {
  const row = await env.DB.prepare('SELECT data FROM photos WHERE id = ?').bind(id).first();
  if (!row) throw new HttpError(404, 'Фото не найдено');
  return new Response(toBytes(row.data), { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store' } });
}

async function deletePhoto(env, id) {
  await env.DB.prepare('DELETE FROM photos WHERE id = ?').bind(id).run();
  return json({ ok: true });
}
