/* =========================================================
   🐔 KODE SUMBER: INPUT PRODUKSI HARIAN (FIRESTORE)
   File: inputproduksi.js
   Deskripsi: Mengelola logika halaman Input Produksi harian,
   menggunakan Google Firebase Firestore.
========================================================= */

import { 
    collection, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    doc, 
    onSnapshot, 
    query, 
    orderBy 
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { db } from "../firebase.component/firebase-init.js";

// State Global
let dataProduksi = [];
let dataAyam = [];
let collapsedBatches = new Set(); 

const produksiCollection = collection(db, "produksi_harian");
const ayamCollection = collection(db, "populasi_ayam");

// =========================================
// 1. UTILITAS & FORMATTING
// =========================================
function formatTanggal(tglString) {
    if (!tglString) return "-";
    const options = { day: 'numeric', month: 'short', year: 'numeric' };
    return new Date(tglString).toLocaleDateString('id-ID', options);
}

// =========================================
// 2. INISIALISASI & REAL-TIME LISTENERS
// =========================================
document.addEventListener("DOMContentLoaded", () => {
    // Listener Produksi
    const q = query(produksiCollection, orderBy("tanggal", "desc"));
    onSnapshot(q, (snapshot) => {
        dataProduksi = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderTable();
        updateQuickStats();
    });

    // Listener Data Ayam (Batch)
    onSnapshot(ayamCollection, (snapshot) => {
        dataAyam = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Jika modal sedang terbuka, refresh opsi
        if (document.getElementById('produksiModal').classList.contains('show')) {
            const currentSelected = document.getElementById('batchProduksi').value;
            loadBatchOptions(currentSelected);
        }
    });
});

// =========================================
// 3. UI INTERACTIONS (DROPDOWNS & AUTOFILL)
// =========================================
/**
 * Memuat daftar pilihan (options) Batch Ayam yang sedang 'Aktif' ke dalam dropdown modal
 * @param {string} selectedId - ID Batch yang ingin dipilih secara otomatis (saat mode Edit)
 */
function loadBatchOptions(selectedId = '') {
    const selectEl = document.getElementById('batchProduksi');
    if (!selectEl) return;

    selectEl.innerHTML = '<option value="" disabled selected>Pilih Batch Ayam...</option>';
    const dataAktif = dataAyam.filter(a => a.status === 'Aktif');

    if (dataAktif.length === 0) {
        const opt = document.createElement('option');
        opt.disabled = true;
        opt.textContent = '-- Belum ada batch aktif --';
        selectEl.appendChild(opt);
    } else {
        dataAktif.forEach(ayam => {
            const opt = document.createElement('option');
            opt.value = ayam.id;
            const customId = ayam.customId || ayam.id.substring(0, 5);
            opt.textContent = `${customId} - ${ayam.jenis} [${ayam.kandang}]`;
            opt.dataset.kandang = ayam.kandang;
            if (ayam.id === selectedId) opt.selected = true;
            selectEl.appendChild(opt);
        });
    }
}

window.autoFillFromBatch = function() {
    const selectEl = document.getElementById('batchProduksi');
    if (!selectEl || !selectEl.value) return;

    const selectedBatchId = selectEl.value;
    const batchData = dataAyam.find(a => a.id === selectedBatchId);

    const tglEl = document.getElementById('tglProduksi');
    const kandangEl = document.getElementById('kandangProduksi');
    const jenisEl = document.getElementById('jenisTelurProduksi');

    if (batchData) {
        if (tglEl) tglEl.value = batchData.tglMasuk || '';
        if (kandangEl) kandangEl.value = batchData.kandang || '';
        if (jenisEl) jenisEl.value = batchData.jenis || '';
        lockBatchFields();
    }
};

function lockBatchFields() {
    ['tglProduksi', 'kandangProduksi', 'jenisTelurProduksi'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.disabled = true; // For selects
            el.readOnly = true; // For inputs
            el.style.backgroundColor = '#e2e8f0';
        }
    });
    // Sync hidden kandang
    const kSelect = document.getElementById('kandangProduksi');
    const kHidden = document.getElementById('kandangProduksiHidden');
    if (kSelect && kHidden) kHidden.value = kSelect.value;
}

function unlockBatchFields() {
    ['tglProduksi', 'kandangProduksi', 'jenisTelurProduksi'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.disabled = true; // Still disabled until batch selected
            el.readOnly = true;
            el.value = '';
            el.style.backgroundColor = '#e2e8f0';
        }
    });
}

/**
 * Menghitung otomatis total telur berdasarkan jumlah telur baik dan cacat
 */
window.calculateTotal = function() {
    const baik = parseInt(document.getElementById('telurBaik').value) || 0;
    const cacat = parseInt(document.getElementById('telurCacat').value) || 0;
    document.getElementById('totalTelur').value = baik + cacat;
};

