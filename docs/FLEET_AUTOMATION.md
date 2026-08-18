# RokViet Fleet Control — tự động hóa box phone

## Kiến trúc

```text
Web công khai :3030
  └─ người dùng mua credit / yêu cầu quét
       └─ AutomationJob (PostgreSQL)

Fleet Control :3031 (chỉ localhost/Tailscale/SSH)
  ├─ thiết bị, character, policy, queue, tiến độ
  └─ Device Agent API dùng bearer token riêng

Windows/Proxmox USB host
  └─ rok-device agent-run
       ├─ heartbeat ADB theo serial
       ├─ claim job phù hợp character/Kingdom
       ├─ đổi character bằng route có fingerprint guard
       ├─ chạy scanner
       └─ upload Collector API/ranking có cấu trúc + hoàn tất job
```

Web không cần USB passthrough. Agent phải chạy trên đúng Windows/VM có thể thấy
ADB của box phone. Một serial chỉ có một job nhờ device lock và database lease.

## Biến môi trường

Tạo hai token khác nhau, không commit:

```bash
openssl rand -hex 32  # COLLECTOR_API_TOKEN
openssl rand -hex 32  # DEVICE_AGENT_TOKEN
```

Trong `.env.production`:

```dotenv
OPS_BIND_ADDRESS=127.0.0.1
OPS_PORT=3031
OPS_APP_URL=http://localhost:3031
DEVICE_AGENT_TOKEN=<token-agent-64-hex>
COLLECTOR_API_TOKEN=<token-collector-64-hex>
```

Mở Fleet Control từ máy quản trị:

```powershell
ssh -N -L 3031:127.0.0.1:3031 rokops@IP_SERVER
```

Sau đó truy cập `http://localhost:3031/ops/fleet`. Chỉ tài khoản ADMIN hoặc
MODERATOR được vào; cấu hình character/policy chỉ ADMIN được sửa.

## Chạy agent trên Windows 11

```powershell
cd "D:\ROK Forum"
Copy-Item tools\rok-device-lab\config\agent.example.json `
  tools\rok-device-lab\config\agent.local.json

$env:ROK_CONTROL_URL = "http://127.0.0.1:3031"
$env:ROK_DEVICE_AGENT_TOKEN = "<token-agent>"
$env:ROK_COLLECTOR_URL = "http://127.0.0.1:3030"
$env:ROK_COLLECTOR_TOKEN = "<token-collector>"
$env:ADB_PATH = "D:\Program Files (x86)\xiaowei_android\tools\adb.exe"
$env:TESSERACT_PATH = "C:\Program Files\Tesseract-OCR\tesseract.exe"
$rok = "tools\rok-device-lab\.venv\Scripts\python.exe"

& $rok -m rok_lab.cli agent-run `
  tools\rok-device-lab\config\agent.local.json
```

Nếu agent ở máy khác server, dùng Tailscale IP hoặc tạo SSH tunnel cho cả 3030
và 3031. Không mở trực tiếp 3031 ra Internet.

## Đổi character

Mỗi character có `key`, Kingdom và `switchRoute`. Route là state machine gồm:

- `wait-screen`: xác minh fingerprint trước/sau thao tác;
- `tap`: chạm điểm chuẩn hóa có tên trong device profile;
- `swipe`: kéo giữa hai điểm chuẩn hóa;
- `keyevent`: chỉ chấp nhận Android `KEYCODE_*`.

Ví dụ cấu trúc:

```json
{
  "steps": [
    {"action":"wait-screen","screen":"city","timeoutSeconds":15},
    {"action":"tap","point":"character.avatar","waitSeconds":1},
    {"action":"wait-screen","screen":"governor-profile","timeoutSeconds":15},
    {"action":"tap","point":"character.settings","waitSeconds":1},
    {"action":"tap","point":"character.manage","waitSeconds":2},
    {"action":"tap","point":"character.slot-2","waitSeconds":8},
    {"action":"wait-screen","screen":"city-kd2812","timeoutSeconds":30}
  ],
  "finalScreen":"city-kd2812"
}
```

Các point/fingerprint `character.*` phải hiệu chỉnh từ ảnh thật của bản game và
thiết bị. Route rỗng hoặc fingerprint thiếu sẽ dừng an toàn; agent không chạy
blind tap. Character được chuyển từ `VERIFYING` sang `READY` sau khi agent
heartbeat đúng `currentCharacterKey`.

Mỗi character còn có `scanRoutes`, là object keyed theo `KINGDOM_FULL`,
`RANKING_SEED`, `RANKING_ALLIANCE`, `RANKING_HONOR`. Agent luôn chạy
`switchRoute` để đưa game về trạng thái xác định, rồi chạy route tương ứng để mở
đúng bảng trước khi OCR. Ví dụ:

```json
{
  "RANKING_SEED": {
    "steps": [
      {"action":"wait-screen","screen":"city-kd2812","timeoutSeconds":20},
      {"action":"tap","point":"city.rankings","waitSeconds":2},
      {"action":"tap","point":"ranking.seed","waitSeconds":2},
      {"action":"wait-screen","screen":"seed-ranking","timeoutSeconds":15}
    ],
    "finalScreen":"seed-ranking"
  }
}
```

Tên point/screen trên chỉ là contract; phải lấy ảnh thật của A51 và bổ sung vào
profile. Job thiếu `scanRoute` sẽ không được chạy mù và được ghi lỗi rõ trên
Fleet Control.

## Dữ liệu nền nhiều Kingdom

Nút “Khởi tạo dải Kingdom” tạo record trống và policy, không bịa số liệu. Policy
chỉ sinh job khi có ít nhất một character READY/VERIFYING truy cập Kingdom đó.
Nhờ vậy dải 1001–4200 không làm nghẽn queue trong lúc mới có hai điện thoại.

Khuyến nghị:

- active KvK: priority >= 1000, cadence 6–24 giờ;
- Kingdom Việt Nam: priority 300–800, cadence 1–7 ngày;
- catalog nền: priority 10, cadence 30 ngày;
- full scan chỉ cho đơn trả credit hoặc mốc đầu/cuối KvK;
- seed scan dùng để phủ rộng.

Không thể tự động quét một Kingdom nếu không có character/account thực sự nhìn
thấy dữ liệu đó. Cách mở rộng là thêm character mapping, hợp tác leadership và
đặt một account quan sát trong từng Lost Kingdom quan trọng.

Kết quả Seed/Alliance/Honor không chỉ nằm trong Excel. Agent gửi `ranking.json`
đã loại đường dẫn ảnh cục bộ về Fleet API; server kiểm tra schema, lưu batch và
từng dòng điểm dưới dạng `BigInt`. Trang công khai `/kingdoms` đọc batch Seed mới
nhất của mỗi Kingdom. Kingdom chưa quét hiển thị 0% và không có số liệu giả.

## Triển khai database

```bash
docker compose --env-file .env.production -f docker-compose.yml \
  -f compose.production.yml up -d --build --wait
```

Service `migrate` tự chạy migration Fleet Control trước khi `web`/`ops-web`
khởi động. Không chạy `npx prisma` tải bản CLI mới bên trong runner container.
