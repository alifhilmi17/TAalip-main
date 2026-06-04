/* =========================================================
   SISTEM ADMINISTRASI PETERNAKAN (LIBAS)
   File: stokpakan.js
   Deskripsi: Mengelola pencatatan stok pakan ternak —
   aliran masuk (restock) dan keluar (pemakaian harian),
   serta menghitung sisa stok secara real-time via Firestore.
   Mendukung dua peran: Petugas (catat pemakaian) & Admin (full CRUD).
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
    getDoc,
    getDocs,
    where
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { db, auth } from "../firebase.component/firebase-init.js";

// ==========================================
// GLOBAL STATE
// ==========================================
let dataPakan = [];                          // Semua data stok (masuk + keluar)
let dataAyam = [];                           // Data batch ayam aktif
let currentUserName = "Pengguna";           // Nama pengguna yang sedang login
let currentUserRole = "petugas";            // Role: 'admin' atau 'petugas'

const pakanCollection = collection(db, "stok_pakan");
const ayamCollection = collection(db, "populasi_ayam");

// ==========================================
// 1. UTILITAS
// ==========================================

/** Ambil bulan saat ini dalam format YYYY-MM */
function getBulanIni() {
    const now = new Date();
    return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
}

/**
 * Utilitas untuk mengamankan input teks dari serangan XSS (Cross-Site Scripting).
 * Mengubah karakter khusus HTML menjadi entitas karakter (escape).
 */

// ==========================================
// 2. INISIALISASI AUTH & FIREBASE LISTENER
// ==========================================
// ==========================================
// 2. INISIALISASI AUTH & FIREBASE LISTENER
// ==========================================
document.addEventListener("DOMContentLoaded", () => {

    // Filter bulan dimulai kosong (sesuai permintaan user)
    const elFilter = document.getElementById('filterBulanPakan');
    const elFilterP = document.getElementById('filterBulanPemakaian');
    if (elFilter) elFilter.value = "";
    if (elFilterP) elFilterP.value = "";

    // Deteksi role pengguna dari Firestore
    onAuthStateChanged(auth, async (user) => {
        if (!user) return;

        try {
            // Cek koleksi 'admin'
            const adminSnap = await getDoc(doc(db, "admin", user.uid));
            if (adminSnap.exists()) {
                currentUserRole = "admin";
                currentUserName = adminSnap.data().fullname || adminSnap.data().username || "Admin";
            } else {
                // Cek koleksi 'user'
                const userSnap = await getDoc(doc(db, "user", user.uid));
                if (userSnap.exists()) {
                    const userData = userSnap.data();
                    currentUserName = userData.fullname || user.displayName || "Petugas";
                    const role = (userData.role || 'petugas').trim().toLowerCase();
                    currentUserRole = (role === 'admin' || role === 'administrator' || role === 'owner') ? 'admin' : 'petugas';
                }
            }
        } catch (err) {
            console.warn("Gagal deteksi role:", err);
        }

        // Semua tombol kini terlihat untuk semua role (admin dan petugas)
        const btnTambahStok = document.getElementById('btnTambahStok');
        if (btnTambahStok) btnTambahStok.style.display = 'inline-flex';

        // Mulai listener Firestore
        startFirestoreListener();
    });
});

function startFirestoreListener() {
    const q = query(pakanCollection, orderBy("tanggal", "desc"));

    onSnapshot(q, (snapshot) => {
        dataPakan = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderTable();
        renderPemakaianTable();
        updateQuickStats();
    });

    onSnapshot(ayamCollection, (snapshot) => {
        dataAyam = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        loadBatchOptionsPakan();
    });
}

function loadBatchOptionsPakan(selectedId = '') {
    const selectEl = document.getElementById('batchPakan');
    if (!selectEl) return;
    
    const currentVal = selectedId || selectEl.value;
    selectEl.innerHTML = '<option value="" selected>-- Pilih Batch Target (Opsional) --</option>';
    let activeBatches = dataAyam.filter(a => a.status === 'Aktif');
    
    if (currentVal && !activeBatches.some(a => a.id === currentVal)) {
        const missing = dataAyam.find(a => a.id === currentVal);
        if (missing) activeBatches.push(missing);
    }
    
    activeBatches.forEach(ayam => {
        const opt = document.createElement('option');
        opt.value = ayam.id;
        const customId = ayam.customId || ayam.id.substring(0, 5);
        opt.textContent = `Batch ${customId} - Kandang: ${ayam.kandang || '-'}`;
        selectEl.appendChild(opt);
    });
    if (currentVal) selectEl.value = currentVal;
}

