# Chạy tool quét trên VM 200 → đẩy dữ liệu vào ROK FAQ

VM 200 (Windows 10 Pro) đang có sẵn app quản lý điện thoại, chưa có tool. Dưới
đây là toàn bộ đường đi, từ máy trắng tới dữ liệu nằm trong Postgres ở CT 102.

**Dữ liệu KHÔNG đi thẳng vào Postgres.** Nó đi qua Collector API trên Ops
surface, và nằm ở trạng thái `PENDING_REVIEW` cho tới khi có người duyệt:

```
điện thoại 09 → tool quét → scan.json → Collector API (ops-web :3031)
              → Postgres ở CT 102 → chờ duyệt → mới lên web
```

Nối thẳng tool vào Postgres sẽ bỏ qua chống trùng theo `externalId`, bỏ qua
bước duyệt, và mở cổng 5432 cho một máy Windows chạy OCR. Đừng làm.

---

## 1. Cài trên VM 200 (làm một lần)

```powershell
winget install --id Python.Python.3.11 --exact
winget install --id UB-Mannheim.TesseractOCR --exact
winget install --id Git.Git --exact
```

Lấy repo về (dùng chính tài khoản GitHub của dự án):

```powershell
cd D:\
git clone https://github.com/reikageisme/Vietnamese-ROK-community.git "ROK Forum"
```

Dựng môi trường Python riêng cho tool:

```powershell
cd "D:\ROK Forum"
py -3.11 -m venv tools\rok-device-lab\.venv
tools\rok-device-lab\.venv\Scripts\python.exe -m pip install -e tools\rok-device-lab
```

## 2. Biến môi trường (mỗi lần mở PowerShell mới)

```powershell
cd "D:\ROK Forum"
$env:ADB_PATH        = "D:\Program Files (x86)\xiaowei_android\tools\adb.exe"
$env:TESSERACT_PATH  = "C:\Program Files\Tesseract-OCR\tesseract.exe"
$env:TESSDATA_DIR    = "D:\ROK Forum\RoK Tracker\deps\tessdata"
$rok = "tools\rok-device-lab\.venv\Scripts\python.exe"
```

`ADB_PATH` phải trỏ tới đúng `adb.exe` mà app quản lý điện thoại đang dùng.
Dùng một bản adb khác sẽ giết adb server của app đó và rớt hết kết nối.

Kiểm tra:

```powershell
& $rok -m rok_lab.cli doctor
```

## 3. Tìm đúng serial của điện thoại số 9

```powershell
& $rok -m rok_lab.cli devices
```

Cả 16 máy cùng model nên adb chỉ trả về danh sách serial, không nói máy nào là
máy số mấy. Cách chắc chắn nhất là bắt từng máy tự khai:

```powershell
# Thay <serial> lần lượt, xem màn hình máy nào sáng/tắt theo lệnh
& "$env:ADB_PATH" -s <serial> shell input keyevent 26
```

Máy nào phản ứng thì đó là serial cần tìm. Ghi lại ngay, đừng dò lại lần sau:

```powershell
Copy-Item tools\rok-device-lab\config\devices.example.json `
          tools\rok-device-lab\config\devices.local.json
notepad tools\rok-device-lab\config\devices.local.json
```

Đặt alias `phone09` cho serial vừa tìm được. File `*.local.json` nằm ngoài git.

## 4. Bắt buộc: quét thử 6 người trước

Mở game trên máy 09, vào `RANKINGS` → `Individual Power Rankings`, kéo lên đầu
danh sách. Rồi:

```powershell
& $rok -m rok_lab.cli fleet-probe
```

Cần thấy `gamePackageMatched: true`, `screenMatched: true`, độ phân giải
1920×1080. Sai một trong ba thì dừng — profile chưa khớp máy này, quét tiếp chỉ
ra dữ liệu rác.

```powershell
& $rok -m rok_lab.cli kingdom-scan <serial> `
  --kingdom 2812 `
  --amount 6 `
  --name thu-nghiem `
  --formats xlsx `
  --evidence all `
  --confirm
```

Mở `governors.xlsx` trong thư mục scan, đối chiếu 6 dòng đó với chính màn hình
game. **Giao diện game tiếng Việt đổi sau mỗi bản cập nhật**, nên bước này không
bỏ được — sai crop thì 300 dòng sau đều sai theo cùng một kiểu, và một con số
sai trông y hệt một con số đúng.

## 5. Quét thật

```powershell
& $rok -m rok_lab.cli kingdom-scan <serial> `
  --kingdom 2812 `
  --amount 300 `
  --name kd2812-lan1 `
  --formats xlsx,csv,jsonl `
  --evidence review `
  --confirm
```

`Ctrl+C` để dừng. Chạy lại với `--resume "<đường dẫn thư mục scan>"` là đi tiếp
từ người cuối cùng đã xong, không quét lại từ đầu.

Kết quả nằm ở:

```
tools\rok-device-lab\artifacts\scans\<serial>\kd2812-lan1-kd2812-<timestamp>\
  scan.json          ← file để đẩy lên
  governors.xlsx
  state.json         ← OCR thô + cờ needsReview
```

## 6. Mở đường tới Collector

Ops surface chỉ nghe trên `127.0.0.1:3031` của máy chủ web, cố ý không mở ra
mạng. Từ VM 200 mở tunnel qua Tailscale, để nguyên cửa sổ này:

```powershell
ssh -N -L 3031:127.0.0.1:3031 root@100.113.111.64
```

Cửa sổ PowerShell khác:

```powershell
$env:ROK_COLLECTOR_URL   = "http://127.0.0.1:3031"
$env:ROK_COLLECTOR_TOKEN = "<COLLECTOR_API_TOKEN trong .env.production trên server>"
& $rok -m rok_lab.cli upload-scan "D:\ROK Forum\tools\rok-device-lab\artifacts\scans\...\scan.json"
```

Lấy token trên server:

```bash
grep COLLECTOR_API_TOKEN ~/Vietnamese-ROK-community/.env.production
```

Token đó là chìa khoá ghi dữ liệu. Đừng dán vào chat, đừng commit, đừng đặt
trong file `.ps1` nằm trong repo.

## 7. Kiểm tra dữ liệu đã vào

Trên server:

```bash
cd ~/Vietnamese-ROK-community
docker compose --env-file .env.production -f docker-compose.yml -f compose.production.yml \
  -f compose.external-db.yml logs --tail 40 ops-web
```

Rồi mở Ops surface qua tunnel (`http://127.0.0.1:3031`) để duyệt lô vừa lên.
Trước khi duyệt, dữ liệu không xuất hiện ở đâu trên trang công khai.

---

## Khi hỏng

| Triệu chứng | Nguyên nhân thường gặp |
|---|---|
| `devices` trả về rỗng | app quản lý điện thoại đang giữ adb server; đóng app rồi chạy lại, hoặc trỏ `ADB_PATH` đúng bản adb của app |
| `screenMatched: false` | máy không ở đúng màn hình, hoặc game vừa cập nhật đổi giao diện |
| Tên tiếng Việt ra ký tự lạ | thiếu `vie.traineddata` trong `TESSDATA_DIR` |
| `upload-scan` báo 401 | sai token hoặc tunnel chưa mở |
| `upload-scan` báo trùng | lô này đã lên rồi — chống trùng theo `externalId`, không phải lỗi |

## Nhắc về phạm vi

Đây là tool đọc số liệu thống kê công khai trong game. Không phải bot farm,
không có cơ chế né phát hiện, và có guard tự dừng khi màn hình không khớp
profile. Giữ nguyên như vậy.
