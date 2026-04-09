/* =========================================================
   🐔 KODE SUMBER: INPUT PRODUKSI HARIAN
   File: inputproduksi.js
   Deskripsi: Mengelola logika halaman Input Produksi harian,
   termasuk CRUD data, perhitungan statistik, dan interaksi UI.
========================================================= */

// Array global untuk menyimpan data produksi harian dari Local Storage
let dataProduksi = [];

/**
 * Mengubah format tanggal biasa (YYYY-MM-DD) menjadi format yang lebih mudah dibaca
 * Contoh: "2026-04-03" -> "3 Apr 2026"
 */
function formatTanggal(tglString) {
    if (!tglString) return "-";
    const options = { day: 'numeric', month: 'short', year: 'numeric' };
    return new Date(tglString).toLocaleDateString('id-ID', options);
}

/**
 * Event Listener yang berjalan saat halaman web selesai dimuat
 * Mengambil data dari Local Storage dan merender tabel serta statistik awal
 */
document.addEventListener("DOMContentLoaded", () => {
    // Mengecek apakah ada data produksi sebelumnya di Local Storage
    if (localStorage.getItem('produksiHarianData')) {
        dataProduksi = JSON.parse(localStorage.getItem('produksiHarianData'));
    }

    // Mengatur default filter pencarian ke tanggal hari ini (Waktu Lokal)
    // Format yang digunakan adalah YYYY-MM-DD
    const today = new Date();
    const localDateStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

    const filterEl = document.getElementById('filterTanggal');
    if (filterEl) {
        filterEl.value = localDateStr; // Masukkan nilai tanggal ke elemen input
    }

    // Tampilkan data ke tabel berdasarkan filter default
    renderTable();
    // Hitung dan perbarui kartu informasi kilat (statistik ringkas)
    updateQuickStats();
});

/**
 * Memuat daftar opsi Batch Ayam dari localStorage 'dataAyamData' ke dalam dropdown #batchProduksi.
 * Hanya menampilkan batch yang berstatus 'Aktif'.
 * @param {string} [selectedId] - ID batch yang ingin dipra-pilih (digunakan saat mode Edit)
 */
function loadBatchOptions(selectedId = '') {
    const selectEl = document.getElementById('batchProduksi');
    if (!selectEl) return;

    // Ambil data ayam dari localStorage
    const dataAyam = JSON.parse(localStorage.getItem('dataAyamData')) || [];

    // Bersihkan opsi lama, sisakan placeholder pertama
    selectEl.innerHTML = '<option value="" disabled>Pilih Batch Ayam...</option>';

    // Filter hanya ayam yang berstatus Aktif
    const dataAktif = dataAyam.filter(a => a.status === 'Aktif');

    if (dataAktif.length === 0) {
        // Jika tidak ada batch aktif, tampilkan pesan kosong
        const opt = document.createElement('option');
        opt.value = '';
        opt.disabled = true;
        opt.textContent = '-- Belum ada batch aktif di Data Ayam --';
        selectEl.appendChild(opt);
    } else {
        dataAktif.forEach(ayam => {
            const opt = document.createElement('option');
            // Nilai yang disimpan: ID batch (misal: B-001)
            opt.value = ayam.id;
            // Label yang ditampilkan: "B-001 - Remban [Kandang A (Utara)]"
            opt.textContent = `${ayam.id} - ${ayam.jenis} [${ayam.kandang}]`;
            // Simpan kandang sebagai data-attribute agar bisa di-autofill
            opt.dataset.kandang = ayam.kandang;

            if (ayam.id === selectedId) opt.selected = true;
            selectEl.appendChild(opt);
        });
    }

    // Jika tidak ada yang dipra-pilih, kembalikan placeholder ke selected
    if (!selectedId) {
        selectEl.value = '';
        selectEl.options[0].selected = true;
    }
}

/**
 * Mengunci tampilan field Tanggal, Kandang, dan Jenis Telur agar tidak bisa diubah user.
 * Dipanggil setelah batch dipilih / saat mode edit dengan batch yang sudah ada.
 */
