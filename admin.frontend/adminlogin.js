/**
 * =========================================================
 * SISTEM ADMINISTRASI PETERNAKAN (LIBAS)
 * File: adminlogin.js
 * Deskripsi: Menangani proses log masuk dan pendaftaran 
 * khusus bagi akun administrator menggunakan koleksi 'admin'
 * di Firebase Firestore.
 * =========================================================
 */

import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    updateProfile,
    signOut 
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { 
    collection, 
    query, 
    where, 
    getDocs, 
    doc, 
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { auth, db } from "../firebase.component/firebase-init.js";

/**
 * ===== 1. EVENT LISTENERS UTAMA =====
 */
function initializeAdminLogin() {

    /**
     * LOGIKA LOGIN ADMINISTRATOR
     * Memverifikasi username di koleksi 'admin' sebelum melakukan Auth.
     */
    const loginForm = document.getElementById('adminLoginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('loginSubmitBtn');
            const username = document.getElementById('loginUsername').value.trim();
            const password = document.getElementById('loginPassword').value;

            setLoading(btn, true);

            try {
                // Tahap 1: Validasi keberadaan Username di database (Anti-Bruteforce)
                const q = query(collection(db, "admin"), where("username", "==", username));
                const snap = await getDocs(q);

                if (snap.empty) throw new Error("Username administrator tidak terdaftar dalam sistem.");

                const adminDoc = snap.docs[0].data();
                
                // Tahap 2: Eksekusi otentikasi identitas via Firebase Auth
                await signInWithEmailAndPassword(auth, adminDoc.email, password);

                Swal.fire({
                    icon: 'success',
                    title: 'Akses Diterima',
                    text: 'Selamat datang kembali di Panel Pusat Pusat, Admin!',
                    timer: 1500,
                    showConfirmButton: false
                }).then(() => {
                    window.location.href = 'admin-core/admin.html';
                });

            } catch (err) {
                setLoading(btn, false);
                console.error("Gagal Login:", err);
                Swal.fire("Akses Ditolak", err.message, "error");
            }
        });
    }

    /**
     * LOGIKA PENDAFTARAN ADMINISTRATOR BARU
     * Hanya digunakan untuk inisialisasi atau penambahan admin manual.
     */
    const signupForm = document.getElementById('adminSignupForm');
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('signupSubmitBtn');
            const fullname = document.getElementById('signupFullname').value;
            const username = document.getElementById('signupUsername').value.trim();
            const email = document.getElementById('signupEmail').value;
            const password = document.getElementById('signupPassword').value;

            setLoading(btn, true);

            try {
                // Langkah 1: Registrasi Email & Password ke Firebase Auth
                const cred = await createUserWithEmailAndPassword(auth, email, password);
                
                // Langkah 2: Sinkronisasi identitas Profil
                await updateProfile(cred.user, { displayName: username });

                // Langkah 3: Persistensi data otoritas ke Koleksi 'admin'
                await setDoc(doc(db, "admin", cred.user.uid), {
                    uid: cred.user.uid,
                    fullname: fullname,
                    username: username,
                    email: email,
                    role: 'admin',      // Level otoritas permanen
                    type: 'super_admin',
                    createdAt: serverTimestamp()
                });

                // Langkah 3.5: Sinkronisasi otomatis ke Koleksi 'user' agar tampil di tabel Manajemen Pengguna
                await setDoc(doc(db, "user", cred.user.uid), {
                    fullname: fullname,
                    username: username,
                    email: email,
                    role: 'admin',
                    disabled: false,
                    createdAt: serverTimestamp()
                });

                // Langkah 4: Logout paksa untuk verifikasi ulang via Login
                await signOut(auth);

                Swal.fire({
                    icon: 'success',
                    title: 'Admin Terdaftar',
                    text: 'Akun administrator baru berhasil diamankan di database.',
                }).then(() => {
                    // Kembali ke tampilan login
                    switchTab('login'); 
                });

            } catch (err) {
                setLoading(btn, false);
                console.error("Gagal Registrasi:", err);
                Swal.fire("Gagal Daftar", err.message, "error");
            }
        });
    }
}

// Menjalankan inisialisasi dengan aman, menghindari bug DOMContentLoaded yang sudah terlewat
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAdminLogin);
} else {
    initializeAdminLogin();
}

/**
 * ===== 2. FUNGSI PEMBANTU (HELPERS) =====
 */

/**
 * Mengatur visual tombol saat proses asinkron berjalan
 * @param {HTMLElement} btn - Elemen tombol yang ditekan
 * @param {boolean} isLoading - Status loading
 */
function setLoading(btn, isLoading) {
    if (isLoading) {
        btn.classList.add('btn-loading');
        btn.innerText = "Memverifikasi...";
    } else {
        btn.classList.remove('btn-loading');
        btn.innerText = btn.id === 'loginSubmitBtn' ? "Masuk Ke Panel" : "Buat Akun Administrator";
    }
}

/**
 * Pengatur perpindahan antar form Login dan Daftar
 * @param {string} type - 'login' atau 'signup'
 */
window.switchTab = function(type) {
    const tabs = document.querySelectorAll('.tab-btn');
    const forms = document.querySelectorAll('.auth-form');
    const desc = document.getElementById('headerDescription');

    tabs.forEach(t => t.classList.remove('active'));
    forms.forEach(f => f.classList.remove('active'));

    if (type === 'login') {
        tabs[0].classList.add('active');
        forms[0].classList.add('active');
        desc.innerText = "Akses panel administrator sistem untuk manajemen operasional.";
    } else {
        tabs[1].classList.add('active');
        forms[1].classList.add('active');
        desc.innerText = "Daftarkan identitas administrator baru ke dalam sistem.";
    }
}
