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
    getDoc,
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
    sendPasswordResetEmail,
    getAuth
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { db, auth } from "../../firebase.component/firebase-init.js";

// ===== KONFIGURASI FIREBASE (untuk Secondary Instance) =====
const firebaseConfig = {
    apiKey: "AIzaSyD265EEi0UE9wYNvOWKQ46huxpPTfZOcOE",
    authDomain: "libas-db.firebaseapp.com",
    projectId: "libas-db",
    storageBucket: "libas-db.firebasestorage.app",
    messagingSenderId: "918841790171",
    appId: "1:918841790171:web:04ce25a5727fddbd78c6fe"
};

// Referensi data admin yang sedang login (diisi oleh admin-gate.js via event)
let currentAdminData = null;
window.addEventListener('admin:verified', (e) => {
    currentAdminData = e.detail;
});

// ===== MODULE-LEVEL STATE (untuk Charts & CRUD Snapshot) =====
let ayamData = [];           // Semua data batch ayam
let keuanganDataAdmin = [];  // Semua data transaksi keuangan
let produksiDataAdmin = [];  // Semua data produksi harian
let pakanDataAdmin = [];     // Semua data logistik pakan
let kesehatanDataAdmin = []; // Semua data kesehatan ayam
let vaksinDataAdmin = [];    // Semua data jadwal vaksinasi
let adminEggChartInstance  = null;
let adminFinanceChartInstance = null;
let currentAdminChartPeriod = 7;

// State untuk tracking total sisa ayam dan ayam sakit
let cachedTotalSisaAyam = 0;
let cachedAyamSakit = 0;

/**
 * ===== 1. INISALISASI DASHBOARD =====
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log("Admin Panel Berhasil Dimuat - Koneksi Firebase Aktif.");
    initAdminDashboard();
});

/**
 * Fungsi Utama: Menghubungkan antarmuka pengguna (UI) dengan data real-time dari Firestore.
 * Fungsi ini memantau berbagai koleksi data dan memperbarui tampilan dashboard secara otomatis.
 */
function initAdminDashboard() {
    // =========================================================
    // A. Monitoring Pengguna (Koleksi: user)
    // =========================================================
    // Memantau penambahan, penghapusan, atau perubahan data pengguna.
    onSnapshot(collection(db, "user"), (snapshot) => {
        // Menghitung total jumlah pengguna yang terdaftar
        const userCount = snapshot.size;
        
        // Memperbarui teks pada elemen statistik pengguna di dashboard
        document.getElementById('stat-user').textContent = `${userCount} Orang`;
        
        // Memperbarui badge jumlah pengguna pada bagian manajemen
        const userBadge = document.getElementById('user-count-badge');
        if(userBadge) userBadge.textContent = `${userCount} Pengguna Terverifikasi`;
        
        // Mengambil semua data dokumen pengguna ke dalam bentuk array objek
        const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Memanggil fungsi untuk merender ulang tabel daftar pengguna
        renderUserList(users);
    });

    // =========================================================
    // B. Monitoring Populasi Ayam (Koleksi: populasi_ayam)
    // =========================================================
    // Memantau jumlah ayam secara keseluruhan di peternakan.
    onSnapshot(collection(db, "populasi_ayam"), (snapshot) => {
        let totalSisaAyam = 0; // Variabel untuk menyimpan total sisa ayam
        let totalAfkir = 0; // Total ayam afkir
        let snapshotData = []; // Array untuk menyimpan detail setiap batch ayam
        
        // Melakukan perulangan pada setiap dokumen batch ayam
        snapshot.forEach(doc => {
            const data = doc.data();
            // Menambahkan sisa ayam dari setiap batch ke total keseluruhan
            totalSisaAyam += parseInt(data.sisaAyam || 0);
            if (data.status === 'Afkir') totalAfkir += parseInt(data.sisaAyam || 0);
            snapshotData.push({ id: doc.id, ...data });
        });

        // Menyimpan data ke variabel global agar dapat diakses untuk fungsi CRUD/Edit
        ayamData = snapshotData; 
        
        // Hitung ayam sakit dari data kesehatan (akan diupdate saat listener kesehatan berjalan)
        // Untuk sementara tampilkan total sisa ayam dulu
        updateTotalAyamAktif(totalSisaAyam);
        
        const elAfkir = document.getElementById('stat-admin-afkir');
        if (elAfkir) elAfkir.textContent = `${totalAfkir.toLocaleString('id-ID')} Ekor`;
        
        // Merender tabel ringkasan (hanya mengambil 8 data terbaru)
        renderAyamSnapshot(snapshotData.slice(0, 8));
    });

    // =========================================================
    // C. Monitoring Keuangan (Koleksi: keuangan)
    // =========================================================
    // Memantau arus kas untuk menghitung saldo dan menampilkan riwayat transaksi.
    onSnapshot(collection(db, "keuangan"), (snapshot) => {
        let totalSaldo = 0; // Variabel untuk menyimpan saldo akhir
        let trxData = []; // Array untuk menyimpan data riwayat transaksi
        
        // Menghitung pemasukan dan pengeluaran dari setiap dokumen transaksi
        snapshot.forEach(doc => {
            const data = doc.data();
            const jumlah = parseFloat(data.jumlah || 0);
            
            if (data.tipe === 'pemasukan') {
                totalSaldo += jumlah; // Jika pemasukan, saldo bertambah
            } else {
                totalSaldo -= jumlah; // Jika pengeluaran, saldo berkurang
            }
            trxData.push({ id: doc.id, ...data });
        });

        // Menyimpan data ke variabel global untuk grafik dan fitur edit/detail
        keuanganDataAdmin = trxData; 
        
        // Memperbarui tampilan saldo akhir di dashboard
        document.getElementById('stat-admin-prediksi').textContent = `Rp ${totalSaldo.toLocaleString('id-ID')}`;
        
        // Memperbarui tampilan jumlah total transaksi
        const elUang = document.getElementById('stat-admin-uang');
        if (elUang) elUang.textContent = `${trxData.length.toLocaleString('id-ID')} Transaksi`;
        
        // Mengurutkan transaksi dari yang terbaru dan merender 8 data pertama ke tabel ringkasan
        const latestTrx = trxData.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal)).slice(0, 8);
        renderKeuanganSnapshot(latestTrx);
        
        // Memperbarui ulang grafik keuangan agar sesuai dengan data terbaru
        renderAdminCharts(); 
    });

    // =========================================================
    // D. Monitoring Audit Log (Koleksi: activity_log)
    // =========================================================
    // Mengambil 5 aktivitas terbaru dari sistem untuk ditampilkan di tabel log.
    onSnapshot(query(
        collection(db, "activity_log"), 
        orderBy("waktu", "desc"),  // Mengurutkan berdasarkan waktu terbaru
        limit(5) // Hanya mengambil 5 data teratas
    ), (snapshot) => {
        const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderSystemLogs(logs); // Merender ke tabel audit
    });

    // =========================================================
    // E. Monitoring Batch Aktif (Koleksi: populasi_ayam)
    // =========================================================
    // Menghitung berapa banyak batch ternak yang saat ini masih "Aktif"
    onSnapshot(collection(db, "populasi_ayam"), (snapshot) => {
        // Menyaring data yang memiliki status 'Aktif' dan menghitung jumlahnya
        const batchAktif = snapshot.docs.filter(d => d.data().status === 'Aktif').length;
        const elBatch = document.getElementById('stat-admin-batch');
        if (elBatch) elBatch.textContent = `${batchAktif} Batch`;
    });

    // =========================================================
    // F. Monitoring Produksi Harian (Koleksi: produksi_harian)
    // =========================================================
    // Memantau input produksi telur setiap hari dan memperbarui grafik analitik.
    onSnapshot(collection(db, "produksi_harian"), (snapshot) => {
        // Mengambil semua data produksi ke variabel global
        produksiDataAdmin = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Menentukan tanggal hari ini dengan format YYYY-MM-DD (timezone lokal)
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;
        
        console.log('🔍 DEBUG Admin - Tanggal hari ini:', todayStr);
        console.log('🔍 DEBUG Admin - Total data produksi:', produksiDataAdmin.length);
        
        // Menjumlahkan total telur yang diproduksi khusus untuk hari ini
        const totalTelurHariIni = produksiDataAdmin
            .filter(d => {
                console.log('🔍 DEBUG Admin - Data tanggal:', d.tanggal, 'vs', todayStr, '=', d.tanggal === todayStr);
                return d.tanggal === todayStr;
            })
            .reduce((sum, d) => sum + (parseInt(d.totalTelur) || 0), 0);
        
        console.log('🔍 DEBUG Admin - Total telur hari ini:', totalTelurHariIni);
        
        // Menjumlahkan total telur cacat khusus untuk hari ini
        const totalTelurCacatHariIni = produksiDataAdmin
            .filter(d => d.tanggal === todayStr)
            .reduce((sum, d) => sum + (parseInt(d.telurCacat) || 0), 0);
        
        // ✅ FITUR BARU: Menjumlahkan total ayam tidak bertelur
        const totalTidakBertelur = produksiDataAdmin.reduce((sum, d) => sum + (parseInt(d.ayamTidakBertelur) || 0), 0);
            
        // Memperbarui UI untuk statistik telur hari ini
        const elProduksi = document.getElementById('stat-admin-produksi');
        if (elProduksi) elProduksi.textContent = `${totalTelurHariIni.toLocaleString('id-ID')} Butir`;
        
        // Tampilkan info telur cacat hari ini di bawah Total Telur Hari Ini
        const elTelurCacatInline = document.getElementById('stat-admin-telur-cacat-inline');
        if (elTelurCacatInline) {
            if (totalTelurCacatHariIni > 0) {
                elTelurCacatInline.textContent = `${totalTelurCacatHariIni.toLocaleString('id-ID')} Butir Telur Cacat`;
                elTelurCacatInline.style.display = 'block';
            } else {
                elTelurCacatInline.style.display = 'none';
            }
        }
        
        // ✅ FITUR BARU: Update card Ayam Tidak Bertelur
        const elTidakBertelur = document.getElementById('stat-admin-tidak-bertelur');
        if (elTidakBertelur) elTidakBertelur.textContent = `${totalTidakBertelur.toLocaleString('id-ID')} Ekor`;
        
        // Mengurutkan dan merender 8 data produksi terbaru ke tabel ringkasan
        const latestProduksi = [...produksiDataAdmin].sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal)).slice(0, 8);
        renderProduksiSnapshot(latestProduksi);
        
        // Memperbarui grafik analitik produksi dengan data terbaru
        renderAdminCharts(); 
    });

    // =========================================================
    // G. Monitoring Stok Pakan (Koleksi: stok_pakan)
    // =========================================================
    // Menghitung sisa stok pakan berdasarkan selisih barang masuk dan keluar.
    onSnapshot(collection(db, "stok_pakan"), (snapshot) => {
        let pakanMasuk = 0, pakanKeluar = 0;
        let pakanList = [];
        
        snapshot.forEach(d => {
            const data = d.data();
            // Memisahkan perhitungan antara pakan yang masuk dan yang digunakan (keluar)
            if (data.tipe === 'Masuk') pakanMasuk += (parseFloat(data.jumlah) || 0);
            else pakanKeluar += (parseFloat(data.jumlah) || 0);
            pakanList.push({ id: d.id, ...data });
        });
        
        pakanDataAdmin = pakanList; // Simpan untuk referensi pop up
        
        // Memperbarui UI sisa pakan (Masuk dikurangi Keluar)
        const elPakan = document.getElementById('stat-admin-pakan');
        if (elPakan) elPakan.textContent = `${(pakanMasuk - pakanKeluar).toLocaleString('id-ID')} Kg`;

        // Mengurutkan dan merender 8 data riwayat pakan terbaru
        const latestPakan = pakanList.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal)).slice(0, 8);
        renderPakanSnapshot(latestPakan);
    });

    // =========================================================
    // H. Monitoring Vaksinasi (Koleksi: vaksinasi_ayam)
    // =========================================================
    // Memantau jadwal vaksinasi yang belum selesai (terjadwal)
    onSnapshot(collection(db, "vaksinasi_ayam"), (snapshot) => {
        const vaccineData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        vaksinDataAdmin = vaccineData; // Simpan untuk referensi pop up
        
        // Menghitung jumlah vaksinasi yang statusnya masih 'Terjadwal'
        const terjadwal = vaccineData.filter(d => d.status === 'Terjadwal').length;
        const elVaksin = document.getElementById('stat-admin-vaksin');
        if (elVaksin) elVaksin.textContent = `${terjadwal} Jadwal`;

        // Mengurutkan dan merender 8 jadwal vaksinasi terdekat/terbaru
        const sortedVaksin = vaccineData.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal)).slice(0, 8);
        renderVaksinSnapshot(sortedVaksin);
    });

    // =========================================================
    // I. Monitoring Kesehatan & Mortalitas (Koleksi: kesehatan_ayam)
    // =========================================================
    // Menghitung total kematian ayam (mortalitas) secara keseluruhan.
    onSnapshot(collection(db, "kesehatan_ayam"), (snapshot) => {
        const healthData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        kesehatanDataAdmin = healthData; // Simpan untuk referensi pop up
        
        // ✅ LOGIKA MORTALITAS YANG BENAR (Sinkron dengan Dashboard Petugas)
        // Aturan: "Mati Semua" = jmlSakit + jmlMati (semua yang sakit mati + yang sudah mati sebelumnya)
        // Status lain → gunakan jmlMati saja yang tercatat manual
        const totalMati = healthData.reduce((sum, item) => {
            if (item.status === 'Mati Semua') {
                return sum + (parseInt(item.jmlSakit) || 0) + (parseInt(item.jmlMati) || 0);
            }
            return sum + (parseInt(item.jmlMati) || 0);
        }, 0);
        
        const elMortalitas = document.getElementById('stat-admin-mortalitas');
        if (elMortalitas) elMortalitas.textContent = `${totalMati.toLocaleString('id-ID')} Ekor`;

        // Hitung total ayam sakit (Dalam Perawatan)
        const ayamSakit = healthData.filter(x => x.status === "Dalam Perawatan")
                                    .reduce((sum, item) => sum + (parseInt(item.jmlSakit) || 0), 0);
        
        // Update total ayam aktif dengan mengurangi ayam sakit
        updateTotalAyamAktifWithSick(ayamSakit);
        
        // Update card info ayam sakit di Admin Panel
        updateAyamSakitInfo(ayamSakit);

        // Mengurutkan dan merender 8 riwayat mortalitas terbaru
        const latestHealth = healthData.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal)).slice(0, 8);
        renderKesehatanSnapshot(latestHealth);
    });

    // =========================================================
    // J. Monitoring Aktivitas Harian (Koleksi: daily_activities)
    // =========================================================
    // Mengambil dan merender daftar ceklis tugas harian secara real-time.
    onSnapshot(query(collection(db, "daily_activities"), orderBy("createdAt", "desc")), (snapshot) => {
        const activities = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderAdminActivities(activities);
    });

    // =========================================================
    // K. Monitoring Pengumuman (Koleksi: announcements)
    // =========================================================
    // Mengambil pesan pengumuman sistem (broadcast) secara real-time.
    onSnapshot(query(collection(db, "announcements"), orderBy("createdAt", "desc")), (snapshot) => {
        const announcements = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderAdminAnnouncements(announcements);
    });

    // =========================================================
    // L. Monitoring Jadwal Agenda (Koleksi: schedules)
    // =========================================================
    // Mengambil daftar kegiatan peternakan yang akan datang.
    onSnapshot(query(collection(db, "schedules"), orderBy("createdAt", "desc")), (snapshot) => {
        const schedules = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderAdminSchedules(schedules);
    });

    // =========================================================
    // M. SETUP FORM LISTENERS (MANAJEMEN OPERASIONAL)
    // =========================================================
    // Mengatur fungsi saat tombol submit ditekan pada form-form di dashboard admin.
    
    // ✅ FASE BARU: Monitoring Prediksi & Rekomendasi (Koleksi: prediksi_history)
    onSnapshot(query(collection(db, "prediksi_history"), orderBy("tanggal", "desc"), limit(10)), (snapshot) => {
        const prediksiData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderPrediksiSnapshot(prediksiData);
        
        // Update widget statistik prediksi dengan data terbaru
        if (prediksiData.length > 0) {
            updatePrediksiStats(prediksiData[0]);
        }
    });
    
    // 1. Form Aktivitas Harian
    const activityForm = document.getElementById('adminAddActivityForm');
    if (activityForm) {
        activityForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // Mencegah reload halaman
            const input = document.getElementById('adminActivityInput');
            if (!input.value.trim()) return; // Memastikan input tidak kosong
            
            try {
                // Menambahkan data baru ke Firestore
                await addDoc(collection(db, "daily_activities"), {
                    text: input.value.trim(),
                    completed: false, // Status awal selalu belum selesai
                    createdAt: new Date().toISOString()
                });
                
                // Mencatat aksi ini ke dalam audit log keamanan
                logActivity(currentAdminData?.username || "Admin", "Operasional", `Menambah aktivitas: ${input.value.trim()}`);
                input.value = ""; // Mengosongkan form input
            } catch (err) { console.error(err); }
        });
    }

    // 2. Form Pengumuman Sistem
    const announcementForm = document.getElementById('adminAddAnnouncementForm');
    if (announcementForm) {
        announcementForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const input = document.getElementById('adminAnnouncementInput');
            if (!input.value.trim()) return;
            
            try {
                await addDoc(collection(db, "announcements"), {
                    text: input.value.trim(),
                    read: false, // Status awal selalu belum dibaca oleh user
                    createdAt: new Date().toISOString()
                });
                logActivity(currentAdminData?.username || "Admin", "Operasional", `Menambah pengumuman: ${input.value.trim()}`);
                input.value = "";
            } catch (err) { console.error(err); }
        });
    }

    // 3. Form Penjadwalan Agenda
    const scheduleForm = document.getElementById('adminAddScheduleForm');
    if (scheduleForm) {
        scheduleForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            // Menyiapkan paket data jadwal dari form input
            const payload = {
                tanggal: document.getElementById('adminTgl').value,
                waktu: document.getElementById('adminWaktu').value,
                agenda: document.getElementById('adminAgenda').value,
                ruangan: document.getElementById('adminTempat').value,
                createdAt: new Date().toISOString()
            };
            
            try {
                await addDoc(collection(db, "schedules"), payload);
                logActivity(currentAdminData?.username || "Admin", "Operasional", `Menambah jadwal agenda: ${payload.agenda}`);
                scheduleForm.reset(); // Mengosongkan seluruh form jadwal
                Swal.fire("Berhasil", "Agenda kegiatan telah dijadwalkan!", "success"); // Notifikasi sukses
            } catch (err) { Swal.fire("Error", err.message, "error"); } // Notifikasi jika gagal
        });
    }
}

