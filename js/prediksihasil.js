/* =========================================================
   SISTEM ADMINISTRASI PETERNAKAN (SISTEM PAKAR MA)
   File: prediksihasil.js
   ---------------------------------------------------------
   Deskripsi singkat:
   File inti ini mendemonstrasikan Fitur Unggulan TA, yaitu 
   Sistem Peramalan (Forecasting) dengan Algoritma 'Moving Average'.
   Aplikasi memproses input data produksi masa lalu menjadi 
   kalkulasi matematika dinamis untuk meramal tren masa depan,
   lalu menampilkannya menggunakan grafik ganda (Dual-Axis Chart).
   
   Fitur Tambahan:
   - Rekomendasi Prediktif otomatis berdasarkan hasil analisis
   - Histori prediksi tersimpan di Firestore
   - Populasi Kandang otomatis dari batch data ayam aktif
========================================================= */

// =========================================
// 0. IMPORT FIREBASE MODULES
// =========================================
import { 
    collection, addDoc, deleteDoc, doc, getDocs, getDoc,
    onSnapshot, query, orderBy, where, limit 
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { db } from "../firebase.component/firebase-init.js";

// =========================================
// 1. FUNGSI NAVIGASI UMUM & PERALIHAN TAB
// Penjelasan: Fungsi estetik dan pergerakan DOM Element Sidebar 
// serta penggantian sub-menu Form Input (Tombol Toggle Tab).
// =========================================

/**
 * Membuka/menutup sistem menu list (accordion style) di sidebar samping.
 */

/**
 * Fungsi untuk berpindah tab antara input Produksi dan Keuntungan
 */
window.switchHistoricalTab = function(tabName, btnElement) {
    // Sembunyikan semua tab
    document.getElementById('tabProduksi').style.display = 'none';
    document.getElementById('tabKeuntungan').style.display = 'none';

    // Hapus class active dari semua tombol tab
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => btn.classList.remove('active'));

    // Tampilkan tab yang dipilih dan aktifkan tombolnya
    if (tabName === 'produksi') {
        document.getElementById('tabProduksi').style.display = 'block';
    } else if (tabName === 'keuntungan') {
        document.getElementById('tabKeuntungan').style.display = 'block';
    }

    btnElement.classList.add('active');
};

/**
 * Fungsi sekunder apabila ikon pensil di Profil diklik.
 */

/**
 * Fungsi untuk mengeluarkan (logout) pengguna dan mereturn mereka ke layar Login.
 */

// =========================================
// 2. KONTROLER ALGORITMA MOVING AVERAGE (MA CORE)
// Penjelasan: Blok skrip penting pemroses utama (Brain Logic).
// Menangani validasi matriks nilai H-Hari, melakukan rekursi 
// perhitungan rata-rata, lalu mendesain output laporan (Dom Update).
// =========================================

// Variabel Global untuk menyimpan state / objek grafik Chart.js 
let predictionChart = null;
let totalHistoryDays = 7; // Default jumlah hari riwayat
let batchDataAyam = []; // Data batch ayam dari Firestore
let dataProduksi = []; // Data produksi harian dari Firestore
let dataKesehatan = []; // Data kesehatan harian dari Firestore
let dataKeuangan = []; // Data transaksi keuangan dari Firestore
let lastPredictionData = null; // Menyimpan data prediksi terakhir untuk keperluan download CSV
let konversiButirPerKg = 16; // Konfigurasi default (bisa diubah via Firebase settings)

// Referensi koleksi Firestore
const ayamCollection = collection(db, "populasi_ayam");
const produksiCollection = collection(db, "produksi_harian");
const kesehatanCollection = collection(db, "kesehatan_ayam");
const historyCollection = collection(db, "prediksi_history");
const keuanganCollection = collection(db, "keuangan");

// Inisialisasi awal render input begitu halaman dimuat
document.addEventListener('DOMContentLoaded', async () => {
    renderHistoricalInputs();
    
    // Aktifkan listener real-time untuk data Firestore
    loadBatchAyam();
    loadProduksiData();
    loadKesehatanData();
    loadKeuanganData();
    
    await Promise.all([
        loadPredictionHistory(),
        loadSettings()
    ]);
    
    // Inisialisasi lencana awal dan listener real-time konfigurasi
    updateRealtimeMAPeriodBadge();
    initRealtimeConfigListeners();
    updateHargaTelurConversionLabel();
    updateRealtimeConfigCalculations();
});

/**
 * Memuat konfigurasi sistem (seperti konversi telur dalam Gram) dari Firestore
 */
async function loadSettings() {
    try {
        const docRef = doc(db, "settings", "konfigurasi_sistem");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.gramPerButir) {
                konversiButirPerKg = 1000 / parseFloat(data.gramPerButir);
            } else if (data.butirPerKg) {
                konversiButirPerKg = parseFloat(data.butirPerKg);
            }
        }
    } catch (err) {
        console.warn("Gagal memuat konfigurasi konversi:", err);
    }
}

// =========================================
// 3. FITUR BARU: POPULASI DARI BATCH AYAM (FIRESTORE)
// Penjelasan: Memuat data batch ayam aktif dari Firestore
// dan mengisinya ke dropdown Populasi Kandang.
// =========================================

/**
 * Memuat data batch ayam dari Firestore dan mengisi dropdown Populasi
 */
function loadBatchAyam() {
    const selectEl = document.getElementById('populasiBatch');
    const hiddenPopulasi = document.getElementById('populasi');
    const infoEl = document.getElementById('populasiBatchInfo');
    
    if (!selectEl) return;

    // Tambahkan listener perubahan dropdown sekali saja jika belum ada
    if (!selectEl.dataset.listenerAttached) {
        selectEl.addEventListener('change', function() {
            const selectedOption = this.options[this.selectedIndex];
            if (!selectedOption) return;
            hiddenPopulasi.value = selectedOption.dataset.populasi || 0;
            if (infoEl && selectedOption.dataset.info) {
                infoEl.textContent = selectedOption.dataset.info;
            }
            // Perbarui pilihan minggu basis berdasarkan data batch terpilih
            updateMingguBasisDropdown();
            // Auto-fill data produksi saat batch dipilih
            autoFillFromBatch();
        });
        selectEl.dataset.listenerAttached = "true";
    }

    const q = query(ayamCollection, orderBy("tglMasuk", "desc"));
    onSnapshot(q, (snapshot) => {
        batchDataAyam = snapshot.docs.map(d => ({
            id: d.id,
            ...d.data()
        }));

        // Filter hanya batch yang statusnya Aktif
        const batchAktif = batchDataAyam.filter(b => b.status === 'Aktif');

        const prevVal = selectEl.value;
        selectEl.innerHTML = '';

        if (batchAktif.length === 0) {
            selectEl.innerHTML = '<option value="" disabled selected>⚠️ Tidak ada batch aktif</option>';
            hiddenPopulasi.value = 0;
            if (infoEl) infoEl.textContent = 'Belum ada batch ayam aktif. Silakan tambah data di halaman Data Ayam.';
            return;
        }

        // Hitung total populasi semua batch aktif
        let totalSemua = 0;
        batchAktif.forEach(b => totalSemua += (parseInt(b.sisaAyam) || 0));

        // Option: semua batch aktif digabung
        const optAll = document.createElement('option');
        optAll.value = 'ALL';
        optAll.dataset.populasi = totalSemua;
        optAll.textContent = `📊 Semua Batch Aktif (${totalSemua.toLocaleString('id-ID')} Ekor)`;
        optAll.dataset.info = `Total dari ${batchAktif.length} batch aktif`;
        selectEl.appendChild(optAll);

        // Option: masing-masing batch
        batchAktif.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b.id;
            opt.dataset.populasi = b.sisaAyam;
            const customId = b.customId || b.id.substring(0, 5);
            opt.textContent = `🐓 Batch ${customId} (${parseInt(b.sisaAyam).toLocaleString('id-ID')} Ekor)`;
            opt.dataset.info = `Batch ${customId} masuk pada ${b.tglMasuk}. Kandang: ${b.kandang || '-'}`;
            selectEl.appendChild(opt);
        });

        // Kembalikan ke pilihan sebelumnya jika ada, jika tidak default ke 'ALL'
        if (prevVal && Array.from(selectEl.options).some(opt => opt.value === prevVal)) {
            selectEl.value = prevVal;
        } else {
            selectEl.value = 'ALL';
        }

        // Trigger change untuk sinkronisasi nilai
        selectEl.dispatchEvent(new Event('change'));
    }, (error) => {
        console.error("Error loading batch ayam:", error);
        selectEl.innerHTML = '<option value="" disabled selected>❌ Gagal memuat data</option>';
    });
}

/**
 * Menghitung minggu unik secara dinamis dan mengisi dropdown mingguBasis
 */
function updateMingguBasisDropdown() {
    const batchSelect = document.getElementById('populasiBatch');
    const mingguSelect = document.getElementById('mingguBasis');
    if (!batchSelect || !mingguSelect) return;

    const selectedBatchId = batchSelect.value;
    if (!selectedBatchId) {
        mingguSelect.innerHTML = '<option value="LATEST" selected>📊 Data Terkini (7 Hari Terakhir)</option>';
        return;
    }

    // Filter data produksi berdasarkan batch
    let filteredData = [];
    if (selectedBatchId === 'ALL') {
        filteredData = [...dataProduksi];
    } else {
        filteredData = dataProduksi.filter(p => p.batchId === selectedBatchId);
    }

    // Urutkan dari terlama ke terbaru (ascending) untuk menghitung minggu
    filteredData.sort((a, b) => a.tanggal.localeCompare(b.tanggal));

    // Dapatkan daftar minggu unik
    const uniqueWeeks = new Set();
    filteredData.forEach((prod, index) => {
        const minggu = Math.floor(index / 7) + 1;
        uniqueWeeks.add(minggu);
    });

    const currentSelectedValue = mingguSelect.value || 'LATEST';

    // Bersihkan dropdown dan isi ulang
    mingguSelect.innerHTML = '<option value="LATEST">📊 Data Terkini (7 Hari Terakhir)</option>';
    
    // Urutkan minggu ascending
    const sortedWeeks = Array.from(uniqueWeeks).sort((a, b) => a - b);
    sortedWeeks.forEach(w => {
        const opt = document.createElement('option');
        opt.value = w;
        opt.textContent = `📅 Minggu ke-${w}`;
        mingguSelect.appendChild(opt);
    });

    // Pertahankan nilai jika ada
    if (Array.from(uniqueWeeks).includes(parseInt(currentSelectedValue))) {
        mingguSelect.value = currentSelectedValue;
    } else {
        mingguSelect.value = 'LATEST';
    }
}

/**
 * Inisialisasi Event Listeners untuk kalkulasi real-time konfigurasi
 */
function initRealtimeConfigListeners() {
    const inputPakan = document.getElementById('pakanPerEkor');
    const inputHargaPakan = document.getElementById('hargaPakan');
    const inputHargaTelur = document.getElementById('hargaTelur');
    const selectBatch = document.getElementById('populasiBatch');
    const selectMA = document.getElementById('periodeMA');

    if (inputPakan) inputPakan.addEventListener('input', updateRealtimeConfigCalculations);
    if (inputHargaPakan) inputHargaPakan.addEventListener('input', updateRealtimeConfigCalculations);
    if (inputHargaTelur) {
        inputHargaTelur.addEventListener('input', () => {
            updateRealtimeConfigCalculations();
            updateHargaTelurConversionLabel();
        });
    }
    if (selectBatch) {
        selectBatch.addEventListener('change', () => {
            updateRealtimeConfigCalculations();
        });
    }
    if (selectMA) {
        selectMA.addEventListener('change', () => {
            updateRealtimeMAPeriodBadge();
            autoFillFromBatch();
        });
    }
}

