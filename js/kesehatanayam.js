/* =========================================================
   SISTEM ADMINISTRASI PETERNAKAN (LIBAS)
   File: kesehatanayam.js
   Deskripsi: Mengatur logika pencatatan kesehatan medis
   serta penjadwalan vaksinasi ayam menggunakan Firestore.
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
    getDocs
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { db } from "../firebase.component/firebase-init.js";

// ==========================================
// 1. MANAJEMEN SIDEBAR & AUTH
// ==========================================

/**
 * Utilitas untuk mengamankan input teks dari serangan XSS (Cross-Site Scripting).
 * Mengubah karakter khusus HTML menjadi entitas karakter (escape).
 */

// ==========================================
// 2. STATE & COLLECTIONS
// ==========================================
let dataKesehatan = [];
let dataVaksin = [];
let dataAyam = [];
let dataProduksi = [];

const kesCollection = collection(db, "kesehatan_ayam");
const vakCollection = collection(db, "vaksinasi_ayam");
const ayamCollection = collection(db, "populasi_ayam");
const produksiCollection = collection(db, "produksi_harian");

// ==========================================
// 3. TABS & INISIALISASI
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    // Real-time listener untuk Kesehatan
    onSnapshot(query(kesCollection, orderBy("tanggal", "desc")), (snapshot) => {
        dataKesehatan = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderKesehatanTable();
        updateStats();
    });

    // Real-time listener untuk Vaksin
    onSnapshot(query(vakCollection, orderBy("tanggal", "asc")), (snapshot) => {
        dataVaksin = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderVaksinTable();
        updateStats();
    });

    // Real-time listener untuk Data Ayam (untuk dropdown batch)
    onSnapshot(ayamCollection, (snapshot) => {
        dataAyam = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        loadBatchOptions();
    });

    // Real-time listener untuk Produksi Harian (deteksi double death log)
    onSnapshot(produksiCollection, (snapshot) => {
        dataProduksi = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    });
});

/**
 * Berpindah tab antara 'Pencatatan Kesehatan' dan 'Penjadwalan Vaksinasi'
 * @param {string} tabId - ID tab yang ingin diaktifkan
 */
window.switchTab = function(tabId) {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => btn.classList.remove('active'));
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(content => {
        content.style.display = 'none'; // Sembunyikan semua tab
        content.classList.remove('active');
    });

    if (tabId === 'kesehatan') {
        tabBtns[0].classList.add('active');
        const content = document.getElementById('tabKesehatan');
        content.style.display = 'block';
        content.classList.add('active');
    } else {
        tabBtns[1].classList.add('active');
        const content = document.getElementById('tabVaksin');
        content.style.display = 'block';
        content.classList.add('active');
    }
};

// ==========================================
// 4. LOAD DATA BATCH
// ==========================================
function loadBatchOptions(selectedIdKes = null, selectedIdVak = null) {
    const kesBatch = document.getElementById('kesBatch');
    const vakBatch = document.getElementById('vakBatch');
    if (!kesBatch || !vakBatch) return;

    const currentKesVal = selectedIdKes || kesBatch.value;
    const currentVakVal = selectedIdVak || vakBatch.value;

    kesBatch.innerHTML = '<option value="" disabled selected>Pilih Batch...</option>';
    vakBatch.innerHTML = '<option value="" disabled selected>Pilih Batch Target...</option>';

    let dataAktif = dataAyam.filter(a => (a.status || "").toLowerCase() === "aktif");

    const checkAndPush = (val) => {
        if (val && !dataAktif.some(a => a.id === val)) {
            const missing = dataAyam.find(a => a.id === val);
            if (missing) dataAktif.push(missing);
        }
    };
    checkAndPush(currentKesVal);
    checkAndPush(currentVakVal);

    dataAktif.forEach(ayam => {
        const customId = ayam.customId || ayam.id.substring(0, 5);
        const optText = `${customId} (${ayam.kandang}) - Sisa: ${ayam.sisaAyam}`;

        const opt1 = document.createElement('option');
        opt1.value = ayam.id;
        opt1.textContent = optText;
        opt1.dataset.kandang = ayam.kandang;
        opt1.dataset.sisa = ayam.sisaAyam; // Simpan sisa ayam untuk validasi
        kesBatch.appendChild(opt1);

        const opt2 = document.createElement('option');
        opt2.value = ayam.id;
        opt2.textContent = optText;
        opt2.dataset.kandang = ayam.kandang;
        vakBatch.appendChild(opt2);
    });

    if (currentKesVal) kesBatch.value = currentKesVal;
    if (currentVakVal) vakBatch.value = currentVakVal;
}