/**
 * ===== 2. FUNGSI RENDERING UI =====
 */

/**
 * Helper: Update Total Ayam Aktif (dipanggil saat data populasi berubah)
 */
function updateTotalAyamAktif(totalSisaAyam) {
    cachedTotalSisaAyam = totalSisaAyam;
    const totalAyamAktifSehat = cachedTotalSisaAyam - cachedAyamSakit;
    document.getElementById('stat-admin-ayam').textContent = `${totalAyamAktifSehat.toLocaleString('id-ID')} Ekor`;
}

/**
 * Helper: Update Total Ayam Aktif dengan data ayam sakit (dipanggil saat data kesehatan berubah)
 */
function updateTotalAyamAktifWithSick(ayamSakit) {
    cachedAyamSakit = ayamSakit;
    const totalAyamAktifSehat = cachedTotalSisaAyam - cachedAyamSakit;
    document.getElementById('stat-admin-ayam').textContent = `${totalAyamAktifSehat.toLocaleString('id-ID')} Ekor`;
    
    // Update info inline di card Populasi Ayam
    const elSakitInline = document.getElementById('stat-admin-ayam-sakit-inline');
    if (elSakitInline && ayamSakit > 0) {
        elSakitInline.textContent = `${ayamSakit.toLocaleString('id-ID')} Ekor Sakit / Dirawat`;
        elSakitInline.style.display = 'block';
    } else if (elSakitInline) {
        elSakitInline.style.display = 'none';
    }
}

/**
 * Helper: Update Info Ayam Sakit di Admin Panel
 */
function updateAyamSakitInfo(ayamSakit) {
    const elSakit = document.getElementById('stat-admin-ayam-sakit');
    if (elSakit) {
        if (ayamSakit > 0) {
            const persentase = cachedTotalSisaAyam > 0 ? ((ayamSakit / cachedTotalSisaAyam) * 100).toFixed(1) : 0;
            let statusClass = 'status-normal';
            let statusIcon = '🟢';
            let statusText = 'Normal';
            
            if (persentase >= 5) {
                statusClass = 'status-kritis';
                statusIcon = '🔴';
                statusText = 'KRITIS';
            } else if (persentase >= 3) {
                statusClass = 'status-waspada';
                statusIcon = '🟡';
                statusText = 'Waspada';
            }
            
            elSakit.innerHTML = `${statusIcon} ${ayamSakit.toLocaleString('id-ID')} Ekor Sakit (${persentase}%) - ${statusText}`;
            elSakit.style.display = 'block';
            elSakit.className = `admin-ayam-sakit-info ${statusClass}`;
        } else {
            elSakit.style.display = 'none';
        }
    }
}

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

            const userRoleClean = (user.role || 'user').trim().toLowerCase();
            const isAdmin = userRoleClean === 'admin' || userRoleClean === 'administrator' || userRoleClean === 'super_admin';

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
                        <span class="badge-role" style="background: ${isAdmin ? 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)' : '#94a3b8'}; color:white; padding:5px 12px; border-radius:20px; font-size:0.65rem; font-weight:700; letter-spacing:0.5px; box-shadow: ${isAdmin ? '0 2px 5px rgba(59, 130, 246, 0.3)' : 'none'};">
                            ${isAdmin ? '🛡️' : '👤'} ${(user.role || 'user').toUpperCase()}
                        </span>
                    </td>
                    <td>
                        <span style="color: ${user.disabled ? '#ef4444' : '#10b981'}; font-weight: 700; font-size: 0.8rem;">
                            ● ${user.disabled ? 'NONAKTIF' : 'AKTIF'}
                        </span>
                    </td>
                    <td>
                        <div class="action-btns">
                            <button onclick="openEditUserModal('${user.id}')" 
                                    class="action-btn-small" style="background-color: #f59e0b;" title="Edit Data Akun">
                                Edit
                            </button>
                            <button onclick="toggleAdminRole('${user.id}', '${user.role || 'user'}')" 
                                    class="action-btn-small ${isAdmin ? 'btn-demote' : 'btn-promote'}">
                                ${isAdmin ? 'Demote' : 'Promote'}
                            </button>
                            <button onclick="deleteUserAccount('${user.id}', '${user.fullname || user.username}')" 
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
 * Merender ringkasan populasi ayam dengan tombol aksi CRUD
 */
