#!/bin/sh
# Уведомление всем мастерам «Вышло обновление Beautybook — закройте приложение и откройте снова (иногда 2 раза)».
# Запускается на своём сервере от root; с компьютера: ssh beautybook /opt/beautybook/backend/deploy/notify-update.sh
# Местный ключ LOCAL_KEY (secrets.env) сервер принимает только с 127.0.0.1.
set -eu
key=$(sed -n 's/^LOCAL_KEY=//p' /etc/beautybook/secrets.env)
[ -n "$key" ] || { echo 'Нет LOCAL_KEY в /etc/beautybook/secrets.env — запустите install.sh ещё раз.'; exit 1; }
curl -fsS -X POST -H "Authorization: Local $key" -H 'Content-Type: application/json' -d '{"kind":"update"}' http://127.0.0.1:8787/api/admin/broadcast
echo