window.onBatchSakitChange = function() {
    const sel = document.getElementById('kesBatch');
    const kandang = sel.options[sel.selectedIndex].dataset.kandang || '';
    document.getElementById('kesKandang').value = kandang;
};

window.onBatchVaksinChange = function() {
    const sel = document.getElementById('vakBatch');
    const kandang = sel.options[sel.selectedIndex].dataset.kandang || '';
    document.getElementById('vakKandang').value = kandang;
};

// ==========================================
// 5. KESEHATAN CRUD
// ==========================================
/**
 * Membuka jendela modal pencatatan kesehatan (Bisa mode Tambah Baru atau Edit)
 * @param {string} id - ID Dokumen Firestore (opsional, jika ingin edit)
 */
window.openKesehatanModal = function(id = null) {
    const modal = document.getElementById('kesehatanModal');
    const form = document.getElementById('kesehatanForm');
    const title = document.getElementById('modalKesehatanTitle');

    form.reset(); // Bersihkan form
    document.getElementById('kesehatanId').value = '';
    document.getElementById('kesKandang').value = '';

    if (id) {
        // MODE EDIT
        title.innerText = "Edit Catatan Kesehatan";
        const item = dataKesehatan.find(x => x.id == id);
        if (item) {
            document.getElementById('kesehatanId').value = item.id;
            document.getElementById('kesTanggal').value = item.tanggal;
            loadBatchOptions(item.batchId, null);
            document.getElementById('kesBatch').value = item.batchId;
            document.getElementById('kesKandang').value = item.kandang;
            document.getElementById('kesJmlSakit').value = item.jmlSakit;
            document.getElementById('kesJmlMati').value = item.jmlMati;
            document.getElementById('kesGejala').value = item.gejala;
            document.getElementById('kesPenanganan').value = item.penanganan;
            document.getElementById('kesStatus').value = item.status;
        }
    } else {
        // MODE TAMBAH BARU
        title.innerText = "Catat Kesehatan Ayam";
        document.getElementById('kesTanggal').value = window.getLocalDateString(); // Default hari ini
    }
    modal.classList.add('show');
};

window.closeKesehatanModal = function() {
    document.getElementById('kesehatanModal').classList.remove('show');
};

