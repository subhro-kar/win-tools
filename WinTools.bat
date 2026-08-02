@echo off
title WinTools Dashboard
echo ================================================
echo   WinTools - Windows System Management Dashboard
echo ================================================
echo.
echo Starting dashboard...
echo.

cd /d "%~dp0"
python wintools.py

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Error: Could not start WinTools.
    echo Make sure Python is installed and in your PATH.
    echo.
    pause
)