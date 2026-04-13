/* =========================================================
   🐔 KODE SUMBER: MANAJEMEN DATA AYAM (FIREBASE FIRESTORE)
   File: dataAyamTAalip.js
   ---------------------------------------------------------
   Deskripsi singkat:
   File ini mengelola sistem penyimpanan, tampilan, perubahan, 
   dan penghapusan (CRUD) data Populasi Ayam secara dinamis 
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

// =========================================
// 1. DEKLARASI STATE (DATA AWAL)
// =========================================
let dataAyam = [];
const ayamCollection = collection(db, "populasi_ayam");

// =========================================
// 2. MODUL UTILITAS
// =========================================
function formatTanggal(tglString) {
    if (!tglString) return "-";
    const options = { day: 'numeric', month: 'short', year: 'numeric' };
    return new Date(tglString).toLocaleDateString('id-ID', options);
}

// =========================================
// 3. INISIALISASI PROGRAM & REAL-TIME LISTENER
// =========================================
document.addEventListener("DOMContentLoaded", () => {
    // Listener Real-time dari Firestore
    const q = query(ayamCollection, orderBy("tglMasuk", "desc"));
    
    onSnapshot(q, (snapshot) => {
        dataAyam = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        renderTable();
        updateQuickStats();
    }, (error) => {
        console.error("Firestore Error: ", error);
        Swal.fire("Error", "Gagal memuat data dari database: " + error.message, "error");
    });
});

/**
 * Memperbarui nilai angka-angka pada Kartu Info Statistik di atas tabel.
 */
function updateQuickStats() {
    let totalBatchAktif = 0;
    let totalPopulasi = 0;
    let setKandang = new Set();

    dataAyam.forEach(ayam => {
        if (ayam.status === 'Aktif') {
            totalBatchAktif++;
            totalPopulasi += parseInt(ayam.sisaAyam) || 0;
            if (ayam.kandang) {
                setKandang.add(ayam.kandang);
            }
        }
    });

    const elTotalBatch = document.getElementById('totalBatch');
    const elTotalPopulasi = document.getElementById('totalPopulasi');
    const elKandangTerisi = document.getElementById('kandangTerisi');

    if (elTotalBatch) elTotalBatch.innerText = totalBatchAktif;
    if (elTotalPopulasi) elTotalPopulasi.innerText = totalPopulasi.toLocaleString('id-ID') + ' Ekor';
    if (elKandangTerisi) elKandangTerisi.innerText = setKandang.size + ' Kandang';
}

/**
 * Merender daftar baris (row) ke dalam tag Tabel Body (<tbody>) HTML.
 */
