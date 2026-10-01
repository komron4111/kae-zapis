#!/bin/sh
# Копия базы Beautybook каждую ночь (таймер beautybook-backup.timer): /var/backups/beautybook, 14 дней.
# .backup — целая копия, даже пока сервер пишет в базу.
set -eu
dir=/var/backups/beautybook
file="$dir/beautybook-$(date +%Y-%m-%d).db"
sqlite3 /var/lib/beautybook/beautybook.db ".backup '$file'"
gzip -f "$file"
find "$dir" -name 'beautybook-*.db.gz' -mtime +14 -delete
