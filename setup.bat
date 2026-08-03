@echo off
title WinTools Setup
echo ================================================
echo   WinTools - First-Time Setup
echo ================================================
echo.

cd /d "%~dp0"

:: Check Python
python --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [!] Python not found. Installing via winget...
    winget install Python.Python.3.12 --accept-package-agreements --accept-source-agreements
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo Error: Could not install Python. Please install manually from python.org
        pause
        exit /b 1
    )
    echo [OK] Python installed.
)

:: Install dependencies
echo.
echo [1/2] Installing Python dependencies...
pip install flask pywebview cryptography boto3 --quiet
if %ERRORLEVEL% NEQ 0 (
    echo Error: Could not install dependencies.
    pause
    exit /b 1
)
echo [OK] Dependencies installed.

:: Create data directory
if not exist "data" mkdir data

echo.
echo [2/2] Launching WinTools Dashboard...
echo.
python wintools.py

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Error: Could not start WinTools.
    pause
)