/**
 * Merubah lencana karakteristik periode MA secara interaktif
 */
function updateRealtimeMAPeriodBadge() {
    const selectMA = document.getElementById('periodeMA');
    const badge = document.getElementById('maPeriodBadge');
    if (!selectMA || !badge) return;

    const val = selectMA.value;
    if (val === '3') {
        badge.innerText = '⚡ Responsif Tinggi';
        badge.style.background = '#fef3c7';
        badge.style.color = '#d97706';
        badge.style.border = '1px solid #fde68a';
        badge.style.display = 'inline-block';
    } else if (val === '5') {
        badge.innerText = '⚖️ Stabil & Moderat';
        badge.style.background = '#dbeafe';
        badge.style.color = '#2563eb';
        badge.style.border = '1px solid #bfdbfe';
        badge.style.display = 'inline-block';
    } else if (val === '7') {
        badge.innerText = '👑 Direkomendasikan';
        badge.style.background = '#dcfce7';
        badge.style.color = '#15803d';
        badge.style.border = '1px solid #bbf7d0';
        badge.style.display = 'inline-block';
    } else {
        badge.style.display = 'none';
    }
}

/**
 * Merubah label konversi harga telur per butir
 */
function updateHargaTelurConversionLabel() {
    const inputHargaTelur = document.getElementById('hargaTelur');
    const label = document.getElementById('hargaTelurConvertInfo');
    if (!inputHargaTelur || !label) return;

    const valStr = inputHargaTelur.value || '0';
    const val = parseInt(valStr.replace(/\./g, '').replace(',', '.')) || 0;

    if (val > 0) {
        const perButir = Math.round(val / 30);
        label.textContent = `💡 Setara dengan Rp ${perButir.toLocaleString('id-ID')} per butir (1 Papan = 30 Butir)`;
        label.style.display = 'block';
    } else {
        label.style.display = 'none';
    }
}

/**
 * Menghitung estimasi kebutuhan dan modal pakan harian secara real-time
 */
function updateRealtimeConfigCalculations() {
    const inputPakan = document.getElementById('pakanPerEkor');
    const inputHargaPakan = document.getElementById('hargaPakan');
    const selectBatch = document.getElementById('populasiBatch');
    const hiddenPopulasi = document.getElementById('populasi');

    const populasi = parseInt(hiddenPopulasi ? hiddenPopulasi.value : 0) || 0;
    const pakanPerEkor = parseFloat(inputPakan ? inputPakan.value : 0) || 0;
    
    const hargaPakanStr = inputHargaPakan ? inputHargaPakan.value : '0';
    const hargaPakan = parseInt(hargaPakanStr.replace(/\./g, '').replace(',', '.')) || 0;

    const summaryBox = document.getElementById('realtimeConfigSummary');
    const rtPakanKg = document.getElementById('rtPakanKg');
    const rtBiayaPakan = document.getElementById('rtBiayaPakan');

    // 1. Hitung pakan dan biaya
    if (populasi > 0 && pakanPerEkor > 0) {
        const totalPakanKg = (populasi * pakanPerEkor) / 1000;
        const biayaPakan = totalPakanKg * hargaPakan;

        if (rtPakanKg) rtPakanKg.textContent = `${totalPakanKg.toLocaleString('id-ID')} Kg / Hari`;
        if (rtBiayaPakan) rtBiayaPakan.textContent = `Rp ${Math.round(biayaPakan).toLocaleString('id-ID')} / Hari`;
        
        if (summaryBox) summaryBox.style.display = 'block';
    } else {
        if (summaryBox) summaryBox.style.display = 'none';
    }

    // 2. Perbarui Mini Info Card Batch ayam
    const batchCard = document.getElementById('rtBatchInfoCard');
    const rtBatchAyam = document.getElementById('rtBatchAyam');
    const rtBatchKandang = document.getElementById('rtBatchKandang');
    const rtBatchTgl = document.getElementById('rtBatchTgl');

    if (selectBatch && selectBatch.value && selectBatch.value !== '') {
        if (selectBatch.value === 'ALL') {
            if (rtBatchAyam) rtBatchAyam.textContent = `${populasi.toLocaleString('id-ID')} Ekor`;
            if (rtBatchKandang) rtBatchKandang.textContent = 'Semua Kandang';
            if (rtBatchTgl) rtBatchTgl.textContent = '-';
            if (batchCard) batchCard.style.display = 'block';
        } else {
            const batchInfo = batchDataAyam.find(b => b.id === selectBatch.value);
            if (batchInfo) {
                if (rtBatchAyam) rtBatchAyam.textContent = `${(parseInt(batchInfo.sisaAyam) || 0).toLocaleString('id-ID')} Ekor`;
                if (rtBatchKandang) rtBatchKandang.textContent = batchInfo.kandang || '-';
                if (rtBatchTgl) {
                    const formattedDate = batchInfo.tglMasuk ? new Date(batchInfo.tglMasuk).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
                    rtBatchTgl.textContent = formattedDate;
                }
                if (batchCard) batchCard.style.display = 'block';
            } else {
                if (batchCard) batchCard.style.display = 'none';
            }
        }
    } else {
        if (batchCard) batchCard.style.display = 'none';
    }
}

/**
 * Memuat data produksi harian dari Firestore
 */
/**
 * Memuat data produksi harian secara real-time dari Firestore
 */
function loadProduksiData() {
    const q = query(produksiCollection, orderBy("tanggal", "desc"));
    onSnapshot(q, (snapshot) => {
        dataProduksi = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        // Perbarui dropdown mingguBasis jika diperlukan
        updateMingguBasisDropdown();
    }, (error) => {
        console.error("Error loading produksi data:", error);
    });
}

/**
 * Memuat data kesehatan secara real-time dari Firestore
 */
function loadKesehatanData() {
    onSnapshot(kesehatanCollection, (snapshot) => {
        dataKesehatan = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    }, (error) => {
        console.error("Error loading kesehatan data:", error);
    });
}

/**
 * Memuat data keuangan secara real-time dari Firestore
 */
function loadKeuanganData() {
    onSnapshot(keuanganCollection, (snapshot) => {
        dataKeuangan = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    }, (error) => {
        console.error("Error loading keuangan data:", error);
    });
}

window.autoFillFromBatch = function() {
    const batchSelect = document.getElementById('populasiBatch');
    const mingguSelect = document.getElementById('mingguBasis');
    const periodeMA = parseInt(document.getElementById('periodeMA').value) || 7;
    
    if (!batchSelect || !batchSelect.value) return;
    
    const selectedBatchId = batchSelect.value;
    const selectedMingguVal = mingguSelect ? mingguSelect.value : 'LATEST';
    
    // Filter data produksi berdasarkan batch
    let filteredData = [];
    if (selectedBatchId === 'ALL') {
        filteredData = [...dataProduksi];
    } else {
        filteredData = dataProduksi.filter(p => p.batchId === selectedBatchId);
    }
    
    // Urutkan berdasarkan tanggal ascending (terlama ke terbaru) untuk menghitung minggu
    filteredData.sort((a, b) => a.tanggal.localeCompare(b.tanggal));
    
    filteredData.forEach((prod, index) => {
        prod.minggu = Math.floor(index / 7) + 1;
    });

    // Jika memilih minggu tertentu, lakukan filter
    if (selectedMingguVal !== 'LATEST') {
        const targetWeek = parseInt(selectedMingguVal);
        filteredData = filteredData.filter(p => p.minggu === targetWeek);
    }
    
    // Urutkan berdasarkan tanggal descending (terbaru dulu) agar input H-0 adalah terupdate di rentang tersebut
    filteredData.sort((a, b) => b.tanggal.localeCompare(a.tanggal));
    
    // Ambil N data terakhir sesuai periode MA
    const dataToFill = filteredData.slice(0, periodeMA);
    
    if (dataToFill.length === 0) {
        Swal.fire({
            icon: 'info',
            title: 'Belum Ada Data Produksi',
            html: `Rentang data atau minggu yang dipilih tidak memiliki rekaman data produksi.<br><br>Silakan input data produksi terlebih dahulu di halaman <strong>Input Produksi Harian</strong>.`,
            confirmButtonColor: '#3085d6'
        });
        return;
    }
    
    // Kosongkan dulu semua field input historis (mencegah sisa data minggu lain)
    for (let i = 0; i <= totalHistoryDays + 10; i++) {
        const inputEl = document.getElementById(`hist${i}`);
        const profitEl = document.getElementById(`prof${i}`);
        if (inputEl) inputEl.value = '';
        if (profitEl) profitEl.value = '';
    }

    // Isi data baru
    dataToFill.forEach((prod, index) => {
        const inputId = `hist${index}`;
        const profitId = `prof${index}`;
        const inputEl = document.getElementById(inputId);
        const profitEl = document.getElementById(profitId);
        
        if (inputEl) {
            inputEl.value = prod.totalTelur || 0;
        }
        
        if (profitEl) {
            // Dibiarkan kosong (tidak di-autofill) agar petugas menginput secara manual sesuai permintaan user
            profitEl.value = '';
        }
    });
    
    if (dataToFill.length < periodeMA) {
        Swal.fire({
            icon: 'warning',
            title: 'Data Belum Sesuai/Lengkap',
            html: `Rentang/Minggu basis yang dipilih hanya memiliki <strong>${dataToFill.length} hari</strong> data produksi, sedangkan Periode MA yang dipilih adalah <strong>${periodeMA} hari</strong>.<br><br>Data yang ada telah diisi otomatis, <strong>namun Anda wajib melengkapi sisanya secara manual</strong> agar prediksi dapat berjalan.`,
            showConfirmButton: true,
            confirmButtonText: 'Mengerti',
            confirmButtonColor: '#f59e0b'
        });
    } else {
        const basisLabel = selectedMingguVal === 'LATEST' ? 'Data Terkini (7 Hari Terakhir)' : `Minggu ke-${selectedMingguVal}`;
        Swal.fire({
            icon: 'success',
            title: 'Data Berhasil Dimuat!',
            html: `<strong>${dataToFill.length} hari</strong> data produksi dari basis <strong>${basisLabel}</strong> telah diisi otomatis ke form.<br><br>Silakan lengkapi data <strong>Keuntungan (Rp)</strong> secara manual di tab sebelah.`,
            showConfirmButton: true,
            confirmButtonText: 'OK',
            confirmButtonColor: '#10b981'
        });
    }

    // Perbarui visualisasi real-time pembantu konfigurasi
    updateRealtimeConfigCalculations();
    updateHargaTelurConversionLabel();
};

/**
 * Menambah atau mengurangi jumlah hari riwayat data yang ingin diinput
 * @param {number} delta - Angka perubahan (contoh: +1 atau -1)
 */
window.changeHistoryCount = function(delta) {
    let inputEl = document.getElementById('jumlahHariHistoris');
    let current = parseInt(inputEl.value);
    if (isNaN(current)) current = 1;
    let newVal = current + delta;
    if (newVal < 1) newVal = 1;
    inputEl.value = newVal;
    totalHistoryDays = newVal;
    renderHistoricalInputs();
};

/**
 * Menangani perubahan jumlah hari riwayat secara manual via ketik keyboard
 */
window.manualChangeHistoryCount = function() {
    let inputEl = document.getElementById('jumlahHariHistoris');
    let current = parseInt(inputEl.value);
    if (isNaN(current) || current < 1) current = 1;
    inputEl.value = current;
    totalHistoryDays = current;
    renderHistoricalInputs();
};

