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
    getDocs, 
    onSnapshot,
    query, 
    orderBy 
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { db } from "../firebase.component/firebase-init.js";

// State Global
let dataProduksi = [];
let dataAyam = [];
let dataPakan = [];
let collapsedBatches = new Set(); 
let collapsedWeeks = new Set();

const produksiCollection = collection(db, "produksi_harian");
const ayamCollection = collection(db, "populasi_ayam");
const pakanCollection = collection(db, "stok_pakan");

let unsubscribeAyam = null;

// =========================================
// 1. UTILITAS & FORMATTING
// =========================================

// =========================================
// 2. INISIALISASI & FETCH DATA
// =========================================

async function loadProduksiData() {
    try {
        const q = query(produksiCollection, orderBy("tanggal", "desc"));
        const snapshot = await getDocs(q);
        dataProduksi = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderTable();
    } catch (error) {
        console.error("Firestore Error (Produksi): ", error);
        Swal.fire("Error", "Gagal memuat data produksi: " + error.message, "error");
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    // 1. Fetch data produksi (bisa tetap getDocs atau ganti onSnapshot jika ingin real-time)
    await loadProduksiData();

    // 2. Real-time listener untuk Data Ayam (Batch)
    unsubscribeAyam = onSnapshot(ayamCollection, (snapshot) => {
        dataAyam = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Update dropdown jika modal sedang terbuka
        const modal = document.getElementById('produksiModal');
        if (modal && modal.classList.contains('show')) {
            const currentSelected = document.getElementById('batchProduksi').value;
            loadBatchOptions(currentSelected);
            // Update juga field sisa ayam yang tampil jika ada batch terpilih
            if (currentSelected) {
                const batch = dataAyam.find(a => a.id === currentSelected);
                if (batch) {
                    document.getElementById('totalAyamInput').value = batch.sisaAyam || 0;
                }
            }
        }
        updateQuickStats();
    }, (error) => {
        console.error("Firestore Error (Ayam): ", error);
    });

    // 3. Real-time listener untuk data pakan (menampilkan list jenis pakan opsional)
    onSnapshot(pakanCollection, (snapshot) => {
        dataPakan = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        loadPakanOptions();
    });
});

function loadPakanOptions() {
    const selectEl = document.getElementById('pakanJenisProduksi');
    if (!selectEl) return;

    // Ambil list unik pakan yang pernah dibeli/dimasukkan (tipe: Masuk)
    const uniqueFeeds = [...new Set(dataPakan.filter(p => p.tipe === "Masuk" && p.jenis).map(p => p.jenis))];
    selectEl.innerHTML = '<option value="" selected>-- Pilih Pakan (Opsional) --</option>';
    
    uniqueFeeds.forEach(feed => {
        const opt = document.createElement('option');
        opt.value = feed;
        opt.textContent = feed;
        selectEl.appendChild(opt);
    });
}

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
        
        const totalAyamEl = document.getElementById('totalAyamInput');
        if (totalAyamEl) totalAyamEl.value = batchData.sisaAyam || 0;

        lockBatchFields();
        window.calculateTotal();
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
    const totalTelur = baik + cacat;
    document.getElementById('totalTelur').value = totalTelur;

    const totalAyam = parseInt(document.getElementById('totalAyamInput').value) || 0;
    if (totalAyam > 0) {
        const ayamTidakBertelur = totalAyam - totalTelur;
        document.getElementById('ayamTidakBertelur').value = ayamTidakBertelur >= 0 ? ayamTidakBertelur : 0;
    } else {
        document.getElementById('ayamTidakBertelur').value = 0;
    }

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
        hint.style.color = '#b91c1c';
        hint.style.background = '#fef2f2';
        hint.style.borderColor = '#fca5a5';
        hint.style.display = 'block';
    } else if (rasio > 95) {
        hint.textContent = `ℹ️ Rasio produksi ${rasio.toFixed(1)}% — sangat tinggi, pastikan data sudah benar.`;
        hint.style.color = '#b45309';
        hint.style.background = '#fef9ec';
        hint.style.borderColor = '#fde68a';
        hint.style.display = 'block';
    } else if (totalTelur > 0 && rasio < 30) {
        hint.textContent = `ℹ️ Rasio produksi ${rasio.toFixed(1)}% — cukup rendah. Normal jika ada wabah atau cuaca ekstrem.`;
        hint.style.color = '#4b5563';
        hint.style.background = '#f9fafb';
        hint.style.borderColor = '#e5e7eb';
        hint.style.display = 'block';
    } else if (totalTelur > 0) {
        // Kasus 4: Produktivitas Normal (30% s/d 95%)
        hint.textContent = `✅ Rasio produksi ${rasio.toFixed(1)}% — tingkat produktivitas normal dan stabil.`;
        hint.style.color = '#047857';
        hint.style.background = '#ecfdf5';
        hint.style.borderColor = '#a7f3d0';
        hint.style.display = 'block';
    } else {
        hint.style.display = 'none';
    }
}

