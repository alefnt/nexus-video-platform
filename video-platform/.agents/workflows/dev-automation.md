---
description: How to start, stop, restart the dev environment, check health, release versions, and manage the database
---

# Nexus Video Platform — Dev Automation

## Quick Reference

| Command | What it does |
|---------|-------------|
| `npm start` | 🚀 One-click: kill old → Docker → deps → Prisma → all services |
| `npm stop` | 🛑 Stop all Node processes + Docker containers |
| `npm restart` | 🔄 Restart services (keep Docker running) |
| `npm run health` | 🏥 Check all 17 services + Docker status |
| `npm run dev:all` | Start backend + frontend (no Docker/cleanup) |
| `npm run dev:services` | Start backend services only |
| `npm run dev:web` | Start frontend only |

## Database Commands

| Command | What it does |
|---------|-------------|
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:reset` | ⚠️ Delete + recreate database |
| `npm run db:seed` | Seed with sample data |
| `npm run db:studio` | Open Prisma Studio GUI (localhost:5555) |
| `npm run db:status` | Check migration status |

## Release a New Version

```powershell
// turbo-all
.\scripts\release.ps1 -Version "2.3.0" -Message "feat: description of changes"
```

This will: bump package.json → update CHANGELOG → git commit → tag → push to GitHub.

Use `-DryRun` to preview, `-SkipPush` to commit locally without pushing.

## PowerShell Scripts (Advanced)

```powershell
# Start with options
.\scripts\dev-start.ps1 -SkipDocker        # Skip Docker startup
.\scripts\dev-start.ps1 -SkipInstall        # Skip npm install check
.\scripts\dev-start.ps1 -ServicesOnly       # Backend only
.\scripts\dev-start.ps1 -WebOnly            # Frontend only

# Stop with options
.\scripts\dev-stop.ps1 -KeepDocker          # Keep Docker containers running
```
