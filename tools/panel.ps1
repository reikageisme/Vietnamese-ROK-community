# Open the ROK FAQ device panel over an SSH tunnel, so the browser sees it on
# localhost and treats it as a secure context.
#
#   cd "D:\ROK Forum"
#   .\tools\panel.ps1
#
# WHY THIS EXISTS
# Browsers expose WebCodecs (window.VideoDecoder) ONLY in a secure context:
# https:// or localhost. Reaching the panel at http://100.113.111.64:5100 is
# neither, so the H.264 decoder is missing and the panel falls back to still
# screenshots at roughly one frame per second. Tunnelling the same port to
# localhost makes the browser treat it as secure - nothing on the server
# changes, and the panel switches to hardware H.264 on its own.
#
# NOTE: plain ASCII on purpose - Windows PowerShell 5.1 reads .ps1 using the
# system ANSI codepage unless the file has a UTF-8 BOM.

param(
    [string]$ServerHost = "100.113.111.64",
    [string]$ServerUser = "root",
    [string]$SshKey     = "$env:USERPROFILE\.ssh\rok_mcp",
    [int]$Port          = 5100,
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
function Say($text, $color = "Gray") { Write-Host $text -ForegroundColor $color }

if (-not (Test-Path $SshKey)) { throw "SSH key not found: $SshKey" }

# Refuse to start if something already holds the local port - otherwise ssh
# fails quietly and the browser opens onto whatever else is listening.
$busy = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($busy) {
    throw "Local port $Port is already in use (PID $($busy[0].OwningProcess)). Close it or pass -Port 5101."
}

Say "== Opening tunnel ==" Cyan
Say "   localhost:$Port  ->  ${ServerHost}:$Port"

$sshArgs = @(
    "-i", $SshKey,
    "-N",
    "-o", "BatchMode=yes",
    "-o", "StrictHostKeyChecking=accept-new",
    "-o", "ExitOnForwardFailure=yes",
    "-o", "ServerAliveInterval=20",
    "-L", "${Port}:${ServerHost}:${Port}",
    "$ServerUser@$ServerHost"
)
$ssh = Start-Process ssh -ArgumentList $sshArgs -PassThru -WindowStyle Hidden

try {
    $ready = $false
    foreach ($attempt in 1..30) {
        if ($ssh.HasExited) { throw "ssh exited with code $($ssh.ExitCode) - check the key and the host." }
        try {
            $probe = New-Object System.Net.Sockets.TcpClient
            $probe.Connect("127.0.0.1", $Port)
            $probe.Close()
            $ready = $true
            break
        } catch { Start-Sleep -Milliseconds 400 }
    }
    if (-not $ready) { throw "Tunnel did not come up within 12 seconds." }

    $url = "http://localhost:$Port"
    Say "   tunnel is up" Green
    Say ""
    Say "Panel: $url" Green
    Say "Leave THIS window open. Ctrl+C closes the tunnel." Yellow
    if (-not $NoBrowser) { Start-Process $url }

    # Block until the user stops us, or ssh dies on its own.
    while (-not $ssh.HasExited) { Start-Sleep -Seconds 1 }
    Say "`nssh closed the tunnel (exit $($ssh.ExitCode))." Yellow
}
finally {
    if (-not $ssh.HasExited) {
        Stop-Process -Id $ssh.Id -Force -ErrorAction SilentlyContinue
        Say "Tunnel closed." Gray
    }
}
