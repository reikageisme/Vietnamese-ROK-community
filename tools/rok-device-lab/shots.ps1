# KEEP THE UTF-8 BOM AT THE START OF THIS FILE.
# Windows PowerShell 5.1 reads .ps1 as ANSI unless the file starts with a UTF-8
# BOM. Without it every Vietnamese character turns to mojibake and the parser
# dies on the first accented word. Editors that strip the BOM break this file.

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

if (-not $env:ADB_PATH) {
    throw 'Chua co $env:ADB_PATH. Chay truoc: . .\tools\rok-device-lab\env.ps1'
}

New-Item -ItemType Directory -Force $OutDir | Out-Null

# $Matches do -match dat ra va chi chac chan con nguyen trong cung mot khoi.
# Tach Where-Object voi ForEach-Object thanh hai khoi la no khong chac con.
# Duyet bang foreach de khop va doc ket qua trong cung mot pham vi.
$serials = @()
foreach ($line in (& $env:ADB_PATH devices)) {
    if ($line -match '^(\S+)\s+device\s*$') {
        $serials += $Matches[1]
    }
}

if ($serials.Count -eq 0) {
    throw "Khong thay dien thoai nao. Mo app quan ly roi chay lai."
}

$index = 0
foreach ($serial in $serials) {
    $index += 1
    Write-Host ("[{0}/{1}] {2}" -f $index, $serials.Count, $serial)
    & $env:ADB_PATH -s $serial shell screencap -p /sdcard/rokshot.png | Out-Null
    & $env:ADB_PATH -s $serial pull /sdcard/rokshot.png (Join-Path $OutDir "$serial.png") | Out-Null
    & $env:ADB_PATH -s $serial shell rm -f /sdcard/rokshot.png | Out-Null
}

$full = (Resolve-Path $OutDir).Path
Write-Host ""
Write-Host ("Xong {0} may - {1}" -f $serials.Count, $full) -ForegroundColor Green
explorer $full
