#!/bin/bash
# Сверка после переезда (с компьютера, из корня проекта): bash backend/deploy/compare-d1.sh [--merge]
# Выгружает D1 ещё раз (после включения пересылки туда уже никто не пишет) и сравнивает с базой своего
# сервера по каждой таблице: сколько строк и есть ли строки D1, которых нет на сервере (по всем столбцам).
# С --merge дописывает на сервер строки, которых там нет совсем (по первичному ключу) — например, заявку
# клиента, пришедшую в минуту переключения. Изменённые строки не трогает: о них только сообщает.
set -euo pipefail
cd "$(dirname "$0")/../.."
MERGE="${1:-}"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
(cd backend && env CI=1 "$HOME/.local/node/bin/node" "$HOME/.local/node/bin/wrangler" d1 export kae-zapis --remote --output "$TMP/d1-final.sql" >/dev/null)
scp -q "$TMP/d1-final.sql" beautybook:/root/d1-final.sql
ssh beautybook MERGE="$MERGE" 'bash -s' <<'REMOTE'
set -euo pipefail
rm -f /root/d1-final.db
sqlite3 /root/d1-final.db < /root/d1-final.sql
DB=/var/lib/beautybook/beautybook.db
printf '%-16s %8s %8s %12s\n' 'таблица' 'D1' 'сервер' 'нет на сервере'
for t in $(sqlite3 /root/d1-final.db "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"); do
  d1=$(sqlite3 /root/d1-final.db "SELECT COUNT(*) FROM \"$t\"")
  srv=$(sqlite3 "$DB" "SELECT COUNT(*) FROM \"$t\"" 2>/dev/null || echo 'нет таблицы')
  diff=$(sqlite3 "$DB" "ATTACH '/root/d1-final.db' AS fin; SELECT COUNT(*) FROM (SELECT * FROM fin.\"$t\" EXCEPT SELECT * FROM main.\"$t\")" 2>/dev/null || echo '?')
  printf '%-16s %8s %8s %12s\n' "$t" "$d1" "$srv" "$diff"
  if [ "$MERGE" = "--merge" ] && [ "$diff" != "0" ] && [ "$diff" != "?" ] && [ "$t" != "d1_migrations" ]; then
    sqlite3 "$DB" "ATTACH '/root/d1-final.db' AS fin; INSERT OR IGNORE INTO main.\"$t\" SELECT * FROM fin.\"$t\";"
    echo "  → дописаны недостающие строки в $t (существующие не изменены)"
  fi
done
rm -f /root/d1-final.db /root/d1-final.sql
REMOTE
