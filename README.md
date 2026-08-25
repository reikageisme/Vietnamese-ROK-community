# ROK FAQ

Nền tảng knowledge + tools + community dành cho cộng đồng Rise of Kingdoms Việt Nam.

> ROK FAQ là dự án cộng đồng độc lập, không đại diện hoặc được tài trợ bởi Lilith Games.

## Chạy local

1. Sao chép `.env.example` thành `.env` và thay các giá trị development cần thiết.
2. Khởi động stack:

```bash
docker compose up -d --wait
```

Hoặc chỉ chạy giao diện web:

```bash
npm install
npm run dev
```

Mở `http://localhost:3000`.

> `docker compose up` tự nạp `docker-compose.override.yml` và chạy `next dev`.
> Chỉ dùng chế độ này trên máy cá nhân, không mở cổng 3000 ra Internet.

## Đưa lên host bằng Docker

Host cần Docker Compose v2, domain đã trỏ DNS về IP máy chủ và mở cổng `80/443`.

1. Tạo file môi trường production:

```bash
cp .env.example .env.production
```

PowerShell: `Copy-Item .env.example .env.production`.

Sửa ít nhất các biến sau trong `.env.production`:

```dotenv
NODE_ENV=production
DOMAIN=forum.example.vn
APP_URL=https://forum.example.vn
NEXTAUTH_URL=https://forum.example.vn
AUTH_SECRET=mot-chuoi-ngau-nhien-dai-va-bi-mat
WEB_BIND_ADDRESS=127.0.0.1
WEB_PORT=3030

POSTGRES_PASSWORD=mat-khau-postgres-manh
DATABASE_URL=postgresql://rokfaq:mat-khau-postgres-manh@postgres:5432/rokfaq?schema=public

MINIO_ROOT_USER=mot-tai-khoan-khac
MINIO_ROOT_PASSWORD=mat-khau-minio-manh
S3_ACCESS_KEY_ID=mot-tai-khoan-khac
S3_SECRET_ACCESS_KEY=mat-khau-minio-manh
COLLECTOR_API_TOKEN=mot-token-ngau-nhien-toi-thieu-32-ky-tu
DEVICE_AGENT_TOKEN=mot-token-khac-toi-thieu-32-ky-tu

GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASSWORD=...
EMAIL_FROM=ROK FAQ <no-reply@example.vn>
```

Nếu mật khẩu PostgreSQL có ký tự đặc biệt như `@`, `:`, `/`, hãy URL-encode phần
mật khẩu trong `DATABASE_URL`.

Với Google OAuth, thêm URI chuyển hướng:
`https://forum.example.vn/api/auth/callback/google`.

2. Nếu host đã có Nginx, Caddy hoặc web khác giữ cổng `80/443`, khởi động
ROK FAQ ở `127.0.0.1:3030`:

```powershell
docker compose --env-file .env.production --profile production -f docker-compose.yml -f compose.production.yml up -d --build --wait
```

Web công khai dùng port `3030`. Ops Console chứa batch thiết bị, phiếu nạp và hàng
đợi quét dùng port `3031`, mặc định chỉ bind `127.0.0.1` và chỉ MODERATOR/ADMIN truy
cập được. Không public port 3031 ra Internet. Quản trị từ máy cá nhân qua SSH tunnel:

```bash
ssh -L 3031:127.0.0.1:3031 root@IP_HOST
```

Sau đó mở `http://localhost:3031/ops/scans`. Trang `/scans` trên web công khai chỉ
hiển thị ví credit, yêu cầu nạp và đơn quét của chính người đang đăng nhập. Phiếu nạp
được quản trị viên đối soát thủ công; chưa có cổng thanh toán tự động.

Quản lý agent, điện thoại, nhân vật, lịch và hàng đợi tự động tại
`http://localhost:3031/ops/fleet`. Hướng dẫn đầy đủ nằm trong
[`docs/FLEET_AUTOMATION.md`](docs/FLEET_AUTOMATION.md).

`--profile production` bật Caddy, thứ lắng nghe cổng `80` và `443`. Đây là cách
mặc định: mở `http://IP-HOST/` là vào được, không cần gõ số cổng.

Giá trị `DOMAIN` quyết định Caddy làm gì:

