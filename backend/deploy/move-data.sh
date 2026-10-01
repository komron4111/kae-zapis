#!/bin/bash
# Перенос базы с Cloudflare D1 на свой сервер (с компьютера, из корня проекта): bash backend/deploy/move-data.sh
# Выгружает D1 целиком (мастера, записи, фото, копии, ключи уведомлений VAPID), заливает на сервер,
# прежнюю базу сервера откладывает в /var/backups/beautybook/before-move-*.db, затем сверяет числа строк.
# Выгрузка содержит личные данные: на компьютере она живёт только во временной папке и сразу удаляется.
set -euo pipefail
cd "$(dirname "$0")/../.."
WRANGLER=(env CI=1 "$HOME/.local/node/bin/node" "$HOME/.local/node/bin/wrangler")
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
(cd backend && "${WRANGLER[@]}" d1 export kae-zapis --remote --output "$TMP/d1.sql" >/dev/null)
scp -q "$TMP/d1.sql" beautybook:/root/d1.sql
ssh beautybook 'set -e
  systemctl stop beautybook
  cd /var/lib/beautybook
  if [ -f beautybook.db ]; then mv beautybook.db "/var/backups/beautybook/before-move-$(date +%Y%m%d-%H%M%S).db"; fi
  rm -f beautybook.db-wal beautybook.db-shm
  sqlite3 beautybook.db < /root/d1.sql
  rm -f /root/d1.sql
  chown beautybook:beautybook beautybook.db
  runuser -u beautybook -- /opt/node/bin/node /opt/beautybook/backend/node/migrate.mjs beautybook.db
  systemctl start beautybook'
COUNT="SELECT 'masters', COUNT(*) FROM masters UNION ALL SELECT 'schedules', COUNT(*) FROM schedules UNION ALL SELECT 'backups', COUNT(*) FROM backups UNION ALL SELECT 'photos', COUNT(*) FROM photos UNION ALL SELECT 'bookings', COUNT(*) FROM bookings UNION ALL SELECT 'requests', COUNT(*) FROM requests UNION ALL SELECT 'devices', COUNT(*) FROM devices UNION ALL SELECT 'messages', COUNT(*) FROM messages UNION ALL SELECT 'config', COUNT(*) FROM config"
echo 'Строк в D1:'
(cd backend && "${WRANGLER[@]}" d1 execute kae-zapis --remote --json --command "$COUNT" 2>/dev/null) \
  | "$HOME/.local/node/bin/node" -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{for(const r of JSON.parse(s)[0].results)console.log("  "+Object.values(r).join(": "))})'
echo 'Строк на своём сервере:'
ssh beautybook "sqlite3 -separator ': ' /var/lib/beautybook/beautybook.db \"$COUNT\"" | sed 's/^/  /'
