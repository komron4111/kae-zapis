// Миграции базы на своём VPS: применяет файлы backend/migrations/*.sql, которых ещё нет в таблице
// d1_migrations (той же, что ведёт wrangler, — база, перенесённая из D1, продолжает с нужного номера).
// Запуск: node backend/node/migrate.mjs /var/lib/beautybook/beautybook.db
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const file = process.argv[2];
if (!file) {
  console.error('Укажите файл базы: node migrate.mjs <путь к .db>');
  process.exit(1);
}
const dir = new URL('../migrations/', import.meta.url);
const db = new DatabaseSync(file);
db.exec(`CREATE TABLE IF NOT EXISTS d1_migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
)`);
const done = new Set(db.prepare('SELECT name FROM d1_migrations').all().map(r => r.name));
const files = fs.readdirSync(dir).filter(f => /^\d{4}_.+\.sql$/.test(f)).sort();
let applied = 0;
for (const name of files) {
  if (done.has(name)) continue;
  const sql = fs.readFileSync(new URL(name, dir), 'utf8');
  db.exec('BEGIN');
  try {
    db.exec(sql);
    db.prepare('INSERT INTO d1_migrations (name) VALUES (?)').run(name);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    console.error(`Миграция ${name} не применилась: ${e.message}`);
    process.exit(1);
  }
  console.log(`применена ${name}`);
  applied++;
}
console.log(applied ? `Готово: ${applied}` : 'Новых миграций нет');
db.close();
