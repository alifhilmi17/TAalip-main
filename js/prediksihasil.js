/* =========================================================
   SISTEM ADMINISTRASI PETERNAKAN (SISTEM PAKAR MA)
   File: prediksihasil.js
   ---------------------------------------------------------
   Deskripsi singkat:
   File inti ini mendemonstrasikan Fitur Unggulan TA, yaitu 
   Sistem Peramalan (Forecasting) dengan Algoritma 'Moving Average'.
   Aplikasi memproses input data produksi masa lalu menjadi 
   kalkulasi matematika dinamis untuk meramal tren masa depan,
   lalu menampilkannya menggunakan grafik ganda (Dual-Axis Chart).
========================================================= */

// =========================================
// 1. FUNGSI NAVIGASI UMUM & PERALIHAN TAB
// Penjelasan: Fungsi estetik dan pergerakan DOM Element Sidebar 
// serta penggantian sub-menu Form Input (Tombol Toggle Tab).
// =========================================

/**
 * Membuka/menutup sistem menu list (accordion style) di sidebar samping.
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
 * Fungsi untuk berpindah tab antara input Produksi dan Keuntungan
 */
function switchHistoricalTab(tabName, btnElement) {
    // Sembunyikan semua tab
    document.getElementById('tabProduksi').style.display = 'none';
    document.getElementById('tabKeuntungan').style.display = 'none';

    // Hapus class active dari semua tombol tab
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => btn.classList.remove('active'));

    // Tampilkan tab yang dipilih dan aktifkan tombolnya
    if (tabName === 'produksi') {
        document.getElementById('tabProduksi').style.display = 'block';
    } else if (tabName === 'keuntungan') {
        document.getElementById('tabKeuntungan').style.display = 'block';
    }

    btnElement.classList.add('active');
}

