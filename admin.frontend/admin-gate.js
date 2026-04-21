/**
 * =========================================================
 * SISTEM ADMINISTRASI PETERNAKAN (LIBAS)
 * File: admin-gate.js
 * Deskripsi: Gerbang keamanan tingkat lanjut untuk memastikan 
 * hanya pengguna dengan level 'admin' yang dapat mengakses 
 * halaman Admin Panel. Menggunakan Firebase Auth & Firestore.
 * =========================================================
 */

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { auth, db } from "../firebase.component/firebase-init.js";
import { logActivity } from "./admin-core/admin.js";

/**
 * ===== 1. INISIALISASI KEAMANAN =====
 * Sembunyikan konten utama sampai verifikasi selesai agar tidak terjadi "flicker"
 * demi menjaga integritas privasi data admin.
 */
document.body.style.opacity = '0';
document.body.style.transition = 'opacity 0.5s ease';

/**
 * ===== 2. MONITOR STATUS AUTENTIKASI =====
 * Memantau setiap perubahan status login secara real-time.
 */
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        // Kasus A: Sesi login tidak ditemukan, lempar kembali ke gerbang login utama
        console.warn("Akses ditolak: Sesi tidak ditemukan. Mengarahkan ke Login.");
        window.location.href = '../../login.html';
        return;
    }

    try {
        // Kasus B: Sesi ditemukan, validasi kewenangan di Koleksi 'admin' (Source of Truth)
        const adminRef = doc(db, "admin", user.uid);
        const adminSnap = await getDoc(adminRef);

        if (adminSnap.exists()) {
            const adminData = adminSnap.data();
            console.log("Akses Diterima: Selamat datang, Administrator!");
            
            // ✅ Kirim data admin ke modul lain via Custom Event
            window.dispatchEvent(new CustomEvent('admin:verified', { detail: adminData }));

            // Dokumentasikan akses masuk ke Log Aktivitas Global
            logActivity(adminData.username || user.email, "Otentikasi", "Login ke Panel Admin Berhasil");
            
            // Tampilkan kembali interface setelah status admin terverifikasi
            document.body.style.opacity = '1';
        } else {
            // Kasus C: Login valid namun bukan level Administrator
            logActivity(user.email, "Keamanan", "Percobaan Akses Admin Ditolak (Unauthorized)");
            handleAccessDenied("Anda tidak memiliki hak akses Administrator.");
        }
    } catch (error) {
        // Penanganan kendala jaringan atau kegagalan komunikasi database
        console.error("Kesalahan Verifikasi Keamanan:", error);
        handleAccessDenied("Gagal memverifikasi status admin: " + error.message);
    }
});

/**
 * ===== 3. FUNGSI PEMBANTU (HELPERS) =====
 */

/**
 * Menangani penolakan akses dengan interface notifikasi yang elegan
 * @param {string} message - Pesan detail penyebab penolakan
 */
function handleAccessDenied(message) {
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: 'error',
            title: 'Akses Dibatasi',
            text: message,
            confirmButtonText: 'Kembali ke Dashboard',
            confirmButtonColor: '#f97316'
        }).then(() => {
            window.location.href = '../../dashboardTAalip.html';
        });
    } else {
        alert("Peringatan Keamanan: " + message);
        window.location.href = '../../dashboardTAalip.html';
    }
}
