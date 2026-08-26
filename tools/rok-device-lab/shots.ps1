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
$raw = & $env:ADB_PATH devices 2>&1

$serials = @()
foreach ($line in $raw) {
    if ($line -match '^(\S+)\s+device\s*$') {
        $serials += $Matches[1]
    }
}

if ($serials.Count -eq 0) {
    # In nguyen van adb da tra ve. Bao "khong thay may nao" roi vut mat bang
    # chung la kieu loi te nhat: co the adb chay dung ma regex sai, co the adb
    # noi vao mot server khac, co the may dang o trang thai unauthorized. Ba
    # nguyen nhan do can ba cach sua khac han nhau.
    Write-Host ""
    Write-Host "adb tra ve:" -ForegroundColor Yellow
    foreach ($line in $raw) { Write-Host ("  |" + $line) }
    Write-Host ""
    Write-Host "Doc dong tren de biet di tiep the nao:" -ForegroundColor Yellow
    Write-Host "  - trong ron        : adb khong noi duoc toi may nao. Mo app quan ly len."
    Write-Host "  - 'unauthorized'   : mo khoa dien thoai va bam Cho phep USB debugging."
    Write-Host "  - 'offline'        : rut cam lai may do."
    Write-Host "  - 'daemon starting': adb vua khoi dong server rieng, chay lai lenh nay."
    Write-Host "  - co may nhung script van khong thay: bao lai, regex sai."
    throw "Khong tach duoc serial nao tu ket qua adb devices."
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
