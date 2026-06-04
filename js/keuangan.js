/* ==========================================================================
   SISTEM ADMINISTRASI PETERNAKAN (LIBAS)
   File        : keuangan.js
   Deskripsi   : Mengelola logika frontend halaman Manajemen Keuangan,
                 termasuk integrasi data produksi, pencatatan transaksi manual/produksi,
                 penyaringan riwayat transaksi per batch (relasional + teks),
                 serta pemutakhiran statistik nominal kas secara dinamis.
   ========================================================================== */

import { 
    collection, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    doc, 
    getDocs, 
    query, 
    orderBy 
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { db } from "../firebase.component/firebase-init.js";

// ==========================================
// 📌 GLOBAL STATE
// ==========================================
let dataKeuangan = [];
let dataAyam = [];
let dataProduksi = [];
let weeklyGroupedProduction = {}; // Memetakan batchId -> minggu -> data produksi mingguan

const keuanganCollection = collection(db, "keuangan");

// ==========================================
// 📌 1. UTILITAS & FORMATTER
// ==========================================
const formatIDR = window.formatRupiah || function(angka) { 
    return 'Rp ' + (angka || 0).toLocaleString('id-ID'); 
};

/**
 * Mengontrol tampilan loading (spinner/skeleton)
 * @param {string} target - Lokasi loading ('form' atau 'table')
 * @param {boolean} isLoading - State loading aktif/tidak
 */
function toggleLoading(target, isLoading) {
    if (target === 'form') {
        const btn = document.getElementById('btnSubmit');
        if (btn) {
            btn.classList.toggle('loading', isLoading);
            btn.disabled = isLoading;
        }
    } else if (target === 'table') {
        const loader = document.getElementById('tableLoading');
        const table = document.getElementById('financeTable');
        const empty = document.getElementById('emptyState');
        
        if (loader) loader.style.display = isLoading ? 'block' : 'none';
        if (table) table.style.opacity = isLoading ? '0.3' : '1';
        if (empty && isLoading) empty.style.display = 'none';
    }
}

// ==========================================
// 📌 2. INISIALISASI & FIREBASE LISTENER
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    // 1. Jalankan Fetch Data Firebase
    loadKeuanganData();
    loadProductionRelatedData();

    // 2. Pasang Event Listeners
    setupEventListeners();

    // 3. Set Default Date (Hari Ini)
    const today = window.getLocalDateString();
    const dateInput = document.getElementById('trxDate');
    if (dateInput) dateInput.value = today;
});

/**
 * Memuat seluruh data keuangan dari Firestore
 */
async function loadKeuanganData() {
    toggleLoading('table', true);
    try {
        const q = query(keuanganCollection, orderBy("tanggal", "desc"));
        const snapshot = await getDocs(q);
        
        dataKeuangan = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        toggleLoading('table', false);
        renderTable();
        updateSummary();
    } catch (err) {
        toggleLoading('table', false);
        console.error("Firebase Error:", err);
        Swal.fire("Error", "Gagal mengambil data dari server.", "error");
    }
}

/**
 * Memuat data pendukung Batch Ayam dan Produksi Harian
 */
async function loadProductionRelatedData() {
    try {
        // Fetch populasi_ayam
        const ayamSnapshot = await getDocs(collection(db, "populasi_ayam"));
        dataAyam = ayamSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Fetch produksi_harian
        const prodSnapshot = await getDocs(collection(db, "produksi_harian"));
        dataProduksi = prodSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Kalkulasi minggu produksi per batch
        precomputeProductionWeeks();
        
        // Isi pilihan dropdown batch (form + filter)
        populateBatchDropdowns();
        
        // Render ulang tabel agar sub-badge mendapatkan nama ayam setelah data ayam berhasil dimuat
        renderTable();
    } catch (err) {
        console.error("Gagal memuat data pendukung produksi: ", err);
    }
}

/**
 * Mengelompokkan data produksi harian menjadi minggu produksi (7 hari per minggu per batch)
 */
