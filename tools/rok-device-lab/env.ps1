# KEEP THE UTF-8 BOM AT THE START OF THIS FILE.
# Windows PowerShell 5.1 reads .ps1 as ANSI unless the file starts with a UTF-8
# BOM. Without it every Vietnamese character turns to mojibake and the parser
# dies on the first accented word. Editors that strip the BOM break this file.
# Nạp biến môi trường cho tool quét. Dùng bằng cách CHẤM rồi cách rồi đường dẫn:
#
#     . .\tools\rok-device-lab\env.ps1
#
# Dấu chấm đầu dòng là bắt buộc — không có nó thì script chạy trong phạm vi
# riêng rồi biến mất, và cửa sổ của bạn vẫn trắng như cũ.
#
# Biến `$env:` chỉ sống trong đúng cửa sổ PowerShell đã set. Mở cửa sổ mới là
# mất sạch. File này tồn tại để khỏi phải nhớ và khỏi gõ lại năm dòng mỗi lần.

$ErrorActionPreference = "Stop"

# Console Windows mac dinh khong ve duoc ky tu ngoai bang ma cua no: ten nguoi
# choi ROK day chu Han, Cyrillic va chi so tren, nen chung hien ra o vuong.
# Do la loi HIEN THI, khong phai loi OCR — chuoi ghi vao xlsx van nguyen. Bat
# UTF-8 de khoi nhin nham mot ban quet tot thanh mot ban quet hong.
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }

# Thư mục repo suy ra từ vị trí chính file này, không hard-code ổ đĩa —
# máy chính để ở D:, VM 200 để ở C:.
# Ten bien PowerShell KHONG phan biet hoa thuong: $ROK va $rok la CUNG MOT
# bien. Ban dau bien repo ten $ROK con duong dan python ten $rok, nen dong gan
# python de len duong dan repo va Set-Location cd thang vao file python.exe.
$script:LabDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$global:RokRepo = (Resolve-Path (Join-Path $script:LabDir "..\..")).Path

function Find-First([string[]]$Candidates) {
    foreach ($path in $Candidates) {
        if ($path -and (Test-Path $path)) { return (Resolve-Path $path).Path }
    }
    return $null
}

$adb = Find-First @(
    $env:ADB_PATH,
    "C:\Program Files (x86)\xiaowei_android\tools\adb.exe",
    "D:\Program Files (x86)\xiaowei_android\tools\adb.exe"
)
if (-not $adb) {
    # Tìm chậm, chỉ chạy khi mọi đường dẫn quen đều trượt.
    Write-Host "Đang dò adb.exe trên ổ C: ..." -ForegroundColor DarkGray
    $found = Get-ChildItem C:\ -Filter adb.exe -Recurse -ErrorAction SilentlyContinue |
             Select-Object -First 1
    if ($found) { $adb = $found.FullName }
}

$tesseract = Find-First @(
    $env:TESSERACT_PATH,
    "C:\Program Files\Tesseract-OCR\tesseract.exe",
    "C:\Program Files (x86)\Tesseract-OCR\tesseract.exe"
)

$tessdata = $null
if ($tesseract) {
    $tessdata = Find-First @(
        $env:TESSDATA_DIR,
        (Join-Path (Split-Path -Parent $tesseract) "tessdata")
    )
}

if ($adb)       { $env:ADB_PATH = $adb }
if ($tesseract) { $env:TESSERACT_PATH = $tesseract }
if ($tessdata)  { $env:TESSDATA_DIR = $tessdata }

