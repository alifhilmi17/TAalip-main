/* =========================================================
   SISTEM ADMINISTRASI PETERNAKAN (LIBAS)
   File: auth-state.js
   Deskripsi: Mengelola status autentikasi pengguna secara 
   real-time, pembaruan nama profil di UI, serta fungsi logout.
========================================================= */

import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { auth, db } from "./firebase-init.js";

/**
 * Global Helper: Navigasi ke Halaman Edit Profil
 * Fungsi ini dipanggil dari ikon pensil atau menu profil di Sidebar
 */
window.goToProfile = function() {
    // ✅ FIX: Deteksi lokasi saat ini untuk menentukan path yang tepat
    if (window.location.href.includes('admin-core')) {
        // Dari admin panel (admin.frontend/admin-core/)
        window.location.href = '../../editProfileTAalip.html';
    } else {
        // Dari halaman user biasa (root)
        window.location.href = 'editProfileTAalip.html';
    }
};

// Menunggu struktur DOM selesai dimuat
document.addEventListener('DOMContentLoaded', () => {
    
    // Mengecek Status Login Pengguna secara Realtime dari Firebase
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const profileNameElements = document.querySelectorAll('.profile-name');
            let displayNameResult = user.displayName || 'Peternak';
            let isAdminUser = false; // Flag apakah pengguna ini adalah administrator

            try {
                // === TAHAP 1: Cek koleksi 'user' (untuk pengguna biasa) ===
                const userDocSnap = await getDoc(doc(db, "user", user.uid));

                if (userDocSnap.exists()) {
                    const userData = userDocSnap.data();

                    // Paksa logout jika akun dinonaktifkan oleh admin
                    if (userData.disabled === true) {
                        console.warn("Akun dinonaktifkan oleh administrator.");
                        await signOut(auth);
                        alert("Akun Anda telah dinonaktifkan oleh administrator. Silakan hubungi admin.");
                        window.location.href = 'login.html';
                        return;
                    }

                    if (userData.fullname) {
                        displayNameResult = userData.fullname;
                    }
                    // Tandai sebagai admin jika field role = 'admin'
                    if (userData.role === 'admin') isAdminUser = true;

                } else {
                    // === TAHAP 2: Cek koleksi 'admin' (untuk administrator) ===
                    // Admin yang dibuat via adminlogin.html hanya punya dokumen di 'admin', bukan 'user'
                    const adminDocSnap = await getDoc(doc(db, "admin", user.uid));

                    if (adminDocSnap.exists()) {
                        // ✅ Admin terverifikasi — boleh akses halaman user tanpa login ulang
                        const adminData = adminDocSnap.data();
                        displayNameResult = adminData.fullname || adminData.username || 'Administrator';
                        isAdminUser = true;
                        console.log("Administrator mengakses halaman user — akses diberikan.");
                    } else if (!window.location.href.includes('admin')) {
                        // Bukan user, bukan admin, dan tidak sedang di halaman admin → paksa logout
                        console.warn("Sesi tidak valid: akun tidak ditemukan di database.");
                        await signOut(auth);
                        window.location.href = 'login.html';
                        return;
                    }
                }

                // === TAHAP 3: Tampilkan tombol "Kembali ke Admin Panel" ===
                // Gunakan flag isAdminUser untuk efisiensi (tidak perlu query ulang)
                // Hanya tampilkan jika tidak sedang di dalam folder admin-core
                if (!window.location.href.includes('admin-core')) {
                    if (isAdminUser) {
                        // Sudah tahu ini admin dari atas, langsung tampilkan
                        const container = document.getElementById('adminSwitchContainer');
                        if (container) container.style.display = 'block';
                    } else {
                        // Untuk user biasa, cek apakah punya role admin
                        const adminRef = doc(db, "admin", user.uid);
                        const adminSnap = await getDoc(adminRef);
                        if (adminSnap.exists()) {
                            const container = document.getElementById('adminSwitchContainer');
                            if (container) container.style.display = 'block';
                        }
                    }
                }

            } catch (err) {
                console.error("Gagal verifikasi data user/admin: ", err);
            }

            // Terapkan nama ke semua elemen .profile-name di sidebar
            profileNameElements.forEach(el => {
                el.textContent = displayNameResult;
            });

        } else {
            // Tidak ada user yang login — tidak ada tindakan paksa di sini
            // Guard per-halaman ada di masing-masing modul jika diperlukan
        }
    });

});

/**
 * Fungsi global untuk menangani proses Logout Pengguna.
 * Menggunakan SweetAlert jika tersedia untuk user experience yang lebih baik.
 */
window.logoutUser = async function() {
    // Mengecek apakah library SweetAlert2 tersedia untuk tampilan yang lebih premium
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: "Yakin ingin logout?",
            text: "Anda akan keluar dari sesi aplikasi.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Ya, Logout",
            cancelButtonText: "Batal",
            confirmButtonColor: "#f59e0b", // Oranye
            cancelButtonColor: "#64748b"  // Abu-abu netral
        }).then(async (result) => {
            if (result.isConfirmed) {
                executeLogout();
            }
        });
    } else {
        // Mekanisme konfirmasi standar browser (fallback)
        if (confirm("Apakah Anda yakin ingin keluar?")) {
            executeLogout();
        }
    }
};

/**
 * Fungsi internal untuk menjalankan proses pemutusan sesi Firebase
 */
async function executeLogout() {
    try {
        await signOut(auth);
        
        // Membersihkan cache lokal opsional
        localStorage.removeItem('libas_username');

        // Jika pakai Swal, tampilkan sukses sejenak lalu redirect
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'success',
                title: 'Berhasil Logout',
                showConfirmButton: false,
                timer: 1500
            }).then(() => {
                window.location.href = 'login.html';
            });
        } else {
            window.location.href = 'login.html';
        }
    } catch (error) {
        console.error("Gagal logout:", error);
        if (typeof Swal !== 'undefined') {
            Swal.fire('Gagal', 'Terjadi kesalahan saat logout: ' + error.message, 'error');
        } else {
            alert("Gagal melakukan logout: " + error.message);
        }
    }
}
