#!/bin/sh
# Cập nhật web RokViet Hub trên server — một lệnh.
#
#   cd ~/Vietnamese-ROK-community && sh update-web.sh
#
# Kéo code mới, dựng lại image, chạy migration, nhập lại dữ liệu kho trang bị,
# rồi đợi mọi container báo healthy. Dừng ngay khi có bước nào hỏng thay vì đi
# tiếp và để lại một stack nửa vời.
#
# Không đụng tới panel điện thoại — cái đó có update.sh riêng ở
# tools/rok-device-panel/.
set -e

REPO="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO"

COMPOSE="docker compose --env-file .env.production -f docker-compose.yml -f compose.production.yml"

if [ ! -f .env.production ]; then
  echo "!! Thiếu .env.production. Sao chép từ .env.example rồi điền giá trị thật trước khi chạy lại."
  exit 1
fi

if [ "$1" = "--no-pull" ]; then
  echo "== Bỏ qua bước kéo code =="
else
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
fi

echo
echo "== Dựng lại và khởi động =="
# --wait chờ healthcheck, nên lệnh này thất bại khi container lên nhưng hỏng.
# Đó là điều mong muốn: thà biết ngay còn hơn tưởng đã xong.
$COMPOSE up -d --build --wait

echo
echo "== Kết quả migration và nhập dữ liệu =="
$COMPOSE logs --tail 25 migrate

echo
$COMPOSE ps
echo
echo "Web công khai : http://$(grep -E '^WEB_BIND_ADDRESS=' .env.production 2>/dev/null | cut -d= -f2 || echo 127.0.0.1):$(grep -E '^WEB_PORT=' .env.production 2>/dev/null | cut -d= -f2 || echo 3030)"
echo "Ops Console   : chỉ bind localhost, vào bằng SSH tunnel:"
echo "                ssh -L 3031:127.0.0.1:3031 root@100.113.111.64"
