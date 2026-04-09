/* =========================================================
   SISTEM ADMINISTRASI PETERNAKAN (LIBAS)
   File: login-interactive.js
   Deskripsi: Script khusus yang memberikan efek interaktif 
   serta animasi lucu pada halaman Login (Otentikasi).
========================================================= */

// Semua instruksi baru boleh dijalankan apabila struktur HTML layar selesai dimuat
document.addEventListener('DOMContentLoaded', () => {

    // =========================================
    // 1. DEKLARASI ELEMEN HTML (Pencarian ID / Class)
    // =========================================
    const card = document.querySelector('.login-card');            // Kartu/Form Login keseluruhan
    const container = document.querySelector('.login-wrapper') || document.body;
    const loginForm = document.getElementById('loginForm');        // Badan Formulir Login
    const loginBtn = document.getElementById('loginBtn');          // Tombol eksekusi 'Masuk'
    const passwordInput = document.getElementById('password');     // Kolom isian kata sandi
    const togglePassword = document.getElementById('togglePassword'); // Ikon Mata (Intip Sandi)
    const spotlight = document.querySelector('.card-spotlight');   // Efek lampu sorot kaca

    // =========================================
    // 2. EFEK KARTU MIRING 3D & LAMPU SOROT (Spotlight)
    // =========================================
    // Hanya aktif jika kartu login targetnya berhasil ditemukan
    if (card && container) {
        
        // Membaca pergerakan kursor tetikus (mouse) saat mondar-mandir di atas form
        container.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect(); // Mengambil koordinat tepi kotak login
            
            // Mengukur letak pasti mouse dihitung dari titik tengah koordinat form
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;

            // Mengkalkulasikan kemiringan perspektif 3D maksimal sebesar 10 derajat
            const rotateX = (y / (rect.height / 2)) * -10;
            const rotateY = (x / (rect.width / 2)) * 10;

            // Menerapkan rotasi sumbu X dan Y gaya CSS
            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;

            // Jika ada properti lampu sorot, atur pusat gradiasi sorotan tepat mengikuti arah pointer
            if (spotlight) {
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
                // Suntik properti var css
                spotlight.style.setProperty('--mouse-x', `${mouseX}px`);
                spotlight.style.setProperty('--mouse-y', `${mouseY}px`);
                // Gambar sorotan melingkar cahaya redup putih yang tembus pandang
                spotlight.style.background = `radial-gradient(600px circle at ${mouseX}px ${mouseY}px, rgba(255, 255, 255, 0.1), transparent 40%)`;
            }
        });

        // Apabila kursor Mouse meninggalkan area form
        container.addEventListener('mouseleave', () => {
            // Netralkan posisi kartu kembali tegap 0 derajat perlahan
            card.style.transition = 'transform 0.5s ease';
            card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)';

            // Reset lampu sorot memudar halus kembali ke tengah
            if (spotlight) {
                spotlight.style.background = `radial-gradient(600px circle at 50% 50%, rgba(255, 255, 255, 0), transparent 40%)`;
            }

            // Setelah setengah detik, buang efek lambat agar transisi mouse bergera responsif lagi
            setTimeout(() => {
                card.style.transition = ''; 
            }, 500);
        });

        // Begitu mouse masuk menyentuh area, nyalakan respon cepat
        container.addEventListener('mouseenter', () => {
            card.style.transition = 'transform 0.1s ease';
        });
    }

    // =========================================
    // 3. FITUR INTIP KATA SANDI (Mata Password)
    // =========================================
    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', () => {
            // Cek apakah jenis kolom sedang menyembunyikan ('password') atau memunculkan ('text') huruf
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type); // Terapkan perubahannya

            // Buat ikon siluet mata menjadi tebal atau memudar sebagai penanda aktif/tidak
            togglePassword.style.opacity = type === 'text' ? '1' : '0.6';
        });
    }

    // =========================================
    // 4. ANIMASI GELOMBANG AIR PADA TOMBOL (Ripple Effect)
    // =========================================
    if (loginBtn) {
        loginBtn.addEventListener('click', function (e) {
            // Jangan berikan efek buih menyebar jika kebetulan tombol sudah berada di mode 'loading' memproses data
            if (this.classList.contains('loading')) return;

            // Catat koordinat tapokan persis di posisi tombol diklik
            const rect = this.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // Ciptakan dan sisipkan properti HTML pemercik gelombang ("ripple")
            const ripple = document.createElement('span');
            ripple.classList.add('ripple'); // .ripple dipetakan dalam loginc.css
            ripple.style.left = `${x}px`;
            ripple.style.top = `${y}px`;

            this.appendChild(ripple); // Genggam elemen ripple

            // Setelah masa rambat gelombang habis di 600 milidetik, hapus percikan ini.
            setTimeout(() => {
                ripple.remove();
            }, 600);
        });
    }

    // =========================================
    // 5. ANIMASI LOADING & AYAM LARI SAAT MASUK KE SISTEM
    // =========================================
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            // JANGAN langsung memindahkan layar, cegat dengan Event Prevent ini
            e.preventDefault(); 

            // Pasangkan stempel gaya CSS loading ke tombolnya untuk mengganti tulisan ke logo putar
            loginBtn.classList.add('loading');

            // --- EASTER EGG LIBAS: Keluarkan anak ayam lari ----
            const chickenOverlay = document.getElementById('chicken-overlay');
            if (chickenOverlay) {
                // Menambahkan kelas 'active' merangsang fungsi pindak layer objek ayam dari luar layar (hide to show)
                chickenOverlay.classList.add('active');
            }

            // Menunggu si ayam menyebrang beresih ke kanan (Skenario simulasi memakan 3 detik).
            // Anda bisa mengganti ini dengan pengecekan database tulen jika API tersedia nantinya.
            setTimeout(() => {
                // Setelah tuntas, pindahkan halaman layaknya redirect asli
                const action = loginForm.getAttribute('action'); // Menangkap href HTML
                window.location.href = action; // 'dashboardTAalip.html'
            }, 3000); 
        });
    }
});
