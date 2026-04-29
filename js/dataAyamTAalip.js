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
let dataKesehatan = [];
const ayamCollection = collection(db, "populasi_ayam");
const kesehatanCollection = collection(db, "kesehatan_ayam");

// =========================================
// 2. MODUL UTILITAS
// =========================================
/**
 * Fungsi utilitas untuk memformat string tanggal menjadi format Indonesia yang mudah dibaca
 * @param {string} tglString - String tanggal format ISO (YYYY-MM-DD)
 * @returns {string} Tanggal terformat (Contoh: 1 Jan 2024)
 */
function formatTanggal(tglString) {
    if (!tglString) return "-";
    const options = { day: 'numeric', month: 'short', year: 'numeric' };
    return new Date(tglString).toLocaleDateString('id-ID', options);
}

// =========================================
// 3. INISIALISASI PROGRAM & REAL-TIME LISTENER
// =========================================
document.addEventListener("DOMContentLoaded", () => {
    // Listener Real-time dari Firestore untuk Data Ayam
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

    // Listener Real-time dari Firestore untuk Data Kesehatan (untuk hitung ayam sakit)
    onSnapshot(kesehatanCollection, (snapshot) => {
        dataKesehatan = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        updateQuickStats();
    }, (error) => {
        console.error("Firestore Error (Kesehatan): ", error);
    });
});

/**
 * Memperbarui nilai angka-angka pada Kartu Info Statistik di atas tabel.
 * @param {Array} filteredData - Data yang sudah difilter (opsional)
 */
function updateQuickStats(filteredData = null) {
    const dataToCalculate = filteredData || dataAyam;
    let totalBatchAktif = 0;
    let totalSisaAyam = 0;
    let setKandang = new Set();

    dataToCalculate.forEach(ayam => {
        const status = (ayam.status || "").trim().toLowerCase();
        // Menghitung batch aktif dan populasi ayam yang masih ada di kandang
        if (status === 'aktif') {
            totalBatchAktif++;
            totalSisaAyam += parseInt(ayam.sisaAyam) || 0;
            if (ayam.kandang) {
                setKandang.add(ayam.kandang);
            }
        }
    });

    // Hitung total ayam sakit (Dalam Perawatan) dari data kesehatan
    const ayamSakit = dataKesehatan.filter(x => x.status === "Dalam Perawatan")
                                   .reduce((sum, item) => sum + (parseInt(item.jmlSakit) || 0), 0);
    
    // Total Populasi Ayam Aktif Sehat = Sisa Ayam - Ayam Sakit
    const totalPopulasiSehat = totalSisaAyam - ayamSakit;

    const elTotalBatch = document.getElementById('totalBatch');
    const elTotalPopulasi = document.getElementById('totalPopulasi');
    const elKandangTerisi = document.getElementById('kandangTerisi');

    if (elTotalBatch) elTotalBatch.innerText = totalBatchAktif;
    
    // Tampilkan total populasi sehat (sudah dikurangi ayam sakit)
    if (elTotalPopulasi) {
        let displayText = totalPopulasiSehat.toLocaleString('id-ID') + ' Ekor';
        if (ayamSakit > 0) {
            displayText += ` (${ayamSakit.toLocaleString('id-ID')} Sakit)`;
        }
        elTotalPopulasi.innerText = displayText;
    }
    
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
            // Normalisasi status untuk penentuan class badge
            const statusNormal = (ayam.status || "").trim().toLowerCase();
            let badgeClass = "badge-default"; // Class cadangan jika status tidak dikenal
            
            if (statusNormal === 'aktif') badgeClass = "badge-aktif";
            else if (statusNormal === 'panen') badgeClass = "badge-panen";
            else if (statusNormal === 'afkir') badgeClass = "badge-afkir";

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

/**
 * Membuka jendela modal untuk menambah data batch ayam baru
 */
window.openAyamModal = function() {
    form.reset(); // Bersihkan formulir
    document.getElementById('ayamId').value = ""; // Pastikan ID kosong (Mode Tambah)
    document.getElementById('modalTitle').innerText = "Tambah Batch Ayam";
    
    // Otomatisasi sisaAyam agar mengikuti jumlahAwal saat pertama kali diinput
    const inputAwal = document.getElementById('jumlahAwal');
    const inputSisa = document.getElementById('sisaAyam');
    
    inputAwal.addEventListener('input', () => {
        if (document.getElementById('ayamId').value === "") { // Hanya saat tambah baru
            inputSisa.value = inputAwal.value;
        }
    });

    modal.classList.add('show'); // Tampilkan modal dengan class CSS
};

/**
 * Menutup jendela modal data ayam
 */
window.closeAyamModal = function() {
    modal.classList.remove('show');
};

/**
 * Menyimpan data ayam ke Firestore (Bisa mode Tambah Baru atau Edit)
 */
window.saveAyamData = async function(event) {
    event.preventDefault(); // Mencegah reload halaman

    // Menangkap nilai-nilai dari input form
    const docId = document.getElementById('ayamId').value;
    const tglMasuk = document.getElementById('tglMasuk').value;
    const jenisAyam = document.getElementById('jenisAyam').value;
    const jumlahAwal = parseInt(document.getElementById('jumlahAwal').value) || 0;
    const sisaAyam = parseInt(document.getElementById('sisaAyam').value) || 0;
    const kandang = document.getElementById('kandang').value;
    const statusAyam = document.getElementById('statusAyam').value;

    // Objek paket data (payload) yang akan dikirim ke database
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
            // LOGIKA MODE TAMBAH BARU
            // ✅ FIX: Gunakan timestamp + counter aman (bukan length-based yang rawan duplikat)
            // Format: B-YYYYMMDD-XXX (aman karena berbasis waktu)
            const now = new Date();
            const dateStr = now.getFullYear().toString() +
                String(now.getMonth() + 1).padStart(2, '0') +
                String(now.getDate()).padStart(2, '0');
            const randomSuffix = String(Math.floor(Math.random() * 900) + 100); // 3 digit random
            const customId = `B-${dateStr}-${randomSuffix}`;
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
            // LOGIKA MODE EDIT/UPDATE DATA LAMA
            const docRef = doc(db, "populasi_ayam", docId);
            await updateDoc(docRef, payload); // Perbarui dokumen di Firestore
            Swal.fire({
                icon: 'success',
                title: 'Berhasil!',
                text: 'Data ayam diperbarui.',
                timer: 2000,
                showConfirmButton: false
            });
        }
        window.closeAyamModal(); // Tutup modal setelah sukses
    } catch (error) {
        console.error("Error saving document: ", error);
        Swal.fire("Error", "Gagal menyimpan data: " + error.message, "error");
    }
};

