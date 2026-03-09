# ============================================================
# Nexus Video Platform — Database Operations (数据库操作)
# Usage: .\scripts\db.ps1 -Action migrate|reset|seed|studio
# ============================================================

param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("migrate", "reset", "seed", "studio", "status")]
    [string]$Action
)

$ErrorActionPreference = "Stop"
$ROOT = Split-Path -Parent $PSScriptRoot
$SCHEMA = "packages/database/prisma/schema.prisma"

Write-Host ""
Write-Host "  🗄️  NEXUS PLATFORM — Database: $Action" -ForegroundColor Cyan
Write-Host "  ========================================" -ForegroundColor DarkGray
Write-Host ""

Set-Location $ROOT

# Load .env.local
if (Test-Path ".env.local") {
    Get-Content ".env.local" | ForEach-Object {
        if ($_ -match '^([^#=]+)=(.*)$') {
            $key = $Matches[1].Trim()
            $val = $Matches[2].Trim()
            [Environment]::SetEnvironmentVariable($key, $val, "Process")
        }
    }
    Write-Host "  ✅ Loaded .env.local" -ForegroundColor Green
}

switch ($Action) {
    "migrate" {
        Write-Host "  Running Prisma migrate dev..." -ForegroundColor Yellow
        npx prisma migrate dev --schema=$SCHEMA
    }
    "reset" {
        Write-Host "  ⚠️  This will DELETE all data and recreate the database!" -ForegroundColor Red
        $confirm = Read-Host "  Type 'yes' to confirm"
        if ($confirm -eq "yes") {
            npx prisma migrate reset --schema=$SCHEMA --force
        }
        else {
            Write-Host "  Cancelled." -ForegroundColor Yellow
        }
    }
    "seed" {
        Write-Host "  Seeding database with sample data..." -ForegroundColor Yellow
        npx tsx scripts/seed-content.ts
    }
    "studio" {
        Write-Host "  Opening Prisma Studio (database GUI)..." -ForegroundColor Yellow
        Write-Host "  Access at: http://localhost:5555" -ForegroundColor Cyan
        npx prisma studio --schema=$SCHEMA
    }
    "status" {
        Write-Host "  Checking migration status..." -ForegroundColor Yellow
        npx prisma migrate status --schema=$SCHEMA
    }
}

Write-Host ""
