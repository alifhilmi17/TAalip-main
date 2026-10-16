@echo off
title LIBAS Desktop Launcher
cd /d "%~dp0.."

echo ========================================================
echo   MEMULAI APLIKASI DESKTOP LIBAS (Lintau Buo Administration System)
echo ========================================================
echo.
echo [1] Membersihkan instance lama di background...
taskkill /F /IM electron.exe >nul 2>&1

echo [2] Meluncurkan aplikasi Desktop...
echo.
call npm.cmd start

echo.
echo [3] Aplikasi ditutup.
pause
