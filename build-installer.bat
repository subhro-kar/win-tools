@echo off
title WinSuite - Build Installer
echo ================================================
echo   WinSuite - Build Windows Installer
echo ================================================
echo.

cd /d "%~dp0"

:: ── Check if Inno Setup is installed ──────────────────────────────
set ISCC="C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
if not exist %ISCC% set ISCC="C:\Program Files\Inno Setup 6\ISCC.exe"
if not exist %ISCC% (
    echo [!] Inno Setup 6 not found.
    echo     Please download and install from: https://jrsoftware.org/isdl.php
    echo.
    echo     After installing, run this script again.
    pause
    exit /b 1
)

:: ── Check if PyInstaller build exists ─────────────────────────────
if not exist "dist\WinSuite\WinSuite.exe" (
    echo [!] PyInstaller build not found. Running build.bat first...
    call build.bat
    if %ERRORLEVEL% NEQ 0 (
        echo [!] Build failed.
        pause
        exit /b 1
    )
)

echo [OK] Inno Setup found.
echo.
echo Building installer...

%ISCC% /Q installer\setup.iss

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [!] Installer build failed. Check the Inno Setup output above.
    pause
    exit /b 1
)

echo.
echo ================================================
echo   Installer built successfully!
echo.
echo   Output: output\WinSuite-Setup-1.0.0.exe
echo ================================================

pause