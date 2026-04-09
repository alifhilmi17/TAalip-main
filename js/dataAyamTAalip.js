/* =========================================================
   🐔 KODE SUMBER: MANAJEMEN DATA AYAM (CRUD INVENTARIS)
   File: dataAyamTAalip.js
   ---------------------------------------------------------
   Deskripsi singkat:
   File ini mendemonstrasikan kapabilitas aplikasi dalam 
   menyimpan, menampilkan, mengubah, dan menghapus (CRUD)
   data Populasi Ayam secara dinamis. State management array
   data dimuat secara sinkronus bersama LocalStorage.
========================================================= */

// =========================================
// 1. DEKLARASI STATE (DATA AWAL)
// Penjelasan: Variabel global yang bertindak sebagai "Tabel Database" virtual (Array of Objects).
// =========================================

// Data Dummy Awal yang merepresentasikan struktur data batch ayam.
// Berfungsi untuk menguji purwarupa aplikasi jika belum ada interaksi nyata sbelumnya.
let dataAyam = [];

// =========================================
// 2. MODUL UTILITAS (FUNGSI PEMBANTU GLOBAL)
// Penjelasan: Modul fungsional murni (pure functions) yang dapat digunakan 
// berulang untuk konversi tipe data atau format tampilan antarmuka.
// =========================================

/**
 * Format Tanggal menjadi string lokal bahasa Indonesia (misal: 10 Jan 2026).
 * @param {string} tglString - String tanggal dengan format YYYY-MM-DD
 * @returns {string} String tanggal terformat
 */
function formatTanggal(tglString) {
    const options = { day: 'numeric', month: 'short', year: 'numeric' };
    return new Date(tglString).toLocaleDateString('id-ID', options);
}

// =========================================
// 3. INISIALISASI PROGRAM & TAMPILAN (LIFECYCLE)
// Penjelasan: Titik masuk utama berjalannya script (Siklus Hidup Awal). 
// Proses rendering Tabel dan perhitungan Statistik di-trigger dari sini.
// =========================================

// Berjalan otomatis saat dokumen HTML selesai diload.
document.addEventListener("DOMContentLoaded", () => {
    // Mengecek apakah terdapat data tersimpan di LocalStorage dengan key 'dataAyamData'.
    // Jika ada, timpa variabel dummy 'dataAyam' dengan data dari localStorage.
    if (localStorage.getItem('dataAyamData')) {
        dataAyam = JSON.parse(localStorage.getItem('dataAyamData'));

        // Migrasi otomatis: konversi nilai jenis lama ke standar baru "Remban" / "Bujang"
        // agar data tersimpan sebelumnya tetap tampil dengan benar di tabel.
        let perluUpdate = false;
        dataAyam = dataAyam.map(ayam => {
            if (ayam.jenis === 'Petelur (Layer)' || ayam.jenis === 'Ayam Petelur (Remban)') {
                perluUpdate = true;
                return { ...ayam, jenis: 'Remban' };
            }
            if (ayam.jenis === 'Pedaging (Broiler)' || ayam.jenis === 'Ayam Pedaging (Bujang)') {
                perluUpdate = true;
                return { ...ayam, jenis: 'Bujang' };
            }
            return ayam;
        });

        // Simpan kembali jika ada perubahan hasil migrasi
        if (perluUpdate) {
            localStorage.setItem('dataAyamData', JSON.stringify(dataAyam));
        }
    }
    // Render ulang tabel ke HTML
    renderTable();
    // Update dashboard kartu stastistik kecil di atas (Quick Stats)
    updateQuickStats();
});

/**
 * Memperbarui nilai angka-angka pada Kartu Info Statistik di atas tabel.
 * Menghitung otomatis total batch aktif, populasi sisa, dan jumlah kandang terisi.
 * Dipanggil setiap kali data ditambah, diedit, atau dihapus agar kartu selalu sinkron.
 */