// =========================================
// 4. CRUD FIRESTORE
// =========================================
window.openProduksiModal = function() {
    const form = document.getElementById('produksiForm');
    const modal = document.getElementById('produksiModal');
    if (form) form.reset();
    document.getElementById('produksiId').value = "";
    loadBatchOptions();
    unlockBatchFields();
    document.getElementById('modalTitle').innerText = "Tambah Data Produksi";
    if (modal) modal.classList.add('show');
};

/**
 * Menutup jendela modal input produksi
 */
window.closeProduksiModal = function() {
    const modal = document.getElementById('produksiModal');
    if (modal) modal.classList.remove('show');
};

/**
 * Menyimpan data produksi harian ke Firestore (Mode Tambah/Edit)
 */
window.saveProduksiData = async function(event) {
    event.preventDefault();

    const idInput = document.getElementById('produksiId').value;
    const batchEl = document.getElementById('batchProduksi');
    
    // Memberntuk objek data produksi
    const tanggalValue = document.getElementById('tglProduksi').value;
    console.log('🔍 DEBUG Input Produksi - Tanggal yang akan disimpan:', tanggalValue);
    
    const payload = {
        tanggal: tanggalValue, 
        batchId: batchEl.value,
        batchLabel: batchEl.options[batchEl.selectedIndex].text,
        jenisTelur: document.getElementById('jenisTelurProduksi').value,
        kandang: document.getElementById('kandangProduksiHidden').value || document.getElementById('kandangProduksi').value,
        telurBaik: parseInt(document.getElementById('telurBaik').value) || 0,
        telurCacat: parseInt(document.getElementById('telurCacat').value) || 0,
        totalTelur: parseInt(document.getElementById('totalTelur').value) || 0,
        ayamTidakBertelur: parseInt(document.getElementById('ayamTidakBertelur').value) || 0,
        updatedAt: new Date().toISOString()
    };
    
    console.log('🔍 DEBUG Input Produksi - Payload lengkap:', payload);

    try {
        if (idInput === "") {
            // Mode Tambah Baru
            payload.createdAt = new Date().toISOString();
            await addDoc(produksiCollection, payload);
            Swal.fire({ icon: 'success', title: 'Berhasil!', text: 'Data produksi ditambahkan.', timer: 2000, showConfirmButton: false });
        } else {
            // Mode Update Data
            await updateDoc(doc(db, "produksi_harian", idInput), payload);
            Swal.fire({ icon: 'success', title: 'Berhasil!', text: 'Data produksi diperbarui.', timer: 2000, showConfirmButton: false });
        }
        window.closeProduksiModal();
    } catch (err) {
        Swal.fire("Error", err.message, "error");
    }
};

window.editProduksi = function(id) {
    const prod = dataProduksi.find(p => p.id === id);
    if (prod) {
        loadBatchOptions(prod.batchId);
        document.getElementById('produksiId').value = prod.id;
        document.getElementById('tglProduksi').value = prod.tanggal;
        document.getElementById('telurBaik').value = prod.telurBaik;
        document.getElementById('telurCacat').value = prod.telurCacat;
        document.getElementById('totalTelur').value = prod.totalTelur;
        document.getElementById('ayamTidakBertelur').value = prod.ayamTidakBertelur || 0;
        document.getElementById('jenisTelurProduksi').value = prod.jenisTelur;
        document.getElementById('kandangProduksi').value = prod.kandang;
        document.getElementById('kandangProduksiHidden').value = prod.kandang;
        
        lockBatchFields();
        document.getElementById('modalTitle').innerText = "Edit Produksi";
        document.getElementById('produksiModal').classList.add('show');
    }
};

window.deleteProduksi = function(id) {
    Swal.fire({
        title: 'Hapus Data?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ff6b6b',
        confirmButtonText: 'Ya, Hapus!'
    }).then(async (result) => {
        if (result.isConfirmed) {
            await deleteDoc(doc(db, "produksi_harian", id));
            Swal.fire('Terhapus!', 'Data telah dihapus.', 'success');
        }
    });
};

// =========================================
// 5. TABLE & STATS
// =========================================
window.toggleBatchGroup = function(batchId) {
    if (collapsedBatches.has(batchId)) {
        collapsedBatches.delete(batchId);
    } else {
        collapsedBatches.add(batchId);
    }
    renderTable(); // Render ulang untuk memperbarui icon dan visibilitas
};

