#!/bin/sh
# Một adb server duy nhất cho cả host.
#
# Đây là điểm dễ hỏng nhất khi chạy chung với agent quét: hai adb server cùng
# giành /dev/bus/usb sẽ đá nhau, thiết bị nhảy offline ngẫu nhiên. Vì vậy container
# này chạy adb server ở chế độ lắng nghe TCP, và agent phải trỏ vào đúng server đó
# bằng ADB_SERVER_SOCKET thay vì tự khởi động server riêng.
set -e

ADB_BIN="${ADB_PATH:-/usr/bin/adb}"
ADB_PORT="${ADB_SERVER_PORT:-5037}"

if [ "${ADB_LISTEN_ALL:-true}" = "true" ]; then
  echo "[entrypoint] adb server lắng nghe 0.0.0.0:${ADB_PORT}"
  "$ADB_BIN" -a -P "$ADB_PORT" nodaemon server >/tmp/adb-server.log 2>&1 &
  # Chờ server nhận cổng trước khi panel gọi lệnh đầu tiên.
  i=0
  while [ $i -lt 20 ]; do
    if "$ADB_BIN" -P "$ADB_PORT" devices >/dev/null 2>&1; then break; fi
    i=$((i + 1)); sleep 0.25
  done
fi

exec uvicorn panel.main:app \
  --host 0.0.0.0 \
  --port "${PANEL_PORT:-5100}" \
  --log-level warning \
  --timeout-graceful-shutdown 5
