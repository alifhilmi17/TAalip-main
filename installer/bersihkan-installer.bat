@echo off
title Bersihkan Folder Installer LIBAS
cd /d "%~dp0.."

echo ========================================================
echo   BERSIHKAN FOLDER DIST_INSTALLER - LIBAS DESKTOP
echo ========================================================
echo.
echo [1] Menutup proses aplikasi yang mungkin masih berjalan...
taskkill /F /IM LIBAS.exe /IM electron.exe >nul 2>&1

echo.
echo [2] Menghapus folder dist_installer dan seluruh isinya...
if exist dist_installer (
    rmdir /s /q dist_installer
    if exist dist_installer (
        echo ⚠️ Gagal menghapus seluruh file. Mencoba hapus paksa dengan PowerShell...
        powershell -NoProfile -Command "Remove-Item -Path 'dist_installer' -Recurse -Force -ErrorAction SilentlyContinue"
    )
    if not exist dist_installer (
        echo ✅ Folder dist_installer berhasil dihapus bersih!
    ) else (
        echo ❌ Masih ada file yang terkunci. Pastikan Anda sudah menutup File Explorer yang membuka folder dist_installer.
    )
) else (
    echo ℹ️ Folder dist_installer sudah bersih / belum dibuat.
)

echo.
echo ========================================================
pause