/**
 * Fungsi sekunder apabila ikon pensil di Profil diklik.
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
 * Fungsi untuk mengeluarkan (logout) pengguna dan mereturn mereka ke layar Login.
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
// 2. KONTROLER ALGORITMA MOVING AVERAGE (MA CORE)
// Penjelasan: Blok skrip penting pemroses utama (Brain Logic).
// Menangani validasi matriks nilai H-Hari, melakukan rekursi 
// perhitungan rata-rata, lalu mendesain output laporan (Dom Update).
// =========================================

// Variabel Global untuk menyimpan state / objek grafik Chart.js 
let predictionChart = null;
let totalHistoryDays = 7; // Default jumlah hari riwayat

// Inisialisasi awal render input begitu halaman dimuat
document.addEventListener('DOMContentLoaded', () => {
    renderHistoricalInputs();
});

function changeHistoryCount(delta) {
    let inputEl = document.getElementById('jumlahHariHistoris');
    let current = parseInt(inputEl.value);
    if (isNaN(current)) current = 1;
    let newVal = current + delta;
    if (newVal < 1) newVal = 1;
    inputEl.value = newVal;
    totalHistoryDays = newVal;
    renderHistoricalInputs();
}

function manualChangeHistoryCount() {
    let inputEl = document.getElementById('jumlahHariHistoris');
    let current = parseInt(inputEl.value);
    if (isNaN(current) || current < 1) current = 1;
    inputEl.value = current;
    totalHistoryDays = current;
    renderHistoricalInputs();
}

function renderHistoricalInputs() {
    const prodContainer = document.getElementById('containerHistProd');
    const profitContainer = document.getElementById('containerHistProf');
    if (!prodContainer || !profitContainer) return;

    let periodeMA = parseInt(document.getElementById('periodeMA').value) || 5;

    // Simpan data sebelumnya supaya tidak hilang
    let oldProd = {};
    let oldProfit = {};
    for (let i = 0; i <= totalHistoryDays + 10; i++) {
        let pInp = document.getElementById(`hist${i}`);
        if (pInp !== null) oldProd[i] = pInp.value;
        let prInp = document.getElementById(`prof${i}`);
        if (prInp !== null) oldProfit[i] = prInp.value;
    }

    prodContainer.innerHTML = '';
    profitContainer.innerHTML = '';

    for (let i = totalHistoryDays - 1; i >= 0; i--) {
        let labelText = '';
        if (i === 0) {
            labelText = 'Hari Ini (Wajib)';
        } else if (i < periodeMA && totalHistoryDays >= periodeMA) {
            labelText = `H-${i} (Wajib)`;
        } else if (totalHistoryDays < periodeMA) {
            labelText = `H-${i} (Wajib ${totalHistoryDays}/${periodeMA})`;
        } else {
            labelText = `H-${i} (Opsi)`;
        }

        // Cek req
        let isToday = (i === 0);

        let labelStyleProd = isToday ? 'font-weight: 700; color: #d35400; background: #ffeaa7; padding: 3px 10px; border-radius: 6px; border-left: 3px solid #e67e22; box-shadow: 0 2px 5px rgba(0,0,0,0.05); display: inline-block; margin-bottom: 8px;' : '';
        let inputStyleProd = isToday ? 'border: 2px solid #f39c12; background: #fffcf2; font-size: 1.1rem; padding: 12px; box-shadow: inset 0 0 10px rgba(243, 156, 18, 0.1), 0 0 12px rgba(243, 156, 18, 0.15);' : '';

        let labelStyleProfit = isToday ? 'font-weight: 700; color: #218c46; background: #e8f8f0; padding: 3px 10px; border-radius: 6px; border-left: 3px solid #2ecc71; box-shadow: 0 2px 5px rgba(0,0,0,0.05); display: inline-block; margin-bottom: 8px;' : '';
        let inputStyleProfit = isToday ? 'border: 2px solid #27ae60; background: #f2fbf6; font-size: 1.1rem; padding: 12px; box-shadow: inset 0 0 10px rgba(46, 204, 113, 0.1), 0 0 12px rgba(46, 204, 113, 0.15);' : '';

        let colSpanStyle = isToday ? 'style="grid-column: span 2;"' : '';

        prodContainer.innerHTML += `
            <div class="form-group-mini" ${colSpanStyle}>
                <label style="${labelStyleProd}">${labelText}</label>
                <input type="number" id="hist${i}" class="hist-input" placeholder="-" step="any" min="0" style="${inputStyleProd}" value="${oldProd[i] || ''}">
            </div>
        `;

        profitContainer.innerHTML += `
            <div class="form-group-mini" ${colSpanStyle}>
                <label style="${labelStyleProfit}">${labelText}</label>
                <input type="number" id="prof${i}" class="hist-input" placeholder="-" step="any" style="${inputStyleProfit}" value="${oldProfit[i] || ''}">
            </div>
        `;
    }
}

/**
 * Fungsi Utama `calculatePrediction`!
 * Berjalan ketika menekan tombol "Analisis dengan MA".
 * @param {Event} event - Dioper dari eksekusi form 'onsubmit', diproteksi dengan .preventDefault() agar laman web tidak reload patah-patah.
 */
