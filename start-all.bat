@echo off
chcp 65001 >nul
title Elite Control — تشغيل محرك OMR والواجهة الأمامية
cd /d "%~dp0"

echo ========================================================
echo        نظام كنترول نخبة الشمال ^(Elite Control^)
echo          تشغيل محرك OMR والواجهة الأمامية معاً
echo ========================================================
echo.

if not exist "%~dp0start-omr.bat" (
    echo [خطأ] لم يتم العثور على ملف start-omr.bat
    pause
    exit /b 1
)

if not exist "%~dp0start-dev.bat" (
    echo [خطأ] لم يتم العثور على ملف start-dev.bat
    pause
    exit /b 1
)

:: فحص الواجهة لأول مرة قبل بدء الخدمات
if not exist "%~dp0node_modules\" (
    echo ========================================================
    echo   [تهيئة لأول مرة] جاري تثبيت حزم الواجهة ^(npm install^)...
    echo ========================================================
    call npm install
    if errorlevel 1 (
        echo [خطأ] فشل تثبيت مكتبات الواجهة.
        pause
        exit /b 1
    )
    echo تم تثبيت مكتبات الواجهة بنجاح!
    echo.
)

:: 1. تشغيل محرك OMR (Port 8000) في نافذة منفصلة
echo [1/2] جاري تشغيل محرك OMR ^(FastAPI - Port 8000^)...
start "OMR Engine — port 8000" "%~dp0start-omr.bat"

:: مهلة قصيرة لإتاحة الفرصة للمحرك للبدء
echo مهلة قصيرة لتهيئة المحرك...
powershell -NoProfile -Command "Start-Sleep -Seconds 2"

:: 2. تشغيل الواجهة الأمامية في هذه النافذة
echo.
echo [2/2] جاري تشغيل الواجهة الأمامية ^(Vite Dev Server^)...
echo ========================================================
echo   - محرك OMR:  http://127.0.0.1:8000  ^(في نافذة منفصلة^)
echo   - توثيق API: http://127.0.0.1:8000/docs
echo   - الواجهة:   http://localhost:5173  ^(في هذه النافذة^)
echo ========================================================
echo.

call "%~dp0start-dev.bat"
