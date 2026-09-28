-- Личная ссылка клиента: у заявки появляется секретный token, по нему клиент видит свою запись.
ALTER TABLE requests ADD COLUMN token TEXT NOT NULL DEFAULT '';

-- Записи, которые видит клиент по своей ссылке (подтверждённые, отменённые, отклонённые заявки).
-- Телефон мастера обновляет их при каждом изменении записи.
CREATE TABLE bookings (
  token TEXT PRIMARY KEY,
  created TEXT NOT NULL,
  updated TEXT NOT NULL,
  status TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  services TEXT NOT NULL DEFAULT '[]',
  total INTEGER NOT NULL DEFAULT 0,
  prepaid INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX bookings_by_date ON bookings (date);
