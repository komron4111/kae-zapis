#!/bin/bash
# Технические работы (2.10.0) — с компьютера, из корня проекта: bash backend/deploy/maintenance.sh on|off|status
# Пока включены, сервер не принимает изменений от мастеров и клиентов (503 «Идут технические работы»), а приложение
# мастера закрывает экран «Технические работы» и само откроется после выключения. Читать данные можно.
# deploy.sh и release.sh включают и выключают их сами; вручную — то же в «BB Админ» → «Сервер».
# Отметка — строка config.maintenance {on, since} в базе своего сервера (пишем прямо в базу: работает и пока
# сервер перезапускается).
set -euo pipefail
DB=/var/lib/beautybook/beautybook.db
case "${1:-status}" in
  on|off)
    value=$([ "$1" = on ] && echo true || echo false)
    ssh beautybook "sqlite3 $DB" <<SQL
INSERT OR REPLACE INTO config (key, value)
VALUES ('maintenance', json_object('on', json('$value'), 'since', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')));
SQL
    echo "Технические работы: $([ "$1" = on ] && echo 'включены' || echo 'выключены')."
    ;;
  status)
    ssh beautybook "sqlite3 $DB" <<'SQL'
SELECT COALESCE((SELECT value FROM config WHERE key = 'maintenance'), '{"on":false}');
SQL
    ;;
  *)
    echo 'Использование: bash backend/deploy/maintenance.sh on|off|status'
    exit 2
    ;;
esac
