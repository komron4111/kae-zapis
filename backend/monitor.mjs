// Проверка Beautybook: всё ли работает и хватает ли серверу места и памяти.
// С 2.9.0 сервер свой (vpsza500.kz, Алматы): база — SQLite на сервере, её читаем по ssh (хост «beautybook»
// в ~/.ssh/config). Запускает задача Claude по расписанию («Beautybook: проверка сервера и ссылок»);
// можно и вручную, из папки backend: ~/.local/node/bin/node monitor.mjs
// Пишет в базу одно: снимок состояния сервера (config.usage) — его показывают шкалы в разделе «Сервер»
// у администратора. Печатает отчёт; в конце — «ИТОГ: OK | WARN | ALERT» и, если есть о чём сообщить
// (а за сутки об этом ещё не сообщали), — «УВЕДОМИТЬ: <текст>».
// Каждый запуск дописывает строку в ../.claude/monitor-log.md (папка .claude в git не попадает).

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const SITE = 'https://beautybook.kz';
const OLD_API = 'https://kae-zapis-api.kae-zapis.workers.dev'; // прежний адрес: пересылает запросы на свой сервер
const DB = '/var/lib/beautybook/beautybook.db';
const CHECKS = [
  [`${SITE}/api/okna?m=aray`, 'сервер beautybook.kz (ссылка Арай)'],
  [`${OLD_API}/api/okna?m=aray`, 'прежний адрес сервера (пересылка)'],
  [`${SITE}/`, 'приложение beautybook.kz'],
  [`${SITE}/okna/`, 'страница клиентов beautybook.kz'],
  ['https://beautybook-kz.pages.dev/', 'приложение beautybook-kz.pages.dev'],
  ['https://nailapp.pages.dev/', 'приложение nailapp.pages.dev'],
  ['https://komron4111.github.io/kae-zapis/okna/', 'страница клиентов на прежнем адресе'],
];
const WARN = 0.6, ALERT = 0.8; // доля диска или памяти
const PHOTOS_PER_MASTER = 100e6;
const BACKUP_MAX_AGE = 36 * 3600e3;
const STATE_DIR = fileURLToPath(new URL('../.claude/', import.meta.url));
const LOG = `${STATE_DIR}monitor-log.md`;
const STATE = `${STATE_DIR}monitor-state.json`;
const DAY = 864e5;

const problems = []; // { level, key, text } — key: одна и та же проблема не чаще раза в сутки
const problem = (level, key, text) => problems.push({ level, key, text });
const mb = n => `${(n / 1e6).toFixed(1).replace('.', ',')} МБ`;
const gb = n => `${(n / 1e9).toFixed(1).replace('.', ',')} ГБ`;
const num = n => Math.round(n).toLocaleString('ru-RU');
const pct = (v, max) => Math.round((v / max) * 100);

// Команда на сервере; запрос к базе — через stdin, чтобы кавычки в SQL не ломала оболочка.
const ssh = (command, input) => execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20', 'beautybook', command],
  { input, encoding: 'utf8', maxBuffer: 32e6, timeout: 120000 });
const sql = query => {
  const out = ssh(`sqlite3 -json ${DB}`, query).trim();
  return out ? JSON.parse(out) : [];
};

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

// 2. Сервер: службы, диск, память, база, ночные копии
const srv = JSON.parse(ssh(`printf '{"services":"%s","disk":[%s],"memory":[%s],"load":%s,"db":%s,"backup":%s}' \
  "$(systemctl is-active beautybook caddy | tr '\\n' ' ')" \
  "$(df -B1 --output=used,size / | tail -1 | awk '{print $1","$2}')" \
  "$(free -b | awk '/Mem:/ {print $2-$7","$2}')" \
  "$(cut -d' ' -f1 /proc/loadavg)" \
  "$(stat -c %s ${DB})" \
  "$(find /var/backups/beautybook -name 'beautybook-*.db.gz' -printf '%T@\\n' | sort -n | tail -1 | cut -d. -f1 | grep . || echo 0)"`));
