/* =========================================================
   SISTEM ADMINISTRASI PETERNAKAN (LIBAS)
   File: editProfileTAalip.js
   ---------------------------------------------------------
   Deskripsi singkat:
   File ini mengontrol halaman Pengaturan Profil. Fitur paling 
   utama di sini adalah 'FileReader API' untuk Live Preview Foto
   Profil (merender gambar ke HTML tanpa perlu unggah ke server),
   serta Algoritma Validasi Ganda untuk fitur ganti kata sandi.
========================================================= */

import { onAuthStateChanged, updateProfile, updateEmail, updatePassword } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { auth, db } from "../firebase.component/firebase-init.js";

// =========================================
// 1. LOGIKA UTAMA (Berjalan Saat Layar Dimuat)
// Penjelasan: Eksekusi dikaitkan ke Event Listener DOMContentLoaded.
// =========================================
document.addEventListener("DOMContentLoaded", () => {
    // Definisi variabel dengan mengambil elemen-elemen penting dari HTML berdasarkan ID
    const form = document.getElementById("editProfileForm");
    const avatarInput = document.getElementById("profileImageUpload");
    const avatarPreview = document.getElementById("profileImagePreview");
    const submitBtn = document.getElementById("submitBtn");

    // -----------------------------------------
    // 0. Fitur Show/Hide Password Toggle
    // -----------------------------------------
    const passwordToggles = document.querySelectorAll(".password-toggle");
    passwordToggles.forEach(toggle => {
        toggle.addEventListener("click", function (e) {
            e.preventDefault(); // Mencegah form tersubmit tidak sengaja
            
            const targetId = this.getAttribute("data-target");
            const targetInput = document.getElementById(targetId);
            if (!targetInput) return;

            const isPassword = targetInput.getAttribute("type") === "password";
            targetInput.setAttribute("type", isPassword ? "text" : "password");

            // Ganti ikon mata secara dinamis dengan transisi mulus
            if (isPassword) {
                // Ikon Mata Coret (Eye-Off)
                this.innerHTML = `
                    <svg class="eye-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                        <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                `;
                targetInput.classList.add("password-field");
            } else {
                // Ikon Mata Biasa (Eye)
                this.innerHTML = `
                    <svg class="eye-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                `;
            }
        });
    });

    // --- PREFILL DATA AKUN DARI FIREBASE ---
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // Isikan nilai email dari akun yang sedang login
            document.getElementById("emailAddr").value = user.email || '';
            // Isikan username dari displayName Auth
            document.getElementById("username").value = user.displayName || '';
            
            // Lakukan penarikan data mendalam dari database Firestore koleksi "user"
            try {
                const docRef = doc(db, "user", user.uid);
                const docSnap = await getDoc(docRef);
                
                if (docSnap.exists()) {
                    const profileData = docSnap.data();
                    // Prefill field fullname dan telepon berdasarkan tangkapan database
                    document.getElementById("fullName").value = profileData.fullname || '';
                    document.getElementById("phoneNum").value = profileData.phone || '';
                }
            } catch (err) {
                console.error("Kesalahan membaca dokumen Firestore: ", err);
            }
            
        } else {
            // Jika tidak ada user login, kembalikan ke layar login
            window.location.href = "login.html";
        }
    });

    // -----------------------------------------
    // A. Fitur Live Preview Ganti Foto Profil
    // -----------------------------------------
    // Mendeteksi bila pengguna mengunggah ('change') berkas gambar/foto baru
    avatarInput.addEventListener("change", function () {
        const file = this.files[0]; // Mengambil file foto pada urutan pertama

        if (file) {
            // Memanfaatkan FileReader bawaan Javascript untuk membaca gambar ke wujud URL lokal (Base64)
            const reader = new FileReader();

            // Ketika proses baca file selesai...
            reader.addEventListener("load", function () {
                // Ganti sumber foto lama dengan gambar baru hasil unggahan
                avatarPreview.setAttribute("src", this.result);
            });

            // Mulai perintah pembacaan
            reader.readAsDataURL(file);
        }
    });

    // -----------------------------------------
    // B. Fitur Validasi Form & Simpan Perubahan ke Firebase
    // -----------------------------------------
    // Mencegat (Intercept) aksi ketika tombol "Simpan" ditekan
    form.addEventListener("submit", async function (e) {
        e.preventDefault(); // Mencegah reload halaman standar browser

        const user = auth.currentUser;
        if (!user) return; // Jika mendadak ter-logout

        // Aktifkan visual loading spinner pada tombol submit
        if (submitBtn) {
            submitBtn.classList.add("loading");
            submitBtn.disabled = true;
        }

        // 1. Ambil teks masukan Profil dengan membuang spasi kosong di ujung (trim)
        const targetFullName = document.getElementById("fullName").value.trim();
        const targetUsername = document.getElementById("username").value.trim();
        const targetEmail = document.getElementById("emailAddr").value.trim();
        const targetPhone = document.getElementById("phoneNum").value.trim();

        // 2. Ambil parameter pengamanan kata sandi (Password)
        const currPass = document.getElementById("currentPass").value;
        const newPass = document.getElementById("newPass").value;
        const confPass = document.getElementById("confirmPass").value;

        // --- SISTEM VALIDASI KEAMANAN SEDERHANA ---
        // Pengecekan hanya berjalan apabila user bermaksud mengisi Password Baru.
        let isChangingPassword = false;
        if (newPass !== "" || confPass !== "") {
            isChangingPassword = true;

            // a. Syarat Wajib: Harus menyertakan Password Lama
            if (currPass === "") {
                Swal.fire("Peringatan", "Harap masukkan password Anda saat ini untuk mengubah seluk-beluk akun/sandi.", "warning");
                // Matikan status loading jika batal submit
                if (submitBtn) {
                    submitBtn.classList.remove("loading");
                    submitBtn.disabled = false;
                }
                return; // Berhenti memproses simpan
            }

            // b. Syarat Verifikasi: Password Baru dan Ketik Ulang harus 100% sama (Typo Check)
            if (newPass !== confPass) {
                Swal.fire("Konfirmasi Error!", "Password Baru dan Konfirmasi Password tampaknya tidak cocok.", "error");
                // Matikan status loading jika batal submit
                if (submitBtn) {
                    submitBtn.classList.remove("loading");
                    submitBtn.disabled = false;
                }
                return;
            }

            // c. Syarat Kekuatan: Panjang karakter jangan terlalu pendek
            if (newPass.length < 6) {
                Swal.fire("Terlalu Singkat", "Password Baru tidak aman! Minimal harus terdiri dari 6 karakter.", "warning");
                // Matikan status loading jika batal submit
                if (submitBtn) {
                    submitBtn.classList.remove("loading");
                    submitBtn.disabled = false;
                }
                return;
            }
        }

        // Tampilkan loading update
        Swal.fire({
            title: "Menyimpan Perubahan...",
            html: "Memperbarui profil Anda dengan server Firebase.",
            allowEscapeKey: false,
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        try {
            // Update Username di DisplayName Firebase
            if (targetUsername !== user.displayName) {
                await updateProfile(user, { displayName: targetUsername });
            }

            // Update Email jika diganti
            if (targetEmail !== user.email) {
                await updateEmail(user, targetEmail);
            }

            // Update Password jika kolom diisi (Peringatan: Biasanya ini butuh re-autentikasi / re-login ulang)
            // Sistem akan menangkap error "auth/requires-recent-login" bila login sudah basi
            if (isChangingPassword) {
                await updatePassword(user, newPass);
            }

            // Memperbarui/Memasukkan keseluruhan data teks sinkron ke Firestore
            // Menggunakan setDoc + merge:true otomatis membuat data baru jika belum ada 
            const docRef = doc(db, "user", user.uid);
            await setDoc(docRef, {
                fullname: targetFullName, // Simpan Nama Lengkap kustom
                username: targetUsername, // Simpan Username (untuk pencarian)
                email: targetEmail,        // Simpan Email (sinkronisasi)
                phone: targetPhone         // Simpan Nomor Telepon
            }, { merge: true }); // Merge: true memastikan field lain tidak terhapus (seperti profilePic url dll)

            // === OPTIMALISASI SINKRONISASI: Sinkronisasi ke koleksi 'admin' jika user adalah Admin/Owner ===
            const adminDocRef = doc(db, "admin", user.uid);
            const adminDocSnap = await getDoc(adminDocRef);
            if (adminDocSnap.exists()) {
                await setDoc(adminDocRef, {
                    fullname: targetFullName,
                    username: targetUsername,
                    email: targetEmail
                }, { merge: true });
            }

            // Tutup loading dan tampilkan Sukses
            Swal.fire(
                "Sukses!",
                "Informasi akun Anda telah berhasil diperbarui.",
                "success"
            ).then(() => {
                // Akhiri proses dengan mengarahkan layar kembali ke Dasbor
                window.location.href = "dashboardTAalip.html";
            });

        } catch (error) {
            // Matikan status loading jika terjadi error agar pengguna bisa mengedit kembali
            if (submitBtn) {
                submitBtn.classList.remove("loading");
                submitBtn.disabled = false;
            }

            // Menangkap pesan gagal update (khususnya security Firebase)
            let errorMsg = error.message;
            if (error.code === 'auth/requires-recent-login') {
                errorMsg = "Perubahan alamat Email / Password membutuhkan Anda untuk keluar (Logout) terlebih dahulu dan masuk ulang (Re-login) demi alasan keamanan.";
            } else if (error.code === 'auth/invalid-email') {
                errorMsg = "Alamat email baru tidak valid.";
            }

            Swal.fire("Pembaruan Gagal", errorMsg, "error");
        }
    });
});

// =========================================
// 2. FUNGSI TAMBAHAN DI LUAR LINGKUP
// =========================================
// Fungsi logoutUser dihapus dan diserahkan ke auth-state.js secara global.