function precomputeProductionWeeks() {
    weeklyGroupedProduction = {};

    const batchGroups = {};
    dataProduksi.forEach(prod => {
        if (!batchGroups[prod.batchId]) batchGroups[prod.batchId] = [];
        batchGroups[prod.batchId].push(prod);
    });

    Object.keys(batchGroups).forEach(batchId => {
        // Urutkan kronologis agar urutan minggu tepat
        batchGroups[batchId].sort((a, b) => a.tanggal.localeCompare(b.tanggal));
        
        weeklyGroupedProduction[batchId] = {};
        
        batchGroups[batchId].forEach((prod, index) => {
            const minggu = prod.mingguKe ? parseInt(prod.mingguKe) : Math.floor(index / 7) + 1;
            prod.minggu = minggu;

            if (!weeklyGroupedProduction[batchId][minggu]) {
                weeklyGroupedProduction[batchId][minggu] = {
                    minggu: minggu,
                    tanggalAwal: prod.tanggal,
                    tanggalAkhir: prod.tanggal,
                    telurBaik: 0,
                    telurCacat: 0,
                    totalTelur: 0
                };
            }

            const wGroup = weeklyGroupedProduction[batchId][minggu];
            wGroup.telurBaik += (prod.telurBaik || 0);
            wGroup.telurCacat += (prod.telurCacat || 0);
            wGroup.totalTelur += (prod.totalTelur || 0);

            // Perbarui rentang tanggal
            if (prod.tanggal < wGroup.tanggalAwal) wGroup.tanggalAwal = prod.tanggal;
            if (prod.tanggal > wGroup.tanggalAkhir) wGroup.tanggalAkhir = prod.tanggal;
        });
    });
}

/**
 * Mempopulasikan pilihan Batch ke Dropdown Form (Hanya Aktif) dan Dropdown Filter (Semua Batch)
 */
function populateBatchDropdowns() {
    const batchSelect = document.getElementById('trxBatch');
    const filterBatchSelect = document.getElementById('filterBatch');

    // 1. Dropdown Form (Target Batch untuk pencatatan transaksi baru)
    if (batchSelect) {
        batchSelect.innerHTML = '<option value="" selected>— Pilih Batch Target (Opsional) —</option>';
        const activeBatches = dataAyam.filter(a => a.status === 'Aktif');
        
        activeBatches.forEach(ayam => {
            const opt = document.createElement('option');
            opt.value = ayam.id;
            const customId = ayam.customId || ayam.id.substring(0, 5);
            opt.textContent = `${customId} - ${ayam.jenis} [${ayam.kandang}]`;
            batchSelect.appendChild(opt);
        });
    }

    // 2. Dropdown Filter (Menampilkan semua batch untuk keperluan audit historis)
    if (filterBatchSelect) {
        filterBatchSelect.innerHTML = '<option value="" selected>🔄 Semua Batch</option>';
        dataAyam.forEach(ayam => {
            const opt = document.createElement('option');
            opt.value = ayam.id;
            const customId = ayam.customId || ayam.id.substring(0, 5);
            opt.textContent = `${customId} - ${ayam.jenis}`;
            filterBatchSelect.appendChild(opt);
        });
    }
}

/**
 * Memuat daftar minggu produksi ketika Batch dipilih pada form
 */
window.loadBatchWeeks = function() {
    const batchSelect = document.getElementById('trxBatch');
    const weekSelect = document.getElementById('trxWeek');
    if (!batchSelect || !weekSelect) return;

    const batchId = batchSelect.value;
    weekSelect.innerHTML = '<option value="" disabled selected>Pilih Minggu...</option>';
    
    const weeks = weeklyGroupedProduction[batchId];
    if (!weeks || Object.keys(weeks).length === 0) {
        weekSelect.innerHTML = '<option value="" disabled selected>— tidak ada data produksi —</option>';
        weekSelect.disabled = true;
        document.getElementById('weeklyProductionSummary').style.display = 'none';
        return;
    }

    weekSelect.disabled = false;
    
    Object.keys(weeks).sort((a, b) => parseInt(a) - parseInt(b)).forEach(minggu => {
        const wGroup = weeks[minggu];
        const opt = document.createElement('option');
        opt.value = minggu;
        
        const dateAwalIndo = window.formatTanggal(wGroup.tanggalAwal);
        const dateAkhirIndo = window.formatTanggal(wGroup.tanggalAkhir);
        opt.textContent = `Minggu ke-${minggu} (${dateAwalIndo} s/d ${dateAkhirIndo})`;
        weekSelect.appendChild(opt);
    });
    
    document.getElementById('weeklyProductionSummary').style.display = 'none';
};

/**
 * Menampilkan ringkasan hasil produksi mingguan dari batch & minggu terpilih
 */
