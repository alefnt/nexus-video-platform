# ============================================================
# Nexus Video Platform — Stop All Services (停止所有服务)
# Usage: .\scripts\dev-stop.ps1 [-KeepDocker]
# ============================================================

param(
    [switch]$KeepDocker       # 保留 Docker 容器运行
)

$ErrorActionPreference = "Continue"
$ROOT = Split-Path -Parent $PSScriptRoot

Write-Host ""
Write-Host "  🛑 NEXUS PLATFORM — Stopping Services" -ForegroundColor Red
Write-Host "  ======================================" -ForegroundColor DarkGray
Write-Host ""

# Kill Node processes
Write-Host "  [1/2] 🔪 Killing Node processes..." -ForegroundColor Yellow
$killed = 0
Get-Process -Name "node" -ErrorAction SilentlyContinue | ForEach-Object {
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
    $killed++
}
Write-Host "        Killed $killed process(es)" -ForegroundColor DarkGray

# Stop Docker
if (-not $KeepDocker) {
    Write-Host "  [2/2] 🐳 Stopping Docker containers..." -ForegroundColor Yellow
    Set-Location $ROOT
    docker compose stop 2>&1 | ForEach-Object {
        if ($_ -match "Stopped|Container") {
            Write-Host "        $_" -ForegroundColor DarkGray
        }
    }
    Write-Host "        ✅ Docker containers stopped" -ForegroundColor Green
}
else {
    Write-Host "  [2/2] ⏭️  Docker kept running" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "  ✅ All services stopped" -ForegroundColor Green
Write-Host ""
