/* =========================================================
   🛡️ SISTEM ADMINISTRASI SUPER ADMIN (admin.js)
   ---------------------------------------------------------
   Digunakan khusus untuk mengontrol halaman admin.html
   ========================================================= */

// =========================================
// 1. PENGENDALI SIDEBAR & NAVIGASI ADMIN
// =========================================
function toggleSidebarMenu(submenuId) {
    const submenu = document.getElementById(submenuId);
    if (submenu.classList.contains('show')) {
        submenu.classList.remove('show');
    }
    const isHidden = submenu.getAttribute("aria-hidden") === "true";
    const parentButton = submenu.previousElementSibling;

    submenu.setAttribute("aria-hidden", !isHidden);
    parentButton.setAttribute("aria-expanded", isHidden);

    if (isHidden) {
        parentButton.classList.add("active-parent");
    } else {
        parentButton.classList.remove("active-parent");
    }
}

function goToProfile() {
    Swal.fire({
        icon: 'info',
        title: 'Profil Admin',
        text: 'Mengelola hak akses admin akan tersedia di versi berikutnya.',
        confirmButtonColor: '#3b82f6'
    });
}

function logoutAdmin() {
    Swal.fire({
        title: "Akhiri Sesi Admin?",
        text: "Anda akan keluar dari Super Admin Panel.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Ya, logout",
        cancelButtonText: "Batal",
        confirmButtonColor: "#d33",
        cancelButtonColor: "#3085d6"
    }).then((result) => {
        if (result.isConfirmed) {
            window.location.href = "login.html";
        }
    });
}

// =========================================
// 2. INISIALISASI DATA DASHBOARD ADMIN
// =========================================
document.addEventListener("DOMContentLoaded", () => {
    
    // -- Menghitung Data Keuangan --
    const storedFinance = JSON.parse(localStorage.getItem('financeData')) || [];
    let totalTransaksi = storedFinance.length;
    let saldoTotal = 0;
    storedFinance.forEach(trx => {
        if (trx.type === 'pemasukan') {
            saldoTotal += trx.amount;
        } else {
            saldoTotal -= trx.amount;
        }
    });

    // -- Menghitung Data Kandang (Data Ayam) --
    // Membaca dari dataAyamData sesuai di dataAyamTAalip.js
    const storedAyam = JSON.parse(localStorage.getItem('dataAyamData')) || [];
    let totalAyamGlobal = 0;
    
    if(storedAyam.length > 0) {
        storedAyam.forEach(item => {
            if (item.status === 'Aktif') {
                totalAyamGlobal += Number(item.sisaAyam) || 0;
            }
        });
    } else {
        // Fallback default system
        totalAyamGlobal = 5000;
    }

    // -- Menghitung Prediksi Aktif --
    // Menggunakan variabel palsu karena sistem prediksi tidak menyimpan riwayat (stateless)
    let totalPrediksi = 15;

    // Push Statistic to UI
    document.getElementById("stat-admin-ayam").textContent = `${totalAyamGlobal.toLocaleString('id-ID')} Ekor`;
    document.getElementById("stat-admin-uang").textContent = `${totalTransaksi.toLocaleString('id-ID')} Trx`;
    
    // Update label saldo (jika ada) - ubah "Record" dsb
    const statPrediksi = document.getElementById("stat-admin-prediksi");
    if (statPrediksi) {
        statPrediksi.textContent = `Rp ${saldoTotal.toLocaleString('id-ID')}`;
    }

    // Sistem Logs (Mock)
    let logs = JSON.parse(localStorage.getItem('adminSystemLogs'));
    if (!logs) {
        logs = [
            { time: new Date().toLocaleString('id-ID'), user: 'Alep', modul: 'Keuangan', detail: 'Update data pengeluaran pakan' },
            { time: new Date(Date.now() - 3600000).toLocaleString('id-ID'), user: 'Alep', modul: 'Sistem', detail: 'Login ke dalam sistem' },
            { time: new Date(Date.now() - 86400000).toLocaleString('id-ID'), user: 'Admin', modul: 'Prediksi', detail: 'Menjalankan engine Prediksi ML' }
        ];
        localStorage.setItem('adminSystemLogs', JSON.stringify(logs));
    }

    renderLogs();
    renderAyamSnapshot(storedAyam);
    renderKeuanganSnapshot(storedFinance);
});