// =========================================
// 3.5 LOGIKA INPUT MINGGUAN (BULK)
// =========================================

window.switchInputMode = function(mode) {
    const inputModeEl = document.getElementById('inputMode');
    if (!inputModeEl) return;

    inputModeEl.value = mode;

    const btnHarian = document.getElementById('btnModeHarian');
    const btnMingguan = document.getElementById('btnModeMingguan');
    const dailyFields = document.getElementById('dailyFieldsContainer');
    const weeklyFields = document.getElementById('weeklyFieldsContainer');
    const labelTgl = document.getElementById('labelTglProduksi');
    const hintTgl = document.getElementById('tglHint');

    const telurBaikEl = document.getElementById('telurBaik');
    const telurCacatEl = document.getElementById('telurCacat');

    if (mode === 'harian') {
        if (btnHarian) btnHarian.classList.add('active');
        if (btnMingguan) btnMingguan.classList.remove('active');
        if (dailyFields) dailyFields.style.display = 'block';
        if (weeklyFields) weeklyFields.style.display = 'none';
        if (labelTgl) labelTgl.innerText = "Tanggal Produksi";
        if (hintTgl) hintTgl.innerText = "📅 Pilih tanggal produksi (default: Hari Ini)";

        if (telurBaikEl) telurBaikEl.required = true;
        if (telurCacatEl) telurCacatEl.required = true;
    } else {
        if (btnHarian) btnHarian.classList.remove('active');
        if (btnMingguan) btnMingguan.classList.add('active');
        if (dailyFields) dailyFields.style.display = 'none';
        if (weeklyFields) weeklyFields.style.display = 'block';
        if (labelTgl) labelTgl.innerText = "Tanggal Mulai (Hari Ke-1)";
        if (hintTgl) hintTgl.innerText = "📅 Pilih tanggal mulai untuk rentang 7 hari";

        if (telurBaikEl) telurBaikEl.required = false;
        if (telurCacatEl) telurCacatEl.required = false;

        generateWeeklyRows();
    }
};

window.onStartDateChange = function() {
    const inputMode = document.getElementById('inputMode').value;
    if (inputMode === 'mingguan') {
        generateWeeklyRows();
    }
};