function lockBatchFields() {
    const tglEl = document.getElementById('tglProduksi');
    const kandangEl = document.getElementById('kandangProduksi');
    const kandangHidden = document.getElementById('kandangProduksiHidden');
    const jenisEl = document.getElementById('jenisTelurProduksi');
    const tglHint = document.getElementById('tglHint');
    const kandangHint = document.getElementById('kandangHint');
    const jenisHint = document.getElementById('jenisHint');

    if (tglEl) {
        tglEl.readOnly = true;
        tglEl.style.backgroundColor = '#e2e8f0';
        tglEl.style.color = '#64748b';
        tglEl.style.cursor = 'not-allowed';
        tglEl.style.pointerEvents = 'none';
    }
    if (kandangEl) {
        // Sinkronkan nilai kandang ke hidden input sebelum men-disable
        if (kandangHidden) kandangHidden.value = kandangEl.value;
        kandangEl.disabled = true;
        kandangEl.style.backgroundColor = '#e2e8f0';
        kandangEl.style.color = '#64748b';
        kandangEl.style.cursor = 'not-allowed';
    }
    if (jenisEl) {
        jenisEl.readOnly = true;
        jenisEl.style.backgroundColor = '#e2e8f0';
        jenisEl.style.color = '#64748b';
        jenisEl.style.cursor = 'not-allowed';
        jenisEl.style.pointerEvents = 'none';
    }
    if (tglHint) tglHint.textContent = '🔒 Diisi otomatis dari batch yang dipilih';
    if (kandangHint) kandangHint.textContent = '🔒 Diisi otomatis dari batch yang dipilih';
    if (jenisHint) jenisHint.textContent = '🔒 Diisi otomatis dari batch yang dipilih';
}

/**
 * Mengosongkan dan mereset field Tanggal, Kandang, dan Jenis Telur ke state awal (terkunci-kosong).
 * Dipanggil saat modal dibuka dalam mode Tambah Baru.
 */
function unlockBatchFields() {
    const tglEl = document.getElementById('tglProduksi');
    const kandangEl = document.getElementById('kandangProduksi');
    const jenisEl = document.getElementById('jenisTelurProduksi');
    const tglHint = document.getElementById('tglHint');
    const kandangHint = document.getElementById('kandangHint');
    const jenisHint = document.getElementById('jenisHint');

    if (tglEl) {
        tglEl.readOnly = true;
        tglEl.value = '';
        tglEl.style.backgroundColor = '#e2e8f0';
        tglEl.style.color = '#64748b';
        tglEl.style.cursor = 'not-allowed';
        tglEl.style.pointerEvents = 'none';
    }
    if (kandangEl) {
        kandangEl.disabled = true;
        kandangEl.value = '';
        kandangEl.style.backgroundColor = '#e2e8f0';
        kandangEl.style.color = '#64748b';
        kandangEl.style.cursor = 'not-allowed';
    }
    if (jenisEl) {
        jenisEl.readOnly = true;
        jenisEl.value = '';
        jenisEl.style.backgroundColor = '#e2e8f0';
        jenisEl.style.color = '#64748b';
        jenisEl.style.cursor = 'not-allowed';
        jenisEl.style.pointerEvents = 'none';
    }
    if (tglHint) tglHint.textContent = '⬆️ Pilih batch terlebih dahulu';
    if (kandangHint) kandangHint.textContent = '⬆️ Pilih batch terlebih dahulu';
    if (jenisHint) jenisHint.textContent = '⬆️ Pilih batch terlebih dahulu';
}

/**
 * Mengisi otomatis field Tanggal, Kandang, dan Jenis Telur Ayam berdasarkan Batch yang dipilih,
 * kemudian mengunci ketiga field tersebut agar tidak bisa diubah manual.
 * Data diambil dari localStorage 'dataAyamData'.
 * Dipanggil oleh event onchange pada #batchProduksi.
 */