function renderAyamSnapshot(data) {
    const ayamBody = document.getElementById('adminAyamSnapshot');
    if (!ayamBody) return;

    if (data.length === 0) {
        ayamBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#94a3b8;">Data batch ayam tidak ditemukan.</td></tr>`;
    } else {
        ayamBody.innerHTML = data.map(item => `
            <tr style="cursor:pointer;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background=''">
                <td><strong>${item.customId || item.id.substring(0, 8)}</strong></td>
                <td>${item.jenis || '-'}</td>
                <td><span style="background:${getStatusColor(item.status)}; color:white; padding:2px 8px; border-radius:10px; font-size:10px; font-weight:600;">${item.status || 'AKTIF'}</span></td>
                <td><strong>${(parseInt(item.sisaAyam || 0)).toLocaleString('id-ID')}</strong></td>
                <td style="text-align:center;">
                    <button onclick="openAyamDetail('${item.id}')" 
                        style="background:#3b82f6; color:white; border:none; padding:4px 10px; border-radius:6px; font-size:11px; cursor:pointer; font-weight:600;">✏️ Detail</button>
                </td>
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
 * Merender ringkasan mutasi kas dengan tombol aksi CRUD
 */
function renderKeuanganSnapshot(data) {
    const keuanganBody = document.getElementById('adminKeuanganSnapshot');
    if (!keuanganBody) return;

    if (data.length === 0) {
        keuanganBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#94a3b8;">Belum ada riwayat transaksi finansial.</td></tr>`;
    } else {
        keuanganBody.innerHTML = data.map(item => `
            <tr style="cursor:pointer;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background=''">
                <td style="font-size:0.82rem;">${formatTanggal(item.tanggal)}</td>
                <td style="max-width:140px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${item.deskripsi || '-'}</td>
                <td><span style="color:${item.tipe === 'pemasukan' ? '#10b981' : '#ef4444'}; font-weight:700; font-size:0.8rem;">${(item.tipe || '').toUpperCase()}</span></td>
                <td style="font-weight:600;">Rp ${parseInt(item.jumlah || 0).toLocaleString('id-ID')}</td>
                <td style="text-align:center;">
                    <button onclick="openKeuanganDetail('${item.id}')" 
                        style="background:#3b82f6; color:white; border:none; padding:4px 10px; border-radius:6px; font-size:11px; cursor:pointer; font-weight:600;">✏️ Detail</button>
                </td>
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
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric'});
}

/**
 * Merender ringkasan produksi harian
 */
function renderProduksiSnapshot(data) {
    const body = document.getElementById('adminProduksiSnapshot');
    if (!body) return;

    if (data.length === 0) {
        body.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#94a3b8;">Belum ada data produksi telur.</td></tr>`;
    } else {
        body.innerHTML = data.map(item => `
            <tr style="cursor:pointer;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background=''">
                <td style="font-size:0.82rem;">${formatTanggal(item.tanggal)}</td>
                <td><strong>${parseInt(item.totalTelur || 0).toLocaleString('id-ID')}</strong></td>
                <td style="color:#10b981;">${parseInt(item.telurBaik || 0).toLocaleString('id-ID')}</td>
                <td style="color:#ef4444;">${parseInt(item.telurCacat || 0).toLocaleString('id-ID')}</td>
                <td style="text-align:center;">
                    <button onclick="openProduksiDetail('${item.id}')" 
                        style="background:#3b82f6; color:white; border:none; padding:4px 10px; border-radius:6px; font-size:11px; cursor:pointer; font-weight:600;">✏️ Detail</button>
                </td>
            </tr>
        `).join('');
    }
}

/**
 * Merender ringkasan logistik pakan
 */
function renderPakanSnapshot(data) {
    const body = document.getElementById('adminPakanSnapshot');
    if (!body) return;

    if (data.length === 0) {
        body.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#94a3b8;">Tidak ada aktivitas logistik pakan.</td></tr>`;
    } else {
        body.innerHTML = data.map(item => `
            <tr style="cursor:pointer;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background=''">
                <td style="font-size:0.82rem;">${formatTanggal(item.tanggal)}</td>
                <td>${item.namaBarang || '-'}</td>
                <td><span style="color:${item.tipe === 'Masuk' ? '#10b981' : '#ef4444'}; font-weight:700; font-size:0.8rem;">${(item.tipe || '').toUpperCase()}</span></td>
                <td><strong>${item.jumlah} ${item.satuan || 'Kg'}</strong></td>
                <td style="text-align:center;">
                    <button onclick="openPakanDetail('${item.id}')" 
                        style="background:#3b82f6; color:white; border:none; padding:4px 10px; border-radius:6px; font-size:11px; cursor:pointer; font-weight:600;">✏️ Detail</button>
                </td>
            </tr>
        `).join('');
    }
}

/**
 * Merender ringkasan kesehatan ayam
 */
function renderKesehatanSnapshot(data) {
    const body = document.getElementById('adminKesehatanSnapshot');
    if (!body) return;

    if (data.length === 0) {
        body.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#94a3b8;">Kondisi kesehatan kawanan terpantau aman.</td></tr>`;
    } else {
        body.innerHTML = data.map(item => `
            <tr style="cursor:pointer;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background=''">
                <td style="font-size:0.82rem;">${formatTanggal(item.tanggal)}</td>
                <td><code>${item.customId || item.batchName || (item.batchId ? item.batchId.substring(0, 8) : '-')}</code></td>
                <td style="color:#ef4444; font-weight:700;">${item.jmlMati || 0} Ekor</td>
                <td style="font-size:0.8rem;">${item.sebab || '-'}</td>
                <td style="text-align:center;">
                    <button onclick="openKesehatanDetail('${item.id}')" 
                        style="background:#3b82f6; color:white; border:none; padding:4px 10px; border-radius:6px; font-size:11px; cursor:pointer; font-weight:600;">✏️ Detail</button>
                </td>
            </tr>
        `).join('');
    }
}

/**
 * Merender ringkasan jadwal vaksinasi
 */
function renderVaksinSnapshot(data) {
    const body = document.getElementById('adminVaksinSnapshot');
    if (!body) return;

    if (data.length === 0) {
        body.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#94a3b8;">Belum ada jadwal vaksinasi yang diinput.</td></tr>`;
    } else {
        body.innerHTML = data.map(item => `
            <tr style="cursor:pointer;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background=''">
                <td style="font-size:0.82rem;">${formatTanggal(item.tanggal)}</td>
                <td><strong>${item.namaVaksin || '-'}</strong></td>
                <td><code>${item.customId || item.batchName || (item.batchId ? item.batchId.substring(0, 8) : '-')}</code></td>
                <td><span style="background:${item.status === 'Selesai' ? '#10b981' : '#f59e0b'}; color:white; padding:2px 8px; border-radius:10px; font-size:10px; font-weight:600;">${(item.status || 'Terjadwal').toUpperCase()}</span></td>
                <td style="text-align:center;">
                    <button onclick="openVaksinDetail('${item.id}')" 
                        style="background:#3b82f6; color:white; border:none; padding:4px 10px; border-radius:6px; font-size:11px; cursor:pointer; font-weight:600;">✏️ Detail</button>
                </td>
            </tr>
        `).join('');
    }
}

/**
 * ✅ FASE BARU: Merender ringkasan prediksi & rekomendasi
 */
function renderPrediksiSnapshot(data) {
    const body = document.getElementById('adminPrediksiSnapshot');
    if (!body) return;

    if (data.length === 0) {
        body.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#94a3b8;">Belum ada hasil prediksi yang dibuat.</td></tr>`;
    } else {
        body.innerHTML = data.map(item => {
            const tanggalObj = item.tanggal ? new Date(item.tanggal) : null;
            const tanggalStr = tanggalObj ? tanggalObj.toLocaleDateString('id-ID', { 
                day: 'numeric', 
                month: 'short', 
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }) : '-';
            
            const produksiKg = (item.prediksiBesokKg || 0).toFixed(2);
            const produksiButir = (item.prediksiBesokButir || 0).toLocaleString('id-ID');
            const keuntungan = (item.keuntungan || 0);
            const keuntunganColor = keuntungan >= 0 ? '#10b981' : '#ef4444';
            
            return `
                <tr style="cursor:pointer;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background=''">
                    <td style="font-size:0.82rem;">${tanggalStr}</td>
                    <td><strong>${item.periodeMA || '-'} Hari</strong></td>
                    <td>${(item.populasi || 0).toLocaleString('id-ID')} Ekor</td>
                    <td><strong>${produksiKg} Kg</strong><br><small style="color:#64748b;">(${produksiButir} Butir)</small></td>
                    <td style="color:${keuntunganColor}; font-weight:700;">Rp ${Math.abs(keuntungan).toLocaleString('id-ID')}</td>
                    <td style="text-align:center;">
                        <button onclick="openPrediksiDetail('${item.id}')" 
                            style="background:#3b82f6; color:white; border:none; padding:4px 10px; border-radius:6px; font-size:11px; cursor:pointer; font-weight:600;">✏️ Detail</button>
                    </td>
                </tr>
            `;
        }).join('');
    }
    
    // Render rekomendasi dari prediksi terbaru
    if (data.length > 0 && data[0].rekomendasi && data[0].rekomendasi.length > 0) {
        renderRekomendasiAdmin(data[0].rekomendasi);
    } else {
        hideRekomendasiAdmin();
    }
}

/**
 * ✅ FASE BARU: Update widget statistik prediksi
 */
function updatePrediksiStats(latestPrediksi) {
    if (!latestPrediksi) return;
    
    // Update Prediksi Produksi
    const elProduksi = document.getElementById('admin-prediksi-produksi');
    const elButir = document.getElementById('admin-prediksi-butir');
    if (elProduksi) {
        const kg = (latestPrediksi.prediksiBesokKg || 0).toFixed(2);
        elProduksi.textContent = `${kg} Kg`;
    }
    if (elButir) {
        const butir = (latestPrediksi.prediksiBesokButir || 0).toLocaleString('id-ID');
        elButir.textContent = `${butir} Butir Telur`;
    }
    
    // Update Estimasi Pendapatan
    const elPendapatan = document.getElementById('admin-prediksi-pendapatan');
    if (elPendapatan) {
        const pendapatan = (latestPrediksi.estimasiPendapatan || 0).toLocaleString('id-ID');
        elPendapatan.textContent = `Rp ${pendapatan}`;
    }
    
    // Update Biaya Pakan
    const elBiaya = document.getElementById('admin-prediksi-biaya');
    if (elBiaya) {
        const biaya = (latestPrediksi.biayaPakan || 0).toLocaleString('id-ID');
        elBiaya.textContent = `Rp ${biaya}`;
    }
    
    // Update Proyeksi Keuntungan
    const elKeuntungan = document.getElementById('admin-prediksi-keuntungan');
    if (elKeuntungan) {
        const keuntungan = (latestPrediksi.keuntungan || 0);
        const keuntunganStr = keuntungan >= 0 ? `Rp ${keuntungan.toLocaleString('id-ID')}` : `- Rp ${Math.abs(keuntungan).toLocaleString('id-ID')}`;
        elKeuntungan.textContent = keuntunganStr;
        elKeuntungan.style.color = keuntungan >= 0 ? '#10b981' : '#ef4444';
    }
}

/**
 * ✅ FASE BARU: Render rekomendasi prediktif di admin panel
 */
function renderRekomendasiAdmin(rekomendasi) {
    const container = document.getElementById('admin-rekomendasi-container');
    const list = document.getElementById('admin-rekomendasi-list');
    
    if (!container || !list) return;
    
    container.style.display = 'block';
    
    list.innerHTML = rekomendasi.map((rek, idx) => {
        // Tentukan warna berdasarkan level
        let bgColor = '#f8fafc';
        let borderColor = '#e2e8f0';
        let badgeColor = '#64748b';
        
        if (rek.level === 'success') {
            bgColor = '#d1fae5';
            borderColor = '#10b981';
            badgeColor = '#10b981';
        } else if (rek.level === 'warning') {
            bgColor = '#fef3c7';
            borderColor = '#f59e0b';
            badgeColor = '#f59e0b';
        } else if (rek.level === 'danger') {
            bgColor = '#fee2e2';
            borderColor = '#ef4444';
            badgeColor = '#ef4444';
        } else if (rek.level === 'info') {
            bgColor = '#dbeafe';
            borderColor = '#3b82f6';
            badgeColor = '#3b82f6';
        }
        
        // Render actions jika ada
        let actionsHTML = '';
        if (rek.actions && rek.actions.length > 0) {
            actionsHTML = `
                <div style="margin-top: 0.75rem; padding-left: 1rem; border-left: 2px solid ${borderColor};">
                    <p style="margin: 0 0 0.5rem 0; font-weight: 600; font-size: 0.85rem; color: #2c3e50;">Langkah yang Disarankan:</p>
                    <ul style="margin: 0; padding-left: 1.25rem; color: #495057; font-size: 0.85rem;">
                        ${rek.actions.map(action => `<li style="margin-bottom: 0.25rem;">${action}</li>`).join('')}
                    </ul>
                </div>
            `;
        }
        
        return `
            <div class="rekomendasi-card-admin animate__animated animate__fadeInUp" 
                 style="background: ${bgColor}; border-left: 4px solid ${borderColor}; border-radius: 10px; padding: 1rem; margin-bottom: 1rem; animation-delay: ${idx * 0.1}s;">
                <div style="display: flex; align-items: flex-start; gap: 12px;">
                    <span style="font-size: 1.5rem; flex-shrink: 0;">${rek.icon || '💡'}</span>
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 0.5rem; flex-wrap: wrap;">
                            <span style="background: ${badgeColor}; color: white; font-size: 0.7rem; font-weight: 700; padding: 3px 10px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px;">${rek.level}</span>
                            <h4 style="margin: 0; font-size: 1rem; font-weight: 700; color: #1a202c;">${rek.title || 'Rekomendasi'}</h4>
                        </div>
                        <p style="margin: 0; font-size: 0.9rem; color: #4a5568; line-height: 1.6;">${rek.description || ''}</p>
                        ${actionsHTML}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * ✅ FASE BARU: Sembunyikan container rekomendasi jika tidak ada data
 */
function hideRekomendasiAdmin() {
    const container = document.getElementById('admin-rekomendasi-container');
    if (container) container.style.display = 'none';
}

/**
 * ✅ FASE BARU: Buka detail prediksi (Modal)
 */
window.openPrediksiDetail = async function(prediksiId) {
    try {
        const prediksiDoc = await getDoc(doc(db, "prediksi_history", prediksiId));
        if (!prediksiDoc.exists()) {
            Swal.fire('Error', 'Data prediksi tidak ditemukan.', 'error');
            return;
        }
        
        const data = prediksiDoc.data();
        
        // Format tanggal
        const tanggalObj = data.tanggal ? new Date(data.tanggal) : null;
        const tanggalStr = tanggalObj ? tanggalObj.toLocaleDateString('id-ID', { 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }) : '-';
        
        // Render proyeksi 7 hari
        let proyeksiHTML = '';
        if (data.proyeksi7HariKg && data.proyeksi7HariKg.length > 0) {
            proyeksiHTML = `
                <h4 style="margin: 1.5rem 0 1rem 0; color: #2c3e50; border-bottom: 2px solid #e9ecef; padding-bottom: 0.5rem;">📈 Proyeksi 7 Hari Ke Depan</h4>
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
                            ${data.proyeksi7HariKg.map((kg, i) => {
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
            `;
        }
        
        // Render rekomendasi
        let rekomendasiHTML = '';
        if (data.rekomendasi && data.rekomendasi.length > 0) {
            rekomendasiHTML = `
                <h4 style="margin: 1.5rem 0 1rem 0; color: #2c3e50; border-bottom: 2px solid #e9ecef; padding-bottom: 0.5rem;">💡 Rekomendasi Prediktif</h4>
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
            `;
        }
        
        Swal.fire({
            title: '🔮 Detail Prediksi Lengkap',
            html: `
                <div style="text-align: left; max-height: 70vh; overflow-y: auto; padding: 1rem;">
                    <div style="margin-bottom: 1.5rem; padding: 1rem; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #667eea;">
                        <p style="margin: 0; color: #7f8c8d; font-size: 0.9rem;">📅 Tanggal Prediksi</p>
                        <p style="margin: 5px 0 0 0; font-weight: 700; color: #2c3e50;">${tanggalStr}</p>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
                        <div style="padding: 1rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 10px; color: white;">
                            <p style="margin: 0; font-size: 0.85rem; opacity: 0.9;">🥚 Prediksi Telur</p>
                            <p style="margin: 5px 0 0 0; font-size: 1.8rem; font-weight: 700;">${(data.prediksiBesokButir || 0).toLocaleString('id-ID')}</p>
                            <p style="margin: 5px 0 0 0; font-size: 0.75rem; opacity: 0.8;">Butir</p>
                        </div>
                        <div style="padding: 1rem; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 10px; color: white;">
                            <p style="margin: 0; font-size: 0.85rem; opacity: 0.9;">💰 Prediksi Pendapatan</p>
                            <p style="margin: 5px 0 0 0; font-size: 1.8rem; font-weight: 700;">Rp ${(data.estimasiPendapatan || 0).toLocaleString('id-ID')}</p>
                            <p style="margin: 5px 0 0 0; font-size: 0.75rem; opacity: 0.8;">Estimasi</p>
                        </div>
                        <div style="padding: 1rem; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 10px; color: white;">
                            <p style="margin: 0; font-size: 0.85rem; opacity: 0.9;">📉 Biaya Pakan</p>
                            <p style="margin: 5px 0 0 0; font-size: 1.8rem; font-weight: 700;">Rp ${(data.biayaPakan || 0).toLocaleString('id-ID')}</p>
                            <p style="margin: 5px 0 0 0; font-size: 0.75rem; opacity: 0.8;">Modal</p>
                        </div>
                    </div>
                    
                    ${proyeksiHTML}
                    
                    <div style="margin-top: 1.5rem; padding: 1rem; background: #f8f9fa; border-radius: 8px;">
                        <h4 style="margin: 0 0 0.5rem 0; color: #2c3e50;">ℹ️ Informasi Tambahan</h4>
                        <div style="display: grid; gap: 0.5rem; font-size: 0.9rem; color: #495057;">
                            <div><strong>Periode MA:</strong> ${data.periodeMA || '-'} Hari</div>
                            <div><strong>Populasi:</strong> ${(data.populasi || 0).toLocaleString('id-ID')} Ekor</div>
                            <div><strong>Batch:</strong> ${data.batchLabel || '-'}</div>
                            <div><strong>Keuntungan Bersih:</strong> <span style="color: ${data.keuntungan >= 0 ? '#10b981' : '#ef4444'}; font-weight: 700;">Rp ${(data.keuntungan || 0).toLocaleString('id-ID')}</span></div>
                        </div>
                    </div>
                    
                    ${rekomendasiHTML}
                </div>
            `,
            width: '900px',
            confirmButtonText: 'Tutup',
            confirmButtonColor: '#3b82f6'
        });
        
    } catch (error) {
        console.error('Error loading prediksi detail:', error);
        Swal.fire('Error', 'Gagal memuat detail prediksi: ' + error.message, 'error');
    }
}

/**
 * Merender audit log sistem
 * Mendukung Firestore Timestamp object (dari serverTimestamp()) dan ISO string
 */
function renderSystemLogs(logs) {
    const logBody = document.getElementById('systemLogBody');
    if (!logBody) return;

    if (logs.length === 0) {
        logBody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#94a3b8;">Belum ada rekaman aktivitas sistem.</td></tr>`;
    } else {
        logBody.innerHTML = logs.map(log => {
            // ✅ FIX: Handle Firestore Timestamp object (serverTimestamp()) & ISO string
            let waktuStr = '-';
            if (log.waktu) {
                // Firestore Timestamp object memiliki method .toDate()
                const dateObj = log.waktu.toDate ? log.waktu.toDate() : new Date(log.waktu);
                const isValidDate = !isNaN(dateObj.getTime());
                if (isValidDate) {
                    waktuStr = dateObj.toLocaleString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                }
            }
            return `
            <tr>
                <td style="white-space:nowrap; font-size:0.82rem;">${waktuStr}</td>
                <td><strong>${log.user || 'System'}</strong></td>
                <td><span style="background:#e2e8f0; padding:2px 8px; border-radius:10px; font-size:0.75rem;">${log.modul || '-'}</span></td>
                <td style="font-size:0.85rem;">${log.aksi || '-'}</td>
            </tr>`;
        }).join('');
    }
}

/**
 * Merender daftar aktivitas harian di panel admin
 */
function renderAdminActivities(activities) {
    const list = document.getElementById("adminActivityList");
    if (!list) return;
    list.innerHTML = activities.map(item => `
        <li style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid #f1f5f9; background:${item.completed ? '#f8fafc' : 'transparent'}; opacity:${item.completed ? '0.6' : '1'};">
            <span style="flex:1; font-size:0.9rem; ${item.completed ? 'text-decoration:line-through; color:#94a3b8;' : 'color:#1e293b;'}">${item.text}</span>
            <div style="display:flex; gap:5px;">
                <button onclick="toggleAdminActivity('${item.id}', ${item.completed})" style="background:${item.completed ? '#64748b' : '#10b981'}; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:0.75rem;">${item.completed ? '↩' : '✔'}</button>
                <button onclick="deleteAdminActivity('${item.id}')" style="background:#ef4444; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:0.75rem;">✕</button>
            </div>
        </li>
    `).join('');
}

/**
 * Merender daftar pengumuman di panel admin
 */
function renderAdminAnnouncements(announcements) {
    const list = document.getElementById("adminAnnouncementList");
    if (!list) return;
    list.innerHTML = announcements.map(item => `
        <li style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid #f1f5f9; background:${item.read ? '#f8fafc' : 'transparent'};">
            <span style="flex:1; font-size:0.85rem; ${item.read ? 'text-decoration:line-through; color:#94a3b8;' : 'color:#1e293b;'}">${item.text}</span>
            <div style="display:flex; gap:5px;">
                <button onclick="toggleAdminAnnouncement('${item.id}', ${item.read})" style="background:${item.read ? '#64748b' : '#ef4444'}; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:0.75rem;">${item.read ? '↩' : '✔'}</button>
                <button onclick="deleteAdminAnnouncement('${item.id}')" style="background:#ef4444; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:0.75rem;">✕</button>
            </div>
        </li>
    `).join('');
}

/**
 * Merender daftar jadwal kegiatan di panel admin
 */
function renderAdminSchedules(schedules) {
    const tbody = document.querySelector("#adminScheduleTable tbody");
    if (!tbody) return;
    tbody.innerHTML = schedules.map(item => `
        <tr>
            <td style="font-size:0.75rem;">${item.tanggal}<br><small>${item.waktu}</small></td>
            <td style="font-size:0.85rem; font-weight:600;">${item.agenda}</td>
            <td style="font-size:0.8rem; color:#64748b;">${item.ruangan}</td>
            <td>
                <button onclick="deleteAdminSchedule('${item.id}')" style="background:rgba(239,68,68,0.1); color:#ef4444; border:1px solid rgba(239,68,68,0.2); padding:4px 8px; border-radius:4px; cursor:pointer;">🗑</button>
            </td>
        </tr>
    `).join('');
}

// ===== FUNGSI AKSI MANAJEMEN OPERASIONAL =====

window.toggleAdminActivity = async function(id, currentStatus) {
    await updateDoc(doc(db, "daily_activities", id), { completed: !currentStatus });
};

window.deleteAdminActivity = async function(id) {
    const res = await Swal.fire({ title: 'Hapus Aktivitas?', icon: 'warning', showCancelButton: true });
    if (res.isConfirmed) await deleteDoc(doc(db, "daily_activities", id));
};

window.toggleAdminAnnouncement = async function(id, currentStatus) {
    await updateDoc(doc(db, "announcements", id), { read: !currentStatus });
};

window.deleteAdminAnnouncement = async function(id) {
    const res = await Swal.fire({ title: 'Hapus Pengumuman?', icon: 'warning', showCancelButton: true });
    if (res.isConfirmed) await deleteDoc(doc(db, "announcements", id));
};

window.deleteAdminSchedule = async function(id) {
    const res = await Swal.fire({ title: 'Hapus Agenda Jadwal?', icon: 'warning', showCancelButton: true });
    if (res.isConfirmed) await deleteDoc(doc(db, "schedules", id));
};

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
            waktu: serverTimestamp() // ✅ Menggunakan server timestamp untuk konsistensi timezone
        });
    } catch (err) {
        console.error("Audit Logging Error:", err);
    }
}

/**
 * Menghapus seluruh riwayat log sistem (Hanya Super Admin)
 */
window.clearLogs = async function() {
    // Verifikasi level super_admin sebelum menghapus log
    if (!currentAdminData || currentAdminData.type !== 'super_admin') {
        Swal.fire({
            icon: 'error',
            title: 'Akses Ditolak',
            text: 'Hanya Super Administrator yang dapat menghapus riwayat log sistem.'
        });
        return;
    }

    // Double-konfirmasi penghapusan permanen
    const { value: konfirmasi } = await Swal.fire({
        title: 'Konfirmasi Penghapusan Log',
        html: `<p>Seluruh riwayat audit akan <strong>dimusnahkan secara permanen</strong>!</p>
               <p>Ketik <strong>HAPUS</strong> untuk mengkonfirmasi:</p>`,
        input: 'text',
        inputPlaceholder: 'Ketik HAPUS',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Hapus Selamanya',
        cancelButtonText: 'Batal',
        inputValidator: (value) => {
            if (value !== 'HAPUS') return 'Ketik tepat: HAPUS (huruf kapital)';
        }
    });

    if (konfirmasi === 'HAPUS') {
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
            await Swal.fire('Sukses!', 'Log database telah dikosongkan.', 'success');
            logActivity(currentAdminData.username || "Super Admin", "Sistem", "Penghapusan total riwayat log aktivitas database.");
            
        } catch (err) {
            console.error("Gagal Membersihkan Log:", err);
            Swal.fire('Gagal', 'Sistem tidak dapat menghapus log: ' + err.message, 'error');
        }
    }
}

/**
 * ===== 4. MANAJEMEN OTORITAS PENGGUNA =====
 */

/**
 * Menghapus akun pengguna dari database
 */
window.deleteUserAccount = async function(uid, name) {
    Swal.fire({
        title: 'Hapus Akun Pengguna?',
        html: `<p>Akun <strong>${name}</strong> akan dinonaktifkan dan dihapus dari sistem.</p>
               <p style="color:#ef4444; font-size:0.85rem;">⚠️ User tidak akan bisa login setelah ini.</p>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Ya, Hapus Akun',
        cancelButtonText: 'Batal'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                // Tahap 1: Tandai akun sebagai disabled di Firestore
                // (auth-state.js akan mendeteksi ini dan memaksa logout)
                await updateDoc(doc(db, "user", uid), {
                    disabled: true,
                    disabledAt: serverTimestamp(),
                    disabledBy: currentAdminData?.username || 'Admin'
                });

                // Tahap 2: Hapus dokumen user dari koleksi utama
                await deleteDoc(doc(db, "user", uid));

                // Tahap 3: Hapus entri admin jika user adalah admin
                try {
                    await deleteDoc(doc(db, "admin", uid));
                } catch (_) { /* Bukan admin, abaikan */ }

                Swal.fire('Berhasil Terhapus', 'Akun telah dihapus dari sistem. Session user tersebut akan otomatis berakhir.', 'success');
                logActivity(currentAdminData?.username || "Admin", "Akses Pengguna", `Menghapus akun user: ${name} (UID: ${uid})`);
            } catch (err) {
                Swal.fire('Gagal', 'Terjadi kendala: ' + err.message, 'error');
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
 * Toggle Mobile Sidebar dengan Overlay
 */
window.toggleMobileSidebar = function() {
    const sidebar = document.querySelector('.sidebar');
    const body = document.body;
    
    sidebar.classList.toggle('active');
    body.classList.toggle('sidebar-open');
    
    // Tutup sidebar saat overlay diklik
    if (body.classList.contains('sidebar-open')) {
        const overlay = document.querySelector('body::before');
        if (overlay) {
            document.addEventListener('click', closeSidebarOnOverlayClick);
        }
    }
}

/**
 * Tutup sidebar saat overlay diklik
 */
function closeSidebarOnOverlayClick(e) {
    const sidebar = document.querySelector('.sidebar');
    const menuToggle = document.querySelector('.menu-toggle');
    
    if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
        sidebar.classList.remove('active');
        document.body.classList.remove('sidebar-open');
        document.removeEventListener('click', closeSidebarOnOverlayClick);
    }
}

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
        confirmButtonText: 'Buat Akun',
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
        // ✅ FIX: Reuse instance yang sudah ada agar tidak throw error jika dipanggil 2x
        let tempApp;
        const existingApps = getApps();
        const existingSecondary = existingApps.find(a => a.name === "TempRegistrationApp");
        if (existingSecondary) {
            tempApp = existingSecondary;
        } else {
            tempApp = initializeApp(firebaseConfig, "TempRegistrationApp");
        }
        const tempAuth = getAuth(tempApp);

        // 1. Validasi username tidak duplikat
        const usernameCheck = await getDocs(query(
            collection(db, "user"), where("username", "==", username)
        ));
        if (!usernameCheck.empty) {
            Swal.fire('Gagal', 'Username sudah digunakan oleh akun lain!', 'error');
            return;
        }

        // 2. Registrasi Auth via secondary instance
        const userCredential = await createUserWithEmailAndPassword(tempAuth, email, password);
        const uid = userCredential.user.uid;

        // 3. Simpan Metadata User ke Firestore
        await setDoc(doc(db, "user", uid), {
            fullname,
            username,
            email,
            role,
            disabled: false,
            createdAt: serverTimestamp()
        });

        // 4. Update Otoritas jika level Admin
        if (role === 'admin') {
            await setDoc(doc(db, "admin", uid), {
                uid,
                fullname,
                username,
                email,
                role: 'admin',
                promotedAt: serverTimestamp(),
                type: 'auth_entry',
                createdBy: currentAdminData?.username || 'Admin'
            });
        }

        // 5. Logout dari secondary instance agar tidak mengganggu sesi admin
        await tempAuth.signOut();

        Swal.fire({
            icon: 'success',
            title: 'Akun Berhasil Dibuat',
            html: `Identitas <strong>${fullname}</strong> (@${username}) telah didaftarkan sebagai <strong>${role.toUpperCase()}</strong>.`,
        });

        logActivity(
            currentAdminData?.username || "Admin",
            "Akses Pengguna",
            `Membuat akun baru: ${fullname} (@${username}) - Role: ${role.toUpperCase()}`
        );

    } catch (error) {
        console.error("Critical Cloud Error:", error);
        let msg = error.message;
        if (error.code === 'auth/email-already-in-use') msg = "Email sudah terdaftar di sistem!";
        else if (error.code === 'auth/weak-password') msg = "Password terlalu lemah (min. 6 karakter).";
        else if (error.code === 'auth/invalid-email') msg = "Format email tidak valid.";
        
        Swal.fire('Gagal Membuat Akun', msg, 'error');
    }
}

/**
 * ===== 7. GRAFIK ANALITIK ADMIN =====
 */

/**
 * Inisialisasi semua grafik admin panel
 */
function renderAdminCharts() {
    renderAdminEggChart(currentAdminChartPeriod);
    renderAdminFinanceChart();
}

/**
 * Ganti periode tampilan grafik produksi
 */
window.gantiPeriodeAdminChart = function(hari, btn) {
    currentAdminChartPeriod = hari;
    document.querySelectorAll('.admin-chart-filter').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderAdminEggChart(hari);
};

/**
 * Merender grafik tren produksi telur (Line Chart)
 */
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

/**
 * Merender grafik Pemasukan vs Pengeluaran per minggu (Bar Chart)
 */
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
 * ===== 8. CRUD POPUP: SNAPSHOT BATCH AYAM =====
 */

/**
 * Membuka popup detail & edit data batch ayam
 * @param {string} id - Firestore document ID
 */
window.openAyamDetail = function(id) {
    const ayam = ayamData.find(a => a.id === id);
    if (!ayam) { Swal.fire('Error', 'Data tidak ditemukan.', 'error'); return; }

    const inputStyle = 'width:100%; padding:8px 10px; border:1px solid #e2e8f0; border-radius:8px; font-size:0.88rem; outline:none; box-sizing:border-box;';
    const labelStyle = 'font-weight:600; color:#64748b; font-size:0.75rem; display:block; margin-bottom:4px; text-transform:uppercase; letter-spacing:0.05em;';

    Swal.fire({
        title: `🐓 Batch ${ayam.customId || id.slice(0, 8)}`,
        html: `
            <div style="text-align:left; font-size:0.9rem;">
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px;">
                <div>
                    <label style="${labelStyle}">Tanggal Masuk</label>
                    <input id="ea-tglMasuk" type="date" value="${ayam.tglMasuk || ''}" style="${inputStyle}">
                </div>
                <div>
                    <label style="${labelStyle}">Jenis Ayam</label>
                    <input id="ea-jenis" value="${ayam.jenis || ''}" style="${inputStyle}">
                </div>
                <div>
                    <label style="${labelStyle}">Jumlah Awal</label>
                    <input id="ea-jumlahAwal" type="number" value="${ayam.jumlahAwal || 0}" style="${inputStyle}">
                </div>
                <div>
                    <label style="${labelStyle}">Sisa Ayam</label>
                    <input id="ea-sisaAyam" type="number" value="${ayam.sisaAyam || 0}" style="${inputStyle}">
                </div>
                <div>
                    <label style="${labelStyle}">Kandang</label>
                    <input id="ea-kandang" value="${ayam.kandang || ''}" style="${inputStyle}">
                </div>
                <div>
                    <label style="${labelStyle}">Status</label>
                    <select id="ea-status" style="${inputStyle}">
                        <option value="Aktif"  ${ayam.status === 'Aktif'  ? 'selected' : ''}>Aktif</option>
                        <option value="Panen"  ${ayam.status === 'Panen'  ? 'selected' : ''}>Panen</option>
                        <option value="Afkir"  ${ayam.status === 'Afkir'  ? 'selected' : ''}>Afkir</option>
                    </select>
                </div>
              </div>
              <p style="margin-top:14px; font-size:0.75rem; color:#94a3b8;">
                Dibuat: ${ayam.createdAt ? new Date(ayam.createdAt).toLocaleString('id-ID') : '-'} &nbsp;|&nbsp;
                ID Dokumen: <code style="background:#f1f5f9; padding:1px 5px; border-radius:4px;">${id}</code>
              </p>
            </div>`,
        width: '580px',
        showDenyButton:   true,
        showCancelButton: true,
        confirmButtonText: '💾 Simpan Perubahan',
        denyButtonText:    '🗑️ Hapus Batch',
        cancelButtonText:  'Tutup',
        confirmButtonColor: '#10b981',
        denyButtonColor:    '#ef4444',
        focusConfirm: false,
        preConfirm: () => {
            const jumlahAwal = parseInt(document.getElementById('ea-jumlahAwal').value) || 0;
            const sisaAyam   = parseInt(document.getElementById('ea-sisaAyam').value)   || 0;
            if (sisaAyam > jumlahAwal) {
                Swal.showValidationMessage('Sisa ayam tidak boleh melebihi jumlah awal!');
                return false;
            }
            return {
                tglMasuk:   document.getElementById('ea-tglMasuk').value,
                jenis:      document.getElementById('ea-jenis').value,
                jumlahAwal, sisaAyam,
                kandang:    document.getElementById('ea-kandang').value,
                status:     document.getElementById('ea-status').value
            };
        }
    }).then(async (result) => {
        if (result.isConfirmed) {
            const konfirmasi = await Swal.fire({
                title: 'Simpan Perubahan?',
                text: 'Pastikan data batch ayam yang Anda ubah sudah benar.',
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Ya, Simpan!',
                cancelButtonText: 'Koreksi Lagi',
                confirmButtonColor: '#10b981'
            });
            if (konfirmasi.isConfirmed) {
                try {
                    await updateDoc(doc(db, "populasi_ayam", id), {
                        ...result.value,
                        updatedAt: serverTimestamp()
                    });
                    Swal.fire({ icon:'success', title:'Berhasil Diperbarui', timer:1500, showConfirmButton:false });
                    logActivity(currentAdminData?.username || 'Admin', 'Data Ayam', `Edit batch ${ayam.customId} via Admin Panel`);
                } catch (err) {
                    Swal.fire('Gagal', err.message, 'error');
                }
            } else if (konfirmasi.dismiss === Swal.DismissReason.cancel) {
                window.openAyamDetail(id);
            }
        } else if (result.isDenied) {
            const konfirm = await Swal.fire({
                title: `Hapus Batch ${ayam.customId}?`,
                text: 'Data batch ini akan dihapus secara permanen!',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#ef4444',
                confirmButtonText: 'Ya, Hapus!',
                cancelButtonText: 'Batal'
            });
            if (konfirm.isConfirmed) {
                await deleteDoc(doc(db, "populasi_ayam", id));
                Swal.fire({ icon:'success', title:'Terhapus', timer:1200, showConfirmButton:false });
                logActivity(currentAdminData?.username || 'Admin', 'Data Ayam', `Hapus batch ${ayam.customId} via Admin Panel`);
            }
        }
    });
};

/**
 * ===== 9. CRUD POPUP: SNAPSHOT KEUANGAN =====
 */

/**
 * Membuka popup detail & edit transaksi keuangan
 * @param {string} id - Firestore document ID
 */
window.openKeuanganDetail = function(id) {
    const trx = keuanganDataAdmin.find(t => t.id === id);
    if (!trx) { Swal.fire('Error', 'Data tidak ditemukan.', 'error'); return; }

    const inputStyle = 'width:100%; padding:8px 10px; border:1px solid #e2e8f0; border-radius:8px; font-size:0.88rem; outline:none; box-sizing:border-box;';
    const labelStyle = 'font-weight:600; color:#64748b; font-size:0.75rem; display:block; margin-bottom:4px; text-transform:uppercase; letter-spacing:0.05em;';
    const typeColor  = trx.tipe === 'pemasukan' ? '#10b981' : '#ef4444';

    Swal.fire({
        title: `💵 Detail Transaksi`,
        html: `
            <div style="text-align:left; font-size:0.9rem;">
              <div style="background:${typeColor}18; border-left:4px solid ${typeColor}; padding:10px 14px; border-radius:8px; margin-bottom:16px;">
                  <strong style="color:${typeColor}; font-size:1.1rem;">
                      ${trx.tipe === 'pemasukan' ? '↑ PEMASUKAN' : '↓ PENGELUARAN'}
                  </strong>
                  &nbsp; Rp ${parseInt(trx.jumlah || 0).toLocaleString('id-ID')}
              </div>
              <div style="display:grid; gap:12px;">
                <div>
                    <label style="${labelStyle}">Tanggal</label>
                    <input id="ek-tanggal" type="date" value="${trx.tanggal || ''}" style="${inputStyle}">
                </div>
                <div>
                    <label style="${labelStyle}">Tipe Transaksi</label>
                    <select id="ek-tipe" style="${inputStyle}">
                        <option value="pemasukan"   ${trx.tipe === 'pemasukan'   ? 'selected' : ''}>Pemasukan</option>
                        <option value="pengeluaran" ${trx.tipe === 'pengeluaran' ? 'selected' : ''}>Pengeluaran</option>
                    </select>
                </div>
                <div>
                    <label style="${labelStyle}">Deskripsi</label>
                    <input id="ek-deskripsi" value="${trx.deskripsi || ''}" style="${inputStyle}">
                </div>
                <div>
                    <label style="${labelStyle}">Jumlah (Rp)</label>
                    <input id="ek-jumlah" type="number" value="${trx.jumlah || 0}" style="${inputStyle}">
                </div>
              </div>
              <p style="margin-top:14px; font-size:0.75rem; color:#94a3b8;">
                  Dibuat: ${trx.createdAt ? new Date(trx.createdAt).toLocaleString('id-ID') : '-'}
              </p>
            </div>`,
        width: '500px',
        showDenyButton:   true,
        showCancelButton: true,
        confirmButtonText: '💾 Simpan',
        denyButtonText:    '🗑️ Hapus',
        cancelButtonText:  'Tutup',
        confirmButtonColor: '#3b82f6',
        denyButtonColor:    '#ef4444',
        focusConfirm: false,
        preConfirm: () => {
            const jumlah = parseFloat(document.getElementById('ek-jumlah').value) || 0;
            if (jumlah <= 0) {
                Swal.showValidationMessage('Jumlah harus lebih dari 0!');
                return false;
            }
            return {
                tanggal:   document.getElementById('ek-tanggal').value,
                tipe:      document.getElementById('ek-tipe').value,
                deskripsi: document.getElementById('ek-deskripsi').value,
                jumlah
            };
        }
    }).then(async (result) => {
        if (result.isConfirmed) {
            const konfirmasi = await Swal.fire({
                title: 'Simpan Perubahan?',
                text: 'Pastikan data transaksi keuangan yang Anda ubah sudah benar.',
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Ya, Simpan!',
                cancelButtonText: 'Koreksi Lagi',
                confirmButtonColor: '#10b981'
            });
            if (konfirmasi.isConfirmed) {
                try {
                    await updateDoc(doc(db, "keuangan", id), {
                        ...result.value,
                        updatedAt: serverTimestamp()
                    });
                    Swal.fire({ icon:'success', title:'Transaksi Diperbarui', timer:1500, showConfirmButton:false });
                    logActivity(currentAdminData?.username || 'Admin', 'Keuangan', `Edit transaksi "${trx.deskripsi}" via Admin Panel`);
                } catch (err) {
                    Swal.fire('Gagal', err.message, 'error');
                }
            } else if (konfirmasi.dismiss === Swal.DismissReason.cancel) {
                window.openKeuanganDetail(id);
            }
        } else if (result.isDenied) {
            const konfirm = await Swal.fire({
                title: 'Hapus Transaksi?',
                text: `"${trx.deskripsi}" akan dihapus secara permanen!`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#ef4444',
                confirmButtonText: 'Ya, Hapus!'
            });
            if (konfirm.isConfirmed) {
                await deleteDoc(doc(db, "keuangan", id));
                Swal.fire({ icon:'success', title:'Terhapus', timer:1200, showConfirmButton:false });
                logActivity(currentAdminData?.username || 'Admin', 'Keuangan', `Hapus transaksi "${trx.deskripsi}" via Admin Panel`);
            }
        }
    });
};
/**
 * ===== 10. EDIT AKUN PENGGUNA =====
 */

/**
 * Membuka modal untuk mengedit informasi akun pengguna
 * @param {string} uid - ID Dokumen User di Firestore
 */
window.openEditUserModal = async function(uid) {
    // Mencari data user dari state lokal (opsional, atau ambil langsung dari Firestore)
    // Untuk keakuratan, kita ambil data terbaru dari Firestore
    Swal.fire({
        title: 'Memuat Data...',
        didOpen: () => { Swal.showLoading(); }
    });

    try {
        const userSnap = await getDoc(doc(db, "user", uid));
        if (!userSnap.exists()) {
            Swal.fire('Error', 'Data pengguna tidak ditemukan!', 'error');
            return;
        }
        const user = userSnap.data();

        Swal.fire({
            title: 'Edit Profil Pengguna',
            html: `
                <div class="swal-libas-container">
                    <div class="swal-libas-field">
                        <label class="swal-libas-label">👤 Nama Lengkap</label>
                        <div class="swal-libas-input-wrapper">
                            <span class="swal-libas-icon">📝</span>
                            <input id="edit-fullname" class="swal-libas-input" value="${user.fullname || ''}" placeholder="Nama Terang">
                        </div>
                    </div>
                    <div class="swal-libas-field">
                        <label class="swal-libas-label">🆔 Username</label>
                        <div class="swal-libas-input-wrapper">
                            <span class="swal-libas-icon">@</span>
                            <input id="edit-username" class="swal-libas-input" value="${user.username || ''}" placeholder="username">
                        </div>
                    </div>
                    <div class="swal-libas-field">
                        <label class="swal-libas-label">📧 Email</label>
                        <div class="swal-libas-input-wrapper">
                            <span class="swal-libas-icon">✉️</span>
                            <input id="edit-email" type="email" class="swal-libas-input" value="${user.email || ''}" placeholder="email@peternakan.com">
                        </div>
                    </div>
                    <div class="swal-libas-field">
                        <label class="swal-libas-label">🛡️ Status Akses</label>
                        <div class="swal-libas-input-wrapper">
                            <span class="swal-libas-icon">🔒</span>
                            <select id="edit-status" class="swal-libas-select">
                                <option value="false" ${user.disabled === false ? 'selected' : ''}>Aktif (Bisa Login)</option>
                                <option value="true" ${user.disabled === true ? 'selected' : ''}>Nonaktif (Blokir Akses)</option>
                            </select>
                        </div>
                    </div>
                    <div class="swal-libas-field" style="margin-top: 10px; border-top: 1px solid #f1f5f9; padding-top: 15px;">
                        <label class="swal-libas-label" style="color: #ef4444;">🔑 Keamanan Akun</label>
                        <button type="button" onclick="sendResetEmail('${user.email}')" 
                                style="background: #fef2f2; color: #ef4444; border: 1px solid #fee2e2; padding: 8px; border-radius: 8px; font-size: 0.8rem; cursor: pointer; font-weight: 600; width: 100%; transition: all 0.2s;">
                            📧 Kirim Email Reset Password
                        </button>
                        <p style="font-size: 0.7rem; color: #94a3b8; margin-top: 5px;">*Link pembuatan password baru akan dikirim ke email pengguna.</p>
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Simpan Perubahan',
            cancelButtonText: 'Batal',
            confirmButtonColor: '#10b981',
            preConfirm: () => {
                const fullname = document.getElementById('edit-fullname').value;
                const username = document.getElementById('edit-username').value;
                const email = document.getElementById('edit-email').value;
                const disabled = document.getElementById('edit-status').value === 'true';

                if (!fullname || !username || !email) {
                    Swal.showValidationMessage('Nama, Username, dan Email wajib diisi!');
                    return false;
                }
                return { fullname, username, email, disabled };
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await updateDoc(doc(db, "user", uid), {
                        ...result.value,
                        updatedAt: serverTimestamp()
                    });
                    
                    // Jika user adalah admin, update juga koleksi admin
                    if (user.role === 'admin') {
                        await updateDoc(doc(db, "admin", uid), {
                            fullname: result.value.fullname,
                            username: result.value.username,
                            email: result.value.email
                        });
                    }

                    Swal.fire('Berhasil', 'Informasi akun telah diperbarui.', 'success');
                    logActivity(currentAdminData?.username || "Admin", "Akses Pengguna", `Update data akun: ${result.value.fullname} (@${result.value.username})`);
                } catch (err) {
                    Swal.fire('Gagal Update', err.message, 'error');
                }
            }
        });
    } catch (err) {
        Swal.fire('Error', 'Gagal memuat data: ' + err.message, 'error');
    }
};

