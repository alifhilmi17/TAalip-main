/**
 * =========================================================
 * SISTEM ADMINISTRASI PETERNAKAN (LIBAS)
 * File: admin.js
 * Deskripsi: Logika inti Dashboard Administrator. Mengelola
 * sinkronisasi Firestore real-time, statistik global, 
 * manajemen akun pengguna, dan audit logging.
 * =========================================================
 */

import { 
    collection, 
    onSnapshot, 
    query, 
    orderBy, 
    limit,
    getDocs,
    addDoc,
    deleteDoc,
    updateDoc,
    doc,
    setDoc,
    where,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { 
    createUserWithEmailAndPassword,
    getAuth
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { db, auth } from "../../firebase.component/firebase-init.js";

/**
 * ===== 1. INISALISASI DASHBOARD =====
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log("Admin Panel Berhasil Dimuat - Koneksi Firebase Aktif.");
    initAdminDashboard();
});

/**
 * Fungsi Utama: Menghubungkan elemen UI dengan listener Firestore
 */
function initAdminDashboard() {
    // A. Monitoring Pengguna (Koleksi: user)
    onSnapshot(collection(db, "user"), (snapshot) => {
        const userCount = snapshot.size;
        document.getElementById('stat-user').textContent = `${userCount} Orang`;
        
        const userBadge = document.getElementById('user-count-badge');
        if(userBadge) userBadge.textContent = `${userCount} Pengguna Terverifikasi`;
        
        const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderUserList(users);
    });

    // B. Monitoring Populasi Ayam (Koleksi: populasi_ayam)
    onSnapshot(collection(db, "populasi_ayam"), (snapshot) => {
        let totalAyam = 0;
        let snapshotData = [];
        
        snapshot.forEach(doc => {
            const data = doc.data();
            totalAyam += parseInt(data.sisaAyam || 0);
            snapshotData.push({ id: doc.id, ...data });
        });

        document.getElementById('stat-admin-ayam').textContent = `${totalAyam.toLocaleString('id-ID')} Ekor`;
        renderAyamSnapshot(snapshotData.slice(0, 5)); // Tampilkan top 5 batch
    });

    // C. Monitoring Keuangan (Koleksi: keuangan)
    onSnapshot(collection(db, "keuangan"), (snapshot) => {
        let totalSaldo = 0;
        let trxData = [];
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const jumlah = parseFloat(data.jumlah || 0);
            if (data.tipe === 'pemasukan') {
                totalSaldo += jumlah;
            } else {
                totalSaldo -= jumlah;
            }
            trxData.push({ id: doc.id, ...data });
        });

        document.getElementById('stat-admin-prediksi').textContent = `Rp ${totalSaldo.toLocaleString('id-ID')}`;
        
        // Sorting transaksi terbaru berdasarkan timestamp
        const latestTrx = trxData.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal)).slice(0, 5);
        renderKeuanganSnapshot(latestTrx);
    });

    // D. Monitoring Audit Log (Koleksi: activity_log)
    onSnapshot(query(
        collection(db, "activity_log"), 
        orderBy("waktu", "desc"), 
        limit(10)
    ), (snapshot) => {
        const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderSystemLogs(logs);
    });
}

/**
 * ===== 2. FUNGSI RENDERING UI =====
 */

/**
 * Merender daftar manajemen akun pengguna
 * @param {Array} users - List data pengguna dari Firestore
 */
function renderUserList(users) {
    const userBody = document.getElementById('adminUserListBody');
    if (!userBody) return;

    if (users.length === 0) {
        userBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Tidak ada data pengguna yang terdaftar di basis data.</td></tr>`;
    } else {
        userBody.innerHTML = users.map(user => {
            let dateStr = "-";
            if (user.createdAt) {
                const dateObj = user.createdAt.toDate ? user.createdAt.toDate() : new Date(user.createdAt);
                dateStr = dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
            }

            const isAdmin = user.role === 'admin';

            return `
                <tr class="animate__animated animate__fadeIn">
                    <td>
                        <div style="display:flex; align-items:center; gap:10px;">
                            <div style="width:30px; height:30px; background:#e2e8f0; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px;">👤</div>
                            <span>${user.fullname || 'Tanpa Nama'}</span>
                        </div>
                    </td>
                    <td><code style="background:#f1f5f9; padding:2px 5px; border-radius:4px; color:#475569;">@${user.username || '-'}</code></td>
                    <td>${user.email || '-'}</td>
                    <td>${dateStr}</td>
                    <td>
                        <span class="badge-role" style="background:${isAdmin ? '#3b82f6' : '#94a3b8'}; color:white; padding:4px 10px; border-radius:20px; font-size:0.7rem; font-weight:600;">
                            ${(user.role || 'user').toUpperCase()}
                        </span>
                    </td>
                    <td>
                        <div class="action-btns">
                            <button onclick="toggleAdminRole('${user.id}', '${user.role || 'user'}')" 
                                    class="action-btn-small ${isAdmin ? 'btn-demote' : 'btn-promote'}">
                                ${isAdmin ? 'Demote' : 'Promote'}
                            </button>
                            <button onclick="deleteUser('${user.id}', '${user.fullname || user.username}')" 
                                    class="action-btn-small btn-delete">
                                Hapus
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }
}