function autoFillFromBatch() {
    const selectEl = document.getElementById('batchProduksi');
    if (!selectEl || !selectEl.value) return;

    const selectedBatchId = selectEl.value;

    // Ambil data ayam dari localStorage
    const dataAyam = JSON.parse(localStorage.getItem('dataAyamData')) || [];
    const batchData = dataAyam.find(a => a.id === selectedBatchId);

    const tglEl = document.getElementById('tglProduksi');
    const kandangEl = document.getElementById('kandangProduksi');
    const jenisEl = document.getElementById('jenisTelurProduksi');

    if (batchData) {
        // Isi Tanggal dari tglMasuk batch
        if (tglEl) tglEl.value = batchData.tglMasuk || '';
        // Isi Kandang dari kandang batch
        if (kandangEl) kandangEl.value = batchData.kandang || '';
        // Isi Jenis Telur dari jenis batch (misal: Remban / Bujang)
        if (jenisEl) jenisEl.value = batchData.jenis || '';
    }

    // Kunci ketiga field setelah terisi
    lockBatchFields();
}

/**
 * Menghitung total telur (Telur Baik + Telur Cacat) secara otomatis
 * saat pengguna mengetik angka di form input
 */
function calculateTotal() {
    const baik = parseInt(document.getElementById('telurBaik').value) || 0;
    const cacat = parseInt(document.getElementById('telurCacat').value) || 0;
    document.getElementById('totalTelur').value = baik + cacat;
}

/**
 * Memperbarui angka statistik pada kartu indikator teratas
 * Hanya menghitung data yang sesuai dengan tanggal di kotak filter
 */
function updateQuickStats() {
    const filterEl = document.getElementById('filterTanggal');
    const filterTgl = filterEl ? filterEl.value : '';
    let totalTelur = 0;
    let totalBaik = 0;
    let totalCacat = 0;

    dataProduksi.forEach(prod => {
        // Jika filter tanggal diisi, hanya hitung untuk tanggal tersebut. 
        // Jika filter dikosongkan, hitung untuk semua riwayat data.
        if (!filterTgl || prod.tanggal === filterTgl) {
            totalTelur += prod.totalTelur;
            totalBaik += prod.telurBaik;
            totalCacat += prod.telurCacat;
        }
    });

    const statTelur = document.getElementById('totalTelurHariIni');
    const statBaik = document.getElementById('totalTelurBaik');
    const statCacat = document.getElementById('totalTelurCacat');

    // Menerapkan format ribuan (misal: 1000 -> 1.000)
    if (statTelur) statTelur.innerText = totalTelur.toLocaleString('id-ID') + ' Butir';
    if (statBaik) statBaik.innerText = totalBaik.toLocaleString('id-ID') + ' Butir';
    if (statCacat) statCacat.innerText = totalCacat.toLocaleString('id-ID') + ' Butir';
}

/**
 * Fungsi yang dipanggil ketika nilai pada input filter tanggal berubah
 */
function filterTable() {
    renderTable(); // Gambar ulang tabel
    updateQuickStats(); // Hitung ulang statistik
}

/**
 * Mengatur ulang filter untuk menampilkan seluruh silsilah data tanpa batas tanggal
 */
function resetFilter() {
    document.getElementById('filterTanggal').value = '';
    filterTable();
}

/**
 * Fungsi inti untuk menggambar ulang (merender) baris tabel sesuai data terkini
 */