window.showWeekProductionSummary = function() {
    const batchSelect = document.getElementById('trxBatch');
    const weekSelect = document.getElementById('trxWeek');
    const summaryCard = document.getElementById('weeklyProductionSummary');
    if (!batchSelect || !weekSelect || !summaryCard) return;

    const batchId = batchSelect.value;
    const minggu = weekSelect.value;
    
    const wGroup = weeklyGroupedProduction[batchId]?.[minggu];
    if (!wGroup) {
        summaryCard.style.display = 'none';
        return;
    }

    const dateAwalIndo = window.formatTanggal(wGroup.tanggalAwal);
    const dateAkhirIndo = window.formatTanggal(wGroup.tanggalAkhir);
    document.getElementById('summaryPeriode').innerText = `${dateAwalIndo} s/d ${dateAkhirIndo}`;
    document.getElementById('summaryBaik').innerText = `${wGroup.telurBaik.toLocaleString('id-ID')} Butir`;
    document.getElementById('summaryCacat').innerText = `${wGroup.telurCacat.toLocaleString('id-ID')} Butir`;
    document.getElementById('summaryTotal').innerText = `${wGroup.totalTelur.toLocaleString('id-ID')} Butir`;
    
    summaryCard.style.display = 'block';

    const batchOptionText = batchSelect.options[batchSelect.selectedIndex].text;
    const batchLabel = batchOptionText.split(' - ')[0];
    
    let jenisTelurDesc = '';
    if (batchId && dataAyam) {
        const ayam = dataAyam.find(a => a.id === batchId);
        if (ayam && ayam.jenis) {
            jenisTelurDesc = ` Jenis ${ayam.jenis.charAt(0).toUpperCase() + ayam.jenis.slice(1)}`;
        }
    }

    const descInput = document.getElementById('trxDesc');
    if (descInput) {
        descInput.value = `Hasil Jual Telur ${batchLabel}${jenisTelurDesc} - Minggu ke-${minggu}`;
    }

    window.calculateEggSalesAmount();
};

/**
 * Mengkalkulasi otomatis nominal penjualan telur
 */
window.calculateEggSalesAmount = function() {
    const batchSelect = document.getElementById('trxBatch');
    const weekSelect = document.getElementById('trxWeek');
    const priceInput = document.getElementById('eggPrice');
    const amountInput = document.getElementById('trxAmount');
    if (!batchSelect || !weekSelect || !priceInput || !amountInput) return;

    const batchId = batchSelect.value;
    const minggu = weekSelect.value;
    const wGroup = weeklyGroupedProduction[batchId]?.[minggu];
    if (!wGroup) return;

    const rawPrice = priceInput.value;
    const cleanPrice = rawPrice.replace(/\./g, '').replace(/,/g, '.');
    const price = parseFloat(cleanPrice) || 0;

    // Kalkulasi per papan: (Total Telur Baik / 30 dibulatkan ke papan terdekat) * Harga per Papan
    const salesAmount = Math.round(wGroup.telurBaik / 30) * price;
    amountInput.value = Math.round(salesAmount).toLocaleString('id-ID');
};

/**
 * Mengkalkulasi otomatis Harga Jual per Papan dari Jumlah Uang (Reverse Calculation)
 */
window.calculateEggPriceFromAmount = function() {
    const sourceEl = document.getElementById('trxSource');
    if (sourceEl && sourceEl.value !== 'produksi') return;

    const batchSelect = document.getElementById('trxBatch');
    const weekSelect = document.getElementById('trxWeek');
    const priceInput = document.getElementById('eggPrice');
    const amountInput = document.getElementById('trxAmount');
    if (!batchSelect || !weekSelect || !priceInput || !amountInput) return;

    const batchId = batchSelect.value;
    const minggu = weekSelect.value;
    const wGroup = weeklyGroupedProduction[batchId]?.[minggu];
    if (!wGroup) return;

    const rawAmount = amountInput.value;
    const cleanAmount = rawAmount.replace(/\./g, '').replace(/,/g, '.');
    const amount = parseFloat(cleanAmount) || 0;

    const papan = Math.round(wGroup.telurBaik / 30);
    if (papan > 0) {
        const price = amount / papan;
        priceInput.value = Math.round(price).toLocaleString('id-ID');
    } else {
        priceInput.value = "0";
    }
};

