# ── Memurai service check ──────────────────────────────────────────────────────
$svc = Get-Service -Name "Memurai" -ErrorAction SilentlyContinue

if ($null -eq $svc) {
    Write-Host "[redis] Memurai service not found." -ForegroundColor Red
    Write-Host "        Install Memurai Developer from C:\Users\HP\Memurai-Developer-v4.1.2.msi" -ForegroundColor Yellow
    exit 1
}

if ($svc.Status -ne 'Running') {
    Write-Host "[redis] Starting Memurai service..." -ForegroundColor Cyan
    Start-Service -Name "Memurai" -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 3
}

# Confirm port is up
$c = New-Object System.Net.Sockets.TcpClient
try {
    $c.Connect("127.0.0.1", 6379)
    Write-Host "[redis] Memurai (Redis 7.2.5) is UP on :6379" -ForegroundColor Green
} catch {
    Write-Host "[redis] Memurai started but port 6379 not responding — check the service." -ForegroundColor Red
    exit 1
} finally { try{$c.Close()}catch{} }

# ── Start the Node server ──────────────────────────────────────────────────────
Write-Host "[server] Starting DocuVault backend..." -ForegroundColor Cyan
Set-Location "$PSScriptRoot\server"
npm run dev
