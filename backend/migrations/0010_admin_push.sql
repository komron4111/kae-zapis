-- Beautybook 2.5.0: уведомления администратору (Web Push) — по подписке на каждое его устройство.
-- value — подписка {endpoint, keys: {p256dh, auth}}; name — какое устройство («iPhone, 1 октября 2026»).
CREATE TABLE admin_push (
  endpoint TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  created TEXT NOT NULL
);
