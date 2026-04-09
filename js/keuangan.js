/* =========================================================
   SISTEM ADMINISTRASI PETERNAKAN (BUKU BESAR KEUANGAN)
   File: keuangan.js
   ---------------------------------------------------------
   Deskripsi singkat:
   File ini mengatur Modul Buku Kas (Pemasukan & Pengeluaran).
   Algoritma Create, Read, Update, Delete (CRUD) secara penuh 
   berjalan di sisi frontend, tanpa Backend/Database nyata, 
   melainkan menggunakan Web Storage API (LocalStorage).
   Data ini sangat krusial karena ikut terintegrasi bersama
   grafik Chart.js pada Dashboard Utama.
========================================================= */

// =========================================
// 1. FUNGSI NAVIGASI UMUM & ANTARMUKA SIDEBAR 
// Penjelasan: Memastikan navigasi menu tetap berfungsi independen di tiap halaman.
// =========================================

/**
 * Membuka/Menutup (Toggle) sub-menu di samping panel sidebar
 * @param {string} submenuId - ID elemen HTML dari submenu yang dituju
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
 * Pemberitahuan popup saat mengeklik foto profil (Fitur masih belum tersedia)
 */
function goToProfile() {
    Swal.fire({
        icon: 'info',
        title: 'Profil Pengguna',
        text: 'Fitur profil belum diimplementasikan 🐔',
        confirmButtonColor: '#fb8500'
    });
}

/**
 * Konfirmasi sistem otentikasi logout ke layar Login
 */
function logoutUser() {
    Swal.fire({
        title: "Yakin ingin logout?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Ya, logout",
        cancelButtonText: "Batal",
        confirmButtonColor: "#d33",
        cancelButtonColor: "#3085d6"
    }).then((result) => {
        if (result.isConfirmed) {
            window.location.href = "login.html";
        }
    });
}

// =========================================
// 2. KONTROLER MODUL KEUANGAN INTI (CRUD OPERATIONS)
// Penjelasan: Berisi serangkaian fungsi manipulasi array transaksi 
// secara langsung sesuai alur data.
// =========================================

// Variabel Penampung Utama untuk merekam daftar riwayat
let financeData = [];

// =========================================
// INISIALISASI HALAMAN AWAL DI BUKA (INITIAL LOAD)
// =========================================
document.addEventListener('DOMContentLoaded', () => {
    // Otomatis men-set kotak input tanggal hari ini pada form transaksi
    document.getElementById('trxDate').valueAsDate = new Date();

    // Coba mengambil history data nyata dari memori LocalStorage
    const storedData = localStorage.getItem("financeData");

    if (storedData) {
        // Apabila sudah ada data tersimpan di memori browser, gunakan data tersebut
        financeData = JSON.parse(storedData);
    } else {
        // Apabila masih kosong alias pengguna baru, tambahkan data pemula / sampel
        financeData = [
            { id: generateId(), date: '2026-03-01', type: 'pemasukan', desc: 'Penjualan 100 Papan Telur', amount: 3500000 },
            { id: generateId(), date: '2026-03-02', type: 'pengeluaran', desc: 'Beli Pakan Ayam 5 Karung', amount: 1800000 },
            { id: generateId(), date: '2026-03-05', type: 'pengeluaran', desc: 'Obat & Vitamin', amount: 450000 },
            { id: generateId(), date: '2026-03-08', type: 'pemasukan', desc: 'Penjualan Kotoran Ayam (Pupuk)', amount: 200000 }
        ];

        // Simpan data pemula tadi secara otomatis ke browser pengguna
        localStorage.setItem("financeData", JSON.stringify(financeData));
    }

    // Menggambar data kosong/awal ke HTML saat laman diakses
    renderTable();
});

/**
 * Generator ID Unik acak untuk menjadi primary-key transaksi
 */
function generateId() {
    return '_' + Math.random().toString(36).substr(2, 9);
}

