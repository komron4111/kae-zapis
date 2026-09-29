-- Сколько минут займёт заявка (по услугам из прайса). У старых заявок 0 —
-- для них сервер берёт длительность по умолчанию из расписания.
ALTER TABLE requests ADD COLUMN duration INTEGER NOT NULL DEFAULT 0;
