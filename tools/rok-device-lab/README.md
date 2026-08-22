# RokViet Multi-Phone Scanner

Bản viết lại các workflow Kingdom, Alliance, Honor và Seed của RokTracker cho
điện thoại Android vật lý. Scanner dùng ADB serial thay vì một cổng giả lập, vì vậy nhiều điện thoại có
thể quét đồng thời mà không gửi nhầm thao tác hoặc ghi đè ảnh của nhau.

Đã kiểm thử thật trên 2 Samsung SM-A516B:

- tự mở `Individual Power Rankings` từ menu Rankings;
- mở từng governor, đọc ID, tên, liên minh, power, Kill Points và acclaim;
- đọc T1–T5 kills/KP, ranged, dead, gathered, assistance và helps;
- kiểm tra Kill Points bằng cả công thức tier kills và tổng tier KP;
- tự khôi phục total KP khi OCR total sai nhưng hai phép kiểm độc lập cùng khớp;
- tự cuộn, bỏ profile không mở được, chống governor trùng và lưu state sau từng người;
- resume sau khi dừng, xuất XLSX/CSV/JSONL và `scan.json` đúng Collector API;
- fleet worker nhiều serial; bài test 2 điện thoại/2 worker đã hoàn thành.
- CLI Alliance/Honor/Seed dùng chung ranking engine, giữ crop tên và nhúng ảnh
  đó vào Excel giống mục đích của RokTracker gốc.

Đây là scanner dữ liệu thống kê, không phải bot farm và không có cơ chế né phát
hiện. Guard dừng thao tác nếu app/màn hình không đúng profile đã hiệu chỉnh.

## 1. Cài trên Windows 11

Yêu cầu Python 3.11+, ADB và Tesseract OCR:

```powershell
winget install --id UB-Mannheim.TesseractOCR --exact
```

Tại repository:

```powershell
cd "D:\ROK Forum"
py -3.11 -m venv tools\rok-device-lab\.venv
tools\rok-device-lab\.venv\Scripts\python.exe -m pip install -e tools\rok-device-lab
```

Nếu `py -3.11` không tìm thấy Python, thay bằng đường dẫn đầy đủ tới
`python.exe`. Đặt biến môi trường cho cửa sổ PowerShell hiện tại:

```powershell
$env:ADB_PATH = "D:\Program Files (x86)\xiaowei_android\tools\adb.exe"
$env:TESSERACT_PATH = "C:\Program Files\Tesseract-OCR\tesseract.exe"
$env:TESSDATA_DIR = "D:\ROK Forum\RoK Tracker\deps\tessdata"
$rok = "tools\rok-device-lab\.venv\Scripts\python.exe"
```

`TESSDATA_DIR` cần `eng.traineddata`; nên thêm `vie.traineddata` và
`kor.traineddata` để đọc tên Việt/Hàn.

## 2. Kiểm tra thiết bị

Bật USB debugging, chấp nhận RSA trên từng máy, rồi chạy:

```powershell
& $rok -m rok_lab.cli doctor
& $rok -m rok_lab.cli devices
& $rok -m rok_lab.cli snapshot
```

Để các điện thoại ở menu `RANKINGS` và chạy probe read-only:

```powershell
& $rok -m rok_lab.cli fleet-probe
```

Kết quả hợp lệ có `gamePackageMatched: true`, `screenMatched: true` và độ phân
giải 1920×1080. Profile hiện tại nằm trong
`profiles/rok-a51-1920x1080.json` và dùng tọa độ chuẩn hóa, không phụ thuộc pixel
cố định của một cửa sổ emulator.

## 3. Quét đầy đủ một điện thoại

Điện thoại có thể ở menu `RANKINGS` hoặc trang `INDIVIDUAL POWER RANKINGS`:

```powershell
& $rok -m rok_lab.cli kingdom-scan 520007cc4bef354d `
  --kingdom 2812 `
  --amount 300 `
  --name nightly-2812 `
  --formats xlsx,csv,jsonl `
  --evidence review `
  --confirm
```

Các chế độ ảnh:

- `--evidence all`: giữ ba ảnh và crop OCR của mọi governor;
- `--evidence review`: chỉ giữ ảnh bản ghi cần xem lại, phù hợp vận hành dài;
- `--evidence none`: không giữ ảnh governor sau khi OCR, tiết kiệm ổ đĩa.

Scanner in tiến độ ra terminal. Nhấn `Ctrl+C` để dừng; state đã hoàn thành gần
nhất nằm trong thư mục scan. Resume bằng chính thư mục đó:

```powershell
& $rok -m rok_lab.cli kingdom-scan 520007cc4bef354d `
  --kingdom 2812 `
  --amount 300 `
  --resume "D:\...\artifacts\scans\520007...\nightly-2812-kd2812-..." `
  --confirm
```

Mỗi scan tạo:

