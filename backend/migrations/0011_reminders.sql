-- Beautybook 2.8.0: напоминания мастеру о записях. Телефон присылает список ближайших напоминаний
-- (items — JSON [{id, due, at, date, time, name, services}], due/at — мс), сервер каждые 5 минут
-- присылает уведомлением те, у которых подошло время; next_due — ближайшее. sent — уже отправленные
-- {id: due} за двое суток (чтобы не повторять), tz — часовой пояс телефона (как getTimezoneOffset),
-- rev — номер версии строки: телефон и сервер не затирают изменения друг друга.
CREATE TABLE reminders (
  master_id TEXT PRIMARY KEY,
  items TEXT NOT NULL DEFAULT '[]',
  sent TEXT NOT NULL DEFAULT '{}',
  next_due INTEGER,
  tz INTEGER NOT NULL DEFAULT -300,
  rev INTEGER NOT NULL DEFAULT 0,
  updated TEXT NOT NULL
);
CREATE INDEX reminders_due ON reminders (next_due);