function updateQuickStats() {
    let totalBatchAktif = 0;
    let totalPopulasi = 0;

    // Set (Himpunan Matematika) agar kandang yang sama tidak dihitung dua kali
    // jika ada lebih dari 1 batch aktif di kandang yang sama.
    let setKandang = new Set();

    // Iterasi semua data untuk menghitung hanya yang berstatus 'Aktif'
    dataAyam.forEach(ayam => {
        if (ayam.status === 'Aktif') {
            totalBatchAktif++;
            totalPopulasi += parseInt(ayam.sisaAyam) || 0;

            if (ayam.kandang) {
                setKandang.add(ayam.kandang);
            }
        }
    });

    // Tulis hasil kalkulasi ke elemen HTML kartu statistik
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
    const emptyState = document.getElementById("emptyState"); // Elemen jika text kosong
    const tableEl = document.getElementById("ayamTable");

    // Bersihkan semua baris lama yang ada di dalam HTML <tbody>
    tbody.innerHTML = "";

    // Pengecekan ada tidaknya data di dalam list array
    if (dataAyam.length === 0) {
        // Jika data kosong, sembunyikan tabel dan tampilkan gambar Empty State
        tableEl.style.display = "none";
        emptyState.style.display = "block";
    } else {
        // Jika data ada, pastikan tabel tampil dan embpty state tersembunyi
        tableEl.style.display = "table";
        emptyState.style.display = "none";

        // Tambahkan baris per elemen data ayam
        dataAyam.forEach((ayam) => {


            // Logika pewarnaan status lencana (badge)
            let badgeClass = "badge-aktif";
            if (ayam.status === 'Panen') badgeClass = "badge-panen";
            else if (ayam.status === 'Afkir') badgeClass = "badge-afkir";

            const row = document.createElement("tr");

            // Konstruksi sel string HTML secara dinamis
            row.innerHTML = `
                <td><strong>${ayam.id}</strong></td>
                <td>${formatTanggal(ayam.tglMasuk)}</td>
                <td>${ayam.jenis}</td>
                <td>${ayam.jumlahAwal.toLocaleString('id-ID')}</td>
                <td><strong>${ayam.sisaAyam.toLocaleString('id-ID')}</strong></td>
                <td>${ayam.kandang}</td>
                <td><span class="badge ${badgeClass}">${ayam.status}</span></td>
                <td>
                    <!-- Parameter memakai single quotes agar passing ID string berjalan benar -->
                    <button class="btn-edit" onclick="editAyam('${ayam.id}')">✏️ Edit</button>
                    <button class="btn-delete" onclick="deleteAyam('${ayam.id}')">🗑️ Hapus</button>
                </td>
            `;
            tbody.appendChild(row); // Pasangkan baris ini ke dalam tabel
        });
    }

    // Perbarui kartu statistik setiap kali tabel selesai dirender
    updateQuickStats();
}

/**
 * Logika Pencarian Tabel.
 * Menyembunyikan baris <tr> mana saja yang tidak cocok dengan input teks pengguna.
 */
function searchTable() {
    const input = document.getElementById("searchAyam").value.toLowerCase();
    const rows = document.querySelectorAll("#ayamTableBody tr");

    // Lakukan filter visual untuk tiap baris
    rows.forEach(row => {
        // Gabungkan seluruh teks yang ada di dalam 1 baris tr
        const textContent = row.innerText.toLowerCase();

        // Cek secara kasar apakah string dari input terdapat di dalam baris
        row.style.display = textContent.includes(input) ? "" : "none";
    });
}

// =========================================
// 4. LOGIKA MODAL POP-UP DAN FUNGSI CRUD INTI
// Penjelasan: Seluruh algoritma pengubahan data berpusat di sini,
// dari validasi Masukan (Form Input), Generate ID Otomatis (Auto Increment-like),
// hingga pemotongan array (Delete).
// =========================================

// Deklarasi element global untuk modal dan form
const modal = document.getElementById('ayamModal');
const form = document.getElementById('ayamForm');

/**
 * Menampilkan Modal untuk menambah Batch Ayam Baru.
 */
function openAyamModal() {
    form.reset(); // Kosongkan form dari isian lama
    // Penting: Mengosongkan value ID tak terlihat (hidden) merupakan pertanda bahwa form ini adalah "Mode Tambah" bukan "Mode Edit"
    document.getElementById('ayamId').value = "";
    document.getElementById('modalTitle').innerText = "Tambah Batch Ayam";
    modal.classList.add('show');
}

/**
 * Menutup dan menyembunyikan modal.
 */
function closeAyamModal() {
    modal.classList.remove('show');
}

/**
 * Handles action ketika tombol "Simpan" dipencet dari dalam modal.
 * Mampu bekerja sebagai "Tambah Baru" ataupun "Edit Lama" tergantung pada nilai idInput.
 */