# App quan ly dien thoai chay adb server rieng, va KHONG phai luc nao cung o
# cong mac dinh 5037. Chay `adb devices` khong khai cong se dung mot server khac
# rong khong, roi bao "khong thay may nao" — trong khi app van hien du 16 may.
#
# Khong tu chon 5037: dung o day la lam hong theo kieu im lang. Do cac cong dang
# co tien trinh adb nghe, hoi tung cong, lay cong nao tra ve nhieu may nhat.
# Chi hoi cong DA co server, vi `adb -P <cong>` vao cong trong se de ra mot
# server moi khong ai can.
if ($env:ADB_PATH -and -not $env:ANDROID_ADB_SERVER_PORT) {
    try {
        $adbPids = @(Get-Process -Name adb -ErrorAction SilentlyContinue |
                     Select-Object -ExpandProperty Id)
        $ports = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
                   Where-Object { $adbPids -contains $_.OwningProcess } |
                   Select-Object -ExpandProperty LocalPort -Unique)

        $bestPort = $null
        $bestCount = -1
        foreach ($port in $ports) {
            $count = 0
            foreach ($line in (& $env:ADB_PATH -P $port devices 2>$null)) {
                if ($line -match '^\S+\s+device\s*$') { $count += 1 }
            }
            if ($count -gt $bestCount) { $bestCount = $count; $bestPort = $port }
        }

        if ($bestPort -and $bestCount -gt 0) {
            $env:ANDROID_ADB_SERVER_PORT = "$bestPort"
            $global:AdbDeviceCount = $bestCount
        }
    } catch {
        # Khong do duoc thi thoi, de adb dung cong mac dinh. Bang tom tat ben
        # duoi se hien cong dang dung de con biet ma tu dat.
    }
}

$global:rok = Join-Path $RokRepo "tools\rok-device-lab\.venv\Scripts\python.exe"

Set-Location $RokRepo

function Show-Line([string]$Name, [string]$Value, [string]$Hint) {
    if ($Value) {
        Write-Host ("  {0,-14} {1}" -f $Name, $Value) -ForegroundColor Green
    } else {
        Write-Host ("  {0,-14} CHƯA CÓ — {1}" -f $Name, $Hint) -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "ROK FAQ · môi trường tool quét" -ForegroundColor Cyan
Show-Line "repo"      $RokRepo ""
Show-Line "adb"       $env:ADB_PATH "đặt thủ công: `$env:ADB_PATH = '...\adb.exe'"
Show-Line "adb server" $(
    if ($env:ANDROID_ADB_SERVER_PORT) {
        "cong " + $env:ANDROID_ADB_SERVER_PORT +
        $(if ($global:AdbDeviceCount) { " (" + $global:AdbDeviceCount + " may)" } else { "" })
    } else { "" }
) "khong do duoc cong. Dat tay: `$env:ANDROID_ADB_SERVER_PORT = '5038'"
Show-Line "tesseract" $env:TESSERACT_PATH "winget install --id UB-Mannheim.TesseractOCR --exact"
Show-Line "tessdata"  $env:TESSDATA_DIR "xem docs/scan-runbook.md mục 2a"
Show-Line "python"    $(if (Test-Path $global:rok) { $global:rok } else { "" }) "py -3.11 -m venv tools\rok-device-lab\.venv"

# Thiếu vie.traineddata hỏng theo kiểu im lặng: Tesseract vẫn trả về chữ, chỉ là
# tên tiếng Việt ra ký tự rác. Không có thông báo lỗi nào — nên phải kiểm ở đây.
if ($env:TESSDATA_DIR) {
    $missing = @()
    foreach ($lang in @("eng", "vie")) {
        if (-not (Test-Path (Join-Path $env:TESSDATA_DIR "$lang.traineddata"))) { $missing += $lang }
    }
    if ($missing.Count -gt 0) {
        Write-Host ""
        Write-Host ("  Thiếu ngôn ngữ OCR: " + ($missing -join ", ")) -ForegroundColor Yellow
        Write-Host "  Tên tiếng Việt sẽ ra ký tự rác mà KHÔNG báo lỗi. Xem docs/scan-runbook.md mục 2a." -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host '  Chay thu:  & $rok -m rok_lab.cli doctor' -ForegroundColor DarkGray
Write-Host ""