/**
 * Merender (Membangun) baris-baris input dinamis untuk histori produksi dan keuntungan
 * Berdasarkan jumlah hari (X) yang ditentukan pengguna.
 */
function renderHistoricalInputs() {
    const prodContainer = document.getElementById('containerHistProd');
    const profitContainer = document.getElementById('containerHistProf');
    if (!prodContainer || !profitContainer) return;

    let periodeMA = parseInt(document.getElementById('periodeMA').value) || 7;

    // Simpan data sebelumnya supaya tidak hilang saat jumlah baris berubah
    let oldProd = {};
    let oldProfit = {};
    for (let i = 0; i <= totalHistoryDays + 10; i++) {
        let pInp = document.getElementById(`hist${i}`);
        if (pInp !== null) oldProd[i] = pInp.value;
        let prInp = document.getElementById(`prof${i}`);
        if (prInp !== null) oldProfit[i] = prInp.value;
    }

    prodContainer.innerHTML = '';
    profitContainer.innerHTML = '';

    for (let i = totalHistoryDays - 1; i >= 0; i--) {
        let labelText = '';
        if (i === 0) {
            labelText = 'Hari Ini (Wajib)';
        } else if (i < periodeMA && totalHistoryDays >= periodeMA) {
            labelText = `H-${i} (Wajib)`;
        } else if (totalHistoryDays < periodeMA) {
            labelText = `H-${i} (Wajib ${totalHistoryDays}/${periodeMA})`;
        } else {
            labelText = `H-${i} (Opsi)`;
        }

        // Definisi gaya visual untuk baris "Hari Ini" agar menonjol
        let isToday = (i === 0);

        let labelClassProd = isToday ? 'hist-input-today-label-produksi' : '';
        let inputClassProd = isToday ? 'hist-input-today-produksi' : '';

        let labelClassProfit = isToday ? 'hist-input-today-label-keuntungan' : '';
        let inputClassProfit = isToday ? 'hist-input-today-keuntungan' : '';

        let colSpanClass = isToday ? 'grid-column-span-2' : '';

        prodContainer.innerHTML += `
            <div class="form-group-mini ${colSpanClass}">
                <label class="${labelClassProd}">${labelText}</label>
                <input type="text" inputmode="numeric" id="hist${i}" class="hist-input ${inputClassProd}" placeholder="-" value="${oldProd[i] || ''}" oninput="window.formatNumberInput(this)">
            </div>
        `;

        profitContainer.innerHTML += `
            <div class="form-group-mini ${colSpanClass}">
                <label class="${labelClassProfit}">${labelText}</label>
                <input type="text" inputmode="numeric" id="prof${i}" class="hist-input ${inputClassProfit}" placeholder="-" value="${oldProfit[i] || ''}" oninput="window.formatNumberInput(this)">
            </div>
        `;
    }
}

/**
 * Memformat angka yang diketik dengan pemisah ribuan (titik) khas Indonesia
 * dan koma untuk desimal.
 */

/**
 * Mengatur nilai preset konsumsi pakan per ekor
 * @param {number} val - Nilai pakan dalam gram
 */
window.setPresetPakan = function(val) {
    const input = document.getElementById('pakanPerEkor');
    if (input) {
        input.value = val;
        updatePakanBadge(val);
    }
};

/**
 * Memperbarui badge status berdasarkan nilai konsumsi pakan
 * @param {number} val - Nilai pakan dalam gram
 */
window.updatePakanBadge = function(val) {
    const badge = document.getElementById('pakanStatus');
    if (!badge) return;

    if (!val || val <= 0) {
        badge.innerText = "Belum Diisi";
        badge.style.background = "#f1f2f6";
        badge.style.color = "#7f8c8d";
        return;
    }
    
    const pakan = parseFloat(val);
    if (pakan < 105) {
        badge.innerText = "Sangat Hemat";
        badge.style.background = "#e8f8f0";
        badge.style.color = "#27ae60";
    } else if (pakan >= 105 && pakan <= 118) {
        badge.innerText = "Standar Ideal";
        badge.style.background = "#fff9db";
        badge.style.color = "#f59f00";
    } else {
        badge.innerText = "Konsumsi Tinggi";
        badge.style.background = "#fff5f5";
        badge.style.color = "#fa5252";
    }
};
/**
 * Fungsi untuk menganimasi perubahan angka (Count Up)
 */
