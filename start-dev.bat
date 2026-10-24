@echo off
chcp 65001 >nul
title Elite Control — Vite Dev
cd /d "%~dp0"

where npm >nul 2>&1
if errorlevel 1 (
    echo [خطأ] npm غير موجود — يرجى تثبيت Node.js أولاً من https://nodejs.org
    pause
    exit /b 1
)

if not exist "%~dp0node_modules\" (
    echo ========================================================
    echo   [تهيئة لأول مرة] جاري تثبيت حزم الواجهة ^(npm install^)...
    echo   قد يستغرق هذا دقيقة في أول مرة فقط...
    echo ========================================================
    call npm install
    if errorlevel 1 (
        echo [خطأ] فشل تثبيت حزم npm. تأكد من اتصال الإنترنت.
        pause
        exit /b 1
    )
    echo تم تثبيت حزم الواجهة بنجاح!
    echo.
)

echo ===================================================
echo   واجهة المشروع — npm run dev
echo   عادة: http://localhost:5173
echo ===================================================
echo.

call npm run dev
pause