/**
 * Mengirimkan email reset password kepada pengguna
 * @param {string} email - Alamat email pengguna
 */
window.sendResetEmail = async function(email) {
    const confirm = await Swal.fire({
        title: 'Kirim Reset Password?',
        text: `Tautan untuk membuat password baru akan dikirim ke ${email}.`,
        icon: 'info',
        showCancelButton: true,
        confirmButtonText: 'Ya, Kirim Email',
        cancelButtonText: 'Batal'
    });

    if (confirm.isConfirmed) {
        Swal.fire({ title: 'Mengirim...', didOpen: () => { Swal.showLoading(); } });
        try {
            await sendPasswordResetEmail(auth, email);
            Swal.fire('Terkirim!', 'Email instruksi reset password telah dikirim.', 'success');
            logActivity(currentAdminData?.username || "Admin", "Keamanan", `Kirim reset password ke: ${email}`);
        } catch (err) {
            Swal.fire('Gagal', err.message, 'error');
        }
    }
};

/**
 * ===== 11. MANAJEMEN ROLE (PROMOTE/DEMOTE) =====
 */

/**
 * Mengubah role pengguna antara Admin dan User
 * @param {string} uid - ID Dokumen User
 * @param {string} currentRole - Role saat ini ('admin' atau 'user')
 */
