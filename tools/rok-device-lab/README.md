# RokViet Device Lab

Bộ điều khiển thử nghiệm cho 2 điện thoại Android vật lý. Công cụ bắt buộc định
danh thiết bị bằng ADB serial để tránh gửi thao tác nhầm máy, chạy trực tiếp trên
Windows 11 và giữ tương thích với Ubuntu/Proxmox về sau.

Đây là lớp mới nằm cạnh bản `RoK Tracker` đóng gói. Hai file Scanner cũ chỉ hỗ trợ
BlueStacks/LDPlayer, một ADB port và tọa độ giao diện cố định; không nên dùng trực
tiếp để điều khiển nhiều điện thoại vật lý.

## Chuẩn bị Windows 11

- Python 3.11 trở lên. Bản Scanner `.exe` có runtime nội bộ nhưng không cung cấp
  một Python interpreter dùng để phát triển, vì vậy vẫn cần cài Python riêng.
- Bật Developer options và USB debugging trên từng điện thoại.
- Chấp nhận RSA prompt trên từng điện thoại.
- ADB được tự tìm trong `RoK Tracker/deps/platform-tools`.
- Cài scrcpy riêng nếu muốn mở màn hình trực tiếp, rồi thêm vào `PATH` hoặc đặt
  biến `SCRCPY_PATH`.

Có thể cài hai thành phần còn thiếu bằng Windows Package Manager:

```powershell
winget install --id Python.Python.3.12 --exact
winget install --id Genymobile.scrcpy --exact
```

Mở cửa sổ PowerShell mới sau khi cài để `PATH` được cập nhật.

Không cần `pip install` để chạy các lệnh cơ bản:

```powershell
cd "D:\ROK Forum\tools\rok-device-lab"
py -3.11 -m rok_lab doctor
py -3.11 -m rok_lab devices
py -3.11 -m rok_lab snapshot
```

Nếu `py -3.11` báo `No suitable Python runtime found`, cài Python 3.11/3.12 từ
python.org, chọn `Add Python to PATH`, rồi chạy lại. Khi bản thử nghiệm ổn định,
Device Lab có thể được đóng thành `.exe` để máy vận hành không cần cài Python.

Sau khi `adb devices -l` hiện hai serial ở trạng thái `device`, sao chép
`config/devices.example.json` thành `config/devices.local.json` rồi điền hai
alias. File `.local` đã được gitignore:

```powershell
Copy-Item config\devices.example.json config\devices.local.json
```

```json
{
  "devices": {
    "phone01": "R58M111111A",
    "phone02": "R58M222222B"
  }
}
```

## Kiểm thử từng thiết bị

```powershell
py -3.11 -m rok_lab inspect phone01
py -3.11 -m rok_lab screenshot phone01
py -3.11 -m rok_lab wifi-status phone01
py -3.11 -m rok_lab wifi-open phone01
py -3.11 -m rok_lab ui-dump phone01
py -3.11 -m rok_lab live phone01
```

`snapshot` đọc hai điện thoại bằng hai worker song song và ghi
`artifacts/device-snapshot.json`. Đây là bài test đầu tiên để xác nhận cơ chế tách
worker trước khi nối OCR và database.

Khi scanner đã tạo JSON đúng schema, gửi batch lên website bằng token riêng:

```powershell
$env:ROK_COLLECTOR_URL = "https://forum.example.vn"
$env:ROK_COLLECTOR_TOKEN = "token-dai-trung-khop-voi-host"
py -3.11 -m rok_lab upload-scan artifacts\scan-kd2812.json
```

Token chỉ nằm trong biến môi trường của collector, không ghi vào JSON hoặc commit
lên Git. Server chống gửi trùng bằng `externalId` và đưa batch vào hàng chờ duyệt.

`ui-dump` dùng để thu cây giao diện Wi-Fi thật của model/ROM. Chỉ sau khi có dữ
liệu này mới thêm automation nhập SSID/mật khẩu bằng selector; không dùng tọa độ
cố định của emulator cũ.

Lệnh chạm tọa độ chỉ dành cho kiểm thử thủ công có quan sát:

```powershell
py -3.11 -m rok_lab tap phone01 500 900
```

## Nguyên tắc an toàn

- Không chạy thao tác ghi nếu thiết bị không ở trạng thái `device`.
- Mọi lệnh điều khiển đều thêm `adb -s <serial>`.
- Dừng automation nếu phát hiện hai thiết bị trùng serial.
- Không lưu mật khẩu Wi-Fi/proxy trong repository hoặc log.
- Chụp màn hình và xác nhận trạng thái trước khi tự động chạm.

## Kiểm tra source

```powershell
cd "D:\ROK Forum\tools\rok-device-lab"
py -3.11 -m unittest discover -s tests -v
```

## Đưa sang Proxmox sau này

Source không phụ thuộc PowerShell hay đường dẫn Windows. Trên Ubuntu Collector VM,
đặt `ADB_PATH=/usr/bin/adb`, cấp USB passthrough và chạy cùng các lệnh trên. Bước
OCR/worker/API sẽ được thêm sau khi xác nhận model, độ phân giải và UI của hai máy
thật.
