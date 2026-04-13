/* =========================================================
   SISTEM ADMINISTRASI PETERNAKAN (LIBAS)
   File: stokpakan.js
   Deskripsi: File ini mengelola pencatatan stok pakan ternak,
   mencatat aliran pakan masuk dan keluar, serta menghitung
   sisa stok secara real-time menggunakan Firestore.
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

// Global State
let dataPakan = [];
const pakanCollection = collection(db, "stok_pakan");

// ==========================================
// 1. UTILITAS
// ==========================================
function formatTanggal(tglString) {
    if (!tglString) return "-";
    const options = { day: 'numeric', month: 'short', year: 'numeric' };
    return new Date(tglString).toLocaleDateString('id-ID', options);
}

// ==========================================
// 2. INISIALISASI & FIREBASE LISTENER
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    const q = query(pakanCollection, orderBy("tanggal", "desc"));
    
    onSnapshot(q, (snapshot) => {
        dataPakan = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        renderTable();
        updateQuickStats();
    });

    // Set Default Filter ke Bulan Ini
    const now = new Date();
    const currentMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    if (document.getElementById('filterBulanPakan')) {
        document.getElementById('filterBulanPakan').value = currentMonth;
    }
});

// ==========================================
// 3. CRUD LOGIC
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

/**
 * Menyimpan data pakan ke Firestore (Tambah atau Edit)
 */
window.savePakanData = async function(event) {
    event.preventDefault();
    const id = document.getElementById('pakanId').value;
    
    // Objek data pakan
    const payload = {
        tanggal: document.getElementById('tglPakan').value,
        tipe: document.getElementById('tipePakan').value,
        jenis: document.getElementById('jenisPakan').value,
        jumlah: parseFloat(document.getElementById('jumlahPakan').value) || 0,
        keterangan: document.getElementById('ketPakan').value || "",
        updatedAt: new Date().toISOString()
    };

    try {
        if (id === "") {
            // Logika Tambah Baru
            payload.createdAt = new Date().toISOString();
            await addDoc(pakanCollection, payload);
            Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Data stok pakan ditambahkan.', timer: 1500, showConfirmButton: false });
        } else {
            // Logika Update (Edit)
            await updateDoc(doc(db, "stok_pakan", id), payload);
            Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Data stok pakan diperbarui.', timer: 1500, showConfirmButton: false });
        }
        window.closePakanModal(); // Tutup modal setelah simpan
    } catch (err) {
        Swal.fire("Error", "Gagal menyimpan: " + err.message, "error");
    }
};

/**
 * Mengambil data pakan untuk diedit dan membukanya di modal
 * @param {string} id - UID dokumen Firestore
 */
window.editPakan = function(id) {
    const item = dataPakan.find(p => p.id === id);
    if (item) {
        document.getElementById('pakanId').value = item.id;
        document.getElementById('tglPakan').value = item.tanggal;
        document.getElementById('tipePakan').value = item.tipe;
        document.getElementById('jenisPakan').value = item.jenis;
        document.getElementById('jumlahPakan').value = item.jumlah;
        document.getElementById('ketPakan').value = item.keterangan || "";
        
        document.getElementById('modalTitlePakan').innerText = "Edit Data Pakan";
        document.getElementById('pakanModal').classList.add('show');
    }
};

/**
 * Menghapus data pakan secara permanen dari Firestore
 * @param {string} id - UID dokumen Firestore
 */
window.deletePakan = function(id) {
    Swal.fire({
        title: 'Hapus Data?',
        text: "Data ini akan dihapus permanen dari database cloud.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ff6b6b'
    }).then(async (result) => {
        if (result.isConfirmed) {
            await deleteDoc(doc(db, "stok_pakan", id)); // Hapus dari Firestore
            Swal.fire('Terhapus!', 'Data berhasil dihapus.', 'success');
        }
    });
};

// ==========================================
// 4. DISPLAY & FILTER
// ==========================================
function renderTable() {
    const tbody = document.getElementById('pakanTableBody');
    const emptyState = document.getElementById('emptyStatePakan');
    const filterBulan = document.getElementById('filterBulanPakan').value;

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
            tr.innerHTML = `
                <td>${formatTanggal(p.tanggal)}</td>
                <td>${p.jenis}</td>
                <td><span class="badge ${typeBadge}">${p.tipe}</span></td>
                <td><strong>${p.jumlah.toLocaleString('id-ID')} Kg</strong></td>
                <td>${p.keterangan || '-'}</td>
                <td style="text-align: center;">
                    <button class="btn-edit" onclick="editPakan('${p.id}')">✏️</button>
                    <button class="btn-delete" onclick="deletePakan('${p.id}')">🗑️</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
}

function updateQuickStats() {
    let masuk = 0;
    let keluar = 0;
    
    dataPakan.forEach(p => {
        if (p.tipe === "Masuk") masuk += p.jumlah;
        else keluar += p.jumlah;
    });

    if(document.getElementById('totalPakanMasuk')) document.getElementById('totalPakanMasuk').innerText = masuk.toLocaleString('id-ID') + ' Kg';
    if(document.getElementById('totalPakanKeluar')) document.getElementById('totalPakanKeluar').innerText = keluar.toLocaleString('id-ID') + ' Kg';
    if(document.getElementById('sisaStokPakan')) document.getElementById('sisaStokPakan').innerText = (masuk - keluar).toLocaleString('id-ID') + ' Kg';
}

window.filterData = function() {
    renderTable();
};

window.resetFilter = function() {
    document.getElementById('filterBulanPakan').value = "";
    renderTable();
};

window.downloadLaporanCSV = function() {
    if (dataPakan.length === 0) return;
    let csv = "Tanggal,Jenis Pakan,Tipe,Jumlah (Kg),Keterangan\n";
    dataPakan.forEach(p => {
        csv += `${p.tanggal},"${p.jenis}","${p.tipe}",${p.jumlah},"${p.keterangan || ''}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Laporan_Pakan_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
};

// Sidebar
window.toggleSidebarMenu = function(id) {
    const el = document.getElementById(id);
    const isHidden = el.getAttribute('aria-hidden') === 'true';
    el.setAttribute('aria-hidden', !isHidden);
    el.previousElementSibling.setAttribute('aria-expanded', isHidden);
};
