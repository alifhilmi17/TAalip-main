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
    kesehatan: [] // ✅ Tambah state untuk data kesehatan mortalitas
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
    // Mengambil tanggal hari ini dengan format YYYY-MM-DD
    const today = new Date().toISOString().split('T')[0];
    
    // 1. Perhitungan Statistik Produksi Telur (Hanya Hari Ini)
    // Menyaring data produksi yang tanggalnya sama dengan hari ini
    const prodToday = state.produksi.filter(p => p.tanggal === today);
    // Menjumlahkan total telur dari hasil saringan tersebut
    const totalTelurToday = prodToday.reduce((s, v) => s + (v.totalTelur || 0), 0);
    // Memperbarui tampilan di UI
    document.getElementById('stat-telur').textContent = `${totalTelurToday.toLocaleString('id-ID')} Butir`;

    // 2. Perhitungan Statistik Populasi Ayam Aktif
    // Menyaring batch ayam yang statusnya masih 'Aktif' dan menjumlahkan sisa ekornya
    const totalAyamAktif = state.ayam.filter(a => a.status === 'Aktif')
                                     .reduce((s, v) => s + (parseInt(v.sisaAyam) || 0), 0);
    document.getElementById('stat-ayam').textContent = `${totalAyamAktif.toLocaleString('id-ID')} Ekor`;

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
    // Menjumlahkan seluruh data kematian (jmlMati) dari log kesehatan
    const totalMortalitas = state.kesehatan.reduce((sum, item) => sum + (parseInt(item.jmlMati) || 0), 0);
    const elMortalitas = document.getElementById('stat-mortalitas');
    if (elMortalitas) elMortalitas.textContent = `${totalMortalitas.toLocaleString('id-ID')} Ekor`;

    // 6. Memperbarui Grafik Analitik Visual
    renderEggChart(7); // Render grafik produksi 7 hari terakhir
    renderFinanceChart(); // Render grafik keuangan bulanan
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