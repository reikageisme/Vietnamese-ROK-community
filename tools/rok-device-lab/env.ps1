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

# Thư mục repo suy ra từ vị trí chính file này, không hard-code ổ đĩa —
# máy chính để ở D:, VM 200 để ở C:.
$script:LabDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$global:ROK = (Resolve-Path (Join-Path $script:LabDir "..\..")).Path

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

$global:rok = Join-Path $ROK "tools\rok-device-lab\.venv\Scripts\python.exe"

Set-Location $ROK

function Show-Line([string]$Name, [string]$Value, [string]$Hint) {
    if ($Value) {
        Write-Host ("  {0,-14} {1}" -f $Name, $Value) -ForegroundColor Green
    } else {
        Write-Host ("  {0,-14} CHƯA CÓ — {1}" -f $Name, $Hint) -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "ROK FAQ · môi trường tool quét" -ForegroundColor Cyan
Show-Line "repo"      $ROK ""
Show-Line "adb"       $env:ADB_PATH "đặt thủ công: `$env:ADB_PATH = '...\adb.exe'"
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
