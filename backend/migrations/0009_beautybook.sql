-- Beautybook (2.4.0): анкета мастера, тариф «Про» на месяц или год, чат с администратором, статистика записей.

-- Анкета: направление мастера и номер для счёта Kaspi за подписку (видит только администратор);
-- clients — сколько клиентов в базе мастера (присылает приложение, для сортировки у администратора).
ALTER TABLE masters ADD COLUMN specialty TEXT NOT NULL DEFAULT '';
ALTER TABLE masters ADD COLUMN kaspi_phone TEXT NOT NULL DEFAULT '';
ALTER TABLE masters ADD COLUMN clients INTEGER NOT NULL DEFAULT 0;

-- Оплата подписки: какой срок (month / year) и сколько тенге.
ALTER TABLE subscriptions ADD COLUMN plan TEXT NOT NULL DEFAULT '';
ALTER TABLE subscriptions ADD COLUMN amount INTEGER NOT NULL DEFAULT 0;

-- Чат мастера с администратором: author — master или admin; seen — прочитано другой стороной.
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  master_id TEXT NOT NULL,
  author TEXT NOT NULL,
  text TEXT NOT NULL,
  created TEXT NOT NULL,
  seen INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX messages_by_master ON messages (master_id, id);

-- Записи мастера по месяцам (присылает приложение, только числа): принятые, из них по ссылке, клиентов.
CREATE TABLE master_stats (
  master_id TEXT NOT NULL,
  month TEXT NOT NULL,
  total INTEGER NOT NULL DEFAULT 0,
  link INTEGER NOT NULL DEFAULT 0,
  clients INTEGER NOT NULL DEFAULT 0,
  updated TEXT NOT NULL,
  PRIMARY KEY (master_id, month)
);

-- Заявки по ссылке по месяцам (считает сервер): отправлено клиентами и подтверждено мастером.
CREATE TABLE request_stats (
  master_id TEXT NOT NULL,
  month TEXT NOT NULL,
  sent INTEGER NOT NULL DEFAULT 0,
  confirmed INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (master_id, month)
);