// =========================================
// OPERASI "CREATE" (Menambah Transaksi)
// =========================================
function addTransaction(event) {
    event.preventDefault(); // Menghentikan perilaku reload laman form secara paksa

    // Mengambil ekstraksi nilai-nilai data dari Formulir di layat
    const date = document.getElementById('trxDate').value;
    const type = document.querySelector('input[name="trxType"]:checked').value;
    const desc = document.getElementById('trxDesc').value;
    const amount = parseFloat(document.getElementById('trxAmount').value);

    // Proteksi (Validasi): jika isian formulir dibiarkan bolong/tidak lengkap
    if (!date || !desc || isNaN(amount) || amount <= 0) {
        Swal.fire('Oops!', 'Mohon isi semua data dengan benar', 'error');
        return;
    }

    // Pembuatan Objek Array Transaksi Baru
    const newTrx = {
        id: generateId(),
        date: date,
        type: type,
        desc: desc,
        amount: amount
    };

    // Mendorong array baru & Me-refresh urutan dari paling baru ke atas
    financeData.push(newTrx);
    financeData.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Simpan permanen data transaksi terbaru ke dalam LocalStorage milik pengguna
    localStorage.setItem("financeData", JSON.stringify(financeData));

    // Menghapus data sisa ketikan di formulir agar langsung kosong
    document.getElementById('financeForm').reset();
    document.getElementById('trxDate').valueAsDate = new Date(); // Balikkan ke kalender hari ini

    // Gambarkan/Segarkan Data Visual di antarmuka html
    renderTable();

    // Tampilkan Indikator Sukses Berhasil (Mengambang Singkat)
    Swal.fire({
        icon: 'success',
        title: 'Berhasil',
        text: 'Data transaksi berhasil ditambahkan!',
        timer: 2000,
        showConfirmButton: false
    });
}

// =========================================
// OPERASI "DELETE" (Hapus Transaksi)
// =========================================
function deleteTransaction(id) {
    // Memunculkan kotak peringatan sebelum benar-benar dihapus
    Swal.fire({
        title: 'Hapus Data?',
        text: "Anda tidak bisa mengembalikan data yang sudah dihapus!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Ya, Hapus!'
    }).then((result) => {
        if (result.isConfirmed) {
            // Saring dan potong array dari riwayat utuh apabila id nya cocok untuk dimusnahkan
            financeData = financeData.filter(item => item.id !== id);

            // Perbarui penyimpanan LocalStorage untuk merepresentasikan array yang baru dikurangi
            localStorage.setItem("financeData", JSON.stringify(financeData));

            renderTable();
            Swal.fire(
                'Terhapus!',
                'Data transaksi telah dihapus.',
                'success'
            );
        }
    });
}

