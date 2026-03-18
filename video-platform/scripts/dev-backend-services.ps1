<#
.SYNOPSIS
  启动所有迁移后的后端服务 (Python / Rust / Go)
.DESCRIPTION
  与现有 TS 服务并行运行:
  - Moderation   (Python/FastAPI, port 8102)
  - Recommendation (Python/FastAPI, port 8105)
  - Search       (Rust/Tantivy,   port 8101)
  - Transcode    (Go/Fiber,       port 8100)
#>
param(
    [switch]$SkipPython,
    [switch]$SkipRust,
    [switch]$SkipGo
)

$ErrorActionPreference = "Continue"
$ROOT = Split-Path -Parent $PSScriptRoot

# Load env
if (Test-Path "$ROOT/.env.local") {
    Get-Content "$ROOT/.env.local" | ForEach-Object {
        if ($_ -match '^([^#=]+)=(.*)$') {
            [Environment]::SetEnvironmentVariable($Matches[1].Trim(), $Matches[2].Trim(), "Process")
        }
    }
}

$jobs = @()

# ── Python: Moderation (port 8102) ──
if (-not $SkipPython) {
    $modDir = "$ROOT/services/moderation/python"
    if (Test-Path "$modDir/server.py") {
        Write-Host "[moderation-py] Starting on port 8102..." -ForegroundColor Cyan
        $jobs += Start-Job -Name "moderation-py" -ScriptBlock {
            param($dir)
            Set-Location $dir
            & python server.py 2>&1
        } -ArgumentList $modDir
    }

    # Recommendation (port 8105)
    $recDir = "$ROOT/services/recommendation/python"
    if (Test-Path "$recDir/server.py") {
        Write-Host "[recommend-py] Starting on port 8105..." -ForegroundColor Cyan
        $jobs += Start-Job -Name "recommend-py" -ScriptBlock {
            param($dir)
            Set-Location $dir
            & python server.py 2>&1
        } -ArgumentList $recDir
    }
}

# ── Rust: Search (port 8101) ──
if (-not $SkipRust) {
    $rustBin = "$ROOT/services/search/rust/target/release/nexus-search.exe"
    if (Test-Path $rustBin) {
        Write-Host "[search-rust] Starting on port 8101..." -ForegroundColor Yellow
        $jobs += Start-Job -Name "search-rust" -ScriptBlock {
            param($bin)
            & $bin 2>&1
        } -ArgumentList $rustBin
    } else {
        Write-Host "[search-rust] Binary not found. Run: cd services/search/rust && cargo build --release" -ForegroundColor Red
    }
}

# ── Go: Transcode (port 8100) ──
if (-not $SkipGo) {
    $goDir = "$ROOT/services/transcode/go"
    if (Test-Path "$goDir/main.go") {
        $goBin = "$goDir/nexus-transcode.exe"
        if (Test-Path $goBin) {
            Write-Host "[transcode-go] Starting on port 8100..." -ForegroundColor Green
            $jobs += Start-Job -Name "transcode-go" -ScriptBlock {
                param($bin)
                & $bin 2>&1
            } -ArgumentList $goBin
        } else {
            Write-Host "[transcode-go] Binary not found. Run: cd services/transcode/go && go build -o nexus-transcode.exe ." -ForegroundColor Red
        }
    }
}

if ($jobs.Count -eq 0) {
    Write-Host "No new backend services to start." -ForegroundColor Gray
    exit 0
}

Write-Host "`n[launcher] $($jobs.Count) new backend services starting..." -ForegroundColor White
Write-Host "Press Ctrl+C to stop all services.`n"

try {
    while ($true) {
        foreach ($job in $jobs) {
            $output = Receive-Job -Job $job -ErrorAction SilentlyContinue
            if ($output) {
                foreach ($line in $output) {
                    Write-Host "[$($job.Name)] $line"
                }
            }
            if ($job.State -eq "Failed" -or $job.State -eq "Completed") {
                Write-Host "[$($job.Name)] Exited ($($job.State))" -ForegroundColor Red
            }
        }
        Start-Sleep -Milliseconds 500
    }
} finally {
    Write-Host "`n[launcher] Stopping all new backend services..."
    $jobs | Stop-Job -PassThru | Remove-Job
}
