-- Настройки сервера: ключи уведомлений (vapid) и свободное время для клиентов (schedule).
CREATE TABLE config (key TEXT PRIMARY KEY, value TEXT NOT NULL);

-- Подключённый телефон мастера: хэш ключа устройства и подписка на уведомления.
CREATE TABLE devices (
  id TEXT PRIMARY KEY,
  key_hash TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  created TEXT NOT NULL,
  push TEXT
);

-- Заявки клиентов, которые ждут ответа мастера. После «Подтвердить» или «Отклонить» удаляются.
CREATE TABLE requests (
  id TEXT PRIMARY KEY,
  created TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  minutes INTEGER NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  services TEXT NOT NULL,
  comment TEXT NOT NULL DEFAULT ''
);
CREATE INDEX requests_by_date ON requests (date);

-- Облачная копия данных приложения: последние версии.
CREATE TABLE backups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created TEXT NOT NULL,
  format TEXT NOT NULL,
  data BLOB NOT NULL
);

-- Фото результата.
CREATE TABLE photos (id TEXT PRIMARY KEY, created TEXT NOT NULL, data BLOB NOT NULL);

-- Счётчики попыток (заявки, ввод кода доступа) для защиты от перебора и спама.
CREATE TABLE attempts (kind TEXT NOT NULL, who TEXT NOT NULL, at INTEGER NOT NULL);
CREATE INDEX attempts_by_who ON attempts (kind, who, at);
