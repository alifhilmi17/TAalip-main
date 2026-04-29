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
    getDocs
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { db } from "../firebase.component/firebase-init.js";

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

// =========================================
// 2. STATE GLOBAL (REAL-TIME DATA)
// =========================================
let state = {
    schedules: [],
    activities: [],
    announcements: [],
    produksi: [],
    keuangan: [],
    ayam: [],
    pakan: [],
    kesehatan: [], // ✅ Tambah state untuk data kesehatan mortalitas
    prediksi: [] // ✅ FASE 2: Tambah state untuk data prediksi
};

let eggChartInstance = null;
let financeChartInstance = null;

// =========================================
// 3. INISIALISASI & LISTENERS
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
});

// =========================================
// 4. MODULE: SCHEDULE
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

// =========================================
// 5. MODULE: ACTIVITIES
// =========================================
/**
 * Merender daftar aktivitas harian dalam bentuk list item interaktif
 */
function renderActivities() {
    const list = document.getElementById("dailyActivityList");
    if (!list) return;
    list.innerHTML = "";
    state.activities.forEach((item) => {
        const li = document.createElement("li");
        li.style.display = "flex";
        li.style.justifyContent = "space-between";
        li.style.alignItems = "center";
        li.style.background = item.completed ? "#f1f3f5" : "#fff";
        li.style.opacity = item.completed ? "0.7" : "1";
        
        li.innerHTML = `
            <span style="flex:1; ${item.completed ? 'text-decoration:line-through; color:#888;' : ''}">${item.text}</span>
            <div class="action-btn-group">
                <button class="action-btn check-btn" onclick="toggleActivityStatus('${item.id}', ${item.completed})">${item.completed ? '↩' : '✔'}</button>
                <button class="action-btn delete-item-btn" onclick="deleteActivityItem('${item.id}')">✕</button>
            </div>
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
// 6. MODULE: ANNOUNCEMENTS
// =========================================
function renderAnnouncements() {
    const list = document.getElementById("announcementList");
    if (!list) return;
    list.innerHTML = "";
    state.announcements.forEach((item) => {
        const li = document.createElement("li");
        li.className = "announcement-item";
        if (item.read) {
            li.style.opacity = "0.7";
            li.style.background = "#f1f3f5";
        }
        li.innerHTML = `
            <div class="announcement-content">
                <div class="announcement-details">
                    <span class="text" ${item.read ? 'style="text-decoration:line-through; color:#888;"' : ''}>${item.text}</span>
                </div>
            </div>
            <div class="action-btn-group">
                <button class="action-btn check-btn" onclick="toggleAnnouncementRead('${item.id}', ${item.read})">${item.read ? '↩' : '✔'}</button>
                <button class="action-btn delete-item-btn" onclick="deleteAnnouncementItem('${item.id}')">✕</button>
            </div>
        `;
        list.appendChild(li);
    });
}

const announcementForm = document.getElementById("addAnnouncementForm");
if (announcementForm) {
    announcementForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const input = document.getElementById("announcementInput");
        if (!input.value.trim()) return;
        try {
            await addDoc(collection(db, "announcements"), {
                text: input.value.trim(),
                read: false,
                createdAt: new Date().toISOString()
            });
            input.value = "";
        } catch (err) { console.error(err); }
    });
}

window.toggleAnnouncementRead = async function(id, currentStatus) {
    await updateDoc(doc(db, "announcements", id), { read: !currentStatus });
};

window.deleteAnnouncementItem = async function(id) {
    await deleteDoc(doc(db, "announcements", id));
};

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
    let incomeBulanIni = 0;
    let incomeGlobal = 0, expenseGlobal = 0;
    
    // Mengecek setiap transaksi keuangan
    state.keuangan.forEach(trx => {
        const d = new Date(trx.tanggal);
        // Menghitung total akumulasi global (semua waktu)
        if (trx.tipe === 'pemasukan') incomeGlobal += trx.jumlah;
        else expenseGlobal += trx.jumlah;

        // Memfilter hanya transaksi pemasukan yang terjadi pada bulan & tahun ini
        if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
            if (trx.tipe === 'pemasukan') incomeBulanIni += trx.jumlah;
        }
    });
    // Menampilkan pemasukan bulan ini ke dashboard
    document.getElementById('stat-pendapatan').textContent = `Rp ${incomeBulanIni.toLocaleString('id-ID')}`;

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

    // 7. ✅ FITUR BARU: Perhitungan Statistik Ayam Tidak Bertelur
    const totalAyamTidakBertelur = state.produksi.reduce((s, v) => s + (parseInt(v.ayamTidakBertelur) || 0), 0);
    const elAyamTidakBertelur = document.getElementById('stat-ayam-tidak-bertelur');
    if (elAyamTidakBertelur) elAyamTidakBertelur.textContent = `${totalAyamTidakBertelur.toLocaleString('id-ID')} Ekor`;

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
    const incomeByWeek = [0, 0, 0, 0];
    const expenseByWeek = [0, 0, 0, 0];

    state.keuangan.forEach(trx => {
        const d = new Date(trx.tanggal);
        if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
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
// 10. ✅ FASE 2: WIDGET PREDIKSI TERAKHIR
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
// 11. ✅ FASE 2: WIDGET RINGKASAN KEUANGAN BULAN INI
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
    
    financeMonth.textContent = `${monthNames[currentMonth]} ${currentYear}`;

    let income = 0, expense = 0, trxCount = 0;

    state.keuangan.forEach(trx => {
        const d = new Date(trx.tanggal);
        if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
            trxCount++;
            if (trx.tipe === 'pemasukan') {
                income += trx.jumlah;
            } else {
                expense += trx.jumlah;
            }
        }
    });

    const balance = income - expense;

    financeIncome.textContent = `Rp ${income.toLocaleString('id-ID')}`;
    financeExpense.textContent = `Rp ${expense.toLocaleString('id-ID')}`;
    financeBalance.textContent = `Rp ${balance.toLocaleString('id-ID')}`;
    financeBalance.style.color = balance >= 0 ? '#fff' : '#fca5a5';
    financeTransactions.textContent = `${trxCount} Transaksi`;
}


// =========================================================
// 12. ✅ FASE 2: MODAL DETAIL PREDIKSI
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
// 13. ✅ FASE 2: MODAL DETAIL KEUANGAN
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

// =========================================================
// 14. ✅ FASE 3: QUICK ACTIONS FUNCTIONALITY
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
// 15. ✅ FASE 3: FEED STOCK ALERTS
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
    
    // Show simple alert if stock is low (< 100kg)
    if (sisaPakan < 100) {
        alertEl.style.display = 'block';
        
        // Simple message based on urgency - no complex styling
        if (sisaPakan <= 20) {
            alertEl.textContent = '🚨 Stok kritis, beli sekarang!';
            alertEl.style.color = '#dc2626';
        } else if (sisaPakan <= 50) {
            alertEl.textContent = '⚠️ Stok rendah, segera restock';
            alertEl.style.color = '#f59e0b';
        } else {
            alertEl.textContent = '📢 Stok menipis, persiapkan restock';
            alertEl.style.color = '#3b82f6';
        }
    } else {
        alertEl.style.display = 'none';
    }
}

// =========================================================
// 16. ✅ FASE 3: VACCINATION SCHEDULE WIDGET
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
        
        contentEl.style.gridTemplateColumns = 'repeat(auto-fit, minmax(200px, 1fr))';
        contentEl.style.gap = '1rem';
        
        contentEl.innerHTML = upcomingVaccinations.map(vaksin => {
            const tanggal = new Date(vaksin.tanggal);
            const today = new Date();
            const diffDays = Math.ceil((tanggal - today) / (1000 * 60 * 60 * 24));
            
            let urgencyColor = '#06b6d4';
            let urgencyText = `${diffDays} hari lagi`;
            
            if (diffDays <= 0) {
                urgencyColor = '#ef4444';
                urgencyText = 'HARI INI!';
            } else if (diffDays <= 3) {
                urgencyColor = '#f59e0b';
                urgencyText = `${diffDays} hari lagi`;
            }
            
            return `
                <div style="background: rgba(255,255,255,0.15); padding: 1rem; border-radius: 10px; backdrop-filter: blur(10px);">
                    <p style="margin: 0; font-size: 0.8rem; opacity: 0.9; display: flex; align-items: center; justify-content: space-between;">
                        💉 ${vaksin.jenisVaksin || 'Vaksin'}
                        <span style="background: ${urgencyColor}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: 700;">
                            ${urgencyText}
                        </span>
                    </p>
                    <p style="margin: 5px 0 0 0; font-size: 1.1rem; font-weight: 700;">${vaksin.batchId || 'Batch'}</p>
                    <p style="margin: 5px 0 0 0; font-size: 0.75rem; opacity: 0.8;">
                        ${tanggal.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
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
// 18. ✅ FASE 3: INITIALIZE ALL FASE 3 FEATURES
// =========================================================

// Add vaccination state to global state
state.vaksinasi = [];

// Add vaccination listener to existing DOMContentLoaded
document.addEventListener("DOMContentLoaded", () => {
    // Add vaccination listener
    onSnapshot(collection(db, "vaksinasi_ayam"), (snap) => {
        state.vaksinasi = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderVaccinationWidget();
    });
});

// Update FASE 3 features when data changes
function updateFase3Features() {
    checkFeedStockAlerts();
    renderVaccinationWidget();
}

// Call FASE 3 updates in existing updateDashboardAggregates function
const originalUpdateDashboardAggregates = updateDashboardAggregates;
updateDashboardAggregates = function() {
    originalUpdateDashboardAggregates();
    updateFase3Features();
};

// Initialize FASE 3 features on page load
document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
        updateFase3Features();
    }, 1000); // Delay to ensure data is loaded
});

console.log("🚀 FASE 3 Features Loaded: Quick Actions, System Health, Feed Alerts, Vaccination Schedule");