function generateWeeklyRows() {
    const container = document.getElementById('weeklyRows');
    if (!container) return;

    const startDateStr = document.getElementById('tglProduksi').value;
    if (!startDateStr) return;

    container.innerHTML = "";
    const totalAyam = parseInt(document.getElementById('totalAyamInput').value) || 0;

    for (let i = 0; i < 7; i++) {
        const dateObj = new Date(startDateStr);
        dateObj.setDate(dateObj.getDate() + i);

        const yyyy = dateObj.getFullYear();
        const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
        const dd = String(dateObj.getDate()).padStart(2, '0');
        const dateString = `${yyyy}-${mm}-${dd}`;

        const formattedDate = dateObj.toLocaleDateString('id-ID', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });

        const rowHtml = `
            <div class="weekly-row" data-day="${i + 1}">
                <div class="weekly-row-date">
                    <span class="day-name">🗓️ Hari ke-${i + 1}</span>
                    <span class="day-date">${formattedDate}</span>
                </div>
                <div class="weekly-row-inputs">
                    <div class="weekly-input-group">
                        <label>Baik (Butir)</label>
                        <input type="number" class="weekly-telur-baik" min="0" required placeholder="0" oninput="window.calculateWeeklyRow(${i + 1})" />
                    </div>
                    <div class="weekly-input-group">
                        <label>Cacat (Butir)</label>
                        <input type="number" class="weekly-telur-cacat" min="0" required placeholder="0" oninput="window.calculateWeeklyRow(${i + 1})" />
                    </div>
                    <div class="weekly-input-group">
                        <label>Mati (Ekor)</label>
                        <input type="number" class="weekly-ayam-mati" min="0" required placeholder="0" value="0" oninput="window.calculateWeeklyRow(${i + 1})" />
                    </div>
                    <div class="weekly-input-group readonly-group">
                        <label>Total Telur</label>
                        <input type="number" class="weekly-total-telur" readonly value="0" />
                    </div>
                    <div class="weekly-input-group readonly-group">
                        <label>Tdk Bertelur</label>
                        <input type="number" class="weekly-tidak-bertelur" readonly value="${totalAyam}" />
                    </div>
                    <input type="hidden" class="weekly-date-val" value="${dateString}" />
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', rowHtml);
    }
}

window.calculateWeeklyRow = function(dayNum) {
    const row = document.querySelector(`.weekly-row[data-day="${dayNum}"]`);
    if (!row) return;

    const baikInput = row.querySelector('.weekly-telur-baik');
    const cacatInput = row.querySelector('.weekly-telur-cacat');
    const matiInput = row.querySelector('.weekly-ayam-mati');
    const totalInput = row.querySelector('.weekly-total-telur');
    const tidakBertelurInput = row.querySelector('.weekly-tidak-bertelur');

    const baik = parseInt(baikInput.value) || 0;
    const cacat = parseInt(cacatInput.value) || 0;
    const mati = parseInt(matiInput.value) || 0;
    const total = baik + cacat;
    totalInput.value = total;

    const totalAyam = parseInt(document.getElementById('totalAyamInput').value) || 0;

    // Update jumlah ayam tidak bertelur secara real-time
    if (tidakBertelurInput) {
        if (totalAyam > 0) {
            const tidakBertelur = totalAyam - total;
            tidakBertelurInput.value = tidakBertelur >= 0 ? tidakBertelur : 0;
        } else {
            tidakBertelurInput.value = 0;
        }
    }

    // Reset style
    row.style.borderColor = '#e2e8f0';
    row.style.background = '#f8fafc';

    if (totalAyam > 0 && total > totalAyam) {
        row.style.borderColor = '#fca5a5';
        row.style.background = '#fef2f2';
    } else if (totalAyam > 0 && total > 0 && (total / totalAyam) > 0.95) {
        row.style.borderColor = '#fde68a';
        row.style.background = '#fef9ec';
    } else if (total > 0) {
        row.style.borderColor = '#a7f3d0';
        row.style.background = '#ecfdf5';
    }
};

// =========================================
// 4. CRUD FIRESTORE
// =========================================
window.openProduksiModal = function() {
    const form = document.getElementById('produksiForm');
    const modal = document.getElementById('produksiModal');
    if (form) form.reset();
    document.getElementById('produksiId').value = "";
    
    // Reset ayamMatiHariIni value to 0
    const matiEl = document.getElementById('ayamMatiHariIni');
    if (matiEl) matiEl.value = 0;

    // Reset optional pakan inputs & show group
    const pakanGroup = document.getElementById('pakanProduksiGroup');
    if (pakanGroup) pakanGroup.style.display = 'block';
    const pakanJenisEl = document.getElementById('pakanJenisProduksi');
    const pakanJumlahEl = document.getElementById('pakanJumlahProduksi');
    if (pakanJenisEl) pakanJenisEl.value = "";
    if (pakanJumlahEl) pakanJumlahEl.value = "";
    
    // Set tanggal default ke hari ini
    const tglEl = document.getElementById('tglProduksi');
    if (tglEl) {
        tglEl.value = new Date().toISOString().split('T')[0];
    }

    loadBatchOptions();
    resetBatchFieldsForNewEntry();

    // Show Mode Input group in add mode
    const modeGroup = document.getElementById('inputModeGroup');
    if (modeGroup) modeGroup.style.display = 'block';

    // Force default mode to harian
    switchInputMode('harian');

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
    const inputMode = document.getElementById('inputMode').value;

    if (inputMode === 'harian') {
        // ── MODE HARIAN ──────────────────────────────────────────
        const telurBaik        = parseInt(document.getElementById('telurBaik').value) || 0;
        const telurCacat       = parseInt(document.getElementById('telurCacat').value) || 0;
        const totalTelur       = telurBaik + telurCacat;
        const ayamTidakBertelur = parseInt(document.getElementById('ayamTidakBertelur').value) || 0;
        const totalAyam        = parseInt(document.getElementById('totalAyamInput').value) || 0;
        const ayamMati         = parseInt(document.getElementById('ayamMatiHariIni').value) || 0;

        const pakanJenis       = document.getElementById('pakanJenisProduksi').value;
        const pakanJumlah      = parseFloat(document.getElementById('pakanJumlahProduksi').value) || 0;

        // VALIDASI STOK PAKAN (Pencegahan Over-Consumption / Negatif Stok)
        if (idInput === "" && pakanJenis && pakanJumlah > 0) {
            const cleanPakanJenis = pakanJenis.trim();
            let masuk = 0, keluar = 0;
            dataPakan.forEach(p => {
                if (p.jenis === cleanPakanJenis) {
                    if (p.tipe === "Masuk") masuk += p.jumlah;
                    else keluar += p.jumlah;
                }
            });
            const sisaPakanStok = masuk - keluar;
            if (pakanJumlah > sisaPakanStok) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Stok Pakan Tidak Cukup',
                    html: `Gagal mencatat pemakaian pakan otomatis harian.<br>Jumlah pemakaian <b>${pakanJumlah} Kg</b> melebihi sisa stok <b>${cleanPakanJenis}</b>: <b>${sisaPakanStok} Kg</b>.`,
                    confirmButtonColor: '#f97316'
                });
                return;
            }
        }

        // ── Ambil data batch untuk validasi ──────────────────────────
        const batchData = dataAyam.find(a => a.id === batchEl.value);
        const sisaAyam  = batchData ? (parseInt(batchData.sisaAyam) || 0) : 0;

        // ── VALIDASI DATA INTEGRITY ───────────────────────────────────
        if (totalAyam > 0) {
            // 1. Total telur tidak boleh melebihi jumlah ayam
            if (totalTelur > totalAyam) {
                Swal.fire({
                    icon: 'error',
                    title: 'Data Tidak Logis!',
                    html: `
                        <div style="text-align: left;">
                            <p>Total produksi telur (<b>${totalTelur} butir</b>) melebihi jumlah populasi ayam (<b>${totalAyam} ekor</b>).</p>
                            <hr>
                            <p><small><i>Catatan: Secara biologis, seekor ayam maksimal hanya bertelur 1 butir per hari. Harap periksa kembali input Anda.</i></small></p>
                        </div>
                    `,
                    confirmButtonColor: '#ef4444',
                    confirmButtonText: 'Perbaiki Input'
                });
                return;
            }

            // 2. Ayam tidak bertelur tidak boleh melebihi jumlah ayam
            if (ayamTidakBertelur > totalAyam) {
                Swal.fire({
                    icon: 'error',
                    title: 'Data Tidak Logis!',
                    text: `Jumlah ayam tidak bertelur (${ayamTidakBertelur} ekor) tidak mungkin melebihi total populasi ayam (${totalAyam} ekor).`,
                    confirmButtonColor: '#ef4444'
                });
                return;
            }

            // 3. Gabungan ayam bertelur (asumsi 1 butir = 1 ayam) + tidak bertelur
            if (totalTelur + ayamTidakBertelur > totalAyam) {
                Swal.fire({
                    icon: 'error',
                    title: 'Ketidakkonsistenan Data!',
                    html: `
                        <div style="text-align: left;">
                            <p>Total ayam terdeteksi: <b>${totalTelur + ayamTidakBertelur} ekor</b></p>
                            <ul>
                                  <li>Bertelur: ${totalTelur} ekor</li>
                                  <li>Tidak Bertelur: ${ayamTidakBertelur} ekor</li>
                            </ul>
                            <p>Sedangkan populasi di database hanya: <b>${totalAyam} ekor</b>.</p>
                        </div>
                    `,
                    confirmButtonColor: '#ef4444'
                });
                return;
            }
        } else {
            // Jika total ayam 0, tidak boleh ada produksi
            if (totalTelur > 0) {
                Swal.fire({
                    icon: 'error',
                    title: 'Batch Kosong',
                    text: 'Tidak bisa menginput produksi pada batch yang sudah tidak memiliki ayam.',
                    confirmButtonColor: '#ef4444'
                });
                return;
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
            ayamMati,
            totalAyam,
            updatedAt: new Date().toISOString()
        };

        try {
            if (idInput === "") {
                payload.createdAt = new Date().toISOString();
                await addDoc(produksiCollection, payload);

                // Integrasi otomatis pemakaian pakan (stok pakan keluar) jika diisi
                if (pakanJenis && pakanJumlah > 0) {
                    await addDoc(pakanCollection, {
                        tanggal: tanggalValue,
                        tipe: "Keluar",
                        jenis: pakanJenis.trim(),
                        jumlah: pakanJumlah,
                        keterangan: `[Otomatis dari Panen] Batch: ${payload.batchLabel.split(' - ')[0]} (Kandang: ${payload.kandang})`,
                        dicatatOleh: "Sistem Otomatis (Panen)",
                        role: "petugas",
                        batchId: batchEl.value,
                        batchName: batchEl.options[batchEl.selectedIndex].text,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    });
                }

                // Integrasi otomatis kematian ke kesehatan & populasi ayam
                if (ayamMati > 0) {
                    const kesehatanCollection = collection(db, "kesehatan_ayam");
                    await addDoc(kesehatanCollection, {
                        tanggal: tanggalValue,
                        batchId: batchEl.value,
                        batchName: batchEl.options[batchEl.selectedIndex].text,
                        kandang: payload.kandang,
                        jmlSakit: 0,
                        jmlMati: ayamMati,
                        gejala: "Pemeriksaan rutin saat panen telur harian",
                        penanganan: "Bangkai dievakuasi and dikubur",
                        status: "Mati",
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    });

                    const batchRef = doc(db, "populasi_ayam", batchEl.value);
                    const sisaSekarang = Math.max(0, totalAyam - ayamMati);
                    await updateDoc(batchRef, { 
                        sisaAyam: sisaSekarang,
                        updatedAt: new Date().toISOString()
                    });
                }

                Swal.fire({ icon: 'success', title: 'Berhasil!', text: 'Data produksi ditambahkan.', timer: 2000, showConfirmButton: false });
            } else {
                await updateDoc(doc(db, "produksi_harian", idInput), payload);
                Swal.fire({ icon: 'success', title: 'Berhasil!', text: 'Data produksi diperbarui.', timer: 2000, showConfirmButton: false });
            }
            
            // Refresh data setelah operasi selesai
            loadProduksiData();
            window.closeProduksiModal();
        } catch (err) {
            Swal.fire("Error", err.message, "error");
        }
    } else {
        // ── MODE MINGGUAN (BULK SAVE) ─────────────────────────────
        const totalAyam = parseInt(document.getElementById('totalAyamInput').value) || 0;
        
        // Kumpulkan data dari ke-7 baris
        const rows = document.querySelectorAll('.weekly-row');
        const payloads = [];
        let runningPopulasi = totalAyam;

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const dayNum = row.dataset.day;
            const dateVal = row.querySelector('.weekly-date-val').value;
            const baik = parseInt(row.querySelector('.weekly-telur-baik').value) || 0;
            const cacat = parseInt(row.querySelector('.weekly-telur-cacat').value) || 0;
            const mati = parseInt(row.querySelector('.weekly-ayam-mati').value) || 0;
            const total = baik + cacat;
            
            // Hitung populasi pada hari tersebut sebelum mati (populasi aktif saat itu)
            const populasiHariIni = runningPopulasi;
            
            // Kurangi populasi secara real-time untuk hari berikutnya
            runningPopulasi = Math.max(0, runningPopulasi - mati);
            
            const ayamTidakBertelur = populasiHariIni > 0 ? (populasiHariIni - total >= 0 ? populasiHariIni - total : 0) : 0;

            // VALIDASI: telur tidak boleh melebihi jumlah ayam
            if (populasiHariIni > 0 && total > populasiHariIni) {
                Swal.fire({
                    icon: 'error',
                    title: `Input Tidak Logis pada Hari Ke-${dayNum}!`,
                    html: `
                        <div style="text-align: left;">
                            <p>Hari ke-${dayNum} (<b>${dateVal}</b>): Total telur (<b>${total} butir</b>) melebihi jumlah populasi ayam (<b>${populasiHariIni} ekor</b>).</p>
                            <hr>
                            <p><small><i>Harap periksa kembali input Anda.</i></small></p>
                        </div>
                    `,
                    confirmButtonColor: '#ef4444'
                });
                return;
            }

            payloads.push({
                tanggal: dateVal,
                batchId: batchEl.value,
                batchLabel: batchEl.options[batchEl.selectedIndex].text,
                jenisTelur: document.getElementById('jenisTelurProduksi').value,
                kandang: document.getElementById('kandangProduksiHidden').value || document.getElementById('kandangProduksi').value,
                telurBaik: baik,
                telurCacat: cacat,
                totalTelur: total,
                ayamTidakBertelur: ayamTidakBertelur,
                ayamMati: mati,
                totalAyam: populasiHariIni,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        }

        // Tampilkan loading spinner
        Swal.fire({
            title: 'Menyimpan 7 Data...',
            html: 'Mohon tunggu sejenak, data sedang dikirim ke Firestore.',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        try {
            // Jalankan penyimpanan bulk secara paralel
            const savePromises = payloads.map(payload => addDoc(produksiCollection, payload));
            await Promise.all(savePromises);

            // Simpan log kematian untuk setiap hari yang memiliki kematian
            const kesehatanCollection = collection(db, "kesehatan_ayam");
            const healthPromises = [];
            
            payloads.forEach(p => {
                if (p.ayamMati > 0) {
                    healthPromises.push(addDoc(kesehatanCollection, {
                        tanggal: p.tanggal,
                        batchId: p.batchId,
                        batchName: p.batchLabel,
                        kandang: p.kandang,
                        jmlSakit: 0,
                        jmlMati: p.ayamMati,
                        gejala: "Pemeriksaan rutin saat panen telur harian",
                        penanganan: "Bangkai dievakuasi dan dikubur",
                        status: "Mati",
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    }));
                }
            });
            
            if (healthPromises.length > 0) {
                await Promise.all(healthPromises);
            }

            // Update sisaAyam terakhir di populasi_ayam
            const batchRef = doc(db, "populasi_ayam", batchEl.value);
            await updateDoc(batchRef, { 
                sisaAyam: runningPopulasi,
                updatedAt: new Date().toISOString()
            });

            Swal.fire({
                icon: 'success',
                title: 'Berhasil!',
                text: '7 data produksi mingguan berhasil disimpan sekaligus & sisa populasi otomatis diperbarui.',
                timer: 2500,
                showConfirmButton: false
            });

            loadProduksiData();
            window.closeProduksiModal();
        } catch (err) {
            Swal.fire("Error", "Gagal menyimpan data mingguan: " + err.message, "error");
        }
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
        document.getElementById('ayamMatiHariIni').value = prod.ayamMati || 0;
        document.getElementById('jenisTelurProduksi').value = prod.jenisTelur;
        document.getElementById('kandangProduksi').value = prod.kandang;
        document.getElementById('kandangProduksiHidden').value = prod.kandang;
        
        // Load Total Ayam (jika ada di data, atau ambil dari batch info)
        const batchInfo = dataAyam.find(a => a.id === prod.batchId);
        document.getElementById('totalAyamInput').value = prod.totalAyam !== undefined ? prod.totalAyam : (batchInfo ? batchInfo.sisaAyam : 0);

        lockBatchFields();

        // Hide optional pakan inputs in edit mode (as they are independent stok_pakan logs)
        const pakanGroup = document.getElementById('pakanProduksiGroup');
        if (pakanGroup) pakanGroup.style.display = 'none';

        // Hide Mode Input group in edit mode
        const modeGroup = document.getElementById('inputModeGroup');
        if (modeGroup) modeGroup.style.display = 'none';

        // Force switch to daily mode fields
        switchInputMode('harian');

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
            
            // Refresh data setelah dihapus
            loadProduksiData();
        }
    });
};

window.deleteMinggu = function(batchId, minggu) {
    // Cari semua data produksi yang cocok dengan batchId dan minggu tersebut
    const docsToDelete = dataProduksi.filter(p => p.batchId === batchId && p.minggu === minggu);
    
    if (docsToDelete.length === 0) {
        Swal.fire('Info', 'Tidak ada data untuk dihapus pada minggu ini.', 'info');
        return;
    }

    const batchName = docsToDelete[0].batchLabel.split(' - ')[0];

    Swal.fire({
        title: 'Hapus Semua Data Minggu Ini?',
        html: `Anda akan menghapus seluruh data produksi (<b>${docsToDelete.length} data</b>) untuk <b>${batchName}</b> pada <b>Minggu ke-${minggu}</b>.<br><br><span style="color:#ef4444;font-weight:bold;">⚠️ Tindakan ini tidak dapat dibatalkan!</span>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ff6b6b',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Ya, Hapus Semua!',
        cancelButtonText: 'Batal'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                // Tampilkan loading spinner agar user tahu proses sedang berjalan
                Swal.fire({
                    title: 'Menghapus data...',
                    html: 'Mohon tunggu sejenak.',
                    allowOutsideClick: false,
                    didOpen: () => {
                        Swal.showLoading();
                    }
                });

                // Hapus semua dokumen secara paralel menggunakan Promise.all
                const deletePromises = docsToDelete.map(p => deleteDoc(doc(db, "produksi_harian", p.id)));
                await Promise.all(deletePromises);

                Swal.fire({
                    icon: 'success',
                    title: 'Berhasil!',
                    text: `Semua data produksi Minggu ke-${minggu} berhasil dihapus.`,
                    timer: 2000,
                    showConfirmButton: false
                });

                // Refresh data
                await loadProduksiData();
            } catch (error) {
                console.error("Error deleting week: ", error);
                Swal.fire('Error', 'Gagal menghapus data: ' + error.message, 'error');
            }
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

