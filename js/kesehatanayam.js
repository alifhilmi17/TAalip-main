/* =========================================================
   SISTEM ADMINISTRASI PETERNAKAN (LIBAS)
   File: kesehatanayam.js
   Deskripsi: Mengatur logika pencatatan kesehatan medis
   serta penjadwalan vaksinasi ayam.
========================================================= */

// ==========================================
// 1. MANAJEMEN SIDEBAR
// Berfungsi untuk mengelola animasi pergerakan dan state buka/tutup menu samping (navigasi)
// ==========================================
function toggleSidebarMenu(submenuId) {
    const submenu = document.getElementById(submenuId);

    // Bersihkan penanda kelas sisa jika ada
    if (submenu.classList.contains('show')) submenu.classList.remove('show');
    if (submenu.classList.contains('open')) submenu.classList.remove('open');

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

function logoutUser() {
    Swal.fire({
        title: "Konfirmasi Logout",
        text: "Apakah Anda yakin ingin keluar?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#ef4444",
        cancelButtonColor: "#64748b",
        confirmButtonText: "Ya, Logout!",
        cancelButtonText: "Batal"
    }).then((result) => {
        if (result.isConfirmed) {
            localStorage.removeItem("loggedInUser");
            window.location.href = "login.html";
        }
    });
}

function goToProfile() {
    window.location.href = "editProfileTAalip.html";
}

// ==========================================
// 2. TABS & INISIALISASI
// Terpicu otomatis ketika struktur struktur HTML DOM telah beres dimuat di layar awal.
// Ini menyiapkan data dan tampilan tabel default sebelum interaksi user dimulai.
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    // Muat opsi batch untuk dropdown
    loadBatchOptions();

    // Render tabel
    renderKesehatanTable();
    renderVaksinTable();

    // Perbarui statistik
    updateStats();
});

function switchTab(tabId) {
    // 1. Hapus status 'active' dari semua tombol tab (warna biru mati)
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => btn.classList.remove('active'));

    // 2. Sembunyikan semua bidang/badan konten milik masing-masing tab
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(content => {
        content.style.display = 'none';
        content.classList.remove('active');
    });

    // 3. Tentukan dan aktifkan tab yang ditekan (Kesehatan atau Vaksin)
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
}

// ==========================================
// 3. LOAD DATA BATCH (DARI DATA AYAM)
// Kunci Integrasi Antar-Modul: Mengambil Data Ayam dari tabel master 'dataAyamData' 
// untuk diumpan ke dalam opsi Select dropdown di menu Kesehatan & Vaksin.
// ==========================================
function loadBatchOptions() {
    const dataAyam = JSON.parse(localStorage.getItem('dataAyamData')) || [];
    const kesBatch = document.getElementById('kesBatch');
    const vakBatch = document.getElementById('vakBatch');

    // Reset options
    kesBatch.innerHTML = '<option value="" disabled selected>Pilih Batch...</option>';
    vakBatch.innerHTML = '<option value="" disabled selected>Pilih Batch Target...</option>';

    dataAyam.forEach(ayam => {
        // Buat teks opsi
        const optText = `${ayam.id} (${ayam.kandang})`;

        const opt1 = document.createElement('option');
        opt1.value = ayam.id;
        opt1.textContent = optText;
        opt1.dataset.kandang = ayam.kandang;
        kesBatch.appendChild(opt1);

        const opt2 = document.createElement('option');
        opt2.value = ayam.id;
        opt2.textContent = optText;
        opt2.dataset.kandang = ayam.kandang;
        vakBatch.appendChild(opt2);
    });
}

// Terpilih di form kesehatan
function onBatchSakitChange() {
    const sel = document.getElementById('kesBatch');
    const kandang = sel.options[sel.selectedIndex].dataset.kandang || '';
    document.getElementById('kesKandang').value = kandang;
}

// Fungsi bantuan ketika user memilih Nama Batch di dalam form Vaksinasi, ia otomatis mengisikan Lokasi Kandang
function onBatchVaksinChange() {
    const sel = document.getElementById('vakBatch');
    const kandang = sel.options[sel.selectedIndex].dataset.kandang || '';
    document.getElementById('vakKandang').value = kandang;
}