```text
artifacts/scans/<serial>/<scan-name>-kd<kingdom>-<timestamp>/
  state.json
  scan.json
  governors.xlsx
  governors.csv
  governors.jsonl
  ranking-pages/
  evidence/                 # tùy --evidence
```

`state.json` giữ toàn bộ OCR raw, trạng thái validation và `needsReview`.
`scan.json` dùng BigInt dạng chuỗi và có thể gửi thẳng lên Collector API.

## 4. Quét Alliance, Honor và Seed

Mở đúng bảng xếp hạng cần đọc và kéo về đầu danh sách. Ví dụ Seed:

```powershell
& $rok -m rok_lab.cli ranking-scan 520007cc4bef354d seed `
  --amount 300 `
  --name KD2812-seed `
  --evidence all `
  --confirm
```

Thay `seed` bằng `alliance` hoặc `honor`. Scanner đọc 6 dòng/màn cho
Alliance/Seed, 5 dòng/màn cho Honor, tự cuộn, dừng khi gặp dòng trống/trùng và
xuất `ranking.xlsx`, `ranking.csv`, `ranking.jsonl`, `ranking.json`. Hai cột tên
và điểm được OCR riêng; số tăng bất thường không bị sửa âm thầm mà được đánh
dấu `needsReview`.

Profile mới lấy vùng tham chiếu từ RokTracker 1600×900 và chuẩn hóa sang tỷ lệ.
Trước lần quét dài, chạy thử `--amount 6` trên từng loại màn A51 để kiểm tra crop
vì giao diện game Việt có thể thay đổi sau cập nhật.

## 5. Quét nhiều điện thoại

Sao chép hai file mẫu:

```powershell
Copy-Item tools\rok-device-lab\config\devices.example.json `
  tools\rok-device-lab\config\devices.local.json
Copy-Item tools\rok-device-lab\config\fleet.example.json `
  tools\rok-device-lab\config\fleet.local.json
```

Điền alias/serial và kingdom thật. Ví dụ fleet job:

```json
{
  "jobId": "nightly-kvk",
  "workers": 2,
  "defaults": {
    "amount": 300,
    "formats": ["xlsx", "csv", "jsonl"],
    "evidence": "review"
  },
  "devices": [
    {"device": "phone01", "kingdom": 2812},
    {"device": "phone02", "kingdom": 3104}
  ]
}
```

Chạy:

```powershell
& $rok -m rok_lab.cli fleet-scan `
  tools\rok-device-lab\config\fleet.local.json `
  --workers 2 `
  --confirm
```

Alliance/Honor/Seed dùng file `config/fleet-ranking.example.json`:

```powershell
Copy-Item tools\rok-device-lab\config\fleet-ranking.example.json `
  tools\rok-device-lab\config\fleet-ranking.local.json
& $rok -m rok_lab.cli fleet-ranking-scan `
  tools\rok-device-lab\config\fleet-ranking.local.json `
  --workers 2 `
  --confirm
```

Không đặt 18 worker ngay lập tức. Với Windows test dùng 2 worker; VM/LXC vận hành
bắt đầu 2–4 worker rồi tăng theo CPU/RAM/USB stability. Mỗi serial có lock riêng,
nên một máy không thể nhận hai job cùng lúc.

## 6. Gửi lên RokViet Hub

```powershell
$env:ROK_COLLECTOR_URL = "http://127.0.0.1:3031"
$env:ROK_COLLECTOR_TOKEN = "token-rieng-khong-commit"
& $rok -m rok_lab.cli upload-scan "D:\...\scan.json"
```

Collector chỉ phục vụ trên Ops surface, chống trùng bằng `externalId` và đưa dữ
liệu vào `PENDING_REVIEW` trước khi public. Máy agent ở xa phải đi qua
Tailscale/SSH tunnel; không trỏ vào domain diễn đàn công khai.

## 7. Đưa lên Proxmox cho 18 điện thoại

Một collector VM/LXC nhận USB passthrough cho cả hub và chạy pool worker chung;
không cần 18 VM:

```text
18 điện thoại -> ADB inventory -> queue theo serial -> 2–4 scanner worker
-> validation/review -> Collector API -> PostgreSQL + MinIO -> website
```

Trên Ubuntu cài `adb`, `tesseract-ocr`, `tesseract-ocr-eng`,
`tesseract-ocr-vie`, `tesseract-ocr-kor`; đặt `ADB_PATH=/usr/bin/adb`. PostgreSQL
chỉ lưu dữ liệu chuẩn hóa; ảnh bằng chứng đưa lên MinIO theo retention.

## 8. Kiểm tra source

```powershell
& $rok -m unittest discover -s tools\rok-device-lab\tests -v
```

Không commit `devices.local.json`, `fleet.local.json`, token, Wi-Fi/proxy hoặc thư
mục `artifacts/`.

Kết quả rà soát đầy đủ 74 file RokTracker nằm tại
`ROKTRACKER_FILE_AUDIT.md`; thông báo giấy phép ở `THIRD_PARTY_NOTICES.md`.
