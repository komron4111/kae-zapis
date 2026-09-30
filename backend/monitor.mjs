// Проверка Nailapp: всё ли работает и не упираемся ли в бесплатный тариф Cloudflare.
// Запускает задача Claude по расписанию («Nailapp: проверка сервера»); можно и вручную,
// из папки backend: ~/.local/node/bin/node monitor.mjs
// Только читает: адреса сайта и сервера, нагрузку на базу, мастеров, фото, журнал ошибок.
// Печатает отчёт; в конце — «ИТОГ: OK | WARN | ALERT» и, если есть о чём сообщить
// (а за сутки об этом ещё не сообщали), — «УВЕДОМИТЬ: <текст>».
// Каждый запуск дописывает строку в ../.claude/monitor-log.md (папка .claude в git не попадает).

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const WRANGLER = `${process.env.HOME}/.local/node/bin/wrangler`;
const API = 'https://kae-zapis-api.kae-zapis.workers.dev';
const CHECKS = [
  [`${API}/api/okna?m=aray`, 'сервер (ссылка Арай)'],
  ['https://nailapp.pages.dev/', 'приложение nailapp.pages.dev'],
  ['https://nailapp.pages.dev/okna/', 'страница клиентов nailapp.pages.dev'],
  ['https://komron4111.github.io/kae-zapis/okna/', 'страница клиентов на прежнем адресе'],
];
// Бесплатный тариф: в сутки (обнуляется в 00:00 UTC = 05:00 по Алматы) и размер базы.
const FREE = { rowsWritten: 100000, rowsRead: 5000000, requests: 100000, size: 500e6 };
const WARN = 0.5, ALERT = 0.8;
const MASTERS_SOON = 25, MASTERS_REVIEW = 30; // на 30 мастерах решаем про платный тариф
const PHOTOS_PER_MASTER = 100e6;
const STATE_DIR = fileURLToPath(new URL('../.claude/', import.meta.url));
const LOG = `${STATE_DIR}monitor-log.md`;
const STATE = `${STATE_DIR}monitor-state.json`;
const DAY = 864e5;

const problems = []; // { level, key, text } — key: одна и та же проблема не чаще раза в сутки
const problem = (level, key, text) => problems.push({ level, key, text });
const mb = n => `${(n / 1e6).toFixed(1).replace('.', ',')} МБ`;
const num = n => Math.round(n).toLocaleString('ru-RU');
const pct = (v, max) => Math.round((v / max) * 100);

function wrangler(args) {
  return execFileSync(process.execPath, [WRANGLER, ...args], { cwd: HERE, env: { ...process.env, CI: '1' }, encoding: 'utf8', maxBuffer: 32e6, timeout: 120000 });
}
// JSON начинается со строки, первая буква которой «[» или «{» (до неё wrangler может написать предупреждение).
const jsonOf = text => JSON.parse(text.slice(text.search(/^[[{]/m)));
const sql = command => jsonOf(wrangler(['d1', 'execute', 'kae-zapis', '--remote', '--json', '--command', command]))[0].results;

async function isUp(url) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (res.ok && !url.includes('/api/okna')) return true;
      if (res.ok) {
        const d = await res.json();
        if (d.kind === 'okna' && Array.isArray(d.days) && d.days.length) return true;
      }
    } catch (e) { /* повторим */ }
    if (attempt === 0) await new Promise(r => setTimeout(r, 30000));
  }
  return false;
}

