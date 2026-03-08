#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
REPORT_FILE="$PROJECT_ROOT/audit-report.json"

echo "============================================"
echo "  Dependency Audit — Nexus Video Platform"
echo "============================================"
echo ""

cd "$PROJECT_ROOT"

echo "[1/3] Running npm audit ..."
npm audit --json > "$REPORT_FILE" 2>/dev/null || true
echo "      Raw JSON saved to audit-report.json"
echo ""

echo "[2/3] Checking for critical / high vulnerabilities ..."
CRITICAL=$(node -e "const r=require('$REPORT_FILE'); console.log(r.metadata?.vulnerabilities?.critical ?? 0)" 2>/dev/null || echo 0)
HIGH=$(node -e "const r=require('$REPORT_FILE'); console.log(r.metadata?.vulnerabilities?.high ?? 0)" 2>/dev/null || echo 0)
MODERATE=$(node -e "const r=require('$REPORT_FILE'); console.log(r.metadata?.vulnerabilities?.moderate ?? 0)" 2>/dev/null || echo 0)
LOW=$(node -e "const r=require('$REPORT_FILE'); console.log(r.metadata?.vulnerabilities?.low ?? 0)" 2>/dev/null || echo 0)
TOTAL=$(node -e "const r=require('$REPORT_FILE'); console.log(r.metadata?.vulnerabilities?.total ?? 0)" 2>/dev/null || echo 0)

echo ""
echo "[3/3] Summary"
echo "--------------------------------------------"
printf "  Critical : %s\n" "$CRITICAL"
printf "  High     : %s\n" "$HIGH"
printf "  Moderate : %s\n" "$MODERATE"
printf "  Low      : %s\n" "$LOW"
printf "  Total    : %s\n" "$TOTAL"
echo "--------------------------------------------"

if [ "$CRITICAL" -gt 0 ] || [ "$HIGH" -gt 0 ]; then
  echo ""
  echo "⚠  Action required — critical or high vulnerabilities found."
  echo "   Run 'npm audit' for details and 'npm audit fix' to auto-resolve where possible."
  exit 1
fi

echo ""
echo "✓  No critical or high vulnerabilities detected."
exit 0
