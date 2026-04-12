/**
 * =========================================================
 * SISTEM ADMINISTRASI PETERNAKAN (LIBAS)
 * File: admin.js
 * Deskripsi: Logika operasional untuk Panel Admin, 
 * mengelola snapshot data dan log aktivitas.
 * =========================================================
 */

// Menjalankan inisialisasi saat dokumen selesai dimuat
document.addEventListener('DOMContentLoaded', () => {
    console.log("Admin Panel Berhasil Dimuat.");
    loadAdminStats();
    loadSnapshots();
    loadSystemLogs();
});

/**
 * Memuat Statistik Global di Dashboard Admin
 */
function loadAdminStats() {
    // Implementasi pengambilan data dari localStorage atau Firebase
    const userCount = 3; // Contoh data statis
    document.getElementById('stat-user').textContent = `${userCount} Orang`;
    
    // Total Ayam (Contoh dummy)
    const dataAyam = JSON.parse(localStorage.getItem('dataAyam_TA')) || [];
    const totalAyam = dataAyam.reduce((sum, item) => sum + parseInt(item.jumlah || 0), 0);
    document.getElementById('stat-admin-ayam').textContent = `${totalAyam} Ekor`;

    // Saldo Keuangan (Contoh dummy)
    const dataKeuangan = JSON.parse(localStorage.getItem('keuangan_TA')) || [];
    const totalSaldo = dataKeuangan.reduce((acc, curr) => {
        return curr.tipe === 'Pemasukan' ? acc + (curr.nominal || 0) : acc - (curr.nominal || 0);
    }, 0);
    document.getElementById('stat-admin-prediksi').textContent = `Rp ${totalSaldo.toLocaleString('id-ID')}`;
}

/**
 * Memuat Snapshot Data untuk Tabel Ringkasan
 */
function loadSnapshots() {
    const ayamBody = document.getElementById('adminAyamSnapshot');
    const dataAyam = JSON.parse(localStorage.getItem('dataAyam_TA')) || [];
    
    if (dataAyam.length === 0) {
        ayamBody.innerHTML = `<tr><td colspan="4" style="text-align:center;">Tidak ada data batch ayam.</td></tr>`;
    } else {
        ayamBody.innerHTML = dataAyam.slice(0, 5).map(item => `
            <tr>
                <td>${item.batch || '-'}</td>
                <td>${item.jenis || '-'}</td>
                <td><span class="status-badge" style="background:#10b981; color:white; padding:2px 8px; border-radius:10px; font-size:10px;">AKTIF</span></td>
                <td>${item.jumlah || 0}</td>
            </tr>
        `).join('');
    }

    const keuanganBody = document.getElementById('adminKeuanganSnapshot');
    const dataKeuangan = JSON.parse(localStorage.getItem('keuangan_TA')) || [];

    if (dataKeuangan.length === 0) {
        keuanganBody.innerHTML = `<tr><td colspan="4" style="text-align:center;">Tidak ada transaksi terbaru.</td></tr>`;
    } else {
        keuanganBody.innerHTML = dataKeuangan.slice(-5).reverse().map(item => `
            <tr>
                <td>${item.tanggal || '-'}</td>
                <td>${item.keterangan || '-'}</td>
                <td style="color: ${item.tipe === 'Pemasukan' ? '#10b981' : '#ef4444'}">${item.tipe}</td>
                <td>Rp ${parseInt(item.nominal || 0).toLocaleString('id-ID')}</td>
            </tr>
        `).join('');
    }
}

/**
 * Memuat Log Aktivitas Sistem (Dummy dari LocalStorage)
 */
function loadSystemLogs() {
    const logBody = document.getElementById('systemLogBody');
    const logs = JSON.parse(localStorage.getItem('system_logs_TA')) || [
        { waktu: new Date().toLocaleString(), user: 'Alep', modul: 'Otentikasi', aksi: 'Login Berhasil' },
        { waktu: new Date().toLocaleString(), user: 'Alep', modul: 'Keuangan', aksi: 'Melihat Laporan' }
    ];

    logBody.innerHTML = logs.map(log => `
        <tr>
            <td>${log.waktu}</td>
            <td><strong>${log.user}</strong></td>
            <td>${log.modul}</td>
            <td>${log.aksi}</td>
        </tr>
    `).join('');
}

/**
 * Fungsi untuk Menghapus Log (Mockup)
 */
function clearLogs() {
    Swal.fire({
        title: 'Hapus Log?',
        text: "Seluruh riwayat aktivitas akan dibersihkan secara permanen.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Ya, Bersihkan!',
        cancelButtonText: 'Batal'
    }).then((result) => {
        if (result.isConfirmed) {
            localStorage.removeItem('system_logs_TA');
            loadSystemLogs();
            Swal.fire('Terhapus!', 'Log sistem telah dibersihkan.', 'success');
        }
    });
}

/**
 * Navigasi ke Profil
 */
function goToProfile() {
    window.location.href = 'editProfileTAalip.html';
}

/**
 * Logout User
 */
function logoutUser() {
    Swal.fire({
        title: 'Logout?',
        text: "Anda akan keluar dari sesi admin.",
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Keluar',
        cancelButtonText: 'Tetap Disini'
    }).then((result) => {
        if (result.isConfirmed) {
            window.location.href = 'login.html';
        }
    });
}

/**
 * Sidebar Navigation Helpers
 */
function toggleSidebarMenu(id) {
    const menu = document.getElementById(id);
    const button = menu.previousElementSibling;
    const isExpanded = button.getAttribute('aria-expanded') === 'true';

    button.setAttribute('aria-expanded', !isExpanded);
    menu.setAttribute('aria-hidden', isExpanded);
    
    // Toggle class active untuk styling arrow
    button.classList.toggle('active');
}
