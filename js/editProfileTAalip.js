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

// =========================================
// 1. LOGIKA UTAMA (Berjalan Saat Layar Dimuat)
// Penjelasan: Eksekusi dikaitkan ke Event Listener DOMContentLoaded.
// =========================================
document.addEventListener("DOMContentLoaded", () => {
    // Definisi variabel dengan mengambil elemen-elemen penting dari HTML berdasarkan ID
    const form = document.getElementById("editProfileForm");
    const avatarInput = document.getElementById("profileImageUpload");
    const avatarPreview = document.getElementById("profileImagePreview");

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
    // B. Fitur Validasi Form & Simpan Perubahan
    // -----------------------------------------
    // Mencegat (Intercept) aksi ketika tombol "Simpan" ditekan
    form.addEventListener("submit", function (e) {
        e.preventDefault(); // Mencegah reload halaman standar browser

        // 1. Ambil teks masukan Profil dengan membuang spasi kosong di ujung (trim)
        const targetName = document.getElementById("fullName").value.trim();

        // 2. Ambil parameter pengamanan kata sandi (Password)
        const currPass = document.getElementById("currentPass").value;
        const newPass = document.getElementById("newPass").value;
        const confPass = document.getElementById("confirmPass").value;

        // --- SISTEM VALIDASI KEAMANAN SEDERHANA ---
        // Pengecekan hanya berjalan apabila user bermaksud mengisi Password Baru.
        if (newPass !== "" || confPass !== "") {

            // a. Syarat Wajib: Harus menyertakan Password Lama
            if (currPass === "") {
                Swal.fire("Peringatan", "Harap masukkan password Anda saat ini untuk mengubah struktur kata sandi.", "warning");
                return; // Berhenti memproses simpan
            }

            // b. Syarat Verifikasi: Password Baru dan Ketik Ulang harus 100% sama (Typo Check)
            if (newPass !== confPass) {
                Swal.fire("Konfirmasi Error!", "Password Baru dan Konfirmasi Password tampaknya tidak cocok.", "error");
                return;
            }

            // c. Syarat Kekuatan: Panjang karakter jangan terlalu pendek
            if (newPass.length < 6) {
                Swal.fire("Terlalu Singkat", "Password Baru tidak aman! Minimal harus terdiri dari 6 karakter.", "warning");
                return;
            }
        }

        // --- APABILA LOLOS VALIDASI: MULAI PROSES PENYIMPANAN ---
        Swal.fire({
            title: "Menyimpan Perubahan...",
            html: "Pembaruan profil Anda sedang diproses sistem.",
            timer: 1500, // Efek pura-pura loading lambat selama 1,5 detik
            timerProgressBar: true,

            // Animasi Ikon Bulat Memutar Cerdas
            didOpen: () => {
                Swal.showLoading();
            },

            // Setelah loading tuntas, munculkan popup sukses hijau!
            willClose: () => {
                Swal.fire(
                    "Sukses!",
                    `Biodata terbaru atas nama ${targetName} berhasil tersimpan di sistem.`,
                    "success"
                ).then(() => {
                    // Akhiri proses dengan mengarahkan layar kembali ke Menu Utama Dasbor
                    window.location.href = "dashboardTAalip.html";
                });
            }
        });

    });
});

// =========================================
// 2. FUNGSI TAMBAHAN DI LUAR LINGKUP
// =========================================

/**
 * Fitur Logout (Keluar Sesi)
 * Menampilkan jendela konfirmasi darurat bilamana pengguna tersasar menekan tombol Logout (jika ada).
 */
function logoutUser() {
    Swal.fire({
        title: "Yakin ingin Logout dari Profil?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Ya, Keluarkan Saya",
        cancelButtonText: "Batal Keluar",
        confirmButtonColor: "#d33",  // Merah (Bahaya)
        cancelButtonColor: "#3085d6" // Biru (Normal)
    }).then((result) => {
        if (result.isConfirmed) {
            // Bila disetujui, putuskan sesi dan paksa buang ke halaman Login Awal.
            window.location.href = "login.html";
        }
    });
}