window.autoFillPakanKeterangan = function() {
    const selectEl = document.getElementById('batchPakan');
    const ketEl = document.getElementById('ketPakan');
    if (selectEl && selectEl.value && ketEl) {
        const text = selectEl.options[selectEl.selectedIndex].text;
        const currentVal = ketEl.value;
        const autoText = `Diberikan ke ${text}`;
        if (!currentVal || currentVal.startsWith('Diberikan ke')) {
            ketEl.value = autoText;
        }
    }
};

// ==========================================
// 3. TAB NAVIGASI & MODAL PILIHAN (CHOICE)
// ==========================================
window.switchTab = function(tab) {
    const sectionRiwayat = document.getElementById('sectionRiwayat');
    const sectionPemakaian = document.getElementById('sectionPemakaian');
    const tabRiwayat = document.getElementById('tabRiwayat');
    const tabPemakaian = document.getElementById('tabPemakaian');

    if (tab === 'riwayat') {
        sectionRiwayat.style.display = 'block';
        sectionPemakaian.style.display = 'none';
        tabRiwayat.classList.add('active');
        tabPemakaian.classList.remove('active');
    } else {
        sectionRiwayat.style.display = 'none';
        sectionPemakaian.style.display = 'block';
        tabRiwayat.classList.remove('active');
        tabPemakaian.classList.add('active');
    }
};

window.openChoiceModal = function() {
    document.getElementById('choiceModal').classList.add('show');
};

window.closeChoiceModal = function() {
    document.getElementById('choiceModal').classList.remove('show');
};

/** Memilih tipe transaksi dari modal pilihan */
window.selectTransactionType = function(type) {
    window.closeChoiceModal();
    openPakanModal(type);
};

// ==========================================
// 4. MODAL FORM UTAMA (STOK & PEMAKAIAN)
// ==========================================
window.toggleFinanceDetails = function() {
    const check = document.getElementById('catatKeuangan');
    const details = document.getElementById('financeDetails');
    if (check && details) {
        if (check.checked) {
            details.style.display = 'flex';
            document.getElementById('hargaPakanKg').setAttribute('required', 'true');
        } else {
            details.style.display = 'none';
            document.getElementById('hargaPakanKg').removeAttribute('required');
            document.getElementById('hargaPakanKg').value = '';
            document.getElementById('totalHargaPakan').value = '';
        }
    }
};

window.calculateTotalHargaPakan = function() {
    const qty = parseFloat(document.getElementById('jumlahPakan').value) || 0;
    const price = parseFloat(document.getElementById('hargaPakanKg').value) || 0;
    const total = qty * price;
    const totalEl = document.getElementById('totalHargaPakan');
    if (totalEl) {
        totalEl.value = total > 0 ? Math.round(total) : '';
    }
};

window.toggleJenisPakanInput = function() {
    const tipe = document.getElementById('tipePakan').value;
    const inputEl = document.getElementById('jenisPakan');
    const selectEl = document.getElementById('jenisPakanSelect');
    const financeGroup = document.getElementById('financeGroup');
    const batchGroup = document.getElementById('batchGroupPakan');
    const batchPakanEl = document.getElementById('batchPakan');
    
    if (tipe === "Keluar") {
        inputEl.style.display = 'none';
        inputEl.removeAttribute('required');
        inputEl.setAttribute('disabled', 'true');
        
        selectEl.style.display = 'block';
        selectEl.setAttribute('required', 'true');
        selectEl.removeAttribute('disabled');
        
        const uniqueFeeds = [...new Set(dataPakan.filter(p => p.tipe === "Masuk").map(p => p.jenis))];
        
        selectEl.innerHTML = '<option value="" disabled selected>-- Pilih Pakan Tersedia --</option>';
        uniqueFeeds.forEach(feed => {
            selectEl.innerHTML += `<option value="${feed}">${feed}</option>`;
        });

        if (financeGroup) financeGroup.style.display = 'none';
        if (batchGroup) batchGroup.style.display = 'block';
    } else {
        selectEl.style.display = 'none';
        selectEl.removeAttribute('required');
        selectEl.setAttribute('disabled', 'true');
        
        inputEl.style.display = 'block';
        inputEl.setAttribute('required', 'true');
        inputEl.removeAttribute('disabled');

        if (financeGroup) financeGroup.style.display = 'block';
        if (batchGroup) batchGroup.style.display = 'none';
        if (batchPakanEl) batchPakanEl.value = '';
    }
};