/**
 * Mengubah setelan input form berdasarkan tipe inputan (Manual/Umum vs Hasil Produksi)
 * @param {string} source - Tipe sumber ('manual' atau 'produksi')
 */
window.switchTrxSource = function(source) {
    const sourceEl = document.getElementById('trxSource');
    if (!sourceEl) return;

    sourceEl.value = source;

    const btnManual = document.getElementById('btnSourceManual');
    const btnProduksi = document.getElementById('btnSourceProduksi');
    const prodFields = document.getElementById('produksiSourceFields');
    
    const typePemasukan = document.getElementById('typePemasukan');
    const typePengeluaran = document.getElementById('typePengeluaran');
    const trxDesc = document.getElementById('trxDesc');
    const trxAmount = document.getElementById('trxAmount');

    const lblTrxBatch = document.getElementById('lblTrxBatch');
    const trxBatch = document.getElementById('trxBatch');

    if (source === 'manual') {
        if (btnManual) btnManual.classList.add('active');
        if (btnProduksi) btnProduksi.classList.remove('active');
        if (prodFields) prodFields.style.display = 'none';

        if (typePemasukan) typePemasukan.disabled = false;
        if (typePengeluaran) typePengeluaran.disabled = false;
        
        // Target Batch pada Manual: bersifat opsional
        if (lblTrxBatch) lblTrxBatch.innerHTML = 'Target Batch Ayam <small style="font-weight: normal; color: #64748b;">(Opsional)</small>';
        if (trxBatch) {
            trxBatch.required = false;
            if (trxBatch.options && trxBatch.options.length > 0) {
                trxBatch.options[0].text = '— Pilih Batch Target (Opsional) —';
                trxBatch.options[0].disabled = false;
            }
        }
        
        document.getElementById('trxWeek').required = false;
        document.getElementById('eggPrice').required = false;

        if (trxDesc) {
            trxDesc.value = '';
            trxDesc.readOnly = false;
        }
        if (trxAmount) {
            trxAmount.value = '';
            trxAmount.readOnly = false;
        }
    } else {
        if (btnManual) btnManual.classList.remove('active');
        if (btnProduksi) btnProduksi.classList.add('active');
        if (prodFields) prodFields.style.display = 'block';

        // Hasil produksi otomatis selalu berupa Pemasukan
        if (typePemasukan) {
            typePemasukan.checked = true;
            typePemasukan.disabled = false;
        }
        if (typePengeluaran) typePengeluaran.disabled = true;

        // Target Batch pada Produksi: bersifat wajib
        if (lblTrxBatch) lblTrxBatch.innerHTML = 'Batch Ayam <span style="color: #ef4444;">*</span>';
        if (trxBatch) {
            trxBatch.required = true;
            if (trxBatch.options && trxBatch.options.length > 0) {
                trxBatch.options[0].text = 'Pilih Batch Ayam...';
                trxBatch.options[0].disabled = true;
            }
        }
        
        document.getElementById('trxWeek').required = true;
        document.getElementById('eggPrice').required = true;

        if (trxDesc) trxDesc.readOnly = false;
        if (trxAmount) trxAmount.readOnly = false; // Nominal dibuka agar bisa dikalkulasi bolak-balik
    }
};

/**
 * Memasang seluruh event listener pada elemen-elemen antarmuka
 */
function setupEventListeners() {
    // Form Submit
    const financeForm = document.getElementById('financeForm');
    if (financeForm) {
        financeForm.addEventListener('submit', handleFormSubmit);
    }

    // Filter & Search
    ['searchTrx', 'filterStartDate'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', () => renderTable());
        }
    });

    const filterBatchEl = document.getElementById('filterBatch');
    if (filterBatchEl) {
        filterBatchEl.addEventListener('change', () => renderTable());
    }

    const viewModeEl = document.getElementById('viewMode');
    if (viewModeEl) {
        viewModeEl.addEventListener('change', () => renderTable());
    }

    // Export Laporan CSV
    const btnExport = document.getElementById('btnExport');
    if (btnExport) {
        btnExport.addEventListener('click', downloadLaporanCSV);
    }

    // Sidebar Hamburger Menu (Tampilan Mobile)
    const sidebarToggle = document.getElementById('sidebarToggle');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            document.querySelector('.sidebar').classList.toggle('active');
        });
    }

    // Event Delegation untuk Aksi Hapus Baris
    const tableBody = document.getElementById('financeTableBody');
    if (tableBody) {
        tableBody.addEventListener('click', (e) => {
            const btnDelete = e.target.closest('.btn-delete');
            if (btnDelete) {
                const id = btnDelete.dataset.id;
                deleteTransaction(id);
            }
        });
    }
}

