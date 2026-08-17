# RokViet Hub

Nền tảng knowledge + tools + community dành cho cộng đồng Rise of Kingdoms Việt Nam.

> RokViet Hub là dự án cộng đồng độc lập, không đại diện hoặc được tài trợ bởi Lilith Games.

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
DATABASE_URL=postgresql://rokviet:mat-khau-postgres-manh@postgres:5432/rokviet?schema=public

MINIO_ROOT_USER=mot-tai-khoan-khac
MINIO_ROOT_PASSWORD=mat-khau-minio-manh
S3_ACCESS_KEY_ID=mot-tai-khoan-khac
S3_SECRET_ACCESS_KEY=mat-khau-minio-manh

GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASSWORD=...
EMAIL_FROM=RokViet Hub <no-reply@example.vn>
```

Nếu mật khẩu PostgreSQL có ký tự đặc biệt như `@`, `:`, `/`, hãy URL-encode phần
mật khẩu trong `DATABASE_URL`.

Với Google OAuth, thêm URI chuyển hướng:
`https://forum.example.vn/api/auth/callback/google`.

2. Nếu host đã có Nginx, Caddy hoặc web khác giữ cổng `80/443`, khởi động
RokViet Hub ở `127.0.0.1:3030`:

```powershell
docker compose --env-file .env.production -f docker-compose.yml -f compose.production.yml up -d --build --wait
```

Sau đó cấu hình reverse proxy hiện có chuyển domain/subdomain của RokViet Hub tới
`http://127.0.0.1:3030`. Không thêm `--profile production`, vì profile đó bật Caddy
bundled trên cổng `80/443`. Nếu host chưa có web hoặc reverse proxy nào khác, bạn có
thể thêm `--profile production` để dùng Caddy bundled và HTTPS tự động.

Để mở trực tiếp `http://IP-HOST:3030` khi chạy thử, đặt `WEB_BIND_ADDRESS=0.0.0.0`
và mở firewall cổng 3030. Cách này không có HTTPS, chỉ nên dùng tạm thời; khi public
chính thức nên dùng một subdomain riêng qua reverse proxy.

Service `migrate` sẽ tự chạy migration và seed bằng Prisma 6 đã khóa trong dự án.
Không chạy `docker compose exec web npx prisma ...`, vì image web production không chứa
Prisma CLI và `npx` có thể tải nhầm Prisma 7. Caddy tự cấp HTTPS khi DNS và cổng đúng.

3. Kiểm tra hoặc xem log:

```powershell
docker compose --env-file .env.production -f docker-compose.yml -f compose.production.yml ps
docker compose --env-file .env.production -f docker-compose.yml -f compose.production.yml logs -f web migrate
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