window.openPakanModal = function(type = '') {
    const form = document.getElementById('pakanForm');
    if (form) form.reset();
    
    document.getElementById('pakanId').value = "";

    // Reset finance input fields and state
    const catatKeuangan = document.getElementById('catatKeuangan');
    if (catatKeuangan) catatKeuangan.checked = false;
    window.toggleFinanceDetails();

    // Reset batch pakan select
    const batchPakanEl = document.getElementById('batchPakan');
    if (batchPakanEl) batchPakanEl.value = "";
    
    // Set tanggal default ke hari ini
    const today = window.getLocalDateString();
    document.getElementById('tglPakan').value = today;

    const tipeEl = document.getElementById('tipePakan');
    if (type) {
        tipeEl.value = type;
        tipeEl.setAttribute('disabled', 'true');
        document.getElementById('modalTitlePakan').innerText = type === "Masuk" ? "➕ Tambah Stok Pakan" : "📤 Catat Pemakaian Pakan";
        window.toggleJenisPakanInput();
    } else {
        tipeEl.removeAttribute('disabled');
        document.getElementById('modalTitlePakan').innerText = "Edit Data Pakan";
    }

    document.getElementById('pakanModal').classList.add('show');
};

window.closePakanModal = function() {
    document.getElementById('pakanModal').classList.remove('show');
};

// ==========================================
// 6. SIMPAN DATA STOK (TAMBAH / EDIT)
// ==========================================
window.savePakanData = async function(event) {
    event.preventDefault();
    const id = document.getElementById('pakanId').value;
    const tipe = document.getElementById('tipePakan').value;
    const jumlah = parseFloat(document.getElementById('jumlahPakan').value) || 0;

    // VALIDASI STOK (Jika Keluar)
    if (tipe === "Keluar") {
        // BUG-05 FIX: Filter per jenis pakan yang dipilih, bukan semua jenis digabung.
        // Mencegah stok jenis pakan A bisa dipakai melebihi batas karena tertutupi stok jenis B.
        const jenisDipilih = document.getElementById('jenisPakanSelect').value;
        let masuk = 0, keluar = 0;
        dataPakan.forEach(p => {
            if (p.jenis === jenisDipilih) {
                if (p.tipe === "Masuk") masuk += p.jumlah;
                else keluar += p.jumlah;
            }
        });
        const sisaSekarang = masuk - keluar;
        let sisaEfektif = sisaSekarang;
        if (id !== "") {
            const itemLama = dataPakan.find(p => p.id === id);
            if (itemLama && itemLama.tipe === "Keluar" && itemLama.jenis === jenisDipilih) {
                sisaEfektif = sisaSekarang + itemLama.jumlah;
            }
        }

        if (jumlah > sisaEfektif) {
            Swal.fire({
                icon: 'warning',
                title: 'Stok Tidak Cukup',
                html: `Jumlah pemakaian <strong>${jumlah.toLocaleString('id-ID')} Kg</strong> melebihi sisa stok <strong>${jenisDipilih}</strong>: <strong>${sisaEfektif.toLocaleString('id-ID')} Kg</strong>.`,
                confirmButtonColor: '#f97316'
            });
            return;
        }
    }

    const batchPakanEl = document.getElementById('batchPakan');
    const batchIdVal = batchPakanEl ? batchPakanEl.value : '';
    const batchLabelVal = (batchIdVal && batchPakanEl) ? batchPakanEl.options[batchPakanEl.selectedIndex].text : '';

    const payload = {
        tanggal: document.getElementById('tglPakan').value,
        tipe: tipe,
        jenis: tipe === "Keluar" ? document.getElementById('jenisPakanSelect').value : document.getElementById('jenisPakan').value,
        jumlah: jumlah,
        keterangan: document.getElementById('ketPakan').value || "",
        dicatatOleh: currentUserName,
        role: currentUserRole,
        batchId: batchIdVal,
        batchLabel: batchLabelVal,
        updatedAt: new Date().toISOString()
    };

    try {
        if (id === "") {
            payload.createdAt = new Date().toISOString();
            const docRef = await addDoc(pakanCollection, payload);

            // Integrasi otomatis ke keuangan (kas pengeluaran)
            const catatKeuangan = document.getElementById('catatKeuangan');
            if (tipe === "Masuk" && catatKeuangan && catatKeuangan.checked) {
                const hargaPerKg = parseFloat(document.getElementById('hargaPakanKg').value) || 0;
                const totalBiaya = Math.round(hargaPerKg * jumlah);
                
                const keuanganCollection = collection(db, "keuangan");
                await addDoc(keuanganCollection, {
                    tanggal: payload.tanggal,
                    tipe: "pengeluaran",
                    deskripsi: `Pembelian Pakan: ${payload.jenis} (${jumlah} Kg)`,
                    jumlah: totalBiaya,
                    createdAt: new Date().toISOString(),
                    source: 'stok_pakan',
                    pakanId: docRef.id
                });
            }

            window.showToast("Berhasil", "Data berhasil disimpan!", "success");
        } else {
            await updateDoc(doc(db, "stok_pakan", id), payload);
            window.showToast("Berhasil", "Data berhasil diperbarui!", "success");
        }
        window.closePakanModal();
    } catch (err) {
        Swal.fire("Error", "Gagal menyimpan: " + err.message, "error");
    }
};

