/* =========================================================
   SISTEM ADMINISTRASI PETERNAKAN (LIBAS)
   File: signup-interactive.js
   Deskripsi: Script khusus yang menangani peristiwa (event) 
   saat pengguna baru mendaftar akun agar tersambung ke Firebase Auth.
========================================================= */

// 1. Impor fungsi Firebase untuk meregistrasi pengguna dengan metode email & sandi, 
// serta fungsi untuk menambahkan nama profil dan melakukan pemutusan sesi paksa
import { createUserWithEmailAndPassword, updateProfile, signOut } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

// 2. Impor objek `auth` dan `db` yang sudah disiapkan dari file koneksi utama
import { auth, db } from "./firebase-init.js";

// Pastikan semua struktur HTML telah dirender browser sebelum menjalankan script
document.addEventListener('DOMContentLoaded', () => {
    
    // Mendapatkan elemen form pendaftaran dan tombol klik
    const signupForm = document.getElementById('signupForm');
    const signupBtn = document.querySelector('.signup-btn');

    // Jika form pendaftaran ditemukan di halaman, tambahkan event pendengar saat submit ditekan
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            
            // Mencegah halaman termuat ulang otomatis (Prevent Default behaviour)
            e.preventDefault();

            // Ubah state tombol agar memberikan efek memuat daya (Loading)
            const originalText = signupBtn.textContent;
            signupBtn.textContent = 'Memproses...';
            signupBtn.disabled = true; // Nonaktifkan klik berulang

            // Menangkap semua isian dari kolom-kolom biodata formulir
            const fullname = document.getElementById('fullname').value;
            const username = document.getElementById('username').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            try {
                // Proses krusial: Meminta Firebase membuat data akun di menu Authentication
                // berdasarkan kombinasi Email dan Sandinya
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                
                // Jika proses pendaftaran sukses, rekatkan data "username" ke profil dasarnya
                await updateProfile(userCredential.user, {
                    displayName: username
                });

                // Menyimpan seluruh biodata awal registrasi (termasuk fullname) 
                // ke dalam sebuah catatan Firestore yang tersusun berdasar UID akun tersebut
                await setDoc(doc(db, "user", userCredential.user.uid), {
                    uid: userCredential.user.uid,
                    fullname: fullname,
                    username: username,
                    email: email,
                    phone: "",  // nomor telpon diset kosong secara standar
                    createdAt: new Date()
                });

                // (Opsional) Simpan data alias username ke penyimpanan lokal perangkat (Local Storage)
                // Ini berguna untuk digunakan memanggil sapaan pengguna di menu lain nantinya
                localStorage.setItem('libas_username', username);
                
                // Mencegah login otomatis sesaat setelah daftar: memutuskan sesi (Log Out seketika)
                // agar pengguna murni mencoba form login.
                await signOut(auth);
                
                // Menampilkan pengumuman sukses
                alert("Pendaftaran berhasil! Silahkan login dengan akun yang baru dibuat...");
                
                // Setelah selesai mendaftar dan logout, arahkan ke gerbang keamanan Login Utama
                window.location.href = 'login.html';

            } catch (error) {
                // Di tahap ini (Blok Catch) diartikan bahwa proses registrasi gagal.
                // Kembalikan nama tombol menjadi normal "Daftar"
                signupBtn.textContent = originalText;
                signupBtn.disabled = false;

                // Mengolah balasan kode kesalahan sistem (error message) dari Firebase 
                // menjadi bahasa Indonesia yang luwes dan dimengerti peternak
                let errorMsg = "Terjadi kesalahan saat mendaftar.";
                if (error.code === 'auth/email-already-in-use') {
                    errorMsg = "Email ini sudah terdaftar. Silakan login atau gunakan email lain.";
                } else if (error.code === 'auth/weak-password') {
                    errorMsg = "Password terlalu lemah. Harus minimal 6 karakter.";
                } else if (error.code === 'auth/invalid-email') {
                    errorMsg = "Format email tidak valid.";
                } else {
                    errorMsg = error.message; // Tangkap tipe error unik lainnya
                }
                
                // Melontarkan dialog peringatan penyebab kegagalan daftar
                alert("Gagal daftar: " + errorMsg);
            }
        });
    }
});