/**
 * Merender ringkasan populasi ayam
 */
function renderAyamSnapshot(data) {
    const ayamBody = document.getElementById('adminAyamSnapshot');
    if (!ayamBody) return;

    if (data.length === 0) {
        ayamBody.innerHTML = `<tr><td colspan="4" style="text-align:center;">Data batch ayam tidak ditemukan.</td></tr>`;
    } else {
        ayamBody.innerHTML = data.map(item => `
            <tr>
                <td>${item.customId || (item.id ? item.id.substring(0, 5) : '-')}</td>
                <td>${item.jenis || '-'}</td>
                <td><span class="status-badge" style="background:${getStatusColor(item.status)}; color:white; padding:2px 8px; border-radius:10px; font-size:10px;">${item.status || 'AKTIF'}</span></td>
                <td>${(parseInt(item.sisaAyam || 0)).toLocaleString('id-ID')}</td>
            </tr>
        `).join('');
    }
}

/**
 * Helper: Memberikan indikator warna status
 */
function getStatusColor(status) {
    if (status === 'Panen') return '#3b82f6';
    if (status === 'Afkir') return '#ef4444';
    return '#10b981';
}

/**
 * Merender ringkasan mutasi kas terakhir
 */
function renderKeuanganSnapshot(data) {
    const keuanganBody = document.getElementById('adminKeuanganSnapshot');
    if (!keuanganBody) return;

    if (data.length === 0) {
        keuanganBody.innerHTML = `<tr><td colspan="4" style="text-align:center;">Belum ada riwayat transaksi finansial.</td></tr>`;
    } else {
        keuanganBody.innerHTML = data.map(item => `
            <tr>
                <td>${formatTanggal(item.tanggal)}</td>
                <td>${item.deskripsi || '-'}</td>
                <td style="color: ${item.tipe === 'pemasukan' ? '#10b981' : '#ef4444'}">${item.tipe.toUpperCase()}</td>
                <td>Rp ${parseInt(item.jumlah || 0).toLocaleString('id-ID')}</td>
            </tr>
        `).join('');
    }
}

/**
 * Helper: Format tanggal string ke regional ID
 */
function formatTanggal(tglString) {
    if (!tglString) return "-";
    const date = new Date(tglString);
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

/**
 * Merender audit log sistem
 */
function renderSystemLogs(logs) {
    const logBody = document.getElementById('systemLogBody');
    if (!logBody) return;

    if (logs.length === 0) {
        logBody.innerHTML = `<tr><td colspan="4" style="text-align:center;">Belum ada rekaman aktivitas sistem.</td></tr>`;
    } else {
        logBody.innerHTML = logs.map(log => `
            <tr>
                <td>${log.waktu ? new Date(log.waktu).toLocaleString('id-ID') : '-'}</td>
                <td><strong>${log.user || 'System'}</strong></td>
                <td>${log.modul || '-'}</td>
                <td>${log.aksi || '-'}</td>
            </tr>
        `).join('');
    }
}

/**
 * ===== 3. FUNGSI LOGGING & AUDIT =====
 */

/**
 * Mencatat aktivitas pengguna ke database (Activity Audit)
 */
export async function logActivity(user, modul, aksi) {
    try {
        await addDoc(collection(db, "activity_log"), {
            user,
            modul,
            aksi,
            waktu: new Date().toISOString()
        });
    } catch (err) {
        console.error("Audit Logging Error:", err);
    }
}

/**
 * Menghapus seluruh riwayat log sistem (Hanya Super Admin)
 */
window.clearLogs = async function() {
    Swal.fire({
        title: 'Konfirmasi Penghapusan Log',
        text: "Seluruh riwayat audit akan dimusnahkan secara permanen!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Ya, Bersihkan Seluruhnya!',
        cancelButtonText: 'Batalkan'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                Swal.fire({
                    title: 'Memproses Pembersihan...',
                    allowOutsideClick: false,
                    didOpen: () => { Swal.showLoading(); }
                });

                const querySnapshot = await getDocs(collection(db, "activity_log"));
                const deletePromises = querySnapshot.docs.map(document => 
                    deleteDoc(doc(db, "activity_log", document.id))
                );
                
                await Promise.all(deletePromises);
                Swal.fire('Sukses!', 'Log database telah dikosongkan.', 'success');
                
                logActivity("Admin", "Sistem", "Penghapusan total riwayat log aktivitas database.");
                
            } catch (err) {
                console.error("Gagal Membersihkan Log:", err);
                Swal.fire('Gagal', 'Sistem tidak dapat menghapus log: ' + err.message, 'error');
            }
        }
    });
}

