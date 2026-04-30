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
    getDoc
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { db, auth } from "../firebase.component/firebase-init.js";

// ==========================================
// GLOBAL STATE
// ==========================================
let dataPakan = [];                          // Semua data stok (masuk + keluar)
let currentUserName = "Pengguna";           // Nama pengguna yang sedang login
let currentUserRole = "petugas";            // Role: 'admin' atau 'petugas'

const pakanCollection = collection(db, "stok_pakan");

// ==========================================
// 1. UTILITAS
// ==========================================
function formatTanggal(tglString) {
    if (!tglString) return "-";
    const options = { day: 'numeric', month: 'short', year: 'numeric' };
    return new Date(tglString + 'T00:00:00').toLocaleDateString('id-ID', options);
}

/** Ambil bulan saat ini dalam format YYYY-MM */
function getBulanIni() {
    const now = new Date();
    return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
}

// ==========================================
// 2. INISIALISASI AUTH & FIREBASE LISTENER
// ==========================================
document.addEventListener("DOMContentLoaded", () => {

    // Set default filter ke bulan ini
    const bulanIni = getBulanIni();
    const elFilter = document.getElementById('filterBulanPakan');
    const elFilterP = document.getElementById('filterBulanPemakaian');
    if (elFilter) elFilter.value = bulanIni;
    if (elFilterP) elFilterP.value = bulanIni;

    // Deteksi role pengguna dari Firestore
    onAuthStateChanged(auth, async (user) => {
        if (!user) return;

        try {
            // Cek koleksi 'admin' terlebih dahulu
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
                    currentUserRole = (role === 'admin' || role === 'administrator') ? 'admin' : 'petugas';
                }
            }
        } catch (err) {
            console.warn("Gagal deteksi role:", err);
        }

        // Tampilkan/sembunyikan tombol Tambah Stok berdasarkan role
        const btnTambahStok = document.getElementById('btnTambahStok');
        if (btnTambahStok) {
            btnTambahStok.style.display = currentUserRole === 'admin' ? 'inline-flex' : 'none';
        }

        // Mulai listener Firestore setelah role diketahui
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
}

// ==========================================
// 3. TAB NAVIGASI
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
        renderPemakaianTable(); // refresh saat tab dibuka
    }
};

// ==========================================
// 4. MODAL TAMBAH STOK (ADMIN)
// ==========================================
window.openPakanModal = function() {
    const form = document.getElementById('pakanForm');
    if (form) form.reset();
    document.getElementById('pakanId').value = "";
    document.getElementById('modalTitlePakan').innerText = "Tambah Data Pakan";
    document.getElementById('pakanModal').classList.add('show');
};

window.closePakanModal = function() {
    document.getElementById('pakanModal').classList.remove('show');
};

// ==========================================
// 5. MODAL CATAT PEMAKAIAN (PETUGAS & ADMIN)
// ==========================================
window.openPemakaianModal = function() {
    const form = document.getElementById('pemakaianForm');
    if (form) form.reset();
    document.getElementById('pemakaianId').value = "";
    document.getElementById('modalTitlePemakaian').innerText = "📤 Catat Pemakaian Pakan";

    // Set tanggal default ke hari ini
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('tglPemakaian').value = today;

    // Tampilkan sisa stok saat ini
    updateSisaStokInfo();

    document.getElementById('pemakaianModal').classList.add('show');
};

window.closePemakaianModal = function() {
    document.getElementById('pemakaianModal').classList.remove('show');
};

/** Update info sisa stok di dalam modal pemakaian */
function updateSisaStokInfo() {
    let masuk = 0, keluar = 0;
    dataPakan.forEach(p => {
        if (p.tipe === "Masuk") masuk += p.jumlah;
        else keluar += p.jumlah;
    });
    const sisa = masuk - keluar;
    const el = document.getElementById('sisaStokInfoValue');
    if (el) {
        el.textContent = sisa.toLocaleString('id-ID') + ' Kg';
        el.style.color = sisa < 50 ? '#ef4444' : '#059669';
    }
}

// ==========================================
// 6. SIMPAN DATA STOK (TAMBAH / EDIT) — ADMIN
// ==========================================
window.savePakanData = async function(event) {
    event.preventDefault();
    const id = document.getElementById('pakanId').value;

    const payload = {
        tanggal: document.getElementById('tglPakan').value,
        tipe: document.getElementById('tipePakan').value,
        jenis: document.getElementById('jenisPakan').value,
        jumlah: parseFloat(document.getElementById('jumlahPakan').value) || 0,
        keterangan: document.getElementById('ketPakan').value || "",
        dicatatOleh: currentUserName,
        role: currentUserRole,
        updatedAt: new Date().toISOString()
    };

    try {
        if (id === "") {
            payload.createdAt = new Date().toISOString();
            await addDoc(pakanCollection, payload);
            Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Data stok pakan ditambahkan.', timer: 1500, showConfirmButton: false });
        } else {
            await updateDoc(doc(db, "stok_pakan", id), payload);
            Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Data stok pakan diperbarui.', timer: 1500, showConfirmButton: false });
        }
        window.closePakanModal();
    } catch (err) {
        Swal.fire("Error", "Gagal menyimpan: " + err.message, "error");
    }
};

