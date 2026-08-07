@echo off
title WinSuite Build Script
echo ================================================
echo   WinSuite - Build Installer
echo ================================================
echo.

cd /d "%~dp0"

:: ── Configuration ──────────────────────────────────────────────────
set APP_NAME=WinSuite
set APP_VERSION=1.0.0
set PYTHON=python

:: ── Step 1: Check Prerequisites ────────────────────────────────

echo [1/4] Checking prerequisites...

%PYTHON% --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [!] Python not found. Please install Python 3.10+ and add it to PATH.
    pause
    exit /b 1
)

pip show pyinstaller >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [!] PyInstaller not found. Installing...
    pip install pyinstaller --quiet
    if %ERRORLEVEL% NEQ 0 (
        echo [!] Failed to install PyInstaller.
        pause
        exit /b 1
    )
)

echo [OK] Prerequisites met.

:: ── Step 2: Clean previous builds ──────────────────────────────

echo.
echo [2/4] Cleaning previous builds...

if exist "dist" rmdir /s /q "dist"
if exist "build" rmdir /s /q "build"
if exist "output" mkdir "output"

:: ── Step 3: Build with PyInstaller ──────────────────────────────

echo.
echo [3/4] Building %APP_NAME% with PyInstaller...
echo This may take a few minutes...

%PYTHON% -m PyInstaller ^
    --name "%APP_NAME%" ^
    --noconsole ^
    --onedir ^
    --clean ^
    --noconfirm ^
    --add-data "templates;templates" ^
    --add-data "static;static" ^
    --add-data "scan-apps.ps1;." ^
    --add-data "scan-tweaks.ps1;." ^
    --add-data "scan-winoptions.ps1;." ^
    --add-data "scan-privacy.ps1;." ^
    --add-data "scan-privacy-apps.ps1;." ^
    --add-data "scan-secrets.ps1;." ^
    --add-data "privacy.py;." ^
    --add-data "tweaks.py;." ^
    --add-data "winoptions.py;." ^
    --add-data "software_catalog.py;." ^
    --add-data "migrate.py;." ^
    --hidden-import flask ^
    --hidden-import pywebview ^
    --hidden-import pywebview.winforms ^
    --hidden-import cryptography ^
    --hidden-import boto3 ^
    --hidden-import botocore ^
    --hidden-import urllib3 ^
    --hidden-import jinja2 ^
    --hidden-import werkzeug ^
    --hidden-import itsdangerous ^
    --hidden-import click ^
    --hidden-import markupsafe ^
    --exclude-module tkinter ^
    --exclude-module matplotlib ^
    --exclude-module numpy ^
    --exclude-module pandas ^
    --exclude-module scipy ^
    --exclude-module PIL ^
    --exclude-module pytest ^
    --exclude-module setuptools ^
    --exclude-module pip ^
    wintools.py

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [!] PyInstaller build failed. Check the output above for errors.
    pause
    exit /b 1
)

echo [OK] PyInstaller build complete.

:: ── Step 4: Copy additional files ───────────────────────────────

echo.
echo [4/4] Copying additional files...

:: Create data directory
if not exist "dist\%APP_NAME%\data" mkdir "dist\%APP_NAME%\data"

:: Copy PowerShell scripts (they're also in the bundle but having them in data/ is safer)
copy /y "scan-apps.ps1" "dist\%APP_NAME%\" >nul
copy /y "scan-tweaks.ps1" "dist\%APP_NAME%\" >nul
copy /y "scan-winoptions.ps1" "dist\%APP_NAME%\" >nul
copy /y "scan-privacy.ps1" "dist\%APP_NAME%\" >nul
copy /y "scan-privacy-apps.ps1" "dist\%APP_NAME%\" >nul
copy /y "scan-secrets.ps1" "dist\%APP_NAME%\" >nul

echo [OK] Files copied.

:: ── Done ──────────────────────────────────────────────────────────

echo.
echo ================================================
echo   Build complete!
echo.
echo   Portable app: dist\%APP_NAME%\%APP_NAME%.exe
echo.
echo   To create an installer, run Inno Setup on:
echo   installer\setup.iss
echo.
echo   Or run: build-installer.bat
echo ================================================

pause