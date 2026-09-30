-- Записи клиентов по мастеру — для страницы администратора (сколько места занимают данные мастера).
CREATE INDEX bookings_by_master ON bookings (master_id);