function renderTable() {
    const tbody = document.getElementById("produksiTableBody");
    const emptyState = document.getElementById("emptyState");
    const tableEl = document.getElementById("produksiTable");
    const filterTgl = document.getElementById('filterTanggal').value;

    if (!tbody) return;
    tbody.innerHTML = "";

    // Memfilter data berdasarkan tanggal jika ada filter yang aktif
    let filteredData = dataProduksi.filter(prod => !filterTgl || prod.tanggal === filterTgl);

    // MENGELOMPOKKAN DATA: Urutkan berdasarkan batchId terlebih dahulu, kemudian tanggal terbaru
    filteredData.sort((a, b) => {
        // Urutkan berdasarkan Batch ID (agar berkelompok)
        if (a.batchId < b.batchId) return -1;
        if (a.batchId > b.batchId) return 1;
        // Jika batch sama, urutkan berdasarkan tanggal terbaru (descending)
        return b.tanggal.localeCompare(a.tanggal);
    });

    if (filteredData.length === 0) {
        tableEl.style.display = "none";
        emptyState.style.display = "block";
    } else {
        tableEl.style.display = "table";
        emptyState.style.display = "none";

        let currentBatch = null;

        filteredData.forEach((prod) => {
            const isCollapsed = collapsedBatches.has(prod.batchId);

            // SISIPKAN HEADER GRUP (Klik untuk Buka/Tutup)
            if (prod.batchId !== currentBatch) {
                currentBatch = prod.batchId;
                const headerRow = document.createElement("tr");
                headerRow.className = `batch-group-header ${isCollapsed ? 'collapsed' : ''}`;
                headerRow.onclick = () => toggleBatchGroup(prod.batchId);
                headerRow.innerHTML = `
                    <td colspan="9">
                        <span class="toggle-icon">${isCollapsed ? '▶' : '▼'}</span>
                        <span style="font-weight: 700; letter-spacing: 0.5px;">${prod.batchLabel.split(' - ')[0]}</span>
                        <span class="header-hint">${isCollapsed ? 'Buka Detail' : 'Tutup Detail'}</span>
                    </td>
                `;
                tbody.appendChild(headerRow);
            }

            // Jika batch sedang ditutup, jangan tampilkan baris datanya
            if (isCollapsed) return;

            const row = document.createElement("tr");
            row.className = "data-row";
            row.innerHTML = `
                <td>${formatTanggal(prod.tanggal)}</td>
                <td><span class="badge" style="background:#6366f1;color:white;">${prod.batchLabel.split(' - ')[0]}</span></td>
                <td><span class="badge" style="background:#f59e0b;color:white;">${prod.jenisTelur}</span></td>
                <td><strong>${prod.kandang}</strong></td>
                <td><span class="badge" style="background:#10b981;color:white;">${prod.telurBaik.toLocaleString('id-ID')}</span></td>
                <td><span class="badge" style="background:#ef4444;color:white;">${prod.telurCacat.toLocaleString('id-ID')}</span></td>
                <td><strong>${prod.totalTelur.toLocaleString('id-ID')}</strong></td>
                <td><span class="badge" style="background:#8b5cf6;color:white;">${(prod.ayamTidakBertelur || 0).toLocaleString('id-ID')} Ekor</span></td>
                <td>
                    <button class="btn-edit" onclick="editProduksi('${prod.id}')">✏️</button>
                    <button class="btn-delete" onclick="deleteProduksi('${prod.id}')">🗑️</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }
}

function updateQuickStats() {
    const filterTgl = document.getElementById('filterTanggal').value;
    let total = 0, baik = 0, cacat = 0;

    dataProduksi.forEach(prod => {
        if (!filterTgl || prod.tanggal === filterTgl) {
            total += prod.totalTelur;
            baik += prod.telurBaik;
            cacat += prod.telurCacat;
        }
    });

    // Update statistik ayam tidak bertelur
    let tidakBertelur = 0;
    dataProduksi.forEach(prod => {
        if (!filterTgl || prod.tanggal === filterTgl) {
            tidakBertelur += (prod.ayamTidakBertelur || 0);
        }
    });

    if(document.getElementById('totalTelurHariIni')) document.getElementById('totalTelurHariIni').innerText = total.toLocaleString('id-ID') + ' Butir';
    if(document.getElementById('totalTelurBaik')) document.getElementById('totalTelurBaik').innerText = baik.toLocaleString('id-ID') + ' Butir';
    if(document.getElementById('totalTelurCacat')) document.getElementById('totalTelurCacat').innerText = cacat.toLocaleString('id-ID') + ' Butir';
    if(document.getElementById('totalAyamTidakBertelur')) document.getElementById('totalAyamTidakBertelur').innerText = tidakBertelur.toLocaleString('id-ID') + ' Ekor';
}

window.filterTable = function() {
    renderTable();
    updateQuickStats();
};

window.resetFilter = function() {
    document.getElementById('filterTanggal').value = '';
    window.filterTable();
};

window.downloadLaporanCSV = function() {
    if (dataProduksi.length === 0) return;
    let csv = "ID,Tanggal,Batch,Jenis Telur,Kandang,Telur Baik,Telur Cacat,Total Telur,Ayam Tidak Bertelur\n";
    dataProduksi.forEach(p => {
        csv += `${p.id},${p.tanggal},${p.batchLabel},${p.jenisTelur},${p.kandang},${p.telurBaik},${p.telurCacat},${p.totalTelur},${p.ayamTidakBertelur || 0}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Laporan_Produksi_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
};

// Sidebar
window.toggleSidebarMenu = function(id) {
    const el = document.getElementById(id);
    const isHidden = el.getAttribute('aria-hidden') === 'true';
    el.setAttribute('aria-hidden', !isHidden);
    el.previousElementSibling.setAttribute('aria-expanded', isHidden);
};
