// База для сервера Beautybook на своём VPS: SQLite-файл (node:sqlite, Node.js 24) с тем же видом,
// что у Cloudflare D1, — код сервера (src/index.js) не меняется: prepare(sql).bind(...).first() / all() / run(),
// batch([...]) — одной транзакцией. Запросы синхронные и идут по одному — для нашей нагрузки этого хватает.
import { DatabaseSync } from 'node:sqlite';

// D1 принимает true/false и ArrayBuffer; SQLite — 1/0 и байты. undefined — как NULL.
const param = v => (v === undefined ? null : typeof v === 'boolean' ? Number(v) : v instanceof ArrayBuffer ? new Uint8Array(v) : v);

export function openD1(file) {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA busy_timeout = 5000;');
  const size = () => db.prepare('PRAGMA page_size').get().page_size * db.prepare('PRAGMA page_count').get().page_count;
  const meta = info => ({ changes: info ? Number(info.changes) : 0, last_row_id: info ? Number(info.lastInsertRowid) : 0, size_after: size(), duration: 0 });

  class Statement {
    constructor(sql, params = []) {
      this.sql = sql;
      this.params = params;
    }

    bind(...params) {
      return new Statement(this.sql, params.map(param));
    }

    // Выполнить: запрос со столбцами (SELECT, … RETURNING) — строки, иначе — сколько строк изменилось.
    exec() {
      const st = db.prepare(this.sql);
      if (st.columns().length) return { success: true, results: st.all(...this.params).map(row => ({ ...row })), meta: meta(null) };
      return { success: true, results: [], meta: meta(st.run(...this.params)) };
    }

    async first(column) {
      const row = this.exec().results[0];
      if (!row) return null;
      return column ? (row[column] === undefined ? null : row[column]) : row;
    }

    async all() {
      return this.exec();
    }

    async run() {
      return this.exec();
    }
  }

  return {
    prepare: sql => new Statement(sql),
    async batch(statements) {
      db.exec('BEGIN');
      try {
        const out = statements.map(s => s.exec());
        db.exec('COMMIT');
        return out;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
    async exec(sql) {
      db.exec(sql);
      return { count: 0, duration: 0 };
    },
    close: () => db.close(),
    sqlite: db,
  };
}
