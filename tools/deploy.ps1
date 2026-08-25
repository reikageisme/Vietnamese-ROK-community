# Push panel/docs changes to GitHub - one command, run on Windows.
#
#   .\tools\deploy.ps1                          # uses tools\panel-commit-msg.txt if present
#   .\tools\deploy.ps1 -Message "fix abc"       # or give the message inline
#   .\tools\deploy.ps1 -Paths tools,docs        # widen what gets staged
#
# Cleans stale git lock files, and REFUSES to commit if any file is being
# deleted - that is exactly the trap that broke an earlier commit.
#
# NOTE: every message below is plain ASCII on purpose. Windows PowerShell 5.1
# reads .ps1 files using the system ANSI codepage unless the file has a UTF-8
# BOM, so non-ASCII text here shows up as mojibake on the console (and can
# break parsing outright when it lands inside an escape sequence).

param(
    [string]$Message  = "",
    [string]$Repo     = "D:\ROK Forum",
    [string[]]$Paths  = @("tools/rok-device-panel", "docs"),
    [switch]$SkipTypecheck
)

$ErrorActionPreference = "Stop"
Set-Location $Repo

Write-Host "== Clearing stale git locks ==" -ForegroundColor Cyan
@(".git\HEAD.lock", ".git\index.lock", ".git\objects\maintenance.lock") | ForEach-Object {
    if (Test-Path $_) { Remove-Item $_ -Force; Write-Host "   removed $_" }
}

# Gate: type-check BEFORE anything is committed or pushed.
#
# Why this exists: three TypeScript errors reached the server and each one cost a
# ~20 minute Docker build to discover. `npm run typecheck` finds the same errors
# in about 30 seconds, on this machine, before a single byte is pushed.
# Skip only when you know the tree is mid-refactor: .\tools\deploy.ps1 -SkipTypecheck
if (-not $SkipTypecheck) {
    Write-Host "`n== Type check ==" -ForegroundColor Cyan
    npm run typecheck
    if ($LASTEXITCODE -ne 0) {
        Write-Host "`nSTOP - type errors above. Fix them before deploying." -ForegroundColor Red
        Write-Host "The server build would fail on exactly these, 20 minutes from now." -ForegroundColor Yellow
        exit 1
    }
    Write-Host "   no type errors" -ForegroundColor Green
}

Write-Host "`n== Staging ==" -ForegroundColor Cyan
Write-Host "   paths: $($Paths -join ', ')"
git add $Paths
if ($LASTEXITCODE -ne 0) { throw "git add failed" }

# Guard: a deleted file is almost always a working tree out of sync, not intent.
$deleted = git diff --cached --name-status | Select-String -Pattern '^D'
if ($deleted) {
    Write-Host "`nSTOP - these files are being DELETED from the repo:" -ForegroundColor Red
    $deleted | ForEach-Object { Write-Host "   $_" -ForegroundColor Red }
    Write-Host "`nAlmost certainly a mistake. Restore with:" -ForegroundColor Yellow
    Write-Host "   git checkout HEAD -- <path>" -ForegroundColor Yellow
    Write-Host "then run this script again." -ForegroundColor Yellow
    exit 1
}

$staged = git diff --cached --name-only
if (-not $staged) { Write-Host "`nNothing changed. Stopping." -ForegroundColor Yellow; exit 0 }

Write-Host "`n== Will commit ==" -ForegroundColor Cyan
git diff --cached --stat | Write-Host

Write-Host "`n== Commit ==" -ForegroundColor Cyan
$msgFile  = "tools\panel-commit-msg.txt"
$usedFile = "tools\panel-commit-msg.last.txt"
$usedMsgFile = $false
if ($Message) {
    git commit -m $Message
} elseif (Test-Path $msgFile) {
    git commit -F $msgFile
    $usedMsgFile = $true
    Write-Host "   used the message from $msgFile"
} else {
    throw "Need -Message or the file $msgFile"
}
if ($LASTEXITCODE -ne 0) { throw "git commit failed" }

# Retire the message file so the NEXT run cannot silently reuse this same text.
if ($usedMsgFile) {
    Move-Item $msgFile $usedFile -Force
    Write-Host "   moved $msgFile -> $usedFile (write a new one for the next commit)"
}

Write-Host "`n== Pushing to GitHub ==" -ForegroundColor Cyan
git push origin main
if ($LASTEXITCODE -ne 0) { throw "git push failed" }

git gc --prune=now --quiet

Write-Host "`nDONE. Next, on the server run:" -ForegroundColor Green
Write-Host "   cd ~/Vietnamese-ROK-community/tools/rok-device-panel && ./update.sh" -ForegroundColor Green
