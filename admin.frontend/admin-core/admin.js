/* =========================================================
   SISTEM ADMINISTRASI PETERNAKAN (LIBAS)
   File: admin.js
   Deskripsi: Logika bisnis dan integrasi Firebase untuk Admin Panel.
   Struktur: Terorganisir sesuai urutan front-end admin.html.
   ========================================================= */

// =========================================================
// 1. IMPORTS & KONFIGURASI FIREBASE
// =========================================================
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { 
    collection, onSnapshot, query, orderBy, 
    doc, getDoc, updateDoc, deleteDoc, addDoc, serverTimestamp, 
    setDoc, getDocs, where, limit 
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { 
    getAuth, onAuthStateChanged, signOut, createUserWithEmailAndPassword,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";

// Menggunakan inisialisasi terpusat dari firebase-init.js
import { auth, db } from "../../firebase.component/firebase-init.js";

// Konfigurasi lokal untuk Secondary Auth (Registrasi User Baru tanpa Logout Admin)
const firebaseConfig = {
  apiKey: "AIzaSyD265EEi0UE9wYNvOWKQ46huxpPTfZOcOE",
  authDomain: "libas-db.firebaseapp.com",
  projectId: "libas-db",
  storageBucket: "libas-db.firebasestorage.app",
  messagingSenderId: "918841790171",
  appId: "1:918841790171:web:04ce25a5727fddbd78c6fe",
  measurementId: "G-5VPZQD4DKY"
};

// =========================================================
// 2. VARIABEL GLOBAL & STATE MANAGEMENT
// =========================================================
let currentAdminData = null;
let ayamData         = [];
let keuanganDataAdmin = [];
let produksiDataAdmin = [];
let pakanDataAdmin    = [];
let kesehatanDataAdmin = [];
let vaksinDataAdmin    = [];
let cachedTotalSisaAyam = 0;

// State untuk Grafik
let adminEggChartInstance     = null;
let adminFinanceChartInstance = null;
let currentAdminChartPeriod   = 7;

// State untuk System Health & Feed (Fase 3)
let adminSystemHealthData = {
    syncStatus: 'normal',
    lastUpdate: new Date(),
    warningsCount: 0,
    performance: 'optimal',
    details: []
};

let adminFeedData = {
    currentStock: 0,
    dailyUsage: 10,
    estimatedDays: 0,
    stockValue: 0,
    pricePerKg: 5000,
    alerts: []
};

// =========================================================
// 3. CORE INITIALIZATION (REAL-TIME LISTENERS)
// =========================================================

/**
 * Memulai seluruh listener data dan sinkronisasi dashboard
 */
async function initAdminDashboard() {
    console.log("🚀 Inisialisasi Admin Panel...");

    // A. LISTENER PENGGUNA (Section 4)
    onSnapshot(query(collection(db, "user"), orderBy("createdAt", "desc")), (snap) => {
        const users = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderAdminUserList(users);
        
        const countBadge = document.getElementById('user-count-badge');
        const statUser = document.getElementById('stat-user');
        if (countBadge) countBadge.textContent = `${users.length} Users`;
        if (statUser) statUser.textContent = `${users.length} Orang`;
    });

    // B. LISTENER POPULASI AYAM (Section 2 & 5)
    onSnapshot(collection(db, "populasi_ayam"), (snap) => {
        ayamData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Hitung Populasi Global
        const totalAyam = ayamData.reduce((s, a) => s + (parseInt(a.sisaAyam) || 0), 0);
        const totalAfkir = ayamData.reduce((s, a) => s + (a.status === 'Afkir' ? (parseInt(a.sisaAyam) || 0) : 0), 0);
        cachedTotalSisaAyam = totalAyam;

        const elAyam = document.getElementById('stat-admin-ayam');
        const elBatch = document.getElementById('stat-admin-batch');
        const elAfkir = document.getElementById('stat-admin-afkir');
        
        if (elAyam) elAyam.textContent = `${totalAyam.toLocaleString('id-ID')} Ekor`;
        if (elBatch) elBatch.textContent = `${ayamData.filter(a => a.status === 'Aktif').length} Batch`;
        if (elAfkir) elAfkir.textContent = `${totalAfkir.toLocaleString('id-ID')} Ekor`;

        renderAdminAyamSnapshot(ayamData);
        updateAdminSystemHealthIndicators();
        
        // Trigger update "Tidak Bertelur" jika data produksi sudah ada
        updateStatTidakBertelur();
    });

    // C. LISTENER PRODUKSI HARIAN (Section 2, 2c, 5)
    onSnapshot(query(collection(db, "produksi_harian"), orderBy("tanggal", "desc")), (snap) => {
        produksiDataAdmin = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Statistik hari ini
        const today = new Date().toISOString().split('T')[0];
        const prodToday = produksiDataAdmin.filter(p => p.tanggal === today);
        const totalProd = prodToday.reduce((s, p) => s + (parseInt(p.totalTelur) || 0), 0);
        const cacatProd = prodToday.reduce((s, p) => s + (parseInt(p.telurCacat) || 0), 0);

        const elProd = document.getElementById('stat-admin-produksi');
        const elCacatInline = document.getElementById('stat-admin-telur-cacat-inline');
        
        if (elProd) elProd.textContent = `${totalProd.toLocaleString('id-ID')} Butir`;
        if (elCacatInline) {
            elCacatInline.textContent = cacatProd > 0 ? `(${cacatProd} Cacat)` : "";
            elCacatInline.style.display = cacatProd > 0 ? "block" : "none";
        }

        updateStatTidakBertelur(totalProd);
        renderAdminCharts();
        renderAdminProduksiSnapshot(produksiDataAdmin.slice(0, 10));
        updateAdminSystemHealthIndicators();
    });

    // D. LISTENER KEUANGAN (Section 2, 2c, 5)
    onSnapshot(query(collection(db, "keuangan"), orderBy("tanggal", "desc")), (snap) => {
        keuanganDataAdmin = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const pemasukan = keuanganDataAdmin.filter(t => t.tipe === 'pemasukan').reduce((s, t) => s + (parseInt(t.jumlah) || 0), 0);
        const pengeluaran = keuanganDataAdmin.filter(t => t.tipe === 'pengeluaran').reduce((s, t) => s + (parseInt(t.jumlah) || 0), 0);
        const saldo = pemasukan - pengeluaran;

        const elSaldo = document.getElementById('stat-admin-prediksi');
        const elTrx = document.getElementById('stat-admin-uang');
        
        if (elSaldo) elSaldo.textContent = `Rp ${saldo.toLocaleString('id-ID')}`;
        if (elTrx) elTrx.textContent = `${keuanganDataAdmin.length} Transaksi`;

        renderAdminCharts();
        renderAdminKeuanganSnapshot(keuanganDataAdmin.slice(0, 10));
    });

    // E. LISTENER STOK PAKAN (Section 2, 5, Fase 3)
    onSnapshot(query(collection(db, "stok_pakan"), orderBy("tanggal", "desc")), (snap) => {
        pakanDataAdmin = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const pakanMasuk = pakanDataAdmin.filter(p => p.tipe === 'Masuk').reduce((s, p) => s + (parseFloat(p.jumlah) || 0), 0);
        const pakanKeluar = pakanDataAdmin.filter(p => p.tipe === 'Keluar').reduce((s, p) => s + (parseFloat(p.jumlah) || 0), 0);
        const sisaPakan = pakanMasuk - pakanKeluar;

        const elPakan = document.getElementById('stat-admin-pakan');
        if (elPakan) elPakan.textContent = `${sisaPakan.toLocaleString('id-ID')} Kg`;

        renderAdminPakanSnapshot(pakanDataAdmin.slice(0, 10));
        updateAdminFeedStockManagement();
        updateAdminSystemHealthIndicators();
    });

    // F. LISTENER KESEHATAN & MORTALITAS (Section 2, 5, Alert)
    onSnapshot(query(collection(db, "kesehatan_ayam"), orderBy("tanggal", "desc")), (snap) => {
        kesehatanDataAdmin = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const totalMati = kesehatanDataAdmin.reduce((sum, item) => {
            if (item.status === 'Mati Semua') {
                return sum + (parseInt(item.jmlSakit) || 0) + (parseInt(item.jmlMati) || 0);
            }
            return sum + (parseInt(item.jmlMati) || 0);
        }, 0);

        const elMati = document.getElementById('stat-admin-mortalitas');
        if (elMati) elMati.textContent = `${totalMati.toLocaleString('id-ID')} Ekor`;

        renderAdminKesehatanSnapshot(kesehatanDataAdmin.slice(0, 10));
        renderAdminAyamSakitAlert();
        updateAdminSystemHealthIndicators();
    });

    // G. LISTENER VAKSINASI (Section 5)
    onSnapshot(query(collection(db, "vaksinasi_ayam"), orderBy("tanggal", "asc")), (snap) => {
        vaksinDataAdmin = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderAdminVaksinSnapshot(vaksinDataAdmin.slice(0, 10));
    });

    // H. LISTENER PREDIKSI HISTORY (Section 5)
    onSnapshot(query(collection(db, "prediksi_history"), orderBy("tanggal", "desc"), limit(10)), (snap) => {
        const history = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderAdminPrediksiSnapshot(history);
        
        if (history.length > 0) {
            renderAdminPrediksiStats(history[0]);
            if (history[0].rekomendasi) {
                renderRekomendasiAdmin(history[0].rekomendasi);
            }
        } else {
            hideRekomendasiAdmin();
        }
    });

    // I. LISTENER MANAJEMEN OPERASIONAL (Section 6)
    onSnapshot(query(collection(db, "daily_activities"), orderBy("createdAt", "asc")), (snap) => {
        renderAdminActivities(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    onSnapshot(query(collection(db, "announcements"), orderBy("createdAt", "desc")), (snap) => {
        renderAdminAnnouncements(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    onSnapshot(query(collection(db, "schedules"), orderBy("tanggal", "asc")), (snap) => {
        renderAdminSchedules(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // J. LISTENER AUDIT LOG (Section 7)
    onSnapshot(query(collection(db, "activity_log"), orderBy("waktu", "desc"), limit(5)), (snap) => {
        renderSystemLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // K. SINKRONISASI INTERVAL (Fase 3)
    setInterval(updateAdminSystemHealthIndicators, 30000);
    setInterval(updateAdminFeedStockManagement, 300000);
    
    console.log("✅ Semua Listener Cloud Aktif.");
}

/**
 * Helper: Update statistik ayam tidak bertelur
 */
function updateStatTidakBertelur(totalProdParam) {
    const elTidakBertelur = document.getElementById('stat-admin-tidak-bertelur');
    if (!elTidakBertelur) return;

    let totalProd = totalProdParam;
    if (totalProd === undefined) {
        const today = new Date().toISOString().split('T')[0];
        totalProd = produksiDataAdmin.filter(p => p.tanggal === today).reduce((s, p) => s + (parseInt(p.totalTelur) || 0), 0);
    }

    const tidakBertelur = Math.max(0, cachedTotalSisaAyam - totalProd);
    elTidakBertelur.textContent = `${tidakBertelur.toLocaleString('id-ID')} Ekor`;
}

// Inisialisasi Sesi Login Admin
onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            const adminSnap = await getDoc(doc(db, "admin", user.uid));
            if (adminSnap.exists()) {
                currentAdminData = adminSnap.data();
                const elName = document.querySelector(".profile-name");
                if (elName) elName.textContent = currentAdminData.fullname || "Administrator";
                initAdminDashboard();
            } else {
                console.warn("User login bukan admin.");
                window.location.href = "../adminlogin.html";
            }
        } catch (err) {
            console.error("Auth error:", err);
            window.location.href = "../adminlogin.html";
        }
    } else {
        window.location.href = "../adminlogin.html";
    }
});

// =========================================================
// 4. UI RENDERING FUNCTIONS (FULL ORIGINAL LOGIC)
// =========================================================

/**
 * ---------------------------------------------------------
 * C & D. Section 2: Statistik Global & Info Ayam Sakit
 * ---------------------------------------------------------
 */

function renderAdminAyamSakitAlert() {
    const alertBox = document.getElementById("stat-admin-ayam-sakit");
    const statInline = document.getElementById("stat-admin-ayam-sakit-inline");
    if (!alertBox) return;

    const ayamSakit = kesehatanDataAdmin.filter(x => x.status === "Dalam Perawatan")
                                        .reduce((sum, item) => sum + (parseInt(item.jmlSakit) || 0), 0);

    if (ayamSakit > 0) {
        alertBox.style.display = "flex";
        alertBox.innerHTML = `<span>⚠️</span> Ada <strong>${ayamSakit} ekor</strong> ayam dalam perawatan medis. Periksa laporan kesehatan!`;
        
        // Tentukan level bahaya berdasarkan persentase
        const persentaseSakit = cachedTotalSisaAyam > 0 ? (ayamSakit / cachedTotalSisaAyam) * 100 : 0;
        
        alertBox.className = "admin-ayam-sakit-info"; // reset
        if (persentaseSakit >= 10) {
            alertBox.classList.add("status-kritis");
        } else if (persentaseSakit >= 5) {
            alertBox.classList.add("status-waspada");
        } else {
            alertBox.classList.add("status-normal");
        }

        if (statInline) {
            statInline.style.display = "block";
            statInline.textContent = `(${ayamSakit} Sakit)`;
            statInline.style.color = persentaseSakit >= 10 ? "#ef4444" : "#f59e0b";
        }
    } else {
        alertBox.style.display = "none";
        if (statInline) statInline.style.display = "none";
    }
}

/**
 * ---------------------------------------------------------
 * E. Section 2c: Grafik Analitik Admin
 * ---------------------------------------------------------
 */

function renderAdminCharts() {
    renderAdminEggChart(currentAdminChartPeriod);
    renderAdminFinanceChart();
}

function renderAdminEggChart(nHari) {
    const canvas = document.getElementById('adminEggChart');
    if (!canvas) return;
    if (adminEggChartInstance) adminEggChartInstance.destroy();

    const grouped = {};
    produksiDataAdmin.forEach(p => {
        if (!grouped[p.tanggal]) grouped[p.tanggal] = { total: 0, baik: 0, cacat: 0 };
        grouped[p.tanggal].total  += (parseInt(p.totalTelur) || 0);
        grouped[p.tanggal].baik   += (parseInt(p.telurBaik)  || 0);
        grouped[p.tanggal].cacat  += (parseInt(p.telurCacat) || 0);
    });

    const dates     = Object.keys(grouped).sort().slice(-nHari);
    const labels    = dates.map(d => new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }));
    const totalData = dates.map(d => grouped[d].total);
    const baikData  = dates.map(d => grouped[d].baik);
    const cacatData = dates.map(d => grouped[d].cacat);

    // Update mini-stats chart
    const sumTotal = totalData.reduce((s, v) => s + v, 0);
    const elTotal  = document.getElementById('admin-chart-total');
    const elBaik   = document.getElementById('admin-chart-baik');
    const elCacat  = document.getElementById('admin-chart-cacat');
    const elRata   = document.getElementById('admin-chart-rata');
    
    if (elTotal) elTotal.textContent = sumTotal.toLocaleString('id-ID');
    if (elBaik)  elBaik.textContent  = baikData.reduce((s, v) => s + v, 0).toLocaleString('id-ID');
    if (elCacat) elCacat.textContent = cacatData.reduce((s, v) => s + v, 0).toLocaleString('id-ID');
    if (elRata)  elRata.textContent  = Math.round(sumTotal / (totalData.length || 1)).toLocaleString('id-ID');

    const emptyEl = document.getElementById('adminChartEmptyOverlay');
    if (emptyEl) emptyEl.style.display = totalData.length ? 'none' : 'flex';

    adminEggChartInstance = new Chart(canvas, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Total Telur',
                    data: totalData,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16,185,129,0.12)',
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#10b981',
                    pointRadius: 4
                },
                {
                    label: 'Telur Baik',
                    data: baikData,
                    borderColor: '#3b82f6',
                    backgroundColor: 'transparent',
                    tension: 0.4,
                    pointRadius: 3,
                    borderDash: [4, 4]
                }
            ]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: 'top', labels: { usePointStyle: true } } },
            scales: { y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } } }
        }
    });
}