/**
 * Mengisi formulir modal dengan data ayam yang dipilih untuk diedit
 * @param {string} id - UID dokumen Firestore
 */
window.editAyam = function(id) {
    const ayam = dataAyam.find(a => a.id === id); // Cari data di memori lokal (state)
    if (ayam) {
        // Prefill kolom-kolom form
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

/**
 * Menghapus data batch ayam secara permanen dari Firestore
 * @param {string} id - UID dokumen Firestore
 */
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
                await deleteDoc(doc(db, "populasi_ayam", id)); // Hapus dari Firestore
                Swal.fire('Terhapus!', 'Data batch telah dihapus.', 'success');
            } catch (error) {
                Swal.fire("Error", "Gagal menghapus data: " + error.message, "error");
            }
        }
    });
};

/**
 * Fitur pencarian cepat di tabel (Client-side filtering)
 * Juga memperbarui kartu statistik agar sesuai dengan data yang tampil
 */
window.searchTable = function() {
    const input = document.getElementById("searchAyam").value.toLowerCase();
    const rows = document.querySelectorAll("#ayamTableBody tr");
    
    // Simpan data yang cocok dengan pencarian untuk update stats
    const filteredResults = [];

    rows.forEach((row, index) => {
        const textContent = row.innerText.toLowerCase();
        const isMatch = textContent.includes(input);
        row.style.display = isMatch ? "" : "none";
        
        if (isMatch) {
            filteredResults.push(dataAyam[index]);
        }
    });

    // Update kartu statistik berdasarkan hasil pencarian
    updateQuickStats(filteredResults);
};

/**
 * Mengunduh seluruh ringkasan data ayam dalam format berkas CSV
 */
window.downloadLaporanCSV = function() {
    if (dataAyam.length === 0) {
        Swal.fire({ icon: 'warning', title: 'Data Kosong', text: 'Tidak ada data ayam untuk diekspor.' });
        return;
    }

    // Header Tabel CSV
    let csvContent = "ID Batch,Tanggal Masuk,Jenis Telur Ayam,Populasi Awal,Sisa Ayam,Kandang,Status\n";
    
    // Looping data menjadi baris teks CSV
    dataAyam.forEach(ayam => {
        let row = `${ayam.customId || ayam.id},${ayam.tglMasuk},${ayam.jenis},${ayam.jumlahAwal},${ayam.sisaAyam},${ayam.kandang},${ayam.status}`;
        csvContent += row + "\n";
    });

    // Proses download browser
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