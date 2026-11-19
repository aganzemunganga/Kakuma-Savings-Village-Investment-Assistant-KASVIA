@echo off
title KASVIA - Village Savings and Loans System
cd /d "%~dp0..\app"
echo ============================================
echo   KASVIA - Kakuma Savings and Village
echo   Investment Assistant
echo ============================================
echo.
echo Starting local server (no internet required)...
echo.
where python >nul 2>nul
if %errorlevel%==0 (
    for /f "tokens=4" %%i in ('route print ^| find " 0.0.0.0"') do set LOCALIP=%%i
    echo On THIS computer, open:   http://localhost:8080
    echo On PHONES on the SAME WiFi/hotspot, open:  http://%LOCALIP%:8080
    echo.
    echo Keep this window open while using KASVIA. Close it to stop the server.
    echo.
    start "" http://localhost:8080
    python -m http.server 8080
) else (
    echo Python was not found on this computer.
    echo.
    echo Option 1: Install Python from https://python.org, then run this file again.
    echo Option 2: Just open app\index.html to open KASVIA directly in your browser
    echo           (works fully offline, but phones on other devices cannot connect to it).
    pause
)
