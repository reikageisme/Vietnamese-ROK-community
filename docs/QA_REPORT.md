# QA & Security Report — Foundation MVP

Ngày kiểm tra gần nhất: 2026-08-10

| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| Next.js production build | PASS | Full route manifest compiled, including forum, moderation, notifications, identity and tools |
| TypeScript | PASS | `tsc --noEmit` |
| ESLint | PASS | 0 lỗi |
| Unit tests | PASS | 30/30 identity, password, session reset, full forum and calculator tests |
| Dependency audit | REVIEW | npm báo advisory Nodemailer GHSA-p6gq-j5cr-w38f (không có bản vá tại thời điểm kiểm tra); ứng dụng không nhận `raw`, URL hoặc file path từ người dùng và bật `disableFileAccess`/`disableUrlAccess` |
| Prisma schema | PASS | Multi-file schema format/validate thành công |
| Docker Compose runtime | PASS | Web, PostgreSQL, Redis, MinIO và OCR worker đều healthy |
| OCR Python compile | PASS | Worker compile được; output luôn `pending_verification` |
| Browser mobile QA | PASS | 375×812: home và speedup calculator hiển thị đúng |
| Browser desktop QA | PASS | 1440×900: navigation/home hiển thị đúng |
| Console errors | PASS | Không ghi nhận lỗi ở các route đã kiểm tra |
| Google OIDC implementation | PASS | Auth.js Google OIDC, Prisma adapter và JWT có thể thu hồi bằng `sessionVersion` đã nối |
| Google OAuth live callback | PENDING | Cần founder cung cấp Google Client ID/Secret thật |
| Authorization cho forum writes | PASS | Session thật; author hoặc MODERATOR/ADMIN cho edit/delete |
| Zod validation | PASS | Forum write/query input và speedup API được validate |
| Rate limiting | PASS | 5 topic/giờ cho MEMBER và 5 report/giờ/user |
| Forum CRUD tests | PASS | Permission, rate-limit policy và vote toggle có unit tests |
| PostgreSQL migration/seed | PASS | Migration `20260808122206_init`; 8 category được seed |
| Forum API smoke test | PASS | GET categories trả 8 mục; POST không session trả 401 |
| OCR upload flow test | PENDING | Worker khung có, web upload/queue chưa nối |
| Credentials auth | PASS | Argon2id, CredentialsProvider, lỗi đăng nhập đồng nhất, khóa 5 lần sai/15 phút |
| Email verification/reset | PASS | Token ngẫu nhiên một lần, DB chỉ lưu hash; reset vô hiệu hóa toàn bộ phiên |
| Credentials migration runtime | PASS | Applied on PostgreSQL 16 through the pinned Prisma 6.19.3 CLI |
| Full Forum schema/API/UI | PASS | Prisma validate, TypeScript, ESLint and production build pass |
| Full Forum migration runtime | PASS | Enum migration and full backfill applied; category/search/forum HTTP smoke tests return 200 |

## Guardrails đã xác nhận

- Có disclaimer độc lập với Lilith trên giao diện và tài liệu.
- Không có code gọi endpoint nội bộ/không công khai của Rise of Kingdoms.
- Không có bot hoặc automation điều khiển game.
- Dữ liệu hiển thị hiện tại được ghi rõ là dữ liệu mẫu.
- Hồ sơ và ingestion schema phân biệt `SELF_REPORTED`, `SCREENSHOT_VERIFIED`, `MODERATOR_VERIFIED`.
- Session JSON không chứa `googleSub`, Google access token, refresh token hoặc ID token.
