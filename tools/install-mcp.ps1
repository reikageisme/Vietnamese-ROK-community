# Register the RokViet MCP server with Claude Desktop.
#
#   cd "D:\ROK Forum"
#   .\tools\install-mcp.ps1
#
# Reads PANEL_TOKEN from the server over SSH, merges into any existing config
# (keeps your other MCP servers), writes UTF-8 without BOM, then verifies.
#
# NOTE: every message below is plain ASCII on purpose. Windows PowerShell 5.1
# reads .ps1 files using the system ANSI codepage unless the file has a UTF-8
# BOM, so non-ASCII text here would arrive mangled and break parsing.

param(
    # Do NOT name a parameter $Host - that is a reserved PowerShell variable.
    [string]$ServerHost = "100.113.111.64",
    [string]$ServerUser = "root",
    [string]$SshKey     = "$env:USERPROFILE\.ssh\rok_mcp",
    [string]$Repo       = "/root/Vietnamese-ROK-community",
    [string]$ScriptPath = "D:\ROK Forum\tools\rok_mcp.py"
)

$ErrorActionPreference = "Stop"
function Say($text, $color = "Gray") { Write-Host $text -ForegroundColor $color }

# --- 1. Preconditions ----------------------------------------------------

Say "== Checking ==" Cyan

if (-not (Test-Path $ScriptPath)) { throw "MCP script not found: $ScriptPath" }
if (-not (Test-Path $SshKey))     { throw "SSH key not found: $SshKey" }
Say "   mcp script : ok"
Say "   ssh key    : ok"

$python = $null
foreach ($candidate in @(@("py", @("-3")), @("python", @()), @("python3", @()))) {
    if (Get-Command $candidate[0] -ErrorAction SilentlyContinue) {
        $python = @{ Command = $candidate[0]; Args = $candidate[1] }
        break
    }
}
if (-not $python) { throw "No Python found on this machine." }
Say "   python     : $($python.Command) $($python.Args -join ' ')"

# --- 2. Read PANEL_TOKEN from the server ---------------------------------

Say ""
Say "== Reading PANEL_TOKEN from server ==" Cyan
$remoteCmd = "grep '^PANEL_TOKEN=' $Repo/tools/rok-device-panel/.env | head -1 | cut -d= -f2-"

# Keep stderr OUT of the captured value. SSH banners or host-key notices would
# otherwise end up glued onto the token.
$sshOutput = & ssh -i $SshKey -o BatchMode=yes -o StrictHostKeyChecking=accept-new `
                   "$ServerUser@$ServerHost" $remoteCmd 2>$null
$sshExit = $LASTEXITCODE

$token = ""
foreach ($line in @($sshOutput)) {
    $trimmed = "$line".Trim()
    if ($trimmed) { $token = $trimmed }
}

if ($sshExit -ne 0) { throw "SSH failed with exit code $sshExit." }
if (-not $token)    { throw "PANEL_TOKEN not found in $Repo/tools/rok-device-panel/.env" }
if ($token -match '\s') { throw "Token contains whitespace - check the .env file." }
Say "   token      : $($token.Length) characters"

# --- 3. Merge into the Claude Desktop config -----------------------------

Say ""
Say "== Writing Claude Desktop config ==" Cyan
$configDir  = Join-Path $env:APPDATA "Claude"
$configPath = Join-Path $configDir "claude_desktop_config.json"
if (-not (Test-Path $configDir)) {
    New-Item -ItemType Directory -Path $configDir -Force | Out-Null
    Say "   created $configDir"
}

$config = @{}
if (Test-Path $configPath) {
    Copy-Item $configPath "$configPath.bak" -Force
    Say "   backed up existing config to claude_desktop_config.json.bak"
    try {
        $existing = Get-Content $configPath -Raw -Encoding UTF8 | ConvertFrom-Json
        foreach ($p in $existing.PSObject.Properties) { $config[$p.Name] = $p.Value }
    } catch {
        Say "   warning: existing file was not valid JSON, starting fresh" Yellow
    }
} else {
    Say "   no existing config, creating a new one"
}

$servers = @{}
if ($config.ContainsKey("mcpServers") -and $config["mcpServers"]) {
    foreach ($p in $config["mcpServers"].PSObject.Properties) { $servers[$p.Name] = $p.Value }
}
$kept = @($servers.Keys | Where-Object { $_ -ne "rokviet" })
if ($kept.Count -gt 0) { Say "   keeping existing servers: $($kept -join ', ')" }

$servers["rokviet"] = @{
    command = $python.Command
    args    = @($python.Args + @($ScriptPath))
    env     = @{
        ROK_SSH_HOST    = $ServerHost
        ROK_SSH_USER    = $ServerUser
        ROK_SSH_KEY     = $SshKey
        ROK_REPO        = $Repo
        ROK_PANEL_URL   = "http://${ServerHost}:5100"
        ROK_PANEL_TOKEN = $token
    }
}
$config["mcpServers"] = $servers

# -Depth 10 is required: the default depth of 2 would truncate the env block.
$json = $config | ConvertTo-Json -Depth 10

# UTF-8 WITHOUT BOM. Set-Content -Encoding UTF8 on PowerShell 5.1 adds a BOM,
# and a BOM at the start of a JSON file makes many parsers report a syntax error.
[System.IO.File]::WriteAllText($configPath, $json, (New-Object System.Text.UTF8Encoding($false)))
Say "   wrote $configPath"

# --- 4. Verify what we just wrote ----------------------------------------

Say ""
Say "== Verifying ==" Cyan
$check = Get-Content $configPath -Raw -Encoding UTF8 | ConvertFrom-Json
$entry = $check.mcpServers.rokviet
if (-not $entry) { throw "rokviet entry missing after write." }
Say "   json       : valid"
Say "   command    : $($entry.command) $($entry.args -join ' ')"
Say "   panel url  : $($entry.env.ROK_PANEL_URL)"
Say "   token      : $($entry.env.ROK_PANEL_TOKEN.Length) characters"

Say ""
Say "DONE." Green
Say "Quit Claude Desktop COMPLETELY (right-click the tray icon -> Quit," Green
Say "not just closing the window), then start it again." Green
Say ""
Say 'Then ask Claude: "liet ke dien thoai"' Green
