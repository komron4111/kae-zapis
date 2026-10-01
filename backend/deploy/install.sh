#!/bin/bash
# Установка сервера Beautybook на чистую Ubuntu 24.04 (от root, после того как код лежит в /opt/beautybook):
#   bash /opt/beautybook/backend/deploy/install.sh beautybook.kz
# Ставит обновления, Node.js 24 (официальная сборка, сверка контрольной суммы), Caddy (HTTPS сам),
# службу beautybook, ночные копии базы, файрвол (22, 80, 443), вход по SSH только по ключу.
# Повторный запуск ничего не ломает: уже сделанное пропускается, файлы служб обновляются.
set -euo pipefail
DOMAIN="${1:?Укажите домен: bash install.sh beautybook.kz}"
APP=/opt/beautybook
export DEBIAN_FRONTEND=noninteractive

echo '== Обновления системы и пакеты'
apt-get update -q
apt-get -y -q -o Dpkg::Options::=--force-confold upgrade
apt-get -y -q install curl ca-certificates gnupg sqlite3 ufw unattended-upgrades xz-utils rsync openssl \
  debian-keyring debian-archive-keyring apt-transport-https
timedatectl set-timezone Asia/Almaty
printf 'APT::Periodic::Update-Package-Lists "1";\nAPT::Periodic::Unattended-Upgrade "1";\n' > /etc/apt/apt.conf.d/20auto-upgrades

echo '== Node.js 24'
if ! /opt/node/bin/node -v 2>/dev/null | grep -q '^v24\.'; then
  BASE=https://nodejs.org/dist/latest-v24.x
  SUMS=$(curl -fsSL "$BASE/SHASUMS256.txt")
  FILE=$(printf '%s\n' "$SUMS" | awk '$2 ~ /linux-x64\.tar\.xz$/ {print $2}')
  curl -fsSL -o "/tmp/$FILE" "$BASE/$FILE"
  (cd /tmp && printf '%s\n' "$SUMS" | grep " $FILE\$" | sha256sum -c -)
  tar -xJf "/tmp/$FILE" -C /opt
  ln -sfn "/opt/${FILE%.tar.xz}" /opt/node
  rm -f "/tmp/$FILE"
fi
/opt/node/bin/node -v

echo '== Caddy'
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -q
  apt-get -y -q install caddy
fi

echo '== Пользователь, папки, настройки'
id beautybook >/dev/null 2>&1 || useradd --system --home-dir /var/lib/beautybook --shell /usr/sbin/nologin beautybook
install -d -o beautybook -g beautybook -m 750 /var/lib/beautybook
install -d -m 700 /var/backups/beautybook
install -d -m 750 -g beautybook /etc/beautybook
[ -f /etc/beautybook/beautybook.env ] || printf 'DB_FILE=/var/lib/beautybook/beautybook.db\nPORT=8787\nHOST=127.0.0.1\n' > /etc/beautybook/beautybook.env
if [ ! -f /etc/beautybook/secrets.env ]; then
  # Общий ключ с прежним адресом сервера на Cloudflare (он пересылает сюда запросы прежних приложений).
  printf 'PROXY_KEY=%s\n' "$(openssl rand -hex 32)" > /etc/beautybook/secrets.env
fi
# Местный ключ для рассылки мастерам с самого сервера (deploy/notify-update.sh).
grep -q '^LOCAL_KEY=' /etc/beautybook/secrets.env || printf 'LOCAL_KEY=%s\n' "$(openssl rand -hex 32)" >> /etc/beautybook/secrets.env
chgrp beautybook /etc/beautybook/secrets.env
chmod 640 /etc/beautybook/secrets.env
chmod +x "$APP/backend/deploy/"*.sh
if [ ! -f /var/lib/beautybook/beautybook.db ]; then
  runuser -u beautybook -- /opt/node/bin/node "$APP/backend/node/migrate.mjs" /var/lib/beautybook/beautybook.db
fi

echo '== Службы: сервер, копии базы, HTTPS'
cp "$APP/backend/deploy/beautybook.service" "$APP/backend/deploy/beautybook-backup.service" "$APP/backend/deploy/beautybook-backup.timer" /etc/systemd/system/
sed "s/{{DOMAIN}}/$DOMAIN/g" "$APP/backend/deploy/Caddyfile" > /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null
systemctl daemon-reload
systemctl enable --now beautybook beautybook-backup.timer
systemctl restart beautybook
systemctl reload caddy || systemctl restart caddy

echo '== Файрвол'
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw allow 443/udp >/dev/null
ufw --force enable >/dev/null
ufw status | head -3

echo '== SSH: только по ключу'
if [ -s /root/.ssh/authorized_keys ]; then
  printf 'PasswordAuthentication no\nKbdInteractiveAuthentication no\nPermitRootLogin prohibit-password\n' > /etc/ssh/sshd_config.d/10-beautybook.conf
  install -d -m 755 /run/sshd # в Ubuntu 24.04 ssh запускается по сокету, папки может не быть
  sshd -t && { systemctl reload ssh 2>/dev/null || systemctl restart ssh; }
fi

sleep 1
systemctl is-active beautybook caddy
curl -fsS -o /dev/null -w 'сервер: %{http_code}\n' http://127.0.0.1:8787/api/contact
echo "Готово. Сайт: https://$DOMAIN/ (сертификат Caddy получит сам, когда домен указывает на этот сервер)."
