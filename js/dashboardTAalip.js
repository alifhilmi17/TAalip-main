/* =========================================================
   🐔 SISTEM ADMINISTRASI PETERNAKAN (KODE JAVASCRIPT DASHBOARD)
   File: dashboardTAalip.js
   ---------------------------------------------------------
   Deskripsi singkat:
   File ini berfungsi sebagai pengontrol antarmuka utama (Dashboard).
   Menggunakan Google Firebase Firestore untuk sinkronisasi data real-time.
========================================================= */

import { 
    collection, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    doc, 
    onSnapshot, 
    query, 
    orderBy,
    limit,
    getDocs,
    arrayUnion
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { db, auth } from "../firebase.component/firebase-init.js";

// =========================================
// 1. PENGENDALI SIDEBAR & NAVIGASI
// =========================================
window.toggleSidebarMenu = function(submenuId) {
    const submenu = document.getElementById(submenuId);
    if (!submenu) return;
    const isHidden = submenu.getAttribute("aria-hidden") === "true";
    const parentButton = submenu.previousElementSibling;
    submenu.setAttribute("aria-hidden", !isHidden);
    parentButton.setAttribute("aria-expanded", isHidden);
    if (isHidden) parentButton.classList.add("active-parent");
    else parentButton.classList.remove("active-parent");
};

// =========================================================
// 2. PROFILE NAVIGATION
// =========================================================
// goToProfile() sudah didefinisikan di firebase.component/auth-state.js
// yang di-load di semua halaman — tidak perlu didefinisikan ulang di sini.

// =========================================
// 3. STATE GLOBAL (REAL-TIME DATA)
// =========================================
let state = {
    schedules: [],
    activities: [],
    announcements: [],
    produksi: [],
    keuangan: [],
    ayam: [],
    pakan: [],
    kesehatan: [], // Tambah state untuk data kesehatan mortalitas
    prediksi: [], //  Tambah state untuk data prediksi
    vaksinasi: [], //  Tambah state untuk data vaksinasi
    reminders: [], // Tambah state untuk data restock_reminders
    alertLimits: { kritis: 20, rendah: 50 } // Default limits
};

let eggChartInstance = null;
let financeChartInstance = null;

// =========================================
// 2b. STATE PENGGUNA (ROLE & NAMA)
// =========================================
let currentUserName = "Pengguna";
let currentUserRole = "petugas"; // 'admin' atau 'petugas'

// Deteksi role pengguna saat halaman dimuat
document.addEventListener("DOMContentLoaded", () => {
    onAuthStateChanged(auth, async (user) => {
        if (!user) return;
        try {
            const { getDoc } = await import("https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js");
            // Cek koleksi admin terlebih dahulu
            const adminSnap = await getDoc(doc(db, "admin", user.uid));
            if (adminSnap.exists()) {
                currentUserRole = "admin";
                currentUserName = adminSnap.data().fullname || adminSnap.data().username || "Admin";
            } else {
                const userSnap = await getDoc(doc(db, "user", user.uid));
                if (userSnap.exists()) {
                    const userData = userSnap.data();
                    currentUserName = userData.fullname || user.displayName || "Petugas";
                    const role = (userData.role || 'petugas').trim().toLowerCase();
                    currentUserRole = (role === 'admin' || role === 'administrator') ? 'admin' : 'petugas';
                }
            }
        } catch (err) {
            console.warn("Gagal deteksi role:", err);
        }
        // Tampilkan/sembunyikan form input pengumuman berdasarkan role
        applyAnnouncementRoleUI();
        // Re-render pengumuman agar tombol konfirmasi muncul dengan nama yang benar
        renderAnnouncements();
    });
});

// =========================================
// 4. INISIALISASI & LISTENERS
// =========================================
document.addEventListener("DOMContentLoaded", () => {
    // A. Schedules: Mendengarkan perubahan data jadwal secara real-time
    onSnapshot(query(collection(db, "schedules"), orderBy("createdAt", "desc")), (snap) => {
        state.schedules = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderSchedule(); // Perbarui tabel jadwal di UI
    });

    // B. Activities: Mendengarkan daftar aktivitas harian
    onSnapshot(query(collection(db, "daily_activities"), orderBy("createdAt", "desc")), (snap) => {
        state.activities = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderActivities(); // Perbarui daftar ceklis aktivitas
    });

    // C. Announcements: Mendengarkan pengumuman atau notifikasi sistem
    onSnapshot(query(collection(db, "announcements"), orderBy("createdAt", "desc")), (snap) => {
        state.announcements = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderAnnouncements(); // Perbarui tampilan pengumuman
    });

    // D. Data Produksi: Mendengarkan data jumlah telur harian
    onSnapshot(collection(db, "produksi_harian"), (snap) => {
        state.produksi = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        updateDashboardAggregates(); // Hitung ulang statistik dashboard
    });

    // E. Data Keuangan: Mendengarkan transaksi pemasukan/pengeluaran
    onSnapshot(collection(db, "keuangan"), (snap) => {
        state.keuangan = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        updateDashboardAggregates(); // Hitung ulang total pendapatan
    });

    // F. Data Ayam: Mendengarkan data populasi dan status batch ayam
    onSnapshot(collection(db, "populasi_ayam"), (snap) => {
        state.ayam = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        updateDashboardAggregates(); // Perbarui jumlah ekor ayam aktif
    });

    // G. Data Pakan: Mendengarkan aliran masuk dan keluar pakan
    onSnapshot(collection(db, "stok_pakan"), (snap) => {
        state.pakan = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        updateDashboardAggregates();
    });

    // H. Data Kesehatan: Mendengarkan data mortalitas dari koleksi kesehatan_ayam
    onSnapshot(collection(db, "kesehatan_ayam"), (snap) => {
        state.kesehatan = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        updateDashboardAggregates();
    });

    // I. ✅ FASE 2: Data Prediksi - Mendengarkan prediksi terakhir
    onSnapshot(query(collection(db, "prediksi_history"), orderBy("tanggal", "desc"), limit(1)), (snap) => {
        state.prediksi = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderPrediksiWidget();
    });

    // J. Data Reminders Pakan
    onSnapshot(collection(db, "restock_reminders"), (snap) => {
        state.reminders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        updateFase3Features();
    });

    // K. Listener Settings Pakan Alert
    onSnapshot(doc(db, "settings", "pakan_alert"), (docSnap) => {
        if (docSnap.exists()) {
            state.alertLimits = docSnap.data();
            updateFase3Features();
        }
    });
});

// =========================================================
// 5. INITIALIZE ALL FASE 3 FEATURES
// =========================================================

// Add vaccination listener to existing DOMContentLoaded
document.addEventListener("DOMContentLoaded", () => {
    // Add vaccination listener
    onSnapshot(collection(db, "vaksinasi_ayam"), (snap) => {
        state.vaksinasi = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderVaccinationWidget();
        renderAlertBanners(); // Re-render banner saat data vaksinasi berubah
    });
});

// Update features when data changes
function updateFase3Features() {
    checkFeedStockAlerts();
    renderVaccinationWidget();
    renderAlertBanners();
}

// Call updates in existing updateDashboardAggregates function
const originalUpdateDashboardAggregates = updateDashboardAggregates;
updateDashboardAggregates = function() {
    originalUpdateDashboardAggregates();
    updateFase3Features();
};

// Initialize FASE 3 features on page load
document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
        updateFase3Features();
    }, 1000);
});

console.log("🚀 FASE 3 Features Loaded: Quick Actions, Alert Banner, Feed Alerts, Vaccination Schedule, goToProfile fix, Activity Progress Bar");// =========================================================
// 6. DYNAMIC ALERT BANNER
// =========================================================

/**
 * Membangun dan menampilkan alert banner dinamis di atas dashboard.
 * Banner muncul otomatis berdasarkan kondisi data real-time:
 * - Stok pakan kritis / rendah
 * - Ada ayam sakit / dalam perawatan
 * - Mortalitas hari ini tinggi
 * - Vaksinasi hari ini / besok
 */
