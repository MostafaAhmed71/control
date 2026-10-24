@echo off
chcp 65001 >nul
title OMR Engine — port 8000
cd /d "%~dp0omr_engine"

set "VENV_DIR=%~dp0omr_engine\venv312"
set "PY=%VENV_DIR%\Scripts\python.exe"

if not exist "%PY%" (
    if exist "%~dp0omr_engine\venv\Scripts\python.exe" (
        set "VENV_DIR=%~dp0omr_engine\venv"
        set "PY=%~dp0omr_engine\venv\Scripts\python.exe"
    )
)

set "NEED_SETUP=0"
if not exist "%PY%" (
    set "NEED_SETUP=1"
) else (
    "%PY%" -c "import fastapi, cv2, uvicorn" >nul 2>&1
    if errorlevel 1 set "NEED_SETUP=1"
)

if "%NEED_SETUP%"=="0" goto run_engine

echo Setting up the OMR Python environment...
set "BASE_PY="
py -3.12 --version >nul 2>&1 && set "BASE_PY=py -3.12"
if defined BASE_PY goto python_found
py -3.11 --version >nul 2>&1 && set "BASE_PY=py -3.11"
if defined BASE_PY goto python_found
py -3 --version >nul 2>&1 && set "BASE_PY=py -3"
if defined BASE_PY goto python_found
python --version >nul 2>&1 && set "BASE_PY=python"
if defined BASE_PY goto python_found
echo [ERROR] Install Python 3.12 and add it to PATH.
pause
exit /b 1

:python_found
if exist "%PY%" goto install_packages
set "VENV_DIR=%~dp0omr_engine\venv312"
set "PY=%~dp0omr_engine\venv312\Scripts\python.exe"
%BASE_PY% -m venv "%VENV_DIR%"
if errorlevel 1 goto setup_failed
if not exist "%PY%" goto setup_failed

:install_packages
"%PY%" -m pip install -r "%~dp0omr_engine\requirements.txt"
if errorlevel 1 goto setup_failed
goto run_engine

:setup_failed
echo [ERROR] OMR setup failed. Review the message above.
pause
exit /b 1

:run_engine

echo ===================================================
echo   محرك OMR — http://127.0.0.1:8000
echo   docs: http://127.0.0.1:8000/docs
echo ===================================================
echo.

"%PY%" main.py
pause
