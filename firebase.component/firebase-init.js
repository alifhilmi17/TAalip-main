/* =========================================================
   SISTEM ADMINISTRASI PETERNAKAN (LIBAS)
   File: firebase-init.js
   Deskripsi: Kumpulan konfigurasi utama untuk menginisialisasi 
   koneksi antara aplikasi web dengan database cloud Firebase.
   File ini diekspor (export) agar bisa digunakan di banyak file JS lain.
========================================================= */

// 1. Mengimpor fungsi initializeApp untuk memulai koneksi awal dengan Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";

// 2. Mengimpor fungsi getAuth untuk memakai fitur Autentikasi (Daftar/Login)
import { getAuth } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";

// 3. Mengimpor fungsi Firestore untuk penyimpanan database data profil/teks
import { getFirestore, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

/* 
   Objek konfigurasi koneksi yang didapatkan dari platform Firebase Console.
   Berisi kumpulan "kunci rahasia" (API keys) dan alamat ID unik project Web.
*/
const firebaseConfig = {
  apiKey: "AIzaSyD265EEi0UE9wYNvOWKQ46huxpPTfZOcOE",
  authDomain: "libas-db.firebaseapp.com",
  projectId: "libas-db",
  storageBucket: "libas-db.firebasestorage.app",
  messagingSenderId: "918841790171",
  appId: "1:918841790171:web:04ce25a5727fddbd78c6fe",
  measurementId: "G-5VPZQD4DKY"
};

// 4. Menjalankan mesin Firebase App memakai data kunci dari firebaseConfig
const app = initializeApp(firebaseConfig);

// 5. Mengekspor variabel 'auth' (Layanan Autentikasi) yang siap digunakan 
// di file JS lain untuk memvalidasi user login atau registrasi
export const auth = getAuth(app);

// 6. Mengekspor variabel 'db' (Layanan Firestore) 
// untuk dipakai menyimpan data biodata user dll
export const db = getFirestore(app);

// 7. Mengaktifkan Dukungan Offline (IndexedDB Persistence)
enableIndexedDbPersistence(db).catch((err) => {
    if (err.code == 'failed-precondition') {
        console.warn("Offline Support: Multiple tabs open, persistence can only be enabled in one tab at a a time.");
    } else if (err.code == 'unimplemented') {
        console.warn("Offline Support: The current browser does not support all of the features required to enable persistence.");
    }
});