function renderAdminFinanceChart() {
    const canvas = document.getElementById('adminFinanceChart');
    if (!canvas) return;
    if (adminFinanceChartInstance) adminFinanceChartInstance.destroy();

    const currentMonth = new Date().getMonth();
    const currentYear  = new Date().getFullYear();
    const incomeByWeek   = [0, 0, 0, 0];
    const expenseByWeek  = [0, 0, 0, 0];

    keuanganDataAdmin.forEach(trx => {
        const d = new Date(trx.tanggal);
        if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
            const week = Math.min(3, Math.floor((d.getDate() - 1) / 7));
            if (trx.tipe === 'pemasukan') incomeByWeek[week]  += (trx.jumlah || 0);
            else                           expenseByWeek[week] += (trx.jumlah || 0);
        }
    });

    adminFinanceChartInstance = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: ['Minggu 1', 'Minggu 2', 'Minggu 3', 'Minggu 4+'],
            datasets: [
                { label: 'Pemasukan', data: incomeByWeek,  backgroundColor: 'rgba(16,185,129,0.8)', borderRadius: 6 },
                { label: 'Pengeluaran', data: expenseByWeek, backgroundColor: 'rgba(239,68,68,0.8)',   borderRadius: 6 }
            ]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: 'top', labels: { usePointStyle: true } } },
            scales: { y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } } }
        }
    });
}

/**
 * ---------------------------------------------------------
 * F & G. Section: System Health & Feed Stock
 * ---------------------------------------------------------
 */

function updateAdminSystemHealthIndicators() {
    const statusEl = document.getElementById('admin-system-health-status');
    const indicatorEl = document.getElementById('admin-system-health-indicator');
    const syncEl = document.getElementById('admin-system-sync-status');
    const updateEl = document.getElementById('admin-system-last-update');
    const warningsEl = document.getElementById('admin-system-warnings-count');
    const warningsBadgeEl = document.getElementById('admin-warnings-badge');
    const performanceEl = document.getElementById('admin-system-performance');
    const detailsEl = document.getElementById('admin-system-details');
    const detailsContentEl = document.getElementById('admin-system-details-content');

    if (!statusEl) return;

    adminSystemHealthData.lastUpdate = new Date();
    let warnings = 0;
    let details = [];
    
    // Check feed stock
    let pakanMasuk = 0, pakanKeluar = 0;
    pakanDataAdmin.forEach(p => {
        if (p.tipe === 'Masuk') pakanMasuk += p.jumlah;
        else pakanKeluar += p.jumlah;
    });
    const sisaPakan = pakanMasuk - pakanKeluar;
    if (sisaPakan < 50) {
        warnings++;
        details.push({ type: 'warning', icon: '🥬', title: 'Stok Pakan Kritis', message: `Sisa pakan hanya ${sisaPakan.toLocaleString('id-ID')} Kg (< 50 Kg)` });
    } else if (sisaPakan < 100) {
        details.push({ type: 'info', icon: '🥬', title: 'Stok Pakan Rendah', message: `Sisa pakan ${sisaPakan.toLocaleString('id-ID')} Kg (< 100 Kg)` });
    }
    
    // Check sick chickens
    const ayamSakit = kesehatanDataAdmin.filter(x => x.status === "Dalam Perawatan").reduce((sum, item) => sum + (parseInt(item.jmlSakit) || 0), 0);
    if (ayamSakit > 0) {
        warnings++;
        const persentase = cachedTotalSisaAyam > 0 ? ((ayamSakit / cachedTotalSisaAyam) * 100).toFixed(1) : 0;
        details.push({ type: persentase >= 5 ? 'error' : 'warning', icon: '🩺', title: 'Ayam Sakit Terdeteksi', message: `${ayamSakit.toLocaleString('id-ID')} ekor sakit (${persentase}% dari populasi)` });
    }
    
    // Check production today
    const today = new Date().toISOString().split('T')[0];
    if (produksiDataAdmin.filter(p => p.tanggal === today).length === 0) {
        warnings++;
        details.push({ type: 'warning', icon: '🥚', title: 'Belum Ada Input Produksi', message: 'Belum ada data produksi untuk hari ini.' });
    }
    
    // Check mortalitas rate
    const totalMati = kesehatanDataAdmin.reduce((sum, item) => {
        if (item.status === 'Mati Semua') return sum + (parseInt(item.jmlSakit) || 0) + (parseInt(item.jmlMati) || 0);
        return sum + (parseInt(item.jmlMati) || 0);
    }, 0);
    
    if (totalMati > 0 && cachedTotalSisaAyam > 0) {
        const mortalityRate = (totalMati / (cachedTotalSisaAyam + totalMati)) * 100;
        if (mortalityRate > 10) {
            warnings++;
            details.push({ type: 'error', icon: '💀', title: 'Tingkat Mortalitas Tinggi', message: `Mortalitas ${mortalityRate.toFixed(1)}% (${totalMati} ekor)` });
        }
    }
    
    adminSystemHealthData.warningsCount = warnings;
    adminSystemHealthData.details = details;
    
    let overallStatus = warnings >= 3 ? 'Perlu Perhatian Segera' : warnings >= 1 ? 'Ada Peringatan Aktif' : 'Sistem Berjalan Normal';
    let indicatorColor = warnings >= 3 ? '#ef4444' : warnings >= 1 ? '#f59e0b' : '#10b981';
    
    statusEl.textContent = overallStatus;
    statusEl.style.color = indicatorColor;
    indicatorEl.style.background = indicatorColor;
    indicatorEl.style.boxShadow = `0 0 10px ${indicatorColor}50`;
    
    syncEl.textContent = '🟢 Normal';
    updateEl.textContent = adminSystemHealthData.lastUpdate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    warningsEl.textContent = warnings === 0 ? 'Tidak Ada' : `${warnings} Issues`;
    warningsBadgeEl.textContent = warnings.toString();
    warningsBadgeEl.style.background = indicatorColor;
    performanceEl.textContent = warnings >= 3 ? 'Perlu Perbaikan' : 'Optimal';
    
    if (details.length > 0) {
        detailsEl.style.display = 'block';
        detailsContentEl.innerHTML = details.map(detail => {
            let bgColor = detail.type === 'error' ? '#fee2e2' : detail.type === 'warning' ? '#fef3c7' : '#dbeafe';
            let borderColor = detail.type === 'error' ? '#ef4444' : detail.type === 'warning' ? '#f59e0b' : '#3b82f6';
            return `
                <div style="background: ${bgColor}; border-left: 3px solid ${borderColor}; padding: 0.75rem; margin-bottom: 0.5rem; border-radius: 4px; display: flex; gap: 10px;">
                    <span style="font-size: 1.2rem;">${detail.icon}</span>
                    <div>
                        <strong style="color: #1e293b; font-size: 0.9rem;">${detail.title}</strong>
                        <p style="margin: 0.25rem 0 0 0; color: #475569; font-size: 0.85rem;">${detail.message}</p>
                    </div>
                </div>`;
        }).join('');
    } else {
        detailsEl.style.display = 'none';
    }
}