// ==========================================
// 4. KESEHATAN MODAL & CRUD
// Sistem manipulasi data rekam medis ayam yang bekerja secara lokal dengan LocalStorage.
// ==========================================
function openKesehatanModal(id = null) {
    const modal = document.getElementById('kesehatanModal');
    const form = document.getElementById('kesehatanForm');
    const title = document.getElementById('modalKesehatanTitle');

    form.reset();
    document.getElementById('kesehatanId').value = '';
    document.getElementById('kesKandang').value = '';

    if (id) {
        title.innerText = "Edit Catatan Kesehatan";
        const data = JSON.parse(localStorage.getItem('kesehatan_TA')) || [];
        const item = data.find(x => x.id == id);

        if (item) {
            document.getElementById('kesehatanId').value = item.id;
            document.getElementById('kesTanggal').value = item.tanggal;
            document.getElementById('kesBatch').value = item.batch;
            document.getElementById('kesKandang').value = item.kandang;
            document.getElementById('kesJmlSakit').value = item.jmlSakit;
            document.getElementById('kesJmlMati').value = item.jmlMati;
            document.getElementById('kesGejala').value = item.gejala;
            document.getElementById('kesPenanganan').value = item.penanganan;
            document.getElementById('kesStatus').value = item.status;
        }
    } else {
        title.innerText = "Catat Kesehatan Ayam";
        document.getElementById('kesTanggal').value = new Date().toISOString().split('T')[0];
    }

    modal.classList.add('show');
}

function closeKesehatanModal() {
    document.getElementById('kesehatanModal').classList.remove('show');
}

function saveKesehatan(e) {
    e.preventDefault();

    const id = document.getElementById('kesehatanId').value;
    const tanggal = document.getElementById('kesTanggal').value;
    const batch = document.getElementById('kesBatch').value;
    const kandang = document.getElementById('kesKandang').value;
    const jmlSakit = document.getElementById('kesJmlSakit').value;
    const jmlMati = document.getElementById('kesJmlMati').value;
    const gejala = document.getElementById('kesGejala').value;
    const penanganan = document.getElementById('kesPenanganan').value;
    const status = document.getElementById('kesStatus').value;

    let data = JSON.parse(localStorage.getItem('kesehatan_TA')) || [];

    if (id) {
        // Edit Mode
        const idx = data.findIndex(x => x.id == id);
        if (idx !== -1) {
            data[idx] = { id: Number(id), tanggal, batch, kandang, jmlSakit, jmlMati, gejala, penanganan, status };
        }
    } else {
        // Insert Mode
        const baru = {
            id: Date.now(),
            tanggal, batch, kandang, jmlSakit, jmlMati, gejala, penanganan, status
        };
        data.push(baru);
    }

    localStorage.setItem('kesehatan_TA', JSON.stringify(data));
    closeKesehatanModal();
    renderKesehatanTable();
    updateStats();

    Swal.fire("Berhasil", "Data kesehatan berhasil disimpan!", "success");
}

function hapusKesehatan(id) {
    Swal.fire({
        title: "Hapus Catatan?",
        text: "Data yang dihapus tidak bisa dikembalikan.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#ef4444",
        confirmButtonText: "Hapus",
        cancelButtonText: "Batal"
    }).then(result => {
        if (result.isConfirmed) {
            let data = JSON.parse(localStorage.getItem('kesehatan_TA')) || [];
            data = data.filter(x => x.id != id);
            localStorage.setItem('kesehatan_TA', JSON.stringify(data));
            renderKesehatanTable();
            updateStats();
            Swal.fire("Dihapus!", "Data berhasil dihapus.", "success");
        }
    });
}

