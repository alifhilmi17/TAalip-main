/**
 * =========================================================
 * SISTEM ADMINISTRASI PETERNAKAN (LIBAS)
 * File: admin-gate.js
 * Deskripsi: Gerbang keamanan tingkat lanjut untuk memastikan 
 * hanya pengguna dengan level 'admin' yang dapat mengakses 
 * halaman Admin Panel.
 * =========================================================
 */

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { auth, db } from "../firebase.component/firebase-init.js";
import { logActivity } from "./admin-core/admin.js";

// Sembunyikan konten utama sampai verifikasi selesai agar tidak terjadi "flicker"
document.body.style.opacity = '0';
document.body.style.transition = 'opacity 0.5s ease';

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        // 1. Kasus: Tidak ada sesi login sama sekali
        console.warn("Akses ditolak: Sesi tidak ditemukan. Mengarahkan ke Login.");
        window.location.href = '../../login.html';
        return;
    }

    try {
        // 2. Kasus: Teridentifikasi Login, Periksa Data di KOLEKSI: admin
        const adminRef = doc(db, "admin", user.uid);
        const adminSnap = await getDoc(adminRef);

        if (adminSnap.exists()) {
            const adminData = adminSnap.data();
            console.log("Akses Diterima: Selamat datang, Super Admin!");
            // Catat aktivitas login admin ke koleksi 'admin' log
            logActivity(adminData.username || user.email, "Otentikasi", "Login ke Panel Admin Berhasil");
            
            // Munculkan kembali konten karena verifikasi sukses
            document.body.style.opacity = '1';
        } else {
            // 3. Kasus: Login sebagai user biasa (tidak ada di koleksi admin)
            logActivity(user.email, "Keamanan", "Percobaan Akses Admin Ditolak (Unauthorized)");
            handleAccessDenied("Anda tidak memiliki hak akses Administrator.");
        }
    } catch (error) {
        console.error("Kesalahan Verifikasi Keamanan:", error);
        handleAccessDenied("Gagal memverifikasi status admin: " + error.message);
    }
});

/**
 * Helper untuk menangani penolakan akses dengan notifikasi premium
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