// ==========================================
// 📌 3. LOGIKA CRUD (TAMBAH & HAPUS)
// ==========================================

/**
 * Menyimpan data transaksi baru ke Firebase Firestore
 */
async function handleFormSubmit(event) {
    event.preventDefault();
    toggleLoading('form', true);

    const tanggal = document.getElementById('trxDate').value;
    const tipe = document.querySelector('input[name="trxType"]:checked').value;
    const deskripsi = document.getElementById('trxDesc').value;
    
    const rawJumlah = document.getElementById('trxAmount').value;
    const cleanJumlah = rawJumlah.replace(/\./g, '').replace(/,/g, '.');
    const jumlah = parseFloat(cleanJumlah) || 0;

    const trxSource = document.getElementById('trxSource').value;

    const payload = {
        tanggal,
        tipe,
        deskripsi,
        jumlah,
        createdAt: new Date().toISOString()
    };

    // Tambahkan metadata relasional jika dicatat dari hasil produksi
    if (trxSource === 'produksi') {
        const batchEl = document.getElementById('trxBatch');
        const weekEl = document.getElementById('trxWeek');
        const priceInput = document.getElementById('eggPrice');

        const batchId = batchEl.value;
        const minggu = parseInt(weekEl.value) || 1;
        const wGroup = weeklyGroupedProduction[batchId]?.[minggu];

        payload.source = 'produksi';
        payload.batchId = batchId;
        payload.batchLabel = batchEl.options[batchEl.selectedIndex].text;
        payload.minggu = minggu;
        payload.telurBaik = wGroup ? wGroup.telurBaik : 0;
        payload.telurCacat = wGroup ? wGroup.telurCacat : 0;
        payload.totalTelur = wGroup ? wGroup.totalTelur : 0;
        payload.hargaPerPapan = parseFloat(priceInput.value.replace(/\./g, '').replace(/,/g, '.')) || 0;
    } else {
        // Hubungkan ke batch secara opsional pada transaksi manual/umum
        const batchEl = document.getElementById('trxBatch');
        if (batchEl && batchEl.value) {
            payload.batchId = batchEl.value;
            payload.batchLabel = batchEl.options[batchEl.selectedIndex].text;
        }
    }

    try {
        await addDoc(keuanganCollection, payload);
        Swal.fire({
            icon: 'success',
            title: 'Berhasil',
            text: 'Transaksi berhasil dicatat.',
            timer: 1500,
            showConfirmButton: false
        });
        
        document.getElementById('financeForm').reset();
        document.getElementById('trxDate').value = window.getLocalDateString();
        
        // Reset toggle ke manual
        switchTrxSource('manual');
        
        // Refresh data setelah penambahan
        loadKeuanganData();
    } catch (err) {
        Swal.fire("Error", "Gagal menyimpan: " + err.message, "error");
    } finally {
        toggleLoading('form', false);
    }
}

/**
 * Menghapus data transaksi berdasarkan ID
 * @param {string} id - ID dokumen transaksi
 */
async function deleteTransaction(id) {
    const result = await Swal.fire({
        title: 'Hapus Transaksi?',
        text: "Data akan dihapus permanen.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Ya, Hapus'
    });

    if (result.isConfirmed) {
        try {
            await deleteDoc(doc(db, "keuangan", id));
            Swal.fire('Terhapus!', 'Transaksi telah dihapus.', 'success');
            
            // Refresh data setelah penghapusan
            loadKeuanganData();
        } catch (err) {
            Swal.fire("Error", "Gagal menghapus: " + err.message, "error");
        }
    }
}

// ==========================================
// 📌 4. DISPLAY & FILTER TABEL
// ==========================================

/**
 * Merender satu baris data transaksi ke dalam tbody tabel
 * @param {Object} t - Objek data transaksi
 * @param {HTMLElement} tbody - Kontainer tabel
 */