function animateValue(obj, start, end, duration, prefix = '', suffix = '', isCurrency = false) {
    if (!obj) return;
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const current = progress * (end - start) + start;
        
        let valueStr = '';
        if (isCurrency) {
            valueStr = prefix + Math.floor(current).toLocaleString('id-ID') + suffix;
        } else {
            if (end % 1 !== 0) {
                valueStr = prefix + current.toFixed(2) + suffix;
            } else {
                valueStr = prefix + Math.floor(current).toLocaleString('id-ID') + suffix;
            }
        }
        
        obj.textContent = valueStr;
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

/**
 * Fungsi Utama `calculatePrediction`!
 * Berjalan ketika menekan tombol "Analisis dengan MA".
 * @param {Event} event - Dioper dari eksekusi form 'onsubmit', diproteksi dengan .preventDefault() agar laman web tidak reload patah-patah.
 */
window.calculatePrediction = function(event) {
    event.preventDefault(); // Menghentikan perilaku form memuat ulang halaman

    // --- STEP 1: Mengambil Data Parameter / Pengaturan Statik ---
    // (di bagian form sebelah bawah-kiri)
    const periodeMA = parseInt(document.getElementById('periodeMA').value);
    const populasi = parseInt(document.getElementById('populasi').value); // Ekor
    const pakanPerEkor = parseFloat(document.getElementById('pakanPerEkor').value); // dalam satuan Gram (g)
    const hargaPakanStr = document.getElementById('hargaPakan').value || '0';
    const hargaTelurStr = document.getElementById('hargaTelur').value || '0';
    
    // Pembersihan karakter titik/koma agar aman diparsing ke angka (mencegah error format Indonesia)
    const hargaPakan = parseInt(hargaPakanStr.replace(/\./g, '').replace(',', '.')) || 0; // Rp per kg
    const hargaTelur = parseInt(hargaTelurStr.replace(/\./g, '').replace(',', '.')) || 0; // Rp per papan

    // Validasi populasi
    if (!populasi || populasi <= 0) {
        Swal.fire({
            icon: 'error',
            title: 'Populasi Belum Dipilih',
            text: 'Silakan pilih batch ayam aktif terlebih dahulu di bagian Konfigurasi Variabel Prediksi.',
            confirmButtonColor: '#3085d6'
        });
        return;
    }

    // --- STEP 2A & 2B: Mengumpulkan Data Input Historis secara Dinamis ---
    const inputs = [];
    const inputsProfit = [];
    for (let i = totalHistoryDays - 1; i >= 0; i--) {
        inputs.push(document.getElementById(`hist${i}`));
        inputsProfit.push(document.getElementById(`prof${i}`));
    }

    // --- STEP 3: Proses Validasi (Pengecekan Keamanan) Form ---
    if (totalHistoryDays < periodeMA) {
        Swal.fire({
            icon: 'error',
            title: 'Kurang Data Historis',
            text: `Anda memilih Periode MA = ${periodeMA} Hari, sehingga Anda harus menginput data historis setidaknya selama ${periodeMA} hari! (Saat ini Anda hanya memiliki ${totalHistoryDays} hari data)`,
            confirmButtonColor: '#3085d6'
        });
        return;
    }

    // Memastikan N-data terakhir sesuai periode MA tidak boleh kosong
    let startIndex = totalHistoryDays - periodeMA;
    let isDataValid = true;
    for (let i = startIndex; i < totalHistoryDays; i++) {
        let cleanValStr = (inputs[i].value || '').replace(/\./g, '').replace(',', '.');
        let val = parseFloat(cleanValStr);
        if (isNaN(val)) {
            isDataValid = false;
            break;
        }
    }

    // Jika blok produksi ada yang bolong
    if (!isDataValid) {
        Swal.fire({
            icon: 'error',
            title: 'Data Tidak Lengkap',
            text: `Mohon isi semua data jumlah historis (Butir) sedari H-${periodeMA - 1} hingga Hari Ini!`,
            confirmButtonColor: '#3085d6'
        });
        return;
    }

    // Lakukan validasi produksi keuntungan historis
    for (let i = startIndex; i < totalHistoryDays; i++) {
        let cleanValStr = (inputsProfit[i].value || '').replace(/\./g, '').replace(',', '.');
        let val = parseFloat(cleanValStr);
        if (isNaN(val)) {
            Swal.fire({
                icon: 'error',
                title: 'Data Keuntungan Tidak Lengkap',
                text: `Mohon isi semua data keuntungan historis uang (Rp) Anda sedari H-${periodeMA - 1} hingga Hari Ini!`,
                confirmButtonColor: '#3085d6'
            });
            return;
        }
    }

    // --- STEP 4: Ekstraksi Data yang Sudah Diverifikasi ---
    // Simpan semua input (dari paling atas hingga Hari Ini) yang ada isinya menjadi array.
    let fullHistoryButir = [];
    let startActual = 0;
    while (startActual < totalHistoryDays && isNaN(parseFloat(inputs[startActual].value))) {
        startActual++;
    }

    let fullHistoryProfit = [];
    for (let i = startActual; i < totalHistoryDays; i++) {
        let cleanProdStr = (inputs[i].value || '').replace(/\./g, '').replace(',', '.');
        let cleanProfStr = (inputsProfit[i].value || '').replace(/\./g, '').replace(',', '.');
        const prodVal = parseFloat(cleanProdStr);
        const profitVal = parseFloat(cleanProfStr);
        fullHistoryButir.push(isNaN(prodVal) ? 0 : prodVal);
        fullHistoryProfit.push(isNaN(profitVal) ? 0 : profitVal);
    }

    // KONVERSI EMAS MA (Butir -> Kilogram)
    // Parameter hitungan kita pakai Kg, namun petani nyaman pakai Butir.
    // Nilai array Butir dipetakan ke wujud Kilogram (Kg) berdasarkan rasio konversi.
    let fullHistoryKg = fullHistoryButir.map(butir => butir / konversiButirPerKg);

    // --- KALKULASI SELISIH OPERASIONAL (OFFSET KEUANGAN) ---
    // Menghitung selisih rata-rata antara keuntungan aktual (input pengguna) dengan perhitungan teoritis.
    // Hal ini agar proyeksi laba masa depan mengikuti tren "jumlah pendapatan" historis yang diubah pengguna.
    let totalOffset = 0;
    let validOffsetDays = 0;
    for (let i = 0; i < fullHistoryProfit.length; i++) {
        if (!isNaN(fullHistoryProfit[i])) {
            let butirHist = fullHistoryButir[i];
            let teoritisPendapatan = (butirHist / 30) * hargaTelur; // Harga per papan (30 butir)
            let teoritisTotalPakanKg = (populasi * pakanPerEkor) / 1000;
            let teoritisBiayaPakan = teoritisTotalPakanKg * hargaPakan;
            let teoritisLaba = teoritisPendapatan - teoritisBiayaPakan;
            
            let selisih = fullHistoryProfit[i] - teoritisLaba;
            totalOffset += selisih;
            validOffsetDays++;
        }
    }
    let avgProfitOffset = validOffsetDays > 0 ? (totalOffset / validOffsetDays) : 0;

    // --- STEP 4.5: MENGHITUNG PENALTI KESEHATAN AYAM ---
    // Cek apakah ada ayam sakit di batch yang dipilih pada hari ini
    let penaltyFactor = 0;
    const selectBatchId = document.getElementById('populasiBatch').value;
    const hariIniStr = new Date().toISOString().split('T')[0];
    
    let totalSakitHariIni = 0;
    // Cari laporan sakit untuk batch ini pada hari ini
    dataKesehatan.forEach(kes => {
        if (kes.tanggal === hariIniStr && (selectBatchId === 'ALL' || kes.batchId === selectBatchId)) {
            // Jika statusnya belum sembuh/mati semua, berarti masih berpotensi mengurangi produksi telur (stres)
            if (kes.status !== "Sembuh" && kes.status !== "Mati Semua") {
                totalSakitHariIni += (parseInt(kes.jmlSakit) || 0);
            }
        }
    });

    if (totalSakitHariIni > 0 && populasi > 0) {
        penaltyFactor = totalSakitHariIni / populasi; // Persentase ayam sakit
        if (penaltyFactor > 1) penaltyFactor = 1;
    }

    // --- STEP 5: MELAKUKAN KALKULASI PINTAR PREDIKSI "HARI ESOK" (H+1) ---
    // MENGGUNAKAN PURE FUNCTION DARI ma-core.js (Clean Code & DRY)
    // penaltyFactor dikirim untuk memotong tren MA sesuai jumlah ayam sakit
    let maResult = window.calculateMovingAverage(fullHistoryKg, periodeMA, 7, penaltyFactor);
    let prediksiBesokKg = maResult.prediksiBesok;

    // --- STEP 5.5: KALKULASI MAE & AKURASI MODEL (BACKTESTING) ---
    // Gunakan seluruh data produksi historis di database untuk batch ini agar backtesting akurat (> 7 hari)
    const batchSelectForEval = document.getElementById('populasiBatch');
    const selectedBatchIdForEval = batchSelectForEval ? batchSelectForEval.value : '';
    let evalDataButir = [...fullHistoryButir];

    if (selectedBatchIdForEval) {
        let dbFiltered = [];
        if (selectedBatchIdForEval === 'ALL') {
            dbFiltered = [...dataProduksi];
        } else {
            dbFiltered = dataProduksi.filter(p => p.batchId === selectedBatchIdForEval);
        }
        dbFiltered.sort((a, b) => a.tanggal.localeCompare(b.tanggal));
        if (dbFiltered.length > periodeMA) {
            evalDataButir = dbFiltered.map(p => p.totalTelur || 0);
        }
    }

    let evalResult = window.evaluateModelAccuracy(evalDataButir, periodeMA);
    let maeButir = evalResult.mae;
    let akurasiModel = evalResult.akurasi;
    let isAkurasiValid = evalResult.isAkurasiValid;

    // --- STEP 6: KALKULASI LAPORAN UANG/FINANSIAL HARI ESOK ---
    let prediksiBesokButir = Math.round(prediksiBesokKg * konversiButirPerKg); // Konver kembali ke butir secara integer tak desimal (Dibulatkan)
    let estimasiPendapatan = (prediksiBesokButir / 30) * hargaTelur;           // Harga Telur/Papan (30 Butir)
    let totalPakanKg = (populasi * pakanPerEkor) / 1000;                       // Butuh pakan berapa sekandang perharinya? (/1000 konversi karena pakan dari input beralias gram)
    let biayaPakan = totalPakanKg * hargaPakan;                                // Biaya Operasional / Modal Cost
    let keuntunganTeoritis = estimasiPendapatan - biayaPakan;                  // Laba murni rumus
    let keuntungan = keuntunganTeoritis + avgProfitOffset;                     // Sisa Laba Bersih Petani (Net Profit) disesuaikan histori pengguna

    // --- STEP 7: MEMASUKKAN NILAI KE PANEL ANTARMUKA (DOM UPGRADE) DENGAN ANIMASI ---
    const outProdEl = document.getElementById('outProduksi');
    const outButirEl = document.getElementById('outButir');
    const outPendEl = document.getElementById('outPendapatan');
    const outBiayaEl = document.getElementById('outBiayaPakan');
    const outKeuntunganEl = document.getElementById('outKeuntungan');

    animateValue(outProdEl, 0, prediksiBesokKg, 1000, '', ' Kg');
    animateValue(outButirEl, 0, prediksiBesokButir, 1000, '', ' Butir');
    animateValue(outPendEl, 0, estimasiPendapatan, 1200, 'Rp ', '', true);
    animateValue(outBiayaEl, 0, biayaPakan, 1200, 'Rp ', '', true);
    animateValue(outKeuntunganEl, 0, keuntungan, 1500, 'Rp ', '', true);

    // Fitur Tambahan Cerdas: Jika keuntungannya (Laba Besih) MINUS (Negatif/Rugi)
    // maka kita merubah tema warna kotak Margin nya dari Biru/Hijau, langsung menjadi MERAH SIAGA BENCANA!
    const resultCardsContainer = document.getElementById('resultCards');
    const highlightCard = resultCardsContainer.querySelector('.highlight-card');
    const statIcon = highlightCard.querySelector('.stat-icon');

    if (keuntungan < 0) { // Rugi!
        statIcon.classList.remove('blue-bg', 'green-bg');
        statIcon.classList.add('red-bg');
        highlightCard.querySelector('h4').textContent = "Proyeksi Kerugian";
        highlightCard.querySelector('p').classList.add('highlight-text-red');
        highlightCard.querySelector('p').classList.remove('highlight-text-green');
        highlightCard.classList.remove('bg-keuntungan');
        highlightCard.classList.add('bg-biaya');
    } else { // Untung!
        statIcon.classList.remove('red-bg', 'blue-bg');
        statIcon.classList.add('green-bg');
        highlightCard.querySelector('h4').textContent = "Proyeksi Keuntungan";
        highlightCard.querySelector('p').classList.add('highlight-text-green');
        highlightCard.querySelector('p').classList.remove('highlight-text-red');
        highlightCard.classList.remove('bg-biaya');
        highlightCard.classList.add('bg-keuntungan');
    }

    // --- STEP 8: PREDIKSI MASA DEPAN (MERAMAL 7 HARI KEDEPAN SEKALIGUS) ---
    // Menggunakan hasil prediksi berantai dari ma-core.js
    let proyeksi7HariKg = maResult.proyeksiMasaDepan;
    let proyeksi7HariKeuntungan = [];

    for (let i = 0; i < 7; i++) { 
        let nextPredKg = proyeksi7HariKg[i];
        
        // Asumsi operasional pengeluaran akan berjalan statis/konsisten tiap harinya
        let nextPredButir = Math.round(nextPredKg * konversiButirPerKg);
        let nextPendapatan = (nextPredButir / 30) * hargaTelur;
        let nextKeuntunganTeoritis = nextPendapatan - biayaPakan;
        let nextKeuntungan = nextKeuntunganTeoritis + avgProfitOffset; // Sesuaikan dengan tren histori
        
        proyeksi7HariKeuntungan.push(nextKeuntungan);
    }

    // Ambil Data Profit manual murni. (Sebelah kiri Chart)
    let historyKeuntunganAct = fullHistoryProfit;

    // --- STEP 8.5: UPDATE ESTIMASI PENDAPATAN MINGGUAN ---
    let totalPrediksiKg7Hari = proyeksi7HariKg.reduce((a, b) => a + b, 0);
    let totalPrediksiButir7Hari = Math.round(totalPrediksiKg7Hari * konversiButirPerKg);
    let estimasiMingguan = (totalPrediksiButir7Hari / 30) * hargaTelur;
    
    // Tentukan target minggu prediksi dinamis
    const mingguSelect = document.getElementById('mingguBasis');
    const selectedMingguVal = mingguSelect ? mingguSelect.value : 'LATEST';
    let targetWeek = 1;
    if (selectedMingguVal === 'LATEST') {
        const batchSelect = document.getElementById('populasiBatch');
        const selectedBatchId = batchSelect ? batchSelect.value : '';
        let filtered = [...dataProduksi];
        if (selectedBatchId && selectedBatchId !== 'ALL') {
            filtered = dataProduksi.filter(p => p.batchId === selectedBatchId);
        }
        filtered.sort((a, b) => a.tanggal.localeCompare(b.tanggal));
        const latestIndex = filtered.length - 1;
        const currentLatestWeek = latestIndex >= 0 ? Math.floor(latestIndex / 7) + 1 : 1;
        targetWeek = currentLatestWeek + 1;
    } else {
        targetWeek = parseInt(selectedMingguVal) + 1;
    }

    let outMingguanEl = document.getElementById('outPendapatanMingguan');
    if (outMingguanEl) {
        outMingguanEl.textContent = `Rp ${Math.round(estimasiMingguan).toLocaleString('id-ID')} (Estimasi Minggu ke-${targetWeek})`;
    }

    const summaryTitleEl = document.getElementById('summaryTitle');
    if (summaryTitleEl) {
        summaryTitleEl.innerHTML = `<span>📋</span> Hasil Rekapan Proyeksi (Minggu ke-${targetWeek})`;
    }

    // --- STEP 9: JALANKAN PROSESS PENGGAMBARAN KE KANVAS (RENDER GRAFIK CHART.JS) ---
    // Dipecah dan ditransfer menjadi parameter argumen fungsi lain dibawah sana.
    updateChart(fullHistoryKg, historyKeuntunganAct, proyeksi7HariKg, proyeksi7HariKeuntungan);

    // --- STEP 10: MEMPERBARUI TABEL HASIL REKAPAN PREDIKSI ---
    let tableBody = document.getElementById('rekapanTableBody');
    if (tableBody) {
        tableBody.innerHTML = '';
        for (let i = 0; i < 7; i++) {
            let pKg = proyeksi7HariKg[i];
            let butir = Math.round(pKg * konversiButirPerKg);
            let profit = proyeksi7HariKeuntungan[i];
            let rpFormat = Math.round(profit).toLocaleString('id-ID');
            let profitClass = profit < 0 ? "profit-negatif" : "profit-positif";

            let tr = document.createElement('tr');
            tr.className = "prediksi-row";

            tr.innerHTML = `
                <td class="prediksi-cell-hari">
                    <span class="prediksi-badge-hari">H+${i + 1}</span>
                </td>
                <td class="prediksi-cell-produksi">
                    <span class="prediksi-text-produksi">${pKg.toFixed(2)} Kg</span>
                    <span class="prediksi-subtext-produksi">${butir.toLocaleString('id-ID')} Butir</span>
                </td>
                <td class="prediksi-cell-keuntungan ${profitClass}">
                    Rp ${rpFormat}
                </td>
            `;
            tableBody.appendChild(tr);
        }
    }

    // --- STEP 11: GENERATE REKOMENDASI PREDIKTIF ---
    const rekomendasi = generateRekomendasi({
        prediksiBesokKg,
        prediksiBesokButir,
        estimasiPendapatan,
        biayaPakan,
        keuntungan,
        populasi,
        periodeMA,
        fullHistoryButir,
        proyeksi7HariKg,
        proyeksi7HariKeuntungan,
        totalPakanKg,
        hargaPakan,
        hargaTelur
    });
    renderRekomendasi(rekomendasi);

    // --- STEP 12: SIMPAN KE HISTORI FIRESTORE & TAMPILKAN TOMBOL DOWNLOAD ---
    // Simpan data prediksi terakhir ke variabel global untuk keperluan CSV
    const batchSelect = document.getElementById('populasiBatch');
    const selectedBatchLabel = batchSelect ? batchSelect.options[batchSelect.selectedIndex].textContent : '-';
    lastPredictionData = {
        tanggal: new Date().toISOString(),
        periodeMA,
        populasi,
        batchLabel: selectedBatchLabel,
        prediksiBesokKg,
        prediksiBesokButir,
        estimasiPendapatan,
        biayaPakan,
        keuntungan,
        maeButir: isAkurasiValid ? maeButir : null,
        akurasiModel: isAkurasiValid ? akurasiModel : null,
        proyeksi7HariKg,
        proyeksi7HariKeuntungan,
        rekomendasi
    };

    savePredictionHistory({
        periodeMA,
        populasi,
        prediksiBesokKg,
        prediksiBesokButir,
        estimasiPendapatan,
        biayaPakan,
        keuntungan,
        proyeksi7HariKg,
        proyeksi7HariKeuntungan,
        rekomendasi
    });

    // Tampilkan tombol download CSV setelah analisis berhasil
    const dlBtn = document.getElementById('downloadPrediksiBtn');
    if (dlBtn) dlBtn.style.display = 'block';

    // Kirim notifikasi manis perihal hasil Laba Hari Esok (Satu hari di depan).
    Swal.fire({
        icon: 'success',
        title: 'Analisis Cerdas Berhasil',
        html: `Berdasarkan pola MA-${periodeMA}, besok diproyeksikan untung/rugi sebesar <b>Rp ${Math.round(keuntungan).toLocaleString('id-ID')}</b>.<br><small style="color: #7f8c8d;">Lihat rekomendasi prediktif di bawah hasil analisis.</small>`,
        timer: 3500, // Pop up kilat 3.5 detik (menghilang sendiri kalau dibiarkan)
        showConfirmButton: true,
        confirmButtonColor: '#48bb78',
        confirmButtonText: 'Tutup'
    });
};

// =========================================
// 4. FITUR BARU: REKOMENDASI PREDIKTIF
// Penjelasan: Menghasilkan rekomendasi aksi berdasarkan 
// output prediksi MA yang sudah dihitung.
// =========================================

/**
 * Menghasilkan array rekomendasi berdasarkan data prediksi.
 * @param {Object} data - Objek berisi semua data hasil kalkulasi MA
 * @returns {Array} Array rekomendasi dengan level, ikon, judul, dan deskripsi
 */
function generateRekomendasi(data) {
    const rekomendasi = [];
    const { 
        keuntungan, prediksiBesokButir, populasi, biayaPakan,
        estimasiPendapatan, fullHistoryButir, proyeksi7HariKeuntungan,
        totalPakanKg, hargaPakan, hargaTelur, proyeksi7HariKg
    } = data;

    // Hitung tren produksi (naik/turun/stabil)
    const historyLen = fullHistoryButir.length;
    const produksiHariIni = fullHistoryButir[historyLen - 1];
    const produksiKemarin = historyLen >= 2 ? fullHistoryButir[historyLen - 2] : produksiHariIni;
    const perubahanProduksi = produksiHariIni - produksiKemarin;
    const persentasePerubahan = produksiKemarin > 0 ? ((perubahanProduksi / produksiKemarin) * 100) : 0;

    // Hitung HDP (Hen Day Production) — indikator kinerja produksi
    const hdp = populasi > 0 ? ((prediksiBesokButir / populasi) * 100) : 0;

    // Hitung rasio pendapatan vs biaya (profitability ratio)
    const rasioProfit = biayaPakan > 0 ? (estimasiPendapatan / biayaPakan) : 0;

    // Hitung tren 7 hari ke depan
    const avgProfit7 = proyeksi7HariKeuntungan.reduce((a, b) => a + b, 0) / 7;
    const hariRugi7 = proyeksi7HariKeuntungan.filter(k => k < 0).length;

    // ===== REKOMENDASI 1: STATUS FINANSIAL =====
    if (keuntungan < 0) {
        const defisit = Math.abs(keuntungan);
        rekomendasi.push({
            level: 'danger',
            icon: '🚨',
            title: 'PERINGATAN: Proyeksi Kerugian Terdeteksi!',
            description: `Prediksi menunjukkan potensi kerugian sebesar <strong>Rp ${Math.round(defisit).toLocaleString('id-ID')}</strong> per hari. Pendapatan (Rp ${Math.round(estimasiPendapatan).toLocaleString('id-ID')}) tidak cukup menutup biaya pakan (Rp ${Math.round(biayaPakan).toLocaleString('id-ID')}).`,
            actions: [
                '⚡ Evaluasi ulang harga jual telur — pertimbangkan negosiasi harga ke pengepul/agen',
                '📉 Kurangi biaya pakan dengan mencari supplier dengan harga lebih kompetitif',
                '🔍 Periksa ayam yang tidak produktif dan pertimbangkan afkir sebagian populasi',
                '📋 Catat pengeluaran tambahan selain pakan untuk menemukan pos-pos yang bisa ditekan'
            ]
        });
    } else if (keuntungan > 0 && keuntungan < biayaPakan * 0.1) {
        rekomendasi.push({
            level: 'warning',
            icon: '⚠️',
            title: 'Margin Keuntungan Tipis — Perlu Diwaspadai',
            description: `Keuntungan bersih hanya <strong>Rp ${Math.round(keuntungan).toLocaleString('id-ID')}</strong>, hanya ${((keuntungan / biayaPakan) * 100).toFixed(1)}% dari biaya pakan. Margin ini sangat rentan terhadap fluktuasi harga.`,
            actions: [
                '📊 Tingkatkan volume produksi dengan memperbaiki manajemen pakan dan pencahayaan',
                '💡 Pertimbangkan diversifikasi pendapatan (kotoran ayam jadi pupuk, dll)',
                '🔄 Optimalkan rasio pakan agar lebih efisien tanpa menurunkan produksi'
            ]
        });
    } else {
        rekomendasi.push({
            level: 'success',
            icon: '✅',
            title: 'Proyeksi Keuntungan Positif — Pertahankan!',
            description: `Prediksi keuntungan bersih <strong>Rp ${Math.round(keuntungan).toLocaleString('id-ID')}</strong> per hari dengan rasio profit ${rasioProfit.toFixed(2)}x dari modal pakan. Performa bisnis dalam kondisi sehat.`,
            actions: [
                '📈 Pertahankan manajemen pakan dan perawatan kandang saat ini',
                '💰 Sisihkan sebagian keuntungan sebagai dana cadangan operasional',
                '🐔 Pertimbangkan ekspansi populasi secara bertahap jika infrastruktur memadai'
            ]
        });
    }

    // ===== REKOMENDASI 2: KINERJA PRODUKSI (HDP) =====
    if (hdp >= 80) {
        rekomendasi.push({
            level: 'success',
            icon: '🏆',
            title: `Performa Produksi Sangat Baik (HDP: ${hdp.toFixed(1)}%)`,
            description: `Tingkat HDP (Hen Day Production) mencapai <strong>${hdp.toFixed(1)}%</strong>. Ini menunjukkan performa produksi ayam Anda di atas rata-rata industri (standar optimal ≥80%).`,
            actions: [
                '🌟 Dokumentasikan kondisi pakan dan perawatan saat ini sebagai standar referensi',
                '🧪 Pastikan jadwal vaksinasi tetap terjaga untuk mempertahankan stamina ayam'
            ]
        });
    } else if (hdp >= 60) {
        rekomendasi.push({
            level: 'info',
            icon: '📊',
            title: `Produksi Cukup Baik — Masih Bisa Ditingkatkan (HDP: ${hdp.toFixed(1)}%)`,
            description: `HDP saat ini <strong>${hdp.toFixed(1)}%</strong>, masih di bawah standar optimal. Ada ruang peningkatan yang signifikan.`,
            actions: [
                '💡 Periksa intensitas dan durasi pencahayaan kandang (idealnya 16 jam/hari)',
                '🥬 Evaluasi kualitas dan komposisi pakan — pertimbangkan tambahan kalsium/mineral',
                '🌡️ Pastikan suhu kandang optimal (20-25°C) dan ventilasi memadai',
                '💧 Pastikan akses air minum bersih dan cukup sepanjang hari'
            ]
        });
    } else {
        rekomendasi.push({
            level: 'danger',
            icon: '📉',
            title: `Produksi di Bawah Standar (HDP: ${hdp.toFixed(1)}%)`,
            description: `HDP hanya <strong>${hdp.toFixed(1)}%</strong>, jauh di bawah standar industri. Perlu tindakan segera untuk meningkatkan produktivitas ternak.`,
            actions: [
                '🩺 Lakukan pemeriksaan kesehatan menyeluruh — kemungkinan ada penyakit atau stres',
                '🥚 Periksa umur ayam — jika sudah melebihi masa produktif, pertimbangkan replacement',
                '🏠 Audit kondisi kandang (kebersihan, kepadatan, ventilasi, pencahayaan)',
                '🧪 Konsultasikan ke dokter hewan atau tenaga penyuluhan ternak terdekat'
            ]
        });
    }

    // ===== REKOMENDASI 3: TREN PRODUKSI =====
    if (persentasePerubahan < -10) {
        rekomendasi.push({
            level: 'warning',
            icon: '📉',
            title: `Tren Produksi Turun Drastis (${persentasePerubahan.toFixed(1)}%)`,
            description: `Produksi turun <strong>${Math.abs(persentasePerubahan).toFixed(1)}%</strong> dari hari sebelumnya (${produksiKemarin.toLocaleString('id-ID')} → ${produksiHariIni.toLocaleString('id-ID')} butir). Penurunan tajam ini perlu ditangani segera.`,
            actions: [
                '🔍 Identifikasi penyebab penurunan — cuaca, perubahan pakan, atau gangguan',
                '🩺 Cek apakah ada tanda-tanda penyakit atau stres pada ayam',
                '📋 Crosscheck data pengambilan telur — pastikan tidak ada telur yang tercecer/hilang'
            ]
        });
    } else if (persentasePerubahan > 10) {
        rekomendasi.push({
            level: 'success',
            icon: '📈',
            title: `Tren Produksi Meningkat Signifikan (+${persentasePerubahan.toFixed(1)}%)`,
            description: `Produksi naik <strong>${persentasePerubahan.toFixed(1)}%</strong> dari hari sebelumnya. Tren positif ini menunjukkan kondisi ternak yang membaik.`,
            actions: [
                '🌟 Catat kondisi pakan, cuaca, dan perawatan saat ini sebagai patokan',
                '📦 Siapkan penampung/tray tambahan untuk mengantisipasi peningkatan panen'
            ]
        });
    }

    // ===== REKOMENDASI 4: KEBUTUHAN PAKAN =====
    rekomendasi.push({
        level: 'info',
        icon: '🥬',
        title: `Estimasi Kebutuhan Pakan: ${totalPakanKg.toFixed(1)} Kg/Hari`,
        description: `Dengan populasi <strong>${populasi.toLocaleString('id-ID')} ekor</strong>, kebutuhan pakan harian adalah <strong>${totalPakanKg.toFixed(1)} Kg</strong> (Rp ${Math.round(biayaPakan).toLocaleString('id-ID')}/hari). Perkiraan kebutuhan mingguan: <strong>${(totalPakanKg * 7).toFixed(1)} Kg</strong>.`,
        actions: [
            `📦 Pastikan stok pakan cukup untuk minimal 7 hari (${(totalPakanKg * 7).toFixed(0)} Kg)`,
            `💰 Siapkan anggaran pakan mingguan: Rp ${Math.round(biayaPakan * 7).toLocaleString('id-ID')}`
        ]
    });

    // ===== REKOMENDASI 5: PROYEKSI 7 HARI =====
    if (hariRugi7 > 0) {
        rekomendasi.push({
            level: hariRugi7 >= 4 ? 'danger' : 'warning',
            icon: '📅',
            title: `Peringatan 7 Hari: ${hariRugi7} Hari Potensi Rugi`,
            description: `Dari proyeksi 7 hari kedepan, <strong>${hariRugi7} hari</strong> diprediksi mengalami kerugian. Rata-rata laba/rugi per hari: <strong>Rp ${Math.round(avgProfit7).toLocaleString('id-ID')}</strong>.`,
            actions: [
                '📋 Siapkan strategi mitigasi jangka menengah untuk menekan biaya operasional',
                '🔄 Rebalance populasi — pertimbangkan pengurangan ayam non-produktif',
                '💵 Jangan menambah investasi besar sampai tren produksi membaik'
            ]
        });
    } else {
        rekomendasi.push({
            level: 'success',
            icon: '📅',
            title: 'Proyeksi 7 Hari: Semua Positif!',
            description: `Seluruh proyeksi 7 hari ke depan menunjukkan keuntungan. Rata-rata laba harian: <strong>Rp ${Math.round(avgProfit7).toLocaleString('id-ID')}</strong>.`,
            actions: [
                '🎯 Manfaatkan momentum ini untuk mengoptimalkan operasional',
                '💰 Alokasikan surplus keuntungan untuk perbaikan infrastruktur kandang'
            ]
        });
    }

    return rekomendasi;
}

/**
 * Merender UI rekomendasi prediktif ke dalam DOM
 * @param {Array} rekomendasi - Array objek rekomendasi
 */
function renderRekomendasi(rekomendasi) {
    const container = document.getElementById('rekomendasiContainer');
    const content = document.getElementById('rekomendasiContent');
    if (!container || !content) return;

    container.style.display = 'block';
    content.innerHTML = '';

    const levelColors = {
        danger:  { bg: 'linear-gradient(135deg, #fff5f5, #ffe4e6)', border: '#fca5a5', accent: '#dc2626', badge: '#ef4444' },
        warning: { bg: 'linear-gradient(135deg, #fffbeb, #fef3c7)', border: '#fcd34d', accent: '#d97706', badge: '#f59e0b' },
        success: { bg: 'linear-gradient(135deg, #f0fdf4, #dcfce7)', border: '#86efac', accent: '#16a34a', badge: '#22c55e' },
        info:    { bg: 'linear-gradient(135deg, #eff6ff, #dbeafe)', border: '#93c5fd', accent: '#2563eb', badge: '#3b82f6' }
    };

    rekomendasi.forEach((rec, idx) => {
        const colors = levelColors[rec.level] || levelColors.info;
        
        let actionsHTML = '';
        if (rec.actions && rec.actions.length > 0) {
            actionsHTML = `
                <div style="margin-top: 14px; padding-top: 14px; border-top: 1px dashed ${colors.border};">
                    <p style="font-size: 0.82rem; font-weight: 700; color: ${colors.accent}; margin-bottom: 8px;">💡 Tindakan yang Disarankan:</p>
                    <ul style="margin: 0; padding-left: 18px; list-style: none;">
                        ${rec.actions.map(a => `
                            <li style="font-size: 0.85rem; color: #4a5568; margin-bottom: 6px; padding: 5px 0; line-height: 1.5;">
                                ${a}
                            </li>
                        `).join('')}
                    </ul>
                </div>
            `;
        }

        const cardHTML = `
            <div class="rekomendasi-card animate__animated animate__fadeInUp" 
                 style="background: ${colors.bg}; border: 1.5px solid ${colors.border}; border-radius: 14px; padding: 20px; margin-bottom: 16px; 
                        box-shadow: 0 4px 15px rgba(0,0,0,0.05); transition: all 0.3s ease; position: relative; overflow: hidden; animation-delay: ${idx * 0.1}s;">
                <div style="position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: ${colors.accent}; border-radius: 4px 0 0 4px;"></div>
                <div style="display: flex; align-items: flex-start; gap: 14px; padding-left: 10px;">
                    <span style="font-size: 1.8rem; flex-shrink: 0; filter: drop-shadow(0 2px 3px rgba(0,0,0,0.1));">${rec.icon}</span>
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px; flex-wrap: wrap;">
                            <span style="background: ${colors.badge}; color: white; font-size: 0.7rem; font-weight: 700; padding: 3px 10px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px;">${rec.level}</span>
                            <h4 style="margin: 0; font-size: 1rem; font-weight: 700; color: #1a202c; line-height: 1.4;">${rec.title}</h4>
                        </div>
                        <p style="margin: 0; font-size: 0.9rem; color: #4a5568; line-height: 1.7;">${rec.description}</p>
                        ${actionsHTML}
                    </div>
                </div>
            </div>
        `;

        content.innerHTML += cardHTML;
    });

    // Scroll ke rekomendasi
    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * Fungsi Sub-Renderer: ChartJS Maker.
 * Memuat dua sisi sumbu Axis (Kg vs Rupiah). Sumbu kiri dan Sumbu kanan bertumpang tindih secara canggih.
 * @param {Array} historyKg - Data produksi aktual (Kg)
 * @param {Array} historyKeuntungan - Data keuntungan aktual (Rp)
 * @param {Array} predictKg - Data ramalan produksi 7 hari (Kg)
 * @param {Array} predictKeuntungan - Data ramalan keuntungan 7 hari (Rp)
 */
function updateChart(historyKg, historyKeuntungan, predictKg, predictKeuntungan) {
    const ctx = document.getElementById('profitChart').getContext('2d');

    // Mencegah 'Glitches' grafik duplikat karena pengguna klik analisis berkali-kali - Destroy jika kanvas bernyawa tua.
    if (predictionChart) {
        predictionChart.destroy();
    }

    let labels = []; // Untuk wadah teks garis x (bawah)

    let dataHistoryKg = [];
    let dataPredictKg = [];
    let dataHistoryKeuntungan = [];
    let dataPredictKeuntungan = [];

    // --- Bagian A: Membuat Tata Riwayat Grafik Historis Kiri ---
    // (Dari rentang H minus lama sampai Hari Ini=H minus nol/0)
    for (let i = historyKg.length; i > 0; i--) {
        labels.push(i === 1 ? "Hari Ini" : `H-${i - 1}`); // Menyusun nama hari bawah
        dataHistoryKg.push(historyKg[historyKg.length - i]);
        dataHistoryKeuntungan.push(historyKeuntungan[historyKeuntungan.length - i]);

        // Masa depan bernilai Null supaya tidak muncul titik merah prediksi di alam historis.
        dataPredictKg.push(null);
        dataPredictKeuntungan.push(null);
    }

    // --- TRICK GRAFIK CANGGIH (Penyambung Tali) ---
    // Paksa agar awal garis Proyeksi (Masa Depan) "Mengakar" bersentuhan menyambung utuh dengan titik penghabisan historis "Hari Ini" 
    dataPredictKg[dataPredictKg.length - 1] = historyKg[historyKg.length - 1];
    dataPredictKeuntungan[dataPredictKeuntungan.length - 1] = historyKeuntungan[historyKeuntungan.length - 1];

    // --- Bagian B: Membuat Tata Riwayat Grafik PREDIKSI Kanan (Esok Harinya) ---
    // Plot hasil ramalan (H+1 sd H+7 ke kanan layar)
    for (let i = 0; i < predictKg.length; i++) {
        labels.push(`H+${i + 1}`);
        dataHistoryKg.push(null);       // Sisi riwayat mati
        dataHistoryKeuntungan.push(null); // Sisi riwayat mati

        dataPredictKg.push(predictKg[i]); // Hidup
        dataPredictKeuntungan.push(predictKeuntungan[i]); // Hidup
    }

    // --- FINALISASI RENDER CHART INSTANCE BARU ---
    predictionChart = new Chart(ctx, {
        type: 'line', // Jenis Grafik Garis Sambung
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Aktual Produksi (Kg)',  // Dataset 1: Biru Terang (Timbangan Pasti)
                    data: dataHistoryKg,
                    borderColor: '#3498db',
                    backgroundColor: '#3498db',
                    borderWidth: 3,
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    tension: 0.4, // Melengkung mulus bak gelombang air, bukan patah zig-zag
                    yAxisID: 'y' // Menginduk pada Timbangan Y bagian Kiri
                },
                {
                    label: 'Proyeksi Produksi (Kg)', // Dataset 2: Kuning Terang (Tebakan MA Masa Depan)
                    data: dataPredictKg,
                    borderColor: '#f39c12',
                    backgroundColor: '#f39c12',
                    borderDash: [5, 5], // Striped / Garis Terputus-putus
                    borderWidth: 3,
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    tension: 0.4,
                    yAxisID: 'y'
                },
                {
                    label: 'Aktual Keuntungan (Rp)', // Dataset 3: Hijau Berlatar tipis (Dompet Real)
                    data: dataHistoryKeuntungan,
                    borderColor: '#27ae60',
                    backgroundColor: 'rgba(39, 174, 96, 0.15)', // Fill bawah
                    borderWidth: 2,
                    fill: 'origin', // Pewarnaan transparan dari dasar x mengarsir tembus ketas garis line nya.
                    pointRadius: 4,
                    tension: 0.4,
                    yAxisID: 'y1' // Menginduk pada Skala Uang Y1 bagian Kanan Ujung!
                },
                {
                    label: 'Proyeksi Keuntungan (Rp)', // Dataset 4: Merah (Pertaruhan Rupiahnya)
                    data: dataPredictKeuntungan,
                    borderColor: '#e74c3c',
                    backgroundColor: 'rgba(231, 76, 60, 0.1)',
                    borderDash: [5, 5], // Putus-putus
                    borderWidth: 2,
                    fill: 'origin',
                    pointRadius: 4,
                    tension: 0.4,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, // Menyesuaikan wadah layar div bungkusnya
            interaction: {
                mode: 'index',
                intersect: false, // Disorot dari jauh aja lgsung muncul semua data vertikal popup nya.
            },
            plugins: {
                legend: {
                    position: 'bottom', // Kotak keterangan ditaruh dasar bawah
                    labels: {
                        usePointStyle: true, // Jadi Ikon titik sircle
                        boxWidth: 8,
                        padding: 20
                    }
                },
                // Aturan Khusus Balon PopUp Angka Detail (Hover Tooltip Mode)
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            // Kita punya 4 dataset.
                            // Idx 0 (His. Kg) dan Idx 1 (Pred. Kg) menggunakan satuan Kilogram serta wujud Butir rahib
                            if (context.parsed.y !== null) {
                                if (context.datasetIndex < 2) {
                                    let butir = Math.round(context.parsed.y * 16);
                                    label += context.parsed.y.toFixed(2) + ' Kg (' + butir.toLocaleString('id-ID') + ' Butir)';
                                } else {
                                    // Idx 2 و Idx 3 memegang satuan Rupiah Rp untuk keuangan/laba bersih.
                                    label += 'Rp ' + Math.round(context.parsed.y).toLocaleString('id-ID');
                                }
                            }
                            return label;
                        }
                    }
                }
            },
            // Struktur Sumbu Ganda (Dual Axes) Skala Kiri VS Kanan 
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left', // Di kiri garis grafis ini
                    title: {
                        display: true,
                        text: 'Produksi (Kg)',
                        font: { weight: 'bold' }
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right', // Di kanan membentang paralel sepadan sumbu Y kiri
                    title: {
                        display: true,
                        text: 'Finansial (Rp)',
                        font: { weight: 'bold' }
                    },
                    grid: {
                        drawOnChartArea: false // Mencegah Jala/garis kotak pudar grafik yang bertumpuk kusut 
                    }
                }
            }
        }
    });
}


