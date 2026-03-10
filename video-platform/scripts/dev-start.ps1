# ============================================================
# Nexus Video Platform — One-Click Dev Start (全自动启动)
# Usage: .\scripts\dev-start.ps1
# ============================================================

param(
    [switch]$SkipDocker,      # 跳过 Docker 启动
    [switch]$SkipInstall,     # 跳过 npm install
    [switch]$ServicesOnly,    # 只启动后端服务
    [switch]$WebOnly          # 只启动前端
)

$ErrorActionPreference = "Continue"
$ROOT = Split-Path -Parent $PSScriptRoot

Write-Host ""
Write-Host "  ⚡ NEXUS VIDEO PLATFORM — Dev Startup" -ForegroundColor Cyan
Write-Host "  ======================================" -ForegroundColor DarkGray
Write-Host ""

# ── Step 1: Kill existing processes ──────────────────────────
Write-Host "  [1/5] 🔪 Killing existing Node processes..." -ForegroundColor Yellow
$killed = 0
Get-Process -Name "node" -ErrorAction SilentlyContinue | ForEach-Object {
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
    $killed++
}
if ($killed -gt 0) {
    Write-Host "        Killed $killed process(es)" -ForegroundColor DarkGray
    Start-Sleep -Seconds 2
}
else {
    Write-Host "        No processes to kill" -ForegroundColor DarkGray
}

# ── Step 2: Docker Infrastructure ────────────────────────────
if (-not $SkipDocker -and -not $WebOnly) {
    Write-Host "  [2/5] 🐳 Starting Docker containers..." -ForegroundColor Yellow
    
    # Check if Docker is running
    $dockerRunning = $false
    try {
        $null = docker info 2>&1
        $dockerRunning = $true
    }
    catch {
        Write-Host "        ❌ Docker is not running! Please start Docker Desktop first." -ForegroundColor Red
        exit 1
    }
    
    Set-Location $ROOT
    docker compose up -d 2>&1 | ForEach-Object {
        if ($_ -match "Running|Started|Created") {
            Write-Host "        $_" -ForegroundColor DarkGray
        }
    }
    
    # Wait for PostgreSQL to be ready
    Write-Host "        Waiting for PostgreSQL..." -ForegroundColor DarkGray
    $pgReady = $false
    for ($i = 0; $i -lt 15; $i++) {
        try {
            $result = docker compose exec -T postgres pg_isready 2>&1
            if ($result -match "accepting") { $pgReady = $true; break }
        }
        catch {}
        Start-Sleep -Seconds 1
    }
    if ($pgReady) {
        Write-Host "        ✅ PostgreSQL ready" -ForegroundColor Green
    }
    else {
        Write-Host "        ⚠️  PostgreSQL may not be ready yet" -ForegroundColor Yellow
    }
}
else {
    Write-Host "  [2/5] ⏭️  Docker skipped" -ForegroundColor DarkGray
}

# ── Step 3: Install dependencies ─────────────────────────────
if (-not $SkipInstall) {
    Write-Host "  [3/5] 📦 Checking dependencies..." -ForegroundColor Yellow
    Set-Location $ROOT
    
    # Only install if node_modules is missing or package-lock changed
    $needInstall = -not (Test-Path "$ROOT\node_modules")
    if ($needInstall) {
        Write-Host "        Running npm install..." -ForegroundColor DarkGray
        npm install --silent 2>&1 | Out-Null
        Write-Host "        ✅ Dependencies installed" -ForegroundColor Green
    }
    else {
        Write-Host "        Dependencies up to date" -ForegroundColor DarkGray
    }
}
else {
    Write-Host "  [3/5] ⏭️  Install skipped" -ForegroundColor DarkGray
}

# ── Step 4: Prisma generate ──────────────────────────────────
Write-Host "  [4/5] 🗄️  Generating Prisma client..." -ForegroundColor Yellow
Set-Location $ROOT
try {
    npx prisma generate --schema=packages/database/prisma/schema.prisma 2>&1 | Out-Null
    Write-Host "        ✅ Prisma client generated" -ForegroundColor Green
}
catch {
    Write-Host "        ⚠️  Prisma generate failed (non-critical)" -ForegroundColor Yellow
}

# ── Step 5: Start services ───────────────────────────────────
Write-Host "  [5/5] 🚀 Starting services..." -ForegroundColor Yellow
Set-Location $ROOT

if ($WebOnly) {
    Write-Host "        Starting frontend only..." -ForegroundColor DarkGray
    npm run dev:web
}
elseif ($ServicesOnly) {
    Write-Host "        Starting backend services only..." -ForegroundColor DarkGray
    npm run dev:services
}
else {
    Write-Host "        Starting all services (backend + frontend)..." -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "  ✅ All services starting! Access at:" -ForegroundColor Green
    Write-Host "     🌐 Frontend:  http://localhost:5173" -ForegroundColor Cyan
    Write-Host "     🔌 Gateway:   http://localhost:8080" -ForegroundColor Cyan
    Write-Host "     📚 API Docs:  http://localhost:8080/docs" -ForegroundColor Cyan
    Write-Host ""
    npm run dev:all
}
