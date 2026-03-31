# Start-MQTrace.ps1
#
# One-command launcher for the full MQTrace stack.
#
# WHAT THIS SCRIPT DOES:
#   1. Ensures Ruby and Node are on the PATH for this session
#   2. Starts Mosquitto (Windows service) if not already running
#   3. Runs Rails + Vite together via `npm run dev:full` (uses concurrently)
#
# HOW TO RUN:
#   Open PowerShell in C:\projects\MQTrace and run:
#     .\Start-MQTrace.ps1
#
# STOPPING:
#   Press Ctrl+C once to stop both Rails and Vite.
#   The internal simulator (started from the Debug panel) stops automatically
#   when Rails shuts down.
#   If you ran the external screen_simulator.rb, stop it separately with Ctrl+C
#   in its own terminal.

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Use English for all tool output (PostgreSQL, NPM, Rails, etc)
$env:LANG = "en_US.UTF-8"
$env:LC_ALL = "C"

Write-Host ""
Write-Host "  MQTrace - Starting stack..." -ForegroundColor Cyan
Write-Host ""

# -- Step 1: Verify Dependencies (Ruby, Node) ---------------------------------
Write-Host "  [0/3] Checking Dependencies..." -ForegroundColor Yellow

$rubyCmd = Get-Command "ruby" -ErrorAction SilentlyContinue
if ($null -eq $rubyCmd) {
    Write-Host "  [!] Ruby is not installed or not in PATH." -ForegroundColor Red
    Write-Host "      Please install Ruby and add it to your System PATH to continue." -ForegroundColor DarkYellow
    exit 1
}

$nodeCmd = Get-Command "node" -ErrorAction SilentlyContinue
if ($null -eq $nodeCmd) {
    Write-Host "  [!] Node.js is not installed or not in PATH." -ForegroundColor Red
    Write-Host "      Please install Node.js and add it to your System PATH to continue." -ForegroundColor DarkYellow
    exit 1
}

Write-Host "  [OK] Dependencies found: Ruby ($($rubyCmd.Version)), Node" -ForegroundColor Green

# -- Step 2: Start Mosquitto if not running ------------------------------------
Write-Host "  [1/3] Checking Mosquitto MQTT broker..." -ForegroundColor Yellow

$mosquittoStatus = Get-Service -Name "mosquitto" -ErrorAction SilentlyContinue

if ($null -eq $mosquittoStatus) {
    Write-Host "  [!] Mosquitto service not found." -ForegroundColor Red
    Write-Host "      Install from: https://mosquitto.org/download/" -ForegroundColor Red
    Write-Host "      Or set MQTT_HOST=broker.hivemq.com in mqtrace\.env to use the public broker." -ForegroundColor DarkYellow
    Write-Host ""
    $usePublic = Read-Host "  Continue with HiveMQ public broker? (y/N)"
    if ($usePublic -ne "y" -and $usePublic -ne "Y") {
        Write-Host "  Aborted." -ForegroundColor Red
        exit 1
    }
    # Point the .env to HiveMQ
    $envPath = Join-Path $PSScriptRoot "mqtrace\.env"
    (Get-Content $envPath) -replace "MQTT_HOST=.*", "MQTT_HOST=broker.hivemq.com" | Set-Content $envPath
    Write-Host "  -> .env updated to use broker.hivemq.com" -ForegroundColor Green
}
elseif ($mosquittoStatus.Status -eq "Running") {
    Write-Host "  [OK] Mosquitto already running." -ForegroundColor Green
}
else {
    Write-Host "  -> Starting Mosquitto..." -ForegroundColor Yellow
    try {
        Start-Service mosquitto
        Start-Sleep -Seconds 1
        Write-Host "  [OK] Mosquitto started." -ForegroundColor Green
    } catch {
        Write-Host "  [!] Could not start Mosquitto: $_" -ForegroundColor Red
        Write-Host "      Try running PowerShell as Administrator, or start Mosquitto manually." -ForegroundColor DarkYellow
    }
}

# -- Step 3: Check PostgreSQL --------------------------------------------------
Write-Host "  [2/3] Checking PostgreSQL..." -ForegroundColor Yellow

$pgService = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue | Select-Object -First 1

if ($null -eq $pgService) {
    Write-Host "  [!] No PostgreSQL service found. Make sure it is running." -ForegroundColor Red
} elseif ($pgService.Status -eq "Running") {
    Write-Host "  [OK] PostgreSQL ($($pgService.Name)) running." -ForegroundColor Green
} else {
    Write-Host "  -> Starting $($pgService.Name)..." -ForegroundColor Yellow
    try {
        Start-Service $pgService.Name
        Write-Host "  [OK] PostgreSQL started." -ForegroundColor Green
    } catch {
        Write-Host "  [!] Could not start PostgreSQL: $_" -ForegroundColor Red
    }
}

# -- Step 2.5: Database Preparation ------------------------------------------
Write-Host "  [2.5/3] Preparing Database..." -ForegroundColor Yellow

$setupScript = Join-Path $PSScriptRoot "mqtrace\bin\setup_db.rb"
# Change to mqtrace dir to run setup
$oldPwd = $pwd
Set-Location (Join-Path $PSScriptRoot "mqtrace")
& ruby $setupScript

if ($LASTEXITCODE -ne 0) {
    Write-Host "  [!] Database setup failed. Please check your PostgreSQL installation." -ForegroundColor Red
    Set-Location $oldPwd
    exit 1
}

Write-Host "  [OK] Database is ready." -ForegroundColor Green
Set-Location $oldPwd

# -- Step 4: Launch Rails + Vite via concurrently -----------------------------
Write-Host "  [3/3] Launching Rails + Vite..." -ForegroundColor Yellow
Write-Host ""
Write-Host "  +-----------------------------------------+" -ForegroundColor DarkGray
Write-Host "  |  Rails API  ->  http://localhost:3000    |" -ForegroundColor DarkGray
Write-Host "  |  Dashboard  ->  http://localhost:5173    |" -ForegroundColor DarkGray
Write-Host "  |  WebSocket  ->  ws://localhost:3000/cable|" -ForegroundColor DarkGray
Write-Host "  +-----------------------------------------+" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Press Ctrl+C to stop everything." -ForegroundColor DarkGray
Write-Host ""

Set-Location (Join-Path $PSScriptRoot "mqtrace-frontend")

# -- Clean Stale PIDs --------------------------------------------------------
$pidFile = Join-Path $PSScriptRoot "mqtrace\tmp\pids\server.pid"
if (Test-Path $pidFile) { Remove-Item $pidFile -Force -ErrorAction SilentlyContinue }

$npmCmd = Get-Command "npm" -ErrorAction SilentlyContinue
if ($null -eq $npmCmd) {
    Write-Host "  [!] NPM is not found in your PATH." -ForegroundColor Red
    exit 1
}

& $npmCmd.Path run dev:full