window.toggleAdminRole = async function(uid, currentRole) {
    const roleLower = (currentRole || 'user').trim().toLowerCase();
    const newRole = (roleLower === 'admin' || roleLower === 'administrator') ? 'user' : 'admin';
    const actionText = newRole === 'admin' ? 'Naikkan ke Admin' : 'Turunkan ke User';
    
    const confirm = await Swal.fire({
        title: `${actionText}?`,
        text: `Apakah Anda yakin ingin mengubah hak akses pengguna ini menjadi ${newRole.toUpperCase()}?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Ya, Ubah Role',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#3b82f6'
    });

    if (confirm.isConfirmed) {
        Swal.fire({ title: 'Memproses...', didOpen: () => { Swal.showLoading(); } });
        
        try {
            // 1. Update di koleksi 'user'
            await updateDoc(doc(db, "user", uid), {
                role: newRole,
                updatedAt: serverTimestamp()
            });

            // 2. Sinkronisasi dengan koleksi 'admin'
            if (newRole === 'admin') {
                // Jika naik jadi admin, ambil data user dulu
                const userSnap = await getDoc(doc(db, "user", uid));
                const userData = userSnap.data();
                
                // Tambahkan ke koleksi admin
                await setDoc(doc(db, "admin", uid), {
                    uid: uid,
                    fullname: userData.fullname || 'Tanpa Nama',
                    username: userData.username || 'user',
                    email: userData.email,
                    role: 'admin',
                    promotedAt: serverTimestamp(),
                    promotedBy: currentAdminData?.username || 'System'
                });
            } else {
                // Jika turun jadi user, hapus dari koleksi admin
                await deleteDoc(doc(db, "admin", uid));
            }

            Swal.fire('Berhasil', `Role pengguna telah diubah menjadi ${newRole.toUpperCase()}.`, 'success');
            logActivity(currentAdminData?.username || "Admin", "Akses Pengguna", `Ubah role user [${uid}] menjadi ${newRole.toUpperCase()}`);
        } catch (err) {
            Swal.fire('Gagal', err.message, 'error');
        }
    }
};

/**
 * ===== 12. FITUR REKONSILIASI DATA (SYNC) =====
 */

/**
 * Melakukan sinkronisasi antara koleksi 'admin' dan 'user'
 * Berguna jika ada akun admin yang terdaftar di sistem otoritas tapi hilang dari daftar pengguna utama.
 */
window.syncAdminAccounts = async function() {
    Swal.fire({
        title: 'Sinkronisasi Data...',
        text: 'Memeriksa konsistensi antara data Otoritas dan data Pengguna.',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    try {
        // 1. Ambil semua data dari koleksi admin
        const adminSnap = await getDocs(collection(db, "admin"));
        const allAdmins = adminSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        let fixedCount = 0;

        // 2. Cek satu per satu di koleksi user
        for (const admin of allAdmins) {
            const userRef = doc(db, "user", admin.id);
            const userSnap = await getDoc(userRef);

            if (!userSnap.exists()) {
                // DATA HILANG! Mari kita buatkan kembali entri di koleksi user
                await setDoc(userRef, {
                    fullname: admin.fullname || 'Admin System',
                    username: admin.username || 'admin',
                    email: admin.email || 'admin@peternakan.com',
                    role: 'admin',
                    disabled: false,
                    createdAt: admin.promotedAt || serverTimestamp(),
                    isSynced: true // Penanda bahwa data ini hasil sinkronisasi
                });
                fixedCount++;
            }
        }

        if (fixedCount > 0) {
            Swal.fire({
                icon: 'success',
                title: 'Sinkronisasi Berhasil',
                text: `${fixedCount} akun admin yang tersembunyi telah berhasil dipulihkan ke daftar utama.`,
                confirmButtonColor: '#10b981'
            });
            logActivity(currentAdminData?.username || "Admin", "Sistem", `Melakukan sinkronisasi data: ${fixedCount} akun dipulihkan.`);
        } else {
            Swal.fire({
                icon: 'info',
                title: 'Data Sudah Akurat',
                text: 'Seluruh akun admin sudah tersinkronisasi dengan benar di daftar pengguna.',
                confirmButtonColor: '#3b82f6'
            });
        }
    } catch (err) {
        console.error("Sync Error:", err);
        Swal.fire('Gagal Sinkron', err.message, 'error');
    }
};

/**
 * ===== 13. CRUD POPUP: SNAPSHOT LAINNYA =====
 */

window.openProduksiDetail = function(id) {
    const data = produksiDataAdmin.find(d => d.id === id);
    if (!data) { Swal.fire('Error', 'Data tidak ditemukan.', 'error'); return; }
    
    const inputStyle = 'width:100%; padding:8px 10px; border:1px solid #e2e8f0; border-radius:8px; font-size:0.88rem; outline:none; box-sizing:border-box;';
    const labelStyle = 'font-weight:600; color:#64748b; font-size:0.75rem; display:block; margin-bottom:4px; text-transform:uppercase; letter-spacing:0.05em;';

    Swal.fire({
        title: '🥚 Detail Produksi',
        html: `
            <div style="text-align:left; font-size:0.9rem;">
                <div style="background:#fb850018; border-left:4px solid #fb8500; padding:10px 14px; border-radius:8px; margin-bottom:16px;">
                    <strong style="color:#fb8500; font-size:1.1rem;">TOTAL: ${parseInt(data.totalTelur || 0).toLocaleString('id-ID')} Butir</strong>
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px;">
                    <div>
                        <label style="${labelStyle}">Tanggal</label>
                        <input id="ep-tanggal" type="date" value="${data.tanggal || ''}" style="${inputStyle}">
                    </div>
                    <div>
                        <label style="${labelStyle}">Telur Baik</label>
                        <input id="ep-baik" type="number" value="${data.telurBaik || 0}" style="${inputStyle}">
                    </div>
                    <div>
                        <label style="${labelStyle}">Telur Cacat</label>
                        <input id="ep-cacat" type="number" value="${data.telurCacat || 0}" style="${inputStyle}">
                    </div>
                </div>
            </div>
        `,
        width: '500px',
        showDenyButton: true,
        showCancelButton: true,
        confirmButtonText: '💾 Simpan',
        denyButtonText: '🗑️ Hapus',
        cancelButtonText: 'Tutup',
        confirmButtonColor: '#10b981',
        denyButtonColor: '#ef4444',
        focusConfirm: false,
        preConfirm: () => {
            const telurBaik = parseInt(document.getElementById('ep-baik').value) || 0;
            const telurCacat = parseInt(document.getElementById('ep-cacat').value) || 0;
            return {
                tanggal: document.getElementById('ep-tanggal').value,
                telurBaik: telurBaik,
                telurCacat: telurCacat,
                totalTelur: telurBaik + telurCacat
            };
        }
    }).then(async (result) => {
        if (result.isConfirmed) {
            // Konfirmasi sebelum menyimpan
            const konfirmasi = await Swal.fire({
                title: 'Simpan Perubahan?',
                text: 'Pastikan data produksi yang Anda masukkan sudah benar.',
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Ya, Simpan!',
                cancelButtonText: 'Koreksi Lagi',
                confirmButtonColor: '#10b981'
            });
            if (konfirmasi.isConfirmed) {
                Swal.fire({ title: 'Menyimpan...', didOpen: () => { Swal.showLoading(); } });
                try {
                    await updateDoc(doc(db, "produksi_harian", id), { ...result.value, updatedAt: serverTimestamp() });
                    Swal.fire('Tersimpan!', 'Data produksi berhasil diperbarui.', 'success');
                } catch (err) { Swal.fire('Error', err.message, 'error'); }
            } else if (konfirmasi.dismiss === Swal.DismissReason.cancel) {
                window.openProduksiDetail(id);
            }
        } else if (result.isDenied) {
            const confirm = await Swal.fire({
                title: 'Hapus Data?', text: 'Data produksi ini akan dihapus permanen!', icon: 'warning',
                showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Ya, Hapus!'
            });
            if (confirm.isConfirmed) {
                try {
                    await deleteDoc(doc(db, "produksi_harian", id));
                    Swal.fire('Terhapus!', 'Data produksi telah dihapus.', 'success');
                } catch (err) { Swal.fire('Error', err.message, 'error'); }
            }
        }
    });
};

window.openPakanDetail = function(id) {
    const data = pakanDataAdmin.find(d => d.id === id);
    if (!data) { Swal.fire('Error', 'Data tidak ditemukan.', 'error'); return; }
    
    const inputStyle = 'width:100%; padding:8px 10px; border:1px solid #e2e8f0; border-radius:8px; font-size:0.88rem; outline:none; box-sizing:border-box;';
    const labelStyle = 'font-weight:600; color:#64748b; font-size:0.75rem; display:block; margin-bottom:4px; text-transform:uppercase; letter-spacing:0.05em;';
    const typeColor = data.tipe === 'Masuk' ? '#10b981' : '#ef4444';

    Swal.fire({
        title: '🥬 Detail Stok Pakan',
        html: `
            <div style="text-align:left; font-size:0.9rem;">
                <div style="background:${typeColor}18; border-left:4px solid ${typeColor}; padding:10px 14px; border-radius:8px; margin-bottom:16px;">
                    <strong style="color:${typeColor}; font-size:1.1rem;">${(data.tipe || '').toUpperCase()}</strong>
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px;">
                    <div>
                        <label style="${labelStyle}">Tanggal</label>
                        <input id="ek-tanggal" type="date" value="${data.tanggal || ''}" style="${inputStyle}">
                    </div>
                    <div>
                        <label style="${labelStyle}">Barang/Pakan</label>
                        <input id="ek-barang" value="${data.namaBarang || ''}" style="${inputStyle}">
                    </div>
                    <div>
                        <label style="${labelStyle}">Jumlah</label>
                        <input id="ek-jumlah" type="number" value="${data.jumlah || 0}" style="${inputStyle}">
                    </div>
                    <div>
                        <label style="${labelStyle}">Tipe</label>
                        <select id="ek-tipe" style="${inputStyle}">
                            <option value="Masuk" ${data.tipe === 'Masuk' ? 'selected' : ''}>Masuk</option>
                            <option value="Keluar" ${data.tipe === 'Keluar' ? 'selected' : ''}>Keluar</option>
                        </select>
                    </div>
                </div>
            </div>
        `,
        width: '500px',
        showDenyButton: true, showCancelButton: true,
        confirmButtonText: '💾 Simpan', denyButtonText: '🗑️ Hapus', cancelButtonText: 'Tutup',
        confirmButtonColor: '#10b981', denyButtonColor: '#ef4444', focusConfirm: false,
        preConfirm: () => {
            return {
                tanggal: document.getElementById('ek-tanggal').value,
                namaBarang: document.getElementById('ek-barang').value,
                jumlah: parseFloat(document.getElementById('ek-jumlah').value) || 0,
                tipe: document.getElementById('ek-tipe').value
            };
        }
    }).then(async (result) => {
        if (result.isConfirmed) {
            const konfirmasi = await Swal.fire({
                title: 'Simpan Perubahan?',
                text: 'Pastikan data stok pakan yang Anda masukkan sudah benar.',
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Ya, Simpan!',
                cancelButtonText: 'Koreksi Lagi',
                confirmButtonColor: '#10b981'
            });
            if (konfirmasi.isConfirmed) {
                Swal.fire({ title: 'Menyimpan...', didOpen: () => { Swal.showLoading(); } });
                try {
                    await updateDoc(doc(db, "stok_pakan", id), { ...result.value, updatedAt: serverTimestamp() });
                    Swal.fire('Tersimpan!', 'Data stok pakan berhasil diperbarui.', 'success');
                } catch (err) { Swal.fire('Error', err.message, 'error'); }
            } else if (konfirmasi.dismiss === Swal.DismissReason.cancel) {
                window.openPakanDetail(id);
            }
        } else if (result.isDenied) {
            const confirm = await Swal.fire({ title: 'Hapus Data?', text: 'Data akan dihapus permanen!', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Ya, Hapus!' });
            if (confirm.isConfirmed) {
                try {
                    await deleteDoc(doc(db, "stok_pakan", id));
                    Swal.fire('Terhapus!', 'Data stok pakan dihapus.', 'success');
                } catch (err) { Swal.fire('Error', err.message, 'error'); }
            }
        }
    });
};

window.openKesehatanDetail = function(id) {
    const data = kesehatanDataAdmin.find(d => d.id === id);
    if (!data) { Swal.fire('Error', 'Data tidak ditemukan.', 'error'); return; }
    
    const inputStyle = 'width:100%; padding:8px 10px; border:1px solid #e2e8f0; border-radius:8px; font-size:0.88rem; outline:none; box-sizing:border-box;';
    const labelStyle = 'font-weight:600; color:#64748b; font-size:0.75rem; display:block; margin-bottom:4px; text-transform:uppercase; letter-spacing:0.05em;';

    Swal.fire({
        title: '🩺 Detail Kesehatan',
        html: `
            <div style="text-align:left; font-size:0.9rem;">
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px;">
                    <div>
                        <label style="${labelStyle}">Tanggal</label>
                        <input id="eh-tanggal" type="date" value="${data.tanggal || ''}" style="${inputStyle}">
                    </div>
                    <div>
                        <label style="${labelStyle}">Jml Kematian (Ekor)</label>
                        <input id="eh-mati" type="number" value="${data.jmlMati || 0}" style="${inputStyle}">
                    </div>
                    <div style="grid-column: span 2;">
                        <label style="${labelStyle}">Penyebab/Gejala</label>
                        <input id="eh-sebab" value="${data.sebab || ''}" style="${inputStyle}">
                    </div>
                </div>
            </div>
        `,
        width: '500px', showDenyButton: true, showCancelButton: true,
        confirmButtonText: '💾 Simpan', denyButtonText: '🗑️ Hapus', cancelButtonText: 'Tutup',
        confirmButtonColor: '#10b981', denyButtonColor: '#ef4444', focusConfirm: false,
        preConfirm: () => {
            return {
                tanggal: document.getElementById('eh-tanggal').value,
                jmlMati: parseInt(document.getElementById('eh-mati').value) || 0,
                sebab: document.getElementById('eh-sebab').value
            };
        }
    }).then(async (result) => {
        if (result.isConfirmed) {
            const konfirmasi = await Swal.fire({
                title: 'Simpan Perubahan?',
                text: 'Pastikan data laporan kesehatan yang Anda masukkan sudah benar.',
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Ya, Simpan!',
                cancelButtonText: 'Koreksi Lagi',
                confirmButtonColor: '#10b981'
            });
            if (konfirmasi.isConfirmed) {
                Swal.fire({ title: 'Menyimpan...', didOpen: () => { Swal.showLoading(); } });
                try {
                    await updateDoc(doc(db, "kesehatan_ayam", id), { ...result.value, updatedAt: serverTimestamp() });
                    Swal.fire('Tersimpan!', 'Laporan kesehatan berhasil diperbarui.', 'success');
                } catch (err) { Swal.fire('Error', err.message, 'error'); }
            } else if (konfirmasi.dismiss === Swal.DismissReason.cancel) {
                window.openKesehatanDetail(id);
            }
        } else if (result.isDenied) {
            const confirm = await Swal.fire({ title: 'Hapus Data?', text: 'Data laporan kesehatan akan dihapus permanen!', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Ya, Hapus!' });
            if (confirm.isConfirmed) {
                try {
                    await deleteDoc(doc(db, "kesehatan_ayam", id));
                    Swal.fire('Terhapus!', 'Data dihapus.', 'success');
                } catch (err) { Swal.fire('Error', err.message, 'error'); }
            }
        }
    });
};

window.openVaksinDetail = function(id) {
    const data = vaksinDataAdmin.find(d => d.id === id);
    if (!data) { Swal.fire('Error', 'Data tidak ditemukan.', 'error'); return; }
    
    const inputStyle = 'width:100%; padding:8px 10px; border:1px solid #e2e8f0; border-radius:8px; font-size:0.88rem; outline:none; box-sizing:border-box;';
    const labelStyle = 'font-weight:600; color:#64748b; font-size:0.75rem; display:block; margin-bottom:4px; text-transform:uppercase; letter-spacing:0.05em;';

    Swal.fire({
        title: '💉 Jadwal Vaksinasi',
        html: `
            <div style="text-align:left; font-size:0.9rem;">
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px;">
                    <div>
                        <label style="${labelStyle}">Tanggal</label>
                        <input id="ev-tanggal" type="date" value="${data.tanggal || ''}" style="${inputStyle}">
                    </div>
                    <div>
                        <label style="${labelStyle}">Nama Vaksin</label>
                        <input id="ev-nama" value="${data.namaVaksin || ''}" style="${inputStyle}">
                    </div>
                    <div style="grid-column: span 2;">
                        <label style="${labelStyle}">Status Vaksinasi</label>
                        <select id="ev-status" style="${inputStyle}">
                            <option value="Terjadwal" ${data.status === 'Terjadwal' ? 'selected' : ''}>Terjadwal</option>
                            <option value="Selesai" ${data.status === 'Selesai' ? 'selected' : ''}>Selesai</option>
                        </select>
                    </div>
                </div>
            </div>
        `,
        width: '500px', showDenyButton: true, showCancelButton: true,
        confirmButtonText: '💾 Simpan', denyButtonText: '🗑️ Hapus', cancelButtonText: 'Tutup',
        confirmButtonColor: '#10b981', denyButtonColor: '#ef4444', focusConfirm: false,
        preConfirm: () => {
            return {
                tanggal: document.getElementById('ev-tanggal').value,
                namaVaksin: document.getElementById('ev-nama').value,
                status: document.getElementById('ev-status').value
            };
        }
    }).then(async (result) => {
        if (result.isConfirmed) {
            const konfirmasi = await Swal.fire({
                title: 'Simpan Perubahan?',
                text: 'Pastikan jadwal vaksinasi yang Anda masukkan sudah benar.',
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Ya, Simpan!',
                cancelButtonText: 'Koreksi Lagi',
                confirmButtonColor: '#10b981'
            });
            if (konfirmasi.isConfirmed) {
                Swal.fire({ title: 'Menyimpan...', didOpen: () => { Swal.showLoading(); } });
                try {
                    await updateDoc(doc(db, "vaksinasi_ayam", id), { ...result.value, updatedAt: serverTimestamp() });
                    Swal.fire('Tersimpan!', 'Jadwal vaksinasi berhasil diperbarui.', 'success');
                } catch (err) { Swal.fire('Error', err.message, 'error'); }
            } else if (konfirmasi.dismiss === Swal.DismissReason.cancel) {
                window.openVaksinDetail(id);
            }
        } else if (result.isDenied) {
            const confirm = await Swal.fire({ title: 'Hapus Data?', text: 'Jadwal ini akan dihapus permanen!', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Ya, Hapus!' });
            if (confirm.isConfirmed) {
                try {
                    await deleteDoc(doc(db, "vaksinasi_ayam", id));
                    Swal.fire('Terhapus!', 'Data dihapus.', 'success');
                } catch (err) { Swal.fire('Error', err.message, 'error'); }
            }
        }
    });
};

/**
 * ===== 14. SISTEM TABS SNAPSHOT =====
 */
window.openSnapshotTab = function(evt, tabName) {
    // Sembunyikan semua tab content
    const tabPanes = document.getElementsByClassName("tab-pane");
    for (let i = 0; i < tabPanes.length; i++) {
        tabPanes[i].style.display = "none";
        tabPanes[i].classList.remove("active");
    }

    // Hapus class 'active' dari semua tombol
    const tabBtns = document.getElementsByClassName("tab-btn");
    for (let i = 0; i < tabBtns.length; i++) {
        tabBtns[i].classList.remove("active");
    }

    // Tampilkan tab yang dipilih
    const selectedTab = document.getElementById(tabName);
    if (selectedTab) {
        selectedTab.style.display = "block";
        selectedTab.classList.add("active");
    }

    // Tambahkan class 'active' pada tombol yang diklik
    if (evt && evt.currentTarget) {
        evt.currentTarget.classList.add("active");
    }
};

/**
 * ===== 15. FITUR LIVE SEARCH =====
 */
window.filterUserList = function() {
    const input = document.getElementById("searchUserInput").value.toLowerCase();
    const rows = document.querySelectorAll("#adminUserListBody tr:not(.skeleton-row)");
    rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        row.style.display = text.includes(input) ? "" : "none";
    });
};

window.filterLogList = function() {
    const input = document.getElementById("searchLogInput").value.toLowerCase();
    const rows = document.querySelectorAll("#systemLogBody tr:not(.skeleton-row)");
    rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        row.style.display = text.includes(input) ? "" : "none";
    });
};
// =========================================================
// ✅ FASE 3: SYSTEM HEALTH INDICATORS (ADMIN ONLY)
// =========================================================

let adminSystemHealthData = {
    syncStatus: 'normal',
    lastUpdate: new Date(),
    warningsCount: 0,
    performance: 'optimal',
    details: []
};

/**
 * Update System Health Indicators for Admin Panel
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

    // Update last update time
    adminSystemHealthData.lastUpdate = new Date();
    
    // Check system warnings and collect details
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
        details.push({
            type: 'warning',
            icon: '🥬',
            title: 'Stok Pakan Kritis',
            message: `Sisa pakan hanya ${sisaPakan.toLocaleString('id-ID')} Kg (< 50 Kg)`
        });
    } else if (sisaPakan < 100) {
        details.push({
            type: 'info',
            icon: '🥬',
            title: 'Stok Pakan Rendah',
            message: `Sisa pakan ${sisaPakan.toLocaleString('id-ID')} Kg (< 100 Kg)`
        });
    }
    
    // Check sick chickens
    const ayamSakit = kesehatanDataAdmin.filter(x => x.status === "Dalam Perawatan")
                                        .reduce((sum, item) => sum + (parseInt(item.jmlSakit) || 0), 0);
    if (ayamSakit > 0) {
        warnings++;
        const persentase = cachedTotalSisaAyam > 0 ? ((ayamSakit / cachedTotalSisaAyam) * 100).toFixed(1) : 0;
        details.push({
            type: persentase >= 5 ? 'error' : 'warning',
            icon: '🩺',
            title: 'Ayam Sakit Terdeteksi',
            message: `${ayamSakit.toLocaleString('id-ID')} ekor sakit (${persentase}% dari populasi)`
        });
    }
    
    // Check production today
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const prodToday = produksiDataAdmin.filter(p => p.tanggal === todayStr);
    if (prodToday.length === 0) {
        warnings++;
        details.push({
            type: 'warning',
            icon: '🥚',
            title: 'Belum Ada Input Produksi',
            message: `Belum ada data produksi untuk hari ini (${today.toLocaleDateString('id-ID')})`
        });
    }
    
    // Check user count (if very low)
    const userCount = document.getElementById('stat-user')?.textContent || '0';
    const userNum = parseInt(userCount.replace(/\D/g, ''));
    if (userNum < 2) {
        details.push({
            type: 'info',
            icon: '👥',
            title: 'Pengguna Terbatas',
            message: `Hanya ${userNum} pengguna terdaftar dalam sistem`
        });
    }
    
    // Check mortalitas rate
    const totalMati = kesehatanDataAdmin.reduce((sum, item) => {
        if (item.status === 'Mati Semua') {
            return sum + (parseInt(item.jmlSakit) || 0) + (parseInt(item.jmlMati) || 0);
        }
        return sum + (parseInt(item.jmlMati) || 0);
    }, 0);
    
    if (totalMati > 0 && cachedTotalSisaAyam > 0) {
        const mortalityRate = (totalMati / (cachedTotalSisaAyam + totalMati)) * 100;
        if (mortalityRate > 10) {
            warnings++;
            details.push({
                type: 'error',
                icon: '💀',
                title: 'Tingkat Mortalitas Tinggi',
                message: `Mortalitas ${mortalityRate.toFixed(1)}% (${totalMati} ekor dari ${cachedTotalSisaAyam + totalMati} total)`
            });
        } else if (mortalityRate > 5) {
            details.push({
                type: 'warning',
                icon: '💀',
                title: 'Mortalitas Perlu Perhatian',
                message: `Mortalitas ${mortalityRate.toFixed(1)}% (${totalMati} ekor)`
            });
        }
    }
    
    adminSystemHealthData.warningsCount = warnings;
    adminSystemHealthData.details = details;
    
    // Determine overall status
    let overallStatus = 'Sistem Berjalan Normal';
    let indicatorColor = '#10b981';
    let statusColor = '#10b981';
    
    if (warnings >= 3) {
        overallStatus = 'Perlu Perhatian Segera';
        indicatorColor = '#ef4444';
        statusColor = '#ef4444';
        adminSystemHealthData.performance = 'Perlu Perbaikan';
    } else if (warnings >= 1) {
        overallStatus = 'Ada Peringatan Aktif';
        indicatorColor = '#f59e0b';
        statusColor = '#f59e0b';
        adminSystemHealthData.performance = 'Baik';
    } else {
        adminSystemHealthData.performance = 'Optimal';
    }
    
    // Update UI
    statusEl.textContent = overallStatus;
    statusEl.style.color = statusColor;
    indicatorEl.style.background = indicatorColor;
    indicatorEl.style.boxShadow = `0 0 10px ${indicatorColor}50`;
    
    syncEl.textContent = '🟢 Normal';
    updateEl.textContent = adminSystemHealthData.lastUpdate.toLocaleTimeString('id-ID', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    warningsEl.textContent = warnings === 0 ? 'Tidak Ada' : `${warnings} Issues`;
    warningsBadgeEl.textContent = warnings.toString();
    warningsBadgeEl.style.background = warnings >= 3 ? '#ef4444' : warnings >= 1 ? '#f59e0b' : 'rgba(255,255,255,0.2)';
    performanceEl.textContent = adminSystemHealthData.performance;
    
    // Update details section
    if (details.length > 0) {
        detailsEl.style.display = 'block';
        detailsContentEl.innerHTML = details.map(detail => {
            let bgColor = '#f1f5f9';
            let borderColor = '#cbd5e1';
            
            if (detail.type === 'error') {
                bgColor = '#fee2e2';
                borderColor = '#ef4444';
            } else if (detail.type === 'warning') {
                bgColor = '#fef3c7';
                borderColor = '#f59e0b';
            } else if (detail.type === 'info') {
                bgColor = '#dbeafe';
                borderColor = '#3b82f6';
            }
            
            return `
                <div style="background: ${bgColor}; border-left: 3px solid ${borderColor}; padding: 0.75rem; margin-bottom: 0.5rem; border-radius: 4px;">
                    <div style="display: flex; align-items: start; gap: 0.5rem;">
                        <span style="font-size: 1.2rem;">${detail.icon}</span>
                        <div>
                            <strong style="color: #1e293b; font-size: 0.9rem;">${detail.title}</strong>
                            <p style="margin: 0.25rem 0 0 0; color: #475569; font-size: 0.85rem;">${detail.message}</p>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    } else {
        detailsEl.style.display = 'none';
    }
}

// Add to existing initAdminDashboard function
const originalInitAdminDashboard = initAdminDashboard;
initAdminDashboard = function() {
    originalInitAdminDashboard();
    
    // Update system health every 30 seconds
    setInterval(updateAdminSystemHealthIndicators, 30000);
    
    // Initial update after 2 seconds to ensure data is loaded
    setTimeout(updateAdminSystemHealthIndicators, 2000);
};

console.log("🔧 Admin System Health Indicators Loaded");
// =========================================================
// ✅ FASE 3: COMPREHENSIVE FEED STOCK MANAGEMENT (ADMIN)
// =========================================================

let adminFeedData = {
    currentStock: 0,
    dailyUsage: 10, // Default 10kg per day
    estimatedDays: 0,
    stockValue: 0,
    pricePerKg: 5000, // Default Rp 5000 per kg
    alerts: []
};

/**
 * Update Admin Feed Stock Management
 */
function updateAdminFeedStockManagement() {
    // Calculate current stock
    let pakanMasuk = 0, pakanKeluar = 0;
    pakanDataAdmin.forEach(p => {
        if (p.tipe === 'Masuk') pakanMasuk += p.jumlah;
        else pakanKeluar += p.jumlah;
    });
    
    adminFeedData.currentStock = pakanMasuk - pakanKeluar;
    
    // Calculate daily usage based on recent data (last 7 days)
    const last7Days = pakanDataAdmin
        .filter(p => p.tipe === 'Keluar')
        .filter(p => {
            const date = new Date(p.tanggal);
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            return date >= weekAgo;
        });
    
    if (last7Days.length > 0) {
        const totalUsage = last7Days.reduce((sum, p) => sum + p.jumlah, 0);
        adminFeedData.dailyUsage = Math.round(totalUsage / 7);
    }
    
    // Calculate estimated days
    adminFeedData.estimatedDays = adminFeedData.dailyUsage > 0 ? 
        Math.floor(adminFeedData.currentStock / adminFeedData.dailyUsage) : 0;
    
    // Calculate stock value
    adminFeedData.stockValue = adminFeedData.currentStock * adminFeedData.pricePerKg;
    
    // Update UI elements
    updateAdminFeedUI();
    checkAdminFeedAlerts();
}

/**
 * Update Admin Feed UI Elements
 */
function updateAdminFeedUI() {
    const currentEl = document.getElementById('admin-feed-current');
    const usageEl = document.getElementById('admin-feed-daily-usage');
    const estimatedEl = document.getElementById('admin-feed-estimated');
    const valueEl = document.getElementById('admin-feed-value');
    const statusEl = document.getElementById('admin-feed-status-text');
    const indicatorEl = document.getElementById('admin-feed-status-indicator');
    const urgencyBadgeEl = document.getElementById('admin-feed-urgency-badge');
    
    if (!currentEl) return;
    
    // Update values
    currentEl.textContent = `${adminFeedData.currentStock.toLocaleString('id-ID')} Kg`;
    usageEl.textContent = `~${adminFeedData.dailyUsage} Kg/hari`;
    estimatedEl.textContent = `${adminFeedData.estimatedDays} Hari`;
    valueEl.textContent = `Rp ${adminFeedData.stockValue.toLocaleString('id-ID')}`;
    
    // Determine status and colors
    let status = 'Stok Aman';
    let statusColor = '#10b981';
    let urgencyText = 'NORMAL';
    let urgencyColor = 'rgba(255,255,255,0.2)';
    
    if (adminFeedData.estimatedDays <= 2) {
        status = 'KRITIS!';
        statusColor = '#ef4444';
        urgencyText = 'KRITIS';
        urgencyColor = '#ef4444';
    } else if (adminFeedData.estimatedDays <= 5) {
        status = 'Stok Rendah';
        statusColor = '#f59e0b';
        urgencyText = 'RENDAH';
        urgencyColor = '#f59e0b';
    } else if (adminFeedData.estimatedDays <= 10) {
        status = 'Perlu Perhatian';
        statusColor = '#f59e0b';
        urgencyText = 'WATCH';
        urgencyColor = '#f59e0b';
    }
    
    // Update status
    statusEl.textContent = status;
    statusEl.style.color = statusColor;
    indicatorEl.style.background = statusColor;
    urgencyBadgeEl.textContent = urgencyText;
    urgencyBadgeEl.style.background = urgencyColor;
}

/**
 * Check and show admin feed alerts
 */
function checkAdminFeedAlerts() {
    const alertsEl = document.getElementById('admin-feed-alerts');
    const contentEl = document.getElementById('admin-feed-alert-content');
    
    if (!alertsEl || !contentEl) return;
    
    adminFeedData.alerts = [];
    
    // Critical stock alert
    if (adminFeedData.currentStock <= 20) {
        adminFeedData.alerts.push({
            level: 'critical',
            title: 'Stok Pakan Kritis',
            message: `Hanya tersisa ${adminFeedData.currentStock} Kg pakan. Sistem akan kehabisan dalam ${adminFeedData.estimatedDays} hari.`,
            action: 'Beli pakan segera untuk mencegah gangguan operasional.'
        });
    } else if (adminFeedData.currentStock <= 50) {
        adminFeedData.alerts.push({
            level: 'warning',
            title: 'Stok Pakan Rendah',
            message: `Stok pakan tersisa ${adminFeedData.currentStock} Kg (${adminFeedData.estimatedDays} hari).`,
            action: 'Rencanakan pembelian pakan dalam 2-3 hari ke depan.'
        });
    } else if (adminFeedData.currentStock <= 100) {
        adminFeedData.alerts.push({
            level: 'info',
            title: 'Monitoring Stok Pakan',
            message: `Stok pakan ${adminFeedData.currentStock} Kg (${adminFeedData.estimatedDays} hari).`,
            action: 'Persiapkan rencana pembelian untuk minggu depan.'
        });
    }
    
    // High consumption alert
    if (adminFeedData.dailyUsage > 15) {
        adminFeedData.alerts.push({
            level: 'info',
            title: 'Konsumsi Pakan Tinggi',
            message: `Konsumsi harian mencapai ${adminFeedData.dailyUsage} Kg/hari (di atas rata-rata 10 Kg).`,
            action: 'Periksa efisiensi pemberian pakan dan kondisi ayam.'
        });
    }
    
    // Show/hide alerts
    if (adminFeedData.alerts.length > 0) {
        alertsEl.style.display = 'block';
        contentEl.innerHTML = adminFeedData.alerts.map(alert => `
            <div style="margin-bottom: 1rem;">
                <div style="font-weight: 600; margin-bottom: 0.25rem;">${alert.title}</div>
                <div style="margin-bottom: 0.5rem;">${alert.message}</div>
                <div style="font-style: italic; font-size: 0.85rem;">💡 ${alert.action}</div>
            </div>
        `).join('');
    } else {
        alertsEl.style.display = 'none';
    }
}

/**
 * Admin Feed Management Actions
 */
window.openFeedStockDetail = function() {
    Swal.fire({
        title: '📊 Analisis Stok Pakan Detail',
        html: `
            <div style="text-align: left;">
                <h4>📈 Ringkasan Stok</h4>
                <ul>
                    <li><strong>Stok Saat Ini:</strong> ${adminFeedData.currentStock.toLocaleString('id-ID')} Kg</li>
                    <li><strong>Konsumsi Harian:</strong> ${adminFeedData.dailyUsage} Kg/hari</li>
                    <li><strong>Estimasi Habis:</strong> ${adminFeedData.estimatedDays} hari</li>
                    <li><strong>Nilai Stok:</strong> Rp ${adminFeedData.stockValue.toLocaleString('id-ID')}</li>
                </ul>
                
                <h4>📊 Rekomendasi</h4>
                <ul>
                    <li>Stok minimum yang disarankan: <strong>150 Kg</strong> (15 hari)</li>
                    <li>Stok optimal: <strong>300 Kg</strong> (30 hari)</li>
                    <li>Frekuensi pembelian ideal: <strong>Setiap 2 minggu</strong></li>
                </ul>
                
                <div style="margin-top: 1rem; padding: 1rem; background: #f3f4f6; border-radius: 8px;">
                    <strong>💡 Tips Manajemen:</strong><br>
                    • Monitor konsumsi harian untuk deteksi anomali<br>
                    • Beli dalam jumlah besar untuk efisiensi biaya<br>
                    • Simpan di tempat kering dan aman dari hama
                </div>
            </div>
        `,
        confirmButtonText: 'Kelola Stok Pakan',
        showCancelButton: true,
        cancelButtonText: 'Tutup'
    }).then((result) => {
        if (result.isConfirmed) {
            window.location.href = '../../stokpakan.html';
        }
    });
};

window.openFeedPurchaseRecommendation = function() {
    const recommendedPurchase = Math.max(300 - adminFeedData.currentStock, 0);
    const estimatedCost = recommendedPurchase * adminFeedData.pricePerKg;
    
    Swal.fire({
        title: '🛒 Rekomendasi Pembelian Pakan',
        html: `
            <div style="text-align: left;">
                <h4>📋 Analisis Kebutuhan</h4>
                <ul>
                    <li><strong>Stok Saat Ini:</strong> ${adminFeedData.currentStock.toLocaleString('id-ID')} Kg</li>
                    <li><strong>Target Stok Optimal:</strong> 300 Kg</li>
                    <li><strong>Kebutuhan Pembelian:</strong> <span style="color: #ef4444; font-weight: 700;">${recommendedPurchase.toLocaleString('id-ID')} Kg</span></li>
                </ul>
                
                <h4>💰 Estimasi Biaya</h4>
                <ul>
                    <li><strong>Harga per Kg:</strong> Rp ${adminFeedData.pricePerKg.toLocaleString('id-ID')}</li>
                    <li><strong>Total Estimasi:</strong> <span style="color: #10b981; font-weight: 700;">Rp ${estimatedCost.toLocaleString('id-ID')}</span></li>
                </ul>
                
                <div style="margin-top: 1rem; padding: 1rem; background: ${recommendedPurchase > 0 ? '#fee2e2' : '#d1fae5'}; border-radius: 8px;">
                    <strong>${recommendedPurchase > 0 ? '⚠️ Rekomendasi:' : '✅ Status:'}</strong><br>
                    ${recommendedPurchase > 0 ? 
                        `Segera beli ${recommendedPurchase} Kg pakan untuk mencapai stok optimal.` : 
                        'Stok pakan sudah optimal, tidak perlu pembelian saat ini.'
                    }
                </div>
            </div>
        `,
        confirmButtonText: recommendedPurchase > 0 ? 'Beli Pakan Sekarang' : 'Kelola Stok',
        showCancelButton: true,
        cancelButtonText: 'Tutup'
    }).then((result) => {
        if (result.isConfirmed) {
            window.location.href = '../../stokpakan.html';
        }
    });
};

window.openFeedAlertSettings = function() {
    Swal.fire({
        title: '⚙️ Pengaturan Alert Stok Pakan',
        html: `
            <div style="text-align: left;">
                <h4>🚨 Threshold Alert</h4>
                <ul>
                    <li><strong>Alert Kritis:</strong> ≤ 20 Kg (2 hari)</li>
                    <li><strong>Alert Peringatan:</strong> ≤ 50 Kg (5 hari)</li>
                    <li><strong>Alert Info:</strong> ≤ 100 Kg (10 hari)</li>
                </ul>
                
                <h4>📱 Notifikasi</h4>
                <ul>
                    <li>✅ Dashboard Alert (Aktif)</li>
                    <li>✅ Admin Panel Alert (Aktif)</li>
                    <li>⚠️ Email Notification (Belum Tersedia)</li>
                    <li>⚠️ SMS Alert (Belum Tersedia)</li>
                </ul>
                
                <div style="margin-top: 1rem; padding: 1rem; background: #f3f4f6; border-radius: 8px;">
                    <strong>💡 Pengaturan Saat Ini:</strong><br>
                    • Konsumsi harian rata-rata: ${adminFeedData.dailyUsage} Kg<br>
                    • Harga per Kg: Rp ${adminFeedData.pricePerKg.toLocaleString('id-ID')}<br>
                    • Auto-update setiap 5 menit
                </div>
            </div>
        `,
        confirmButtonText: 'Simpan Pengaturan',
        showCancelButton: true,
        cancelButtonText: 'Tutup'
    });
};

window.dismissAdminFeedAlert = function() {
    const alertsEl = document.getElementById('admin-feed-alerts');
    if (alertsEl) {
        alertsEl.style.display = 'none';
    }
};

// Add to existing initAdminDashboard function
const originalInitAdminDashboard2 = initAdminDashboard;
initAdminDashboard = function() {
    originalInitAdminDashboard2();
    
    // Update feed management every 5 minutes
    setInterval(updateAdminFeedStockManagement, 300000);
    
    // Initial update after 3 seconds to ensure data is loaded
    setTimeout(updateAdminFeedStockManagement, 3000);
};

console.log("🥬 Admin Feed Stock Management Loaded");