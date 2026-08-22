#!/bin/sh
# Cập nhật panel trên server — một lệnh.
#   cd ~/Vietnamese-ROK-community/tools/rok-device-panel && ./update.sh
set -e

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO"

echo "== Kéo code mới =="
BEFORE="$(git rev-parse HEAD)"
git pull --ff-only
AFTER="$(git rev-parse HEAD)"

if [ "$BEFORE" = "$AFTER" ]; then
  echo "   đã là bản mới nhất ($(git log --oneline -1))"
else
  echo "   $(git log --oneline "$BEFORE..$AFTER" | wc -l) commit mới:"
  git log --oneline "$BEFORE..$AFTER" | sed 's/^/     /'
fi

cd "$REPO/tools/rok-device-panel"

if [ ! -f .env ]; then
  echo "!! Thiếu .env — sao chép từ .env.example rồi đặt PANEL_TOKEN trước khi chạy lại."
  exit 1
fi

echo "== Dựng lại container =="
docker compose up -d --build

echo "== Chờ container khoẻ =="
for i in $(seq 1 30); do
  state="$(docker compose ps --format '{{.Status}}' 2>/dev/null | head -1)"
  case "$state" in
    *healthy*) echo "   $state"; break ;;
  esac
  sleep 2
done

echo "== Thiết bị =="
docker compose exec -T panel adb devices -l 2>/dev/null | grep -c "device usb" | sed 's/^/   máy sẵn sàng: /' || true

echo
docker compose ps
echo
echo "Panel: http://$(grep -E '^PANEL_BIND_ADDRESS=' .env 2>/dev/null | cut -d= -f2 || echo 127.0.0.1):$(grep -E '^PANEL_PORT=' .env 2>/dev/null | cut -d= -f2 || echo 5100)"