// =========================================
// OPERASI "UPDATE" (Edit Transaksi)
// =========================================
function editTransaction(id) {
    const item = financeData.find(d => d.id === id);
    if (!item) return;

    Swal.fire({
        title: 'Edit Transaksi',
        html: `
            <div style="text-align: left; padding: 0 10px;">
                <label style="display:block; margin-bottom:5px; font-weight: 600; font-family: 'Poppins', sans-serif; font-size: 0.95rem; color: #475569;">Tanggal Transaksi</label>
                <input type="date" id="swal-date" class="swal2-input" value="${item.date}" style="width: 100%; max-width: 100%; margin-bottom: 20px; border-radius: 12px; font-family: 'Poppins', sans-serif;">
                
                <label style="display:block; margin-bottom:5px; font-weight: 600; font-family: 'Poppins', sans-serif; font-size: 0.95rem; color: #475569;">Jenis Transaksi</label>
                <div style="margin-bottom: 20px; font-family: 'Poppins', sans-serif; display: flex; gap: 15px;">
                    <label style="display: inline-flex; align-items: center; gap: 8px; cursor: pointer; padding: 10px 15px; background: #f1f5f9; border-radius: 12px; font-weight: 600; color: #475569;">
                        <input type="radio" name="swal-type" value="pemasukan" style="accent-color: #3b82f6; width: 18px; height: 18px; cursor: pointer;" ${item.type === 'pemasukan' ? 'checked' : ''}> Pemasukan
                    </label>
                    <label style="display: inline-flex; align-items: center; gap: 8px; cursor: pointer; padding: 10px 15px; background: #f1f5f9; border-radius: 12px; font-weight: 600; color: #475569;">
                        <input type="radio" name="swal-type" value="pengeluaran" style="accent-color: #3b82f6; width: 18px; height: 18px; cursor: pointer;" ${item.type === 'pengeluaran' ? 'checked' : ''}> Pengeluaran
                    </label>
                </div>
                
                <label style="display:block; margin-bottom:5px; font-weight: 600; font-family: 'Poppins', sans-serif; font-size: 0.95rem; color: #475569;">Keterangan / Deskripsi</label>
                <input type="text" id="swal-desc" class="swal2-input" value="${item.desc}" style="width: 100%; max-width: 100%; margin-bottom: 20px; border-radius: 12px; font-family: 'Poppins', sans-serif;">
                
                <label style="display:block; margin-bottom:5px; font-weight: 600; font-family: 'Poppins', sans-serif; font-size: 0.95rem; color: #475569;">Jumlah Uang (Rp)</label>
                <input type="number" id="swal-amount" class="swal2-input" value="${item.amount}" style="width: 100%; max-width: 100%; margin-bottom: 10px; border-radius: 12px; font-family: 'Poppins', sans-serif;">
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: '💾 Simpan Perubahan',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#64748b',
        customClass: {
            confirmButton: 'btn-primary',
            cancelButton: 'btn-secondary',
            popup: 'shadow-card'
        },

        preConfirm: () => {
            const date = document.getElementById('swal-date').value;
            const type = document.querySelector('input[name="swal-type"]:checked')?.value;
            const desc = document.getElementById('swal-desc').value;
            const amount = parseFloat(document.getElementById('swal-amount').value);

            if (!date || !type || !desc || isNaN(amount) || amount <= 0) {
                Swal.showValidationMessage('Mohon isi semua data dengan benar');
                return false;
            }

            return { date, type, desc, amount };
        }
    }).then((result) => {
        if (result.isConfirmed) {
            Swal.fire({
                title: 'Simpan Perubahan?',
                text: "Apakah Anda yakin data yang diubah sudah benar?",
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#10b981',
                cancelButtonColor: '#64748b',
                confirmButtonText: 'Ya, Simpan!',
                cancelButtonText: 'Batal'
            }).then((confirmResult) => {
                if (confirmResult.isConfirmed) {
                    const index = financeData.findIndex(d => d.id === id);
                    if (index !== -1) {
                        // Update item dengan hasil dari input form popup sebelumnya (dilambangkan dr 'result.value')
                        financeData[index].date = result.value.date;
                        financeData[index].type = result.value.type;
                        financeData[index].desc = result.value.desc;
                        financeData[index].amount = result.value.amount;

                        // Urutkan ulang riwayat menurut tanggal terbaru
                        financeData.sort((a, b) => new Date(b.date) - new Date(a.date));

                        // Simpan permanen ke memori LocalStorage
                        localStorage.setItem("financeData", JSON.stringify(financeData));

                        // Regenerasi ulang tabel dengan data termodifikasi terbaru
                        renderTable();

                        Swal.fire({
                            icon: 'success',
                            title: 'Berhasil',
                            text: 'Data transaksi telah diperbarui.',
                            timer: 2000,
                            showConfirmButton: false
                        });
                    }
                }
            });
        }
    });
}

// =========================================
// OPERASI PENCARIAN & FILTER KATA KUNCI
// =========================================
function filterTable() {
    // Pantau dan konversi setiap huruf yang diketik oleh pengguna jadi kecil untuk disamakan (agar tdk case sensitive)
    const keyword = document.getElementById('searchTrx').value.toLowerCase();
    renderTable(keyword);
}

// =========================================
// OPERASI "READ" (Merakit Antarmuka Ke HTML)
// =========================================
function renderTable(filterKeyword = '') {
    const tbody = document.getElementById('financeTableBody');
    tbody.innerHTML = ''; // Membersihkan Papan agar siap dilukis dengan data baru.

    let totalPemasukan = 0;
    let totalPengeluaran = 0;

    // Filter daftar baris transaksi sesuai masukan kueri kata kunci yg dicari
    const filteredData = financeData.filter(item =>
        item.desc.toLowerCase().includes(filterKeyword)
    );

    // Antisipasi Logika jika tabel sedang tidak berisikan data apapun alias nihil
    if (filteredData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-state">Tidak ada data transaksi.</td></tr>`;
    } else {
        // Lingkaran loop proses: Melewati dan memetakan satu persatu transaksi ke dalam tampilan visual Baris (<tr>) Tabel
        filteredData.forEach(item => {

            // Logika Matematis memisahkan kubu Pemasukan Tambah (Masuk) atau Kurang (Keluar)
            if (item.type === 'pemasukan') {
                totalPemasukan += item.amount;
            } else {
                totalPengeluaran += item.amount;
            }

            // Membangun Elemen Kolom Tabel Baru (Tr)
            const tr = document.createElement('tr');

            // Format Tanggal estetik berbahasa Indonesia (Contoh: "17 Agt 2026")
            const dateObj = new Date(item.date);
            const dateStr = dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

            // Format Konversi Angka murni menjadi Uang Rupiah (Contoh: "2.500.000")
            const amountStr = item.amount.toLocaleString('id-ID');

            // Logika membedah gaya warna desain (Hijau/Merah) berdasarkan sifat transaksinya
            const badgeClass = item.type === 'pemasukan' ? 'badge-income' : 'badge-expense';
            const typeLabel = item.type === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran';
            const amountColor = item.type === 'pemasukan' ? '#166534' : '#991b1b';

            // Templat struktur murni kerangka tabel
            tr.innerHTML = `
                <td>${dateStr}</td>
                <td><span class="badge-type ${badgeClass}">${typeLabel}</span></td>
                <td style="font-weight: 500;">${item.desc}</td>
                <td style="text-align: right; color: ${amountColor}; font-weight: 600;">Rp ${amountStr}</td>
                <td style="text-align: center;">
                    <button class="btn-edit" onclick="editTransaction('${item.id}')" title="Edit Data">✏️ Edit</button>
                    <button class="btn-delete" onclick="deleteTransaction('${item.id}')" title="Hapus Data">🗑️ Hapus</button>
                </td>
            `;

            tbody.appendChild(tr); // Pasang kolom yang selesai ditata ini pada papan besar HTML.
        });
    }

    // =========================================
    // MODIFIKASI PANEL DOMPET RINGKASAN REKAPITULASI 
    // =========================================

    // Taruh nominal Pemasukan Kasaran VS Nominal Dompet Kotor di ujung kiri Layar
    document.getElementById('totalPemasukan').textContent = `Rp ${totalPemasukan.toLocaleString('id-ID')}`;
    document.getElementById('totalPengeluaran').textContent = `Rp ${totalPengeluaran.toLocaleString('id-ID')}`;

    // Menghasilkan nominal Sisa Uang / Margin Saldo Bersih
    const saldo = totalPemasukan - totalPengeluaran;
    const elSaldo = document.getElementById('totalSaldo');
    elSaldo.textContent = `Rp ${saldo.toLocaleString('id-ID')}`;

    // Fitur Cerdas: Mengganti warna font menjadi merah mentereng terang jika status perusahaan sedang di posisi RUGI/MINUS atau Biru Aman.
    if (saldo < 0) {
        elSaldo.style.color = '#dc2626';
    } else {
        elSaldo.style.color = '#1e40af';
    }
}

/**
 * Mengunduh (download) laporan keuangan dalam bentuk file CSV.
 */
function downloadLaporanCSV() {
    if (financeData.length === 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Data Kosong',
            text: 'Tidak ada data keuangan untuk diekspor.',
            confirmButtonColor: '#fb8500'
        });
        return;
    }

    // Header untuk file CSV
    let csvContent = "ID,Tanggal,Jenis Transaksi,Keterangan,Jumlah (Rp)\n";

    // Loop data untuk mengisi baris CSV
    // Terapkan regex sanitize pada keterangan untuk membuang karakter koma agar struktur CSV aman
    financeData.forEach(item => {
        let cleanDesc = item.desc ? item.desc.replace(/,/g, " ") : "-";
        let row = `${item.id},${item.date},${item.type},${cleanDesc},${item.amount}`;
        csvContent += row + "\n";
    });

    // Buat Blob objek dari string CSV
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // Buat elemen link anchor pemandu unduhan
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    
    // Setup Nama File secara Dinamis Menyesuaikan Hari Ini
    let dateObj = new Date();
    let fileDate = dateObj.getFullYear() + "-" + (dateObj.getMonth() + 1) + "-" + dateObj.getDate();
    link.setAttribute("download", `Laporan_Keuangan_${fileDate}.csv`);
    
    // Eksekusi trigger download di latar
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    
    // Pembersihan
    document.body.removeChild(link);
    
    // Popup Sukses
    Swal.fire({
        icon: 'success',
        title: 'Sukses',
        text: 'File Laporan CSV Keuangan berhasil diunduh.',
        timer: 2000,
        showConfirmButton: false
    });
}