function saveAyamData(event) {
    event.preventDefault(); // Mencegah reload halaman klasik

    // Mengambil Value / Isi yang diketik dari semua input fields
    const idInput = document.getElementById('ayamId').value;
    const tglMasuk = document.getElementById('tglMasuk').value;
    const jenisAyam = document.getElementById('jenisAyam').value;
    const jumlahAwal = document.getElementById('jumlahAwal').value;
    const sisaAyam = document.getElementById('sisaAyam').value;
    const kandang = document.getElementById('kandang').value;
    const statusAyam = document.getElementById('statusAyam').value;

    if (idInput === "") {
        // ===== MODE TAMBAH =====
        // Membuat string ID baru Otomatis bertipe (misal B-003, B-004) berdasarkan panjang data terakhir
        const nextNum = dataAyam.length + 1;
        const newId = "B-" + String(nextNum).padStart(3, '0');

        // Push object baru ke dalam data keseluruhan
        dataAyam.push({
            id: newId,
            tglMasuk,
            jenis: jenisAyam,
            jumlahAwal: parseInt(jumlahAwal),
            sisaAyam: parseInt(sisaAyam), // Pastikan konversi ke tipe Integer
            kandang,
            status: statusAyam
        });

        // Tampilkan feedback manis dengan Swal (SweetAlert)
        Swal.fire({
            icon: 'success',
            title: 'Berhasil!',
            text: 'Data batch ' + newId + ' berhasil ditambahkan.',
            timer: 2000,
            showConfirmButton: false
        });
    } else {
        // ===== MODE EDIT =====
        // Mencari index letak data ayam yang ID-nya sama dengan idInput
        const index = dataAyam.findIndex(a => a.id === idInput);

        if (index > -1) {
            // Replace / Timpa objek pada index tersebut dengan data baru dari form
            dataAyam[index] = {
                id: idInput,
                tglMasuk,
                jenis: jenisAyam,
                jumlahAwal: parseInt(jumlahAwal),
                sisaAyam: parseInt(sisaAyam),
                kandang,
                status: statusAyam
            };
        }

        Swal.fire({
            icon: 'success',
            title: 'Berhasil!',
            text: 'Data ayam diperbarui.',
            timer: 2000,
            showConfirmButton: false
        });
    }

    // Simpan data terbaru dari Array JS ke dalam localStorage browser agar menjadi awet
    localStorage.setItem('dataAyamData', JSON.stringify(dataAyam));

    // Tutup popup lalu gambar ulang tabel beserta statistiknya
    closeAyamModal();
    renderTable();
    updateQuickStats();
}

/**
 * Menampilkan Modal yang berisi nilai-nilai lama dari data spesifik yang hendak Diedit.
 * @param {string} id - Identifier unik (Contoh: "B-001")
 */
function editAyam(id) {
    // Cari objek ayam mana yang cocok di dalam array
    const ayam = dataAyam.find(a => a.id === id);
    if (ayam) {
        // Set up nilai di dalam form element sebelum menampilkan modal
        document.getElementById('ayamId').value = ayam.id; // Menyisipkan ID ke hidden state sebagai mode Edit
        document.getElementById('tglMasuk').value = ayam.tglMasuk;
        document.getElementById('jenisAyam').value = ayam.jenis;
        document.getElementById('jumlahAwal').value = ayam.jumlahAwal;
        document.getElementById('sisaAyam').value = ayam.sisaAyam;
        document.getElementById('kandang').value = ayam.kandang;
        document.getElementById('statusAyam').value = ayam.status;

        document.getElementById('modalTitle').innerText = "Edit Batch " + ayam.id;
        modal.classList.add('show'); // Memaksa Modal Tampil
    }
}

/**
 * Menghapus 1 baris objek data ayam setelah konfirmasi pengguna.
 * @param {string} id - Identifier unik (Contoh: "B-001")
 */