const [diskUsed, diskTotal] = srv.disk, [memUsed, memTotal] = srv.memory;
report.push(`  службы: ${srv.services.trim()}`);
if (!/^active active\s*$/.test(srv.services.trim() + ' ')) problem('ALERT', 'services', `служба сервера не работает: ${srv.services.trim()}`);
for (const [key, name, used, total] of [['disk', 'диск', diskUsed, diskTotal], ['memory', 'память', memUsed, memTotal]]) {
  const p = pct(used, total);
  report.push(`  ${name}: ${gb(used)} из ${gb(total)} (${p}%)`);
  if (used >= total * ALERT) problem('ALERT', `load:${key}`, `${name} сервера занят на ${p}%`);
  else if (used >= total * WARN) problem('WARN', `load:${key}`, `${name} сервера занят на ${p}%`);
}
report.push(`  база: ${mb(srv.db)}, нагрузка (1 мин): ${srv.load}`);
const backupAge = srv.backup ? now - srv.backup * 1000 : Infinity;
report.push(`  последняя копия базы: ${srv.backup ? new Date(srv.backup * 1000).toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' }) : 'ещё нет'}`);
if (backupAge > BACKUP_MAX_AGE && now - (state.installedAt || now) > BACKUP_MAX_AGE) problem('WARN', 'backup', 'ночная копия базы не делалась больше полутора суток');
// Технические работы (2.10.0): включены дольше 30 минут — наверное, забыли выключить.
let works = {};
try { works = JSON.parse((sql("SELECT value FROM config WHERE key = 'maintenance'")[0] || {}).value || '{}'); } catch (e) { /* нет отметки */ }
if (works.on) {
  const minutes = Math.round((now - Date.parse(works.since)) / 60000);
  report.push(`  технические работы: включены ${minutes} мин`);
  if (minutes > 30) problem('WARN', 'maintenance', `технические работы включены уже ${minutes} мин — выключить: «BB Админ» → «Сервер» или bash backend/deploy/maintenance.sh off`);
}
state.installedAt = state.installedAt || now;
// Снимок для страницы администратора: только числа и время.
const usage = { at: new Date(now).toISOString(), size: srv.db, disk: { used: diskUsed, total: diskTotal }, memory: { used: memUsed, total: memTotal }, load: srv.load, backupAt: srv.backup ? new Date(srv.backup * 1000).toISOString() : null };
try {
  sql(`INSERT OR REPLACE INTO config (key, value) VALUES ('usage', '${JSON.stringify(usage)}')`);
} catch (e) {
  report.push(`  снимок для администратора не записан: ${String(e.message || e).split('\n')[0]}`);
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
  (SELECT COALESCE(SUM(LENGTH(data)), 0) FROM backups) AS backup_bytes,
  (SELECT COUNT(*) FROM reminders WHERE next_due IS NOT NULL) AS reminders`);
report.push(`  мастеров: ${s.masters} (с паролем ${s.claimed}, новых за сутки ${s.new24}); ждут напоминаний: ${s.reminders}`);
report.push(`  фото: ${s.photos} шт., ${mb(s.photo_bytes)}; копии: ${s.backups} шт., ${mb(s.backup_bytes)}`);

const [top] = sql(`SELECT m.name AS name, COUNT(*) AS n, SUM(LENGTH(p.data)) AS bytes FROM photos p
  JOIN masters m ON m.id = p.master_id GROUP BY p.master_id ORDER BY bytes DESC LIMIT 1`);
if (top) {
  report.push(`  больше всех фото: ${top.name} — ${top.n} шт., ${mb(top.bytes)}`);
  if (top.bytes > PHOTOS_PER_MASTER) problem('WARN', 'photos:top', `у мастера ${top.name} фото на ${mb(top.bytes)} — пора ставить лимит фото`);
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
if (!fs.existsSync(LOG)) fs.writeFileSync(LOG, '# Проверки Beautybook\n\n');
fs.appendFileSync(LOG, `| ${stamp} | ${level} | мастеров ${s.masters} | база ${mb(srv.db)} | диск ${pct(diskUsed, diskTotal)}% | память ${pct(memUsed, memTotal)}% | фото ${s.photos} / ${mb(s.photo_bytes)} | ошибок ${server.length}/${pages.length} |\n`);

console.log(`Проверка Beautybook — ${stamp}`);
console.log(report.join('\n'));
for (const p of problems) console.log(`${p.level === 'ALERT' ? '‼️' : '⚠️'} ${p.text}`);
console.log(`ИТОГ: ${level}`);
if (fresh.length) {
  const text = `Beautybook: ${fresh[0].text}${fresh.length > 1 ? ` (и ещё ${fresh.length - 1})` : ''}`;
  console.log(`УВЕДОМИТЬ: ${text.slice(0, 190)}`);
}