function updateAdminFeedStockManagement() {
    let pakanMasuk = 0, pakanKeluar = 0;
    pakanDataAdmin.forEach(p => p.tipe === 'Masuk' ? pakanMasuk += p.jumlah : pakanKeluar += p.jumlah);
    adminFeedData.currentStock = pakanMasuk - pakanKeluar;
    
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    const last7Days = pakanDataAdmin.filter(p => p.tipe === 'Keluar' && new Date(p.tanggal) >= weekAgo);
    if (last7Days.length > 0) {
        adminFeedData.dailyUsage = Math.round(last7Days.reduce((sum, p) => sum + p.jumlah, 0) / 7);
    }
    
    adminFeedData.estimatedDays = adminFeedData.dailyUsage > 0 ? Math.floor(adminFeedData.currentStock / adminFeedData.dailyUsage) : 0;
    adminFeedData.stockValue = adminFeedData.currentStock * adminFeedData.pricePerKg;
    
    updateAdminFeedUI();
    checkAdminFeedAlerts();
}

function updateAdminFeedUI() {
    const currentEl = document.getElementById('admin-feed-current');
    const usageEl = document.getElementById('admin-feed-daily-usage');
    const estimatedEl = document.getElementById('admin-feed-estimated');
    const valueEl = document.getElementById('admin-feed-value');
    const statusEl = document.getElementById('admin-feed-status-text');
    const indicatorEl = document.getElementById('admin-feed-status-indicator');
    const urgencyBadgeEl = document.getElementById('admin-feed-urgency-badge');
    
    if (!currentEl) return;
    
    currentEl.textContent = `${adminFeedData.currentStock.toLocaleString('id-ID')} Kg`;
    usageEl.textContent = `~${adminFeedData.dailyUsage} Kg/hari`;
    estimatedEl.textContent = `${adminFeedData.estimatedDays} Hari`;
    valueEl.textContent = `Rp ${adminFeedData.stockValue.toLocaleString('id-ID')}`;
    
    let status = 'Stok Aman', color = '#10b981', urgencyText = 'NORMAL';
    if (adminFeedData.estimatedDays <= 2) { status = 'KRITIS!'; color = '#ef4444'; urgencyText = 'KRITIS'; }
    else if (adminFeedData.estimatedDays <= 5) { status = 'Stok Rendah'; color = '#f59e0b'; urgencyText = 'RENDAH'; }
    
    statusEl.textContent = status; statusEl.style.color = color;
    indicatorEl.style.background = color;
    urgencyBadgeEl.textContent = urgencyText; urgencyBadgeEl.style.background = color;
}

function checkAdminFeedAlerts() {
    const alertsEl = document.getElementById('admin-feed-alerts');
    const contentEl = document.getElementById('admin-feed-alert-content');
    if (!alertsEl || !contentEl) return;
    
    adminFeedData.alerts = [];
    if (adminFeedData.currentStock <= 20) adminFeedData.alerts.push({ title: 'Stok Pakan Kritis', message: `Hanya tersisa ${adminFeedData.currentStock} Kg.`, action: 'Beli pakan segera!' });
    else if (adminFeedData.currentStock <= 50) adminFeedData.alerts.push({ title: 'Stok Pakan Rendah', message: `Tersisa ${adminFeedData.currentStock} Kg.`, action: 'Rencanakan pembelian segera.' });
    
    if (adminFeedData.alerts.length > 0) {
        alertsEl.style.display = 'block';
        contentEl.innerHTML = adminFeedData.alerts.map(a => `
            <div style="margin-bottom: 1rem;">
                <div style="font-weight: 600;">${a.title}</div>
                <div>${a.message}</div>
                <div style="font-style: italic; font-size: 0.85rem;">💡 ${a.action}</div>
            </div>`).join('');
    } else alertsEl.style.display = 'none';
}

/**
 * ---------------------------------------------------------
 * I. Section 4: Tabel Manajemen Pengguna
 * ---------------------------------------------------------
 */

function renderAdminUserList(users) {
    const tbody = document.getElementById("adminUserListBody");
    if (!tbody) return;

    if (users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#94a3b8; padding:2rem;">Belum ada data pengguna terdaftar.</td></tr>`;
        return;
    }

    tbody.innerHTML = users.map(user => {
        const isAuthAdmin = (user.role || '').toLowerCase().includes('admin');
        const roleLabel = isAuthAdmin ? 'ADMIN' : 'PEKERJA';
        const roleClass = isAuthAdmin ? 'badge-admin' : 'badge-user';
        const statusLabel = user.disabled ? 'NONAKTIF' : 'AKTIF';
        const statusColor = user.disabled ? '#ef4444' : '#10b981';

        let joinDate = '-';
        if (user.createdAt) {
            const dateObj = user.createdAt.toDate ? user.createdAt.toDate() : new Date(user.createdAt);
            joinDate = dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
        }

        return `
            <tr>
                <td style="text-align:left;">
                    <div style="font-weight:600; color:#1e293b;">${user.fullname || '-'}</div>
                </td>
                <td><code style="background:#f1f5f9; padding:2px 6px; border-radius:4px; font-size:0.8rem;">@${user.username || '-'}</code></td>
                <td style="font-size:0.85rem; color:#64748b;">${user.email || '-'}</td>
                <td style="font-size:0.85rem;">${joinDate}</td>
                <td><span style="background:${isAuthAdmin ? '#6366f115' : '#f1f5f9'}; color:${isAuthAdmin ? '#6366f1' : '#64748b'}; padding:4px 10px; border-radius:20px; font-size:0.75rem; font-weight:700; border:1px solid ${isAuthAdmin ? '#6366f130' : '#e2e8f0'};">${roleLabel}</span></td>
                <td><span style="color:${statusColor}; font-weight:700; font-size:0.75rem;">● ${statusLabel}</span></td>
                <td>
                    <div style="display:flex; justify-content:center; gap:8px;">
                        <button onclick="openEditUserModal('${user.id}')" class="action-btn-small" style="background:#3b82f6;" title="Edit Profil">✏️</button>
                        <button onclick="toggleAdminRole('${user.id}', '${user.role}')" class="action-btn-small" style="background:#6366f1;" title="Ubah Otoritas">🛡️</button>
                        <button onclick="deleteUserAccount('${user.id}', '${user.fullname}')" class="action-btn-small" style="background:#ef4444;" title="Hapus Akun">🗑️</button>
                    </div>
                </td>
            </tr>`;
    }).join('');
}

/**
 * ---------------------------------------------------------
 * J. Section 5: Ringkasan Data Peternakan Ayam (Snapshot Tabs)
 * ---------------------------------------------------------
 */

function renderAdminAyamSnapshot(data) {
    const tbody = document.getElementById('adminAyamSnapshot');
    if (!tbody) return;
    if (data.length === 0) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Data kosong.</td></tr>'; return; }

    tbody.innerHTML = data.slice(0, 10).map(a => `
        <tr>
            <td><strong style="color:#1e293b;">${a.customId || a.id.slice(0, 8)}</strong></td>
            <td>${a.jenis || '-'}</td>
            <td><span style="color:${a.status === 'Aktif' ? '#10b981' : '#64748b'}; font-weight:700;">${a.status}</span></td>
            <td style="font-weight:600;">${(a.sisaAyam || 0).toLocaleString('id-ID')} Ekor</td>
            <td><button onclick="openAyamDetail('${a.id}')" class="action-btn-small" style="background:#10b981;">Detail</button></td>
        </tr>`).join('');
}

