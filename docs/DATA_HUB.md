# ROK FAQ Data Hub

## Phạm vi hiện tại

Giao diện `/kingdoms`, `/kingdoms/[number]`, `/kvk` và `/scans` dùng dữ liệu demo
để hoàn thiện UX trước khi box phone hoạt động. Dữ liệu thật đi qua Collector API,
được lưu ở trạng thái `PENDING_REVIEW` và không mặc nhiên được xem là chính xác.

Logo/hình nền Rise of Kingdoms trên giao diện được tải từ CDN của website chính
thức `rok.lilith.com`. ROK FAQ vẫn giữ disclaimer dự án cộng đồng độc lập và
không dùng asset đó để ngụ ý có quan hệ tài trợ với Lilith Games.

## Luồng collector

```text
phone01 / phone02
  -> ADB screenshot + OCR
  -> chuẩn hóa JSON (BigInt gửi dưới dạng chuỗi)
  -> POST /api/collector/v1/scans
  -> CollectorBatch + GovernorSnapshot + KingdomSnapshot
  -> PENDING_REVIEW
  -> moderator duyệt
  -> dashboard công khai
```

Mỗi lần quét phải có `externalId` duy nhất. Gửi lại cùng ID không tạo bản ghi
trùng. `evidenceObjectKeys` chứa key ảnh trong MinIO; không gửi URL tùy ý từ bên
ngoài.

Ví dụ:

```bash
curl -X POST https://forum.example.vn/api/collector/v1/scans \
  -H "Authorization: Bearer $COLLECTOR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "externalId":"phone01-kd2812-20260817T162300Z",
    "deviceId":"phone01",
    "capturedAt":"2026-08-17T16:23:00+07:00",
    "kingdom":{"number":2812,"name":"Vương quốc Selmes"},
    "coveragePercent":98,
    "evidenceObjectKeys":["scans/phone01/2812/overview.png"],
    "records":[{
      "governorId":"124906225",
      "name":"Boss Võ",
      "allianceTag":"CS35",
      "power":"121030602",
      "killPoints":"3623770839",
      "deadTroops":"2532013",
      "t4Kills":"182341202",
      "t5Kills":"716220470",
      "helps":"168530"
    }]
  }'
```

## Tài khoản demo

Tài khoản demo là opt-in và chỉ bật trên host thử nghiệm:

```dotenv
SEED_DEMO_ACCOUNTS=true
NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS=true
DEMO_MEMBER_PASSWORD=ROK FAQDemo!2026
DEMO_MODERATOR_PASSWORD=ROK FAQMod!2026
```

- `demo.member@rokfaq.local`: thành viên thường, dùng thử tạo chủ đề, reply,
  vote, bookmark và report.
- `demo.mod@rokfaq.local`: có thêm quyền moderator, dùng thử trang báo cáo.

Không bật mật khẩu mặc định trên host public. Đặt `SEED_DEMO_ACCOUNTS=false`, build
lại web và vô hiệu hóa/xóa hai user demo trước khi mở website chính thức.

## Tách public và operations

- Public `:3030/scans`: khách đăng nhập, nạp credit, đặt quét và chỉ xem đơn của mình.
- Private `127.0.0.1:3031/ops/scans`: MODERATOR/ADMIN đối soát phiếu nạp, điều phối
  hàng đợi và xem batch collector.
- Public container trả 404 cho `/ops/*`; Ops API còn kiểm tra đồng thời
  `APP_SURFACE=ops` và role trong database.
- Không mở firewall port 3031. Dùng SSH tunnel hoặc reverse proxy có VPN/Access policy.
- Phiếu nạp hiện được đối soát thủ công. Chưa ghi nhận thanh toán tự động cho tới khi
  tích hợp một cổng thanh toán chính thức và webhook đã xác thực chữ ký.
