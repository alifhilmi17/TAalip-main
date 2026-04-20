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
    where
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { db } from "../../firebase.component/firebase-init.js";

/**
 * =========================================================
 * SISTEM ADMINISTRASI PETERNAKAN (LIBAS)
 * File: admin.js
 * Deskripsi: File ini menangani logika utama untuk halaman 
 * Admin Panel, termasuk pemuatan statistik global, ringkasan 
 * data terbaru (snapshot), dan pengelolaan log aktivitas sistem.
 * Terkoneksi langsung dengan Firebase Firestore.
 * =========================================================
 */

// Menjalankan inisialisasi saat struktur dokumen HTML selesai dimuat oleh browser
document.addEventListener('DOMContentLoaded', () => {
    console.log("Admin Panel Berhasil Dimuat - Firebase Mode.");
    initAdminDashboard();
});

/**
 * Fungsi Utama Inisialisasi Dashboard Admin
 */
function initAdminDashboard() {
    // 1. Monitor Pengguna (Koleksi: user)
    onSnapshot(collection(db, "user"), (snapshot) => {
        const userCount = snapshot.size;
        document.getElementById('stat-user').textContent = `${userCount} Orang`;
        
        // Update badge pada bagian manajemen pengguna
        const userBadge = document.getElementById('user-count-badge');
        if(userBadge) userBadge.textContent = `${userCount} Pengguna Terdaftar`;
        
        const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderUserList(users);
    });

    // 2. Monitor Populasi Ayam (Koleksi: populasi_ayam)
    onSnapshot(collection(db, "populasi_ayam"), (snapshot) => {
        let totalAyam = 0;
        let snapshotData = [];
        
        snapshot.forEach(doc => {
            const data = doc.data();
            totalAyam += parseInt(data.sisaAyam || 0);
            snapshotData.push({ id: doc.id, ...data });
        });

        document.getElementById('stat-admin-ayam').textContent = `${totalAyam.toLocaleString('id-ID')} Ekor`;
        renderAyamSnapshot(snapshotData.slice(0, 5));
    });

    // 3. Monitor Keuangan (Koleksi: keuangan)
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
        
        // Urutkan transaksi terbaru untuk tabel snapshot
        const latestTrx = trxData.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal)).slice(0, 5);
        renderKeuanganSnapshot(latestTrx);
    });

    // 4. Monitor Log Sistem (Koleksi: activity_log)
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
 * Merender Tabel Manajemen Pengguna (Real-time)
 */
