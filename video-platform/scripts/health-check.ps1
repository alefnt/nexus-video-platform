# ============================================================
# Nexus Video Platform — Health Check (服务健康检查)
# Usage: .\scripts\health-check.ps1
# ============================================================

$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "  🏥 NEXUS PLATFORM — Service Health Check" -ForegroundColor Cyan
Write-Host "  =========================================" -ForegroundColor DarkGray
Write-Host ""

# ── Docker Containers ────────────────────────────────────────
Write-Host "  📦 Docker Containers:" -ForegroundColor Yellow
try {
    $containers = docker compose ps --format "{{.Name}}|{{.Status}}" 2>&1
    foreach ($c in $containers) {
        if ($c -match "^(.+)\|(.+)$") {
            $name = $Matches[1].PadRight(40)
            $status = $Matches[2]
            if ($status -match "Up|running") {
                Write-Host "     ✅ $name $status" -ForegroundColor Green
            }
            else {
                Write-Host "     ❌ $name $status" -ForegroundColor Red
            }
        }
    }
}
catch {
    Write-Host "     ❌ Docker not running" -ForegroundColor Red
}

# ── Application Services ─────────────────────────────────────
Write-Host ""
Write-Host "  🔌 Application Services:" -ForegroundColor Yellow

$services = @(
    @{ Name = "API Gateway (Identity)"; Port = 8080; Path = "/health" },
    @{ Name = "Frontend (Vite)"; Port = 5173; Path = "/" },
    @{ Name = "Payment Service"; Port = 8091; Path = "/health" },
    @{ Name = "Content Service"; Port = 8092; Path = "/health" },
    @{ Name = "Metadata Service"; Port = 8093; Path = "/health" },
    @{ Name = "Royalty Service"; Port = 8094; Path = "/health" },
    @{ Name = "NFT Service"; Port = 8095; Path = "/health" },
    @{ Name = "Live Service"; Port = 8096; Path = "/health" },
    @{ Name = "Achievement Service"; Port = 8097; Path = "/health" },
    @{ Name = "Governance Service"; Port = 8098; Path = "/health" },
    @{ Name = "Bridge Service"; Port = 8099; Path = "/health" },
    @{ Name = "Transcode Service"; Port = 8100; Path = "/health" },
    @{ Name = "Search Service"; Port = 8101; Path = "/health" },
    @{ Name = "Moderation Service"; Port = 8102; Path = "/health" },
    @{ Name = "Messaging Service"; Port = 8103; Path = "/health" },
    @{ Name = "Engagement Service"; Port = 8104; Path = "/health" },
    @{ Name = "AI Generation Service"; Port = 8105; Path = "/health" }
)

$up = 0; $down = 0
foreach ($svc in $services) {
    $name = $svc.Name.PadRight(28)
    $port = $svc.Port
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:$port$($svc.Path)" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        Write-Host "     ✅ $name :$port" -ForegroundColor Green
        $up++
    }
    catch {
        $statusCode = $_.Exception.Response.StatusCode.Value__
        if ($statusCode) {
            Write-Host "     ⚠️  $name :$port (HTTP $statusCode)" -ForegroundColor Yellow
            $up++
        }
        else {
            Write-Host "     ❌ $name :$port" -ForegroundColor Red
            $down++
        }
    }
}

# ── Summary ──────────────────────────────────────────────────
Write-Host ""
Write-Host "  ─────────────────────────────────────────" -ForegroundColor DarkGray
Write-Host "  Summary: $up up, $down down (of $($services.Count) services)" -ForegroundColor $(if ($down -eq 0) { "Green" } else { "Yellow" })
Write-Host ""