function renderRow(t, tbody) {
    const tr = document.createElement('tr');
    const isIncome = t.tipe === "pemasukan";
    const badgeClass = isIncome ? 'badge-income' : 'badge-expense';
    const textClass = isIncome ? 'text-income' : 'text-expense';
    const typeLabel = t.tipe.charAt(0).toUpperCase() + t.tipe.slice(1);
    
    // Tampilkan sub-badge ketertelusuran batch yang menawan
    let subBadgeHtml = '';
    if (t.batchLabel) {
        const batchName = t.batchLabel.split(' - ')[0];
        
        let jenisTelur = '';
        let targetAyam = null;

        if (t.batchId) {
            targetAyam = dataAyam.find(a => a.id === t.batchId);
        }
        
        // Fallback cerdas untuk data lama tanpa batchId
        if (!targetAyam && dataAyam.length > 0) {
            targetAyam = dataAyam.find(a => {
                const cId = a.customId || a.id.substring(0, 5);
                return cId === batchName || batchName.includes(cId);
            });
        }

        if (targetAyam && targetAyam.jenis) {
            jenisTelur = ` — Telur Jenis ${targetAyam.jenis.charAt(0).toUpperCase() + targetAyam.jenis.slice(1)}`;
        }

        if (t.source === 'produksi') {
            subBadgeHtml = `
                <div class="sub-badge-produksi" title="Produksi: ${t.telurBaik.toLocaleString('id-ID')} butir baik, ${t.telurCacat.toLocaleString('id-ID')} butir cacat">
                    🐔 ${batchName} — Minggu ke-${t.minggu}${jenisTelur}
                </div>
            `;
        } else {
            subBadgeHtml = `
                <div class="sub-badge-manual" title="Dihubungkan ke: ${t.batchLabel}">
                    📦 ${batchName} (Umum)${jenisTelur}
                </div>
            `;
        }
    }

    tr.innerHTML = `
        <td>${formatTanggal(t.tanggal)}</td>
        <td><span class="badge-type ${badgeClass}">${typeLabel}</span></td>
        <td>
            <div class="desc-container">
                <span style="font-weight: 600; color: #1e293b;">${escapeHTML(t.deskripsi)}</span>
                ${subBadgeHtml}
            </div>
        </td>
        <td class="text-right ${textClass}" style="font-weight: 700;">${formatIDR(t.jumlah)}</td>
        <td class="text-center">
            <button class="btn-delete" data-id="${t.id}" title="Hapus">🗑️</button>
        </td>
    `;
    tbody.appendChild(tr);
}

/**
 * Menyaring dan merender tabel riwayat transaksi berdasarkan masukan pencarian dan filter
 */