function renderAdminKeuanganSnapshot(data) {
    const tbody = document.getElementById('adminKeuanganSnapshot');
    if (!tbody) return;
    if (data.length === 0) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Data kosong.</td></tr>'; return; }

    tbody.innerHTML = data.map(t => `
        <tr>
            <td style="font-size:0.85rem;">${new Date(t.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</td>
            <td style="text-align:left; font-size:0.85rem;">${t.deskripsi}</td>
            <td><span style="color:${t.tipe === 'pemasukan' ? '#10b981' : '#ef4444'}; font-weight:700; font-size:0.75rem;">${t.tipe.toUpperCase()}</span></td>
            <td style="font-weight:700;">Rp ${parseInt(t.jumlah || 0).toLocaleString('id-ID')}</td>
            <td><button onclick="openKeuanganDetail('${t.id}')" class="action-btn-small" style="background:#3b82f6;">Edit</button></td>
        </tr>`).join('');
}

function renderAdminProduksiSnapshot(data) {
    const tbody = document.getElementById('adminProduksiSnapshot');
    if (!tbody) return;
    if (data.length === 0) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Data kosong.</td></tr>'; return; }

    tbody.innerHTML = data.map(p => `
        <tr>
            <td>${new Date(p.tanggal).toLocaleDateString('id-ID')}</td>
            <td style="font-weight:700; color:#1e293b;">${p.totalTelur} Btr</td>
            <td style="color:#10b981; font-weight:600;">${p.telurBaik}</td>
            <td style="color:#ef4444; font-weight:600;">${p.telurCacat}</td>
            <td><button onclick="openProduksiDetail('${p.id}')" class="action-btn-small" style="background:#fb8500;">Edit</button></td>
        </tr>`).join('');
}

function renderAdminPakanSnapshot(data) {
    const tbody = document.getElementById('adminPakanSnapshot');
    if (!tbody) return;
    if (data.length === 0) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Data kosong.</td></tr>'; return; }

    tbody.innerHTML = data.map(p => `
        <tr>
            <td>${new Date(p.tanggal).toLocaleDateString('id-ID')}</td>
            <td style="text-align:left;">${p.namaBarang}</td>
            <td><span style="color:${p.tipe === 'Masuk' ? '#10b981' : '#ef4444'}; font-weight:700; font-size:0.75rem;">${p.tipe.toUpperCase()}</span></td>
            <td style="font-weight:600;">${p.jumlah} Kg</td>
            <td><button onclick="openPakanDetail('${p.id}')" class="action-btn-small" style="background:#6366f1;">Edit</button></td>
        </tr>`).join('');
}

function renderAdminKesehatanSnapshot(data) {
    const tbody = document.getElementById('adminKesehatanSnapshot');
    if (!tbody) return;
    if (data.length === 0) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Data kosong.</td></tr>'; return; }

    tbody.innerHTML = data.map(h => `
        <tr>
            <td>${new Date(h.tanggal).toLocaleDateString('id-ID')}</td>
            <td>${h.batchName || 'Batch Global'}</td>
            <td style="color:#ef4444; font-weight:700;">${h.jmlMati} Ekor</td>
            <td style="font-size:0.8rem; color:#64748b;">${h.sebab || '-'}</td>
            <td><button onclick="openKesehatanDetail('${h.id}')" class="action-btn-small" style="background:#ef4444;">Edit</button></td>
        </tr>`).join('');
}

function renderAdminVaksinSnapshot(data) {
    const tbody = document.getElementById('adminVaksinSnapshot');
    if (!tbody) return;
    if (data.length === 0) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Data kosong.</td></tr>'; return; }

    tbody.innerHTML = data.map(v => `
        <tr>
            <td>${new Date(v.tanggal).toLocaleDateString('id-ID')}</td>
            <td style="font-weight:600;">${v.namaVaksin}</td>
            <td style="font-size:0.85rem;">${v.batchName || '-'}</td>
            <td><span style="background:${v.status === 'Selesai' ? '#d1fae5' : '#fef3c7'}; color:${v.status === 'Selesai' ? '#065f46' : '#92400e'}; padding:2px 8px; border-radius:10px; font-size:0.7rem; font-weight:700;">${v.status.toUpperCase()}</span></td>
            <td><button onclick="openVaksinDetail('${v.id}')" class="action-btn-small" style="background:#8b5cf6;">Edit</button></td>
        </tr>`).join('');
}

function renderAdminPrediksiSnapshot(data) {
    const tbody = document.getElementById('adminPrediksiSnapshot');
    if (!tbody) return;
    if (data.length === 0) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Data kosong.</td></tr>'; return; }

    tbody.innerHTML = data.map(p => `
        <tr>
            <td style="font-size:0.75rem;">${new Date(p.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
            <td>${p.periodeMA} Hari</td>
            <td>${(p.populasi || 0).toLocaleString('id-ID')}</td>
            <td style="font-weight:700; color:#3b82f6;">${(p.prediksiBesokButir || 0).toLocaleString('id-ID')} Btr</td>
            <td style="font-weight:700; color:#10b981;">Rp ${(p.keuntungan || 0).toLocaleString('id-ID')}</td>
            <td><button onclick="openPrediksiDetail('${p.id}')" class="action-btn-small" style="background:#3b82f6;">Detail</button></td>
        </tr>`).join('');
}

function renderAdminPrediksiStats(latest) {
    const elProd = document.getElementById('admin-prediksi-produksi');
    const elButir = document.getElementById('admin-prediksi-butir');
    const elPend = document.getElementById('admin-prediksi-pendapatan');
    const elBiaya = document.getElementById('admin-prediksi-biaya');
    const elLaba = document.getElementById('admin-prediksi-keuntungan');

    if (elProd) elProd.textContent = `${(latest.prediksiBesokKg || 0).toFixed(2)} Kg`;
    if (elButir) elButir.textContent = `${(latest.prediksiBesokButir || 0).toLocaleString('id-ID')} Butir Telur`;
    if (elPend) elPend.textContent = `Rp ${(latest.estimasiPendapatan || 0).toLocaleString('id-ID')}`;
    if (elBiaya) elBiaya.textContent = `Rp ${(latest.biayaPakan || 0).toLocaleString('id-ID')}`;
    if (elLaba) {
        const laba = latest.keuntungan || 0;
        elLaba.textContent = (laba >= 0 ? "" : "- ") + `Rp ${Math.abs(laba).toLocaleString('id-ID')}`;
        elLaba.style.color = laba >= 0 ? '#10b981' : '#ef4444';
    }
}

function renderRekomendasiAdmin(rekomendasi) {
    const container = document.getElementById('admin-rekomendasi-container');
    const list = document.getElementById('admin-rekomendasi-list');
    if (!container || !list) return;
    
    container.style.display = 'block';
    list.innerHTML = rekomendasi.map((rek, idx) => {
        let color = rek.level === 'success' ? '#10b981' : rek.level === 'warning' ? '#f59e0b' : rek.level === 'danger' ? '#ef4444' : '#3b82f6';
        let bg = rek.level === 'success' ? '#d1fae5' : rek.level === 'warning' ? '#fef3c7' : rek.level === 'danger' ? '#fee2e2' : '#dbeafe';
        
        return `
            <div style="background:${bg}; border-left:4px solid ${color}; padding:1rem; border-radius:10px; margin-bottom:1rem; display:flex; gap:12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                <span style="font-size:1.5rem; flex-shrink:0;">${rek.icon || '💡'}</span>
                <div style="flex:1;">
                    <div style="display:flex; align-items:center; gap:10px; margin-bottom:5px; flex-wrap:wrap;">
                        <span style="background:${color}; color:#fff; font-size:0.7rem; font-weight:700; padding:2px 10px; border-radius:20px; text-transform:uppercase; letter-spacing:0.5px;">${rek.level}</span>
                        <h4 style="margin:0; font-size:1rem; color:#1a202c; font-weight:700;">${rek.title}</h4>
                    </div>
                    <p style="margin:0; font-size:0.9rem; color:#4a5568; line-height:1.6;">${rek.description}</p>
                    ${rek.actions ? `
                        <div style="margin-top:0.75rem; padding-left:1rem; border-left:2px solid ${color}40;">
                            <p style="margin:0 0 5px 0; font-weight:600; font-size:0.8rem; color:#2d3748;">Saran Tindakan:</p>
                            <ul style="margin:0; padding-left:1.2rem; font-size:0.85rem; color:#4a5568;">${rek.actions.map(a => `<li>${a}</li>`).join('')}</ul>
                        </div>` : ''}
                </div>
            </div>`;
    }).join('');
}

function hideRekomendasiAdmin() {
    const el = document.getElementById('admin-rekomendasi-container');
    if (el) el.style.display = 'none';
}

/**
 * ---------------------------------------------------------
 * K. Section 6: Manajemen Operasional
 * ---------------------------------------------------------
 */

function renderAdminActivities(activities) {
    const list = document.getElementById("adminActivityList");
    if (!list) return;
    list.innerHTML = activities.map(item => `
        <li style="display:flex; justify-content:space-between; align-items:center; padding:12px 15px; border-bottom:1px solid #f1f5f9; background:${item.completed ? '#f8fafc' : 'transparent'}; transition: all 0.2s;">
            <span style="flex:1; font-size:0.9rem; ${item.completed ? 'text-decoration:line-through; color:#94a3b8;' : 'color:#1e293b; font-weight:500;'}">${item.text}</span>
            <div style="display:flex; gap:8px;">
                <button onclick="toggleAdminActivity('${item.id}', ${item.completed})" style="background:${item.completed ? '#64748b' : '#10b981'}; color:white; border:none; width:30px; height:30px; border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:0.8rem; transition: transform 0.1s;" onmousedown="this.style.transform='scale(0.9)'" onmouseup="this.style.transform='scale(1)'">${item.completed ? '↩' : '✔'}</button>
                <button onclick="deleteAdminActivity('${item.id}')" style="background:#ef4444; color:white; border:none; width:30px; height:30px; border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:0.8rem; transition: transform 0.1s;" onmousedown="this.style.transform='scale(0.9)'" onmouseup="this.style.transform='scale(1)'">✕</button>
            </div>
        </li>`).join('');
}