function renderUserList(users) {
    const userBody = document.getElementById('adminUserListBody');
    if (!userBody) return;

    if (users.length === 0) {
        userBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Tidak ada pengguna terdaftar.</td></tr>`;
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
                        <div style="display:flex; gap:5px;">
                            <button onclick="toggleAdminRole('${user.id}', '${user.role || 'user'}')" class="action-btn-small" style="background:${isAdmin ? '#64748b' : '#3b82f6'}; color:white; border:none; padding:5px 8px; border-radius:5px; cursor:pointer; font-size:10px;">
                                ${isAdmin ? 'Demote' : 'Promote'}
                            </button>
                            <button onclick="deleteUser('${user.id}', '${user.fullname || user.username}')" class="action-btn-small" style="background:#ef4444; color:white; border:none; padding:5px 8px; border-radius:5px; cursor:pointer; font-size:10px;">
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
 * Merender Tabel Snapshot Batch Ayam
 */
function renderAyamSnapshot(data) {
    const ayamBody = document.getElementById('adminAyamSnapshot');
    if (!ayamBody) return;

    if (data.length === 0) {
        ayamBody.innerHTML = `<tr><td colspan="4" style="text-align:center;">Tidak ada data batch ayam.</td></tr>`;
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

function getStatusColor(status) {
    if (status === 'Panen') return '#3b82f6';
    if (status === 'Afkir') return '#ef4444';
    return '#10b981';
}

/**
 * Merender Tabel Snapshot Keuangan
 */
function renderKeuanganSnapshot(data) {
    const keuanganBody = document.getElementById('adminKeuanganSnapshot');
    if (!keuanganBody) return;

    if (data.length === 0) {
        keuanganBody.innerHTML = `<tr><td colspan="4" style="text-align:center;">Tidak ada transaksi terbaru.</td></tr>`;
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

function formatTanggal(tglString) {
    if (!tglString) return "-";
    const date = new Date(tglString);
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

/**
 * Merender Tabel Log Aktivitas Sistem
 */
function renderSystemLogs(logs) {
    const logBody = document.getElementById('systemLogBody');
    if (!logBody) return;

    if (logs.length === 0) {
        logBody.innerHTML = `<tr><td colspan="4" style="text-align:center;">Belum ada log aktivitas terekam.</td></tr>`;
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
 * Fungsi pembantu untuk mencatat aktivitas admin ke Firestore
 * @param {string} user - Nama pengguna yang melakukan aksi
 * @param {string} modul - Nama modul yang diakses
 * @param {string} aksi - Detail tindakan yang dilakukan
 */
export async function logActivity(user, modul, aksi) {
    try {
        // Menyimpan catatan ke koleksi khusus log aktivitas
        await addDoc(collection(db, "activity_log"), {
            user,
            modul,
            aksi,
            waktu: new Date().toISOString()
        });
    } catch (err) {
        console.error("Gagal mencatat log ke activity_log:", err);
    }
}

/**
 * Fungsi Administratif: Menghapus Seluruh Log Aktivitas
 */
window.clearLogs = async function() {
    Swal.fire({
        title: 'Hapus Semua Log?',
        text: "Seluruh riwayat aktivitas akan dihapus secara permanen dari database!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Ya, Bersihkan!',
        cancelButtonText: 'Batal'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                // Tampilkan loading karena proses bisa memakan waktu
                Swal.fire({
                    title: 'Membersihkan Log...',
                    allowOutsideClick: false,
                    didOpen: () => { Swal.showLoading(); }
                });

                // Ambil semua dokumen di koleksi activity_log
                const querySnapshot = await getDocs(collection(db, "activity_log"));
                
                // Hapus satu per satu
                const deletePromises = querySnapshot.docs.map(document => 
                    deleteDoc(doc(db, "activity_log", document.id))
                );
                
                await Promise.all(deletePromises);

                Swal.fire('Berhasil!', 'Seluruh log aktivitas telah dibersihkan.', 'success');
                
                // Catat aksi pembersihan ini sebagai log pertama di koleksi baru
                logActivity("Admin", "Sistem", "Membersihkan seluruh riwayat log aktivitas.");
                
            } catch (err) {
                console.error("Gagal menghapus log:", err);
                Swal.fire('Gagal', 'Terjadi kesalahan: ' + err.message, 'error');
            }
        }
    });
}

/**
 * Sidebar Navigation Helpers
 */
/**
 * Fungsi Administratif: Menghapus Pengguna dari Database
 */
window.deleteUser = async function(uid, name) {
    Swal.fire({
        title: 'Konfirmasi Hapus',
        text: `Apakah Anda yakin ingin menghapus pengguna "${name}" secara permanen?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Ya, Hapus!',
        cancelButtonText: 'Batal'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                await deleteDoc(doc(db, "user", uid));
                Swal.fire('Berhasil', 'Pengguna telah dihapus dari sistem.', 'success');
                logActivity("Admin", "User Management", `Menghapus user: ${name}`);
            } catch (err) {
                Swal.fire('Gagal', 'Terjadi kesalahan: ' + err.message, 'error');
            }
        }
    });
}

/**
 * Fungsi Administratif: Mengubah Role Pengguna
 */
window.toggleAdminRole = async function(uid, currentRole) {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    const actionText = newRole === 'admin' ? 'Promote ke Admin' : 'Demote ke User Biasa';

    Swal.fire({
        title: 'Ubah Role?',
        text: `Apakah Anda ingin mengubah role pengguna ini menjadi ${newRole.toUpperCase()}?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#3b82f6',
        confirmButtonText: 'Ya, Lanjutkan'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                // 1. Update role di koleksi 'user'
                await updateDoc(doc(db, "user", uid), {
                    role: newRole
                });
                
                // 2. Update otoritas di koleksi 'admin' (Source of Truth untuk Login)
                const adminRef = doc(db, "admin", uid);
                if (newRole === 'admin') {
                    // Berikan akses admin
                    await setDoc(adminRef, {
                        role: 'admin',
                        promotedAt: new Date().toISOString(),
                        type: 'auth_entry' // Pembeda dengan data log
                    });
                } else {
                    // Cabut akses admin (Hapus dari daftar otoritas)
                    // Note: Jika koleksi admin juga dipakai untuk log, kita hanya boleh hapus jika ID-nya adalah UID.
                    // Karena kita menggunakan setDoc(adminRef, ...) dengan ID=UID, aman untuk dihapus.
                    await deleteDoc(adminRef);
                }
                
                await Swal.fire('Berhasil', `Role berhasil diubah menjadi ${newRole.toUpperCase()}.`, 'success');
                
                // 3. Catat log aktivitas (sebagai entitas log terpisah)
                await logActivity("Admin", "User Management", `Mengubah role user (${uid}) menjadi ${newRole}`);
                
            } catch (err) {
                console.error("Gagal mengubah role:", err);
                Swal.fire('Gagal', 'Terjadi kesalahan: ' + err.message, 'error');
            }
        }
    });
}

/**
 * Sidebar Navigation Helpers
 */
window.toggleSidebarMenu = function(id) {
    const menu = document.getElementById(id);
    const button = menu.previousElementSibling;
    const isExpanded = button.getAttribute('aria-expanded') === 'true';

    button.setAttribute('aria-expanded', !isExpanded);
    menu.setAttribute('aria-hidden', isExpanded);
    button.classList.toggle('active');
}