window.saveKesehatan = async function(e) {
    e.preventDefault();
    const id = document.getElementById('kesehatanId').value;
    const batchSelect = document.getElementById('kesBatch');
    const batchId = batchSelect.value;
    const batchText = batchSelect.options[batchSelect.selectedIndex].text;
    const status = document.getElementById('kesStatus').value;
    const jmlSakit = parseInt(document.getElementById('kesJmlSakit').value) || 0;
    // Simpan jmlMati sesuai input manual pengguna (tidak di-override)
    const jmlMati = parseInt(document.getElementById('kesJmlMati').value) || 0;
    const sisaAyam = parseInt(batchSelect.options[batchSelect.selectedIndex].dataset.sisa) || 0;

    // VALIDASI: Total yang dilaporkan (sakit + mati) tidak boleh melebihi sisa populasi
    // Catatan: jmlSakit adalah ayam yang masih hidup tapi sakit, jmlMati adalah yang benar-benar hilang.
    if (jmlSakit + jmlMati > sisaAyam && status !== "Sembuh") {
        Swal.fire("Validasi Gagal", `Jumlah total (Sakit: ${jmlSakit} + Mati: ${jmlMati}) melebihi sisa ayam di batch ini (${sisaAyam} ekor).`, "warning");
        return;
    }

    // DETEKSI DOUBLE DEATH LOG DENGAN PRODUKSI HARIAN (Pencegahan Double Decrement)
    const kesTanggal = document.getElementById('kesTanggal').value;
    if (jmlMati > 0 && !id) {
        const prodMatiMatch = dataProduksi.find(p => p.tanggal === kesTanggal && p.batchId === batchId && (p.ayamMati || 0) > 0);
        if (prodMatiMatch) {
            const confirmSave = await Swal.fire({
                title: 'Deteksi Kematian di Produksi',
                html: `⚠️ Pada tanggal <b>${window.formatTanggal ? window.formatTanggal(kesTanggal) : kesTanggal}</b>, modul <b>Produksi Harian</b> telah mencatat kematian <b>${prodMatiMatch.ayamMati} ekor ayam</b> untuk batch ini.<br><br>Jika Anda menyimpan data ini dengan <b>${jmlMati} ekor mati</b>, populasi ayam di database akan berkurang kembali.<br><br>Apakah Anda yakin kematian ini terpisah (bukan kematian yang sama)?`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#ef4444',
                cancelButtonColor: '#64748b',
                confirmButtonText: 'Ya, Tetap Simpan',
                cancelButtonText: 'Batal'
            });
            if (!confirmSave.isConfirmed) {
                return;
            }
        }
    }

    // Membentuk paket data kesehatan
    const payload = {
        tanggal: document.getElementById('kesTanggal').value,
        batchId: batchId,
        batchName: batchText,
        kandang: document.getElementById('kesKandang').value,
        jmlSakit: jmlSakit,
        jmlMati: jmlMati,
        gejala: document.getElementById('kesGejala').value,
        penanganan: document.getElementById('kesPenanganan').value,
        status: status,
        updatedAt: new Date().toISOString()
    };

    try {
        // --- LOGIKA POTONG STOK OTOMATIS ---
        const batchRef = doc(db, "populasi_ayam", batchId);
        const batchData = dataAyam.find(a => a.id === batchId);
        
        if (batchData) {
            let sisaSekarang = parseInt(batchData.sisaAyam) || 0;
            let totalPengurangan = jmlMati;

            // Jika status "Mati Semua", maka ayam yang sakit juga dianggap mati/hilang dari populasi aktif
            if (status === "Mati Semua") {
                totalPengurangan = jmlSakit + jmlMati;
            }

            if (id) {
                // Jika EDIT: Hitung selisih dari data lama
                const oldItem = dataKesehatan.find(x => x.id === id);
                let oldPengurangan = (oldItem.jmlMati || 0);
                if (oldItem.status === "Mati Semua") {
                    oldPengurangan = (oldItem.jmlSakit || 0) + (oldItem.jmlMati || 0);
                }
                
                const delta = totalPengurangan - oldPengurangan;
                sisaSekarang -= delta;
            } else {
                // Jika BARU: Langsung kurangi
                sisaSekarang -= totalPengurangan;
            }

            // Update sisa ayam di koleksi populasi_ayam
            await updateDoc(batchRef, { 
                sisaAyam: Math.max(0, sisaSekarang),
                updatedAt: new Date().toISOString()
            });
        }
        // ----------------------------------

        if (id) {
            await updateDoc(doc(db, "kesehatan_ayam", id), payload);
        } else {
            payload.createdAt = new Date().toISOString();
            await addDoc(kesCollection, payload);
        }
        window.closeKesehatanModal();
        window.showToast("Berhasil", "Data kesehatan disimpan & stok ayam otomatis diperbarui!", "success");
    } catch (err) {
        Swal.fire("Error", "Gagal menyimpan: " + err.message, "error");
    }
};

window.hapusKesehatan = function(id) {
    Swal.fire({
        title: "Hapus Catatan?",
        text: "Data yang dihapus tidak bisa dikembalikan.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#ef4444",
        confirmButtonText: "Hapus"
    }).then(async result => {
        if (result.isConfirmed) {
            await deleteDoc(doc(db, "kesehatan_ayam", id));
            Swal.fire("Dihapus!", "Data berhasil dihapus.", "success");
        }
    });
};