/**
 * ===== 4. MANAJEMEN OTORITAS PENGGUNA =====
 */

/**
 * Menghapus akun pengguna dari database
 */
window.deleteUser = async function(uid, name) {
    Swal.fire({
        title: 'Hapus Akun Pengguna?',
        text: `Data "${name}" akan dihapus permanen. Tindakan ini tidak dapat dibatalkan!`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Ya, Hapus Akun',
        cancelButtonText: 'Batal'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                await deleteDoc(doc(db, "user", uid));
                Swal.fire('Berhasil Terhapus', 'Akun telah dieliminasi dari sistem.', 'success');
                logActivity("Admin", "Akses Pengguna", `Menghapus identitas user: ${name}`);
            } catch (err) {
                Swal.fire('Gagal', 'Terjadi kendala jaringan: ' + err.message, 'error');
            }
        }
    });
}

/**
 * Mengubah level otoritas akun (Admin vs User)
 */
window.toggleAdminRole = async function(uid, currentRole) {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    const actionText = newRole === 'admin' ? 'Promosi ke Admin' : 'Demosi ke Pekerja';

    Swal.fire({
        title: 'Ubah Hak Akses?',
        text: `Konfirmasi penguubahan otoritas akun menjadi: ${newRole.toUpperCase()}?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#3b82f6',
        confirmButtonText: 'Ya, Update Role'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                // Tahap 1: Update metadata di koleksi user utama
                await updateDoc(doc(db, "user", uid), { role: newRole });
                
                // Tahap 2: Sinkronisasi otoritas login di koleksi admin
                const adminRef = doc(db, "admin", uid);
                if (newRole === 'admin') {
                    await setDoc(adminRef, {
                        role: 'admin',
                        promotedAt: new Date().toISOString(),
                        type: 'auth_entry'
                    });
                } else {
                    await deleteDoc(adminRef);
                }
                
                await Swal.fire('Otoritas Diperbarui', `Level akun kini menjadi ${newRole.toUpperCase()}.`, 'success');
                await logActivity("Admin", "Akses Pengguna", `Update role (UID: ${uid}) menjadi ${newRole}`);
                
            } catch (err) {
                console.error("Gagal sinkronisasi role:", err);
                Swal.fire('Update Gagal', 'Kegagalan sinkronisasi cloud: ' + err.message, 'error');
            }
        }
    });
}

/**
 * ===== 5. UI CONTROL & UTILITIES =====
 */

/**
 * Pengatur visibilitas submenu sidebar
 */
window.toggleSidebarMenu = function(id) {
    const menu = document.getElementById(id);
    const button = menu.previousElementSibling;
    const isExpanded = button.getAttribute('aria-expanded') === 'true';

    button.setAttribute('aria-expanded', !isExpanded);
    menu.setAttribute('aria-hidden', isExpanded);
    button.classList.toggle('active');
}

/**
 * ===== 6. PENDAFTARAN AKUN MANAJEMEN =====
 */

/**
 * Menampilkan portal pendaftaran petugas oleh Administrator
 */
window.openCreateAccountModal = function() {
    Swal.fire({
        title: 'Registrasi Identitas Baru',
        html: `
            <div class="swal-libas-container">
                <div class="swal-libas-info">
                    ℹ️ Pastikan alamat email aktif dan valid sebelum memproses registrasi.
                </div>
                
                <div class="swal-libas-field">
                    <label class="swal-libas-label">👤 Nama Lengkap</label>
                    <div class="swal-libas-input-wrapper">
                        <span class="swal-libas-icon">📝</span>
                        <input id="swal-fullname" class="swal-libas-input" placeholder="Masukkan nama terang">
                    </div>
                </div>

                <div class="swal-libas-field">
                    <label class="swal-libas-label">🆔 Kode Username</label>
                    <div class="swal-libas-input-wrapper">
                        <span class="swal-libas-icon">@</span>
                        <input id="swal-username" class="swal-libas-input" placeholder="username_pilihan">
                    </div>
                </div>

                <div class="swal-libas-field">
                    <label class="swal-libas-label">📧 Alamat Email</label>
                    <div class="swal-libas-input-wrapper">
                        <span class="swal-libas-icon">✉️</span>
                        <input id="swal-email" type="email" class="swal-libas-input" placeholder="user@peternakan.com">
                    </div>
                </div>

                <div class="swal-libas-field">
                    <label class="swal-libas-label">🔑 Kata Sandi (Akses)</label>
                    <div class="swal-libas-input-wrapper">
                        <span class="swal-libas-icon">🔒</span>
                        <input id="swal-password" type="password" class="swal-libas-input" placeholder="Minimal 6 karakter">
                    </div>
                </div>

                <div class="swal-libas-field">
                    <label class="swal-libas-label">🛡️ Penetapan Hak Akses</label>
                    <div class="swal-libas-input-wrapper">
                        <span class="swal-libas-icon">⭐</span>
                        <select id="swal-role" class="swal-libas-select">
                            <option value="user">User / Staff Operasional</option>
                            <option value="admin">Administrator Otoritas</option>
                        </select>
                    </div>
                </div>
            </div>
        `,
        padding: '2rem',
        customClass: {
            title: 'swal-title-custom',
            confirmButton: 'swal-confirm-custom',
            cancelButton: 'swal-cancel-custom'
        },
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Amankan Akun',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#94a3b8',
        preConfirm: () => {
            const fullname = document.getElementById('swal-fullname').value;
            const username = document.getElementById('swal-username').value;
            const email = document.getElementById('swal-email').value;
            const password = document.getElementById('swal-password').value;
            const role = document.getElementById('swal-role').value;

            if (!fullname || !username || !email || !password) {
                Swal.showValidationMessage('Seluruh kolom data wajib diisi!');
                return false;
            }
            if (password.length < 6) {
                Swal.showValidationMessage('Sanitasi Password: Minimal 6 karakter!');
                return false;
            }

            return { fullname, username, email, password, role };
        }
    }).then((result) => {
        if (result.isConfirmed) {
            createNewUser(result.value);
        }
    });
};

/**
 * Mengeksekusi pembuatan kredensial di cloud
 */
async function createNewUser(userData) {
    const { fullname, username, email, password, role } = userData;

    Swal.fire({
        title: 'Sinkronisasi Cloud...',
        text: 'Menghubungkan identitas baru ke server Firebase.',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    try {
        const firebaseConfig = {
            apiKey: "AIzaSyD265EEi0UE9wYNvOWKQ46huxpPTfZOcOE",
            authDomain: "libas-db.firebaseapp.com",
            projectId: "libas-db",
            storageBucket: "libas-db.firebasestorage.app",
            messagingSenderId: "918841790171",
            appId: "1:918841790171:web:04ce25a5727fddbd78c6fe"
        };

        const tempApp = initializeApp(firebaseConfig, "TempRegistrationApp");
        const tempAuth = getAuth(tempApp);

        // 1. Registrasi Auth
        const userCredential = await createUserWithEmailAndPassword(tempAuth, email, password);
        const uid = userCredential.user.uid;

        // 2. Simpan Metadata User
        await setDoc(doc(db, "user", uid), {
            fullname,
            username,
            email,
            role,
            createdAt: serverTimestamp()
        });

        // 3. Update Otoritas jika level Admin
        if (role === 'admin') {
            await setDoc(doc(db, "admin", uid), {
                role: 'admin',
                promotedAt: new Date().toISOString(),
                type: 'auth_entry'
            });
        }

        await tempAuth.signOut();

        Swal.fire({
            icon: 'success',
            title: 'Kredensial Selesai Dibuat',
            text: `Identitas untuk ${fullname} (@${username}) telah diverifikasi sebagai level ${role.toUpperCase()}.`,
        });

        logActivity("Admin", "Akses Pengguna", `Inisialisasi akun baru: ${fullname} (${role})`);

    } catch (error) {
        console.error("Critical Cloud Error:", error);
        let msg = error.message;
        if (error.code === 'auth/email-already-in-use') msg = "Database: Email sudah teregistrasi sebelumnya!";
        
        Swal.fire('Cloud Sync Failed', msg, 'error');
    }
}
