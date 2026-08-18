# RokViet Device Lab

USB-first scanner dành cho điện thoại Android vật lý. Mọi lệnh đều định danh bằng
ADB serial, mỗi máy có lock riêng và mỗi lần chạy có thư mục ảnh/JSON/CSV riêng.
Thiết kế này thay lớp ADB một-port và thư mục ảnh dùng chung của RokTracker cũ.

Mốc hiện tại đã được thử thật với 2 Samsung SM-A516B:

- phát hiện song song nhiều thiết bị;
- xác minh đúng app ROK và đúng màn Rankings trước khi chạm;
- mở `Individual Power` bằng đúng một thao tác có `--confirm`;
- OCR 6 hàng đang nhìn thấy thành JSON và CSV, giữ ảnh gốc/ảnh crop/chuỗi OCR;
- khóa một worker trên một serial để các job không giẫm dữ liệu nhau.

Đây là scanner thống kê cộng đồng, không phải bot farm tài nguyên và không có cơ
chế né phát hiện. Bản hiện tại chưa tự cuộn/quét toàn bộ kingdom; cần hiệu chỉnh
thêm profile governor trước khi bật vòng lặp dài.

## 1. Cài trên Windows 11

Yêu cầu Python 3.11+, ADB và Tesseract OCR. Nếu đang dùng box XiaoWei, có thể trỏ
thẳng đến ADB đi kèm phần mềm. Tesseract có thể cài bằng:

```powershell
winget install --id UB-Mannheim.TesseractOCR --exact
```

Tại thư mục repository:

```powershell
cd "D:\ROK Forum"
py -3.11 -m venv tools\rok-device-lab\.venv
tools\rok-device-lab\.venv\Scripts\python.exe -m pip install -e tools\rok-device-lab
```

Nếu `py -3.11` không thấy Python nhưng máy có Python riêng, thay phần đầu bằng
đường dẫn tới `python.exe` đó.

Đặt đường dẫn một lần cho cửa sổ PowerShell hiện tại:

```powershell
$env:ADB_PATH = "D:\Program Files (x86)\xiaowei_android\tools\adb.exe"
$env:TESSERACT_PATH = "C:\Program Files\Tesseract-OCR\tesseract.exe"
$env:TESSDATA_DIR = "D:\ROK Forum\RoK Tracker\deps\tessdata"
$rok = "tools\rok-device-lab\.venv\Scripts\python.exe"
```

`TESSDATA_DIR` nên chứa `eng.traineddata`; thêm `vie.traineddata` và
`kor.traineddata` để đọc tốt tên Việt/Hàn. Khi không đặt biến này, công cụ tìm
tessdata bên cạnh Tesseract và chỉ dùng các ngôn ngữ thực sự có mặt.

## 2. Kiểm tra 2 máy mà không chạm game

```powershell
& $rok -m rok_lab.cli doctor
& $rok -m rok_lab.cli devices
& $rok -m rok_lab.cli snapshot
& $rok -m rok_lab.cli fleet-probe
```

`fleet-probe` chạy song song tối đa 4 worker nhưng chỉ chụp màn hình. Kết quả hợp
lệ phải có `gamePackageMatched: true`, `screenMatched: true` và đúng độ phân giải.

Muốn dùng alias, sao chép file mẫu rồi điền serial thật:

```powershell
Copy-Item tools\rok-device-lab\config\devices.example.json `
  tools\rok-device-lab\config\devices.local.json
```

File `.local` và toàn bộ `artifacts/` không được commit lên Git.

## 3. Smoke test một máy

Để điện thoại ở menu `RANKINGS`, rồi chạy probe read-only:

```powershell
& $rok -m rok_lab.cli rankings-probe 520007cc4bef354d
```

Sau khi nhìn đúng serial, cho phép đúng một chạm mở bảng Individual Power:

```powershell
& $rok -m rok_lab.cli rankings-open 520007cc4bef354d `
  individual-power --confirm
```

Đọc 6 hàng đang hiển thị, không chạm hoặc cuộn:

```powershell
& $rok -m rok_lab.cli rankings-read 520007cc4bef354d
```

Mỗi lệnh tạo một run tại:

```text
artifacts/runs/<serial>/<timestamp>-<operation>/
```

Run OCR gồm `manifest.json`, `screen.png`, ảnh crop từng hàng,
`governors.json` và `governors.csv`. Trường `needsReview` đánh dấu hàng OCR chưa
đọc được tên hoặc power; `ocrRaw` giữ nguyên chuỗi để đối chiếu.

## 4. Đưa dữ liệu lên RokViet Hub

Khi batch đã đúng schema collector:

```powershell
$env:ROK_COLLECTOR_URL = "https://rokforum.example.vn"
$env:ROK_COLLECTOR_TOKEN = "token-rieng-khong-commit"
& $rok -m rok_lab.cli upload-scan C:\duong-dan\scan.json
```

Server chống gửi trùng bằng `externalId` và giữ batch ở trạng thái chờ duyệt.

## 5. Mở rộng 18 điện thoại

Không tạo 18 VM. Một Linux collector VM/LXC quản lý USB passthrough và chạy pool
worker giới hạn (khởi đầu 2–4 worker). Hàng đợi phân job theo serial; lock trong
Device Lab bảo đảm một điện thoại chỉ có một job. Ảnh được ghi tạm theo run, upload
lên object storage rồi mới xóa theo retention. PostgreSQL chỉ lưu dữ liệu chuẩn
hóa và provenance, không nhét ảnh trực tiếp vào DB.

```text
18 điện thoại -> ADB inventory -> queue theo serial -> 2-4 scanner worker
-> OCR -> review/validation -> Collector API -> PostgreSQL + MinIO -> website
```

Trên Ubuntu/Proxmox, cài `adb`, `tesseract-ocr`, `tesseract-ocr-eng`,
`tesseract-ocr-vie`, `tesseract-ocr-kor`; đặt `ADB_PATH=/usr/bin/adb`. Source và
profile vẫn dùng nguyên vì tọa độ được chuẩn hóa theo kích thước ảnh.

## 6. Kiểm tra source

```powershell
& $rok -m unittest discover -s tools\rok-device-lab\tests -v
```

Nguyên tắc vận hành: không gửi lệnh khi máy `unauthorized/offline`, không dùng tọa
độ nếu guard màn hình thất bại, không lưu Wi-Fi/proxy/token vào repo, và luôn giữ
ảnh bằng chứng cùng serial/thời gian quét.