// =========================================
// 5. FITUR BARU: HISTORI PREDIKSI (FIRESTORE)
// Penjelasan: Menyimpan, memuat, dan menghapus 
// riwayat prediksi ke/dari Google Firestore.
// =========================================

/**
 * Menyimpan hasil prediksi ke Firestore
 * @param {Object} data - Data prediksi yang akan disimpan
 */
async function savePredictionHistory(data) {
    try {
        // Ambil rekomendasi utama (level tertinggi)
        let rekUtama = '-';
        if (data.rekomendasi && data.rekomendasi.length > 0) {
            rekUtama = data.rekomendasi[0].title;
        }

        // Ambil label batch yang sedang dipilih
        const batchSelect = document.getElementById('populasiBatch');
        const selectedBatchLabel = batchSelect ? batchSelect.options[batchSelect.selectedIndex].textContent : '-';

        const payload = {
            tanggal: new Date().toISOString(),
            periodeMA: data.periodeMA,
            populasi: data.populasi,
            batchLabel: selectedBatchLabel,
            prediksiBesokKg: data.prediksiBesokKg,
            prediksiBesokButir: data.prediksiBesokButir,
            estimasiPendapatan: data.estimasiPendapatan,
            biayaPakan: data.biayaPakan,
            keuntungan: data.keuntungan,
            proyeksi7HariKg: data.proyeksi7HariKg,
            proyeksi7HariKeuntungan: data.proyeksi7HariKeuntungan,
            rekomendasiUtama: rekUtama,
            rekomendasi: data.rekomendasi.map(r => ({
                level: r.level,
                icon: r.icon,
                title: r.title,
                description: r.description,
                actions: r.actions || []
            }))
        };

        await addDoc(historyCollection, payload);
        console.log("✅ Histori prediksi tersimpan.");
        loadPredictionHistory(); // Refresh table setelah menyimpan
    } catch (error) {
        console.error("❌ Gagal menyimpan histori:", error);
    }
}