function renderAdminAnnouncements(ann) {
    const list = document.getElementById("adminAnnouncementList");
    if (!list) return;
    if (ann.length === 0) { list.innerHTML = `<li style="text-align:center; padding:2rem; color:#94a3b8; font-size:0.85rem;">📢 Belum ada pengumuman aktif.</li>`; return; }

    list.innerHTML = ann.map(item => {
        const confirmedBy = item.confirmedBy || [];
        const count = confirmedBy.length;
        const date = item.createdAt ? new Date(item.createdAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-';
        
        return `
            <li style="padding:15px; border-bottom:1px solid #f1f5f9; border-left:4px solid ${count > 0 ? '#10b981' : '#f59e0b'}; background:${count > 0 ? '#f0fdf4' : '#fffbeb'}; border-radius:0 12px 12px 0; margin-bottom:10px; box-shadow: 0 2px 6px rgba(0,0,0,0.02);">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div style="flex:1;">
                        <p style="margin:0 0 5px 0; font-weight:700; font-size:0.95rem; color:#1e293b; line-height:1.4;">${item.text}</p>
                        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-top:5px;">
                            <span style="font-size:0.75rem; color:#94a3b8; display:flex; align-items:center; gap:3px;">🕐 ${date}</span>
                            <span style="background:${count > 0 ? '#dcfce7' : '#fef3c7'}; color:${count > 0 ? '#15803d' : '#92400e'}; padding:2px 8px; border-radius:20px; font-size:0.7rem; font-weight:700;">✅ ${count} Konfirmasi</span>
                        </div>
                        ${count > 0 ? `<div style="margin-top:8px; display:flex; flex-wrap:wrap; gap:4px;">${confirmedBy.map(n => `<span style="font-size:0.65rem; background:#fff; border:1px solid #e2e8f0; padding:1px 6px; border-radius:4px; color:#64748b;">${n}</span>`).join('')}</div>` : ''}
                    </div>
                    <button onclick="deleteAdminAnnouncement('${item.id}')" style="background:transparent; border:none; color:#ef4444; cursor:pointer; padding:5px; font-size:1.1rem; opacity:0.6;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.6'">🗑️</button>
                </div>
            </li>`;
    }).join('');
}

function renderAdminSchedules(sch) {
    const tbody = document.querySelector("#adminScheduleTable tbody");
    if (!tbody) return;
    if (sch.length === 0) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:1.5rem; color:#94a3b8;">Belum ada agenda terjadwal.</td></tr>'; return; }

    tbody.innerHTML = sch.map(s => `
        <tr>
            <td style="font-size:0.8rem; font-weight:600; color:#1e293b;">${s.tanggal}<br><small style="color:#64748b; font-weight:400;">${s.waktu}</small></td>
            <td style="font-size:0.9rem; font-weight:700; color:#3b82f6; text-align:left;">${s.agenda}</td>
            <td style="font-size:0.85rem; color:#64748b;">${s.ruangan}</td>
            <td><button onclick="deleteAdminSchedule('${s.id}')" style="background:#fee2e2; color:#ef4444; border:1px solid #fecaca; width:30px; height:30px; border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center;">🗑</button></td>
        </tr>`).join('');
}

/**
 * ---------------------------------------------------------
 * L. Section 7: Audit Log Aktivitas
 * ---------------------------------------------------------
 */

function renderSystemLogs(logs) {
    const tbody = document.getElementById('systemLogBody');
    if (!tbody) return;
    if (logs.length === 0) { tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#94a3b8; padding:2rem;">Riwayat log sistem masih kosong.</td></tr>`; return; }

    tbody.innerHTML = logs.map(l => {
        const d = l.waktu ? (l.waktu.toDate ? l.waktu.toDate() : new Date(l.waktu)) : null;
        let timeStr = '-';
        if (d && !isNaN(d.getTime())) {
            timeStr = d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        }
        
        return `
            <tr>
                <td style="white-space:nowrap; font-size:0.8rem; color:#64748b;">${timeStr}</td>
                <td><strong style="color:#1e293b;">${l.user || 'System'}</strong></td>
                <td><span style="background:#f1f5f9; color:#475569; padding:3px 10px; border-radius:20px; font-size:0.75rem; font-weight:600; border:1px solid #e2e8f0;">${l.modul || '-'}</span></td>
                <td style="font-size:0.85rem; text-align:left; color:#334155; line-height:1.4;">${l.aksi || '-'}</td>
            </tr>`;
    }).join('');
}

// =========================================================
// 5. ACTION HANDLERS & MODALS (FULL ORIGINAL LOGIC)
// =========================================================

/**
 * ---------------------------------------------------------
 * PART 1 & A. NAVIGATION, SIDEBAR & HEADER MOBILE
 * ---------------------------------------------------------
 */

window.logoutUser = function() {
    Swal.fire({
        title: 'Konfirmasi Logout',
        text: 'Apakah Anda yakin ingin keluar dari Panel Administrator?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#94a3b8',
        confirmButtonText: 'Ya, Logout Sekarang',
        cancelButtonText: 'Batal'
    }).then((res) => {
        if (res.isConfirmed) {
            signOut(auth).then(() => {
                window.location.href = "../adminlogin.html";
            }).catch(err => {
                Swal.fire('Error', 'Gagal logout: ' + err.message, 'error');
            });
        }
    });
};

window.goToProfile = () => { window.location.href = "../../editProfileTAalip.html"; };

window.toggleMobileSidebar = function() {
    const sidebar = document.querySelector('.sidebar');
    const body = document.body;
    sidebar.classList.toggle('active');
    body.classList.toggle('sidebar-open');
};

window.toggleSidebarMenu = function(id) {
    const menu = document.getElementById(id);
    const btn = menu.previousElementSibling;
    const isExpanded = btn.getAttribute('aria-expanded') === 'true';
    
    btn.setAttribute('aria-expanded', !isExpanded);
    menu.setAttribute('aria-hidden', isExpanded);
    btn.classList.toggle('active');
};

/**
 * ---------------------------------------------------------
 * E. Section 2c: Grafik Analitik Admin
 * ---------------------------------------------------------
 */

window.gantiPeriodeAdminChart = function(hari, btn) {
    currentAdminChartPeriod = hari;
    document.querySelectorAll('.admin-chart-filter').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderAdminEggChart(hari);
};

/**
 * ---------------------------------------------------------
 * F & G. Section: System Health & Feed Stock
 * ---------------------------------------------------------
 */

window.openFeedStockDetail = function() {
    Swal.fire({
        title: '📊 Analisis Stok Pakan Detail',
        html: `
            <div style="text-align: left; font-size: 0.9rem;">
                <h4 style="margin-bottom:10px;">📈 Ringkasan Stok</h4>
                <ul style="padding-left:1.5rem;">
                    <li><strong>Stok Saat Ini:</strong> ${adminFeedData.currentStock.toLocaleString('id-ID')} Kg</li>
                    <li><strong>Konsumsi Harian:</strong> ${adminFeedData.dailyUsage} Kg/hari</li>
                    <li><strong>Estimasi Habis:</strong> ${adminFeedData.estimatedDays} hari</li>
                    <li><strong>Nilai Stok:</strong> Rp ${adminFeedData.stockValue.toLocaleString('id-ID')}</li>
                </ul>
                <h4 style="margin:15px 0 10px 0;">📊 Rekomendasi</h4>
                <ul style="padding-left:1.5rem;">
                    <li>Stok minimum disarankan: <strong>150 Kg</strong> (15 hari)</li>
                    <li>Stok optimal: <strong>300 Kg</strong> (30 hari)</li>
                </ul>
                <div style="margin-top: 15px; padding: 10px; background: #f3f4f6; border-radius: 8px; font-size:0.8rem;">
                    <strong>💡 Tips Manajemen:</strong> Monitor konsumsi harian untuk deteksi anomali.
                </div>
            </div>`,
        confirmButtonText: 'Buka Modul Stok Pakan',
        showCancelButton: true,
        cancelButtonText: 'Tutup',
        confirmButtonColor: '#3b82f6'
    }).then(r => { if (r.isConfirmed) window.location.href = '../../stokpakan.html'; });
};

window.openFeedPurchaseRecommendation = function() {
    const need = Math.max(0, 300 - adminFeedData.currentStock);
    const cost = need * adminFeedData.pricePerKg;
    
    Swal.fire({
        title: '🛒 Rekomendasi Pembelian Pakan',
        html: `
            <div style="text-align: left; font-size: 0.9rem;">
                <p>Untuk mencapai stok optimal <strong>300 Kg</strong>, Anda disarankan membeli:</p>
                <div style="background:#d1fae5; padding:15px; border-radius:10px; text-align:center; margin:15px 0;">
                    <h2 style="color:#065f46; margin:0;">${need.toLocaleString('id-ID')} Kg</h2>
                    <p style="margin:5px 0 0 0; font-weight:700;">Estimasi Biaya: Rp ${cost.toLocaleString('id-ID')}</p>
                </div>
                <p style="font-size:0.8rem; color:#64748b;">*Harga estimasi Rp 5.000/Kg</p>
            </div>`,
        confirmButtonText: 'Kelola di Modul Stok',
        showCancelButton: true,
        cancelButtonText: 'Tutup',
        confirmButtonColor: '#10b981'
    }).then(r => { if (r.isConfirmed) window.location.href = '../../stokpakan.html'; });
};

window.openFeedAlertSettings = function() {
    Swal.fire({
        title: '⚙️ Pengaturan Alert Stok',
        text: 'Fitur pengaturan threshold notifikasi khusus sedang dalam tahap pengembangan.',
        icon: 'info',
        confirmButtonText: 'Dimengerti'
    });
};

window.dismissAdminFeedAlert = () => {
    const el = document.getElementById('admin-feed-alerts');
    if (el) el.style.display = 'none';
};

window.quickActionStokPakan = () => { window.location.href = '../../stokpakan.html'; };

/**
 * ---------------------------------------------------------
 * I. Section 4: Tabel Manajemen Pengguna
 * ---------------------------------------------------------
 */

window.openCreateAccountModal = function() {
    Swal.fire({
        title: 'Registrasi Identitas Baru',
        html: `
            <div class="swal-libas-container" style="text-align:left;">
                <div style="margin-bottom:15px; font-size:0.85rem; background:#f0f9ff; padding:10px; border-radius:8px; color:#0369a1;">
                    ℹ️ Email harus aktif dan valid untuk proses reset password.
                </div>
                <div class="swal-libas-field">
                    <label style="font-weight:600; font-size:0.85rem; display:block; margin-bottom:5px;">👤 Nama Lengkap</label>
                    <input id="swal-fullname" class="swal-libas-input" style="width:100%; padding:10px; border-radius:8px; border:1px solid #e2e8f0;" placeholder="Masukkan nama terang">
                </div>
                <div class="swal-libas-field" style="margin-top:10px;">
                    <label style="font-weight:600; font-size:0.85rem; display:block; margin-bottom:5px;">🆔 Username</label>
                    <input id="swal-username" class="swal-libas-input" style="width:100%; padding:10px; border-radius:8px; border:1px solid #e2e8f0;" placeholder="username_pilihan">
                </div>
                <div class="swal-libas-field" style="margin-top:10px;">
                    <label style="font-weight:600; font-size:0.85rem; display:block; margin-bottom:5px;">📧 Email Peternakan</label>
                    <input id="swal-email" type="email" class="swal-libas-input" style="width:100%; padding:10px; border-radius:8px; border:1px solid #e2e8f0;" placeholder="user@peternakan.com">
                </div>
                <div class="swal-libas-field" style="margin-top:10px;">
                    <label style="font-weight:600; font-size:0.85rem; display:block; margin-bottom:5px;">🔑 Password Akses</label>
                    <input id="swal-password" type="password" class="swal-libas-input" style="width:100%; padding:10px; border-radius:8px; border:1px solid #e2e8f0;" placeholder="Minimal 6 karakter">
                </div>
                <div class="swal-libas-field" style="margin-top:10px;">
                    <label style="font-weight:600; font-size:0.85rem; display:block; margin-bottom:5px;">🛡️ Hak Akses (Role)</label>
                    <select id="swal-role" class="swal-libas-input" style="width:100%; padding:10px; border-radius:8px; border:1px solid #e2e8f0; background:white;">
                        <option value="user">User / Staff Operasional</option>
                        <option value="admin">Administrator Otoritas</option>
                    </select>
                </div>
            </div>`,
        showCancelButton: true,
        confirmButtonText: 'Daftarkan Akun',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#10b981',
        preConfirm: () => {
            const fullname = document.getElementById('swal-fullname').value;
            const username = document.getElementById('swal-username').value;
            const email = document.getElementById('swal-email').value;
            const password = document.getElementById('swal-password').value;
            const role = document.getElementById('swal-role').value;
            if (!fullname || !username || !email || !password) { Swal.showValidationMessage('Seluruh kolom wajib diisi!'); return false; }
            if (password.length < 6) { Swal.showValidationMessage('Password minimal 6 karakter!'); return false; }
            return { fullname, username, email, password, role };
        }
    }).then(res => { if (res.isConfirmed) createNewUser(res.value); });
};

async function createNewUser(userData) {
    const { fullname, username, email, password, role } = userData;
    Swal.fire({ title: 'Menghubungkan Firebase...', text: 'Sedang mendaftarkan identitas baru.', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    
    try {
        const existingApps = getApps();
        const tempApp = existingApps.find(a => a.name === "SecondaryReg") || initializeApp(firebaseConfig, "SecondaryReg");
        const tempAuth = getAuth(tempApp);
        
        // Cek username unik
        const usernameCheck = await getDocs(query(collection(db, "user"), where("username", "==", username)));
        if (!usernameCheck.empty) throw new Error("Username sudah terpakai oleh akun lain.");

        const cred = await createUserWithEmailAndPassword(tempAuth, email, password);
        const uid = cred.user.uid;

        // Simpan ke Firestore User
        await setDoc(doc(db, "user", uid), { fullname, username, email, role, createdAt: serverTimestamp(), disabled: false });
        
        // Jika Admin, tambahkan ke koleksi admin
        if (role === 'admin') {
            await setDoc(doc(db, "admin", uid), { uid, fullname, username, email, role: 'admin', promotedAt: serverTimestamp(), type: 'auth_entry', createdBy: currentAdminData?.username || 'Admin' });
        }

        await tempAuth.signOut();
        Swal.fire('Pendaftaran Sukses', `Akun ${fullname} (@${username}) telah berhasil dibuat.`, 'success');
        logActivity(currentAdminData?.username || "Admin", "User Management", `Membuat akun baru: ${username} (${role})`);
    } catch (e) {
        console.error(e);
        let msg = e.message;
        if (e.code === 'auth/email-already-in-use') msg = "Email sudah terdaftar!";
        Swal.fire('Gagal Registrasi', msg, 'error');
    }
}

window.openEditUserModal = async function(uid) {
    Swal.fire({ title: 'Memuat Identitas...', didOpen: () => Swal.showLoading() });
    try {
        const snap = await getDoc(doc(db, "user", uid));
        if (!snap.exists()) throw new Error("User tidak ditemukan.");
        const user = snap.data();
        
        Swal.fire({
            title: 'Edit Profil Pengguna',
            html: `
                <div style="text-align:left; font-size:0.9rem;">
                    <div style="margin-bottom:12px;">
                        <label style="font-weight:600; display:block; margin-bottom:4px;">Nama Lengkap</label>
                        <input id="edit-fullname" style="width:100%; padding:8px; border-radius:6px; border:1px solid #ddd;" value="${user.fullname || ''}">
                    </div>
                    <div style="margin-bottom:12px;">
                        <label style="font-weight:600; display:block; margin-bottom:4px;">Username</label>
                        <input id="edit-username" style="width:100%; padding:8px; border-radius:6px; border:1px solid #ddd;" value="${user.username || ''}">
                    </div>
                    <div style="margin-bottom:12px;">
                        <label style="font-weight:600; display:block; margin-bottom:4px;">Status Akun</label>
                        <select id="edit-disabled" style="width:100%; padding:8px; border-radius:6px; border:1px solid #ddd; background:white;">
                            <option value="false" ${!user.disabled ? 'selected' : ''}>Aktif (Normal)</option>
                            <option value="true" ${user.disabled ? 'selected' : ''}>Nonaktif (Terblokir)</option>
                        </select>
                    </div>
                    <div style="border-top:1px solid #eee; padding-top:15px; margin-top:15px; text-align:center;">
                        <button type="button" onclick="sendResetEmail('${user.email}')" style="background:#fef2f2; color:#ef4444; border:1px solid #fee2e2; padding:8px 15px; border-radius:8px; font-size:0.8rem; cursor:pointer; font-weight:600;">📧 Kirim Reset Password</button>
                    </div>
                </div>`,
            showCancelButton: true,
            confirmButtonText: 'Simpan Perubahan',
            confirmButtonColor: '#10b981',
            preConfirm: () => ({
                fullname: document.getElementById('edit-fullname').value,
                username: document.getElementById('edit-username').value,
                disabled: document.getElementById('edit-disabled').value === 'true'
            })
        }).then(async (res) => {
            if (res.isConfirmed) {
                Swal.fire({ title: 'Menyimpan...', didOpen: () => Swal.showLoading() });
                await updateDoc(doc(db, "user", uid), { ...res.value, updatedAt: serverTimestamp() });
                if (user.role === 'admin') {
                    await updateDoc(doc(db, "admin", uid), { fullname: res.value.fullname, username: res.value.username });
                }
                Swal.fire('Sukses', 'Informasi akun telah diperbarui.', 'success');
                logActivity(currentAdminData?.username || "Admin", "User Management", `Update profil user: ${user.username}`);
            }
        });
    } catch (e) { Swal.fire('Error', e.message, 'error'); }
};

window.toggleAdminRole = async function(uid, currentRole) {
    const isNowAdmin = (currentRole || '').toLowerCase().includes('admin');
    const newRole = isNowAdmin ? 'user' : 'admin';
    const actionName = newRole === 'admin' ? 'PROMOSI KE ADMIN' : 'TURUNKAN KE PEKERJA';
    
    const confirm = await Swal.fire({
        title: 'Ubah Hak Akses?',
        text: `Apakah Anda yakin ingin melakukan ${actionName} pada akun ini?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#6366f1',
        confirmButtonText: 'Ya, Update Otoritas'
    });

    if (confirm.isConfirmed) {
        Swal.fire({ title: 'Memproses...', didOpen: () => Swal.showLoading() });
        try {
            await updateDoc(doc(db, "user", uid), { role: newRole, updatedAt: serverTimestamp() });
            if (newRole === 'admin') {
                const u = (await getDoc(doc(db, "user", uid))).data();
                await setDoc(doc(db, "admin", uid), { uid, fullname: u.fullname, username: u.username, email: u.email, role: 'admin', promotedAt: serverTimestamp(), promotedBy: currentAdminData?.username || 'Admin' });
            } else {
                await deleteDoc(doc(db, "admin", uid));
            }
            Swal.fire('Berhasil', `Hak akses telah diubah menjadi ${newRole.toUpperCase()}.`, 'success');
            logActivity(currentAdminData?.username || "Admin", "User Management", `Ubah role user ${uid} ke ${newRole}`);
        } catch (e) { Swal.fire('Error', e.message, 'error'); }
    }
};

window.deleteUserAccount = async function(uid, name) {
    const confirm = await Swal.fire({
        title: 'Hapus Akun Permanen?',
        html: `Akun <strong>${name}</strong> akan dihapus dari sistem dan tidak akan bisa login lagi.`,
        icon: 'error',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Ya, Hapus Selamanya'
    });
    
    if (confirm.isConfirmed) {
        Swal.fire({ title: 'Menghapus...', didOpen: () => Swal.showLoading() });
        try {
            await deleteDoc(doc(db, "user", uid));
            try { await deleteDoc(doc(db, "admin", uid)); } catch(e) {}
            Swal.fire('Akun Terhapus', 'Semua data akses pengguna telah dibersihkan.', 'success');
            logActivity(currentAdminData?.username || "Admin", "User Management", `Hapus user secara permanen: ${name}`);
        } catch (e) { Swal.fire('Error', e.message, 'error'); }
    }
};

window.syncAdminAccounts = async function() {
    Swal.fire({ title: 'Menganalisis Konsistensi...', text: 'Memeriksa sinkronisasi antar koleksi otoritas.', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
        const adminSnap = await getDocs(collection(db, "admin"));
        let fixed = 0;
        for (const aDoc of adminSnap.docs) {
            const uRef = doc(db, "user", aDoc.id);
            const uSnap = await getDoc(uRef);
            if (!uSnap.exists()) {
                const a = aDoc.data();
                await setDoc(uRef, { fullname: a.fullname || 'Admin', username: a.username || 'admin', email: a.email, role: 'admin', disabled: false, createdAt: serverTimestamp() });
                fixed++;
            }
        }
        Swal.fire('Selesai', fixed > 0 ? `${fixed} entri akun berhasil dipulihkan.` : 'Seluruh data otoritas sudah sinkron.', 'success');
    } catch (e) { Swal.fire('Error Sinkronisasi', e.message, 'error'); }
};

/**
 * ---------------------------------------------------------
 * J. Section 5: Ringkasan Data Peternakan Ayam (Snapshot Tabs)
 * ---------------------------------------------------------
 */

window.openAyamDetail = function(id) {
    const a = ayamData.find(x => x.id === id);
    if (!a) return;
    
    Swal.fire({
        title: `📦 Detail Batch ${a.customId || id.slice(0,8)}`,
        html: `
            <div style="text-align:left; font-size:0.9rem;">
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:15px;">
                    <div><label style="font-weight:600; font-size:0.75rem; color:#64748b;">Jenis Ayam</label><input id="ea-jenis" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:6px;" value="${a.jenis || ''}"></div>
                    <div><label style="font-weight:600; font-size:0.75rem; color:#64748b;">Sisa Populasi</label><input id="ea-sisa" type="number" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:6px;" value="${a.sisaAyam || 0}"></div>
                    <div><label style="font-weight:600; font-size:0.75rem; color:#64748b;">Kandang</label><input id="ea-kandang" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:6px;" value="${a.kandang || ''}"></div>
                    <div><label style="font-weight:600; font-size:0.75rem; color:#64748b;">Status</label>
                        <select id="ea-status" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:6px; background:white;">
                            <option value="Aktif" ${a.status==='Aktif'?'selected':''}>Aktif</option>
                            <option value="Panen" ${a.status==='Panen'?'selected':''}>Panen</option>
                            <option value="Afkir" ${a.status==='Afkir'?'selected':''}>Afkir</option>
                        </select>
                    </div>
                </div>
                <p style="font-size:0.75rem; color:#94a3b8;">UID: <code>${id}</code></p>
            </div>`,
        showDenyButton: true,
        confirmButtonText: 'Update Data',
        denyButtonText: 'Hapus Batch',
        confirmButtonColor: '#10b981',
        denyButtonColor: '#ef4444',
        preConfirm: () => ({
            jenis: document.getElementById('ea-jenis').value,
            sisaAyam: parseInt(document.getElementById('ea-sisa').value) || 0,
            kandang: document.getElementById('ea-kandang').value,
            status: document.getElementById('ea-status').value
        })
    }).then(async (res) => {
        if (res.isConfirmed) {
            await updateDoc(doc(db, "populasi_ayam", id), { ...res.value, updatedAt: serverTimestamp() });
            Swal.fire('Berhasil Update', '', 'success');
            logActivity(currentAdminData?.username || "Admin", "Data Ayam", `Update batch: ${a.customId || id}`);
        } else if (res.isDenied) {
            const c = await Swal.fire({ title: 'Hapus Batch?', text: 'Data populasi batch ini akan hilang permanen!', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444' });
            if (c.isConfirmed) { await deleteDoc(doc(db, "populasi_ayam", id)); Swal.fire('Dihapus', '', 'success'); }
        }
    });
};

window.openKeuanganDetail = function(id) {
    const t = keuanganDataAdmin.find(x => x.id === id);
    if (!t) return;
    
    Swal.fire({
        title: '💵 Edit Transaksi',
        html: `
            <div style="text-align:left; font-size:0.9rem;">
                <div style="margin-bottom:12px;"><label style="font-weight:600;">Deskripsi</label><input id="ek-desc" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:6px;" value="${t.deskripsi || ''}"></div>
                <div style="margin-bottom:12px;"><label style="font-weight:600;">Jumlah (Rp)</label><input id="ek-val" type="number" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:6px;" value="${t.jumlah || 0}"></div>
                <div style="margin-bottom:12px;"><label style="font-weight:600;">Tipe</label>
                    <select id="ek-type" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:6px; background:white;">
                        <option value="pemasukan" ${t.tipe==='pemasukan'?'selected':''}>Pemasukan</option>
                        <option value="pengeluaran" ${t.tipe==='pengeluaran'?'selected':''}>Pengeluaran</option>
                    </select>
                </div>
            </div>`,
        showDenyButton: true,
        confirmButtonText: 'Update',
        denyButtonText: 'Hapus',
        confirmButtonColor: '#3b82f6',
        preConfirm: () => ({
            deskripsi: document.getElementById('ek-desc').value,
            jumlah: parseFloat(document.getElementById('ek-val').value) || 0,
            tipe: document.getElementById('ek-type').value
        })
    }).then(async (res) => {
        if (res.isConfirmed) {
            await updateDoc(doc(db, "keuangan", id), { ...res.value, updatedAt: serverTimestamp() });
            Swal.fire('Tersimpan', '', 'success');
            logActivity(currentAdminData?.username || "Admin", "Keuangan", `Update transaksi: ${res.value.deskripsi}`);
        } else if (res.isDenied) {
            const c = await Swal.fire({ title: 'Hapus Transaksi?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444' });
            if (c.isConfirmed) { await deleteDoc(doc(db, "keuangan", id)); Swal.fire('Dihapus', '', 'success'); }
        }
    });
};

window.openProduksiDetail = function(id) {
    const p = produksiDataAdmin.find(x => x.id === id);
    if (!p) return;
    
    Swal.fire({
        title: '🥚 Koreksi Produksi',
        html: `
            <div style="text-align:left; font-size:0.9rem;">
                <p>Tanggal: <strong>${p.tanggal}</strong></p>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                    <div><label style="font-weight:600;">Telur Baik</label><input id="ep-baik" type="number" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:6px;" value="${p.telurBaik || 0}"></div>
                    <div><label style="font-weight:600;">Telur Cacat</label><input id="ep-cacat" type="number" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:6px;" value="${p.telurCacat || 0}"></div>
                </div>
            </div>`,
        showDenyButton: true,
        confirmButtonText: 'Simpan',
        denyButtonText: 'Hapus',
        confirmButtonColor: '#fb8500',
        preConfirm: () => {
            const b = parseInt(document.getElementById('ep-baik').value) || 0;
            const c = parseInt(document.getElementById('ep-cacat').value) || 0;
            return { telurBaik: b, telurCacat: c, totalTelur: b + c };
        }
    }).then(async (res) => {
        if (res.isConfirmed) {
            await updateDoc(doc(db, "produksi_harian", id), { ...res.value, updatedAt: serverTimestamp() });
            Swal.fire('Tersimpan', '', 'success');
            logActivity(currentAdminData?.username || "Admin", "Produksi", `Update data produksi tgl ${p.tanggal}`);
        } else if (res.isDenied) {
            if ((await Swal.fire({title:'Hapus Data Produksi?', icon:'warning', showCancelButton:true})).isConfirmed) { await deleteDoc(doc(db, "produksi_harian", id)); Swal.fire('Dihapus', '', 'success'); }
        }
    });
};

window.openPakanDetail = function(id) {
    const p = pakanDataAdmin.find(x => x.id === id);
    if (!p) return;
    
    Swal.fire({
        title: '🥬 Koreksi Stok Pakan',
        html: `
            <div style="text-align:left; font-size:0.9rem;">
                <div style="margin-bottom:12px;"><label style="font-weight:600;">Nama Barang</label><input id="ep-item" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:6px;" value="${p.namaBarang || ''}"></div>
                <div style="margin-bottom:12px;"><label style="font-weight:600;">Jumlah (Kg)</label><input id="ep-val" type="number" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:6px;" value="${p.jumlah || 0}"></div>
                <div style="margin-bottom:12px;"><label style="font-weight:600;">Tipe</label>
                    <select id="ep-type" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:6px; background:white;">
                        <option value="Masuk" ${p.tipe==='Masuk'?'selected':''}>Masuk</option>
                        <option value="Keluar" ${p.tipe==='Keluar'?'selected':''}>Keluar</option>
                    </select>
                </div>
            </div>`,
        showDenyButton: true,
        confirmButtonText: 'Update',
        denyButtonText: 'Hapus',
        confirmButtonColor: '#6366f1',
        preConfirm: () => ({
            namaBarang: document.getElementById('ep-item').value,
            jumlah: parseFloat(document.getElementById('ep-val').value) || 0,
            tipe: document.getElementById('ep-type').value
        })
    }).then(async (res) => {
        if (res.isConfirmed) {
            await updateDoc(doc(db, "stok_pakan", id), { ...res.value, updatedAt: serverTimestamp() });
            Swal.fire('Tersimpan', '', 'success');
            logActivity(currentAdminData?.username || "Admin", "Stok Pakan", `Update log pakan: ${res.value.namaBarang}`);
        } else if (res.isDenied) {
            if ((await Swal.fire({title:'Hapus Riwayat Pakan?', icon:'warning', showCancelButton:true})).isConfirmed) { await deleteDoc(doc(db, "stok_pakan", id)); Swal.fire('Dihapus', '', 'success'); }
        }
    });
};

window.openKesehatanDetail = function(id) {
    const h = kesehatanDataAdmin.find(x => x.id === id);
    if (!h) return;
    
    Swal.fire({
        title: '🩺 Edit Laporan Kesehatan',
        html: `
            <div style="text-align:left; font-size:0.9rem;">
                <div style="margin-bottom:12px;"><label style="font-weight:600;">Jumlah Mati (Ekor)</label><input id="eh-mati" type="number" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:6px;" value="${h.jmlMati || 0}"></div>
                <div style="margin-bottom:12px;"><label style="font-weight:600;">Penyebab/Gejala</label><input id="eh-why" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:6px;" value="${h.sebab || ''}"></div>
            </div>`,
        showDenyButton: true,
        confirmButtonText: 'Update',
        denyButtonText: 'Hapus',
        confirmButtonColor: '#ef4444',
        preConfirm: () => ({
            jmlMati: parseInt(document.getElementById('eh-mati').value) || 0,
            sebab: document.getElementById('eh-why').value
        })
    }).then(async (res) => {
        if (res.isConfirmed) {
            await updateDoc(doc(db, "kesehatan_ayam", id), { ...res.value, updatedAt: serverTimestamp() });
            Swal.fire('Terupdate', '', 'success');
            logActivity(currentAdminData?.username || "Admin", "Kesehatan", `Update laporan kesehatan batch ${h.batchName}`);
        } else if (res.isDenied) {
            if ((await Swal.fire({title:'Hapus Laporan Kesehatan?', icon:'warning', showCancelButton:true})).isConfirmed) { await deleteDoc(doc(db, "kesehatan_ayam", id)); Swal.fire('Dihapus', '', 'success'); }
        }
    });
};

window.openVaksinDetail = function(id) {
    const v = vaksinDataAdmin.find(x => x.id === id);
    if (!v) return;
    
    Swal.fire({
        title: '💉 Edit Jadwal Vaksin',
        html: `
            <div style="text-align:left; font-size:0.9rem;">
                <div style="margin-bottom:12px;"><label style="font-weight:600;">Nama Vaksin</label><input id="ev-name" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:6px;" value="${v.namaVaksin || ''}"></div>
                <div style="margin-bottom:12px;"><label style="font-weight:600;">Status</label>
                    <select id="ev-status" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:6px; background:white;">
                        <option value="Terjadwal" ${v.status==='Terjadwal'?'selected':''}>Terjadwal</option>
                        <option value="Selesai" ${v.status==='Selesai'?'selected':''}>Selesai</option>
                    </select>
                </div>
            </div>`,
        showDenyButton: true,
        confirmButtonText: 'Update',
        denyButtonText: 'Hapus',
        confirmButtonColor: '#8b5cf6',
        preConfirm: () => ({
            namaVaksin: document.getElementById('ev-name').value,
            status: document.getElementById('ev-status').value
        })
    }).then(async (res) => {
        if (res.isConfirmed) {
            await updateDoc(doc(db, "vaksinasi_ayam", id), { ...res.value, updatedAt: serverTimestamp() });
            Swal.fire('Jadwal Diperbarui', '', 'success');
            logActivity(currentAdminData?.username || "Admin", "Vaksin", `Update jadwal vaksin: ${res.value.namaVaksin}`);
        } else if (res.isDenied) {
            if ((await Swal.fire({title:'Hapus Jadwal Vaksin?', icon:'warning', showCancelButton:true})).isConfirmed) { await deleteDoc(doc(db, "vaksinasi_ayam", id)); Swal.fire('Dihapus', '', 'success'); }
        }
    });
};

window.openPrediksiDetail = async function(prediksiId) {
    try {
        const docSnap = await getDoc(doc(db, "prediksi_history", prediksiId));
        if (!docSnap.exists()) throw new Error("Data tidak ditemukan.");
        const data = docSnap.data();
        
        const dateStr = data.tanggal ? new Date(data.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
        
        Swal.fire({
            title: '🔮 Detail Analisis Prediksi',
            html: `
                <div style="text-align: left; max-height: 70vh; overflow-y: auto; font-size:0.9rem;">
                    <div style="background:#f8fafc; padding:12px; border-radius:10px; margin-bottom:15px; border-left:4px solid #3b82f6;">
                        <p style="margin:0; color:#64748b; font-size:0.8rem;">📅 Waktu Analisis</p>
                        <p style="margin:2px 0 0 0; font-weight:700;">${dateStr}</p>
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:15px;">
                        <div style="background:#eff6ff; padding:10px; border-radius:8px;">
                            <p style="margin:0; font-size:0.75rem; color:#3b82f6;">🥚 Prediksi Produksi</p>
                            <p style="margin:2px 0 0 0; font-weight:700; font-size:1.1rem;">${(data.prediksiBesokButir || 0).toLocaleString('id-ID')} Btr</p>
                        </div>
                        <div style="background:#ecfdf5; padding:10px; border-radius:8px;">
                            <p style="margin:0; font-size:0.75rem; color:#10b981;">💰 Proyeksi Laba</p>
                            <p style="margin:2px 0 0 0; font-weight:700; font-size:1.1rem; color:#10b981;">Rp ${(data.keuntungan || 0).toLocaleString('id-ID')}</p>
                        </div>
                    </div>
                    <div style="background:#fff7ed; padding:10px; border-radius:8px; margin-bottom:15px;">
                        <p style="margin:0; font-size:0.75rem; color:#f59e0b;">📊 Parameter MA</p>
                        <p style="margin:2px 0 0 0; font-weight:600;">Periode: ${data.periodeMA} Hari | Populasi: ${data.populasi.toLocaleString('id-ID')} Ekor</p>
                    </div>
                </div>`,
            width: '500px',
            confirmButtonText: 'Tutup',
            confirmButtonColor: '#3b82f6'
        });
    } catch (e) { Swal.fire('Error', e.message, 'error'); }
};

/**
 * ---------------------------------------------------------
 * K. Section 6: Manajemen Operasional
 * ---------------------------------------------------------
 */

document.getElementById('adminAddActivityForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('adminActivityInput');
    if (!input || !input.value.trim()) return;
    
    try {
        await addDoc(collection(db, "daily_activities"), {
            text: input.value.trim(),
            completed: false,
            createdAt: serverTimestamp()
        });
        input.value = "";
    } catch (err) { console.error(err); }
});

document.getElementById('adminAddAnnouncementForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('adminAnnouncementInput');
    if (!input || !input.value.trim()) return;
    
    try {
        await addDoc(collection(db, "announcements"), {
            text: input.value.trim(),
            createdAt: Date.now(),
            createdByAdmin: currentAdminData?.username || 'Admin',
            confirmedBy: []
        });
        input.value = "";
    } catch (err) { console.error(err); }
});

document.getElementById('adminAddScheduleForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const tgl = document.getElementById('adminTgl').value;
    const waktu = document.getElementById('adminWaktu').value;
    const agenda = document.getElementById('adminAgenda').value;
    const tempat = document.getElementById('adminTempat').value;
    
    if (!tgl || !waktu || !agenda || !tempat) { Swal.fire('Data Belum Lengkap', 'Silakan isi seluruh kolom agenda.', 'warning'); return; }
    
    try {
        await addDoc(collection(db, "schedules"), {
            tanggal: tgl,
            waktu: waktu,
            agenda: agenda,
            ruangan: tempat,
            createdAt: serverTimestamp()
        });
        e.target.reset();
        Swal.fire({ icon:'success', title:'Agenda Disimpan', timer:1200, showConfirmButton:false });
    } catch (err) { console.error(err); }
});

window.toggleAdminActivity = async (id, status) => { await updateDoc(doc(db, "daily_activities", id), { completed: !status }); };
window.deleteAdminActivity = async (id) => { if ((await Swal.fire({title:'Hapus Aktivitas?', icon:'warning', showCancelButton:true, confirmButtonColor:'#ef4444'})).isConfirmed) await deleteDoc(doc(db, "daily_activities", id)); };
window.deleteAdminAnnouncement = async (id) => { if ((await Swal.fire({title:'Hapus Pengumuman?', icon:'warning', showCancelButton:true, confirmButtonColor:'#ef4444'})).isConfirmed) await deleteDoc(doc(db, "announcements", id)); };
window.deleteAdminSchedule = async (id) => { if ((await Swal.fire({title:'Hapus Agenda?', icon:'warning', showCancelButton:true, confirmButtonColor:'#ef4444'})).isConfirmed) await deleteDoc(doc(db, "schedules", id)); };

/**
 * ---------------------------------------------------------
 * L. Section 7: Audit Log Aktivitas
 * ---------------------------------------------------------
 */

window.clearLogs = async function() {
    if (!currentAdminData || currentAdminData.type !== 'super_admin') {
        Swal.fire('Akses Ditolak', 'Hanya Super Administrator yang dapat membersihkan log sistem.', 'error');
        return;
    }

    const { value: confirmText } = await Swal.fire({
        title: 'Hapus Seluruh Log?',
        html: '<p>Tindakan ini permanen. Ketik <strong>HAPUS</strong> untuk melanjutkan:</p>',
        input: 'text',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        inputValidator: (val) => { if (val !== 'HAPUS') return 'Ketik HAPUS dengan benar!'; }
    });

    if (confirmText === 'HAPUS') {
        Swal.fire({ title: 'Membersihkan Log...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        try {
            const snap = await getDocs(collection(db, "activity_log"));
            const batch = snap.docs.map(d => deleteDoc(doc(db, "activity_log", d.id)));
            await Promise.all(batch);
            Swal.fire('Sukses', 'Riwayat log telah dikosongkan.', 'success');
            logActivity("Super Admin", "Sistem", "Pembersihan total riwayat log aktivitas database.");
        } catch (e) { Swal.fire('Error', e.message, 'error'); }
    }
};

// =========================================================
// 6. UTILITY FUNCTIONS
// =========================================================

export async function logActivity(user, modul, aksi) {
    try {
        await addDoc(collection(db, "activity_log"), {
            user: user,
            modul: modul,
            aksi: aksi,
            waktu: serverTimestamp()
        });
    } catch (err) { console.error("Log error:", err); }
}

window.openSnapshotTab = function(evt, tabName) {
    const panes = document.getElementsByClassName("tab-pane");
    for (let p of panes) { p.style.display = "none"; p.classList.remove("active"); }
    const btns = document.getElementsByClassName("tab-btn");
    for (let b of btns) b.classList.remove("active");
    
    const target = document.getElementById(tabName);
    if (target) { target.style.display = "block"; target.classList.add("active"); }
    if (evt && evt.currentTarget) evt.currentTarget.classList.add("active");
};

window.filterUserList = function() {
    const q = document.getElementById("searchUserInput").value.toLowerCase();
    document.querySelectorAll("#adminUserListBody tr").forEach(r => {
        r.style.display = r.innerText.toLowerCase().includes(q) ? "" : "none";
    });
};

window.filterLogList = function() {
    const q = document.getElementById("searchLogInput").value.toLowerCase();
    document.querySelectorAll("#systemLogBody tr").forEach(r => {
        r.style.display = r.innerText.toLowerCase().includes(q) ? "" : "none";
    });
};

window.sendResetEmail = async (email) => {
    const c = await Swal.fire({ title: 'Kirim Email Reset?', text: `Tautan reset password akan dikirim ke ${email}`, icon: 'info', showCancelButton: true });
    if (c.isConfirmed) {
        try {
            await sendPasswordResetEmail(auth, email);
            Swal.fire('Email Terkirim', 'Silakan cek kotak masuk email tersebut.', 'success');
        } catch (e) { Swal.fire('Error', e.message, 'error'); }
    }
};



console.log("🛡️ LIBAS Admin Panel System Core Fully Restored & Reorganized.");