function deleteAyam(id) {
    Swal.fire({
        title: 'Hapus Data?',
        text: "Data batch " + id + " akan dihapus secara permanen.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ff6b6b',
        cancelButtonColor: '#999',
        confirmButtonText: 'Ya, Hapus!',
        cancelButtonText: 'Batal'
    }).then((result) => {
        if (result.isConfirmed) {
            // Hapus isi array dengan mem-filter agar isinya hanya objek ayam yg tidak sama dengan ID penghapusan. (Metode Non-Destructive)
            dataAyam = dataAyam.filter(a => a.id !== id);

            // Timpa memori local storage dengan array terbaru
            localStorage.setItem('dataAyamData', JSON.stringify(dataAyam));

            // Gambar ulang tampilan user
            renderTable();
            updateQuickStats();

            Swal.fire(
                'Terhapus!',
                'Data batch telah dihapus.',
                'success'
            )
        }
    });
}


/**
 * Fungsi untuk membuka atau menutup (toggle) submenu pada sidebar.
 * Mengubah atribut aria-hidden dan aria-expanded untuk aksesibilitas,
 * serta menambah class 'active-parent' agar tombol terlihat disorot aktif.
 * @param {string} submenuId - ID elemen submenu yang akan di-toggle
 */
function toggleSidebarMenu(submenuId) {
    const submenu = document.getElementById(submenuId);

    // Jika ada class 'show', hapus saja karena kita percayakan pada aria-hidden untuk logic CSS
    if (submenu.classList.contains('show')) {
        submenu.classList.remove('show');
    }

    const isHidden = submenu.getAttribute("aria-hidden") === "true";
    const parentButton = submenu.previousElementSibling;

    // Toggle visibilitas submenu
    submenu.setAttribute("aria-hidden", !isHidden);
    // Mengubah state expanded pada elemen trigger (tombol/link parent)
    parentButton.setAttribute("aria-expanded", isHidden);

    // Tambahkan visual terang pada tombol induk bila menu terbuka
    if (isHidden) {
        parentButton.classList.add("active-parent");
    } else {
        parentButton.classList.remove("active-parent");
    }
}

/**
 * Fungsi untuk menangani aksi klik pada tombol/menu profil.
 * Saat ini menampilkan pop-up informasi menggunakan SweetAlert2.
 */
function goToProfile() {
    Swal.fire({
        icon: 'info',
        title: 'Profil Pengguna',
        text: 'Fitur profil belum diimplementasikan 🐔',
        confirmButtonColor: '#fb8500' // Warna oranye khas tema
    });
}

/**
 * Fungsi untuk menangani proses logout pengguna.
 * Menampilkan konfirmasi pop-up sebelum mengarahkan ke halaman login.
 */
function logoutUser() {
    Swal.fire({
        title: "Yakin ingin logout?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Ya, logout",
        cancelButtonText: "Batal",
        confirmButtonColor: "#d33", // Warna merah untuk aksi destruktif
        cancelButtonColor: "#3085d6" // Warna biru untuk batal
    }).then((result) => {
        if (result.isConfirmed) {
            // Jika user menekan "Ya, logout", redirect ke halaman login
            window.location.href = "login.html";
        }
    });
}

/**
 * Mengunduh (download) laporan data ayam dalam bentuk file CSV.
 */
function downloadLaporanCSV() {
    if (dataAyam.length === 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Data Kosong',
            text: 'Tidak ada data ayam untuk diekspor.',
            confirmButtonColor: '#fb8500'
        });
        return;
    }

    // Header untuk file CSV
    let csvContent = "ID Batch,Tanggal Masuk,Jenis Telur Ayam,Populasi Awal,Sisa Ayam,Kandang,Status\n";

    // Loop data untuk mengisi baris CSV
    dataAyam.forEach(ayam => {
        // Gabungkan nilai object ke dalam satu string baris dengan koma
        let row = `${ayam.id},${ayam.tglMasuk},${ayam.jenis},${ayam.jumlahAwal},${ayam.sisaAyam},${ayam.kandang},${ayam.status}`;
        csvContent += row + "\n";
    });

    // Buat Blob objek dari string
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

    // Buat elemen anchor pemandu unduhan (link hidden)
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);

    // Penamaan file yang diunduh
    let date = new Date();
    let fileDate = date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate();
    link.setAttribute("download", `Laporan_Data_Ayam_${fileDate}.csv`);

    // Gantungkan di dokumen lalu simulasikan klik otomatis 
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();

    // Bersihkan anchor element setelah selesai
    document.body.removeChild(link);

    // Beri pesan sukses manis
    Swal.fire({
        icon: 'success',
        title: 'Sukses',
        text: 'File Laporan CSV berhasil diunduh.',
        timer: 2000,
        showConfirmButton: false
    });
}