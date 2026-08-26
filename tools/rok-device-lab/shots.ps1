# Chụp màn hình mọi điện thoại đang nối, mỗi ảnh đặt tên theo serial.
#
#     . .\tools\rok-device-lab\env.ps1
#     .\tools\rok-device-lab\shots.ps1
#
# Dùng để tìm serial của một máy cụ thể: mở app quản lý xem máy số N đang hiện
# gì, rồi tìm ảnh khớp — tên file chính là serial.
#
# Cột TRANSPORT trong `cli devices` KHÔNG phải số máy trong app quản lý. Đó là
# id do adb cấp theo thứ tự kết nối và đổi mỗi lần rút/cắm. Đối chiếu bằng ảnh
# là cách duy nhất chắc chắn.

param([string]$OutDir = "$PSScriptRoot\..\..\artifacts\device-shots")

$ErrorActionPreference = "Stop"
if (-not $env:ADB_PATH) { throw "Chưa có `$env:ADB_PATH. Chạy `. .\tools\rok-device-lab\env.ps1` trước." }

New-Item -ItemType Directory -Force $OutDir | Out-Null
$serials = (& $env:ADB_PATH devices) |
    Where-Object { $_ -match '^(\S+)\s+device\s*$' } |
    ForEach-Object { $Matches[1] }

if (-not $serials) { throw "Không thấy điện thoại nào. Mở app quản lý rồi chạy lại." }

$index = 0
foreach ($serial in $serials) {
    $index += 1
    Write-Host ("[{0}/{1}] {2}" -f $index, $serials.Count, $serial)
    & $env:ADB_PATH -s $serial shell screencap -p /sdcard/rokshot.png | Out-Null
    & $env:ADB_PATH -s $serial pull /sdcard/rokshot.png (Join-Path $OutDir "$serial.png") | Out-Null
    & $env:ADB_PATH -s $serial shell rm -f /sdcard/rokshot.png | Out-Null
}

Write-Host ""
Write-Host ("Xong {0} máy · {1}" -f $serials.Count, (Resolve-Path $OutDir).Path) -ForegroundColor Green
explorer (Resolve-Path $OutDir).Path
