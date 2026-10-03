-- Переходы по ссылке приложения (2.11.0): один человек (случайный номер на его телефоне) — одна строка.
-- source — откуда пришёл впервые: метка ?from=… в ссылке, приложение или сайт, где открыли ссылку, иначе 'direct'.
-- master_id — если с этого телефона потом зарегистрировались. Имён, номеров и IP-адресов здесь нет.
CREATE TABLE visits (
  visitor TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  first TEXT NOT NULL,
  last TEXT NOT NULL,
  views INTEGER NOT NULL DEFAULT 1,
  master_id TEXT
);
CREATE INDEX visits_first ON visits (first);