// ==========================================
// 8. EDIT & HAPUS
// ==========================================
window.editPakan = function(id) {
    const item = dataPakan.find(p => p.id === id);
    if (!item) return;

    document.getElementById('pakanId').value = item.id;
    document.getElementById('tglPakan').value = item.tanggal;
    
    const tipeEl = document.getElementById('tipePakan');
    tipeEl.value = item.tipe;
    tipeEl.setAttribute('disabled', 'true');
    
    window.toggleJenisPakanInput();
    
    if (item.tipe === "Keluar") {
        document.getElementById('jenisPakanSelect').value = item.jenis;
        const batchPakanEl = document.getElementById('batchPakan');
        if (batchPakanEl) {
            loadBatchOptionsPakan(item.batchId);
            batchPakanEl.value = item.batchId || "";
        }
    } else {
        document.getElementById('jenisPakan').value = item.jenis;
    }
    
    document.getElementById('jumlahPakan').value = item.jumlah;
    document.getElementById('ketPakan').value = item.keterangan || "";
    
    document.getElementById('modalTitlePakan').innerText = "✏️ Edit Data " + (item.tipe === "Masuk" ? "Pakan Masuk" : "Pemakaian");
    document.getElementById('pakanModal').classList.add('show');
};

window.deletePakan = function(id) {
    const item = dataPakan.find(p => p.id === id);
    const isAdmin = currentUserRole === 'admin';

    if (!isAdmin && item && item.dicatatOleh !== currentUserName) {
        Swal.fire('Akses Ditolak', 'Anda hanya dapat menghapus data yang Anda catat sendiri.', 'error');
        return;
    }

    Swal.fire({
        title: 'Hapus Data?',
        text: "Data ini akan dihapus permanen dari database serta seluruh pengingat restock yang berkaitan.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ff6b6b',
        cancelButtonText: 'Batal',
        confirmButtonText: 'Ya, Hapus'
    }).then(async (result) => {
        if (result.isConfirmed) {
            const jenisPakan = item ? (item.jenis || item.namaBarang) : null;
            
            // Hapus data dari stok_pakan
            await deleteDoc(doc(db, "stok_pakan", id));

            // Cascade delete: Hapus pengingat restock yang jenis pakannya cocok (case-insensitive & trimmed)
            if (jenisPakan) {
                try {
                    const cleanPakanJenis = jenisPakan.trim().toLowerCase();
                    const allRemindersSnapshot = await getDocs(collection(db, "restock_reminders"));
                    const deletePromises = [];
                    allRemindersSnapshot.forEach(docSnap => {
                        const data = docSnap.data();
                        if (data.jenisPakan && data.jenisPakan.trim().toLowerCase() === cleanPakanJenis) {
                            deletePromises.push(deleteDoc(docSnap.ref));
                        }
                    });
                    await Promise.all(deletePromises);
                } catch (err) {
                    console.error("Gagal menghapus pengingat terkait: ", err);
                }
            }

            Swal.fire('Terhapus!', 'Data pakan dan pengingat terkait berhasil dihapus.', 'success');
        }
    });
};

