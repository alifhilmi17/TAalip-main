/* =========================================
   Sistem Manajemen Stok Pakan
========================================= */

// Data Global dan Key LocalStorage
let pakanData = [];
const STORAGE_KEY = 'stokPakan_TA';

/**
 * Format string tanggal (YYYY-MM-DD -> DD MMM YYYY)
 */
function formatTanggal(tglStr) {
    if (!tglStr) return "-";
    const dateObj = new Date(tglStr);
    return dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Inisialisasi awal saat dokumen ter-load
document.addEventListener("DOMContentLoaded", () => {
    // Muat data dari localStorage
    if (localStorage.getItem(STORAGE_KEY)) {
        pakanData = JSON.parse(localStorage.getItem(STORAGE_KEY));
    }

    // Set default filter bulan ke bulan berjalan
    const today = new Date();
    const currentMonth = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');
    const filterBulanEl = document.getElementById('filterBulanPakan');
    if (filterBulanEl) filterBulanEl.value = currentMonth;

    renderPakanTable();
    updatePakanStats();
});

/**
 * Handler Filter: Menampilkan ulang tabel dan metrik berdasar filter bulan
 */
function filterData() {
    renderPakanTable();
    updatePakanStats();
}

/**
 * Reset Filter: Mengkosongkan isian filter dan tampilkan seluruh data
 */
function resetFilter() {
    document.getElementById('filterBulanPakan').value = '';
    renderPakanTable();
    updatePakanStats();
}

/**
 * Menghitung Total Masuk, Keluar, dan Sisa Stok Aktual
 */
function updatePakanStats() {
    const filterBulan = document.getElementById('filterBulanPakan')?.value || '';

    let filterMasuk = 0;
    let filterKeluar = 0;

    let totalGlobalMasuk = 0;
    let totalGlobalKeluar = 0;

    pakanData.forEach(item => {
        // Hitung akumulasi global untuk "Sisa Stok Pakan Aktual di Gudang"
        if (item.tipe === "Masuk") {
            totalGlobalMasuk += item.jumlah;
        } else if (item.tipe === "Keluar") {
            totalGlobalKeluar += item.jumlah;
        }

        // Kalkulasi untuk stat Masuk/Keluar yang difilter di layar bulan ini
        const itemMonth = item.tanggal.substring(0, 7); // ambil YYYY-MM
        if (!filterBulan || itemMonth === filterBulan) {
            if (item.tipe === "Masuk") filterMasuk += item.jumlah;
            if (item.tipe === "Keluar") filterKeluar += item.jumlah;
        }
    });

    const sisaAktual = totalGlobalMasuk - totalGlobalKeluar;

    // Update innerText elemen stat
    document.getElementById('totalPakanMasuk').innerText = filterMasuk.toLocaleString('id-ID') + ' Kg';
    document.getElementById('totalPakanKeluar').innerText = filterKeluar.toLocaleString('id-ID') + ' Kg';
    document.getElementById('sisaStokPakan').innerText = sisaAktual.toLocaleString('id-ID') + ' Kg';
}

/**
 * Proses pembentukan isi baris (row) pada body tabel UI
 */
function renderPakanTable() {
    const tbody = document.getElementById('pakanTableBody');
    const filterBulan = document.getElementById('filterBulanPakan')?.value || '';
    const emptyState = document.getElementById('emptyStatePakan');
    const pakanTable = document.getElementById('pakanTable');

    if (!tbody) return;

    tbody.innerHTML = ''; // Kosongkan

    // Sortir urutan data descending berdasarkan tanggal (terbaru ke yang lama)
    const sortedData = [...pakanData].sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

    // Eksekusi filter
    const filteredData = sortedData.filter(item => {
        if (!filterBulan) return true;
        const itemMonth = item.tanggal.substring(0, 7);
        return itemMonth === filterBulan;
    });

    if (filteredData.length === 0) {
        pakanTable.style.display = 'none';
        emptyState.style.display = 'block';
    } else {
        pakanTable.style.display = 'table';
        emptyState.style.display = 'none';

        filteredData.forEach(item => {
            const tr = document.createElement('tr');
            const badgeClass = item.tipe === 'Masuk' ? 'badge-masuk' : 'badge-keluar';

            tr.innerHTML = `
                <td>${formatTanggal(item.tanggal)}</td>
                <td><strong>${item.jenisPakan}</strong></td>
                <td><span class="badge-tipe ${badgeClass}">${item.tipe}</span></td>
                <td><strong>${item.jumlah.toLocaleString('id-ID')}</strong></td>
                <td>${item.keterangan || '-'}</td>
                <td style="text-align: center;">
                    <button class="btn-edit" onclick="editPakan('${item.id}')">✏️ Edit</button>
                    <button class="btn-delete" onclick="deletePakan('${item.id}')">🗑️ Hapus</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
}

/**
 * Handle Modal Operations
 */
function openPakanModal() {
    document.getElementById('pakanForm').reset();
    document.getElementById('pakanId').value = "";
    document.getElementById('modalTitlePakan').innerText = "Tambah Transaksi Pakan";

    // Default form tgl adalah hari ini
    const today = new Date();
    document.getElementById('tglPakan').value = today.toISOString().split('T')[0];

    document.getElementById('pakanModal').classList.add('show');
}

function closePakanModal() {
    document.getElementById('pakanModal').classList.remove('show');
}

/**
 * Handle Penambahan vs Pengeditan (Submit Form)
 */
function savePakanData(e) {
    e.preventDefault();

    const idInput = document.getElementById('pakanId').value;
    const tglInput = document.getElementById('tglPakan').value;
    const tipeInput = document.getElementById('tipePakan').value;
    const jenisInput = document.getElementById('jenisPakan').value;
    const jumlahInput = parseFloat(document.getElementById('jumlahPakan').value);
    const ketInput = document.getElementById('ketPakan').value;

    if (idInput === "") {
        // Mode Tambah Baru
        const newItem = {
            id: 'PKN-' + Date.now(),
            tanggal: tglInput,
            tipe: tipeInput,
            jenisPakan: jenisInput,
            jumlah: jumlahInput,
            keterangan: ketInput
        };
        pakanData.push(newItem);
        Swal.fire({ icon: 'success', title: 'Tersimpan', text: 'Data stok pakan berhasil ditambahkan', timer: 1500, showConfirmButton: false });
    } else {
        // Mode Edit Update
        const index = pakanData.findIndex(p => p.id === idInput);
        if (index > -1) {
            pakanData[index] = {
                id: idInput,
                tanggal: tglInput,
                tipe: tipeInput,
                jenisPakan: jenisInput,
                jumlah: jumlahInput,
                keterangan: ketInput
            };
            Swal.fire({ icon: 'success', title: 'Diperbarui', text: 'Data stok pakan berhasil diubah', timer: 1500, showConfirmButton: false });
        }
    }

    // Tulis ke localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pakanData));

    // Ubah tampilan bulan difilter mengikuti bulan input agar data baru lgsg terlihat
    const currentMonth = tglInput.substring(0, 7);
    document.getElementById('filterBulanPakan').value = currentMonth;

    closePakanModal();
    renderPakanTable();
    updatePakanStats();
}

/**
 * Menyiapkan isian form untuk proses perbaikan 
 */
function editPakan(id) {
    const item = pakanData.find(p => p.id === id);
    if (!item) return;

    document.getElementById('pakanId').value = item.id;
    document.getElementById('tglPakan').value = item.tanggal;
    document.getElementById('tipePakan').value = item.tipe;
    document.getElementById('jenisPakan').value = item.jenisPakan;
    document.getElementById('jumlahPakan').value = item.jumlah;
    document.getElementById('ketPakan').value = item.keterangan || '';

    document.getElementById('modalTitlePakan').innerText = "Edit Transaksi Pakan";
    document.getElementById('pakanModal').classList.add('show');
}

/**
 * Hapus Item dengan konfirmasi ganda
 */
function deletePakan(id) {
    Swal.fire({
        title: 'Hapus Data?',
        text: 'Data yang dihapus tidak bisa dikembalikan!',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Ya, Hapus!',
        cancelButtonText: 'Batal'
    }).then((result) => {
        if (result.isConfirmed) {
            pakanData = pakanData.filter(p => p.id !== id);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(pakanData));

            renderPakanTable();
            updatePakanStats();
            Swal.fire('Dihapus!', 'Data telah terhapus dari memori lokal.', 'success');
        }
    });
}

// =========================================
// Fungsi UI Navigasi Global
// =========================================
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

function goToProfile() {
    Swal.fire('Fitur Terkunci', 'Halaman profil belum difungsikan', 'info');
}

function logoutUser() {
    Swal.fire({
        title: "Keluar dari Aplikasi?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#3085d6",
        confirmButtonText: "Logout"
    }).then((result) => {
        if (result.isConfirmed) {
            window.location.href = "login.html";
        }
    });
}

/**
 * Mengunduh (download) laporan stok pakan dalam bentuk file CSV.
 */
function downloadLaporanCSV() {
    if (pakanData.length === 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Data Kosong',
            text: 'Tidak ada data stok pakan untuk diekspor.',
            confirmButtonColor: '#fb8500'
        });
        return;
    }

    // Header untuk file CSV
    let csvContent = "ID,Tanggal,Jenis Pakan,Tipe,Jumlah (Kg),Keterangan\n";

    // Loop data untuk mengisi baris CSV
    pakanData.forEach(item => {
        // Sanitasi koma di dalam string keterangan
        let ket = item.keterangan ? item.keterangan.replace(/,/g, " ") : "-";

        let row = `${item.id},${item.tanggal},${item.jenisPakan},${item.tipe},${item.jumlah},${ket}`;
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
    link.setAttribute("download", `Laporan_Stok_Pakan_${fileDate}.csv`);

    // Eksekusi unduhan 
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();

    // Pembersihan
    document.body.removeChild(link);

    // Sukses
    Swal.fire({
        icon: 'success',
        title: 'Sukses',
        text: 'File Laporan CSV berhasil diunduh.',
        timer: 2000,
        showConfirmButton: false
    });
}
