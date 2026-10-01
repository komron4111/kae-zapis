#!/bin/bash
# Код администратора на сервере. Его знает только владелец: скрипт спрашивает код, не показывая его
# на экране, и записывает в /etc/beautybook/secrets.env (ACCESS_CODE и ADMIN_CODE — один и тот же код,
# как было на Cloudflare). Запуск с компьютера: ssh -t beautybook /opt/beautybook/backend/deploy/set-code.sh
set -euo pipefail
read -r -s -p 'Код администратора Beautybook: ' code; echo
read -r -s -p 'Ещё раз: ' again; echo
[ "$code" = "$again" ] || { echo 'Коды не совпали — запустите ещё раз.'; exit 1; }
[ "${#code}" -ge 8 ] || { echo 'Код короче 8 символов — сервер такой не примет.'; exit 1; }
quoted=${code//\\/\\\\}
quoted=${quoted//\"/\\\"}
f=/etc/beautybook/secrets.env
{ grep -v -E '^(ACCESS_CODE|ADMIN_CODE)=' "$f" || true; printf 'ACCESS_CODE="%s"\nADMIN_CODE="%s"\n' "$quoted" "$quoted"; } > "$f.new"
chgrp beautybook "$f.new"
chmod 640 "$f.new"
mv "$f.new" "$f"
systemctl restart beautybook
echo 'Готово: код сохранён, сервер перезапущен.'
