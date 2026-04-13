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
    window.location.href = 'editProfileTAalip.html';
};

// Menunggu struktur DOM selesai dimuat
document.addEventListener('DOMContentLoaded', () => {
    
    // Mengecek Status Login Pengguna secara Realtime dari Firebase
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // Jika ada pengguna yang sedang login, ubah tampilan nama profilnya
            const profileNameElements = document.querySelectorAll('.profile-name');
            
            // Nama cadangan menggunakan Username atau string default 'Peternak'
            let displayNameResult = user.displayName || 'Peternak';
            
            // Coba ambil "Nama Lengkap" dari database Firestore
            try {
                const userDocSnap = await getDoc(doc(db, "user", user.uid));
                if (userDocSnap.exists() && userDocSnap.data().fullname) {
                    displayNameResult = userDocSnap.data().fullname;
                }
            } catch (err) {
                console.error("Gagal mengambil nama lengkap: ", err);
            }

            profileNameElements.forEach(el => {
                // Terapkan nama lengkap (atau nama sandaran) ke elemen sidebar
                el.textContent = displayNameResult;
            });
        } else {
            // Jika tidak ada user login (Optional: bisa diarahkan paksa ke login.html)
            // window.location.href = 'login.html';
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
