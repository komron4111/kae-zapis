-- Аккаунты мастеров (2.0.0): у каждого мастера свой телефон, пароль и ссылка для клиентов.
-- Всё, что было до аккаунтов, принадлежит одному мастеру — записи 'legacy' (Арай).
-- Номер и пароль у неё появятся, когда она оформит аккаунт в приложении.
CREATE TABLE masters (
  id TEXT PRIMARY KEY,
  phone TEXT UNIQUE,                     -- 7XXXXXXXXXX; у 'legacy' пусто, пока аккаунт не оформлен
  name TEXT NOT NULL DEFAULT '',
  slug TEXT NOT NULL UNIQUE,             -- ссылка для клиентов: okna/?m=<slug>
  pass_hash TEXT NOT NULL DEFAULT '',    -- SHA-256(соль:секрет); секрет — пароль, растянутый на телефоне
  pass_salt TEXT NOT NULL DEFAULT '',
  created TEXT NOT NULL,
  updated TEXT NOT NULL
);
INSERT INTO masters (id, phone, name, slug, created, updated)
VALUES ('legacy', NULL,
  COALESCE((SELECT json_extract(value, '$.name') FROM config WHERE key = 'schedule'), ''),
  'aray', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

-- Свободное время для клиентов — у каждого мастера своё. Прежнее (config 'schedule')
-- переезжает к 'legacy'; сама строка в config остаётся, пока работает прежний код сервера.
CREATE TABLE schedules (master_id TEXT PRIMARY KEY, value TEXT NOT NULL, updated TEXT NOT NULL);
INSERT INTO schedules (master_id, value, updated)
SELECT 'legacy', value, strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM config WHERE key = 'schedule';

-- Чьи это телефон, заявки, записи клиентов, копии и фото.
ALTER TABLE devices ADD COLUMN master_id TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE requests ADD COLUMN master_id TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE bookings ADD COLUMN master_id TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE backups ADD COLUMN master_id TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE photos ADD COLUMN master_id TEXT NOT NULL DEFAULT 'legacy';
CREATE INDEX devices_by_master ON devices (master_id);
CREATE INDEX requests_by_master ON requests (master_id, date);
CREATE INDEX backups_by_master ON backups (master_id, id);
CREATE INDEX photos_by_master ON photos (master_id);
