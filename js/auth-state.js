import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { auth, db } from "./firebase-init.js";

// Saat halaman HTML selesai dimuat
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

// Menimpa fungsi aksi Logout bawaan agar menggunakan mekanisme Logout Firebase
window.logoutUser = async function() {
    try {
        await signOut(auth);
        
        // Membersihkan cache lokal opsional
        localStorage.removeItem('libas_username');

        alert("Anda telah berhasil keluar (Logout).");
        window.location.href = 'login.html';
    } catch (error) {
        alert("Gagal melakukan logout: " + error.message);
    }
};
