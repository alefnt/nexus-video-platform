# 释放 video-platform 开发服务占用的端口，便于干净重启 dev:all
# 使用: .\scripts\kill-dev-ports.ps1  然后在项目根目录执行 npm run dev:all

$ports = @(8080, 8091, 8092, 8093, 8094, 8095, 8096, 8097, 8098, 8099, 8100, 8101, 8102, 8103, 8104, 5173)
foreach ($p in $ports) {
    $conn = Get-NetTCPConnection -LocalPort $p -ErrorAction SilentlyContinue | Where-Object { $_.State -eq 'Listen' }
    if ($conn) {
        $pid = $conn.OwningProcess | Select-Object -First 1
        if ($pid) {
            $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
            Write-Host "Killing PID $pid (port $p): $($proc.ProcessName)"
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
        }
    }
}
Write-Host "Done. Run: npm run dev:all"
