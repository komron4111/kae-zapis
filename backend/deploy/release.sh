#!/bin/bash
# Выпуск новой версии целиком (2.10.0) — с компьютера, из корня проекта, когда изменения уже в git commit:
#   bash backend/deploy/release.sh
# 1. Технические работы — вкл.: приложения мастеров показывают «Идут технические работы», изменения ждут.
# 2. Копия базы; свой сервер и сайт (deploy.sh); прежние адреса — Cloudflare Pages и GitHub Pages (git push).
# 3. Технические работы — выкл.: открытые приложения мастеров сами перезапускаются в новой версии.
# 4. Если сменилась версия сайта (APP_VERSION) — мастерам уведомление «Вышло обновление»: с 09:00 до 22:00
#    сразу, а ночью — в 10:00 (таймер на своём сервере), чтобы никого не будить.
set -euo pipefail
cd "$(dirname "$0")/../.."
NODE="$HOME/.local/node/bin/node"
WRANGLER="$HOME/.local/node/bin/wrangler"
GH="$HOME/.local/bin/gh"
version() { grep -o "APP_VERSION = '[0-9.]*'" | cut -d"'" -f2; }

if [ -n "$(git status --porcelain frontend backend)" ]; then
  echo 'Сначала git commit: в frontend/ или backend/ есть несохранённые изменения.'
  exit 1
fi
new=$(version < frontend/config.js)
old=$(curl -s --max-time 20 "https://beautybook.kz/config.js?v=$RANDOM" | version || true)
site_changed=$(git diff --name-only '@{u}..HEAD' -- frontend | head -1)

bash backend/deploy/maintenance.sh on
trap 'bash backend/deploy/maintenance.sh off' EXIT
ssh beautybook 'systemctl start beautybook-backup.service'
MAINTENANCE_HELD=1 bash backend/deploy/deploy.sh
for project in beautybook-kz nailapp; do
  CI=1 "$NODE" "$WRANGLER" pages deploy frontend --project-name "$project" --branch main 2>&1 | grep -E 'Deployment complete|ERROR|✘' || true
done
git push -q
# GitHub Pages собирает Actions — ждём, чтобы и komron4111.github.io (с него приложение Арай) был уже новым.
if [ -n "$site_changed" ]; then
  sha=$(git rev-parse --short=7 HEAD)
  for i in $(seq 1 36); do
    state=$("$GH" run list --limit 1 --json status,headSha --jq '.[0] | "\(.status) \(.headSha[0:7])"' 2>/dev/null || true)
    [ "$state" = "completed $sha" ] && break
    sleep 5
  done
  echo "GitHub Pages: $state"
fi
bash backend/deploy/maintenance.sh off
trap - EXIT

if [ -n "$new" ] && [ "$new" != "$old" ]; then
  ssh beautybook 'h=$(date +%H)
    if [ "$h" -ge 9 ] && [ "$h" -lt 22 ]; then
      /opt/beautybook/backend/deploy/notify-update.sh
    else
      day=$([ "$h" -lt 10 ] && date +%F || date -d tomorrow +%F)
      systemd-run --quiet --unit="beautybook-notify-$(date +%s)" --on-calendar="$day 10:00:00" /opt/beautybook/backend/deploy/notify-update.sh
      echo "Уведомление мастерам о новой версии — $day в 10:00."
    fi'
fi
echo "Выпуск ${new:-?} готов (было ${old:-?})."
