@echo off
title LIBAS Installer Builder
cd /d "%~dp0"

echo ========================================================
echo   MEMBUAT INSTALLER WINDOWS (.EXE) - LIBAS DESKTOP
echo ========================================================
echo.
echo [1] Menutup proses aplikasi yang sedang berjalan...
taskkill /F /IM electron.exe /IM LIBAS.exe >nul 2>&1

echo [2] Membersihkan direktori build lama...
if exist dist_installer rmdir /s /q dist_installer

echo [3] Mengompilasi dan mengemas aplikasi ke format .exe...
call npm.cmd run dist

echo.
echo ========================================================
echo   PROSES SELESAI!
echo   Cek folder "dist_installer" untuk melihat file installer:
echo   - LIBAS Setup 1.0.0.exe (Installer Wizard)
echo   - LIBAS 1.0.0.exe (Versi Portable)
echo ========================================================
pause
