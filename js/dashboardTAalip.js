/* =========================================================
   🐔 SISTEM ADMINISTRASI PETERNAKAN (KODE JAVASCRIPT UTAMA)
   File: dashboardTAalip.js
   ---------------------------------------------------------
   Deskripsi singkat:
   File ini berfungsi sebagai pengontrol antarmuka utama (Dashboard).
   Menggunakan Vanilla JavaScript untuk memanipulasi DOM (Document Object Model)
   dan menyimpan/membaca data secara persisten melalui LocalStorage browser.
========================================================= */

// =========================================
// 1. PENGENDALI SIDEBAR & NAVIGASI
// =========================================

/**
 * Fungsi untuk membuka atau menutup (toggle) submenu pada sidebar.
 * Mengubah atribut aria-hidden dan aria-expanded untuk aksesibilitas,
 * serta menambah class 'active-parent' agar tombol terlihat disorot aktif.
 * @param {string} submenuId - ID elemen submenu yang akan di-toggle
 */
function toggleSidebarMenu(submenuId) {
    const submenu = document.getElementById(submenuId);

    // Jika ada class 'show', hapus agar logika CSS aria-hidden bekerja sempurna
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


/* =========================================================
   🚀 LOGIKA DASHBOARD UTAMA (EVENT LISTENER DOM LOADED)
   ---------------------------------------------------------
   Deskripsi singkat:
   Blok pembungkus event 'DOMContentLoaded' ini memastikan bahwa
   seluruh script JavaScript di dalamnya hanya akan dieksekusi 
   setelah semua kerangka HTML halaman selesai dimuat ke memori browser.
   Ini adalah praktik terbaik untuk menghindari error "Element Not Found".
========================================================= */
document.addEventListener("DOMContentLoaded", () => {

    // =========================================
    // A. MODUL MANAJEMEN JADWAL KEGIATAN (CRUD via LocalStorage)
    // Penjelasan: Modul ini menangani pembuatan tabel dinamis jadwal bekerja.
    // =========================================

    // Mengambil elemen tbody dari tabel jadwal dan form tambah jadwal
    const scheduleTableBody = document.querySelector("#scheduleTable tbody");
    const scheduleForm = document.getElementById("addScheduleForm");

    // Memuat data dari localStorage jika ada, jika tidak gunakan data default
    let scheduleData = JSON.parse(localStorage.getItem("scheduleData")) || [];

    /**
     * Render/menampilkan data jadwal ke dalam tabel HTML.
     */
    function renderSchedule() {
        scheduleTableBody.innerHTML = ""; // Bersihkan isi tabel sebelumnya
        scheduleData.forEach((item, index) => {
            // Looping data dan tambahkan baris (tr) baru untuk setiap jadwal
            scheduleTableBody.innerHTML += `
        <tr>
          <td>${item.tanggal}</td>
          <td>${item.waktu}</td>
          <td>${item.agenda}</td>
          <td>${item.ruangan}</td>
          <td>
            <button class="delete-btn delete-schedule" data-index="${index}" title="Hapus">🗑</button>
          </td>
        </tr>
      `;
        });
    }
    // Panggil renderSchedule saat pertama dimuat
    renderSchedule();

    // Menangani event submit pada form tambah jadwal
    scheduleForm.addEventListener("submit", (e) => {
        e.preventDefault(); // Mencegah reload halaman

        // Ambil nilai dari input form
        const tanggal = document.getElementById("tanggal").value;
        const waktu = document.getElementById("waktu").value;
        const agenda = document.getElementById("agenda").value;
        const ruangan = document.getElementById("ruangan").value;

        // Menampilkan konfirmasi sebelum menyimpan
        Swal.fire({
            title: "Tambah Kegiatan?",
            text: `Apakah Anda yakin ingin menambahkan kegiatan "${agenda}"?`,
            icon: "question",
            showCancelButton: true,
            confirmButtonText: "Ya, Tambah",
            cancelButtonText: "Batal",
            confirmButtonColor: "#3085d6",
            cancelButtonColor: "#d33"
        }).then((result) => {
            if (result.isConfirmed) {
                // Jika dikonfirmasi, masukkan data baru ke dalam array
                scheduleData.push({
                    tanggal,
                    waktu,
                    agenda,
                    ruangan
                });
                // Simpan array terbaru ke localStorage
                localStorage.setItem("scheduleData", JSON.stringify(scheduleData));
                // Refresh tabel
                renderSchedule();
                // Reset/kosongkan kolom isian form
                scheduleForm.reset();
                Swal.fire("Berhasil", "Jadwal berhasil ditambahkan!", "success");
            }
        });
    });

    // Event delegasi untuk menghapus jadwal saat tombol 🗑 ditekan
    scheduleTableBody.addEventListener("click", (e) => {
        if (e.target.classList.contains("delete-schedule")) {
            const idx = e.target.dataset.index; // Ambil index dari elemen tombol

            // Konfirmasi penghapusan
            Swal.fire({
                title: "Hapus jadwal?",
                text: "Anda tidak dapat mengembalikan data ini!",
                icon: "warning",
                showCancelButton: true,
                confirmButtonColor: "#d33",
                cancelButtonColor: "#3085d6",
                confirmButtonText: "Ya, hapus!",
                cancelButtonText: "Batal"
            }).then((result) => {
                if (result.isConfirmed) {
                    // Hapus 1 data pada index yang dipilih
                    scheduleData.splice(idx, 1);
                    // Update data di localStorage
                    localStorage.setItem("scheduleData", JSON.stringify(scheduleData));
                    // Refresh tabel
                    renderSchedule();
                    Swal.fire("Terhapus!", "Jadwal dihapus", "success");
                }
            });
        }
    });


    // =========================================
    // B. MODUL MANAJEMEN AKTIVITAS HARIAN (Sistem To-Do List)
    // Penjelasan: Menggunakan array boolean untuk mencatat state 'completed'.
    // Data disimpan dalam bentuk JSON string di LocalStorage.
    // =========================================

    const activityList = document.getElementById("dailyActivityList");
    const activityForm = document.getElementById("addActivityForm");

    // Load data, convert string to object if necessary (migration for older versions)
    let rawActivityData = JSON.parse(localStorage.getItem("activityData"));
    let activityData = [];

    if (!rawActivityData) {
        // Array kosong jika belum ada penyimpanan
        activityData = [];
    } else if (rawActivityData.length > 0 && typeof rawActivityData[0] === 'string') {
        // Migrate legacy string data (jika format lama di localStorage masih array string biasa)
        activityData = rawActivityData.map(item => ({
            text: item,
            completed: false
        }));
        localStorage.setItem("activityData", JSON.stringify(activityData));
    } else {
        // Gunakan data localStorage
        activityData = rawActivityData;
    }

    /**
     * Render item ke dalam daftar UL (Unordered List) aktivitas.
     */
    function renderActivities() {
        activityList.innerHTML = ""; // Bersihkan list
        activityData.forEach((item, index) => {
            const li = document.createElement("li");
            li.style.display = "flex";
            li.style.justifyContent = "space-between";
            li.style.alignItems = "center";

            // Styling khusus jika aktivitas sudah selesai
            if (item.completed) {
                li.style.opacity = "0.7";
                li.style.background = "#f1f3f5";
            } else {
                li.style.background = "#fff";
            }

            // Masukkan HTML ke dalam list item
            li.innerHTML = `
        <span style="flex:1; padding-right:10px; ${item.completed ? 'text-decoration:line-through; color:#888;' : ''}">${item.text}</span>
        
        <div class="action-btn-group">
          <!-- Tombol checklist untuk menandai selesai atau batal selesai -->
          <button class="action-btn check-btn" data-index="${index}" title="${item.completed ? 'Batal Selesai' : 'Selesai'}">
            ${item.completed ? '↩' : '✔'}
          </button>
          <!-- Tombol hapus ukuran kecil (✕) -->
          <button class="action-btn delete-item-btn delete-activity" data-index="${index}" title="Hapus">✕</button>
        </div>
      `;
            activityList.appendChild(li); // Tambahkan item ke UI
        });
    }
    // Panggil saat dimuat pertama kali
    renderActivities();

    // Menangani submit penambahan aktivitas
    activityForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const input = document.getElementById("activityInput");

        // Validasi input agar tidak kosong
        if (input.value.trim() !== "") {
            const newActivity = input.value.trim();

            Swal.fire({
                title: "Tambah Aktivitas?",
                text: `Apakah Anda yakin ingin menambahkan "${newActivity}"?`,
                icon: "question",
                showCancelButton: true,
                confirmButtonText: "Ya, Tambah",
                cancelButtonText: "Batal",
                confirmButtonColor: "#3085d6",
                cancelButtonColor: "#d33"
            }).then((result) => {
                if (result.isConfirmed) {
                    // Tambah aktivitas baru (default status belum selesai)
                    activityData.push({
                        text: newActivity,
                        completed: false
                    });
                    localStorage.setItem("activityData", JSON.stringify(activityData));
                    renderActivities(); // Refresh UI
                    input.value = ""; // Kosongkan input form setelah tambah
                    Swal.fire("Berhasil", "Aktivitas berhasil ditambahkan!", "success");
                }
            });
        }
    });

    // Event delegasi pada list aktivitas klik
    activityList.addEventListener("click", (e) => {
        // Helper untuk meraba ke atas DOM untuk mencari tag tombol, mencegah mis-klik pada element lain
        const btn = e.target.closest('button');
        if (!btn) return;
        const idx = btn.dataset.index;

        // Aksi: Delete Activity
        if (btn.classList.contains("delete-activity")) {
            Swal.fire({
                title: "Hapus Aktivitas?",
                text: "Item ini akan dihapus permanen.",
                icon: "warning",
                showCancelButton: true,
                confirmButtonText: "Ya, Hapus",
                cancelButtonText: "Batal",
                confirmButtonColor: "#d33",
                cancelButtonColor: "#3085d6"
            }).then((result) => {
                if (result.isConfirmed) {
                    activityData.splice(idx, 1); // Hapus data array
                    localStorage.setItem("activityData", JSON.stringify(activityData));
                    renderActivities();
                    Swal.fire("Terhapus!", "Aktivitas telah dihapus.", "success");
                }
            });
        }

        // Aksi: Check (Complete/Uncomplete) Activity
        if (btn.classList.contains("check-btn")) {
            const isCompleted = activityData[idx].completed;
            Swal.fire({
                title: isCompleted ? "Batalkan Selesai?" : "Tandai Selesai?",
                text: isCompleted ? "Kembalikan status ke belum selesai?" : "Apakah aktivitas ini sudah selesai?",
                icon: "question",
                showCancelButton: true,
                confirmButtonText: "Ya",
                cancelButtonText: "Batal",
                confirmButtonColor: "#3085d6",
                cancelButtonColor: "#d33"
            }).then((result) => {
                if (result.isConfirmed) {
                    // Toggle (balikkan) nilai true -> false / false -> true
                    activityData[idx].completed = !activityData[idx].completed;
                    localStorage.setItem("activityData", JSON.stringify(activityData));
                    renderActivities();
                    if (!isCompleted) Swal.fire("Selesai!", "Aktivitas ditandai selesai.", "success");
                }
            });
        }
    });


    // =========================================
    // C. MODUL MANAJEMEN PENGUMUMAN PENTING
    // Penjelasan: Berfungsi untuk menampilkan daftar notifikasi atau pengumuman.
    // Memiliki struktur data objek state berupa 'text' dan 'read' (sudah dibaca).
    // =========================================

    const announcementList = document.getElementById("announcementList");
    const announcementForm = document.getElementById("addAnnouncementForm");

    // Load data, convert string to object if necessary (migration)
    let rawAnnouncementData = JSON.parse(localStorage.getItem("announcementData"));
    let announcementData = [];

    if (!rawAnnouncementData) {
        // Array kosong untuk pengumuman default
        announcementData = [];
    } else if (rawAnnouncementData.length > 0 && typeof rawAnnouncementData[0] === 'string') {
        // Jika format lama, convert agar support properti "read"
        announcementData = rawAnnouncementData.map(item => ({
            text: item,
            read: false
        }));
        localStorage.setItem("announcementData", JSON.stringify(announcementData));
    } else {
        announcementData = rawAnnouncementData;
    }

    /**
     * Render menampilkan pengumuman di list HTML.
     */
    function renderAnnouncements() {
        announcementList.innerHTML = ""; // Bersihkan list HTML
        announcementData.forEach((item, index) => {
            const li = document.createElement("li");
            li.className = "announcement-item"; // Beri class untuk styling dari CSS

            // Membersihkan teks, buang karakter emoji lawas seperti '📌' atau '📢' dari awal baris
            let displayText = item.text.replace(/^(📌|📢)\s*/, '');

            // Styling tambahan jika pengumuman sudah dibaca
            if (item.read) {
                li.style.opacity = "0.7";
                li.style.background = "#f1f3f5";
                li.style.borderLeftColor = "#ccc";
            }

            li.innerHTML = `
        <div class="announcement-content">
          <div class="announcement-details">
            <!-- Beri coretan jika item ditandai sudah terbaca -->
            <span class="text" ${item.read ? 'style="text-decoration:line-through; color:#888;"' : ''}>${displayText}</span>
            <span class="time-stamp">Baru saja</span>
          </div>
        </div>
        
        <div class="action-btn-group">
           <!-- Tombol check ganda fungsi untuk membaca / unbaca -->
           <button class="action-btn check-btn" data-index="${index}" title="${item.read ? 'Batal Selesai' : 'Selesai'}">
             ${item.read ? '↩' : '✔'}
           </button>
           <!-- Tombol hapus pengumuman -->
           <button class="action-btn delete-item-btn delete-announcement" data-index="${index}" title="Hapus">✕</button>
        </div>
      `;
            announcementList.appendChild(li); // Tambahkan element Li ke list
        });
    }
    // Panggil pertama kali
    renderAnnouncements();

    // Menangani submit pada bagian pengumuman
    announcementForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const input = document.getElementById("announcementInput");

        // Validasi input text tidak kosong
        if (input.value.trim() !== "") {
            const newAnnouncement = input.value.trim();

            Swal.fire({
                title: "Tambah Pengumuman?",
                text: "Apakah Anda yakin ingin menambahkan pengumuman ini?",
                icon: "question",
                showCancelButton: true,
                confirmButtonText: "Ya, Tambah",
                cancelButtonText: "Batal",
                confirmButtonColor: "#3085d6",
                cancelButtonColor: "#d33"
            }).then((result) => {
                if (result.isConfirmed) {
                    // Masukan ke array list data
                    announcementData.push({
                        text: newAnnouncement,
                        read: false
                    });
                    // Update database sementara lokal
                    localStorage.setItem("announcementData", JSON.stringify(announcementData));
                    renderAnnouncements(); // Redraw UI
                    input.value = ""; // Reset form teks
                    Swal.fire("Berhasil", "Pengumuman berhasil ditambahkan!", "success");
                }
            });
        }
    });

    // Delegasi event list pengumuman untuk baca & hapus pengumuman
    announcementList.addEventListener("click", (e) => {
        // Helper untuk meraba event source ke closest DOM Button
        const btn = e.target.closest('button');
        if (!btn) return;
        const idx = btn.dataset.index;

        // Aksi: Menghapus (Delete Announcement)
        if (btn.classList.contains("delete-announcement")) {
            Swal.fire({
                title: "Hapus pengumuman?",
                icon: "warning",
                showCancelButton: true,
                confirmButtonText: "Ya, hapus",
                cancelButtonText: "Batal",
                confirmButtonColor: "#d33",
                cancelButtonColor: "#3085d6"
            }).then((result) => {
                if (result.isConfirmed) {
                    announcementData.splice(idx, 1);
                    localStorage.setItem("announcementData", JSON.stringify(announcementData));
                    renderAnnouncements();
                    Swal.fire("Terhapus!", "Pengumuman berhasil dihapus.", "success");
                }
            });
        }

        // Aksi: Centang/Sudah Dibaca (Check Read Announcement)
        if (btn.classList.contains("check-btn")) {
            const isRead = announcementData[idx].read;
            Swal.fire({
                title: isRead ? "Tandai Belum Dibaca?" : "Tandai Sudah Dibaca?",
                text: isRead ? "Kembalikan status ke belum dibaca?" : "Apakah Anda sudah membaca pengumuman ini?",
                icon: "question",
                showCancelButton: true,
                confirmButtonText: "Ya",
                cancelButtonText: "Batal",
                confirmButtonColor: "#3085d6",
                cancelButtonColor: "#d33"
            }).then((result) => {
                if (result.isConfirmed) {
                    // Toggle status read
                    announcementData[idx].read = !announcementData[idx].read;
                    localStorage.setItem("announcementData", JSON.stringify(announcementData));
                    renderAnnouncements();
                    // Notifikasi apabila baru saja ditandai dibaca
                    if (!isRead) Swal.fire("Sudah Dibaca!", "Pengumuman ditandai sudah dibaca.", "success");
                }
            });
        }
    });

    // =========================================
    // D. MODUL GRAFIK VISUALISASI DATA (MENGGUNAKAN LIBRARY CHART.JS)
    // Penjelasan: Modul ini bertugas menggambar grafik interaktif dengan HTML5 Canvas.
    // Mengambil data terpadu (Integrated) dari localStorage halaman Keuangan.
    // =========================================

    // 1. DATA SET TELUR MERUJUK KE LOCALSTORAGE
    const storedProduksi = JSON.parse(localStorage.getItem('produksiHarianData')) || [];

    // Kelompokkan berdasarkan Tanggal karena bisa saja 1 hari ada 3 kandang yang diinput
    const produksiByDate = {};
    storedProduksi.forEach(prod => {
        if (!produksiByDate[prod.tanggal]) {
            produksiByDate[prod.tanggal] = { total: 0, baik: 0, cacat: 0 };
        }
        produksiByDate[prod.tanggal].total += prod.totalTelur;
        produksiByDate[prod.tanggal].baik += prod.telurBaik;
        produksiByDate[prod.tanggal].cacat += prod.telurCacat;
    });

    // Urutkan tanggal dari yang terlama ke terbaru
    const sortedDates = Object.keys(produksiByDate).sort((a, b) => new Date(a) - new Date(b));

    // Ambil maksimal 7 hari terakhir
    const last7Dates = sortedDates.slice(-7);

    let eggProductionData = last7Dates.map(date => produksiByDate[date].total);
    let eggGoodData = last7Dates.map(date => produksiByDate[date].baik);
    let eggBadData = last7Dates.map(date => produksiByDate[date].cacat);
    let eggLabels = last7Dates.map(date => {
        const d = new Date(date);
        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        return days[d.getDay()]; // Mengambil nama hari
    });

    // Catatan: Fallback dummy telah dibersihkan sehingga jika belum ada input produksi, grafik akan tampilkan blank state/kanvas kosong.

    // --- INTEGRASI DATA KEUANGAN DARI LOCALSTORAGE ---
    let financeIncomeData = [0, 0, 0, 0];
    let financeExpenseData = [0, 0, 0, 0];
    let totalPendapatanBulanIni = 0;
    let totalPemasukanGlobal = 0;
    let totalPengeluaranGlobal = 0;

    // Menarik database kecil dari localStorage yang disimpan oleh halaman keuangan.html
    const storedFinance = JSON.parse(localStorage.getItem('financeData')) || [];
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth(); // 0-11
    const currentYear = currentDate.getFullYear();

    storedFinance.forEach(item => {
        // --- Hitung Global untuk Saldo Bersih Keseluruhan ---
        if (item.type === 'pemasukan') {
            totalPemasukanGlobal += item.amount;
        } else if (item.type === 'pengeluaran') {
            totalPengeluaranGlobal += item.amount;
        }

        const trxDate = new Date(item.date);

        // Memeriksa apakah transaksi berada di bulan dan tahun saat ini
        if (trxDate.getMonth() === currentMonth && trxDate.getFullYear() === currentYear) {
            const day = trxDate.getDate();

            // Konversi tanggal (1 s.d 31) menjadi kategori index minggu (0 s.d 3)
            let weekIndex = Math.floor((day - 1) / 7);
            if (weekIndex > 3) weekIndex = 3; // Menyatukan tanggal 22 sampai akhir bulan ke kelompok "Minggu 4"

            if (item.type === 'pemasukan') {
                financeIncomeData[weekIndex] += item.amount;
                totalPendapatanBulanIni += item.amount; // Tambah ke kartu rekap pendapatan stat atas
            } else if (item.type === 'pengeluaran') {
                financeExpenseData[weekIndex] += item.amount;
            }
        }
    });

    const totalSaldoBersihGlobal = totalPemasukanGlobal - totalPengeluaranGlobal;

    // --- INTEGRASI DATA AYAM DARI LOCALSTORAGE ---
    const storedAyam = JSON.parse(localStorage.getItem('dataAyamData')) || [];
    let totalAyamAktif = 0;

    // Menjumlahkan sisa ayam yang hanya berstatus 'Aktif'
    storedAyam.forEach(ayam => {
        if (ayam.status === 'Aktif') {
            totalAyamAktif += (parseInt(ayam.sisaAyam) || 0);
        }
    });

    // 2. UPDATE KARTU STATISTIK CEPAT (QUICK STATS) DI ATAS
    // Mortalitas belum ada modul, default 0
    const mortalitasData = 0;

    // --- INTEGRASI DATA SISA STOK PAKAN DARI LOCALSTORAGE ---
    // Membaca dari key 'stokPakan_TA' yang dikelola oleh halaman stokpakan.js
    // Logika kalkulasi: total semua transaksi "Masuk" dikurangi total semua "Keluar"
    const storedPakan = JSON.parse(localStorage.getItem('stokPakan_TA')) || [];
    let totalPakanMasukGlobal = 0;
    let totalPakanKeluarGlobal = 0;
    storedPakan.forEach(item => {
        if (item.tipe === 'Masuk') {
            totalPakanMasukGlobal += (item.jumlah || 0);
        } else if (item.tipe === 'Keluar') {
            totalPakanKeluarGlobal += (item.jumlah || 0);
        }
    });
    const sisaPakan = totalPakanMasukGlobal - totalPakanKeluarGlobal;

    // Mendapatkan angka telur dari indeks data terakhir
    // Jika belum ada data input sama sekali, fallback default hari ini adalah 0
    const todayEggProduction = eggProductionData.length > 0 ? eggProductionData[eggProductionData.length - 1] : 0;

    // Menyalurkan ke HTML (Card)
    document.getElementById('stat-telur').textContent = `${todayEggProduction.toLocaleString('id-ID')} Butir`;
    document.getElementById('stat-ayam').textContent = `${totalAyamAktif.toLocaleString('id-ID')} Ekor`;
    document.getElementById('stat-mortalitas').textContent = `${mortalitasData} Ekor`;
    document.getElementById('stat-pakan').textContent = `${sisaPakan} Kg`;
    // Memperbarui stat "Pendapatan Bulan Ini" bedasarkan perhitungan data Pemasukan Dinamis
    document.getElementById('stat-pendapatan').textContent = `Rp ${totalPendapatanBulanIni.toLocaleString('id-ID')}`;

    // Memperbarui stat "Saldo Bersih" (keseluruhan, sama seperti di halaman keuangan)
    const elSaldo = document.getElementById('stat-saldo');
    if (elSaldo) {
        elSaldo.textContent = `Rp ${totalSaldoBersihGlobal.toLocaleString('id-ID')}`;
        // Jika minus, beri warna merah seperti pada halaman keuangan
        if (totalSaldoBersihGlobal < 0) {
            elSaldo.style.color = '#dc2626';
        } else {
            elSaldo.style.color = 'inherit';
        }
    }


    // 3. RENDER GRAFIK
    // --- Line Chart: Tren Produksi Telur (PREMIUM VERSION) ---
    const canvasEgg = document.getElementById('eggProductionChart');

    /* Referensi data produksi global agar bisa diakses oleh fungsi ganti periode */
    window._produksiBydateMap = produksiByDate;
    window._sortedProduksiDates = sortedDates;

    /**
     * Membangun dataset untuk sejumlah hari terakhir dari data produksi.
     * Mengembalikan objek { labels, totalData, baikData, cacatData }
     * @param {number} nHari - Jumlah hari yang ingin ditampilkan (7, 14, atau 30)
     */
    function buildEggDataset(nHari) {
        const dates = window._sortedProduksiDates.slice(-nHari);
        const totalData = dates.map(d => window._produksiBydateMap[d].total);
        const baikData  = dates.map(d => window._produksiBydateMap[d].baik);
        const cacatData = dates.map(d => window._produksiBydateMap[d].cacat);

        /* Label: TglNama hari + tanggal singkat, contoh "Senin 7 Apr" */
        const namaHari = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
        const namaBulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        const labels = dates.map(d => {
            const obj = new Date(d);
            /* Geser +1 hari karena new Date('YYYY-MM-DD') parse sebagai UTC midnight */
            obj.setDate(obj.getDate() + 1);
            return `${namaHari[obj.getDay()]} ${obj.getDate()} ${namaBulan[obj.getMonth()]}`;
        });

        return { labels, totalData, baikData, cacatData, dates };
    }

    /**
     * Memperbarui nilai 4 mini-stat di atas grafik.
     * @param {number[]} totalData
     * @param {number[]} baikData
     * @param {number[]} cacatData
     */
    function updateChartMiniStats(totalData, baikData, cacatData) {
        const sumTotal = totalData.reduce((s, v) => s + v, 0);
        const sumBaik  = baikData.reduce((s, v) => s + v, 0);
        const sumCacat = cacatData.reduce((s, v) => s + v, 0);
        const rata     = totalData.length > 0 ? Math.round(sumTotal / totalData.length) : 0;

        const elTotal = document.getElementById('chart-stat-total');
        const elBaik  = document.getElementById('chart-stat-baik');
        const elCacat = document.getElementById('chart-stat-cacat');
        const elRata  = document.getElementById('chart-stat-rata');

        if (elTotal) elTotal.textContent = sumTotal.toLocaleString('id-ID');
        if (elBaik)  elBaik.textContent  = sumBaik.toLocaleString('id-ID');
        if (elCacat) elCacat.textContent = sumCacat.toLocaleString('id-ID');
        if (elRata)  elRata.textContent  = rata.toLocaleString('id-ID');
    }

    /* Referensi instance Chart agar bisa di-destroy saat filter diganti */
    let eggChartInstance = null;

    /**
     * Membuat (atau memperbarui) Chart grafik produksi premium.
     * Dipanggil pertama kali saat halaman dimuat dan tiap kali tombol filter ditekan.
     * @param {number} nHari - Jumlah hari yang ditampilkan
     */
    function renderEggChart(nHari) {
        if (!canvasEgg) return;

        /* Hancurkan chart lama jika ada sebelum menggambar baru */
        if (eggChartInstance) {
            eggChartInstance.destroy();
            eggChartInstance = null;
        }

        const { labels, totalData, baikData, cacatData } = buildEggDataset(nHari);
        const adaData = totalData.some(v => v > 0);

        /* Tampilkan / sembunyikan overlay kosong */
        const overlay = document.getElementById('chartEmptyOverlay');
        if (overlay) overlay.style.display = adaData ? 'none' : 'flex';

        /* Perbarui mini-stat */
        updateChartMiniStats(totalData, baikData, cacatData);

        /* Update subtitle periode */
        const subtitle = document.querySelector('.chart-subtitle');
        if (subtitle) subtitle.textContent = `${nHari} Hari Terakhir`;

        const ctxEgg = canvasEgg.getContext('2d');

        /* --- Buat Gradient Fill Emas-Oranye untuk area di bawah garis --- */
        const gradientFill = ctxEgg.createLinearGradient(0, 0, 0, canvasEgg.offsetHeight || 280);
        gradientFill.addColorStop(0,   'rgba(251, 183, 3, 0.35)');   /* Emas cerah di atas */
        gradientFill.addColorStop(0.5, 'rgba(251, 133, 0, 0.15)');   /* Oranye tengah */
        gradientFill.addColorStop(1,   'rgba(251, 133, 0, 0.01)');   /* Transparan di bawah */

        /* --- Gradien garis (stroke) dari emas ke oranye --- */
        const gradientStroke = ctxEgg.createLinearGradient(0, 0, canvasEgg.offsetWidth || 400, 0);
        gradientStroke.addColorStop(0,   '#ffb703');
        gradientStroke.addColorStop(0.5, '#fb8500');
        gradientStroke.addColorStop(1,   '#e67e00');

        eggChartInstance = new Chart(ctxEgg, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        /* Dataset utama: Total Telur dengan area gradien */
                        label: 'Total Telur',
                        data: totalData,
                        borderColor: gradientStroke,
                        backgroundColor: gradientFill,
                        borderWidth: 3,
                        fill: true,
                        tension: 0.45,      /* Kurva halus bezier */
                        pointBackgroundColor: '#fff',
                        pointBorderColor: '#fb8500',
                        pointBorderWidth: 2.5,
                        pointRadius: 5,
                        pointHoverRadius: 8,
                        pointHoverBackgroundColor: '#fb8500',
                        pointHoverBorderColor: '#fff',
                        pointHoverBorderWidth: 2,
                    },
                    {
                        /* Dataset Telur Baik: titik hijau tanpa garis */
                        label: 'Telur Baik',
                        data: baikData,
                        borderColor: 'transparent',
                        backgroundColor: 'transparent',
                        pointBackgroundColor: '#10b981',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 7,
                        pointHoverBackgroundColor: '#059669',
                        showLine: false,
                    },
                    {
                        /* Dataset Telur Cacat: titik merah tanpa garis */
                        label: 'Telur Cacat',
                        data: cacatData,
                        borderColor: 'transparent',
                        backgroundColor: 'transparent',
                        pointBackgroundColor: '#ef4444',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 7,
                        pointHoverBackgroundColor: '#dc2626',
                        showLine: false,
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                interaction: {
                    /* Tooltip muncul untuk semua dataset saat hover di satu titik X */
                    mode: 'index',
                    intersect: false,
                },
                /* Animasi masuk dramatis dari bawah ke atas */
                animation: {
                    duration: 900,
                    easing: 'easeOutQuart',
                },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            usePointStyle: true,
                            pointStyle: 'circle',
                            padding: 18,
                            font: { size: 12, family: "'Poppins', sans-serif" },
                            color: '#475569',
                            boxWidth: 10,
                        }
                    },
                    tooltip: {
                        backgroundColor: '#1e293b',   /* Latar gelap premium */
                        titleColor: '#f1f5f9',
                        bodyColor: '#94a3b8',
                        borderColor: 'rgba(255,255,255,0.08)',
                        borderWidth: 1,
                        padding: 12,
                        cornerRadius: 12,
                        titleFont: { size: 13, weight: '700', family: "'Poppins', sans-serif" },
                        bodyFont: { size: 12, family: "'Poppins', sans-serif" },
                        displayColors: true,
                        boxWidth: 8,
                        boxHeight: 8,
                        callbacks: {
                            /* Judul tooltip: tampilkan tanggal lengkap */
                            title: function(items) {
                                return '📅 ' + items[0].label;
                            },
                            /* Isi tiap baris tooltip dengan format angka ribuan */
                            label: function(context) {
                                const labelMap = {
                                    'Total Telur': '🥚 Total',
                                    'Telur Baik':  '✅ Baik ',
                                    'Telur Cacat': '❌ Cacat',
                                };
                                const nama = labelMap[context.dataset.label] || context.dataset.label;
                                const val = Number(context.parsed.y).toLocaleString('id-ID');
                                return ` ${nama}: ${val} butir`;
                            },
                            /* Footer tooltip: tampilkan persentase telur baik */
                            afterBody: function(items) {
                                const totalItem = items.find(i => i.dataset.label === 'Total Telur');
                                const baikItem  = items.find(i => i.dataset.label === 'Telur Baik');
                                if (totalItem && baikItem && totalItem.parsed.y > 0) {
                                    const pct = ((baikItem.parsed.y / totalItem.parsed.y) * 100).toFixed(1);
                                    return [``, `📊 Kualitas: ${pct}% telur baik`];
                                }
                                return [];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false,         /* Hilangkan garis vertikal untuk tampilan bersih */
                        },
                        border: { display: false },
                        ticks: {
                            color: '#64748b',
                            font: { size: 11, family: "'Poppins', sans-serif" },
                            maxRotation: nHari > 14 ? 40 : 0, /* Miring jika banyak label */
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(241, 245, 249, 0.8)',    /* Garis horizontal abu sangat tipis */
                            drawBorder: false,
                        },
                        border: { display: false, dash: [4, 4] },
                        ticks: {
                            color: '#94a3b8',
                            font: { size: 11, family: "'Poppins', sans-serif" },
                            padding: 8,
                            /* Format angka Y menjadi singkatan (1.5 Rb / 1.2 Jt) */
                            callback: function(val) {
                                if (val >= 1000000) return (val / 1000000).toFixed(1) + ' Jt';
                                if (val >= 1000)    return (val / 1000).toFixed(0) + ' Rb';
                                return val;
                            }
                        }
                    }
                }
            }
        });
    }

    /* Render chart pertama kali dengan 7 hari */
    renderEggChart(7);

    /* Simpan referensi ke fungsi agar bisa dipanggil dari HTML onclick */
    window.gantiPeriodeGrafik = function(nHari, tombol) {
        /* Update style tombol filter aktif */
        document.querySelectorAll('.chart-filter-btn').forEach(btn => btn.classList.remove('active'));
        if (tombol) tombol.classList.add('active');

        /* Render ulang grafik dengan periode baru */
        renderEggChart(nHari);
    };

    // --- Bar Chart: Pemasukan vs Pengeluaran ---
    const canvasFinance = document.getElementById('financeChart');
    if (canvasFinance) {
        const ctxFinance = canvasFinance.getContext('2d');
        new Chart(ctxFinance, {
            type: 'bar',
            data: {
                labels: ['Minggu 1', 'Minggu 2', 'Minggu 3', 'Minggu 4'],
                datasets: [{
                    label: 'Pemasukan (Rp)',
                    data: financeIncomeData,
                    backgroundColor: '#10b981', // Emerald Green Dinamis
                    borderRadius: 5
                }, {
                    label: 'Pengeluaran (Rp)',
                    data: financeExpenseData,
                    backgroundColor: '#ef4444', // Red Dinamis
                    borderRadius: 5
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    },
                    tooltip: {
                        callbacks: {
                            // Formatting isi kotak hitam kecil (Tooltip) saat batang grafik di-hover agar ada awalan Rp
                            label: function (context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += 'Rp ' + context.parsed.y.toLocaleString('id-ID');
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            // Formatting gaya deret angka skala sumbu Y agar disingkat
                            callback: function (value) {
                                if (value >= 1000000) {
                                    return 'Rp ' + (value / 1000000) + ' Jt';
                                } else if (value >= 1000) {
                                    return 'Rp ' + (value / 1000) + ' Rb';
                                }
                                return 'Rp ' + value;
                            }
                        }
                    }
                }
            }
        });
    }

});