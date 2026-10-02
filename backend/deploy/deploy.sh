#!/bin/bash
# Выложить новую версию на свой сервер (с компьютера, из корня проекта): bash backend/deploy/deploy.sh
# Сервер — хост «beautybook» из ~/.ssh/config (вход по ключу ~/.ssh/nailapp_server).
# Копирует код сервера и сайт, применяет новые миграции базы и перезапускает сервер. На это время включает
# технические работы (2.10.0): изменения от мастеров и клиентов подождут. Весь выпуск сразу — release.sh.
set -euo pipefail
cd "$(dirname "$0")/../.."
if [ "${MAINTENANCE_HELD:-}" != 1 ]; then # release.sh держит технические работы сам
  bash backend/deploy/maintenance.sh on
  trap 'bash backend/deploy/maintenance.sh off' EXIT
fi
ssh beautybook 'install -d -m 755 /opt/beautybook/backend /opt/beautybook/frontend'
rsync -az --delete --exclude '.DS_Store' backend/src backend/node backend/migrations backend/deploy beautybook:/opt/beautybook/backend/
rsync -az --delete --exclude '.DS_Store' frontend/ beautybook:/opt/beautybook/frontend/
ssh beautybook 'set -e
  chmod +x /opt/beautybook/backend/deploy/*.sh
  if [ -f /var/lib/beautybook/beautybook.db ]; then
    runuser -u beautybook -- /opt/node/bin/node /opt/beautybook/backend/node/migrate.mjs /var/lib/beautybook/beautybook.db
  fi
  if systemctl list-unit-files beautybook.service >/dev/null 2>&1; then
    systemctl restart beautybook
    sleep 1
    systemctl is-active beautybook
  fi'
echo 'Выложено на свой сервер.'
