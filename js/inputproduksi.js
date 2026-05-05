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
    // Tambahkan T00:00:00 agar diparsing sebagai waktu lokal, bukan UTC midnight
    // (mencegah tanggal meleset 1 hari di timezone UTC+7)
    const safeDate = tglString.includes('T') ? tglString : tglString + 'T00:00:00';
    return new Date(safeDate).toLocaleDateString('id-ID', options);
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
    }, (error) => {
        console.error("Firestore Error (Produksi): ", error);
        Swal.fire("Error", "Gagal memuat data produksi: " + error.message, "error");
    });

    // Listener Data Ayam (Batch)
    onSnapshot(ayamCollection, (snapshot) => {
        dataAyam = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Jika modal sedang terbuka, refresh opsi
        if (document.getElementById('produksiModal').classList.contains('show')) {
            const currentSelected = document.getElementById('batchProduksi').value;
            loadBatchOptions(currentSelected);
        }
    }, (error) => {
        console.error("Firestore Error (Ayam): ", error);
        Swal.fire("Error", "Gagal memuat data ayam: " + error.message, "error");
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

    const kandangEl = document.getElementById('kandangProduksi');
    const jenisEl = document.getElementById('jenisTelurProduksi');

    if (batchData) {
        // Jangan timpa tanggal jika sudah diisi, atau set ke hari ini jika kosong
        const tglEl = document.getElementById('tglProduksi');
        if (tglEl && !tglEl.value) {
            tglEl.value = new Date().toISOString().split('T')[0];
        }

        if (kandangEl) kandangEl.value = batchData.kandang || '';
        if (jenisEl) jenisEl.value = batchData.jenis || '';
        lockBatchFields();
    }
};

function lockBatchFields() {
    ['kandangProduksi', 'jenisTelurProduksi'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.disabled = (el.tagName === 'SELECT');
            el.readOnly = (el.tagName === 'INPUT');
            el.style.backgroundColor = '#e2e8f0';
        }
    });
    // Sync hidden kandang
    const kSelect = document.getElementById('kandangProduksi');
    const kHidden = document.getElementById('kandangProduksiHidden');
    if (kSelect && kHidden) kHidden.value = kSelect.value;
}

/**
 * Mereset field kandang & jenis ke kondisi awal (disabled) saat modal dibuka untuk
 * tambah data baru — field ini akan ter-isi otomatis setelah batch dipilih via autoFillFromBatch.
 * (Sebelumnya bernama unlockBatchFields — nama diperbarui agar sesuai perilaku aktual)
 */
