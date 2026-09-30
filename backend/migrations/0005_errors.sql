-- Журнал ошибок (2.0.0): сбои сервера и ошибки на страницах у мастеров и клиентов.
-- Без личных данных: только где и что сломалось. Хранится 14 дней, не больше 300 записей в час.
CREATE TABLE errors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,                 -- время (UTC, ISO)
  source TEXT NOT NULL,             -- server, app, okna, admin
  place TEXT NOT NULL DEFAULT '',   -- адрес запроса или страница и файл:строка
  message TEXT NOT NULL DEFAULT ''
);
CREATE INDEX errors_by_at ON errors (at);
