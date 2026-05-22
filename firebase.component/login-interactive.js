/* =========================================================
   SISTEM ADMINISTRASI PETERNAKAN (LIBAS)
   File: login-interactive.js
   Deskripsi: Script khusus yang memberikan efek interaktif 
   serta animasi lucu pada halaman Login (Otentikasi).
========================================================= */
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { auth, db } from "./firebase-init.js";

// Semua instruksi baru boleh dijalankan apabila struktur HTML layar selesai dimuat
function initializeLogin() {
    console.log("LIBAS: initializeLogin() mulai berjalan.");

    // =========================================
    // 1. DEKLARASI ELEMEN HTML & FLAG STATUS
    // =========================================
    const card = document.querySelector('.login-card');            // Kartu/Form Login keseluruhan
    const container = document.querySelector('.login-wrapper') || document.body;
    const loginForm = document.getElementById('loginForm');        // Badan Formulir Login
    const loginBtn = document.getElementById('loginBtn');          // Tombol eksekusi 'Masuk'
    const passwordInput = document.getElementById('password');     // Kolom isian kata sandi
    const togglePassword = document.getElementById('togglePassword'); // Ikon Mata (Intip Sandi)
    const spotlights = document.querySelectorAll('.card-spotlight'); // Efek lampu sorot kaca

    // Deklarasi tombol pilihan peran (Role Selection) & Back Button
    const btnRolePetugas = document.getElementById('btnRolePetugas');
    const btnRoleAdmin = document.getElementById('btnRoleAdmin');
    const btnBackToRoles = document.getElementById('btnBackToRoles');
    const formTitle = document.getElementById('formTitle');
    const formSubtitle = document.getElementById('formSubtitle');

    console.log("LIBAS: Elemen yang berhasil dimuat:", {
        card: !!card,
        container: !!container,
        loginForm: !!loginForm,
        loginBtn: !!loginBtn,
        btnRolePetugas: !!btnRolePetugas,
        btnRoleAdmin: !!btnRoleAdmin,
        btnBackToRoles: !!btnBackToRoles
    });
    
    let selectedRole = ''; // Menyimpan status role terpilih ('petugas' atau 'admin')
    const signupLinkContainer = document.getElementById('signupLinkContainer');

    if (btnRolePetugas && card) {
        btnRolePetugas.addEventListener('click', () => {
            console.log("LIBAS: btnRolePetugas diklik!");
            selectedRole = 'petugas';
            
            // Pasang tema kelas dan balikkan kartu ke belakang
            card.classList.add('role-petugas');
            card.classList.remove('role-admin');
            card.classList.add('flipped');
            
            if (formTitle) formTitle.innerText = "Login Petugas";
            if (formSubtitle) formSubtitle.innerText = "Mohon isi data akses Petugas Anda untuk memasuki portal.";
            
            // Tampilkan tautan pendaftaran khusus untuk Petugas
            if (signupLinkContainer) {
                signupLinkContainer.style.display = 'block';
            }
        });
    }

    if (btnRoleAdmin && card) {
        btnRoleAdmin.addEventListener('click', () => {
            console.log("LIBAS: btnRoleAdmin diklik!");
            selectedRole = 'admin';
            
            // Pasang tema kelas dan balikkan kartu ke belakang
            card.classList.add('role-admin');
            card.classList.remove('role-petugas');
            card.classList.add('flipped');
            
            if (formTitle) formTitle.innerText = "Login Admin & Owner";
            if (formSubtitle) formSubtitle.innerText = "Mohon isi data akses Admin / Owner Anda untuk memasuki portal.";
            
            // Sembunyikan tautan pendaftaran untuk Admin/Owner
            if (signupLinkContainer) {
                signupLinkContainer.style.display = 'none';
            }
        });
    }

    if (btnBackToRoles && card) {
        btnBackToRoles.addEventListener('click', () => {
            console.log("LIBAS: btnBackToRoles diklik!");
            selectedRole = '';
            
            // Putar balik kartu ke depan
            card.classList.remove('flipped');
            
            // Bersihkan kelas tema dinamis setelah transisi putaran selesai (800ms)
            setTimeout(() => {
                if (!card.classList.contains('flipped')) {
                    card.classList.remove('role-petugas', 'role-admin');
                }
            }, 800);
        });
    }

    // =========================================
    // 2. EFEK LAMPU SOROT KURSOR (Spotlight)
    // =========================================
    if (card && container) {
        // Memantau gerakan mouse hanya untuk memosisikan efek lampu sorot spotlight
        container.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect(); // Mengambil koordinat tepi kotak login
            
            // Jika ada properti lampu sorot, atur pusat gradiasi sorotan tepat mengikuti arah pointer
            if (spotlights.length > 0) {
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
                
                spotlights.forEach(spot => {
                    spot.style.setProperty('--mouse-x', `${mouseX}px`);
                    spot.style.setProperty('--mouse-y', `${mouseY}px`);
                });
            }
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
            ripple.classList.add('ripple');
            ripple.style.left = `${x}px`;
            ripple.style.top = `${y}px`;

            this.appendChild(ripple);

            // Setelah masa rambat gelombang habis di 600 milidetik, hapus percikan ini.
            setTimeout(() => {
                ripple.remove();
            }, 600);
        });
    }

    // =========================================
    // 5. ANIMASI LOADING & AYAM LARI SAAT MASUK KE SISTEM DENGAN FIREBASE
    // =========================================
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault(); 

            // Pasangkan stempel gaya CSS loading ke tombolnya untuk mengganti tulisan ke logo putar
            loginBtn.classList.add('loading');

            // Menangkap nilai teks (value) username dan kata sandi yang telah diketikkan pengguna
            const usernameVal = document.getElementById('username').value.trim();
            const passwordVal = document.getElementById('password').value;

            try {
                console.log("Memulai proses masuk untuk username:", usernameVal, "dengan role pilihan:", selectedRole);
                let userData = null;
                let userRole = "";

                // 1. Tarik email asli dari database (Firebase Auth memerlukan Email, bukan Username)
                if (selectedRole === 'admin') {
                    // Cari di koleksi admin terlebih dahulu
                    console.log("Mencari di koleksi 'admin'...");
                    const adminRef = collection(db, "admin");
                    const qAdmin = query(adminRef, where("username", "==", usernameVal));
                    const snapAdmin = await getDocs(qAdmin);
                    
                    if (!snapAdmin.empty) {
                        userData = snapAdmin.docs[0].data();
                        userRole = userData.role || 'admin';
                        console.log("Ditemukan di koleksi 'admin' dengan data:", userData);
                    } else {
                        // Jika tidak ada di koleksi admin, cari di koleksi user (fallback jika data admin disinkronisasi)
                        console.log("Tidak ditemukan di koleksi 'admin', mencari di koleksi 'user'...");
                        const usersRef = collection(db, "user");
                        const qUser = query(usersRef, where("username", "==", usernameVal));
                        const snapUser = await getDocs(qUser);
                        
                        if (!snapUser.empty) {
                            userData = snapUser.docs[0].data();
                            userRole = userData.role || 'user';
                            console.log("Ditemukan di koleksi 'user' untuk pencarian admin:", userData);
                        }
                    }
                } else {
                    // Cari di koleksi user (untuk Petugas / User biasa)
                    console.log("Mencari di koleksi 'user'...");
                    const usersRef = collection(db, "user");
                    const qUser = query(usersRef, where("username", "==", usernameVal));
                    const snapUser = await getDocs(qUser);
                    
                    if (!snapUser.empty) {
                        userData = snapUser.docs[0].data();
                        userRole = userData.role || 'user';
                        console.log("Ditemukan di koleksi 'user' dengan data:", userData);
                    }
                }

                // Jika username tidak ditemukan di koleksi manapun
                if (!userData) {
                    console.warn("Username tidak ditemukan di database.");
                    throw { code: 'auth/user-not-found' }; 
                }

                const actualEmail = userData.email;
                const cleanRole = userRole.trim().toLowerCase();
                const isAdmin = cleanRole === 'admin' || cleanRole === 'administrator' || cleanRole === 'super_admin' || cleanRole === 'owner';

                console.log("Memvalidasi hak akses: Role DB =", cleanRole, ", Apakah Admin =", isAdmin, ", Pilihan Portal =", selectedRole);

                // --- VALIDASI PERAN AKSES (GUARD CONDITION) ---
                if (selectedRole === 'admin' && !isAdmin) {
                    throw { code: 'auth/role-mismatch-petugas' };
                } else if (selectedRole === 'petugas' && isAdmin) {
                    throw { code: 'auth/role-mismatch-admin' };
                }

                // 2. Proses krusial: Memeriksa dan mencocokkan kredensial dengan database Firebase Auth
                console.log("Mencocokkan email & kata sandi via Firebase Auth...");
                await signInWithEmailAndPassword(auth, actualEmail, passwordVal);
                console.log("Firebase Auth sukses!");

                // --- EASTER EGG LIBAS: Keluarkan anak ayam lari ----
                const chickenOverlay = document.getElementById('chicken-overlay');
                if (chickenOverlay) {
                    chickenOverlay.classList.add('active');
                }

                // 3. Deteksi Role untuk Pengalihan Pintar (Redirect)
                const finalRedirectRole = isAdmin ? 'admin' : 'user';

                // Setelah berhasil masuk, jalankan animasi sejenak lalu alihkan berdasarkan role
                setTimeout(() => {
                    if (finalRedirectRole === 'admin') {
                        console.log("Redirecting ke Admin Control Panel...");
                        window.location.href = 'admin.frontend/admin-core/admin.html';
                    } else {
                        console.log("Redirecting ke Dashboard Petugas...");
                        window.location.href = 'dashboardTAalip.html';
                    }
                }, 3000);

            } catch (error) {
                // Tahap penanganan jika Firebase menolak akses (gagal login)
                loginBtn.classList.remove('loading');
                
                // Menerjemahkan kode error pelik dari Firebase menjadi Bahasa Indonesia
                let errorMsg = "Terjadi kesalahan.";
                if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                    errorMsg = "Username atau sandi yang Anda masukkan salah, mohon periksa kembali.";
                } else if (error.code === 'auth/role-mismatch-petugas') {
                    errorMsg = "Akun Anda terdaftar sebagai Petugas. Silakan masuk kembali menggunakan portal Petugas.";
                } else if (error.code === 'auth/role-mismatch-admin') {
                    errorMsg = "Akun Anda terdaftar sebagai Admin/Owner. Silakan masuk kembali menggunakan portal Admin.";
                } else if (error.code === 'auth/too-many-requests') {
                    errorMsg = "Terlalu banyak percobaan gagal beruntun. Coba lagi beberapa saat.";
                } else if (error.code === 'permission-denied') {
                    errorMsg = "Database tertutup! Buka Firebase Console > Firestore > Rules, ubah bagian 'allow read' menjadi 'if true;' agar sistem bisa mencari Username.";
                } else {
                    errorMsg = error.message || error.code;
                }
                
                Swal.fire({
                    icon: 'error',
                    title: 'Masuk Gagal',
                    text: errorMsg,
                    confirmButtonColor: '#ff7e5f'
                });
            }
        });
    }
}

// Menjalankan inisialisasi dengan aman, menghindari bug DOMContentLoaded yang sudah terlewat
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeLogin);
} else {
    initializeLogin();
}
