/**
 * =========================================================
 * SISTEM ADMINISTRASI PETERNAKAN (KODE AUTH ADMIN)
 * File: adminlogin.js
 * Deskripsi: Menangani proses log masuk dan pendaftaran 
 * khusus bagi akun administrator menggunakan koleksi 'admin'.
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
    setDoc 
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { auth, db } from "../firebase.component/firebase-init.js";

document.addEventListener('DOMContentLoaded', () => {

    // --- LOGIKA LOGIN ADMIN ---
    const loginForm = document.getElementById('adminLoginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('loginSubmitBtn');
            const username = document.getElementById('loginUsername').value.trim();
            const password = document.getElementById('loginPassword').value;

            setLoading(btn, true);

            try {
                // Mencari data di KOLEKSI: admin
                const q = query(collection(db, "admin"), where("username", "==", username));
                const snap = await getDocs(q);

                if (snap.empty) throw new Error("Username administrator tidak terdaftar.");

                const adminDoc = snap.docs[0].data();
                
                // Eksekusi Login dengan Firebase Auth
                await signInWithEmailAndPassword(auth, adminDoc.email, password);

                Swal.fire({
                    icon: 'success',
                    title: 'Login Berhasil',
                    text: 'Selamat datang di Panel Kontrol, Admin!',
                    timer: 1500,
                    showConfirmButton: false
                }).then(() => {
                    window.location.href = 'admin-core/admin.html';
                });

            } catch (err) {
                setLoading(btn, false);
                Swal.fire("Akses Ditolak", err.message, "error");
            }
        });
    }

    // --- LOGIKA DAFTAR ADMIN ---
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
                // 1. Buat Akun Firebase Auth
                const cred = await createUserWithEmailAndPassword(auth, email, password);
                
                // 2. Update Display Name di Auth
                await updateProfile(cred.user, { displayName: username });

                // 3. Simpan Profil ke KOLEKSI: admin
                await setDoc(doc(db, "admin", cred.user.uid), {
                    uid: cred.user.uid,
                    fullname: fullname,
                    username: username,
                    email: email,
                    type: 'super_admin', // Penanda level admin
                    createdAt: new Date().toISOString()
                });

                // 4. Logout otomatis agar mendarat di form login
                await signOut(auth);

                Swal.fire({
                    icon: 'success',
                    title: 'Admin Terdaftar',
                    text: 'Akun administrator baru berhasil dibuat.',
                }).then(() => {
                    // Reset ke tab login
                    switchTab('login'); 
                });

            } catch (err) {
                setLoading(btn, false);
                Swal.fire("Gagal Daftar", err.message, "error");
            }
        });
    }
});

/**
 * Loading state helper
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
 * Tab Switcher (Exposed to window for HTML access)
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
        desc.innerText = "Akses panel administrator sistem.";
    } else {
        tabs[1].classList.add('active');
        forms[1].classList.add('active');
        desc.innerText = "Daftarkan identitas administrator baru.";
    }
}
