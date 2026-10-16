/**
 * =========================================================
 * LIBAS (Lintau Buo Administration System)
 * File: version-checker.js
 * Deskripsi: Modul kontrol versi terpusat berbasis Cloud Firestore.
 * Mendeteksi versi aplikasi saat ini dan memunculkan modal
 * "Force Update" (seperti game online) jika ada versi baru.
 * =========================================================
 */

import { doc, getDoc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { db } from "../firebase.component/firebase-init.js";

// Versi aplikasi yang sedang terpasang di komputer saat ini
export const CURRENT_APP_VERSION = "1.0.0";

/**
 * Membandingkan 2 nomor versi semver (misal "1.0.0" vs "1.1.0").
 * Mengembalikan:
 *   1  jika v1 > v2
 *  -1  jika v1 < v2
 *   0  jika v1 === v2
 */
export function compareVersions(v1, v2) {
    const parts1 = String(v1).replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
    const parts2 = String(v2).replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
    const maxLen = Math.max(parts1.length, parts2.length);

    for (let i = 0; i < maxLen; i++) {
        const num1 = parts1[i] || 0;
        const num2 = parts2[i] || 0;
        if (num1 > num2) return 1;
        if (num1 < num2) return -1;
    }
    return 0;
}

/**
 * Menampilkan popup modal pembaruan (SweetAlert2)
 */
export function showUpdateModal(serverData, isForceUpdate) {
    if (typeof Swal === 'undefined') {
        console.warn("[VersionChecker] SweetAlert2 belum termuat.");
        return;
    }

    const whatsNewList = Array.isArray(serverData.whats_new) 
        ? serverData.whats_new.map(item => `<li>${item}</li>`).join('')
        : '<li>Peningkatan performa dan stabilitas sistem peternakan.</li>';

    const downloadUrl = serverData.download_url || '#';

    // Kunci tombol login jika wajib update (Force Update)
    if (isForceUpdate) {
        const loginBtn = document.getElementById('loginBtn');
        const loginForm = document.getElementById('loginForm');
        if (loginBtn) {
            loginBtn.disabled = true;
            loginBtn.style.opacity = '0.5';
            loginBtn.style.cursor = 'not-allowed';
            loginBtn.innerHTML = '<span class="btn-text">Wajib Update Aplikasi</span>';
        }
        if (loginForm) {
            loginForm.style.filter = 'grayscale(0.6)';
        }
    }

    Swal.fire({
        icon: isForceUpdate ? 'warning' : 'info',
        title: `<span style="font-weight:700; color:#fff;">${serverData.title || 'Pembaruan Sistem Tersedia'}</span>`,
        html: `
            <div style="font-family:'Poppins',sans-serif; text-align:center; padding: 4px;">
                <div style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255,255,255,0.1); padding: 14px; border-radius: 12px; margin-bottom: 16px;">
                    <div style="font-size: 13px; color: #bbb;">Versi Terpasang: <strong style="color: #ffb74d;">v${CURRENT_APP_VERSION}</strong></div>
                    <div style="font-size: 15px; color: #fff; margin-top: 4px;">Versi Terbaru: <strong style="color: #4caf50;">v${serverData.latest_version}</strong></div>
                    ${serverData.release_date ? `<div style="font-size: 11px; color: #888; margin-top: 4px;">Dirilis pada: ${serverData.release_date}</div>` : ''}
                </div>

                <div style="text-align: left; background: rgba(0, 0, 0, 0.25); border-left: 4px solid #2196f3; padding: 12px 14px; border-radius: 8px; margin-bottom: 10px;">
                    <div style="font-weight: 600; font-size: 13px; color: #90caf9; margin-bottom: 6px;">📋 Catatan Perubahan:</div>
                    <ul style="margin: 0; padding-left: 18px; font-size: 12px; color: #ddd; line-height: 1.6;">
                        ${whatsNewList}
                    </ul>
                </div>

                ${isForceUpdate ? `
                    <div style="font-size: 12px; color: #ef5350; font-weight: 500; margin-top: 12px;">
                        ⚠️ Anda wajib memperbarui aplikasi ke versi terbaru agar sinkronisasi data peternakan tetap akurat.
                    </div>
                ` : ''}
            </div>
        `,
        background: '#1e2430',
        color: '#ffffff',
        confirmButtonColor: '#2e7d32',
        confirmButtonText: '📥 Unduh Pembaruan Sekarang',
        showCancelButton: !isForceUpdate,
        cancelButtonText: 'Nanti Saja',
        cancelButtonColor: '#546e7a',
        allowOutsideClick: !isForceUpdate,
        allowEscapeKey: !isForceUpdate,
        customClass: {
            popup: 'swal2-border-radius-16'
        }
    }).then((result) => {
        if (result.isConfirmed) {
            if (downloadUrl && downloadUrl !== '#') {
                window.open(downloadUrl, '_blank');
            } else {
                Swal.fire({
                    icon: 'info',
                    title: 'Tautan Unduhan',
                    text: 'Silakan jalankan file buat-installer.bat untuk membuat file installer versi v' + serverData.latest_version,
                    background: '#1e2430',
                    color: '#fff'
                });
            }
        }
    });
}

/**
 * Memulai pengecekan versi aplikasi ke Cloud Firestore.
 */
export async function initVersionChecker() {
    console.log(`[VersionChecker] Memeriksa versi aplikasi (Lokal: v${CURRENT_APP_VERSION})...`);
    const docRef = doc(db, "system_config", "app_version");

    try {
        // Pasang listener real-time
        onSnapshot(docRef, (snapshot) => {
            if (!snapshot.exists()) {
                console.log("[VersionChecker] Dokumen app_version belum ada di Firestore.");
                return;
            }
            const data = snapshot.data();
            const latestVer = data.latest_version || CURRENT_APP_VERSION;
            const minReqVer = data.min_required_version || CURRENT_APP_VERSION;
            const forceUpdate = !!data.force_update;

            const isOutdated = compareVersions(CURRENT_APP_VERSION, latestVer) < 0;
            const isCritical = compareVersions(CURRENT_APP_VERSION, minReqVer) < 0 || forceUpdate;

            console.log(`[VersionChecker] Server: v${latestVer} | Lokal: v${CURRENT_APP_VERSION} | Outdated: ${isOutdated} | Wajib: ${isCritical}`);

            if (isOutdated) {
                showUpdateModal(data, isCritical);
            }
        }, (err) => {
            // Tangani silent jika aturan security rules belum mengizinkan read publik
            console.warn("[VersionChecker] Info: Izin baca Firestore system_config memerlukan rules 'allow read: if true;'.", err.message);
        });

    } catch (err) {
        console.warn("[VersionChecker] Pengecekan versi dilewati:", err.message);
    }
}

/**
 * 🛠️ HELPER UNTUK SIDANG / PENGUJIAN LANGSUNG:
 * Menampilkan simulasi popup update secara instan di layar tanpa tergantung permission Firestore!
 * Contoh di console: simulateServerVersion("1.1.0", true)
 */
window.simulateServerVersion = (newVersion = "1.1.0", force = true) => {
    const mockData = {
        latest_version: newVersion,
        min_required_version: newVersion,
        force_update: force,
        release_date: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
        title: `Pembaruan Sistem LIBAS v${newVersion}`,
        whats_new: [
            "Pembaruan algoritma peramalan Moving Average dengan koreksi mortalitas",
            "Fitur ekspor laporan keuangan dan produksi format baru",
            "Penyempurnaan performa dan kestabilan aplikasi desktop"
        ],
        download_url: "https://github.com"
    };

    // 1. TAMPILKAN LANGSUNG DI LAYAR (Instan & Bebas Izin)
    showUpdateModal(mockData, force);
    console.log(`%c[DEMO BERHASIL] Popup versi v${newVersion} (Force: ${force}) berhasil ditampilkan di layar!`, "color: #4caf50; font-weight: bold; font-size: 14px;");

    // 2. Opsi tambahan: Coba simpan ke Firestore (jika user sudah punya hak tulis)
    try {
        const docRef = doc(db, "system_config", "app_version");
        setDoc(docRef, mockData, { merge: true })
            .then(() => console.log("%c[CLOUD SYNC] Data versi juga berhasil tersimpan ke Firestore!", "color: #2196f3;"))
            .catch(() => {
                // Diabaikan karena simulasi visual sudah tampil
            });
    } catch (_) {}
};

/**
 * Mengembalikan tampilan ke normal
 */
window.resetServerVersion = () => {
    if (typeof Swal !== 'undefined') {
        Swal.close();
    }
    const loginBtn = document.getElementById('loginBtn');
    const loginForm = document.getElementById('loginForm');
    if (loginBtn) {
        loginBtn.disabled = false;
        loginBtn.style.opacity = '1';
        loginBtn.style.cursor = 'pointer';
        loginBtn.innerHTML = '<span class="btn-text">Masuk</span>';
    }
    if (loginForm) {
        loginForm.style.filter = 'none';
    }
    console.log("%c[DEMO RESET] Tampilan berhasil dikembalikan ke normal.", "color: #ff9800; font-weight: bold;");
};
