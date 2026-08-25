#!/bin/sh
# Cập nhật web ROK FAQ trên server — một lệnh.
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

# --profile production la bat buoc: Caddy nam sau profile do. Thieu no thi
# Caddy khong khoi dong va web chi vao duoc bang cong 3030.
COMPOSE="docker compose --env-file .env.production -f docker-compose.yml -f compose.production.yml"

# Caddy nam sau profile "production" va nghe cong 80/443. Neu da co mot reverse
# proxy khac dung truoc (Nginx Proxy Manager, Cloudflare Tunnel...) thi KHONG bat
# profile do — hai proxy cung gianh cong 80 thi cai thu hai khong khoi dong duoc,
# va them mot lop nua chi them mot cho cau hinh sai header va IP that cua khach.
if grep -qE '^EXTERNAL_PROXY=true' .env.production 2>/dev/null; then
  echo "== Proxy ngoai: khong bat Caddy =="
else
  COMPOSE="$COMPOSE --profile production"
fi

# Postgres chạy ở máy khác? Nạp thêm lớp phủ tắt container Postgres nội bộ.
# Không có bước này thì máy này vẫn dựng một Postgres rỗng chẳng ai dùng, và
# `web` vẫn chờ nó khoẻ trước khi khởi động.
if grep -qE '^EXTERNAL_DB=true' .env.production 2>/dev/null; then
  COMPOSE="$COMPOSE -f compose.external-db.yml"
  echo "== Postgres ngoài: đã nạp compose.external-db.yml =="
fi

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
echo "== Dựng image =="
# Dựng TRƯỚC rồi mới khởi động, không gộp bằng `up --build`.
#
# Lý do: ops-web khai `image:` nhưng không có `build:` — nó dùng lại image do
# web dựng ra. Gộp hai bước thì compose cố kéo image đó từ Docker Hub song song
# với lúc web còn đang build, và thất bại với "pull access denied" vì image chỉ
# tồn tại ở máy này. Trên máy đã build lần nào rồi thì không thấy lỗi, nên nó
# chỉ lộ ra khi dựng máy mới.
$COMPOSE build

echo
echo "== Khởi động =="
# --wait chờ healthcheck, nên lệnh này thất bại khi container lên nhưng hỏng.
# Đó là điều mong muốn: thà biết ngay còn hơn tưởng đã xong.
$COMPOSE up -d --wait

echo
echo "== Kết quả migration và nhập dữ liệu =="
$COMPOSE logs --tail 25 migrate

echo
$COMPOSE ps
echo
WEB_PORT_VALUE="$(grep -E '^WEB_PORT=' .env.production 2>/dev/null | cut -d= -f2- || echo 3030)"
APP_URL_VALUE="$(grep -E '^APP_URL=' .env.production 2>/dev/null | cut -d= -f2-)"
if grep -qE '^EXTERNAL_PROXY=true' .env.production 2>/dev/null; then
  echo "Cổng nội bộ   : http://<IP máy này>:${WEB_PORT_VALUE:-3030}  ← trỏ reverse proxy vào đây"
else
  echo "Cổng nội bộ   : http://<IP máy này>/  (Caddy, cổng 80)"
fi
[ -n "$APP_URL_VALUE" ] && echo "Địa chỉ công khai : $APP_URL_VALUE"
echo "Ops Console   : chỉ bind localhost, vào bằng SSH tunnel:"
echo "                ssh -L 3031:127.0.0.1:3031 root@100.113.111.64"