function renderTable() {
    const tbody = document.getElementById("produksiTableBody");
    const emptyState = document.getElementById("emptyState");
    const tableEl = document.getElementById("produksiTable");
    const filterEl = document.getElementById('filterTanggal');

    // Pemeriksaan keamanan untuk mencegah error jika dipanggil sebelum elemen siap
    if (!tbody || !emptyState || !tableEl) return;

    const filterTgl = filterEl ? filterEl.value : '';

    // Kosongkan isi tabel HTML sebelum menggambar data baru
    tbody.innerHTML = "";

    // Saring data menyesuaikan tanggal (Bila tidak ada filter, semua terambil)
    const filteredData = dataProduksi.filter(prod => !filterTgl || prod.tanggal === filterTgl);

    // Jika kosong, sembunyikan tabel dan tampilkan gambar indikator kosong
    if (filteredData.length === 0) {
        tableEl.style.display = "none";
        emptyState.style.display = "block";
    } else {
        tableEl.style.display = "table";
        emptyState.style.display = "none";

        // Tulis baris tabel untuk setiap item dalam data
        filteredData.forEach((prod) => {
            const row = document.createElement("tr");

            // Konstruksi sel tabel
            row.innerHTML = `
                <td>${formatTanggal(prod.tanggal)}</td>
                <td><span style="background:#6366f1;color:white;padding:3px 8px;border-radius:8px;font-size:0.82em;font-weight:600;">${prod.batchId || '-'}</span></td>
                <td><span style="background:#f59e0b;color:white;padding:3px 8px;border-radius:8px;font-size:0.82em;font-weight:600;">${prod.jenisTelur || '-'}</span></td>
                <td><strong>${prod.kandang}</strong></td>
                <td><span class="badge badge-aktif" style="background:#10b981;color:white;padding:5px 10px;border-radius:12px;">${prod.telurBaik.toLocaleString('id-ID')}</span></td>
                <td><span class="badge badge-afkir" style="background:#ef4444;color:white;padding:5px 10px;border-radius:12px;">${prod.telurCacat.toLocaleString('id-ID')}</span></td>
                <td><strong>${prod.totalTelur.toLocaleString('id-ID')}</strong></td>
                <td>
                    <button class="btn-edit" onclick="editProduksi('${prod.id}')" style="background:#3b82f6;color:white;border:none;padding:5px 10px;border-radius:5px;cursor:pointer;">✏️ Edit</button>
                    <button class="btn-delete" onclick="deleteProduksi('${prod.id}')" style="background:#ef4444;color:white;border:none;padding:5px 10px;border-radius:5px;cursor:pointer;">🗑️ Hapus</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }
}

/**
 * Membuka jendela pop-up (Modal) untuk menambah produksi
 */
function openProduksiModal() {
    const form = document.getElementById('produksiForm');
    const modal = document.getElementById('produksiModal');

    // Kosongkan form dari riwayat isian sebelumnya
    if (form) form.reset();
    document.getElementById('produksiId').value = ""; // Pastikan form dalam mode Tambah Baru

    // Muat opsi batch dari Data Ayam (hanya yang Aktif)
    loadBatchOptions();

    // Kembalikan field Tanggal & Kandang ke state terkunci-kosong (menunggu pilihan batch)
    unlockBatchFields();

    document.getElementById('modalTitle').innerText = "Tambah Data Produksi";
    if (modal) modal.classList.add('show');
}

/**
 * Menutup jendela pop-up (Modal)
 */
function closeProduksiModal() {
    const modal = document.getElementById('produksiModal');
    if (modal) modal.classList.remove('show');
}

/**
 * Fungsi untuk Menambahkan Data Baru, atau Menimpa Data yang sedang diedit (Simpan/Update)
 */
function saveProduksiData(event) {
    event.preventDefault(); // Mencegah reload halaman gara-gara sifat dasar form submit

    // Mengambil nilai komponen dari form input HTML
    const idInput = document.getElementById('produksiId').value;
    const tanggal = document.getElementById('tglProduksi').value;
    const batchEl = document.getElementById('batchProduksi');
    const batchId = batchEl ? batchEl.value : '';
    // Ambil label batch yang tampil (misal: "B-001 - Remban [Kandang A]")
    const batchLabel = batchEl && batchEl.selectedIndex >= 0
        ? batchEl.options[batchEl.selectedIndex].textContent
        : batchId;
    // Baca kandang dari hidden input (aman dari disabled) dengan fallback ke select
    const kandangHidden = document.getElementById('kandangProduksiHidden');
    const kandangSelect = document.getElementById('kandangProduksi');
    const kandang = (kandangHidden && kandangHidden.value)
        ? kandangHidden.value
        : (kandangSelect ? kandangSelect.value : '');
    const telurBaik = parseInt(document.getElementById('telurBaik').value) || 0;
    const telurCacat = parseInt(document.getElementById('telurCacat').value) || 0;
    const totalTelur = telurBaik + telurCacat;
    // Ambil jenis telur dari field readonly (sudah terisi dari batch)
    const jenisTelur = document.getElementById('jenisTelurProduksi')
        ? document.getElementById('jenisTelurProduksi').value
        : '';
    const beratTotalEl = document.getElementById('beratTotal');
    const beratTotal = beratTotalEl ? (parseFloat(beratTotalEl.value) || 0) : 0;

    // Jika tidak ada ID tertanam di form, bearti ini pembuatan Data Baru
    if (idInput === "") {
        // Buat ID unik menunggangi cap waktu saat ini (Timestamp)
        const newId = "PRD-" + Date.now();
        dataProduksi.push({
            id: newId,
            tanggal,
            batchId,
            batchLabel,
            jenisTelur,       // Jenis telur dari batch (misal: Remban / Bujang)
            kandang,
            telurBaik,
            telurCacat,
            totalTelur,
            beratTotal
        });

        // Luncurkan notifikasi hijau tanda kesuksesan
        Swal.fire({
            icon: 'success',
            title: 'Berhasil!',
            text: 'Data produksi berhasil ditambahkan.',
            timer: 2000,
            showConfirmButton: false
        });
    } else {
        // Mode Perbaikan (Update), cari mana data aslinya di dalam array lalu timpa nilainya
        const index = dataProduksi.findIndex(p => p.id === idInput);
        if (index > -1) {
            dataProduksi[index] = {
                id: idInput,
                tanggal,
                batchId,
                batchLabel,
                jenisTelur,
                kandang,
                telurBaik,
                telurCacat,
                totalTelur,
                beratTotal
            };
        }

        // Notifikasi pembaruan sukses
        Swal.fire({
            icon: 'success',
            title: 'Berhasil!',
            text: 'Data produksi diperbarui.',
            timer: 2000,
            showConfirmButton: false
        });
    }

    // Peringkas seluruh data kembali masuk ke penyimpanan lokal browser (Local Storage)
    localStorage.setItem('produksiHarianData', JSON.stringify(dataProduksi));

    // Sinkronasikan filter pencarian tabel ke tanggal yang baru diinput/diedit agar pasti terlihat
    document.getElementById('filterTanggal').value = tanggal;

    closeProduksiModal(); // Tutup Form
    renderTable(); // Rapikan data di tabel
    updateQuickStats(); // Segarkan statistik atas
}

/**
 * Menyiapkan form input dalam Mode Edit sesuai dengan data yang ditunjuk (ID)
 */
function editProduksi(id) {
    const prod = dataProduksi.find(p => p.id === id); // Cari data
    if (prod) {
        // Muat opsi batch terlebih dahulu dengan batch yang tersimpan ter-pra-pilih
        loadBatchOptions(prod.batchId || '');

        // Tuangkan isi datanya ke form isian
        document.getElementById('produksiId').value = prod.id;
        document.getElementById('tglProduksi').value = prod.tanggal;
        document.getElementById('telurBaik').value = prod.telurBaik;
        document.getElementById('telurCacat').value = prod.telurCacat;
        document.getElementById('totalTelur').value = prod.totalTelur;

        const beratTotalEl = document.getElementById('beratTotal');
        if (beratTotalEl) beratTotalEl.value = prod.beratTotal;

        // Isi kandang dan jenis telur setelah opsi dimuat, lalu kunci semua field
        const kandangEl = document.getElementById('kandangProduksi');
        if (kandangEl) kandangEl.value = prod.kandang;
        const jenisEl = document.getElementById('jenisTelurProduksi');
        if (jenisEl) jenisEl.value = prod.jenisTelur || '';
        lockBatchFields();

        // Ubah Judul modal untuk memberitahu user ini form Update
        document.getElementById('modalTitle').innerText = "Edit Produksi";
        const modal = document.getElementById('produksiModal');
        if (modal) modal.classList.add('show');
    }
}

/**
 * Menghapus entri khusus dengan memunculkan validasi tanya jawab ganda (Swal Fire)
 */
function deleteProduksi(id) {
    Swal.fire({
        title: 'Hapus Data?',
        text: "Data produksi akan dihapus secara permanen.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ff6b6b',
        cancelButtonColor: '#999',
        confirmButtonText: 'Ya, Hapus!',
        cancelButtonText: 'Batal'
    }).then((result) => {
        // Hanya menghapus apabila tombol merah penegas diklik
        if (result.isConfirmed) {
            // Saring array dengan meninggalkan item ber-ID tersebut
            dataProduksi = dataProduksi.filter(p => p.id !== id);
            localStorage.setItem('produksiHarianData', JSON.stringify(dataProduksi)); // Timpa lokal storage yang lama

            renderTable(); // Update Tabel
            updateQuickStats(); // Update Statistik Total
            Swal.fire('Terhapus!', 'Data produksi telah dihapus.', 'success');
        }
    });
}

// =========================================
// FITUR NAVIGASI UI DAN PENGATURAN LAINNYA
// =========================================

/**
 * Fungsi untuk melipat atau mekarkan anak-menu di lajur samping (Sidebar)
 */
function toggleSidebarMenu(submenuId) {
    const submenu = document.getElementById(submenuId);
    if (submenu.classList.contains('show')) {
        submenu.classList.remove('show');
    }
    const isHidden = submenu.getAttribute("aria-hidden") === "true";
    const parentButton = submenu.previousElementSibling;

    submenu.setAttribute("aria-hidden", !isHidden);
    parentButton.setAttribute("aria-expanded", isHidden);

    if (isHidden) {
        parentButton.classList.add("active-parent");
    } else {
        parentButton.classList.remove("active-parent");
    }
}

/**
 * Melempar pop-up pemberitahuan karena fitur halaman Profil belumlah disedikan
 */
function goToProfile() {
    Swal.fire({
        icon: 'info',
        title: 'Profil',
        text: 'Fitur belum diimplementasikan 🐔',
        confirmButtonColor: '#fb8500'
    });
}

/**
 * Konfirmasi pengguna sebelum mengusir sesi keluar balik ke login
 */
function logoutUser() {
    Swal.fire({
        title: "Yakin ingin logout?",
        icon: "warning",
        showCancelButton: true,
        text: "Aksi akan mengeluarkan Anda.",
        confirmButtonColor: "#d33",
        cancelButtonColor: "#3085d6",
        confirmButtonText: "Logout"
    }).then((result) => {
        // Melompat ke halaman Login jika memang 'ya'
        if (result.isConfirmed) {
            window.location.href = "login.html";
        }
    });
}

/**
 * Mengunduh (download) laporan produksi harian dalam bentuk file CSV.
 */
function downloadLaporanCSV() {
    if (dataProduksi.length === 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Data Kosong',
            text: 'Tidak ada data produksi untuk diekspor.',
            confirmButtonColor: '#fb8500'
        });
        return;
    }

    // Header untuk file CSV
    let csvContent = "ID,Tanggal,Batch,Jenis Telur,Kandang,Telur Baik,Telur Cacat,Total Telur\n";

    // Loop data untuk mengisi baris CSV
    dataProduksi.forEach(prod => {
        // Gabungkan nilai object ke dalam satu string baris dengan koma
        let row = `${prod.id},${prod.tanggal},${prod.batchId || '-'},${prod.jenisTelur || '-'},${prod.kandang},${prod.telurBaik},${prod.telurCacat},${prod.totalTelur}`;
        csvContent += row + "\n";
    });

    // Buat Blob objek dari string
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

    // Buat elemen anchor pemandu unduhan
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);

    // Penamaan file dinamis
    let date = new Date();
    let fileDate = date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate();
    link.setAttribute("download", `Laporan_Produksi_${fileDate}.csv`);

    // Gantungkan di dokumen lalu simulasikan klik otomatis 
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();

    // Bersihkan kembali
    document.body.removeChild(link);

    // Pesan sukses
    Swal.fire({
        icon: 'success',
        title: 'Sukses',
        text: 'File Laporan CSV berhasil diunduh.',
        timer: 2000,
        showConfirmButton: false
    });
}
