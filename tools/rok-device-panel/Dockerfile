# Build context là thư mục `tools/`, không phải `tools/rok-device-panel/`.
# Panel cài trực tiếp gói rok-device-lab để dùng chung đúng hàm dhash và trình
# đọc profile mà agent dùng lúc chạy thật — nếu hai bên lệch nhau thì mọi giá trị
# hiệu chỉnh sinh ra ở đây đều vô nghĩa.

FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PANEL_DATA_DIR=/data \
    ADB_PATH=/usr/bin/adb

# Gói `adb` của Debian cài vào /usr/bin/adb. Dòng `test -x` giữ cho build fail sớm
# nếu vị trí đó đổi ở bản Debian sau, thay vì để panel chết lúc chạy.
RUN apt-get update \
 && apt-get install -y --no-install-recommends adb usbutils \
 && rm -rf /var/lib/apt/lists/* \
 && test -x /usr/bin/adb

WORKDIR /app

COPY rok-device-panel/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY rok-device-lab /src/rok-device-lab
RUN pip install --no-cache-dir /src/rok-device-lab

COPY rok-device-panel/panel ./panel
COPY rok-device-panel/static ./static
COPY rok-device-panel/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

RUN mkdir -p /data /profiles /config

EXPOSE 5100 5037

HEALTHCHECK --interval=20s --timeout=5s --start-period=15s --retries=4 \
  CMD python -c "import os,urllib.request;urllib.request.urlopen('http://127.0.0.1:'+os.environ.get('PANEL_PORT','5100')+'/healthz',timeout=4)"

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