function renderKesehatanTable() {
    const data = JSON.parse(localStorage.getItem('kesehatan_TA')) || [];
    const tbody = document.getElementById('kesehatanTableBody');
    const emptyState = document.getElementById('kesehatanEmpty');
    const filterTanggal = document.getElementById('filterKesehatanTanggal').value;

    tbody.innerHTML = '';

    let filtered = data.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

    if (filterTanggal) {
        filtered = filtered.filter(x => x.tanggal === filterTanggal);
    }

    if (filtered.length === 0) {
        emptyState.style.display = 'block';
    } else {
        emptyState.style.display = 'none';
        filtered.forEach(item => {
            let badgeClass = "badge-warning"; // Dalam perawatan default
            if (item.status === "Sembuh") badgeClass = "badge-success";
            else if (item.status === "Mati Semua") badgeClass = "badge-danger";

            // Format tanggal indo
            const dt = new Date(item.tanggal);
            const tglIndo = dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${tglIndo}</strong></td>
                <td>${item.batch}<br><small>${item.kandang}</small></td>
                <td>${item.gejala}</td>
                <td>Sakit: <strong>${item.jmlSakit}</strong><br>Mati: <strong style="color:red">${item.jmlMati}</strong></td>
                <td>${item.penanganan}</td>
                <td><span class="badge ${badgeClass}">${item.status}</span></td>
                <td>
                    <button class="btn-edit" onclick="openKesehatanModal(${item.id})">✏️ Edit</button>
                    <button class="btn-delete" onclick="hapusKesehatan(${item.id})">🗑️ Hapus</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
}

// ==========================================
// 5. VAKSINASI MODAL & CRUD
// Mirip dengan CRUD kesehatan, memanipulasi agenda penjadwalan & penyelesaian program vaksin.
// ==========================================
function openVaksinModal(id = null) {
    const modal = document.getElementById('vaksinModal');
    const form = document.getElementById('vaksinForm');
    const title = document.getElementById('modalVaksinTitle');

    form.reset();
    document.getElementById('vaksinId').value = '';
    document.getElementById('vakKandang').value = '';

    if (id) {
        title.innerText = "Edit Jadwal Vaksin";
        const data = JSON.parse(localStorage.getItem('vaksinasi_TA')) || [];
        const item = data.find(x => x.id == id);

        if (item) {
            document.getElementById('vaksinId').value = item.id;
            document.getElementById('vakTanggal').value = item.tanggal;
            document.getElementById('vakBatch').value = item.batch;
            document.getElementById('vakKandang').value = item.kandang;
            document.getElementById('vakJenis').value = item.jenis;
            document.getElementById('vakMetode').value = item.metode;
            document.getElementById('vakCatatan').value = item.catatan;
            document.getElementById('vakStatus').value = item.status;
        }
    } else {
        title.innerText = "Buat Jadwal Vaksin";
        document.getElementById('vakTanggal').value = new Date().toISOString().split('T')[0];
    }

    modal.classList.add('show');
}

function closeVaksinModal() {
    document.getElementById('vaksinModal').classList.remove('show');
}

function saveVaksin(e) {
    e.preventDefault();

    const id = document.getElementById('vaksinId').value;
    const tanggal = document.getElementById('vakTanggal').value;
    const batch = document.getElementById('vakBatch').value;
    const kandang = document.getElementById('vakKandang').value;
    const jenis = document.getElementById('vakJenis').value;
    const metode = document.getElementById('vakMetode').value;
    const catatan = document.getElementById('vakCatatan').value;
    const status = document.getElementById('vakStatus').value;

    let data = JSON.parse(localStorage.getItem('vaksinasi_TA')) || [];

    if (id) {
        const idx = data.findIndex(x => x.id == id);
        if (idx !== -1) {
            data[idx] = { id: Number(id), tanggal, batch, kandang, jenis, metode, catatan, status };
        }
    } else {
        const baru = {
            id: Date.now(),
            tanggal, batch, kandang, jenis, metode, catatan, status
        };
        data.push(baru);
    }

    localStorage.setItem('vaksinasi_TA', JSON.stringify(data));
    closeVaksinModal();
    renderVaksinTable();
    updateStats();

    Swal.fire("Berhasil", "Jadwal vaksinasi disimpan!", "success");
}

function hapusVaksin(id) {
    Swal.fire({
        title: "Hapus Jadwal?",
        text: "Anda akan menghapus data vaksinasi ini.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#ef4444",
        confirmButtonText: "Hapus",
        cancelButtonText: "Batal"
    }).then(result => {
        if (result.isConfirmed) {
            let data = JSON.parse(localStorage.getItem('vaksinasi_TA')) || [];
            data = data.filter(x => x.id != id);
            localStorage.setItem('vaksinasi_TA', JSON.stringify(data));
            renderVaksinTable();
            updateStats();
            Swal.fire("Dihapus!", "Jadwal berhasil dihapus.", "success");
        }
    });
}

function selesaikanVaksin(id) {
    let data = JSON.parse(localStorage.getItem('vaksinasi_TA')) || [];
    const idx = data.findIndex(x => x.id == id);
    if (idx !== -1) {
        data[idx].status = "Selesai";
        localStorage.setItem('vaksinasi_TA', JSON.stringify(data));
        renderVaksinTable();
        updateStats();
        Swal.fire("Tuntas!", "Status vaksinasi berubah menjadi selesai.", "success");
    }
}

function renderVaksinTable() {
    const data = JSON.parse(localStorage.getItem('vaksinasi_TA')) || [];
    const tbody = document.getElementById('vaksinTableBody');
    const emptyState = document.getElementById('vaksinEmpty');
    const filterStatus = document.getElementById('filterVaksinStatus').value;

    tbody.innerHTML = '';

    let filtered = data.sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal)); // yang terdekat di atas

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

            // Highlight jika jadwal kelewat tapi belum selesai
            let trStyle = "";
            if (dt < today && item.status === "Terjadwal") {
                trStyle = "background-color: #fef2f2;"; // merah sgt pudar krn telat
                badgeClass = "badge-danger";
                item.status = "Tunggakan (Telat)";
            }

            const tglIndo = dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

            const tr = document.createElement('tr');
            if (trStyle) tr.style = trStyle;

            tr.innerHTML = `
                <td><strong>${tglIndo}</strong></td>
                <td>${item.batch}<br><small>${item.kandang}</small></td>
                <td>${item.jenis}</td>
                <td>${item.metode}</td>
                <td>${item.catatan || '-'}</td>
                <td><span class="badge ${badgeClass}">${item.status}</span></td>
                <td>
                    ${item.status !== "Selesai" ? `<button class="btn-success" style="padding:5px 8px; font-size:0.8rem; border-radius:5px" onclick="selesaikanVaksin(${item.id})" title="Tandai Selesai">✔️</button>` : ''}
                    <button class="btn-edit" onclick="openVaksinModal(${item.id})">✏️</button>
                    <button class="btn-delete" onclick="hapusVaksin(${item.id})">🗑️</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
}

// ==========================================
// 6. UPDATE STATISTIK / DASHBOARD KILAT
// Kalkulasi ulang otomatis untuk kartu angka penting di atas layar, 
// seperti total ayam yang sedang sakit, ayam mati, dan list status penjadwalan.
// ==========================================
function updateStats() {
    // Ambil data terbaru dari ingatan memori browser
    const dataKes = JSON.parse(localStorage.getItem('kesehatan_TA')) || [];
    const dataVak = JSON.parse(localStorage.getItem('vaksinasi_TA')) || [];

    // Ayam sakit (hanya yang statusnya masih Dalam Perawatan)
    const sakit = dataKes.filter(x => x.status === "Dalam Perawatan")
        .reduce((sum, item) => sum + Number(item.jmlSakit), 0);

    // Total Kematian sepanjang masa di form kesehatan
    const mati = dataKes.reduce((sum, item) => sum + Number(item.jmlMati), 0);

    // Vaksin Mendatang / Terjadwal
    const terjadwal = dataVak.filter(x => x.status === "Terjadwal").length;

    document.getElementById('statAyamSakit').innerText = `${sakit} Ekor`;
    document.getElementById('statAyamMati').innerText = `${mati} Ekor`;
    document.getElementById('statVaksinMendatang').innerText = `${terjadwal} Jadwal`;
}

// ==========================================
// 7. EXPORT CSV (FITUR BONUS)
// Mengonversi data JSON Array dari sistem ke dalam format string CSV menggunakan titik koma/koma, 
// agar dapat diunduh (terbaca sebagai file Excel) oleh administrator.
// ==========================================
function exportKesehatanCSV() {
    const data = JSON.parse(localStorage.getItem('kesehatan_TA')) || [];
    if (data.length === 0) {
        Swal.fire("Kosong", "Tidak ada data kesehatan untuk di-eksport.", "info");
        return;
    }

    let csv = "Tanggal,Batch,Kandang,Gejala,Jml Sakit,Jml Mati,Penanganan,Status\n";
    data.forEach(x => {
        csv += `"${x.tanggal}","${x.batch}","${x.kandang}","${x.gejala}","${x.jmlSakit}","${x.jmlMati}","${x.penanganan}","${x.status}"\n`;
    });

    downloadCSV(csv, "Data_Kesehatan_Ayam_LIBAS.csv");
}

function exportVaksinCSV() {
    const data = JSON.parse(localStorage.getItem('vaksinasi_TA')) || [];
    if (data.length === 0) {
        Swal.fire("Kosong", "Tidak ada data vaksinasi untuk di-eksport.", "info");
        return;
    }

    let csv = "Tanggal,Batch,Kandang,Jenis Vaksin,Metode,Status,Catatan\n";
    data.forEach(x => {
        csv += `"${x.tanggal}","${x.batch}","${x.kandang}","${x.jenis}","${x.metode}","${x.status}","${x.catatan || ''}"\n`;
    });

    downloadCSV(csv, "Jadwal_Vaksinasi_LIBAS.csv");
}

function downloadCSV(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', filename);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}