// =========================================
// 3. RENDER SNAPSHOT TABEL (TERINTEGRASI)
// =========================================
function renderAyamSnapshot(storedAyam) {
    const tbody = document.getElementById("adminAyamSnapshot");
    if (!tbody) return;
    
    tbody.innerHTML = "";
    if (storedAyam.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">Belum ada data Ayam.</td></tr>`;
        return;
    }
    
    // Tampilkan 4 data ayam terakhir yang aktif
    const activeAyam = storedAyam.filter(a => a.status === 'Aktif').slice(-4);
    
    activeAyam.forEach(ayam => {
        tbody.innerHTML += `
            <tr>
                <td><strong>${ayam.id}</strong></td>
                <td>${ayam.jenis}</td>
                <td><span style="color: #27ae60; font-weight: 600;">${ayam.status}</span></td>
                <td>${ayam.sisaAyam.toLocaleString('id-ID')} ekor</td>
            </tr>
        `;
    });
}

function renderKeuanganSnapshot(storedFinance) {
    const tbody = document.getElementById("adminKeuanganSnapshot");
    if (!tbody) return;
    
    tbody.innerHTML = "";
    if (storedFinance.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">Belum ada Transaksi.</td></tr>`;
        return;
    }
    
    // Tampilkan 5 transaksi terakhir
    // Copy array lalu reverse supaya yang terbaru di atas
    const latestFinance = [...storedFinance].reverse().slice(0, 5);
    
    latestFinance.forEach(trx => {
        let isIncome = trx.type === 'pemasukan';
        let tipeWarna = isIncome ? 'color: #27ae60;' : 'color: #e74c3c;';
        let tipeSimbol = isIncome ? '▲ Plus' : '▼ Minus';
        
        // Memodifikasi format tanggal aslinya (biasanya YYYY-MM-DD)
        let tgl = new Date(trx.date).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'});
        
        tbody.innerHTML += `
            <tr>
                <td>${tgl}</td>
                <td>${trx.description.substring(0, 20)}${trx.description.length > 20 ? '...' : ''}</td>
                <td style="${tipeWarna} font-weight: 600; font-size: 0.85rem;">${tipeSimbol}</td>
                <td style="font-weight: 600;">Rp ${trx.amount.toLocaleString('id-ID')}</td>
            </tr>
        `;
    });
}

// =========================================
// 4. RENDER SYSTEM LOGS
// =========================================
function renderLogs() {
    const tbody = document.getElementById("systemLogBody");
    const logs = JSON.parse(localStorage.getItem('adminSystemLogs')) || [];
    
    tbody.innerHTML = "";
    
    if(logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">Tidak ada log aktivitas hari ini.</td></tr>`;
        return;
    }

    logs.forEach(log => {
        tbody.innerHTML += `
            <tr>
                <td>${log.time}</td>
                <td><strong>${log.user}</strong></td>
                <td><span style="background: #e2e8f0; padding: 3px 8px; border-radius: 4px; font-size:0.8rem;">${log.modul}</span></td>
                <td>${log.detail}</td>
            </tr>
        `;
    });
}

function clearLogs() {
    Swal.fire({
        title: "Hapus Rekam Log?",
        text: "Log aktivitas sistem akan dibersihkan secara permanen.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#3085d6",
        confirmButtonText: "Ya, Bersihkan",
        cancelButtonText: "Batal"
    }).then((result) => {
        if(result.isConfirmed) {
            localStorage.setItem('adminSystemLogs', JSON.stringify([]));
            renderLogs();
            Swal.fire("Selesai!", "Log sistem telah dibersihkan.", "success");
        }
    });

    // Helper Fungsi untuk Modul Lain mencatat log
    // Gunakan fungsi ini di file lain: adminLogActivity('Alep', 'Kandang', 'Menambah ayam...')
}

window.adminLogActivity = function(user, modul, detail) {
    let logs = JSON.parse(localStorage.getItem('adminSystemLogs')) || [];
    logs.unshift({
        time: new Date().toLocaleString('id-ID'),
        user: user,
        modul: modul,
        detail: detail
    });
    // Simpan maksimal 20 log terakhir
    if(logs.length > 20) logs.pop();
    localStorage.setItem('adminSystemLogs', JSON.stringify(logs));
}