function calculatePrediction(event) {
    event.preventDefault(); // Menghentikan perilaku form memuat ulang halaman

    // --- STEP 1: Mengambil Data Parameter / Pengaturan Statik ---
    // (di bagian form sebelah bawah-kiri)
    const periodeMA = parseInt(document.getElementById('periodeMA').value);
    const populasi = parseInt(document.getElementById('populasi').value); // Ekor
    const pakanPerEkor = parseFloat(document.getElementById('pakanPerEkor').value); // dalam satuan Gram (g)
    const hargaPakan = parseInt(document.getElementById('hargaPakan').value); // Rp per kg
    const hargaTelur = parseInt(document.getElementById('hargaTelur').value); // Rp per kg

    // --- STEP 2A & 2B: Mengumpulkan Data Input Historis secara Dinamis ---
    const inputs = [];
    const inputsProfit = [];
    for (let i = totalHistoryDays - 1; i >= 0; i--) {
        inputs.push(document.getElementById(`hist${i}`));
        inputsProfit.push(document.getElementById(`prof${i}`));
    }

    // --- STEP 3: Proses Validasi (Pengecekan Keamanan) Form ---
    if (totalHistoryDays < periodeMA) {
        Swal.fire({
            icon: 'error',
            title: 'Kurang Data Historis',
            text: `Anda memilih Periode MA = ${periodeMA} Hari, sehingga Anda harus menginput data historis setidaknya selama ${periodeMA} hari! (Saat ini Anda hanya memiliki ${totalHistoryDays} hari data)`,
            confirmButtonColor: '#3085d6'
        });
        return;
    }

    // Memastikan N-data terakhir sesuai periode MA tidak boleh kosong
    let startIndex = totalHistoryDays - periodeMA;
    let isDataValid = true;
    for (let i = startIndex; i < totalHistoryDays; i++) {
        let val = parseFloat(inputs[i].value);
        if (isNaN(val)) {
            isDataValid = false;
            break;
        }
    }

    // Jika blok produksi ada yang bolong
    if (!isDataValid) {
        Swal.fire({
            icon: 'error',
            title: 'Data Tidak Lengkap',
            text: `Mohon isi semua data jumlah historis (Butir) sedari H-${periodeMA - 1} hingga Hari Ini!`,
            confirmButtonColor: '#3085d6'
        });
        return;
    }

    // Lakukan validasi produksi keuntungan historis
    for (let i = startIndex; i < totalHistoryDays; i++) {
        let val = parseFloat(inputsProfit[i].value);
        if (isNaN(val)) {
            Swal.fire({
                icon: 'error',
                title: 'Data Keuntungan Tidak Lengkap',
                text: `Mohon isi semua data keuntungan historis uang (Rp) Anda sedari H-${periodeMA - 1} hingga Hari Ini!`,
                confirmButtonColor: '#3085d6'
            });
            return;
        }
    }

    // --- STEP 4: Ekstraksi Data yang Sudah Diverifikasi ---
    // Simpan semua input (dari paling atas hingga Hari Ini) yang ada isinya menjadi array.
    let fullHistoryButir = [];
    let startActual = 0;
    while (startActual < totalHistoryDays && isNaN(parseFloat(inputs[startActual].value))) {
        startActual++;
    }

    let fullHistoryProfit = [];
    for (let i = startActual; i < totalHistoryDays; i++) {
        fullHistoryButir.push(parseFloat(inputs[i].value));
        fullHistoryProfit.push(parseFloat(inputsProfit[i].value));
    }

    // KONVERSI EMAS MA (Butir -> Kilogram)
    // Parameter hitungan kita pakai Kg, namun petani nyaman pakai Butir.
    // Maka (Asumsi 1 Kg = sekitar 16 Butir Telur Kecil). Nilai array Butir dipetakan ke wujud Kilogram (Kg).
    let fullHistoryKg = fullHistoryButir.map(butir => butir / 16);

    // --- STEP 5: MELAKUKAN KALKULASI PINTAR PREDIKSI "HARI ESOK" (H+1) ---
    // Ambil rentang index sepotong sebanyak periode MA terakhir (contoh MA 5 = 5 angka terakhir dari ujung history list)
    let sliceForPredict = fullHistoryKg.slice(-periodeMA);

    // a. Menjumlahkan (Summation) nilai dari himpunan tsb
    let sumKg = sliceForPredict.reduce((a, b) => a + b, 0);

    // b. Rumus Inti "Moving Average" : Cari Rata-Ratanya. 
    // Rata-rata periode ini adalah Hasil Ramalan Produksi HARI ESOK (Hari + 1).
    let prediksiBesokKg = sumKg / periodeMA;

    // --- STEP 6: KALKULASI LAPORAN UANG/FINANSIAL HARI ESOK ---
    let prediksiBesokButir = Math.round(prediksiBesokKg * 16); // Konver kembali ke butir secara integer tak desimal (Dibulatkan)
    let estimasiPendapatan = prediksiBesokKg * hargaTelur;     // Total Uang Penjualan
    let totalPakanKg = (populasi * pakanPerEkor) / 1000;       // Butuh pakan berapa sekandang perharinya? (/1000 konversi karena pakan dari input beralias gram)
    let biayaPakan = totalPakanKg * hargaPakan;                // Biaya Operasional / Modal Cost
    let keuntungan = estimasiPendapatan - biayaPakan;          // Sisa Laba Bersih Petani (Net Profit)

    // --- STEP 7: MEMASUKKAN NILAI KE PANEL ANTARMUKA (DOM UPGRADE) ---
    // Masukkan data hasil perhitungan ke dalam Text HTML Card sebelah atas Chart.
    document.getElementById('outProduksi').textContent = `${prediksiBesokKg.toFixed(2)} Kg`;
    document.getElementById('outButir').textContent = `${prediksiBesokButir.toLocaleString('id-ID')} Butir`;
    document.getElementById('outPendapatan').textContent = `Rp ${Math.round(estimasiPendapatan).toLocaleString('id-ID')}`;
    document.getElementById('outBiayaPakan').textContent = `Rp ${Math.round(biayaPakan).toLocaleString('id-ID')}`;
    document.getElementById('outKeuntungan').textContent = `Rp ${Math.round(keuntungan).toLocaleString('id-ID')}`;

    // Fitur Tambahan Cerdas: Jika keuntungannya (Laba Besih) MINUS (Negatif/Rugi)
    // maka kita merubah tema warna kotak Margin nya dari Biru/Hijau, langsung menjadi MERAH SIAGA BENCANA!
    const resultCardsContainer = document.getElementById('resultCards');
    const highlightCard = resultCardsContainer.querySelector('.highlight-card');
    const statIcon = highlightCard.querySelector('.stat-icon');

    if (keuntungan < 0) { // Rugi!
        statIcon.classList.remove('blue-bg', 'green-bg');
        statIcon.classList.add('red-bg');
        highlightCard.querySelector('h4').textContent = "Proyeksi Kerugian";
        highlightCard.querySelector('p').classList.add('highlight-text-red');
        highlightCard.querySelector('p').classList.remove('highlight-text-green');
        highlightCard.classList.remove('bg-keuntungan');
        highlightCard.classList.add('bg-biaya');
    } else { // Untung!
        statIcon.classList.remove('red-bg', 'blue-bg');
        statIcon.classList.add('green-bg');
        highlightCard.querySelector('h4').textContent = "Proyeksi Keuntungan";
        highlightCard.querySelector('p').classList.add('highlight-text-green');
        highlightCard.querySelector('p').classList.remove('highlight-text-red');
        highlightCard.classList.remove('bg-biaya');
        highlightCard.classList.add('bg-keuntungan');
    }

    // --- STEP 8: PREDIKSI MASA DEPAN (MERAMAL 7 HARI KEDEPAN SEKALIGUS) ---
    let proyeksi7HariKg = [];
    let proyeksi7HariKeuntungan = [];

    // Klone memori array (Spread copy array [...]) untuk dimanipulasi sementara dalam memory perulangan.
    let tempHistory = [...fullHistoryKg];

    for (let i = 0; i < 7; i++) { // Loop lompat simulasi dimensi hari+1 s.d hari+7
        // Cari Rata2 MA dari rentang 5 data terbaru (Yang selalu bergeser ke kanan hari demi harinya)
        let currentWindow = tempHistory.slice(-periodeMA);
        let currSum = currentWindow.reduce((a, b) => a + b, 0);
        let nextPredKg = currSum / periodeMA;

        proyeksi7HariKg.push(nextPredKg); // Simpan hasil angka timbangan esok hari ke antrian plot Chart

        // Asumsi operasional pengeluaran akan berjalan statis/konsisten tiap harinya
        let nextKeuntungan = (nextPredKg * hargaTelur) - biayaPakan;
        proyeksi7HariKeuntungan.push(nextKeuntungan);

        // Kunci Magis Algoritma MA Rantai (Chaining):
        // Mendorong nilai prediksi H+ sekian ini, masuk ke barisan SEJARAH TERBARU dalam antrian virtual!
        // Supaya saat prediksi "H+ besok"nya lagi, hari yang diprediksikan itu menggunakan hasil tebakan hari sebelumnya ini pula. (Moving Window)
        tempHistory.push(nextPredKg);
    }

    // Ambil Data Profit manual murni. (Sebelah kiri Chart)
    let historyKeuntunganAct = fullHistoryProfit;

    // --- STEP 9: JALANKAN PROSESS PENGGAMBARAN KE KANVAS (RENDER GRAFIK CHART.JS) ---
    // Dipecah dan ditransfer menjadi parameter argumen fungsi lain dibawah sana.
    updateChart(fullHistoryKg, historyKeuntunganAct, proyeksi7HariKg, proyeksi7HariKeuntungan);

    // --- STEP 10: MEMPERBARUI TABEL HASIL REKAPAN PREDIKSI ---
    let tableBody = document.getElementById('rekapanTableBody');
    if (tableBody) {
        tableBody.innerHTML = '';
        for (let i = 0; i < 7; i++) {
            let pKg = proyeksi7HariKg[i];
            let butir = Math.round(pKg * 16);
            let profit = proyeksi7HariKeuntungan[i];
            let rpFormat = Math.round(profit).toLocaleString('id-ID');
            let profitStyle = profit < 0 ? "color: #e74c3c; font-weight: 700;" : "color: #27ae60; font-weight: 700;";

            let tr = document.createElement('tr');
            tr.style.borderBottom = "1px solid #f1f2f6";

            // Hover effect can be simple or done without events by using inline and simple colors
            // Since it's inline, we stay clean.
            tr.innerHTML = `
                <td style="padding: 16px; color: #2c3e50; font-weight: 700; border-right: 1px solid rgba(0,0,0,0.05); text-align: center; background: rgba(255,255,255,0.4);">
                    <span style="background: #34495e; color: white; padding: 4px 10px; border-radius: 6px;">H+${i + 1}</span>
                </td>
                <td style="padding: 16px; color: #2c3e50; border-right: 1px solid rgba(0,0,0,0.05);">
                    <span style="font-weight: 700; color: #2980b9; font-size: 1.05rem;">${pKg.toFixed(2)} Kg</span> 
                    <span style="font-size: 0.85rem; color: #7f8c8d; margin-left: 6px; font-weight: 500;">(~${butir.toLocaleString('id-ID')} Butir)</span>
                </td>
                <td style="padding: 16px; ${profitStyle} font-size: 1.05rem;">
                    Rp ${rpFormat}
                </td>
            `;
            tableBody.appendChild(tr);
        }
    }

    // Kirim notifikasi manis perihal hasil Laba Hari Esok (Satu hari di depan).
    Swal.fire({
        icon: 'success',
        title: 'Analisis Cerdas Berhasil',
        html: `Berdasarkan pola MA-${periodeMA}, besok diproyeksikan untung/rugi sebesar <b>Rp ${Math.round(keuntungan).toLocaleString('id-ID')}</b>.`,
        timer: 3500, // Pop up kilat 3.5 detik (menghilang sendiri kalau dibiarkan)
        showConfirmButton: true,
        confirmButtonColor: '#48bb78',
        confirmButtonText: 'Tutup'
    });
}