// ==========================================
// 9. RENDER TABEL RIWAYAT STOK (Hanya Masuk)
// ==========================================
function renderTable() {
    const tbody = document.getElementById('pakanTableBody');
    const emptyState = document.getElementById('emptyStatePakan');
    const filterBulan = document.getElementById('filterBulanPakan')?.value || "";

    if (!tbody) return;
    tbody.innerHTML = "";

    const filtered = dataPakan.filter(p => 
        p.tipe === "Masuk" && (!filterBulan || p.tanggal.startsWith(filterBulan))
    );

    if (filtered.length === 0) {
        emptyState.style.display = 'block';
    } else {
        emptyState.style.display = 'none';
        filtered.forEach(p => {
            const tr = document.createElement('tr');
            const isOwner = p.dicatatOleh === currentUserName || currentUserRole === 'admin';
            const aksiBtn = isOwner
                ? `<button class="btn-edit" onclick="editPakan('${p.id}')">✏️</button>
                   <button class="btn-delete" onclick="deletePakan('${p.id}')">🗑️</button>`
                : `<span style="color:#94a3b8; font-size:0.8rem;">—</span>`;

            tr.innerHTML = `
                <td>${formatTanggal(p.tanggal)}</td>
                <td>${escapeHTML(p.jenis)}</td>
                <td><strong style="color:#10b981;">+ ${p.jumlah.toLocaleString('id-ID')} Kg</strong></td>
                <td>${escapeHTML(p.keterangan)}</td>
                <td>
                    <span class="dicatat-badge ${p.role === 'admin' ? 'dicatat-admin' : 'dicatat-petugas'}">
                        ${p.dicatatOleh || '-'}
                    </span>
                </td>
                <td style="text-align: center;">${aksiBtn}</td>
            `;
            tbody.appendChild(tr);
        });
    }
}

// ==========================================
// 10. RENDER TABEL PEMAKAIAN (Hanya Keluar)
// ==========================================
function renderPemakaianTable() {
    const tbody = document.getElementById('pemakaianTableBody');
    const emptyState = document.getElementById('emptyStatePemakaian');
    const filterBulan = document.getElementById('filterBulanPemakaian')?.value || "";

    if (!tbody) return;
    tbody.innerHTML = "";

    const filtered = dataPakan.filter(p =>
        p.tipe === "Keluar" && (!filterBulan || p.tanggal.startsWith(filterBulan))
    );

    if (filtered.length === 0) {
        emptyState.style.display = 'block';
    } else {
        emptyState.style.display = 'none';
        filtered.forEach(p => {
            const tr = document.createElement('tr');
            const isOwner = p.dicatatOleh === currentUserName || currentUserRole === 'admin';
            const aksiBtn = isOwner
                ? `<button class="btn-edit" onclick="editPakan('${p.id}')">✏️</button>
                   <button class="btn-delete" onclick="deletePakan('${p.id}')">🗑️</button>`
                : `<span style="color:#94a3b8; font-size:0.8rem;">—</span>`;

            tr.innerHTML = `
                <td>${formatTanggal(p.tanggal)}</td>
                <td>${escapeHTML(p.jenis)}</td>
                <td><strong style="color:#f97316;">- ${p.jumlah.toLocaleString('id-ID')} Kg</strong></td>
                <td>${escapeHTML(p.keterangan)}</td>
                <td>
                    <span class="dicatat-badge ${p.role === 'admin' ? 'dicatat-admin' : 'dicatat-petugas'}">
                        ${p.dicatatOleh || '-'}
                    </span>
                </td>
                <td style="text-align: center;">${aksiBtn}</td>
            `;
            tbody.appendChild(tr);
        });
    }
}