window.toggleWeekGroup = function(batchId, minggu) {
    const key = `${batchId}-W${minggu}`;
    if (collapsedWeeks.has(key)) {
        collapsedWeeks.delete(key);
    } else {
        collapsedWeeks.add(key);
    }
    renderTable();
};

function renderTable() {
    const tbody = document.getElementById("produksiTableBody");
    const emptyState = document.getElementById("emptyState");
    const tableEl = document.getElementById("produksiTable");
    const filterTgl = document.getElementById('filterTanggal').value;

    if (!tbody) return;
    tbody.innerHTML = "";

    // MENGHITUNG MINGGU (Berdasarkan 7 data pertama, dst, diurutkan dari yang paling lama)
    const batchGroups = {};
    dataProduksi.forEach(prod => {
        if (!batchGroups[prod.batchId]) batchGroups[prod.batchId] = [];
        batchGroups[prod.batchId].push(prod);
    });

    Object.keys(batchGroups).forEach(batchId => {
        batchGroups[batchId].sort((a, b) => a.tanggal.localeCompare(b.tanggal));
        batchGroups[batchId].forEach((prod, index) => {
            prod.minggu = Math.floor(index / 7) + 1;
        });
    });

    // Memfilter data berdasarkan tanggal jika ada filter yang aktif
    let filteredData = dataProduksi.filter(prod => !filterTgl || prod.tanggal === filterTgl);

    // MENGELOMPOKKAN DATA: Urutkan berdasarkan batchId terlebih dahulu, kemudian minggu (desc), lalu tanggal (desc)
    filteredData.sort((a, b) => {
        // Urutkan berdasarkan Batch ID (agar berkelompok)
        if (a.batchId < b.batchId) return -1;
        if (a.batchId > b.batchId) return 1;
        // Jika batch sama, urutkan berdasarkan minggu terbaru (descending)
        if (a.minggu > b.minggu) return -1;
        if (a.minggu < b.minggu) return 1;
        // Jika minggu sama, urutkan berdasarkan tanggal terbaru (descending)
        return b.tanggal.localeCompare(a.tanggal);
    });

    if (filteredData.length === 0) {
        tableEl.style.display = "none";
        emptyState.style.display = "block";
    } else {
        tableEl.style.display = "table";
        emptyState.style.display = "none";

        let currentBatch = null;
        let currentMinggu = null;

        filteredData.forEach((prod) => {
            const isBatchCollapsed = collapsedBatches.has(prod.batchId);
            const weekKey = `${prod.batchId}-W${prod.minggu}`;
            const isWeekCollapsed = collapsedWeeks.has(weekKey);

            // SISIPKAN HEADER GRUP BATCH
            if (prod.batchId !== currentBatch) {
                currentBatch = prod.batchId;
                currentMinggu = null; // Reset minggu setiap ganti batch
                const headerRow = document.createElement("tr");
                headerRow.className = `batch-group-header ${isBatchCollapsed ? 'collapsed' : ''}`;
                headerRow.onclick = () => toggleBatchGroup(prod.batchId);
                headerRow.innerHTML = `
                    <td colspan="11">
                        <span class="toggle-icon">${isBatchCollapsed ? '▶' : '▼'}</span>
                        <span style="font-weight: 700; letter-spacing: 0.5px;">${prod.batchLabel.split(' - ')[0]}</span>
                        <span class="header-hint">${isBatchCollapsed ? 'Buka Detail' : 'Tutup Detail'}</span>
                    </td>
                `;
                tbody.appendChild(headerRow);
            }

            // Jika batch sedang ditutup, jangan tampilkan minggu dan datanya
            if (isBatchCollapsed) return;

            // SISIPKAN HEADER GRUP MINGGU
            if (prod.minggu !== currentMinggu) {
                currentMinggu = prod.minggu;
                const weekRow = document.createElement("tr");
                weekRow.className = `batch-group-header week-group-header ${isWeekCollapsed ? 'collapsed' : ''}`;
                weekRow.onclick = () => toggleWeekGroup(prod.batchId, prod.minggu);
                weekRow.style.backgroundColor = '#f1f5f9';
                weekRow.style.borderTop = '1px solid #e2e8f0';
                weekRow.innerHTML = `
                    <td colspan="11" style="padding-left: 2rem; padding-right: 1.5rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                            <div>
                                <span class="toggle-icon" style="color: #64748b; font-size: 0.9em;">${isWeekCollapsed ? '▶' : '▼'}</span>
                                <span style="font-weight: 600; color: #475569; font-size: 0.95em;">Minggu ke-${prod.minggu}</span>
                                <span class="header-hint" style="color: #94a3b8; font-size: 0.85em;">${isWeekCollapsed ? 'Buka Detail' : 'Tutup Detail'}</span>
                            </div>
                            <button class="btn-delete-week" onclick="event.stopPropagation(); deleteMinggu('${prod.batchId}', ${prod.minggu})" title="Hapus semua data minggu ini">
                                🗑️ Hapus Minggu Ini
                            </button>
                        </div>
                    </td>
                `;
                tbody.appendChild(weekRow);
            }

            // Jika minggu sedang ditutup, jangan tampilkan baris datanya
            if (isWeekCollapsed) return;

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
                <td><span class="badge" style="background:#ef4444;color:white;">${(prod.ayamMati || 0).toLocaleString('id-ID')} Ekor</span></td>
                <td><span class="badge" style="background:#3b82f6;color:white;">${(prod.totalAyam !== undefined ? prod.totalAyam : (dataAyam.find(a => a.id === prod.batchId)?.sisaAyam || 0)).toLocaleString('id-ID')} Ekor</span></td>
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
    let tidakBertelurTotal = 0;
    let distinctDates = new Set();

    dataProduksi.forEach(prod => {
        if (!filterTgl || prod.tanggal === filterTgl) {
            total += prod.totalTelur;
            baik += prod.telurBaik;
            cacat += prod.telurCacat;
            tidakBertelurTotal += (prod.ayamTidakBertelur || 0);
            distinctDates.add(prod.tanggal);
        }
    });

    // Hitung rata-rata jika melihat semua data, atau total jika difilter per tanggal
    const totalDays = distinctDates.size || 1;
    const finalTidakBertelur = filterTgl ? tidakBertelurTotal : Math.round(tidakBertelurTotal / totalDays);
    
    // Update label secara dinamis
    const labelEl = document.getElementById('labelAyamTidakBertelur');
    if (labelEl) {
        labelEl.innerText = filterTgl ? "Total Ayam Tidak Bertelur" : "Rata-rata Ayam Tidak Bertelur";
    }

    // Hitung total populasi ayam aktif dari dataAyam
    let totalPopulasi = 0;
    dataAyam.filter(a => a.status === 'Aktif').forEach(a => {
        totalPopulasi += (parseInt(a.sisaAyam) || 0);
    });

    if(document.getElementById('totalTelurHariIni')) document.getElementById('totalTelurHariIni').innerText = total.toLocaleString('id-ID') + ' Butir';
    if(document.getElementById('totalTelurBaik')) document.getElementById('totalTelurBaik').innerText = baik.toLocaleString('id-ID') + ' Butir';
    if(document.getElementById('totalTelurCacat')) document.getElementById('totalTelurCacat').innerText = cacat.toLocaleString('id-ID') + ' Butir';
    if(document.getElementById('totalAyamTidakBertelur')) document.getElementById('totalAyamTidakBertelur').innerText = finalTidakBertelur.toLocaleString('id-ID') + ' Ekor';
    if(document.getElementById('totalPopulasiAyam')) document.getElementById('totalPopulasiAyam').innerText = totalPopulasi.toLocaleString('id-ID') + ' Ekor';
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
    let csv = "ID,Tanggal,Batch,Jenis Telur,Kandang,Telur Baik,Telur Cacat,Total Telur,Ayam Tidak Bertelur,Ayam Mati,Total Ayam\n";
    dataProduksi.forEach(p => {
        const totalAyam = p.totalAyam !== undefined ? p.totalAyam : (dataAyam.find(a => a.id === p.batchId)?.sisaAyam || 0);
        csv += `${p.id},${p.tanggal},${p.batchLabel},${p.jenisTelur},${p.kandang},${p.telurBaik},${p.telurCacat},${p.totalTelur},${p.ayamTidakBertelur || 0},${p.ayamMati || 0},${totalAyam}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Laporan_Produksi_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
};

// Sidebar
