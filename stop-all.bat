@echo off
chcp 65001 >nul
title Elite Control — إيقاف الخدمات (OMR + Frontend)
cd /d "%~dp0"

echo ========================================================
echo        نظام كنترول نخبة الشمال (Elite Control)
echo          إيقاف محرك OMR والواجهة الأمامية
echo ========================================================
echo.

echo [1/2] إيقاف العمليات المرتبطة بالمنفذ 8000 (محرك OMR)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo [2/2] إيقاف العمليات المرتبطة بالمنفذ 5173 (الواجهة الأمامية)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo.
echo ========================================================
echo   تم إيقاف الخدمات بنجاح أو التأكد من إغلاق المنافذ.
echo ========================================================
echo.
pause