// ==========================================
// 11. STATISTIK KARTU RINGKASAN
// ==========================================
function updateQuickStats() {
    let masuk = 0, keluar = 0, pemakaianBulanIniCount = 0;
    const now = new Date();
    const bulanSekarang = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');

    let stokPerJenis = {};

    dataPakan.forEach(p => {
        if (!stokPerJenis[p.jenis]) {
            stokPerJenis[p.jenis] = { masuk: 0, keluar: 0 };
        }

        if (p.tipe === "Masuk") {
            masuk += p.jumlah;
            stokPerJenis[p.jenis].masuk += p.jumlah;
        } else {
            keluar += p.jumlah;
            stokPerJenis[p.jenis].keluar += p.jumlah;
            if (p.tanggal && p.tanggal.startsWith(bulanSekarang)) {
                pemakaianBulanIniCount += p.jumlah;
            }
        }
    });

    const sisa = masuk - keluar;

    let pakanTersediaText = "";
    let pakanList = [];
    for (const [jenis, stok] of Object.entries(stokPerJenis)) {
        const sisaJenis = stok.masuk - stok.keluar;
        if (sisaJenis > 0) {
            pakanList.push(`${jenis} ${sisaJenis.toLocaleString('id-ID')} Kg`);
        }
    }
    
    if (pakanList.length > 0) {
        pakanTersediaText = pakanList.join(" dan ");
    } else {
        pakanTersediaText = "Tidak ada pakan tersedia";
    }

    if (document.getElementById('totalPakanMasuk'))
        document.getElementById('totalPakanMasuk').innerText = masuk.toLocaleString('id-ID') + ' Kg';
    if (document.getElementById('detailPakanTersedia'))
        document.getElementById('detailPakanTersedia').innerText = pakanTersediaText;
    if (document.getElementById('totalPakanKeluar'))
        document.getElementById('totalPakanKeluar').innerText = keluar.toLocaleString('id-ID') + ' Kg';
    if (document.getElementById('sisaStokPakan')) {
        const el = document.getElementById('sisaStokPakan');
        el.innerText = sisa.toLocaleString('id-ID') + ' Kg';
        el.style.color = sisa < 50 ? '#ef4444' : '#4f46e5';
    }
    if (document.getElementById('pemakaianBulanIni'))
        document.getElementById('pemakaianBulanIni').innerText = pemakaianBulanIniCount.toLocaleString('id-ID') + ' Kg';
}

// ==========================================
// 12. FILTER
// ==========================================
window.filterData = function() {
    renderTable();
};

window.resetFilter = function() {
    document.getElementById('filterBulanPakan').value = "";
    renderTable();
};

window.filterPemakaian = function() {
    renderPemakaianTable();
};

window.resetFilterPemakaian = function() {
    document.getElementById('filterBulanPemakaian').value = "";
    renderPemakaianTable();
};

// ==========================================
// 13. EKSPOR CSV
// ==========================================
window.downloadLaporanCSV = function(mode = 'masuk') {
    const filterBulan = mode === 'keluar'
        ? document.getElementById('filterBulanPemakaian')?.value || ""
        : document.getElementById('filterBulanPakan')?.value || "";

    let data = dataPakan;
    if (mode === 'keluar') data = data.filter(p => p.tipe === "Keluar");
    else data = data.filter(p => p.tipe === "Masuk");
    
    if (filterBulan) data = data.filter(p => p.tanggal.startsWith(filterBulan));

    if (data.length === 0) {
        Swal.fire('Tidak Ada Data', 'Tidak ada data untuk diekspor.', 'info');
        return;
    }

    let csv = "Tanggal,Jenis Pakan,Jumlah (Kg),Keterangan,Dicatat Oleh,Role\n";
    data.forEach(p => {
        csv += `${p.tanggal},"${p.jenis}",${p.jumlah},"${p.keterangan || ''}","${p.dicatatOleh || ''}","${p.role || ''}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const suffix = mode === 'keluar' ? 'Pemakaian' : 'Masuk';
    a.download = `Laporan_${suffix}_Pakan_${window.getLocalDateString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
};

// ==========================================
// 14. SIDEBAR TOGGLE
// ==========================================