/**
 * Fungsi Sub-Renderer: ChartJS Maker.
 * Memuat dua sisi sumbu Axis (Kg vs Rupiah). Sumbu kiri dan Sumbu kanan bertumpang tindih secara canggih.
 */
function updateChart(historyKg, historyKeuntungan, predictKg, predictKeuntungan) {
    const ctx = document.getElementById('profitChart').getContext('2d');

    // Mencegah 'Glitches' grafik duplikat karena pengguna klik analisis berkali-kali - Destroy jika kanvas bernyawa tua.
    if (predictionChart) {
        predictionChart.destroy();
    }

    let labels = []; // Untuk wadah teks garis x (bawah)

    let dataHistoryKg = [];
    let dataPredictKg = [];
    let dataHistoryKeuntungan = [];
    let dataPredictKeuntungan = [];

    // --- Bagian A: Membuat Tata Riwayat Grafik Historis Kiri ---
    // (Dari rentang H minus lama sampai Hari Ini=H minus nol/0)
    for (let i = historyKg.length; i > 0; i--) {
        labels.push(i === 1 ? "Hari Ini" : `H-${i - 1}`); // Menyusun nama hari bawah
        dataHistoryKg.push(historyKg[historyKg.length - i]);
        dataHistoryKeuntungan.push(historyKeuntungan[historyKeuntungan.length - i]);

        // Masa depan bernilai Null supaya tidak muncul titik merah prediksi di alam historis.
        dataPredictKg.push(null);
        dataPredictKeuntungan.push(null);
    }

    // --- TRICK GRAFIK CANGGIH (Penyambung Tali) ---
    // Paksa agar awal garis Proyeksi (Masa Depan) "Mengakar" bersentuhan menyambung utuh dengan titik penghabisan historis "Hari Ini" 
    dataPredictKg[dataPredictKg.length - 1] = historyKg[historyKg.length - 1];
    dataPredictKeuntungan[dataPredictKeuntungan.length - 1] = historyKeuntungan[historyKeuntungan.length - 1];

    // --- Bagian B: Membuat Tata Riwayat Grafik PREDIKSI Kanan (Esok Harinya) ---
    // Plot hasil ramalan (H+1 sd H+7 ke kanan layar)
    for (let i = 0; i < predictKg.length; i++) {
        labels.push(`H+${i + 1}`);
        dataHistoryKg.push(null);       // Sisi riwayat mati
        dataHistoryKeuntungan.push(null); // Sisi riwayat mati

        dataPredictKg.push(predictKg[i]); // Hidup
        dataPredictKeuntungan.push(predictKeuntungan[i]); // Hidup
    }

    // --- FINALISASI RENDER CHART INSTANCE BARU ---
    predictionChart = new Chart(ctx, {
        type: 'line', // Jenis Grafik Garis Sambung
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Aktual Produksi (Kg)',  // Dataset 1: Biru Terang (Timbangan Pasti)
                    data: dataHistoryKg,
                    borderColor: '#3498db',
                    backgroundColor: '#3498db',
                    borderWidth: 3,
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    tension: 0.4, // Melengkung mulus bak gelombang air, bukan patah zig-zag
                    yAxisID: 'y' // Menginduk pada Timbangan Y bagian Kiri
                },
                {
                    label: 'Proyeksi Produksi (Kg)', // Dataset 2: Kuning Terang (Tebakan MA Masa Depan)
                    data: dataPredictKg,
                    borderColor: '#f39c12',
                    backgroundColor: '#f39c12',
                    borderDash: [5, 5], // Striped / Garis Terputus-putus
                    borderWidth: 3,
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    tension: 0.4,
                    yAxisID: 'y'
                },
                {
                    label: 'Aktual Keuntungan (Rp)', // Dataset 3: Hijau Berlatar tipis (Dompet Real)
                    data: dataHistoryKeuntungan,
                    borderColor: '#27ae60',
                    backgroundColor: 'rgba(39, 174, 96, 0.15)', // Fill bawah
                    borderWidth: 2,
                    fill: 'origin', // Pewarnaan transparan dari dasar x mengarsir tembus ketas garis line nya.
                    pointRadius: 4,
                    tension: 0.4,
                    yAxisID: 'y1' // Menginduk pada Skala Uang Y1 bagian Kanan Ujung!
                },
                {
                    label: 'Proyeksi Keuntungan (Rp)', // Dataset 4: Merah (Pertaruhan Rupiahnya)
                    data: dataPredictKeuntungan,
                    borderColor: '#e74c3c',
                    backgroundColor: 'rgba(231, 76, 60, 0.1)',
                    borderDash: [5, 5], // Putus-putus
                    borderWidth: 2,
                    fill: 'origin',
                    pointRadius: 4,
                    tension: 0.4,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, // Menyesuaikan wadah layar div bungkusnya
            interaction: {
                mode: 'index',
                intersect: false, // Disorot dari jauh aja lgsung muncul semua data vertikal popup nya.
            },
            plugins: {
                legend: {
                    position: 'bottom', // Kotak keterangan ditaruh dasar bawah
                    labels: {
                        usePointStyle: true, // Jadi Ikon titik sircle
                        boxWidth: 8,
                        padding: 20
                    }
                },
                // Aturan Khusus Balon PopUp Angka Detail (Hover Tooltip Mode)
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            // Kita punya 4 dataset.
                            // Idx 0 (His. Kg) dan Idx 1 (Pred. Kg) menggunakan satuan Kilogram serta wujud Butir rahib
                            if (context.parsed.y !== null) {
                                if (context.datasetIndex < 2) {
                                    let butir = Math.round(context.parsed.y * 16);
                                    label += context.parsed.y.toFixed(2) + ' Kg (' + butir.toLocaleString('id-ID') + ' Butir)';
                                } else {
                                    // Idx 2 و Idx 3 memegang satuan Rupiah Rp untuk keuangan/laba bersih.
                                    label += 'Rp ' + Math.round(context.parsed.y).toLocaleString('id-ID');
                                }
                            }
                            return label;
                        }
                    }
                }
            },
            // Struktur Sumbu Ganda (Dual Axes) Skala Kiri VS Kanan 
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left', // Di kiri garis grafis ini
                    title: {
                        display: true,
                        text: 'Produksi (Kg)',
                        font: { weight: 'bold' }
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right', // Di kanan membentang paralel sepadan sumbu Y kiri
                    title: {
                        display: true,
                        text: 'Finansial (Rp)',
                        font: { weight: 'bold' }
                    },
                    grid: {
                        drawOnChartArea: false // Mencegah Jala/garis kotak pudar grafik yang bertumpuk kusut 
                    }
                }
            }
        }
    });
}