function renderTable() {
    const tbody = document.getElementById('financeTableBody');
    const emptyState = document.getElementById('emptyState');
    if (!tbody) return;

    // Ambil nilai filter saat ini
    const searchTerm = document.getElementById('searchTrx').value.toLowerCase();
    const startDate = document.getElementById('filterStartDate').value;
    const filterBatchEl = document.getElementById('filterBatch');
    const filterBatchId = filterBatchEl ? filterBatchEl.value : '';
    const viewModeEl = document.getElementById('viewMode');
    const viewMode = viewModeEl ? viewModeEl.value : 'riwayat-keseluruhan';
    
    tbody.innerHTML = "";

    // Logika Filtering (Pencarian Teks, Tanggal, & Batch)
    const filtered = dataKeuangan.filter(t => {
        const matchesSearch = t.deskripsi.toLowerCase().includes(searchTerm);
        const matchesDate = !startDate || t.tanggal === startDate;
        
        let matchesBatch = !filterBatchId || t.batchId === filterBatchId;
        
        // Fallback cerdas untuk data manual lama: deteksi string ID Batch di dalam keterangan
        if (!matchesBatch && filterBatchId && !t.batchId) {
            const targetBatch = dataAyam.find(a => a.id === filterBatchId);
            if (targetBatch) {
                const customId = (targetBatch.customId || '').toLowerCase();
                const desc = t.deskripsi.toLowerCase();
                if (customId && desc.includes(customId)) {
                    matchesBatch = true;
                }
            }
        }
        return matchesSearch && matchesDate && matchesBatch;
    });

    // Update Ringkasan Saldo Kas secara dinamis berdasarkan data terfilter
    updateSummary(filtered);

    // Render berdasarkan mode pengelompokan tampilan
    if (viewMode === 'tipe') {
        // Tipe view: Selalu sembunyikan emptyState global agar kita bisa menggambar layout Pemasukan dan Pengeluaran
        if (emptyState) emptyState.style.display = 'none';

        const pemasukanList = filtered.filter(t => t.tipe === 'pemasukan');
        const pengeluaranList = filtered.filter(t => t.tipe === 'pengeluaran');

        // 1. Kelompok Pemasukan
        const subtotalPemasukan = pemasukanList.reduce((sum, t) => sum + t.jumlah, 0);
        const groupHeaderInc = document.createElement('tr');
        groupHeaderInc.className = 'group-header-row group-header-income';
        groupHeaderInc.innerHTML = `
            <td colspan="5" style="text-align: left;">
                🟢 Pemasukan (${pemasukanList.length} Transaksi) &nbsp;•&nbsp; Subtotal: ${formatIDR(subtotalPemasukan)}
            </td>
        `;
        tbody.appendChild(groupHeaderInc);

        if (pemasukanList.length > 0) {
            pemasukanList.forEach(t => renderRow(t, tbody));
        } else {
            const emptyRow = document.createElement('tr');
            emptyRow.innerHTML = `
                <td colspan="5" style="color: #94a3b8; font-style: italic; text-align: center; padding: 15px; background-color: #fff;">
                    — Belum ada data transaksi pemasukan —
                </td>
            `;
            tbody.appendChild(emptyRow);
        }

        // 2. Kelompok Pengeluaran (Selalu tampil bahkan jika bernominal Rp 0 demi kejelasan visual)
        const subtotalPengeluaran = pengeluaranList.reduce((sum, t) => sum + t.jumlah, 0);
        const groupHeaderExp = document.createElement('tr');
        groupHeaderExp.className = 'group-header-row group-header-expense';
        groupHeaderExp.innerHTML = `
            <td colspan="5" style="text-align: left;">
                🔴 Pengeluaran (${pengeluaranList.length} Transaksi) &nbsp;•&nbsp; Subtotal: ${formatIDR(subtotalPengeluaran)}
            </td>
        `;
        tbody.appendChild(groupHeaderExp);

        if (pengeluaranList.length > 0) {
            pengeluaranList.forEach(t => renderRow(t, tbody));
        } else {
            const emptyRow = document.createElement('tr');
            emptyRow.innerHTML = `
                <td colspan="5" style="color: #94a3b8; font-style: italic; text-align: center; padding: 15px; background-color: #fff;">
                    — Belum ada data transaksi pengeluaran —
                </td>
            `;
            tbody.appendChild(emptyRow);
        }
    } else {
        // Tampilan Kronologis (Flat List standard)
        if (filtered.length === 0) {
            if (emptyState) emptyState.style.display = 'flex';
        } else {
            if (emptyState) emptyState.style.display = 'none';
            filtered.forEach(t => renderRow(t, tbody));
        }
    }
}

/**
 * Menghitung dan memperbarui widget box nominal saldo kas keuangan (Pemasukan, Pengeluaran, Saldo Bersih)
 * @param {Array} filteredList - Array data transaksi terfilter
 */
function updateSummary(filteredList = dataKeuangan) {
    let income = 0;
    let expense = 0;

    filteredList.forEach(t => {
        if (t.tipe === "pemasukan") income += t.jumlah;
        else expense += t.jumlah;
    });

    const incomeEl = document.getElementById('totalPemasukan');
    const expenseEl = document.getElementById('totalPengeluaran');
    const balanceEl = document.getElementById('totalSaldo');

    if (incomeEl) incomeEl.innerText = formatIDR(income);
    if (expenseEl) expenseEl.innerText = formatIDR(expense);
    if (balanceEl) balanceEl.innerText = formatIDR(income - expense);
}

/**
 * Mengunduh laporan keuangan berformat CSV dari state data saat ini
 */
function downloadLaporanCSV() {
    if (dataKeuangan.length === 0) {
        Swal.fire("Info", "Tidak ada data untuk diekspor.", "info");
        return;
    }

    let csv = "Tanggal,Jenis,Deskripsi,Jumlah (Rp)\n";
    dataKeuangan.forEach(t => {
        csv += `${t.tanggal},${t.tipe},"${t.deskripsi.replace(/"/g, '""')}",${t.jumlah}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Laporan_Keuangan_LIBAS_${window.getLocalDateString()}.csv`;
    a.click();
}
