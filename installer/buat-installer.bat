@echo off
title LIBAS Installer Builder
cd /d "%~dp0.."

for /f "delims=" %%v in ('node -e "console.log(require('./package.json').version)"') do set "APP_VERSION=%%v"

echo ========================================================
echo   MEMBUAT INSTALLER WINDOWS (.EXE) - LIBAS v%APP_VERSION%
echo ========================================================
echo.
echo [1] Menutup proses aplikasi yang sedang berjalan...
taskkill /F /IM electron.exe /IM LIBAS.exe >nul 2>&1

echo [2] Membersihkan direktori build lama...
if exist dist_installer (
    rmdir /s /q dist_installer >nul 2>&1
    if exist dist_installer powershell -NoProfile -Command "Remove-Item -Path 'dist_installer' -Recurse -Force -ErrorAction SilentlyContinue"
)

echo [3] Mengompilasi dan mengemas aplikasi ke format .exe...
call npm.cmd run dist

echo.
echo ========================================================
echo   PROSES SELESAI!
echo   Cek folder "dist_installer" untuk melihat file installer:
echo   - LIBAS Setup %APP_VERSION%.exe (Installer Wizard)
echo   - LIBAS %APP_VERSION%.exe (Versi Portable)
echo ========================================================
pause