function renderAlertBanners() {
    const container = document.getElementById('alertBannerContainer');
    if (!container) return;

    const alerts = [];

    // --- 1. Cek Stok Pakan ---
    let pakanMasuk = 0, pakanKeluar = 0;
    state.pakan.forEach(p => {
        if (p.tipe === 'Masuk') pakanMasuk += p.jumlah;
        else pakanKeluar += p.jumlah;
    });
    const sisaPakan = pakanMasuk - pakanKeluar;

    const { kritis, rendah } = state.alertLimits;

    if (sisaPakan <= kritis) {
        alerts.push({
            level: 'danger',
            icon: '🚨',
            title: 'Stok Pakan Kritis!',
            msg: `Sisa pakan hanya <strong>${sisaPakan.toLocaleString('id-ID')} Kg</strong>. Segera lakukan pembelian pakan sekarang.`,
            action: { label: 'Kelola Pakan →', href: 'stokpakan.html' }
        });
    } else if (sisaPakan <= rendah) {
        alerts.push({
            level: 'warning',
            icon: '⚠️',
            title: 'Stok Pakan Rendah',
            msg: `Sisa pakan <strong>${sisaPakan.toLocaleString('id-ID')} Kg</strong>. Persiapkan restock sebelum habis.`,
            action: { label: 'Lihat Stok →', href: 'stokpakan.html' }
        });
    }

    // --- 1.b. Cek Restock Reminders ---
    const pendingReminders = state.reminders.filter(r => r.status === 'Pending');
    const tinggiReminders = pendingReminders.filter(r => r.prioritas === 'Tinggi');
    
    if (tinggiReminders.length > 0) {
        alerts.push({
            level: 'danger',
            icon: '⏰',
            title: 'Pengingat Restock Mendesak!',
            msg: `Ada <strong>${tinggiReminders.length} pengingat pakan</strong> prioritas tinggi yang belum selesai.`,
            action: { label: 'Lihat Reminder →', href: 'restockreminder.html' }
        });
    } else if (pendingReminders.length > 0) {
        alerts.push({
            level: 'info',
            icon: '⏰',
            title: 'Pengingat Restock Pakan',
            msg: `Terdapat <strong>${pendingReminders.length} pengingat</strong> pemesanan pakan yang menunggu diselesaikan.`,
            action: { label: 'Lihat Reminder →', href: 'restockreminder.html' }
        });
    }

    // --- 2. Cek Ayam Sakit ---
    const ayamSakit = state.kesehatan
        .filter(x => x.status === "Dalam Perawatan")
        .reduce((sum, item) => sum + (parseInt(item.jmlSakit) || 0), 0);

    if (ayamSakit > 0) {
        alerts.push({
            level: 'warning',
            icon: '🩺',
            title: 'Ada Ayam Dalam Perawatan',
            msg: `<strong>${ayamSakit.toLocaleString('id-ID')} ekor</strong> ayam sedang dalam perawatan. Pantau kondisi kesehatan kandang.`,
            action: { label: 'Cek Kesehatan →', href: 'kesehatanayam.html' }
        });
    }

    // --- 3. Cek Mortalitas Hari Ini ---
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    const mortalitasHariIni = state.kesehatan
        .filter(x => x.tanggal === todayStr)
        .reduce((sum, item) => {
            if (item.status === 'Mati Semua') return sum + (parseInt(item.jmlSakit)||0) + (parseInt(item.jmlMati)||0);
            return sum + (parseInt(item.jmlMati) || 0);
        }, 0);

    if (mortalitasHariIni > 0) {
        alerts.push({
            level: 'danger',
            icon: '💀',
            title: `Mortalitas Hari Ini: ${mortalitasHariIni} Ekor`,
            msg: `Tercatat <strong>${mortalitasHariIni} ekor</strong> ayam mati hari ini. Periksa penyebab dan kondisi kandang segera.`,
            action: { label: 'Lihat Data Kesehatan →', href: 'kesehatanayam.html' }
        });
    }

    // --- 4. Cek Vaksinasi Hari Ini / Besok ---
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth()+1).padStart(2,'0')}-${String(tomorrow.getDate()).padStart(2,'0')}`;

    const vaksinHariIni = state.vaksinasi.filter(v => v.status === 'Terjadwal' && v.tanggal === todayStr);
    const vaksinBesok = state.vaksinasi.filter(v => v.status === 'Terjadwal' && v.tanggal === tomorrowStr);

    if (vaksinHariIni.length > 0) {
        alerts.push({
            level: 'info',
            icon: '💉',
            title: 'Jadwal Vaksinasi Hari Ini!',
            msg: `Ada <strong>${vaksinHariIni.length} jadwal vaksinasi</strong> yang harus dilakukan hari ini. Jangan sampai terlewat.`,
            action: { label: 'Lihat Jadwal →', href: 'kesehatanayam.html' }
        });
    } else if (vaksinBesok.length > 0) {
        alerts.push({
            level: 'info',
            icon: '📅',
            title: 'Vaksinasi Besok',
            msg: `Ada <strong>${vaksinBesok.length} jadwal vaksinasi</strong> besok. Siapkan peralatan dan vaksin sekarang.`,
            action: { label: 'Lihat Jadwal →', href: 'kesehatanayam.html' }
        });
    }

    // --- Render semua alert ---
    container.innerHTML = '';

    if (alerts.length === 0) {
        // Semua kondisi aman — tampilkan banner hijau singkat
        container.innerHTML = `
            <div class="alert-banner alert-banner-success" role="alert">
                <span class="alert-banner-icon">✅</span>
                <div class="alert-banner-body">
                    <strong>Semua kondisi kandang normal.</strong>
                    <span>Tidak ada peringatan aktif saat ini.</span>
                </div>
            </div>
        `;
        return;
    }

    alerts.forEach(alert => {
        const div = document.createElement('div');
        div.className = `alert-banner alert-banner-${alert.level}`;
        div.setAttribute('role', 'alert');
        div.innerHTML = `
            <span class="alert-banner-icon">${alert.icon}</span>
            <div class="alert-banner-body">
                <strong>${alert.title}</strong>
                <span>${alert.msg}</span>
            </div>
            ${alert.action ? `<a href="${alert.action.href}" class="alert-banner-action">${alert.action.label}</a>` : ''}
            <button class="alert-banner-close" onclick="this.parentElement.remove()" title="Tutup">×</button>
        `;
        container.appendChild(div);
    });
}

// =========================================================
// 7. AGGREGATES, STATS & CHARTS (LOGIKA PERHITUNGAN)
// =========================================================
/**
 * Menghitung dan memperbarui seluruh angka ringkasan (Statistik) di Dashboard.
 * Fungsi ini dipanggil setiap kali ada perubahan data (real-time) dari Firestore.
 */
function updateDashboardAggregates() {
    // Mengambil tanggal hari ini dengan format YYYY-MM-DD (timezone lokal Indonesia)
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;
    
    console.log('🔍 DEBUG Dashboard - Tanggal hari ini:', todayStr);
    console.log('🔍 DEBUG Dashboard - Total data produksi:', state.produksi.length);
    
    // 1. Perhitungan Statistik Produksi Telur (Hanya Hari Ini)
    // Menyaring data produksi yang tanggalnya sama dengan hari ini
    const prodToday = state.produksi.filter(p => {
        console.log('🔍 DEBUG - Data tanggal:', p.tanggal, 'vs', todayStr, '=', p.tanggal === todayStr);
        return p.tanggal === todayStr;
    });
    console.log('🔍 DEBUG Dashboard - Data hari ini:', prodToday.length);
    
    // Menjumlahkan total telur dari hasil saringan tersebut
    const totalTelurToday = prodToday.reduce((s, v) => s + (v.totalTelur || 0), 0);
    console.log('🔍 DEBUG Dashboard - Total telur hari ini:', totalTelurToday);
    
    // Menjumlahkan total telur cacat hari ini
    const totalTelurCacatToday = prodToday.reduce((s, v) => s + (parseInt(v.telurCacat) || 0), 0);
    
    // Memperbarui tampilan di UI
    document.getElementById('stat-telur').textContent = `${totalTelurToday.toLocaleString('id-ID')} Butir`;
    
    // Tampilkan info telur cacat hari ini di bawah Total Telur Hari Ini
    const elTelurCacatInline = document.getElementById('stat-telur-cacat-inline');
    if (elTelurCacatInline) {
        if (totalTelurCacatToday > 0) {
            elTelurCacatInline.textContent = `${totalTelurCacatToday.toLocaleString('id-ID')} Butir Telur Cacat`;
            elTelurCacatInline.style.display = 'block';
        } else {
            elTelurCacatInline.style.display = 'none';
        }
    }

    // 2. Perhitungan Statistik Populasi Ayam Aktif
    // Menghitung total sisa ayam dari batch yang statusnya 'Aktif'
    const totalSisaAyam = state.ayam.filter(a => a.status === 'Aktif')
                                     .reduce((s, v) => s + (parseInt(v.sisaAyam) || 0), 0);
    
    // 2.b. Perhitungan Ayam Sakit (Dalam Perawatan)
    const ayamSakit = state.kesehatan.filter(x => x.status === "Dalam Perawatan")
                                     .reduce((sum, item) => sum + (parseInt(item.jmlSakit) || 0), 0);
    
    // 2.c. Total Ayam Aktif Sehat = Sisa Ayam - Ayam Sakit
    const totalAyamAktifSehat = totalSisaAyam - ayamSakit;
    
    // Update tampilan Total Ayam Aktif (sudah dikurangi ayam sakit)
    document.getElementById('stat-ayam').textContent = `${totalAyamAktifSehat.toLocaleString('id-ID')} Ekor`;
    
    // Tampilkan info ayam sakit di bawah Total Ayam Aktif
    const elSakit = document.getElementById('stat-ayam-sakit');
    if (elSakit) {
        if (ayamSakit > 0) {
            elSakit.textContent = `${ayamSakit.toLocaleString('id-ID')} Ekor Sakit / Dirawat`;
            elSakit.style.display = 'block';
        } else {
            elSakit.style.display = 'none';
        }
    }

    // 3. Perhitungan Statistik Keuangan (Khusus Pemasukan Bulan Ini)
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    let incomeBulanIni = 0, expenseBulanIni = 0;
    let incomeGlobal = 0, expenseGlobal = 0;
    
    // Mengecek setiap transaksi keuangan
    state.keuangan.forEach(trx => {
        const d = new Date(trx.tanggal);
        // Menghitung total akumulasi global (semua waktu)
        if (trx.tipe === 'pemasukan') incomeGlobal += trx.jumlah;
        else expenseGlobal += trx.jumlah;

        // Memfilter transaksi yang terjadi pada bulan & tahun ini
        if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
            if (trx.tipe === 'pemasukan') incomeBulanIni += trx.jumlah;
            else expenseBulanIni += trx.jumlah;
        }
    });

    // Menampilkan pendapatan & pengeluaran ke dashboard
    const pendapatanEl = document.getElementById('stat-pendapatan');
    const pengeluaranEl = document.getElementById('stat-pengeluaran');

    if (pendapatanEl) {
        if (incomeBulanIni === 0 && incomeGlobal > 0) {
            pendapatanEl.textContent = `Rp ${incomeGlobal.toLocaleString('id-ID')}`;
            pendapatanEl.previousElementSibling.textContent = "Total Pendapatan";
        } else {
            pendapatanEl.textContent = `Rp ${incomeBulanIni.toLocaleString('id-ID')}`;
            pendapatanEl.previousElementSibling.textContent = "Pendapatan Bulan Ini";
        }
    }

    if (pengeluaranEl) {
        if (expenseBulanIni === 0 && expenseGlobal > 0) {
            pengeluaranEl.textContent = `Rp ${expenseGlobal.toLocaleString('id-ID')}`;
            pengeluaranEl.previousElementSibling.textContent = "Total Pengeluaran";
        } else {
            pengeluaranEl.textContent = `Rp ${expenseBulanIni.toLocaleString('id-ID')}`;
            pengeluaranEl.previousElementSibling.textContent = "Pengeluaran Bulan Ini";
        }
    }

    // 4. Perhitungan Statistik Sisa Pakan
    let pakanMasuk = 0, pakanKeluar = 0;
    // Menjumlahkan total pakan yang dibeli (Masuk) dan yang digunakan (Keluar)
    state.pakan.forEach(p => {
        if (p.tipe === 'Masuk') pakanMasuk += p.jumlah;
        else pakanKeluar += p.jumlah;
    });
    // Sisa pakan adalah selisih antara pakan masuk dan pakan keluar
    document.getElementById('stat-pakan').textContent = `${(pakanMasuk - pakanKeluar).toLocaleString('id-ID')} Kg`;

    // 5. Perhitungan Statistik Mortalitas (Kematian Ayam)
    // Aturan: "Mati Semua" = jmlSakit + jmlMati (semua yg sakit mati + yg sudah mati sebelumnya)
    // Contoh: 15 sakit + 5 sudah mati = 20 total kematian
    // Status lain → gunakan jmlMati saja yang tercatat manual
    const totalMortalitas = state.kesehatan.reduce((sum, item) => {
        if (item.status === 'Mati Semua') {
            return sum + (parseInt(item.jmlSakit) || 0) + (parseInt(item.jmlMati) || 0);
        }
        return sum + (parseInt(item.jmlMati) || 0);
    }, 0);
    const elMortalitas = document.getElementById('stat-mortalitas');
    if (elMortalitas) elMortalitas.textContent = `${totalMortalitas.toLocaleString('id-ID')} Ekor`;

    // 6. Perhitungan Statistik Afkir (Ayam yang sudah tidak produktif / dipensiunkan)
    const totalAfkir = state.ayam.filter(a => a.status === 'Afkir')
                                 .reduce((s, v) => s + (parseInt(v.sisaAyam) || parseInt(v.jumlahAwal) || 0), 0);
    const elAfkir = document.getElementById('stat-afkir');
    if (elAfkir) elAfkir.textContent = `${totalAfkir.toLocaleString('id-ID')} Ekor`;



    // 8. ✅ FITUR BARU: Perhitungan Statistik Batch Aktif
    const totalBatchAktif = state.ayam.filter(a => a.status === 'Aktif').length;
    const elBatchAktif = document.getElementById('stat-batch-aktif');
    if (elBatchAktif) elBatchAktif.textContent = `${totalBatchAktif} Batch`;

    // 9. Memperbarui Grafik Analitik Visual
    renderEggChart(7); // Render grafik produksi 7 hari terakhir
    renderFinanceChart(); // Render grafik keuangan bulanan
    
    // ✅ FASE 2: Update widget ringkasan keuangan
    renderFinanceSummaryWidget();
}

/** 
 * CHART LOGIC (REUSED & ADAPTED)
 */
window.gantiPeriodeGrafik = function(hari, btn) {
    document.querySelectorAll('.chart-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderEggChart(hari);
};

/** 
 * Merender Grafik Produksi Telur menggunakan Chart.js
 * @param {number} nHari - Jumlah hari riwayat yang ingin ditampilkan
 */
function renderEggChart(nHari) {
    const canvas = document.getElementById('eggProductionChart');
    if (!canvas) return;
    if (eggChartInstance) eggChartInstance.destroy();

    // Group by date
    const grouped = {};
    state.produksi.forEach(p => {
        if (!grouped[p.tanggal]) grouped[p.tanggal] = { total: 0, baik: 0, cacat: 0 };
        grouped[p.tanggal].total += p.totalTelur;
        grouped[p.tanggal].baik += p.telurBaik;
        grouped[p.tanggal].cacat += p.telurCacat;
    });

    const dates = Object.keys(grouped).sort().slice(-nHari);
    const labels = dates.map(d => {
        const date = new Date(d);
        return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    });
    const totalData = dates.map(d => grouped[d].total);
    const baikData = dates.map(d => grouped[d].baik);
    const cacatData = dates.map(d => grouped[d].cacat);

    // Update mini-stats chart
    const sumTotal = totalData.reduce((s, v) => s + v, 0);
    document.getElementById('chart-stat-total').textContent = sumTotal.toLocaleString('id-ID');
    document.getElementById('chart-stat-baik').textContent = baikData.reduce((s,v)=>s+v, 0).toLocaleString('id-ID');
    document.getElementById('chart-stat-cacat').textContent = cacatData.reduce((s,v)=>s+v, 0).toLocaleString('id-ID');
    document.getElementById('chart-stat-rata').textContent = Math.round(sumTotal / (totalData.length || 1)).toLocaleString('id-ID');
    
    document.getElementById('chartEmptyOverlay').style.display = totalData.length ? 'none' : 'flex';

    eggChartInstance = new Chart(canvas, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Total Telur',
                data: totalData,
                borderColor: '#fb8500',
                backgroundColor: 'rgba(251, 133, 0, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: { responsive: true, plugins: { legend: { display: false } } }
    });
}

/**
 * Merender Grafik Perbandingan Keuangan (Mingguan)
 */
function renderFinanceChart() {
    const canvas = document.getElementById('financeChart');
    if (!canvas) return;
    if (financeChartInstance) financeChartInstance.destroy();

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    // Gunakan logika bulan yang sama dengan widget summary
    const hasDataBulanIni = state.keuangan.some(trx => {
        const d = new Date(trx.tanggal);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    let targetMonth = currentMonth;
    let targetYear = currentYear;

    if (!hasDataBulanIni && state.keuangan.length > 0) {
        const sorted = [...state.keuangan].sort((a,b) => new Date(b.tanggal) - new Date(a.tanggal));
        const latest = new Date(sorted[0].tanggal);
        targetMonth = latest.getMonth();
        targetYear = latest.getFullYear();
    }

    const incomeByWeek = [0, 0, 0, 0];
    const expenseByWeek = [0, 0, 0, 0];

    state.keuangan.forEach(trx => {
        const d = new Date(trx.tanggal);
        if (d.getMonth() === targetMonth && d.getFullYear() === targetYear) {
            const week = Math.min(3, Math.floor((d.getDate() - 1) / 7));
            if (trx.tipe === 'pemasukan') incomeByWeek[week] += trx.jumlah;
            else expenseByWeek[week] += trx.jumlah;
        }
    });

    financeChartInstance = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: ['Minggu 1', 'Minggu 2', 'Minggu 3', 'Minggu 4+'],
            datasets: [
                { label: 'Pemasukan', data: incomeByWeek, backgroundColor: '#10b981' },
                { label: 'Pengeluaran', data: expenseByWeek, backgroundColor: '#ef4444' }
            ]
        },
        options: { responsive: true }
    });
}


// =========================================================
// 8. STOCK PAKAN ALERTS
// =========================================================

/**
 * Update simple feed stock alert in stat card
 */
function checkFeedStockAlerts() {
    let pakanMasuk = 0, pakanKeluar = 0;
    state.pakan.forEach(p => {
        if (p.tipe === 'Masuk') pakanMasuk += p.jumlah;
        else pakanKeluar += p.jumlah;
    });
    
    const sisaPakan = pakanMasuk - pakanKeluar;
    
    // Update simple feed alert
    updateSimpleFeedAlert(sisaPakan);
}

/**
 * Update simple feed stock alert - minimal approach
 */
function updateSimpleFeedAlert(sisaPakan) {
    const alertEl = document.getElementById('stat-pakan-alert');
    
    if (!alertEl) return;
    
    // Show simple alert if stock is low (using dynamic limits)
    const { kritis, rendah } = state.alertLimits;

    if (sisaPakan <= rendah) {
        alertEl.style.display = 'block';
        
        if (sisaPakan <= kritis) {
            alertEl.textContent = '🚨 Stok kritis, beli sekarang!';
            alertEl.style.color = '#dc2626';
        } else {
            alertEl.textContent = '⚠️ Stok rendah, segera restock';
            alertEl.style.color = '#f59e0b';
        }
    } else {
        alertEl.style.display = 'none';
    }
}

// =========================================================
// 9. QUICK ACTIONS FUNCTIONALITY
// =========================================================

/**
 * Quick Action: Input Produksi
 */
window.quickActionInputProduksi = function() {
    window.location.href = 'inputproduksi.html';
};

/**
 * Quick Action: Kelola Stok Pakan
 */
window.quickActionStokPakan = function() {
    window.location.href = 'stokpakan.html';
};

/**
 * Quick Action: Catat Transaksi Keuangan
 */
window.quickActionKeuangan = function() {
    window.location.href = 'keuangan.html';
};

/**
 * Quick Action: Cek Kesehatan Ayam
 */
window.quickActionKesehatan = function() {
    window.location.href = 'kesehatanayam.html';
};

// =========================================================
// 10. ✅ FASE 3: VACCINATION SCHEDULE WIDGET
// =========================================================

/**
 * Render vaccination schedule widget
 */
function renderVaccinationWidget() {
    const contentEl = document.getElementById('vaccination-content');
    const emptyEl = document.getElementById('vaccination-empty');
    const subtitleEl = document.getElementById('vaccination-subtitle');
    
    if (!contentEl) return;
    
    // Get upcoming vaccinations (status: Terjadwal)
    const upcomingVaccinations = state.vaksinasi ? 
        state.vaksinasi.filter(v => v.status === 'Terjadwal')
                       .sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal))
                       .slice(0, 3) : [];
    
    if (upcomingVaccinations.length === 0) {
        contentEl.style.display = 'none';
        emptyEl.style.display = 'block';
        subtitleEl.textContent = 'Semua jadwal vaksin sudah selesai';
    } else {
        contentEl.style.display = 'grid';
        emptyEl.style.display = 'none';
        subtitleEl.textContent = `${upcomingVaccinations.length} jadwal mendatang`;
        
        contentEl.style.gridTemplateColumns = 'repeat(3, 1fr)';
        contentEl.style.gap = '1rem';
        
        contentEl.innerHTML = upcomingVaccinations.map(vaksin => {
            const tanggal = new Date(vaksin.tanggal);
            const today = new Date();
            const diffDays = Math.ceil((tanggal - today) / (1000 * 60 * 60 * 24));

            let urgencyColor = 'rgba(255,255,255,0.25)';
            let urgencyText = `${diffDays} hari lagi`;
            let urgencyTextColor = 'white';

            if (diffDays <= 0) {
                urgencyColor = '#ef4444';
                urgencyText = 'HARI INI!';
            } else if (diffDays <= 3) {
                urgencyColor = '#f59e0b';
                urgencyText = `${diffDays} hari lagi`;
            }

            // Pisahkan nomor batch dan nama kandang: "B-20260501-237 (Kandang B (Timur))" 
            const batchRaw = vaksin.batchName || vaksin.batchId || 'Batch';
            const batchMatch = batchRaw.match(/^(B-[\d]+-[\d]+)\s*(\(.*\))?$/);
            const batchNum  = batchMatch ? batchMatch[1] : batchRaw;
            const batchKandang = batchMatch && batchMatch[2] ? batchMatch[2] : '';

            return `
                <div style="
                    background: rgba(255,255,255,0.15);
                    border-radius: 12px;
                    padding: 1rem 1.1rem;
                    backdrop-filter: blur(10px);
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                    min-width: 0;
                ">
                    <!-- Baris 1: Jenis vaksin + badge urgensi -->
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; flex-wrap: nowrap;">
                        <span style="font-size: 0.78rem; opacity: 0.9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; min-width: 0;">
                            💉 ${vaksin.jenis || 'Vaksin'}
                        </span>
                        <span style="
                            background: ${urgencyColor};
                            color: ${urgencyTextColor};
                            padding: 2px 8px;
                            border-radius: 12px;
                            font-size: 0.68rem;
                            font-weight: 700;
                            white-space: nowrap;
                            flex-shrink: 0;
                        ">${urgencyText}</span>
                    </div>

                    <!-- Baris 2: Nomor batch -->
                    <p style="margin: 0; font-size: 1rem; font-weight: 700; letter-spacing: 0.3px; line-height: 1.2;">
                        ${batchNum}
                    </p>

                    <!-- Baris 3: Nama kandang (jika ada) -->
                    ${batchKandang ? `<p style="margin: 0; font-size: 0.75rem; opacity: 0.75; line-height: 1.2;">${batchKandang}</p>` : ''}

                    <!-- Baris 4: Tanggal -->
                    <p style="margin: 0; font-size: 0.75rem; opacity: 0.8;">
                        📅 ${tanggal.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                </div>
            `;
        }).join('');
    }
}

/**
 * Open vaccination detail page
 */
window.openVaccinationDetail = function() {
    // For now, redirect to kesehatan ayam page
    // In the future, this could open a dedicated vaccination management page
    window.location.href = 'kesehatanayam.html';
};

// =========================================================
// 11.  WIDGET PREDIKSI TERAKHIR
// =========================================================
/**
 * Merender widget prediksi terakhir di dashboard
 */
function renderPrediksiWidget() {
    const prediksiContent = document.getElementById('prediction-content');
    const prediksiEmpty = document.getElementById('prediction-empty');
    const prediksiDate = document.getElementById('prediction-date');
    const prediksiEggs = document.getElementById('prediction-eggs');
    const prediksiIncome = document.getElementById('prediction-income');
    const prediksiAccuracy = document.getElementById('prediction-accuracy');

    if (!prediksiContent) return;

    if (state.prediksi.length === 0) {
        // Tidak ada prediksi
        prediksiContent.style.display = 'none';
        prediksiEmpty.style.display = 'block';
    } else {
        // Ada prediksi
        const latest = state.prediksi[0];
        prediksiContent.style.display = 'grid';
        prediksiEmpty.style.display = 'none';

        // Format tanggal (field: tanggal, bukan createdAt)
        let dateStr = '-';
        if (latest.tanggal) {
            const dateObj = new Date(latest.tanggal);
            dateStr = dateObj.toLocaleDateString('id-ID', { 
                day: 'numeric', 
                month: 'long', 
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
        prediksiDate.textContent = `Dibuat: ${dateStr}`;

        // Tampilkan data prediksi (field: prediksiBesokButir, estimasiPendapatan)
        prediksiEggs.textContent = `${(latest.prediksiBesokButir || 0).toLocaleString('id-ID')} Butir`;
        prediksiIncome.textContent = `Rp ${(latest.estimasiPendapatan || 0).toLocaleString('id-ID')}`;
        
        // Hitung akurasi berdasarkan keuntungan (jika untung = tinggi, rugi = rendah)
        let akurasi = 0;
        if (latest.keuntungan && latest.estimasiPendapatan) {
            const rasio = (latest.keuntungan / latest.estimasiPendapatan) * 100;
            akurasi = Math.max(0, Math.min(100, 50 + rasio)); // Scale 0-100
        }
        prediksiAccuracy.textContent = `${Math.round(akurasi)}%`;
    }
}


// =========================================================
// 12.  WIDGET RINGKASAN KEUANGAN BULAN INI
// =========================================================
/**
 * Merender widget ringkasan keuangan bulan ini
 */
function renderFinanceSummaryWidget() {
    const financeMonth = document.getElementById('finance-month');
    const financeIncome = document.getElementById('finance-income');
    const financeExpense = document.getElementById('finance-expense');
    const financeBalance = document.getElementById('finance-balance');
    const financeTransactions = document.getElementById('finance-transactions');

    if (!financeMonth) return;

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    
    // Cek apakah ada data di bulan ini
    const dataBulanIni = state.keuangan.filter(trx => {
        const d = new Date(trx.tanggal);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    // Fallback: Jika bulan ini kosong, cari bulan terbaru yang punya data
    let targetMonth = currentMonth;
    let targetYear = currentYear;
    let finalData = dataBulanIni;

    if (dataBulanIni.length === 0 && state.keuangan.length > 0) {
        const sorted = [...state.keuangan].sort((a,b) => new Date(b.tanggal) - new Date(a.tanggal));
        const latest = new Date(sorted[0].tanggal);
        targetMonth = latest.getMonth();
        targetYear = latest.getFullYear();
        finalData = state.keuangan.filter(trx => {
            const d = new Date(trx.tanggal);
            return d.getMonth() === targetMonth && d.getFullYear() === targetYear;
        });
    }
    
    financeMonth.textContent = `${monthNames[targetMonth]} ${targetYear}${targetMonth !== currentMonth ? ' (Terakhir)' : ''}`;

    let income = 0, expense = 0, trxCount = 0;

    finalData.forEach(trx => {
        trxCount++;
        if (trx.tipe === 'pemasukan') {
            income += trx.jumlah;
        } else {
            expense += trx.jumlah;
        }
    });

    const balance = income - expense;

    financeIncome.textContent = `Rp ${income.toLocaleString('id-ID')}`;
    financeExpense.textContent = `Rp ${expense.toLocaleString('id-ID')}`;
    financeBalance.textContent = `Rp ${balance.toLocaleString('id-ID')}`;
    financeBalance.style.color = balance >= 0 ? '#fff' : '#fca5a5';
    financeTransactions.textContent = `${trxCount} Transaksi`;
}


// =========================================
// 13. MODULE: ACTIVITIES
// =========================================
/**
 * Merender daftar aktivitas harian dalam bentuk list item interaktif
 * dengan progress bar visual (FASE 3)
 */
function renderActivities() {
    const list = document.getElementById("dailyActivityList");
    if (!list) return;
    list.innerHTML = "";

    const total = state.activities.length;
    const done  = state.activities.filter(a => a.completed).length;

    // ── Update progress bar ──────────────────────────────────────
    const progressBar  = document.getElementById("activity-progress-bar");
    const progressText = document.getElementById("activity-progress-text");
    if (progressBar && progressText) {
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        progressBar.style.width = `${pct}%`;
        progressText.textContent = `${done} / ${total} selesai`;
        if (pct === 100 && total > 0) {
            progressText.style.color = "#10b981";
            progressBar.style.background = "linear-gradient(90deg, #10b981, #34d399)";
        } else if (pct >= 50) {
            progressText.style.color = "#f59e0b";
            progressBar.style.background = "linear-gradient(90deg, #f59e0b, #fbbf24)";
        } else {
            progressText.style.color = "#64748b";
            progressBar.style.background = "linear-gradient(90deg, #94a3b8, #cbd5e1)";
        }
    }

    // ── Kosong ───────────────────────────────────────────────────
    if (total === 0) {
        list.innerHTML = `
            <li style="text-align:center; color:#94a3b8; font-size:0.85rem;
                        padding:1.5rem; background:transparent; border:none; list-style:none;">
                📋 Belum ada aktivitas hari ini.<br>
                <small>Tambahkan aktivitas di bawah.</small>
            </li>`;
        return;
    }

    // ── Urutkan: belum selesai dulu ──────────────────────────────
    const sorted = [...state.activities].sort((a, b) => {
        if (a.completed === b.completed) return 0;
        return a.completed ? 1 : -1;
    });

    sorted.forEach((item) => {
        const li = document.createElement("li");
        li.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 10px;
            background: ${item.completed ? '#f8fafc' : '#fff'};
            border-left: 3px solid ${item.completed ? '#10b981' : '#e2e8f0'};
            border-radius: 8px;
            padding: 10px 12px;
            margin-bottom: 6px;
            opacity: ${item.completed ? '0.75' : '1'};
            transition: all 0.25s ease;
        `;

        // Format waktu ditambahkan
        const waktuLabel = item.createdAt
            ? new Date(item.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
            : '';

        li.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px; flex:1; min-width:0;">
                <button
                    class="activity-check-circle ${item.completed ? 'done' : ''}"
                    title="${item.completed ? 'Batalkan' : 'Tandai selesai'}"
                    onclick="toggleActivityStatus('${item.id}', ${item.completed})"
                    style="
                        width: 26px; height: 26px; flex-shrink: 0;
                        border-radius: 50%; border: 2px solid ${item.completed ? '#10b981' : '#cbd5e1'};
                        background: ${item.completed ? '#10b981' : 'transparent'};
                        color: white; font-size: 0.75rem; cursor: pointer;
                        display: flex; align-items: center; justify-content: center;
                        transition: all 0.2s ease;
                    "
                >${item.completed ? '✓' : ''}</button>
                <div style="flex:1; min-width:0;">
                    <span style="
                        display: block;
                        font-size: 0.88rem;
                        ${item.completed ? 'text-decoration:line-through; color:#94a3b8;' : 'color:#1e293b; font-weight:500;'}
                        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
                    ">${item.text}</span>
                    ${waktuLabel ? `<span style="font-size:0.7rem; color:#cbd5e1;">${item.completed ? '✅ Selesai' : '🕐 ' + waktuLabel}</span>` : ''}
                </div>
            </div>
            <button
                class="action-btn delete-item-btn"
                title="Hapus aktivitas"
                onclick="deleteActivityItem('${item.id}')"
                style="flex-shrink:0; opacity:0.4; transition:opacity 0.2s;"
                onmouseover="this.style.opacity='1'"
                onmouseout="this.style.opacity='0.4'"
            >✕</button>
        `;
        list.appendChild(li);
    });
}

const activityForm = document.getElementById("addActivityForm");
if (activityForm) {
    activityForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const input = document.getElementById("activityInput");
        if (!input.value.trim()) return;
        try {
            await addDoc(collection(db, "daily_activities"), {
                text: input.value.trim(),
                completed: false,
                createdAt: new Date().toISOString()
            });
            input.value = "";
        } catch (err) { console.error(err); }
    });
}

window.toggleActivityStatus = async function(id, currentStatus) {
    await updateDoc(doc(db, "daily_activities", id), { completed: !currentStatus });
};

window.deleteActivityItem = async function(id) {
    await deleteDoc(doc(db, "daily_activities", id));
};

// =========================================
// 14. MODULE: ANNOUNCEMENTS
// =========================================

/**
 * Terapkan UI berdasarkan role: admin bisa input, petugas hanya lihat & konfirmasi
 */
function applyAnnouncementRoleUI() {
    const form = document.getElementById('addAnnouncementForm');
    const note = document.getElementById('announcementPetugasNote');
    if (currentUserRole === 'admin') {
        if (form) form.style.display = 'flex';
        if (note) note.style.display = 'none';
    } else {
        if (form) form.style.display = 'none';
        if (note) note.style.display = 'block';
    }
}

/**
 * Render daftar pengumuman dengan logika berbeda per role:
 * - Admin: lihat semua + status konfirmasi + hapus
 * - Petugas: lihat semua + tombol konfirmasi (jika belum konfirmasi)
 */
function renderAnnouncements() {
    const list = document.getElementById("announcementList");
    if (!list) return;
    list.innerHTML = "";

    // Hitung yang belum dikonfirmasi oleh user ini
    let belumKonfirmasi = 0;

    if (state.announcements.length === 0) {
        list.innerHTML = `<li style="text-align:center; color:#94a3b8; font-size:0.85rem; padding:1.5rem; background:transparent; border:none; list-style:none;">
            📢 Belum ada pengumuman.
        </li>`;
        updateUnreadBadge(0);
        return;
    }

    state.announcements.forEach((item) => {
        const li = document.createElement("li");
        li.className = "announcement-item";

        const confirmedBy = item.confirmedBy || [];
        const sudahKonfirmasi = confirmedBy.includes(currentUserName);
        const jumlahKonfirmasi = confirmedBy.length;

        if (currentUserRole === 'admin') {
            // ===== TAMPILAN ADMIN =====
            const konfirmasiInfo = jumlahKonfirmasi > 0
                ? `<div class="konfirmasi-list">
                    <span class="konfirmasi-label">✅ Dikonfirmasi oleh:</span>
                    ${confirmedBy.map(n => `<span class="konfirmasi-badge">${n}</span>`).join('')}
                   </div>`
                : `<div class="konfirmasi-list">
                    <span class="konfirmasi-label belum">⏳ Belum ada yang mengonfirmasi</span>
                   </div>`;

            li.innerHTML = `
                <div class="announcement-content" style="flex:1;">
                    <span class="text">${item.text}</span>
                    <div class="announcement-meta">
                        <span class="announcement-time">${formatWaktuPengumuman(item.createdAt)}</span>
                        <span class="konfirmasi-count-badge ${jumlahKonfirmasi > 0 ? 'confirmed' : 'pending'}">
                            ${jumlahKonfirmasi > 0 ? `✅ ${jumlahKonfirmasi} konfirmasi` : '⏳ Menunggu'}
                        </span>
                    </div>
                    ${konfirmasiInfo}
                </div>
                <div class="action-btn-group">
                    <button class="action-btn delete-item-btn" title="Hapus pengumuman" onclick="deleteAnnouncementItem('${item.id}')">✕</button>
                </div>
            `;
        } else {
            // ===== TAMPILAN PETUGAS =====
            if (!sudahKonfirmasi) belumKonfirmasi++;

            li.style.cssText = `
                background: ${sudahKonfirmasi ? '#f0fdf4' : '#fff'};
                border-left: 4px solid ${sudahKonfirmasi ? '#10b981' : '#ff5e62'};
                border-radius: 10px;
                padding: 12px 14px;
                margin-bottom: 0.8rem;
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 12px;
            `;

            // Konten kiri
            const contentDiv = document.createElement('div');
            contentDiv.className = 'announcement-content';
            contentDiv.style.cssText = 'flex:1; min-width:0;';
            contentDiv.innerHTML = `
                <span class="text" style="
                    display: block;
                    font-size: 0.88rem;
                    font-weight: 600;
                    color: ${sudahKonfirmasi ? '#15803d' : '#1e293b'};
                    margin-bottom: 6px;
                    line-height: 1.4;
                ">${item.text}</span>
                <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                    <span style="font-size:0.7rem; color:#94a3b8;">${formatWaktuPengumuman(item.createdAt)}</span>
                    <span style="
                        background: ${sudahKonfirmasi ? '#dcfce7' : '#fef3c7'};
                        color: ${sudahKonfirmasi ? '#15803d' : '#92400e'};
                        padding: 2px 8px; border-radius: 20px;
                        font-size: 0.68rem; font-weight: 700;
                    ">${sudahKonfirmasi ? '✅ Sudah dikonfirmasi' : '⏳ Belum dikonfirmasi'}</span>
                </div>
            `;

            // Tombol konfirmasi kanan
            const confirmBtn = document.createElement('button');
            confirmBtn.style.cssText = `
                flex-shrink: 0;
                padding: 7px 14px;
                border-radius: 8px;
                border: none;
                font-size: 0.78rem;
                font-weight: 700;
                cursor: ${sudahKonfirmasi ? 'default' : 'pointer'};
                background: ${sudahKonfirmasi ? '#dcfce7' : '#10b981'};
                color: ${sudahKonfirmasi ? '#15803d' : '#fff'};
                white-space: nowrap;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                gap: 4px;
            `;
            confirmBtn.innerHTML = sudahKonfirmasi ? '✓ Sudah' : '✓ Konfirmasi';
            confirmBtn.title = sudahKonfirmasi ? 'Sudah dikonfirmasi' : 'Konfirmasi pengumuman ini';
            confirmBtn.disabled = sudahKonfirmasi;

            if (!sudahKonfirmasi) {
                confirmBtn.onmouseover = () => confirmBtn.style.background = '#059669';
                confirmBtn.onmouseout  = () => confirmBtn.style.background = '#10b981';
                confirmBtn.onclick = () => konfirmasiPengumuman(item.id);
            }

            li.appendChild(contentDiv);
            li.appendChild(confirmBtn);
        }

        list.appendChild(li);
    });

    updateUnreadBadge(belumKonfirmasi);
}

/** Update badge jumlah pengumuman belum dikonfirmasi */
function updateUnreadBadge(count) {
    const badge = document.getElementById('announcementUnreadBadge');
    const countEl = document.getElementById('announcementUnreadCount');
    if (!badge || !countEl) return;
    if (currentUserRole === 'petugas' && count > 0) {
        badge.style.display = 'block';
        countEl.textContent = count;
    } else {
        badge.style.display = 'none';
    }
}

/** Format waktu pengumuman */
function formatWaktuPengumuman(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * Petugas mengonfirmasi pengumuman — nama petugas ditambahkan ke array confirmedBy
 */
window.konfirmasiPengumuman = async function(id) {
    if (!currentUserName || currentUserName === "Pengguna") {
        Swal.fire('Tunggu', 'Data pengguna belum dimuat. Coba lagi sebentar.', 'info');
        return;
    }
    try {
        await updateDoc(doc(db, "announcements", id), {
            confirmedBy: arrayUnion(currentUserName)
        });
        Swal.fire({
            icon: 'success',
            title: 'Dikonfirmasi!',
            text: `Pengumuman telah dikonfirmasi atas nama "${currentUserName}".`,
            timer: 1800,
            showConfirmButton: false
        });
    } catch (err) {
        Swal.fire("Error", "Gagal mengonfirmasi: " + err.message, "error");
    }
};

// Form input pengumuman — hanya admin yang bisa submit (form disembunyikan untuk petugas)
const announcementForm = document.getElementById("addAnnouncementForm");
if (announcementForm) {
    announcementForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (currentUserRole !== 'admin') return; // Guard tambahan
        const input = document.getElementById("announcementInput");
        if (!input.value.trim()) return;
        try {
            await addDoc(collection(db, "announcements"), {
                text: input.value.trim(),
                confirmedBy: [],          // Array nama petugas yang sudah konfirmasi
                createdByAdmin: currentUserName,
                createdAt: new Date().toISOString()
            });
            input.value = "";
        } catch (err) { console.error(err); }
    });
}

window.deleteAnnouncementItem = async function(id) {
    if (currentUserRole !== 'admin') return;
    const res = await Swal.fire({
        title: 'Hapus Pengumuman?',
        text: 'Pengumuman ini akan dihapus permanen.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonText: 'Batal'
    });
    if (res.isConfirmed) {
        await deleteDoc(doc(db, "announcements", id));
    }
};

// =========================================
// 15. MODULE: SCHEDULE
// =========================================
/**
 * Merender daftar jadwal ke dalam tabel HTML
 */
function renderSchedule() {
    const tbody = document.querySelector("#scheduleTable tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    state.schedules.forEach((item) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${item.tanggal}</td>
            <td>${item.waktu}</td>
            <td>${item.agenda}</td>
            <td>${item.ruangan}</td>
            <td>
                <button class="delete-btn" onclick="deleteScheduleItem('${item.id}')">🗑</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

const scheduleForm = document.getElementById("addScheduleForm");
if (scheduleForm) {
    scheduleForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const payload = {
            tanggal: document.getElementById("tanggal").value,
            waktu: document.getElementById("waktu").value,
            agenda: document.getElementById("agenda").value,
            ruangan: document.getElementById("ruangan").value,
            createdAt: new Date().toISOString()
        };
        try {
            await addDoc(collection(db, "schedules"), payload);
            scheduleForm.reset();
            Swal.fire("Berhasil", "Jadwal ditambahkan!", "success");
        } catch (err) { Swal.fire("Error", err.message, "error"); }
    });
}

window.deleteScheduleItem = async function(id) {
    const result = await Swal.fire({ title: "Hapus?", showCancelButton: true });
    if (result.isConfirmed) {
        await deleteDoc(doc(db, "schedules", id));
    }
};

// =========================================================
// 16.  MODAL DETAIL PREDIKSI
// =========================================================
/**
 * Membuka modal detail prediksi
 */
window.openModalPrediksi = function() {
    const modal = document.getElementById('modalPrediksiDetail');
    const content = document.getElementById('prediksiDetailContent');
    
    if (!modal || !content) return;
    
    if (state.prediksi.length === 0) {
        content.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: #7f8c8d;">
                <span style="font-size: 4rem;">📭</span>
                <h3 style="margin-top: 1rem;">Belum Ada Prediksi</h3>
                <p>Silakan buat prediksi terlebih dahulu di halaman Prediksi Hasil.</p>
                <a href="prediksihasil.html" style="display: inline-block; margin-top: 1rem; background: #667eea; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                    Buat Prediksi →
                </a>
            </div>
        `;
    } else {
        const data = state.prediksi[0];
        
        // Format tanggal
        let dateStr = '-';
        if (data.tanggal) {
            const dateObj = new Date(data.tanggal);
            dateStr = dateObj.toLocaleDateString('id-ID', { 
                day: 'numeric', 
                month: 'long', 
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
        
        // Hitung akurasi
        let akurasi = 0;
        if (data.keuntungan && data.estimasiPendapatan) {
            const rasio = (data.keuntungan / data.estimasiPendapatan) * 100;
            akurasi = Math.max(0, Math.min(100, 50 + rasio));
        }
        
        content.innerHTML = `
            <div style="margin-bottom: 1.5rem; padding: 1rem; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #667eea;">
                <p style="margin: 0; color: #7f8c8d; font-size: 0.9rem;">📅 Tanggal Prediksi</p>
                <p style="margin: 5px 0 0 0; font-weight: 700; color: #2c3e50;">${dateStr}</p>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
                <div style="padding: 1rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 10px; color: white;">
                    <p style="margin: 0; font-size: 0.85rem; opacity: 0.9;">🥚 Prediksi Telur</p>
                    <p style="margin: 5px 0 0 0; font-size: 1.8rem; font-weight: 700;">${(data.prediksiBesokButir || 0).toLocaleString('id-ID')}</p>
                    <p style="margin: 5px 0 0 0; font-size: 0.75rem; opacity: 0.8;">Jumlah telur yang diprediksi besok</p>
                </div>
                <div style="padding: 1rem; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 10px; color: white;">
                    <p style="margin: 0; font-size: 0.85rem; opacity: 0.9;">💰 Prediksi Pendapatan</p>
                    <p style="margin: 5px 0 0 0; font-size: 1.8rem; font-weight: 700;">Rp ${(data.estimasiPendapatan || 0).toLocaleString('id-ID')}</p>
                    <p style="margin: 5px 0 0 0; font-size: 0.75rem; opacity: 0.8;">Estimasi dari penjualan telur besok</p>
                </div>
                <div style="padding: 1rem; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 10px; color: white;">
                    <p style="margin: 0; font-size: 0.85rem; opacity: 0.9;">📊 Akurasi Model</p>
                    <p style="margin: 5px 0 0 0; font-size: 1.8rem; font-weight: 700;">${Math.round(akurasi)}%</p>
                    <p style="margin: 5px 0 0 0; font-size: 0.75rem; opacity: 0.8;">Tingkat kepercayaan prediksi</p>
                </div>
            </div>
            
            <h3 style="margin: 1.5rem 0 1rem 0; color: #2c3e50; border-bottom: 2px solid #e9ecef; padding-bottom: 0.5rem;">📈 Proyeksi 7 Hari Ke Depan</h3>
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #f8f9fa;">
                            <th style="padding: 12px; text-align: left; border-bottom: 2px solid #dee2e6;">Hari</th>
                            <th style="padding: 12px; text-align: right; border-bottom: 2px solid #dee2e6;">Produksi (Kg)</th>
                            <th style="padding: 12px; text-align: right; border-bottom: 2px solid #dee2e6;">Keuntungan</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(data.proyeksi7HariKg || []).map((kg, i) => {
                            const profit = (data.proyeksi7HariKeuntungan || [])[i] || 0;
                            const profitColor = profit >= 0 ? '#10b981' : '#ef4444';
                            return `
                                <tr style="border-bottom: 1px solid #f1f3f5;">
                                    <td style="padding: 12px; font-weight: 600;">H+${i + 1}</td>
                                    <td style="padding: 12px; text-align: right; color: #667eea; font-weight: 600;">${kg.toFixed(2)} Kg</td>
                                    <td style="padding: 12px; text-align: right; color: ${profitColor}; font-weight: 700;">Rp ${Math.round(profit).toLocaleString('id-ID')}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
            
            <div style="margin-top: 1.5rem; padding: 1rem; background: #f8f9fa; border-radius: 8px;">
                <h4 style="margin: 0 0 0.5rem 0; color: #2c3e50;">ℹ️ Informasi Tambahan</h4>
                <div style="display: grid; gap: 0.5rem; font-size: 0.9rem; color: #495057;">
                    <div><strong>Periode MA:</strong> ${data.periodeMA || '-'} Hari</div>
                    <div><strong>Populasi:</strong> ${(data.populasi || 0).toLocaleString('id-ID')} Ekor</div>
                    <div><strong>Batch:</strong> ${data.batchLabel || '-'}</div>
                    <div><strong>Biaya Pakan:</strong> Rp ${(data.biayaPakan || 0).toLocaleString('id-ID')}</div>
                    <div><strong>Keuntungan Bersih:</strong> <span style="color: ${data.keuntungan >= 0 ? '#10b981' : '#ef4444'}; font-weight: 700;">Rp ${(data.keuntungan || 0).toLocaleString('id-ID')}</span></div>
                </div>
            </div>
            
            ${data.rekomendasi && data.rekomendasi.length > 0 ? `
                <h3 style="margin: 1.5rem 0 1rem 0; color: #2c3e50; border-bottom: 2px solid #e9ecef; padding-bottom: 0.5rem;">💡 Rekomendasi Prediktif</h3>
                <div style="display: grid; gap: 1rem;">
                    ${data.rekomendasi.map(rek => {
                        let bgColor = '#f8f9fa';
                        let borderColor = '#dee2e6';
                        let iconBg = '#6c757d';
                        
                        if (rek.level === 'success') {
                            bgColor = '#d1fae5';
                            borderColor = '#10b981';
                            iconBg = '#10b981';
                        } else if (rek.level === 'warning') {
                            bgColor = '#fef3c7';
                            borderColor = '#f59e0b';
                            iconBg = '#f59e0b';
                        } else if (rek.level === 'danger') {
                            bgColor = '#fee2e2';
                            borderColor = '#ef4444';
                            iconBg = '#ef4444';
                        }
                        
                        return `
                            <div style="background: ${bgColor}; border-left: 4px solid ${borderColor}; border-radius: 8px; padding: 1rem;">
                                <div style="display: flex; align-items: start; gap: 1rem;">
                                    <div style="background: ${iconBg}; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; flex-shrink: 0;">
                                        ${rek.icon || '💡'}
                                    </div>
                                    <div style="flex: 1;">
                                        <h4 style="margin: 0 0 0.5rem 0; color: #2c3e50; font-size: 1rem;">${rek.title || 'Rekomendasi'}</h4>
                                        <p style="margin: 0 0 0.75rem 0; color: #495057; font-size: 0.9rem; line-height: 1.5;">${rek.description || ''}</p>
                                        ${rek.actions && rek.actions.length > 0 ? `
                                            <div style="margin-top: 0.75rem; padding-left: 1rem; border-left: 2px solid ${borderColor};">
                                                <p style="margin: 0 0 0.5rem 0; font-weight: 600; font-size: 0.85rem; color: #2c3e50;">Langkah yang Disarankan:</p>
                                                <ul style="margin: 0; padding-left: 1.25rem; color: #495057; font-size: 0.85rem;">
                                                    ${rek.actions.map(action => `<li style="margin-bottom: 0.25rem;">${action}</li>`).join('')}
                                                </ul>
                                            </div>
                                        ` : ''}
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            ` : ''}
            
            <div style="margin-top: 1.5rem; text-align: center;">
                <a href="prediksihasil.html" style="display: inline-block; background: #667eea; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                    Buat Prediksi Baru →
                </a>
            </div>
        `;
    }
    
    modal.style.display = 'flex';
};

/**
 * Menutup modal detail prediksi
 */
window.closeModalPrediksi = function() {
    const modal = document.getElementById('modalPrediksiDetail');
    if (modal) modal.style.display = 'none';
};

// =========================================================
// 17.  MODAL DETAIL KEUANGAN
// =========================================================
/**
 * Membuka modal detail keuangan
 */
window.openModalKeuangan = function() {
    const modal = document.getElementById('modalKeuanganDetail');
    const content = document.getElementById('keuanganDetailContent');
    
    if (!modal || !content) return;
    
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    
    // Filter transaksi bulan ini
    const trxBulanIni = state.keuangan.filter(trx => {
        const d = new Date(trx.tanggal);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    
    // Hitung statistik
    let income = 0, expense = 0;
    const trxPemasukan = [];
    const trxPengeluaran = [];
    
    trxBulanIni.forEach(trx => {
        if (trx.tipe === 'pemasukan') {
            income += trx.jumlah;
            trxPemasukan.push(trx);
        } else {
            expense += trx.jumlah;
            trxPengeluaran.push(trx);
        }
    });
    
    const balance = income - expense;
    const balanceColor = balance >= 0 ? '#10b981' : '#ef4444';
    
    // Sort by date descending
    trxPemasukan.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
    trxPengeluaran.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
    
    content.innerHTML = `
        <div style="margin-bottom: 1.5rem; padding: 1rem; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #10b981;">
            <p style="margin: 0; color: #7f8c8d; font-size: 0.9rem;">📅 Periode</p>
            <p style="margin: 5px 0 0 0; font-weight: 700; color: #2c3e50;">${monthNames[currentMonth]} ${currentYear}</p>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
            <div style="padding: 1rem; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 10px; color: white;">
                <p style="margin: 0; font-size: 0.85rem; opacity: 0.9;">💵 Total Pemasukan</p>
                <p style="margin: 5px 0 0 0; font-size: 1.8rem; font-weight: 700;">Rp ${income.toLocaleString('id-ID')}</p>
                <p style="margin: 5px 0 0 0; font-size: 0.85rem; opacity: 0.9;">${trxPemasukan.length} Transaksi</p>
            </div>
            <div style="padding: 1rem; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); border-radius: 10px; color: white;">
                <p style="margin: 0; font-size: 0.85rem; opacity: 0.9;">💸 Total Pengeluaran</p>
                <p style="margin: 5px 0 0 0; font-size: 1.8rem; font-weight: 700;">Rp ${expense.toLocaleString('id-ID')}</p>
                <p style="margin: 5px 0 0 0; font-size: 0.85rem; opacity: 0.9;">${trxPengeluaran.length} Transaksi</p>
            </div>
            <div style="padding: 1rem; background: linear-gradient(135deg, ${balance >= 0 ? '#10b981, #059669' : '#ef4444, #dc2626'}); border-radius: 10px; color: white;">
                <p style="margin: 0; font-size: 0.85rem; opacity: 0.9;">💎 Saldo Bersih</p>
                <p style="margin: 5px 0 0 0; font-size: 1.8rem; font-weight: 700;">Rp ${balance.toLocaleString('id-ID')}</p>
                <p style="margin: 5px 0 0 0; font-size: 0.85rem; opacity: 0.9;">${balance >= 0 ? 'Surplus' : 'Defisit'}</p>
            </div>
        </div>
        
        <h3 style="margin: 1.5rem 0 1rem 0; color: #2c3e50; border-bottom: 2px solid #e9ecef; padding-bottom: 0.5rem;">💵 Riwayat Pemasukan (${trxPemasukan.length})</h3>
        ${trxPemasukan.length === 0 ? 
            '<p style="text-align: center; color: #7f8c8d; padding: 2rem;">Belum ada transaksi pemasukan bulan ini.</p>' :
            `<div style="overflow-x: auto; max-height: 300px; overflow-y: auto;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead style="position: sticky; top: 0; background: #f8f9fa;">
                        <tr>
                            <th style="padding: 12px; text-align: left; border-bottom: 2px solid #dee2e6;">Tanggal</th>
                            <th style="padding: 12px; text-align: left; border-bottom: 2px solid #dee2e6;">Deskripsi</th>
                            <th style="padding: 12px; text-align: right; border-bottom: 2px solid #dee2e6;">Jumlah</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${trxPemasukan.map(trx => `
                            <tr style="border-bottom: 1px solid #f1f3f5;">
                                <td style="padding: 12px; font-size: 0.9rem;">${new Date(trx.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                                <td style="padding: 12px;">${trx.deskripsi || '-'}</td>
                                <td style="padding: 12px; text-align: right; color: #10b981; font-weight: 700;">Rp ${trx.jumlah.toLocaleString('id-ID')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>`
        }
        
        <h3 style="margin: 1.5rem 0 1rem 0; color: #2c3e50; border-bottom: 2px solid #e9ecef; padding-bottom: 0.5rem;">💸 Riwayat Pengeluaran (${trxPengeluaran.length})</h3>
        ${trxPengeluaran.length === 0 ? 
            '<p style="text-align: center; color: #7f8c8d; padding: 2rem;">Belum ada transaksi pengeluaran bulan ini.</p>' :
            `<div style="overflow-x: auto; max-height: 300px; overflow-y: auto;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead style="position: sticky; top: 0; background: #f8f9fa;">
                        <tr>
                            <th style="padding: 12px; text-align: left; border-bottom: 2px solid #dee2e6;">Tanggal</th>
                            <th style="padding: 12px; text-align: left; border-bottom: 2px solid #dee2e6;">Deskripsi</th>
                            <th style="padding: 12px; text-align: right; border-bottom: 2px solid #dee2e6;">Jumlah</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${trxPengeluaran.map(trx => `
                            <tr style="border-bottom: 1px solid #f1f3f5;">
                                <td style="padding: 12px; font-size: 0.9rem;">${new Date(trx.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                                <td style="padding: 12px;">${trx.deskripsi || '-'}</td>
                                <td style="padding: 12px; text-align: right; color: #ef4444; font-weight: 700;">Rp ${trx.jumlah.toLocaleString('id-ID')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>`
        }
        
        <div style="margin-top: 1.5rem; text-align: center;">
            <a href="keuangan.html" style="display: inline-block; background: #10b981; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                Kelola Keuangan →
            </a>
        </div>
    `;
    
    modal.style.display = 'flex';
};

/**
 * Menutup modal detail keuangan
 */
window.closeModalKeuangan = function() {
    const modal = document.getElementById('modalKeuanganDetail');
    if (modal) modal.style.display = 'none';
};

// Close modal when clicking outside
document.addEventListener('click', function(event) {
    const modalPrediksi = document.getElementById('modalPrediksiDetail');
    const modalKeuangan = document.getElementById('modalKeuanganDetail');
    
    if (event.target === modalPrediksi) {
        closeModalPrediksi();
    }
    if (event.target === modalKeuangan) {
        closeModalKeuangan();
    }
});