function renderTable() {
    const tbody = document.getElementById("ayamTableBody");
    const emptyState = document.getElementById("emptyState");
    const tableEl = document.getElementById("ayamTable");

    if (!tbody) return;
    tbody.innerHTML = "";

    if (dataAyam.length === 0) {
        tableEl.style.display = "none";
        emptyState.style.display = "block";
    } else {
        tableEl.style.display = "table";
        emptyState.style.display = "none";

        dataAyam.forEach((ayam) => {
            let badgeClass = "badge-aktif";
            if (ayam.status === 'Panen') badgeClass = "badge-panen";
            else if (ayam.status === 'Afkir') badgeClass = "badge-afkir";

            const row = document.createElement("tr");
            row.innerHTML = `
                <td><strong>${ayam.customId || ayam.id.substring(0, 5)}</strong></td>
                <td>${formatTanggal(ayam.tglMasuk)}</td>
                <td>${ayam.jenis}</td>
                <td>${(parseInt(ayam.jumlahAwal) || 0).toLocaleString('id-ID')}</td>
                <td><strong>${(parseInt(ayam.sisaAyam) || 0).toLocaleString('id-ID')}</strong></td>
                <td>${ayam.kandang}</td>
                <td><span class="badge ${badgeClass}">${ayam.status}</span></td>
                <td>
                    <button class="btn-edit" onclick="editAyam('${ayam.id}')">✏️ Edit</button>
                    <button class="btn-delete" onclick="deleteAyam('${ayam.id}')">🗑️ Hapus</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }
}

// =========================================
// 4. LOGIKA MODAL DAN CRUD FIRESTORE
// =========================================
const modal = document.getElementById('ayamModal');
const form = document.getElementById('ayamForm');

window.openAyamModal = function() {
    form.reset();
    document.getElementById('ayamId').value = "";
    document.getElementById('modalTitle').innerText = "Tambah Batch Ayam";
    modal.classList.add('show');
};

window.closeAyamModal = function() {
    modal.classList.remove('show');
};

window.saveAyamData = async function(event) {
    event.preventDefault();

    const docId = document.getElementById('ayamId').value;
    const tglMasuk = document.getElementById('tglMasuk').value;
    const jenisAyam = document.getElementById('jenisAyam').value;
    const jumlahAwal = parseInt(document.getElementById('jumlahAwal').value) || 0;
    const sisaAyam = parseInt(document.getElementById('sisaAyam').value) || 0;
    const kandang = document.getElementById('kandang').value;
    const statusAyam = document.getElementById('statusAyam').value;

    const payload = {
        tglMasuk,
        jenis: jenisAyam,
        jumlahAwal,
        sisaAyam,
        kandang,
        status: statusAyam,
        updatedAt: new Date().toISOString()
    };

    try {
        if (docId === "") {
            // MODE TAMBAH
            const customId = "B-" + String(dataAyam.length + 1).padStart(3, '0');
            payload.customId = customId;
            payload.createdAt = new Date().toISOString();
            
            await addDoc(ayamCollection, payload);
            Swal.fire({
                icon: 'success',
                title: 'Berhasil!',
                text: 'Data batch baru berhasil ditambahkan.',
                timer: 2000,
                showConfirmButton: false
            });
        } else {
            // MODE EDIT
            const docRef = doc(db, "populasi_ayam", docId);
            await updateDoc(docRef, payload);
            Swal.fire({
                icon: 'success',
                title: 'Berhasil!',
                text: 'Data ayam diperbarui.',
                timer: 2000,
                showConfirmButton: false
            });
        }
        window.closeAyamModal();
    } catch (error) {
        console.error("Error saving document: ", error);
        Swal.fire("Error", "Gagal menyimpan data: " + error.message, "error");
    }
};

window.editAyam = function(id) {
    const ayam = dataAyam.find(a => a.id === id);
    if (ayam) {
        document.getElementById('ayamId').value = ayam.id;
        document.getElementById('tglMasuk').value = ayam.tglMasuk;
        document.getElementById('jenisAyam').value = ayam.jenis;
        document.getElementById('jumlahAwal').value = ayam.jumlahAwal;
        document.getElementById('sisaAyam').value = ayam.sisaAyam;
        document.getElementById('kandang').value = ayam.kandang;
        document.getElementById('statusAyam').value = ayam.status;

        document.getElementById('modalTitle').innerText = "Edit Batch " + (ayam.customId || "");
        modal.classList.add('show');
    }
};

window.deleteAyam = function(id) {
    Swal.fire({
        title: 'Hapus Data?',
        text: "Data batch ini akan dihapus secara permanen dari database cloud.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ff6b6b',
        cancelButtonColor: '#999',
        confirmButtonText: 'Ya, Hapus!',
        cancelButtonText: 'Batal'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                await deleteDoc(doc(db, "populasi_ayam", id));
                Swal.fire('Terhapus!', 'Data batch telah dihapus.', 'success');
            } catch (error) {
                Swal.fire("Error", "Gagal menghapus data: " + error.message, "error");
            }
        }
    });
};

window.searchTable = function() {
    const input = document.getElementById("searchAyam").value.toLowerCase();
    const rows = document.querySelectorAll("#ayamTableBody tr");

    rows.forEach(row => {
        const textContent = row.innerText.toLowerCase();
        row.style.display = textContent.includes(input) ? "" : "none";
    });
};

window.downloadLaporanCSV = function() {
    if (dataAyam.length === 0) {
        Swal.fire({ icon: 'warning', title: 'Data Kosong', text: 'Tidak ada data ayam untuk diekspor.' });
        return;
    }

    let csvContent = "ID Batch,Tanggal Masuk,Jenis Telur Ayam,Populasi Awal,Sisa Ayam,Kandang,Status\n";
    dataAyam.forEach(ayam => {
        let row = `${ayam.customId || ayam.id},${ayam.tglMasuk},${ayam.jenis},${ayam.jumlahAwal},${ayam.sisaAyam},${ayam.kandang},${ayam.status}`;
        csvContent += row + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    let date = new Date();
    let fileDate = date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate();
    link.setAttribute("download", `Laporan_Data_Ayam_${fileDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// Fungsi Sidebar (Mewarisi global jika perlu, tapi ini spesifik)
window.toggleSidebarMenu = function(submenuId) {
    const submenu = document.getElementById(submenuId);
    if (!submenu) return;
    const isHidden = submenu.getAttribute("aria-hidden") === "true";
    const parentButton = submenu.previousElementSibling;

    submenu.setAttribute("aria-hidden", !isHidden);
    parentButton.setAttribute("aria-expanded", isHidden);

    if (isHidden) {
        parentButton.classList.add("active-parent");
    } else {
        parentButton.classList.remove("active-parent");
    }
};