function readState() {
  try { return JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch (e) { return { lastErrorId: 0, notified: {} }; }
}

const report = [];
const state = readState();
const now = Date.now();

// 1. Адреса
for (const [url, name] of CHECKS) {
  const ok = await isUp(url);
  report.push(`${ok ? '✓' : '✗'} ${name}`);
  if (!ok) problem('ALERT', `down:${url}`, `не открывается ${name} (${url})`);
}

// 2. Нагрузка на базу (за последние сутки) и её размер
const info = jsonOf(wrangler(['d1', 'info', 'kae-zapis', '--json']));
// Запрос к серверу — это в среднем 2–3 запроса к базе: оценка сверху, делим на 2.
const requests = (info.read_queries_24h + info.write_queries_24h) / 2;
const loads = [
  ['size', 'размер базы', info.database_size, FREE.size, mb],
  ['rowsWritten', 'записано строк за сутки', info.rows_written_24h, FREE.rowsWritten, num],
  ['rowsRead', 'прочитано строк за сутки', info.rows_read_24h, FREE.rowsRead, num],
  ['requests', 'запросов к серверу за сутки (оценка)', requests, FREE.requests, num],
];
for (const [key, name, value, max, fmt] of loads) {
  const p = pct(value, max);
  report.push(`  ${name}: ${fmt(value)} из ${fmt(max)} (${p}%)`);
  if (value >= max * ALERT) problem('ALERT', `load:${key}`, `${name} — ${p}% лимита бесплатного тарифа`);
  else if (value >= max * WARN) problem('WARN', `load:${key}`, `${name} — ${p}% лимита бесплатного тарифа`);
}

// 3. Мастера, фото, копии, попытки
const since24 = new Date(now - DAY).toISOString();
const [s] = sql(`SELECT
  (SELECT COUNT(*) FROM masters) AS masters,
  (SELECT COUNT(*) FROM masters WHERE pass_hash <> '') AS claimed,
  (SELECT COUNT(*) FROM masters WHERE created > '${since24}') AS new24,
  (SELECT COUNT(*) FROM photos) AS photos,
  (SELECT COALESCE(SUM(LENGTH(data)), 0) FROM photos) AS photo_bytes,
  (SELECT COUNT(*) FROM backups) AS backups,
  (SELECT COALESCE(SUM(LENGTH(data)), 0) FROM backups) AS backup_bytes`);
report.push(`  мастеров: ${s.masters} (с паролем ${s.claimed}, новых за сутки ${s.new24})`);
report.push(`  фото: ${s.photos} шт., ${mb(s.photo_bytes)}; копии: ${s.backups} шт., ${mb(s.backup_bytes)}`);
if (s.masters >= MASTERS_REVIEW) problem('WARN', 'masters30', `мастеров уже ${s.masters} — пора решить про платный тариф (5 $/мес)`);
else if (s.masters >= MASTERS_SOON) problem('WARN', 'masters25', `мастеров уже ${s.masters} — скоро 30, пора решать про платный тариф`);

const [top] = sql(`SELECT m.name AS name, COUNT(*) AS n, SUM(LENGTH(p.data)) AS bytes FROM photos p
  JOIN masters m ON m.id = p.master_id GROUP BY p.master_id ORDER BY bytes DESC LIMIT 1`);
if (top) {
  report.push(`  больше всех фото: ${top.name} — ${top.n} шт., ${mb(top.bytes)}`);
  if (top.bytes > PHOTOS_PER_MASTER) problem('WARN', 'photos:top', `у мастера ${top.name} фото на ${mb(top.bytes)} — пора ставить лимит фото или переносить фото в R2`);
}

const tries = sql(`SELECT kind, COUNT(*) AS n FROM attempts WHERE at > ${now - DAY} GROUP BY kind`);
if (tries.length) report.push(`  попытки за сутки: ${tries.map(t => `${t.kind} ${t.n}`).join(', ')}`);
const tried = Object.fromEntries(tries.map(t => [t.kind, t.n]));
if ((tried.login || 0) > 200) problem('WARN', 'tries:login', `за сутки ${tried.login} неверных входов — возможно, подбирают пароли`);
if ((tried.register || 0) > 50) problem('WARN', 'tries:register', `за сутки ${tried.register} регистраций — проверьте, не боты ли`);

// 4. Журнал ошибок: новые с прошлой проверки
const errors = sql(`SELECT id, at, source, place, message FROM errors WHERE id > ${Number(state.lastErrorId) || 0} ORDER BY id`);
const server = errors.filter(e => e.source === 'server');
const pages = errors.filter(e => e.source !== 'server');
report.push(`  новых ошибок: сервер ${server.length}, страницы ${pages.length}`);
const groups = {};
for (const e of errors) {
  const key = `${e.source} | ${e.place} | ${e.message}`;
  groups[key] = (groups[key] || 0) + 1;
}
for (const [key, n] of Object.entries(groups).sort((a, b) => b[1] - a[1]).slice(0, 10)) report.push(`    ${n} × ${key}`);
if (server.length) problem(server.length >= 5 ? 'ALERT' : 'WARN', 'errors:server', `ошибки сервера: ${server.length} (${server[server.length - 1].place}: ${server[server.length - 1].message})`);
const repeated = Object.entries(groups).filter(([k, n]) => !k.startsWith('server') && n >= 3);
if (pages.length >= 20) problem('ALERT', 'errors:pages', `на страницах ${pages.length} ошибок с прошлой проверки`);
else if (repeated.length) problem('WARN', 'errors:pages', `на страницах повторяется ошибка: ${repeated[0][0]} (${repeated[0][1]} раз)`);

// 5. Итог, уведомление (каждая проблема — не чаще раза в сутки), журнал проверок
const level = problems.some(p => p.level === 'ALERT') ? 'ALERT' : problems.length ? 'WARN' : 'OK';
const fresh = problems.filter(p => !(state.notified[p.key] > now - DAY));
for (const p of fresh) state.notified[p.key] = now;
if (errors.length) state.lastErrorId = errors[errors.length - 1].id;

fs.mkdirSync(STATE_DIR, { recursive: true });
fs.writeFileSync(STATE, JSON.stringify(state, null, 2));
const stamp = new Date(now).toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' });
if (!fs.existsSync(LOG)) fs.writeFileSync(LOG, '# Проверки Nailapp\n\n| Время (Алматы) | Итог | Мастеров | База | Записано за сутки | Прочитано за сутки | Фото | Новых ошибок (сервер/страницы) |\n|---|---|---|---|---|---|---|---|\n');
fs.appendFileSync(LOG, `| ${stamp} | ${level} | ${s.masters} | ${mb(info.database_size)} | ${num(info.rows_written_24h)} | ${num(info.rows_read_24h)} | ${s.photos} / ${mb(s.photo_bytes)} | ${server.length}/${pages.length} |\n`);

console.log(`Проверка Nailapp — ${stamp}`);
console.log(report.join('\n'));
for (const p of problems) console.log(`${p.level === 'ALERT' ? '‼️' : '⚠️'} ${p.text}`);
console.log(`ИТОГ: ${level}`);
if (fresh.length) {
  const text = `Nailapp: ${fresh[0].text}${fresh.length > 1 ? ` (и ещё ${fresh.length - 1})` : ''}`;
  console.log(`УВЕДОМИТЬ: ${text.slice(0, 190)}`);
}
