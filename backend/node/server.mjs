// Сервер Beautybook на своём VPS (с 2.9.0): тот же код, что у Cloudflare Worker (../src/index.js), на Node.js 24
// и SQLite (./d1.mjs). Слушает только 127.0.0.1 — снаружи к нему ходит Caddy (HTTPS и файлы сайта).
// Расписание вместо cron Cloudflare: каждые 5 минут — напоминания мастерам о записях, в 04:00 UTC — сводка
// администратору. Настройки — переменные окружения (на сервере — /etc/beautybook/*.env, см. deploy/).
import http from 'node:http';
import worker from '../src/index.js';
import { openD1 } from './d1.mjs';

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '127.0.0.1';
// Общий ключ с Cloudflare Worker, который пересылает сюда запросы прежних приложений (адрес посетителя — в X-Real-IP).
const PROXY_KEY = process.env.PROXY_KEY || '';
const env = {
  DB: openD1(process.env.DB_FILE || '/var/lib/beautybook/beautybook.db'),
  ACCESS_CODE: process.env.ACCESS_CODE || '',
  ADMIN_CODE: process.env.ADMIN_CODE || '',
  LOCAL_KEY: process.env.LOCAL_KEY || '', // рассылка мастерам со своего сервера (deploy/notify-update.sh)
};

const context = () => ({
  waitUntil: promise => { Promise.resolve(promise).catch(e => console.error('waitUntil', e && e.stack ? e.stack : e)); },
  passThroughOnException() {},
});

// Адрес посетителя — для ограничения попыток. Caddy кладёт его в X-Forwarded-For (поддельный от посетителя
// он не пропускает); запросы через Cloudflare несут его в X-Real-IP вместе с общим ключом.
function visitorIp(req) {
  if (PROXY_KEY && req.headers['x-proxy-key'] === PROXY_KEY && req.headers['x-real-ip']) return String(req.headers['x-real-ip']);
  return String(req.headers['x-forwarded-for'] || '').split(',').pop().trim() || req.socket.remoteAddress || 'local';
}

const runScheduled = cron => worker.scheduled({ cron, scheduledTime: Date.now() }, env, context())
  .catch(e => console.error('scheduled', cron, e && e.stack ? e.stack : e));

const server = http.createServer(async (req, res) => {
  try {
    // Проверка расписания с этого же компьютера, как у wrangler dev --test-scheduled.
    if (process.env.TEST_SCHEDULED === '1' && req.url.startsWith('/__scheduled')) {
      await runScheduled(new URL(req.url, 'http://local').searchParams.get('cron') || '*/5 * * * *');
      await new Promise(resolve => setTimeout(resolve, 300)); // уведомления уходят в waitUntil
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('ok');
      return;
    }
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const headers = new Headers();
    for (const [name, value] of Object.entries(req.headers)) {
      if (value !== undefined && name !== 'x-proxy-key' && name !== 'x-real-ip') headers.set(name, Array.isArray(value) ? value.join(', ') : value);
    }
    headers.set('CF-Connecting-IP', visitorIp(req));
    const hasBody = !['GET', 'HEAD'].includes(req.method);
    const request = new Request(`https://${req.headers.host || 'localhost'}${req.url}`, {
      method: req.method, headers, body: hasBody ? Buffer.concat(chunks) : undefined,
    });
    const response = await worker.fetch(request, env, context());
    const body = req.method === 'HEAD' || !response.body ? null : Buffer.from(await response.arrayBuffer());
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(body);
  } catch (e) {
    console.error(e && e.stack ? e.stack : e);
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Ошибка сервера. Попробуйте позже' }));
  }
});

// Расписание: проверка в начале каждой минуты.
function tick() {
  const now = new Date();
  setTimeout(() => {
    const t = new Date();
    if (t.getUTCMinutes() % 5 === 0) runScheduled('*/5 * * * *');
    if (t.getUTCHours() === 4 && t.getUTCMinutes() === 0) runScheduled('0 4 * * *');
    tick();
  }, 60000 - now.getSeconds() * 1000 - now.getMilliseconds() + 200);
}

server.listen(PORT, HOST, () => console.log(`Beautybook: http://${HOST}:${PORT}`));
if (process.env.CRON !== 'off') tick();

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    server.close(() => {
      env.DB.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
