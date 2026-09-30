-- Подписки мастеров (2.2.0). Доступ открыт по paid_until включительно (по времени Алматы, UTC+5);
-- на следующий день приложение просит продлить подписку. unlimited = 1 — бессрочно.
ALTER TABLE masters ADD COLUMN paid_until TEXT;
ALTER TABLE masters ADD COLUMN unlimited INTEGER NOT NULL DEFAULT 0;

-- Периоды доступа: первый месяц после регистрации (trial), оплата, отмеченная администратором (paid),
-- дата окончания, изменённая администратором вручную (manual). created — когда отмечено.
CREATE TABLE subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  master_id TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  kind TEXT NOT NULL,
  created TEXT NOT NULL
);
CREATE INDEX subscriptions_by_master ON subscriptions (master_id, id);

-- Уже зарегистрированным мастерам — первый месяц с сегодняшнего дня.
INSERT INTO subscriptions (master_id, start_date, end_date, kind, created)
  SELECT id, date('now', '+5 hours'), date('now', '+5 hours', '+1 month', '-1 day'), 'trial', strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM masters;
UPDATE masters SET paid_until = date('now', '+5 hours', '+1 month', '-1 day');