| `DOMAIN` | Kết quả |
|---|---|
| `:80` | HTTP thuần trên cổng 80, không xin chứng chỉ. Dùng khi chưa có tên miền, hoặc khi đứng sau Cloudflare Tunnel — Cloudflare đã lo TLS. |
| `rokfaq.com` | Caddy tự lấy chứng chỉ Let's Encrypt. Chỉ được khi cổng 80 và 443 thông từ Internet tới máy này. |

Nếu host đã có sẵn một reverse proxy khác (Nginx Proxy Manager chẳng hạn), **bỏ**
`--profile production` và trỏ proxy đó tới `http://127.0.0.1:3030` — đừng để hai lớp
proxy cùng giành cổng 80.

Dù chọn cách nào, `APP_URL` và `NEXTAUTH_URL` phải khớp đúng địa chỉ người dùng gõ
trên trình duyệt. Lệch một chữ là Google OAuth trả về sai callback và link trong email
dẫn đi đâu mất.

Service `migrate` sẽ tự chạy migration và seed bằng Prisma 6 đã khóa trong dự án.
Không chạy `docker compose exec web npx prisma ...`, vì image web production không chứa
Prisma CLI và `npx` có thể tải nhầm Prisma 7. Caddy tự cấp HTTPS khi DNS và cổng đúng.

3. Kiểm tra hoặc xem log:

```powershell
docker compose --env-file .env.production --profile production -f docker-compose.yml -f compose.production.yml ps
docker compose --env-file .env.production --profile production -f docker-compose.yml -f compose.production.yml logs -f web ops-web migrate
```

Khi cập nhật mã nguồn, chạy lại lệnh `up -d --build --wait`. Dữ liệu PostgreSQL,
Redis, MinIO và chứng chỉ Caddy nằm trong Docker volumes nên không mất khi recreate container.

## Thử nghiệm điện thoại vật lý

Bộ điều khiển ADB an toàn theo serial cho hai điện thoại nằm tại
[`tools/rok-device-lab`](tools/rok-device-lab/README.md). Công cụ này dùng để nhận
diện thiết bị, kiểm tra kết nối, mở Wi-Fi, chụp màn hình và quan sát scrcpy trên
Windows trước khi chuyển collector sang Proxmox. Thư mục `RoK Tracker` được xem là
bản binary upstream cục bộ và không được commit vào repository.

## Data Hub và tài khoản demo

- Dashboard Kingdom: `/kingdoms`
- Chi tiết governor/nguồn scan: `/kingdoms/2812`
- Trung tâm trại KvK: `/kvk`
- Lịch sử và luồng collector: `/scans`

Để seed hai tài khoản thử nghiệm, đặt `SEED_DEMO_ACCOUNTS=true` trước khi chạy
service migration. Xem payload Collector API và lưu ý an toàn trong
[`docs/DATA_HUB.md`](docs/DATA_HUB.md). Không bật tài khoản có mật khẩu mặc định
trên host public.

## Trạng thái hiện tại

Đây là foundation/MVP đầu tiên, gồm:

- UI mobile-first cho trang chủ, forum, Codex, tools và đăng nhập.
- Dictionary Việt/Anh và chuyển ngôn ngữ phía client.
- Sáu calculator core dạng pure function; speedup calculator đã có UI và API mẫu.
- Schema Prisma modular cho identity, forum, Codex, kingdom, ingestion và i18n.
- Docker Compose cho web, PostgreSQL, Redis, MinIO và OCR worker; Caddy ở production.
- OCR worker khung luôn trả kết quả `pending_verification` để moderator duyệt.

Google OAuth, đăng ký email/mật khẩu và Forum CRUD/PostgreSQL đã được nối. Email local được xem tại Mailpit `http://localhost:8025`. Codex/kingdom persistence vẫn nằm trong roadmap. Chạy `npx prisma migrate dev --schema prisma/schema`, sau đó `npx prisma db seed --schema prisma/schema` để tạo các chuyên mục forum mặc định. Xem [đặc tả](docs/SPEC.md), [hợp đồng API](docs/API.md), [hướng dẫn credentials](docs/EMAIL_CREDENTIALS_AUTH.md) và [QA report](docs/QA_REPORT.md).

## Kiểm tra

```bash
npm run lint
npm run typecheck
npm test
npm run build
docker compose --env-file .env.example config --quiet
```

Không gọi API nội bộ của game, không reverse-engineer và không xây automation điều khiển game.