function resetBatchFieldsForNewEntry() {
    ['tglProduksi', 'kandangProduksi', 'jenisTelurProduksi'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (id !== 'tglProduksi') {
                el.disabled = true;
                el.readOnly = true;
                el.value = '';
                el.style.backgroundColor = '#e2e8f0';
            } else {
                el.disabled = false;
                el.readOnly = false;
                el.style.backgroundColor = '#fff';
            }
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

    // Jalankan validasi ringan real-time saat angka berubah
    window.validateProduksiRealtime();
};

/**
 * Validasi ringan real-time — tampilkan hint di bawah field tanpa memblokir
 */
window.validateProduksiRealtime = function() {
    const batchId = document.getElementById('batchProduksi').value;
    if (!batchId) return;

    const batchData = dataAyam.find(a => a.id === batchId);
    if (!batchData) return;

    const sisaAyam   = parseInt(batchData.sisaAyam) || 0;
    const totalTelur = parseInt(document.getElementById('totalTelur').value) || 0;
    const hint       = document.getElementById('validasiHint');
    if (!hint) return;

    if (sisaAyam <= 0) { hint.style.display = 'none'; return; }

    const rasio = (totalTelur / sisaAyam) * 100;

    if (totalTelur > sisaAyam) {
        hint.textContent = `⚠️ Total telur (${totalTelur}) melebihi jumlah ayam (${sisaAyam} ekor). Periksa kembali.`;
        hint.style.color = '#ef4444';
        hint.style.display = 'block';
    } else if (rasio > 95) {
        hint.textContent = `ℹ️ Rasio produksi ${rasio.toFixed(1)}% — sangat tinggi, pastikan data sudah benar.`;
        hint.style.color = '#f59e0b';
        hint.style.display = 'block';
    } else if (totalTelur > 0 && rasio < 30) {
        hint.textContent = `ℹ️ Rasio produksi ${rasio.toFixed(1)}% — cukup rendah. Normal jika ada wabah atau cuaca ekstrem.`;
        hint.style.color = '#64748b';
        hint.style.display = 'block';
    } else {
        hint.style.display = 'none';
    }
}

// =========================================
// 4. CRUD FIRESTORE
// =========================================
window.openProduksiModal = function() {
    const form = document.getElementById('produksiForm');
    const modal = document.getElementById('produksiModal');
    if (form) form.reset();
    document.getElementById('produksiId').value = "";
    
    // Set tanggal default ke hari ini
    const tglEl = document.getElementById('tglProduksi');
    if (tglEl) {
        tglEl.value = new Date().toISOString().split('T')[0];
    }

    loadBatchOptions();
    resetBatchFieldsForNewEntry();
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

    // ── Ambil nilai form ──────────────────────────────────────────
    const telurBaik        = parseInt(document.getElementById('telurBaik').value) || 0;
    const telurCacat       = parseInt(document.getElementById('telurCacat').value) || 0;
    const totalTelur       = telurBaik + telurCacat;
    const ayamTidakBertelur = parseInt(document.getElementById('ayamTidakBertelur').value) || 0;

    // ── Ambil data batch untuk validasi ──────────────────────────
    const batchData = dataAyam.find(a => a.id === batchEl.value);
    const sisaAyam  = batchData ? (parseInt(batchData.sisaAyam) || 0) : 0;

    // ── VALIDASI DATA INTEGRITY ───────────────────────────────────
    if (sisaAyam > 0) {

        // 1. Total telur tidak boleh melebihi jumlah ayam
        if (totalTelur > sisaAyam) {
            Swal.fire({
                icon: 'error',
                title: 'Data Tidak Logis',
                html: `Total telur <strong>${totalTelur.toLocaleString('id-ID')} butir</strong> melebihi jumlah ayam yang ada: <strong>${sisaAyam.toLocaleString('id-ID')} ekor</strong>.<br><br>
                       Seekor ayam hanya bisa menghasilkan maksimal 1 telur per hari.`,
                confirmButtonColor: '#ef4444',
                confirmButtonText: 'Perbaiki Data'
            });
            return;
        }

        // 2. Ayam tidak bertelur tidak boleh melebihi jumlah ayam
        if (ayamTidakBertelur > sisaAyam) {
            Swal.fire({
                icon: 'error',
                title: 'Data Tidak Logis',
                html: `Jumlah ayam tidak bertelur <strong>${ayamTidakBertelur.toLocaleString('id-ID')} ekor</strong> melebihi total ayam yang ada: <strong>${sisaAyam.toLocaleString('id-ID')} ekor</strong>.`,
                confirmButtonColor: '#ef4444',
                confirmButtonText: 'Perbaiki Data'
            });
            return;
        }

        // 3. Ayam bertelur + tidak bertelur tidak boleh melebihi total ayam
        const ayamBertelur = totalTelur; // 1 telur per ayam
        if (ayamBertelur + ayamTidakBertelur > sisaAyam) {
            Swal.fire({
                icon: 'error',
                title: 'Data Tidak Konsisten',
                html: `Jumlah ayam bertelur (${ayamBertelur.toLocaleString('id-ID')}) + tidak bertelur (${ayamTidakBertelur.toLocaleString('id-ID')}) = <strong>${(ayamBertelur + ayamTidakBertelur).toLocaleString('id-ID')} ekor</strong>, melebihi total ayam: <strong>${sisaAyam.toLocaleString('id-ID')} ekor</strong>.`,
                confirmButtonColor: '#ef4444',
                confirmButtonText: 'Perbaiki Data'
            });
            return;
        }

        // 4. Peringatan jika rasio produksi sangat tinggi (> 95%) — minta konfirmasi
        const rasio = (totalTelur / sisaAyam) * 100;
        if (rasio > 95 && totalTelur > 0) {
            const konfirmasi = await Swal.fire({
                icon: 'warning',
                title: 'Rasio Produksi Sangat Tinggi',
                html: `Rasio produksi <strong>${rasio.toFixed(1)}%</strong> (${totalTelur} telur dari ${sisaAyam} ayam) tergolong sangat tinggi.<br><br>
                       Apakah data ini sudah benar?`,
                showCancelButton: true,
                confirmButtonColor: '#f59e0b',
                cancelButtonColor: '#94a3b8',
                confirmButtonText: 'Ya, Data Sudah Benar',
                cancelButtonText: 'Periksa Lagi'
            });
            if (!konfirmasi.isConfirmed) return;
        }
    }

    // ── Bentuk payload ────────────────────────────────────────────
    const tanggalValue = document.getElementById('tglProduksi').value;

    const payload = {
        tanggal: tanggalValue,
        batchId: batchEl.value,
        batchLabel: batchEl.options[batchEl.selectedIndex].text,
        jenisTelur: document.getElementById('jenisTelurProduksi').value,
        kandang: document.getElementById('kandangProduksiHidden').value || document.getElementById('kandangProduksi').value,
        telurBaik,
        telurCacat,
        totalTelur,
        ayamTidakBertelur,
        updatedAt: new Date().toISOString()
    };

    try {
        if (idInput === "") {
            payload.createdAt = new Date().toISOString();
            await addDoc(produksiCollection, payload);
            Swal.fire({ icon: 'success', title: 'Berhasil!', text: 'Data produksi ditambahkan.', timer: 2000, showConfirmButton: false });
        } else {
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
