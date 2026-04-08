@echo off
echo ===================================================
echo               Starting Elite Control
echo ===================================================

:: تشغيل محرك الأوراق (OMR Engine) في نافذة منفصلة
echo Starting OMR Engine (Backend)...
start "OMR Engine" cmd /k "cd /d "%~dp0omr_engine" && .\venv\Scripts\python.exe main.py"

:: تشغيل واجهة المشروع في نافذة منفصلة
echo Starting Frontend (React/Vite Application)...
start "Frontend App" cmd /k "cd /d "%~dp0" && npm run dev"

echo Both services have been started in separate windows!
echo You can close this window.
exit
