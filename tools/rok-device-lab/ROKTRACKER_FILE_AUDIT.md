# Đối chiếu toàn bộ RokTracker 6.0.0

Ngày rà soát: 18/08/2026. Nguồn được rà soát có 74 file: 32 module Python
(4.915 dòng), 16 file cấu hình/schema, 8 script thao tác, 10 ảnh tài liệu và
8 file gốc/phụ thuộc/tài liệu. Giấy phép MIT đã được giữ trong
`THIRD_PARTY_NOTICES.md`.

## Kết luận kiến trúc

RokTracker gốc có hai engine, không phải bốn engine riêng:

- `KingdomScanner`: mở từng Governor Profile và đọc ba trang General, Kill
  Statistics, More Info.
- `RankingScanner`: dùng lại một vòng lặp OCR + cuộn cho Alliance, Honor và
  Seed; khác nhau ở số dòng, vùng OCR, ngưỡng ảnh và cử chỉ cuộn.

Bản RokViet viết lại giữ hai engine đó nhưng thay kết nối emulator bằng ADB
`-s <serial>`, khóa từng serial, tọa độ chuẩn hóa và worker pool. CLI được chọn
thay cho phần GUI vì mục tiêu là 2 rồi 18 điện thoại; web vận hành sẽ là lớp UI
sau khi collector ổn định.

## Ma trận tính năng

| RokTracker gốc | File nguồn đã đọc | RokViet Device Lab |
|---|---|---|
| Kingdom General | `kingdom/scanner.py`, `config/internal/kingdom.json` | `kingdom_scanner.py`: ID, tên, alliance, power, KP, acclaim |
| Kill Statistics | cùng file trên, `governor_data.py` | T1–T5 kills, T1–T5 KP, ranged; kiểm tra và tái dựng |
| More Info | cùng file trên | dead, gathered, assistance, helps |
| Resume/lưu liên tục | `governor_data_handler.py` | `state.json` sau từng governor, `--resume` |
| Sai kills/inactive | `governor_data.py`, `_save_failed()` | review flag + evidence, guard không ghi dữ liệu đoán |
| Alliance ranking | `ranking/scanner.py`, `internal/alliance.json` | `ranking-scan alliance` |
| Honor ranking | `ranking/scanner.py`, `internal/honor.json` | `ranking-scan honor` |
| Seed ranking | `ranking/scanner.py`, `internal/seed.json` | `ranking-scan seed` |
| Ảnh tên trong Excel | `ranking_data_handler.py` | evidence crop được nhúng vào XLSX |
| CSV/JSONL/XLSX | hai data handler | hai exporter độc lập, thêm JSON chuẩn hóa |
| GUI desktop | `ui/*.py`, `scanner_ui.py` | chưa sao chép; CLI/fleet phù hợp server và web ops |
| Bluestacks/LD | `utils/adb.py`, input scripts | điện thoại thật, serial riêng, swipe chuẩn hóa |

## Kiểm kê source

- `common/`: cấu hình Pydantic, thời gian/ETA, lựa chọn output.
- `kingdom/`: config, options, 22 trường GovernorData, validation KP, handler,
  Rich printer và vòng quét 791 dòng.
- `ranking/`: cấu hình dùng chung, model Name/Score/Image, duplicate detection,
  exporter nhúng ảnh và vòng quét Alliance/Honor/Seed.
- `ui/`: checkbox, options, status, theme, dialog, hai tab scanner và hàm đổi
  model thành widget. Đây là presentation layer, không chứa dữ liệu game mới.
- `utils/`: ADB emulator, OCR OpenCV/Tesseract, validate installation/name,
  exception/logging và helper ảnh/thời gian.
- entry points: `scanner_console.py`, `scanner_ui.py`, `dummy_root.py`.

## Kiểm kê cấu hình và tài nguyên

- Đã đọc toàn bộ `config/*.json`, `config/internal/*.json` và 5 JSON Schema.
- 8 input script chỉ mô tả cử chỉ cuộn cho Bluestacks/LD; bản mới thay bằng
  `adb shell input swipe` theo tỷ lệ màn hình.
- 10 PNG chỉ là ảnh README/giao diện/cấu hình emulator; không chứa logic OCR.
- `README.md`, `LICENSE`, `pyproject.toml`, `uv.lock` và metadata đóng gói đã
  được đối chiếu. `uv.lock` là khóa phụ thuộc sinh tự động, không có workflow.

## Khác biệt có chủ đích

- Không dùng random tap, ADB server riêng hay hành vi né phát hiện của bản gốc.
- Không sửa số OCR sai thành số trước đó; giữ giá trị thô và đánh dấu review.
- Không điều khiển hai điện thoại bằng một tọa độ chung: mọi thao tác bắt buộc
  gắn serial và mỗi serial có lock.
- Alliance/Honor/Seed mới đã hoàn thành ở mức code và test offline; cần chụp
  từng màn thật trên A51 để hiệu chỉnh vùng nếu bản game Việt lệch giao diện.
