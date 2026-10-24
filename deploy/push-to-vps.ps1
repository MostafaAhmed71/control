# رفع التحديثات إلى VPS — نفّذ من PowerShell في مجلد المشروع
# مثال: .\deploy\push-to-vps.ps1
# مثال: .\deploy\push-to-vps.ps1 -WithFrontend
# مثال: .\deploy\push-to-vps.ps1 -Server root@72.62.178.181

param(
    [string]$Server = "root@72.62.178.181",
    [switch]$WithFrontend,
    [switch]$WithWhatsApp
)

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root
if (-not (Test-Path "$Root\omr_engine\scanner.py")) {
    throw "لم يُعثر على omr_engine\scanner.py في $Root"
}

Write-Host "=== رفع إلى $Server ===" -ForegroundColor Cyan
Write-Host "المجلد: $Root`n"

# 1) إصلاح OMR (الأهم)
Write-Host "[1/3] رفع omr_engine (scanner.py + main.py) ..." -ForegroundColor Yellow
scp "$Root\omr_engine\scanner.py" "${Server}:/opt/control/omr_engine/scanner.py"
scp "$Root\omr_engine\main.py" "${Server}:/opt/control/omr_engine/main.py"

Write-Host "[2/3] إعادة تشغيل OMR (PM2 أو uvicorn) ..." -ForegroundColor Yellow
$restartCmd = @'
set -e
OMR_DIR=/opt/control/omr_engine
PY=$OMR_DIR/venv/bin/python
if pm2 describe omr >/dev/null 2>&1; then
  pm2 restart omr
else
  pkill -f "uvicorn main:app --host 127.0.0.1 --port 8000" 2>/dev/null || true
  sleep 2
  cd "$OMR_DIR"
  pm2 start "$PY" --name omr --cwd "$OMR_DIR" -- -m uvicorn main:app --host 127.0.0.1 --port 8000
  pm2 save
fi
sleep 5
curl -sS -o /dev/null -w "omr: %{http_code}\n" http://127.0.0.1:8000/docs
curl -sS http://127.0.0.1:8000/engine-info
'@
ssh $Server $restartCmd

if ($WithFrontend) {
    Write-Host "[+] بناء الواجهة ..." -ForegroundColor Yellow
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }
    Write-Host "[+] رفع dist ..." -ForegroundColor Yellow
    scp -r "$Root\dist\*" "${Server}:/opt/control/dist/"
    ssh $Server "sudo chown -R caddy:caddy /opt/control/dist && sudo systemctl reload caddy"
}

if ($WithWhatsApp) {
    Write-Host "[+] رفع whatsapp-server.js ..." -ForegroundColor Yellow
    scp "$Root\wppconnect-master\whatsapp-server.js" "${Server}:/opt/wppconnect/whatsapp-server.js"
    ssh $Server "pm2 restart wppconnect"
}

Write-Host "`n=== تم ===" -ForegroundColor Green
Write-Host "تحقق: curl -sS https://control0.northelite0.com/api/omr/docs أو من السيرفر:"
Write-Host "  ssh $Server 'curl -sS -o /dev/null -w %{http_code} http://127.0.0.1:8000/docs'"