// ==========================================
// 7. SIMPAN DATA PEMAKAIAN — PETUGAS & ADMIN
// ==========================================
window.savePemakaianData = async function(event) {
    event.preventDefault();
    const id = document.getElementById('pemakaianId').value;

    const jumlah = parseFloat(document.getElementById('jumlahPemakaian').value) || 0;

    // Cek apakah stok mencukupi
    let masuk = 0, keluar = 0;
    dataPakan.forEach(p => {
        if (p.tipe === "Masuk") masuk += p.jumlah;
        else keluar += p.jumlah;
    });
    const sisaSekarang = masuk - keluar;

    // Jika edit, tambahkan kembali jumlah lama ke sisa
    let sisaEfektif = sisaSekarang;
    if (id !== "") {
        const itemLama = dataPakan.find(p => p.id === id);
        if (itemLama) sisaEfektif = sisaSekarang + itemLama.jumlah;
    }

    if (jumlah > sisaEfektif) {
        Swal.fire({
            icon: 'warning',
            title: 'Stok Tidak Cukup',
            html: `Jumlah pemakaian <strong>${jumlah.toLocaleString('id-ID')} Kg</strong> melebihi sisa stok <strong>${sisaEfektif.toLocaleString('id-ID')} Kg</strong>.`,
            confirmButtonColor: '#f97316'
        });
        return;
    }

    const payload = {
        tanggal: document.getElementById('tglPemakaian').value,
        tipe: "Keluar",
        jenis: document.getElementById('jenisPakanPemakaian').value,
        jumlah: jumlah,
        keterangan: document.getElementById('ketPemakaian').value || "",
        dicatatOleh: currentUserName,
        role: currentUserRole,
        updatedAt: new Date().toISOString()
    };

    try {
        if (id === "") {
            payload.createdAt = new Date().toISOString();
            await addDoc(pakanCollection, payload);
            Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Pemakaian pakan berhasil dicatat.', timer: 1500, showConfirmButton: false });
        } else {
            await updateDoc(doc(db, "stok_pakan", id), payload);
            Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Data pemakaian diperbarui.', timer: 1500, showConfirmButton: false });
        }
        window.closePemakaianModal();
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

    if (item.tipe === "Keluar") {
        // Buka modal pemakaian untuk data keluar
        document.getElementById('pemakaianId').value = item.id;
        document.getElementById('tglPemakaian').value = item.tanggal;
        document.getElementById('jenisPakanPemakaian').value = item.jenis;
        document.getElementById('jumlahPemakaian').value = item.jumlah;
        document.getElementById('ketPemakaian').value = item.keterangan || "";
        document.getElementById('modalTitlePemakaian').innerText = "✏️ Edit Data Pemakaian";
        updateSisaStokInfo();
        document.getElementById('pemakaianModal').classList.add('show');
    } else {
        // Buka modal stok untuk data masuk
        document.getElementById('pakanId').value = item.id;
        document.getElementById('tglPakan').value = item.tanggal;
        document.getElementById('tipePakan').value = item.tipe;
        document.getElementById('jenisPakan').value = item.jenis;
        document.getElementById('jumlahPakan').value = item.jumlah;
        document.getElementById('ketPakan').value = item.keterangan || "";
        document.getElementById('modalTitlePakan').innerText = "✏️ Edit Data Pakan";
        document.getElementById('pakanModal').classList.add('show');
    }
};

window.deletePakan = function(id) {
    const item = dataPakan.find(p => p.id === id);
    const isAdmin = currentUserRole === 'admin';

    // Petugas hanya boleh hapus data yang dia sendiri catat
    if (!isAdmin && item && item.dicatatOleh !== currentUserName) {
        Swal.fire('Akses Ditolak', 'Anda hanya dapat menghapus data yang Anda catat sendiri.', 'error');
        return;
    }

    Swal.fire({
        title: 'Hapus Data?',
        text: "Data ini akan dihapus permanen dari database.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ff6b6b',
        cancelButtonText: 'Batal',
        confirmButtonText: 'Ya, Hapus'
    }).then(async (result) => {
        if (result.isConfirmed) {
            await deleteDoc(doc(db, "stok_pakan", id));
            Swal.fire('Terhapus!', 'Data berhasil dihapus.', 'success');
        }
    });
};

// ==========================================
// 9. RENDER TABEL RIWAYAT STOK (semua)
// ==========================================
function renderTable() {
    const tbody = document.getElementById('pakanTableBody');
    const emptyState = document.getElementById('emptyStatePakan');
    const filterBulan = document.getElementById('filterBulanPakan')?.value || "";

    if (!tbody) return;
    tbody.innerHTML = "";

    const filtered = dataPakan.filter(p => !filterBulan || p.tanggal.startsWith(filterBulan));

    if (filtered.length === 0) {
        emptyState.style.display = 'block';
    } else {
        emptyState.style.display = 'none';
        filtered.forEach(p => {
            const tr = document.createElement('tr');
            const typeBadge = p.tipe === "Masuk" ? 'badge-aktif' : 'badge-afkir';
            const isOwner = p.dicatatOleh === currentUserName || currentUserRole === 'admin';
            const aksiBtn = isOwner
                ? `<button class="btn-edit" onclick="editPakan('${p.id}')">✏️</button>
                   <button class="btn-delete" onclick="deletePakan('${p.id}')">🗑️</button>`
                : `<span style="color:#94a3b8; font-size:0.8rem;">—</span>`;

            tr.innerHTML = `
                <td>${formatTanggal(p.tanggal)}</td>
                <td>${p.jenis}</td>
                <td><span class="badge ${typeBadge}">${p.tipe}</span></td>
                <td><strong>${p.jumlah.toLocaleString('id-ID')} Kg</strong></td>
                <td>${p.keterangan || '-'}</td>
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
// 10. RENDER TABEL PEMAKAIAN (hanya keluar)
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

    // Update ringkasan pemakaian
    const totalPemakaianFiltered = filtered.reduce((sum, p) => sum + p.jumlah, 0);
    const summaryEl = document.getElementById('pemakaianSummary');
    if (summaryEl) {
        summaryEl.innerHTML = `
            <div class="pemakaian-summary-item">
                <span>📊 Total Pemakaian${filterBulan ? ' Bulan Ini' : ' Keseluruhan'}:</span>
                <strong>${totalPemakaianFiltered.toLocaleString('id-ID')} Kg</strong>
            </div>
            <div class="pemakaian-summary-item">
                <span>📋 Jumlah Catatan:</span>
                <strong>${filtered.length} entri</strong>
            </div>
        `;
    }

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
                <td>${p.jenis}</td>
                <td><strong style="color:#f97316;">${p.jumlah.toLocaleString('id-ID')} Kg</strong></td>
                <td>${p.keterangan || '-'}</td>
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
    let masuk = 0, keluar = 0, pemakaianBulanIni = 0;
    const bulanIni = getBulanIni();

    dataPakan.forEach(p => {
        if (p.tipe === "Masuk") {
            masuk += p.jumlah;
        } else {
            keluar += p.jumlah;
            if (p.tanggal && p.tanggal.startsWith(bulanIni)) {
                pemakaianBulanIni += p.jumlah;
            }
        }
    });

    const sisa = masuk - keluar;

    if (document.getElementById('totalPakanMasuk'))
        document.getElementById('totalPakanMasuk').innerText = masuk.toLocaleString('id-ID') + ' Kg';
    if (document.getElementById('totalPakanKeluar'))
        document.getElementById('totalPakanKeluar').innerText = keluar.toLocaleString('id-ID') + ' Kg';
    if (document.getElementById('sisaStokPakan')) {
        const el = document.getElementById('sisaStokPakan');
        el.innerText = sisa.toLocaleString('id-ID') + ' Kg';
        // Warna merah jika stok menipis (< 50 Kg)
        el.style.color = sisa < 50 ? '#ef4444' : '#4f46e5';
    }
    if (document.getElementById('pemakaianBulanIni'))
        document.getElementById('pemakaianBulanIni').innerText = pemakaianBulanIni.toLocaleString('id-ID') + ' Kg';
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
window.downloadLaporanCSV = function(mode = 'semua') {
    const filterBulan = mode === 'pemakaian'
        ? document.getElementById('filterBulanPemakaian')?.value || ""
        : document.getElementById('filterBulanPakan')?.value || "";

    let data = dataPakan;
    if (mode === 'pemakaian') data = data.filter(p => p.tipe === "Keluar");
    if (filterBulan) data = data.filter(p => p.tanggal.startsWith(filterBulan));

    if (data.length === 0) {
        Swal.fire('Tidak Ada Data', 'Tidak ada data untuk diekspor.', 'info');
        return;
    }

    let csv = "Tanggal,Jenis Pakan,Tipe,Jumlah (Kg),Keterangan,Dicatat Oleh,Role\n";
    data.forEach(p => {
        csv += `${p.tanggal},"${p.jenis}","${p.tipe}",${p.jumlah},"${p.keterangan || ''}","${p.dicatatOleh || ''}","${p.role || ''}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const suffix = mode === 'pemakaian' ? 'Pemakaian' : 'Stok';
    a.download = `Laporan_${suffix}_Pakan_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
};

// ==========================================
// 14. SIDEBAR TOGGLE
// ==========================================
window.toggleSidebarMenu = function(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const isHidden = el.getAttribute('aria-hidden') === 'true';
    el.setAttribute('aria-hidden', String(!isHidden));
    el.previousElementSibling.setAttribute('aria-expanded', String(isHidden));
    if (isHidden) {
        el.classList.add('open');
    } else {
        el.classList.remove('open');
    }
};