function renderKesehatanTable() {
    const tbody = document.getElementById('kesehatanTableBody');
    const emptyState = document.getElementById('kesehatanEmpty');
    const filterTanggal = document.getElementById('filterKesehatanTanggal').value;
    if (!tbody) return;

    tbody.innerHTML = '';
    let filtered = dataKesehatan;
    if (filterTanggal) {
        filtered = filtered.filter(x => x.tanggal === filterTanggal);
    }

    if (filtered.length === 0) {
        emptyState.style.display = 'block';
    } else {
        emptyState.style.display = 'none';
        filtered.forEach(item => {
            let badgeClass = item.status === "Sembuh" ? "badge-success" : (item.status === "Mati Semua" ? "badge-danger" : "badge-warning");
            const tglIndo = window.formatTanggal(item.tanggal);

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${tglIndo}</strong></td>
                <td>${escapeHTML(item.batchName)}</td>
                <td>${escapeHTML(item.gejala)}</td>
                <td>Sakit: <strong>${item.jmlSakit}</strong><br>Mati: <strong style="color:red">${item.jmlMati}</strong></td>
                <td>${escapeHTML(item.penanganan)}</td>
                <td><span class="badge ${badgeClass}">${item.status}</span></td>
                <td>
                    <button class="btn-edit" onclick="openKesehatanModal('${item.id}')">✏️</button>
                    <button class="btn-delete" onclick="hapusKesehatan('${item.id}')">🗑️</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
}

// ==========================================
// 6. VAKSINASI CRUD
// ==========================================
window.openVaksinModal = function(id = null) {
    const modal = document.getElementById('vaksinModal');
    const form = document.getElementById('vaksinForm');
    const title = document.getElementById('modalVaksinTitle');

    form.reset();
    document.getElementById('vaksinId').value = '';
    document.getElementById('vakKandang').value = '';

    if (id) {
        title.innerText = "Edit Jadwal Vaksin";
        const item = dataVaksin.find(x => x.id == id);
        if (item) {
            document.getElementById('vaksinId').value = item.id;
            document.getElementById('vakTanggal').value = item.tanggal;
            loadBatchOptions(null, item.batchId);
            document.getElementById('vakBatch').value = item.batchId;
            document.getElementById('vakKandang').value = item.kandang;
            document.getElementById('vakJenis').value = item.jenis;
            document.getElementById('vakMetode').value = item.metode;
            document.getElementById('vakCatatan').value = item.catatan;
            document.getElementById('vakStatus').value = item.status;
        }
    } else {
        title.innerText = "Buat Jadwal Vaksin";
        document.getElementById('vakTanggal').value = window.getLocalDateString();
    }
    modal.classList.add('show');
};

window.closeVaksinModal = function() {
    document.getElementById('vaksinModal').classList.remove('show');
};

window.saveVaksin = async function(e) {
    e.preventDefault();
    const id = document.getElementById('vaksinId').value;
    const batchSelect = document.getElementById('vakBatch');
    
    const payload = {
        tanggal: document.getElementById('vakTanggal').value,
        batchId: batchSelect.value,
        batchName: batchSelect.options[batchSelect.selectedIndex].text,
        kandang: document.getElementById('vakKandang').value,
        jenis: document.getElementById('vakJenis').value,
        metode: document.getElementById('vakMetode').value,
        catatan: document.getElementById('vakCatatan').value,
        status: document.getElementById('vakStatus').value,
        updatedAt: new Date().toISOString()
    };

    try {
        if (id) {
            await updateDoc(doc(db, "vaksinasi_ayam", id), payload);
        } else {
            payload.createdAt = new Date().toISOString();
            await addDoc(vakCollection, payload);
        }
        window.closeVaksinModal();
        window.showToast("Berhasil", "Jadwal vaksinasi disimpan!", "success");
    } catch (err) {
        Swal.fire("Error", "Gagal: " + err.message, "error");
    }
};

window.hapusVaksin = function(id) {
    Swal.fire({
        title: "Hapus Jadwal?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#ef4444",
        confirmButtonText: "Hapus"
    }).then(async result => {
        if (result.isConfirmed) {
            await deleteDoc(doc(db, "vaksinasi_ayam", id));
            Swal.fire("Dihapus!", "Jadwal berhasil dihapus.", "success");
        }
    });
};

window.selesaikanVaksin = async function(id) {
    try {
        await updateDoc(doc(db, "vaksinasi_ayam", id), { status: "Selesai", updatedAt: new Date().toISOString() });
        window.showToast("Tuntas!", "Status vaksinasi berubah menjadi selesai.", "success");
    } catch (err) {
        Swal.fire("Error", err.message, "error");
    }
};

function renderVaksinTable() {
    const tbody = document.getElementById('vaksinTableBody');
    const emptyState = document.getElementById('vaksinEmpty');
    const filterStatus = document.getElementById('filterVaksinStatus').value;
    if (!tbody) return;

    tbody.innerHTML = '';
    let filtered = dataVaksin;
    if (filterStatus !== 'all') {
        filtered = filtered.filter(x => x.status === filterStatus);
    }

    if (filtered.length === 0) {
        emptyState.style.display = 'block';
    } else {
        emptyState.style.display = 'none';
        filtered.forEach(item => {
            let badgeClass = item.status === "Terjadwal" ? "badge-info" : "badge-success";
            const dt = new Date(item.tanggal);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (dt < today && item.status === "Terjadwal") {
                badgeClass = "badge-danger";
            }
            const tglIndo = window.formatTanggal(item.tanggal);

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${tglIndo}</strong></td>
                <td>${escapeHTML(item.batchName)}</td>
                <td>${escapeHTML(item.jenis)}</td>
                <td>${escapeHTML(item.metode)}</td>
                <td>${escapeHTML(item.catatan)}</td>
                <td><span class="badge ${badgeClass}">${item.status}</span></td>
                <td>
                    ${item.status !== "Selesai" ? `<button class="btn-success" style="padding:5px 8px;" onclick="selesaikanVaksin('${item.id}')">✔️</button>` : ''}
                    <button class="btn-edit" onclick="openVaksinModal('${item.id}')">✏️</button>
                    <button class="btn-delete" onclick="hapusVaksin('${item.id}')">🗑️</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
}

// ==========================================
// 7. STATISTICS
// ==========================================
/**
 * Memperbarui angka statistik kesehatan di kartu atas (Dashboard Mini)
 */
function updateStats() {
    const elSakit = document.getElementById('statAyamSakit');
    const elMati = document.getElementById('statAyamMati');
    const elVaksin = document.getElementById('statVaksinMendatang');

    if (elSakit) {
        // Hitung ayam yang masih aktif dalam perawatan
        const sakit = dataKesehatan
            .filter(x => x.status === "Dalam Perawatan")
            .reduce((sum, item) => sum + (parseInt(item.jmlSakit) || 0), 0);
        elSakit.innerText = `${sakit.toLocaleString('id-ID')} Ekor`;
    }
    if (elMati) {
        // Aturan kematian:
        // "Mati Semua" = ayam sakit (jmlSakit) + yang sudah mati sebelumnya (jmlMati)
        // Contoh: 15 sakit + 5 mati = 20 total kematian
        // Status lain   = hanya jmlMati yang tercatat manual
        const mati = dataKesehatan.reduce((sum, item) => {
            if (item.status === 'Mati Semua') {
                return sum + (parseInt(item.jmlSakit) || 0) + (parseInt(item.jmlMati) || 0);
            }
            return sum + (parseInt(item.jmlMati) || 0);
        }, 0);
        elMati.innerText = `${mati.toLocaleString('id-ID')} Ekor`;
    }
    if (elVaksin) {
        const terjadwal = dataVaksin.filter(x => x.status === "Terjadwal").length;
        elVaksin.innerText = `${terjadwal} Jadwal`;
    }
}

// ==========================================
// 8. EXPORT
// ==========================================
window.exportKesehatanCSV = function() {
    if (dataKesehatan.length === 0) return;
    let csv = "Tanggal,Batch,Kandang,Gejala,Jml Sakit,Jml Mati,Penanganan,Status\n";
    dataKesehatan.forEach(x => {
        csv += `"${x.tanggal}","${x.batchName}","${x.kandang}","${x.gejala}","${x.jmlSakit}","${x.jmlMati}","${x.penanganan}","${x.status}"\n`;
    });
    downloadCSV(csv, "Data_Kesehatan_Ayam_LIBAS.csv");
};

window.exportVaksinCSV = function() {
    if (dataVaksin.length === 0) return;
    let csv = "Tanggal,Batch,Kandang,Jenis Vaksin,Metode,Status,Catatan\n";
    dataVaksin.forEach(x => {
        csv += `"${x.tanggal}","${x.batchName}","${x.kandang}","${x.jenis}","${x.metode}","${x.status}","${x.catatan || ''}"\n`;
    });
    downloadCSV(csv, "Jadwal_Vaksinasi_LIBAS.csv");
};

function downloadCSV(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}