/**
 * Memuat histori prediksi dari Firestore secara Real-Time
 */
async function loadPredictionHistory() {
    try {
        const q = query(historyCollection, orderBy("tanggal", "desc"), limit(20));
        const snapshot = await getDocs(q);
        
        const histories = snapshot.docs.map(d => ({
            id: d.id,
            ...d.data()
        }));
        renderHistoryTable(histories);
    } catch (error) {
        console.error("Error loading history:", error);
    }
}

/**
 * Merender tabel histori prediksi
 * @param {Array} histories - Array data histori prediksi
 */
function renderHistoryTable(histories) {
    const tbody = document.getElementById('historyTableBody');
    if (!tbody) return;

    if (histories.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 40px; color: #7f8c8d; font-style: italic; background-color: #fcfcfc;">
                    📜 Belum ada histori prediksi. Lakukan analisis prediksi untuk mulai menyimpan riwayat.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = '';

    histories.forEach((h, idx) => {
        const tgl = new Date(h.tanggal);
        const tglStr = tgl.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        const waktuStr = tgl.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        
        const profitStyle = h.keuntungan < 0 
            ? "color: #e74c3c; font-weight: 700;" 
            : "color: #27ae60; font-weight: 700;";

        const levelBadge = h.rekomendasi && h.rekomendasi[0] 
            ? getLevelBadgeHTML(h.rekomendasi[0].level)
            : '<span style="color: #7f8c8d;">-</span>';

        const rekTitle = h.rekomendasiUtama || '-';
        // Truncate if too long
        const rekTitleShort = rekTitle.length > 45 ? rekTitle.substring(0, 42) + '...' : rekTitle;

        const tr = document.createElement('tr');
        tr.style.borderBottom = "1px solid #f1f2f6";
        tr.style.transition = "background-color 0.2s ease";
        tr.onmouseenter = function() { this.style.backgroundColor = '#f8f9fa'; };
        tr.onmouseleave = function() { this.style.backgroundColor = ''; };

        tr.innerHTML = `
            <td style="padding: 14px; text-align: center; color: #636e72; font-weight: 700;">
                ${idx + 1}
            </td>
            <td style="padding: 14px; color: #2c3e50;">
                <div style="font-weight: 600; font-size: 0.9rem;">${tglStr}</div>
                <div style="font-size: 0.78rem; color: #95a5a6;">🕐 ${waktuStr}</div>
            </td>
            <td style="padding: 14px;">
                <span style="background: linear-gradient(135deg, #9b59b6, #8e44ad); color: white; padding: 3px 10px; border-radius: 6px; font-size: 0.82rem; font-weight: 700;">
                    MA-${h.periodeMA}
                </span>
            </td>
            <td style="padding: 14px; color: #2c3e50;">
                <span style="font-weight: 700; color: #2980b9;">${h.prediksiBesokKg ? h.prediksiBesokKg.toFixed(2) : '0'} Kg ${(h.prediksiBesokButir || 0).toLocaleString('id-ID')} Butir</span>
            </td>
            <td style="padding: 14px; ${profitStyle} font-size: 0.95rem;">
                Rp ${Math.round(h.keuntungan || 0).toLocaleString('id-ID')}
            </td>
            <td style="padding: 14px; font-size: 0.82rem; color: #4a5568;">
                ${levelBadge}
                <div style="margin-top: 4px; line-height: 1.4;" title="${rekTitle}">${rekTitleShort}</div>
            </td>
            <td style="padding: 14px; text-align: center;">
                <div style="display: flex; gap: 6px; justify-content: center;">
                    <button onclick="viewHistoryDetail('${h.id}')" title="Lihat Detail"
                        style="background: linear-gradient(135deg, #3498db, #2980b9); color: white; border: none; width: 32px; height: 32px; border-radius: 8px; font-size: 0.9rem; cursor: pointer; box-shadow: 0 2px 5px rgba(52,152,219,0.3); transition: all 0.2s ease; display: flex; align-items: center; justify-content: center;"
                        onmouseenter="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 8px rgba(52,152,219,0.4)';"
                        onmouseleave="this.style.transform=''; this.style.boxShadow='0 2px 5px rgba(52,152,219,0.3)';">
                        👁️
                    </button>
                    <button onclick="deleteHistoryItem('${h.id}')" title="Hapus Data"
                        style="background: linear-gradient(135deg, #e74c3c, #c0392b); color: white; border: none; width: 32px; height: 32px; border-radius: 8px; font-size: 0.9rem; cursor: pointer; box-shadow: 0 2px 5px rgba(231,76,60,0.3); transition: all 0.2s ease; display: flex; align-items: center; justify-content: center;"
                        onmouseenter="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 8px rgba(231,76,60,0.4)';"
                        onmouseleave="this.style.transform=''; this.style.boxShadow='0 2px 5px rgba(231,76,60,0.3)';">
                        🗑️
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

/**
 * Mendapatkan HTML badge berdasarkan level rekomendasi
 */
function getLevelBadgeHTML(level) {
    const map = {
        danger:  { bg: '#ef4444', label: 'BAHAYA' },
        warning: { bg: '#f59e0b', label: 'WASPADA' },
        success: { bg: '#22c55e', label: 'BAIK' },
        info:    { bg: '#3b82f6', label: 'INFO' }
    };
    const cfg = map[level] || map.info;
    return `<span style="background: ${cfg.bg}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.3px;">${cfg.label}</span>`;
}

// Simpan cache histori untuk view detail (dipakai oleh viewHistoryDetail)
let cachedHistories = [];

/**
 * Menampilkan detail histori prediksi dalam SweetAlert modal
 * @param {string} historyId - ID dokumen Firestore 
 */
window.viewHistoryDetail = async function(historyId) {
    try {
        // Ambil langsung dari Firestore
        const { getDoc } = await import("https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js");
        const docSnap = await getDoc(doc(db, "prediksi_history", historyId));
        
        if (!docSnap.exists()) {
            Swal.fire('Tidak Ditemukan', 'Data histori tidak ditemukan.', 'error');
            return;
        }

        const h = docSnap.data();
        const tgl = new Date(h.tanggal);
        const tglStr = tgl.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        const waktuStr = tgl.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        // Build rekomendasi HTML
        let rekHTML = '';
        if (h.rekomendasi && h.rekomendasi.length > 0) {
            rekHTML = h.rekomendasi.map(r => {
                const levelColors = {
                    danger: '#ef4444', warning: '#f59e0b', success: '#22c55e', info: '#3b82f6'
                };
                const color = levelColors[r.level] || '#3b82f6';
                const actionsStr = r.actions && r.actions.length > 0 
                    ? r.actions.map(a => `<li style="font-size:0.82rem; margin-bottom:4px; color:#4a5568;">${a}</li>`).join('') 
                    : '';
                return `
                    <div style="border-left: 4px solid ${color}; padding: 10px 14px; margin-bottom: 10px; background: #f9fafb; border-radius: 0 8px 8px 0;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                            <span style="font-size: 1.2rem;">${r.icon}</span>
                            <strong style="font-size: 0.88rem; color: #1a202c;">${r.title}</strong>
                        </div>
                        <p style="font-size: 0.82rem; color: #4a5568; margin: 4px 0; line-height: 1.5;">${r.description}</p>
                        ${actionsStr ? `<ul style="margin: 6px 0 0 16px; padding: 0; list-style: disc;">${actionsStr}</ul>` : ''}
                    </div>
                `;
            }).join('');
        }

        // Build 7-day projection table
        let proj7HTML = '';
        if (h.proyeksi7HariKg && h.proyeksi7HariKg.length > 0) {
            proj7HTML = '<table style="width:100%; border-collapse:collapse; margin-top:10px; font-size:0.82rem;">';
            proj7HTML += '<tr style="background: linear-gradient(90deg, #34495e, #2c3e50); color:white;"><th style="padding:12px 8px; font-size:0.8rem; text-transform:uppercase; letter-spacing:0.5px;">Hari</th><th style="padding:12px 8px; font-size:0.8rem; text-transform:uppercase; letter-spacing:0.5px;">Produksi</th><th style="padding:12px 8px; font-size:0.8rem; text-transform:uppercase; letter-spacing:0.5px;">Laba</th></tr>';
            for (let i = 0; i < h.proyeksi7HariKg.length; i++) {
                const kg = h.proyeksi7HariKg[i];
                const profit = h.proyeksi7HariKeuntungan[i];
                const pStyle = profit < 0 ? 'color:#e74c3c;font-weight:700;' : 'color:#27ae60;font-weight:700;';
                const factor = h.prediksiBesokKg > 0 ? (h.prediksiBesokButir / h.prediksiBesokKg) : 16;
                const butir = Math.round(kg * factor);
                proj7HTML += `<tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:12px 8px; text-align:center; font-weight:600; color:#475569; background:#f8fafc;">H+${i+1}</td>
                    <td style="padding:12px 8px; color:#0284c7; font-weight:600;">${kg.toFixed(2)} Kg <span style="font-size:0.75rem; color:#64748b; font-weight:400; margin-left:4px;">(${butir.toLocaleString('id-ID')} Butir)</span></td>
                    <td style="padding:12px 8px; ${pStyle}">Rp ${Math.round(profit).toLocaleString('id-ID')}</td>
                </tr>`;
            }
            proj7HTML += '</table>';
        }

        const profitStyle = h.keuntungan < 0 ? 'color: #e74c3c;' : 'color: #27ae60;';

        // Add MAE & Akurasi logic
        let akurasi = h.akurasiModel !== undefined && h.akurasiModel !== null ? h.akurasiModel : 0;
        if (akurasi === 0 && h.keuntungan && h.estimasiPendapatan && !h.hasOwnProperty('akurasiModel')) {
            const rasio = (h.keuntungan / h.estimasiPendapatan) * 100;
            akurasi = Math.max(0, Math.min(100, 50 + rasio));
        }
        let maeText = h.maeButir !== undefined && h.maeButir !== null ? `± ${Math.round(h.maeButir)} Butir` : '-';
        let akurasiText = h.akurasiModel !== null ? `${Math.round(akurasi)}%` : 'N/A';

        Swal.fire({
            title: `📊 Detail Prediksi`,
            html: `
                <div style="text-align: left; max-height: 70vh; overflow-y: auto; padding: 5px; font-family: 'Poppins', sans-serif;">
                    <!-- Banner Informasi Utama -->
                    <div style="background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 20px; border-radius: 16px; margin-bottom: 20px; box-shadow: 0 4px 15px rgba(118, 75, 162, 0.2);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 10px;">
                            <div style="font-size: 0.85rem; font-weight: 600;">📅 ${tglStr}</div>
                            <div style="font-size: 0.85rem; font-weight: 600;">🕐 ${waktuStr}</div>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                            <div style="font-size: 0.8rem; opacity: 0.9;">📦 <b>Batch:</b> ${h.batchLabel || '-'}</div>
                            <div style="font-size: 0.8rem; opacity: 0.9;">📈 <b>Metode:</b> MA-${h.periodeMA} Hari</div>
                            <div style="font-size: 0.8rem; opacity: 0.9;">🐓 <b>Populasi:</b> ${(h.populasi || 0).toLocaleString('id-ID')} Ekor</div>
                        </div>
                    </div>

                    <!-- Kartu Ringkasan Hasil -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                        <!-- Kartu Produksi -->
                        <div style="background: #f0f8ff; border: 1.5px solid #bae6fd; padding: 15px; border-radius: 14px; text-align: center; box-shadow: 0 4px 10px rgba(59, 130, 246, 0.05);">
                            <div style="font-size: 0.75rem; color: #0369a1; font-weight: 700; text-transform: uppercase; margin-bottom: 5px;">Produksi</div>
                            <div style="font-size: 1.1rem; font-weight: 800; color: #0284c7;">${h.prediksiBesokKg ? h.prediksiBesokKg.toFixed(2) : '0'} <span style="font-size: 0.8rem;">Kg</span></div>
                            <div style="font-size: 0.8rem; font-weight: 600; color: #0369a1; margin-top: 2px;">${(h.prediksiBesokButir || 0).toLocaleString('id-ID')} Btr</div>
                        </div>
                        <!-- Kartu Laba -->
                        <div style="background: ${h.keuntungan < 0 ? '#fff5f5' : '#f0fdf4'}; border: 1.5px solid ${h.keuntungan < 0 ? '#fecdd3' : '#bcebcf'}; padding: 15px; border-radius: 14px; text-align: center; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);">
                            <div style="font-size: 0.75rem; color: ${h.keuntungan < 0 ? '#991b1b' : '#166534'}; font-weight: 700; text-transform: uppercase; margin-bottom: 5px;">${h.keuntungan < 0 ? 'Rugi' : 'Laba'}</div>
                            <div style="font-size: 1.1rem; font-weight: 800; ${profitStyle}">Rp ${Math.round(Math.abs(h.keuntungan || 0)).toLocaleString('id-ID')}</div>
                            <div style="font-size: 0.7rem; color: #64748b; margin-top: 2px;">Estimasi H+1</div>
                        </div>
                    </div>

                    <!-- Tabel Proyeksi -->
                    <h4 style="font-size: 0.95rem; color: #2c3e50; margin-bottom: 12px; border-left: 4px solid #667eea; padding-left: 10px; font-weight: 700;">📅 Proyeksi 7 Hari Kedepan</h4>
                    <div style="border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-bottom: 20px;">
                        ${proj7HTML}
                    </div>

                    <!-- Rekomendasi -->
                    <h4 style="font-size: 0.95rem; color: #4a1f8a; margin: 25px 0 12px; border-left: 4px solid #9b59b6; padding-left: 10px; font-weight: 700;">🧠 Rekomendasi & Tindakan</h4>
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        ${rekHTML || '<p style="color: #7f8c8d; font-style: italic; text-align: center; padding: 20px;">Tidak ada rekomendasi tersimpan.</p>'}
                    </div>
                </div>
            `,
            width: '650px',
            showConfirmButton: true,
            confirmButtonText: 'Tutup',
            confirmButtonColor: '#667eea'
        });
    } catch (error) {
        console.error("Error loading history detail:", error);
        Swal.fire('Error', 'Gagal memuat detail histori: ' + error.message, 'error');
    }
};

/**
 * Menghapus satu item histori prediksi dari Firestore
 * @param {string} historyId - ID dokumen histori yang akan dihapus
 */
window.deleteHistoryItem = async function(historyId) {
    const result = await Swal.fire({
        title: 'Hapus Data Ini?',
        text: 'Data histori ini akan dihapus permanen.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#e74c3c',
        cancelButtonColor: '#95a5a6',
        confirmButtonText: 'Ya, Hapus!',
        cancelButtonText: 'Batal'
    });

    if (!result.isConfirmed) return;

    try {
        const { doc, deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js");
        await deleteDoc(doc(db, "prediksi_history", historyId));

        Swal.fire({
            icon: 'success',
            title: 'Terhapus!',
            text: 'Data histori berhasil dihapus.',
            timer: 1500,
            showConfirmButton: false
        });

        // Muat ulang tabel
        loadPredictionHistory();
    } catch (error) {
        console.error("Error deleting history item:", error);
        Swal.fire('Error', 'Gagal menghapus data: ' + error.message, 'error');
    }
};

/**
 * Menghapus seluruh histori prediksi dari Firestore
 */
window.clearPredictionHistory = async function() {
    const result = await Swal.fire({
        title: 'Hapus Semua Histori?',
        text: 'Semua riwayat prediksi akan dihapus secara permanen dari database.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#e74c3c',
        cancelButtonColor: '#95a5a6',
        confirmButtonText: 'Ya, Hapus Semua!',
        cancelButtonText: 'Batal'
    });

    if (!result.isConfirmed) return;

    try {
        const snapshot = await getDocs(historyCollection);
        
        if (snapshot.empty) {
            Swal.fire('Kosong', 'Tidak ada histori untuk dihapus.', 'info');
            return;
        }

        const deletePromises = snapshot.docs.map(d => deleteDoc(doc(db, "prediksi_history", d.id)));
        await Promise.all(deletePromises);

        Swal.fire({
            icon: 'success',
            title: 'Terhapus!',
            text: `${snapshot.size} riwayat prediksi berhasil dihapus.`,
            timer: 2000,
            showConfirmButton: false
        });

        // Panggil fungsi ini agar tabel di layar langsung kosong tanpa perlu reload halaman
        loadPredictionHistory();
    } catch (error) {
        console.error("Error clearing history:", error);
        Swal.fire('Error', 'Gagal menghapus histori: ' + error.message, 'error');
    }
};

// =========================================
// 6. FITUR BARU: DOWNLOAD CSV PREDIKSI
// Penjelasan: Menghasilkan file CSV dari hasil prediksi
// aktif (lastPredictionData) termasuk rekomendasi prediktif.
// Data ini juga bisa diakses melalui halaman dokumen.html.
// =========================================

/**
 * Mengunduh hasil prediksi beserta rekomendasi ke format file CSV (.csv)
 * Data CSV mencakup: ringkasan prediksi H+1, proyeksi 7 hari, dan daftar rekomendasi tindakan.
 */
window.downloadPrediksiCSV = function() {
    if (!lastPredictionData) {
        Swal.fire('Belum Ada Data', 'Lakukan analisis prediksi terlebih dahulu sebelum mengunduh.', 'info');
        return;
    }

    const d = lastPredictionData;
    const sanitize = (v) => String(v || '').replace(/,/g, ';').replace(/\n/g, ' ').replace(/<[^>]*>/g, ''); // Hapus HTML tag
    const tglFormatted = new Date(d.tanggal).toLocaleString('id-ID');

    let csv = '\uFEFF'; // BOM agar Excel bisa baca karakter khusus

    // ===== BAGIAN 1: INFO UMUM PREDIKSI =====
    csv += '=== LAPORAN HASIL PREDIKSI MA - LIBAS ===\n';
    csv += `Tanggal Analisis,${sanitize(tglFormatted)}\n`;
    csv += `Batch/Populasi,${sanitize(d.batchLabel)}\n`;
    csv += `Periode MA (Hari),${d.periodeMA}\n`;
    csv += `Jumlah Populasi (Ekor),${d.populasi}\n`;
    csv += '\n';

    // ===== BAGIAN 2: RINGKASAN PREDIKSI H+1 =====
    csv += '=== RINGKASAN PREDIKSI HARI ESOK (H+1) ===\n';
    csv += 'Parameter,Nilai\n';
    csv += `Prediksi Produksi (Kg),${d.prediksiBesokKg.toFixed(2)}\n`;
    csv += `Prediksi Produksi (Butir),${d.prediksiBesokButir}\n`;
    csv += `Estimasi Pendapatan (Rp),${Math.round(d.estimasiPendapatan)}\n`;
    csv += `Biaya Pakan (Rp),${Math.round(d.biayaPakan)}\n`;
    csv += `Proyeksi Laba Bersih (Rp),${Math.round(d.keuntungan)}\n`;
    csv += `Status Keuangan,${d.keuntungan >= 0 ? 'UNTUNG' : 'RUGI'}\n`;
    csv += '\n';

    // ===== BAGIAN 3: PROYEKSI 7 HARI =====
    csv += '=== PROYEKSI 7 HARI KE DEPAN ===\n';
    csv += 'Hari,Produksi (Kg),Produksi (Butir),Proyeksi Laba/Rugi (Rp),Status\n';
    for (let i = 0; i < d.proyeksi7HariKg.length; i++) {
        const kg = d.proyeksi7HariKg[i];
        const butir = Math.round(kg * 16);
        const profit = d.proyeksi7HariKeuntungan[i];
        const status = profit >= 0 ? 'UNTUNG' : 'RUGI';
        csv += `H+${i + 1},${kg.toFixed(2)},${butir},${Math.round(profit)},${status}\n`;
    }
    csv += '\n';

    // ===== BAGIAN 4: REKOMENDASI PREDIKTIF =====
    csv += '=== REKOMENDASI PREDIKTIF DAN TINDAKAN ===\n';
    csv += 'No,Level,Judul Rekomendasi,Tindakan yang Disarankan\n';
    if (d.rekomendasi && d.rekomendasi.length > 0) {
        d.rekomendasi.forEach((r, idx) => {
            const actionsStr = r.actions ? r.actions.map(a => sanitize(a)).join(' | ') : '-';
            csv += `${idx + 1},${r.level.toUpperCase()},${sanitize(r.title)},${actionsStr}\n`;
        });
    }

    // Buat dan trigger download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const tglFile = new Date(d.tanggal).toISOString().split('T')[0];
    link.href = url;
    link.download = `laporan_prediksi_MA${d.periodeMA}_${tglFile}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    Swal.fire({
        icon: 'success',
        title: 'CSV Berhasil Diunduh!',
        html: `File <b>laporan_prediksi_MA${d.periodeMA}_${tglFile}.csv</b> berhasil diunduh.<br><small style="color:#7f8c8d;">Data prediksi juga tersimpan otomatis di <a href="dokumen.html" style="color:#667eea;">Pusat Dokumen</a>.</small>`,
        timer: 3500,
        confirmButtonText: 'OK',
        confirmButtonColor: '#27ae60'
    });
};


