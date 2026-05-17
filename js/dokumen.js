/* =========================================================
   SISTEM ADMINISTRASI PETERNAKAN (LIBAS)
   File: dokumen.js
   Deskripsi: Logika halaman Pusat Dokumen & Laporan (FIRESTORE).
   Mempusatkan seluruh data dari semua modul untuk pratinjau, 
   ekspor file excel, dan cetak laporan secara real-time.
========================================================= */

import { 
    collection, 
    onSnapshot, 
    query, 
    orderBy,
    addDoc,
    serverTimestamp,
    limit,
    getDocs,
    writeBatch
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { db } from "../firebase.component/firebase-init.js";

/**
 * Utilitas untuk mengamankan input teks dari serangan XSS (Cross-Site Scripting).
 * Mengubah karakter khusus HTML menjadi entitas karakter (escape).
 */

// State Global untuk menyimpan data dari Firestore
let state = {
    produksi: [],
    pakan: [],
    keuangan: [],
    ayam: [],
    kesehatan: [],
    vaksinasi: [],
    prediksi: []  // Histori hasil prediksi MA
};

// =========================================
// 1. TAMPILKAN TANGGAL HARI INI
// =========================================
/**
 * Menampilkan nama hari dan tanggal saat ini di header halaman
 */
function tampilkanTanggalHariIni() {
    const el = document.getElementById('tanggalHariIni');
    if (!el) return;
    const opsi = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const tglStr = new Date().toLocaleDateString('id-ID', opsi); // Format Indonesia
    el.textContent = `📅 ${tglStr.charAt(0).toUpperCase() + tglStr.slice(1)}`;
}

// =========================================
// 2. INISIALISASI & FIREBASE LISTENERS
// =========================================
document.addEventListener('DOMContentLoaded', async () => {
    tampilkanTanggalHariIni();
    tambahLog(' Halaman Pusat Dokumen dibuka', '📂');

    try {
        // Ambil semua data sekaligus menggunakan Promise.all untuk performa maksimal
        const [
            snapProduksi, snapPakan, snapKeuangan, snapAyam, 
            snapKesehatan, snapVaksinasi, snapPrediksi, snapLogs
        ] = await Promise.all([
            getDocs(query(collection(db, "produksi_harian"), orderBy("tanggal", "desc"))),
            getDocs(query(collection(db, "stok_pakan"), orderBy("tanggal", "desc"))),
            getDocs(query(collection(db, "keuangan"), orderBy("tanggal", "desc"))),
            getDocs(query(collection(db, "populasi_ayam"), orderBy("tglMasuk", "desc"))),
            getDocs(query(collection(db, "kesehatan_ayam"), orderBy("tanggal", "desc"))),
            getDocs(query(collection(db, "vaksinasi_ayam"), orderBy("tanggal", "desc"))),
            getDocs(query(collection(db, "prediksi_history"), orderBy("tanggal", "desc"))),
            getDocs(query(collection(db, "aktivitas_ekspor"), orderBy("tanggal", "desc"), limit(25)))
        ]);

        state.produksi = snapProduksi.docs.map(d => ({ id: d.id, ...d.data() }));
        state.pakan = snapPakan.docs.map(d => ({ id: d.id, ...d.data() }));
        state.keuangan = snapKeuangan.docs.map(d => ({ id: d.id, ...d.data() }));
        state.ayam = snapAyam.docs.map(d => ({ id: d.id, ...d.data() }));
        state.kesehatan = snapKesehatan.docs.map(d => ({ id: d.id, ...d.data() }));
        state.vaksinasi = snapVaksinasi.docs.map(d => ({ id: d.id, ...d.data() }));
        state.prediksi = snapPrediksi.docs.map(d => ({ id: d.id, ...d.data() }));
        
        const logs = snapLogs.docs.map(d => ({ id: d.id, ...d.data() }));
        
        perbaruiUI();
        perbaruiLogUI(logs);
    } catch (error) {
        console.error("Gagal mengambil data untuk dokumen:", error);
        Swal.fire("Error", "Gagal memuat data dari server.", "error");
    }

    // Auto open submenu Dokumen di Sidebar
    const dokSubMenu = document.getElementById('dokumenSubmenu');
    if (dokSubMenu) {
        dokSubMenu.classList.add('show');
        dokSubMenu.setAttribute('aria-hidden', 'false');
        const dokBtn = dokSubMenu.previousElementSibling;
        if (dokBtn) {
            dokBtn.setAttribute('aria-expanded', 'true');
            dokBtn.classList.add('active-parent');
        }
    }
});

// =========================================
// 3. UI UPDATE LOGIC
// =========================================
/**
 * Fungsi sentral untuk memperbarui seluruh tampilan data di halaman Dokumen
 */
function perbaruiUI() {
    perbaruiRingkasan(); // Angka-angka total entri
    tampilkanPreview(); // Baris-baris data terbaru
}

/**
 * Memperbarui angka indikator jumlah total data yang tersimpan di Firestore untuk setiap modul
 */
function perbaruiRingkasan() {
    if (document.getElementById('count-produksi')) document.getElementById('count-produksi').textContent = `${state.produksi.length} Entri`;
    if (document.getElementById('count-pakan')) document.getElementById('count-pakan').textContent = `${state.pakan.length} Entri`;
    if (document.getElementById('count-keuangan')) document.getElementById('count-keuangan').textContent = `${state.keuangan.length} Entri`;
    if (document.getElementById('count-ayam')) document.getElementById('count-ayam').textContent = `${state.ayam.length} Entri`;
    if (document.getElementById('count-kesehatan')) document.getElementById('count-kesehatan').textContent = `${state.kesehatan.length} Entri`;
    if (document.getElementById('count-vaksinasi')) document.getElementById('count-vaksinasi').textContent = `${state.vaksinasi.length} Entri`;
    // Update ringkasan prediksi jika elemen tersedia
    if (document.getElementById('count-prediksi')) document.getElementById('count-prediksi').textContent = `${state.prediksi.length} Entri`;
}

/**
 * Mengisi section preview di UI dengan ringkasan singkat data terbaru dari database
 */
function tampilkanPreview() {
    // 1. Produksi Preview: Menampilkan total telur harian
    renderPreview('preview-produksi', state.produksi, (item) => {
        const tgl = formatTanggalPreview(item.tanggal);
        const total = Number(item.totalTelur || 0).toLocaleString('id-ID');
        const batch = item.batchLabel ? item.batchLabel.split(' - ')[0] : 'N/A';
        return `
        <div class="preview-row">
            <span class="preview-label">📅 ${tgl} &nbsp;|&nbsp; ${batch}</span>
            <span class="preview-val">🥚 ${total} butir</span>
        </div>`;
    });

    // 2. Pakan Preview: Menampilkan aliran masuk/keluar pakan
    renderPreview('preview-pakan', state.pakan, (item) => {
        const tgl = formatTanggalPreview(item.tanggal);
        const ikon = item.tipe === 'Masuk' ? '📥' : '📤';
        const warna = item.tipe === 'Masuk' ? '#10b981' : '#ef4444';
        const jumlah = Number(item.jumlah || 0).toLocaleString('id-ID');
        return `
        <div class="preview-row">
            <span class="preview-label">${ikon} ${tgl} &nbsp;|&nbsp; ${item.jenis || '-'}</span>
            <span class="preview-val" style="color:${warna}">${item.tipe} ${jumlah} kg</span>
        </div>`;
    });

    // 3. Keuangan Preview: Menampilkan ringkasan transaksi
    renderPreview('preview-keuangan', state.keuangan, (item) => {
        const tgl = formatTanggalPreview(item.tanggal);
        const warna = item.tipe === 'pemasukan' ? '#10b981' : '#ef4444';
        const prefix = item.tipe === 'pemasukan' ? '+' : '-';
        const nominal = Number(item.jumlah || 0).toLocaleString('id-ID');
        const desc = escapeHTML(item.deskripsi || '-').substring(0, 22) + ((item.deskripsi || '').length > 22 ? '…' : '');
        return `
        <div class="preview-row">
            <span class="preview-label">📅 ${tgl} | ${desc}</span>
            <span class="preview-val" style="color:${warna}">${prefix} Rp ${nominal}</span>
        </div>`;
    });

    // 4. Ayam Preview: Menampilkan status populasi per batch
    renderPreview('preview-ayam', state.ayam, (item) => {
        const sisaStr = Number(item.sisaAyam || 0).toLocaleString('id-ID');
        const warnaBadge = item.status === 'Aktif' ? '#10b981' : item.status === 'Panen' ? '#3b82f6' : '#f59e0b';
        const customId = item.customId || (item.id.length > 8 ? item.id.substring(0, 5) : item.id);
        return `
        <div class="preview-row">
            <span class="preview-label">🐓 ${customId} &nbsp;|&nbsp; ${escapeHTML(item.jenis || '-')}</span>
            <span class="preview-val">
                ${sisaStr} ekor
                <span style="font-size:0.65rem;background:${warnaBadge};color:#fff;padding:1px 4px;border-radius:4px;margin-left:4px;">${item.status}</span>
            </span>
        </div>`;
    });

    // 5. Kesehatan Preview: Menampilkan angka ayam sakit/mati
    renderPreview('preview-kesehatan', state.kesehatan, (item) => {
        const tgl = formatTanggalPreview(item.tanggal);
        const batch = escapeHTML(item.batchName || 'N/A');
        const sakit = item.jmlSakit || 0;
        const mati = item.jmlMati || 0;
        return `
        <div class="preview-row">
            <span class="preview-label">🩺 ${tgl} &nbsp;|&nbsp; ${batch}</span>
            <span class="preview-val">
                <span style="color:#f59e0b">🤒 ${sakit}</span> / <span style="color:#ef4444">💀 ${mati}</span>
            </span>
        </div>`;
    });

    // 6. Vaksinasi Preview
    renderPreview('preview-vaksinasi', state.vaksinasi, (item) => {
        const tgl = formatTanggalPreview(item.tanggal);
        const warna = item.status === 'Selesai' ? '#10b981' : '#f59e0b';
        const jenis = escapeHTML(item.jenis || '-');
        const metode = escapeHTML(item.metode || '-');
        return `
        <div class="preview-row">
            <span class="preview-label">💉 ${tgl} &nbsp;|&nbsp; ${jenis}</span>
            <span class="preview-val" style="color:${warna}">${metode}</span>
        </div>`;
    });

    // 7. Prediksi Preview: Menampilkan ringkasan histori analisis MA
    renderPreview('preview-prediksi', state.prediksi, (item) => {
        const tgl = new Date(item.tanggal);
        const tglStr = tgl.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
        const waktuStr = tgl.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        const profit = Math.round(item.keuntungan || 0);
        const warna = profit >= 0 ? '#10b981' : '#ef4444';
        const prefix = profit >= 0 ? '+' : '';
        return `
        <div class="preview-row">
            <span class="preview-label">🧠 ${tglStr} ${waktuStr} &nbsp;|&nbsp; MA-${item.periodeMA}</span>
            <span class="preview-val" style="color:${warna}">${prefix}Rp ${profit.toLocaleString('id-ID')}</span>
        </div>`;
    });
}

function renderPreview(elementId, data, templateFn) {
    const el = document.getElementById(elementId);
    if (!el) return;
    if (data.length === 0) {
        el.innerHTML = '<p class="empty-preview">Belum ada data untuk ditampilkan.</p>';
        return;
    }
    const previewData = data.slice(0, 5);
    el.innerHTML = previewData.map(templateFn).join('');
}

function formatTanggalPreview(tgl) {
    if (!tgl) return '-';
    return new Date(tgl).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

// =========================================
// 4. EKSPOR CSV
// =========================================
/**
 * Mengekspor data modul tertentu ke dalam format file CSV (.csv)
 * @param {string} modul - Nama modul (produksi, pakan, keuangan, dll)
 */
/**
 * Helper untuk menyiapkan struktur data (Header & Baris) yang akan digunakan oleh Excel
 */
function ambilDataTabel(modul, data) {
    let headers = [];
    let rows = [];
    const sanitize = (v) => v === undefined || v === null ? '' : String(v);

    switch (modul) {
        case 'produksi':
            headers = ['ID', 'Tanggal', 'Batch', 'Jenis Telur', 'Kandang', 'Baik', 'Cacat', 'Total'];
            rows = data.map(d => [d.id, d.tanggal, d.batchLabel, d.jenisTelur, d.kandang, d.telurBaik, d.telurCacat, d.totalTelur].map(sanitize));
            break;
        case 'pakan':
            headers = ['ID', 'Tanggal', 'Tipe', 'Jenis', 'Jumlah(Kg)', 'Keterangan'];
            rows = data.map(d => [d.id, d.tanggal, d.tipe, d.jenis, d.jumlah, d.keterangan].map(sanitize));
            break;
        case 'keuangan':
            headers = ['ID', 'Tanggal', 'Tipe', 'Deskripsi', 'Jumlah(Rp)'];
            rows = data.map(d => [d.id, d.tanggal, d.tipe, d.deskripsi, d.jumlah].map(sanitize));
            break;
        case 'ayam':
            headers = ['ID', 'CustomID', 'Tgl Masuk', 'Jenis', 'Jumlah Awal', 'Sisa Ayam', 'Kandang', 'Status'];
            rows = data.map(d => [d.id, d.customId, d.tglMasuk, d.jenis, d.jumlahAwal, d.sisaAyam, d.kandang, d.status].map(sanitize));
            break;
        case 'kesehatan':
            headers = ['ID', 'Tanggal', 'Batch', 'Kandang', 'Gejala', 'Jml Sakit', 'Jml Mati', 'Penanganan', 'Status'];
            rows = data.map(d => [d.id, d.tanggal, d.batchName, d.kandang, d.gejala, d.jmlSakit, d.jmlMati, d.penanganan, d.status].map(sanitize));
            break;
        case 'vaksinasi':
            headers = ['ID', 'Tanggal', 'Batch', 'Kandang', 'Jenis Vaksin', 'Metode', 'Status', 'Catatan'];
            rows = data.map(d => [d.id, d.tanggal, d.batchName, d.kandang, d.jenis, d.metode, d.status, d.catatan].map(sanitize));
            break;
        case 'prediksi':
            headers = ['ID', 'Tanggal Analisis', 'Batch/Populasi', 'Periode MA', 'Populasi (Ekor)', 'Prediksi Produksi (Kg)', 'Prediksi Produksi (Butir)', 'Estimasi Pendapatan (Rp)', 'Biaya Pakan (Rp)', 'Proyeksi Laba (Rp)', 'Status Keuangan', 'Rekomendasi Utama'];
            rows = data.map(d => [
                d.id,
                new Date(d.tanggal).toLocaleString('id-ID'),
                d.batchLabel || '-',
                d.periodeMA,
                d.populasi,
                d.prediksiBesokKg ? d.prediksiBesokKg.toFixed(2) : '0',
                d.prediksiBesokButir || '0',
                Math.round(d.estimasiPendapatan || 0),
                Math.round(d.biayaPakan || 0),
                Math.round(d.keuntungan || 0),
                (d.keuntungan || 0) >= 0 ? 'UNTUNG' : 'RUGI',
                d.rekomendasiUtama || '-'
            ].map(sanitize));
            break;
    }
    return { headers, rows };
}

window.eksporCSV = async function(modul) {
    const data = state[modul];
    if (!data || data.length === 0) {
        Swal.fire('Info', `Data laporan ${modul} masih kosong.`, 'info');
        return;
    }

    const { headers, rows } = ambilDataTabel(modul, data);
    
    // Inisialisasi Workbook ExcelJS
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(modul.toUpperCase());

    // 1. Set Kolom dan Header
    worksheet.columns = headers.map(h => ({
        header: h,
        key: h,
        width: 15
    }));

    // 2. Tambah Data Baris
    worksheet.addRows(rows);

    // 3. Styling Header (Baris 1)
    const headerRow = worksheet.getRow(1);
    headerRow.height = 25;
    headerRow.eachCell((cell) => {
        cell.font = { name: 'Segoe UI', family: 4, size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF6366F1' } // Indigo Blue
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };
    });

    // 4. Styling Baris Data & Auto-Width
    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
            row.eachCell((cell) => {
                cell.font = { name: 'Segoe UI', size: 10 };
                cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
        }
    });

    // 5. Kalkulasi Lebar Kolom Otomatis yang Presisi
    worksheet.columns.forEach(column => {
        let maxLen = 0;
        column.eachCell({ includeEmpty: true }, (cell) => {
            const cellLen = cell.value ? cell.value.toString().length : 10;
            if (cellLen > maxLen) maxLen = cellLen;
        });
        column.width = maxLen < 12 ? 12 : maxLen + 5;
    });

    // 6. Export file
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `laporan_${modul}_${new Date().toISOString().split('T')[0]}.xlsx`;
    anchor.click();
    window.URL.revokeObjectURL(url);
    
    tambahLog(` Ekspor Excel: ${modul} (${data.length} entri)`, '📥');
};

// =========================================
// 5. CETAK LAPORAN
// =========================================
/**
 * Mencetak laporan modul tertentu ke printer atau format PDF (Print Preview)
 * @param {string} modul - Nama modul yang akan dicetak
 */
window.cetakLaporan = function(modul) {
    const data = state[modul];
    if (!data || data.length === 0) return;

    let headers = [];
    let tableRows = '';
    
    // Konfigurasi Header dan Baris Tabel Berdasarkan Modul yang dipilih
    if(modul === 'produksi') {
        headers = ['Tanggal', 'Batch', 'Baik', 'Cacat', 'Total'];
        tableRows = data.map(d => `<tr><td>${d.tanggal}</td><td>${d.batchLabel}</td><td align="right">${d.telurBaik}</td><td align="right">${d.telurCacat}</td><td align="right"><b>${d.totalTelur}</b></td></tr>`).join('');
    } else if(modul === 'ayam') {
        headers = ['ID Batch', 'Tgl Masuk', 'Jenis', 'Sisa', 'Status'];
        tableRows = data.map(d => `<tr><td>${d.customId || d.id}</td><td>${d.tglMasuk}</td><td>${d.jenis}</td><td align="right">${d.sisaAyam}</td><td>${d.status}</td></tr>`).join('');
    } else if(modul === 'kesehatan') {
        headers = ['Tanggal', 'Batch', 'Gejala', 'Sakit', 'Mati', 'Status'];
        tableRows = data.map(d => `<tr><td>${d.tanggal}</td><td>${d.batchName}</td><td>${d.gejala}</td><td align="right">${d.jmlSakit}</td><td align="right">${d.jmlMati}</td><td>${d.status}</td></tr>`).join('');
    } else if(modul === 'vaksinasi') {
        headers = ['Tanggal', 'Batch', 'Vaksin', 'Metode', 'Status'];
        tableRows = data.map(d => `<tr><td>${d.tanggal}</td><td>${d.batchName}</td><td>${d.jenis}</td><td>${d.metode}</td><td>${d.status}</td></tr>`).join('');
    } else if(modul === 'keuangan') {
        headers = ['Tanggal', 'Tipe', 'Deskripsi', 'Jumlah'];
        tableRows = data.map(d => `<tr><td>${d.tanggal}</td><td>${d.tipe}</td><td>${d.deskripsi}</td><td align="right">Rp ${d.jumlah.toLocaleString('id-ID')}</td></tr>`).join('');
    } else if(modul === 'pakan') {
        headers = ['Tanggal', 'Tipe', 'Jenis', 'Jumlah'];
        tableRows = data.map(d => `<tr><td>${d.tanggal}</td><td>${d.tipe}</td><td>${d.jenis}</td><td align="right">${d.jumlah} Kg</td></tr>`).join('');
    } else if(modul === 'prediksi') {
        headers = ['Tanggal', 'MA', 'Populasi', 'Prod. (Kg)', 'Laba (Rp)', 'Status', 'Rekomendasi'];
        tableRows = data.map(d => {
            const tgl = new Date(d.tanggal).toLocaleString('id-ID');
            const status = (d.keuntungan || 0) >= 0 ? '<span style="color:#16a34a;font-weight:700">UNTUNG</span>' : '<span style="color:#dc2626;font-weight:700">RUGI</span>';
            return `<tr><td>${tgl}</td><td>MA-${d.periodeMA}</td><td>${(d.populasi||0).toLocaleString('id-ID')} Ekor</td><td>${d.prediksiBesokKg ? d.prediksiBesokKg.toFixed(2) : '0'} Kg</td><td>Rp ${Math.round(d.keuntungan||0).toLocaleString('id-ID')}</td><td>${status}</td><td style="font-size:0.85em;max-width:200px;white-space:normal">${d.rekomendasiUtama || '-'}</td></tr>`;
        }).join('');
    }

    // Bangun struktur HTML untuk jendela cetak
    const htmlContent = `
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Laporan ${modul}</title>
            <style>
                body { font-family: sans-serif; padding: 20px; }
                table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                th, td { border: 1px solid #ddd; padding: 10px; text-align: left; font-size: 12px; }
                th { background-color: #f4f4f4; }
                h1 { color: #2c3e50; }
            </style>
        </head>
        <body>
            <h1>Laporan ${modul.charAt(0).toUpperCase() + modul.slice(1)} - LIBAS</h1>
            <p>Dicetak pada: ${new Date().toLocaleString('id-ID')}</p>
            <table>
                <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
                <tbody>${tableRows}</tbody>
            </table>
        </body>
        </html>`;

    // Buka jendela baru dan kirim perintah cetak browser
    const win = window.open('', '_blank');
    win.document.write(htmlContent);
    win.document.close();
    win.print(); // Perintah cetak
    
    tambahLog(`🖨️ Cetak laporan: ${modul} (${data.length} entri)`, );
};

// =========================================
// 6. UTILS & ACTIONS
// =========================================
/**
 * Menampilkan daftar seluruh file laporan yang tersedia dan memberikan opsi untuk mengunduh semuanya secara massal.
 */
window.eksporSemuaCSV = function() {
    // Menyiapkan daftar modul untuk ditampilkan di modal
    const modules = [
        { id: 'produksi', name: 'Laporan Produksi Harian', icon: '🥚' },
        { id: 'pakan', name: 'Laporan Stok Pakan', icon: '🌾' },
        { id: 'keuangan', name: 'Laporan Keuangan', icon: '💰' },
        { id: 'ayam', name: 'Laporan Data Ayam/Populasi', icon: '🐓' },
        { id: 'kesehatan', name: 'Laporan Kesehatan Ayam', icon: '🩺' },
        { id: 'vaksinasi', name: 'Laporan Jadwal Vaksinasi', icon: '💉' },
        { id: 'prediksi', name: 'Laporan Hasil Prediksi MA', icon: '🧠' }
    ];

    // Membangun daftar HTML untuk ditampilkan dalam popup
    const listHtml = modules.map(m => `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px; border-bottom: 1px dashed #eee;">
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 1.2rem;">${m.icon}</span>
                <span style="font-weight: 500; font-size: 0.9rem;">${m.name}</span>
            </div>
            <span style="color: #6366f1; font-weight: 700; font-size: 0.75rem;">SIAP UNDUH</span>
        </div>
    `).join('');

    Swal.fire({
        title: 'Pusat Unduhan Massal',
        html: `
            <div style="text-align: left; background: #f8fafc; padding: 15px; border-radius: 12px; border: 1px solid #e2e8f0; margin-top: 15px;">
                <p style="margin-bottom: 12px; font-size: 0.85rem; color: #64748b;">Sistem telah menyiapkan <b>${modules.length} file </b> terpisah dari seluruh data modul peternakan Anda:</p>
                <div style="max-height: 250px; overflow-y: auto;">
                    ${listHtml}
                </div>
                <p style="margin-top: 15px; font-size: 0.75rem; color: #ef4444; line-height: 1.4;">
                    <b>💡 Catatan:</b> Browser Anda mungkin akan menanyakan izin untuk mengunduh banyak file sekaligus. Harap pilih <b>"Izinkan/Allow"</b>.
                </p>
            </div>
        `,
        icon: 'info',
        showCancelButton: true,
        confirmButtonText: '🚀 Unduh Semua File Excel',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#6366f1',
        cancelButtonColor: '#64748b',
        width: '500px'
    }).then((result) => {
        if (result.isConfirmed) {
            tambahLog('📦 Memulai proses unduhan massal seluruh modul...', '📦');
            
            // Loop eksekusi download dengan interval 600ms untuk mencegah pemblokiran browser
            modules.forEach((m, i) => {
                setTimeout(() => window.eksporCSV(m.id), i * 650);
            });

            // Notifikasi proses dimulai
            Swal.fire({
                title: 'Proses Dimulai',
                text: 'Mengekspor data ke format Excel (.xlsx). Silahkan cek folder Download Anda.',
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
            });
        }
    });
};

async function tambahLog(teks, ikon = '📄') {
    try {
        await addDoc(collection(db, "aktivitas_ekspor"), {
            teks: teks,
            ikon: ikon,
            tanggal: serverTimestamp()
        });
    } catch (error) {
        console.error("Gagal menyimpan log ke Firestore:", error);
    }
}

/**
 * Memperbarui tampilan daftar log di UI berdasarkan data dari Firestore
 */
function perbaruiLogUI(logs) {
    const logList = document.getElementById('logList');
    if (!logList) return;

    if (logs.length === 0) {
        logList.innerHTML = '<li class="log-empty">Tidak ada riwayat aktivitas yang ditemukan.</li>';
        return;
    }

    logList.innerHTML = logs.map(log => {
        // Handle firestore timestamp atau Date object
        const tgl = log.tanggal ? log.tanggal.toDate() : new Date();
        const waktu = tgl.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        const tglStr = tgl.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
        
        return `
            <li>
                <span class="log-icon">${log.ikon || '📄'}</span>
                <span class="log-text">${escapeHTML(log.teks)}</span>
                <span class="log-time">${tglStr} ${waktu}</span>
            </li>`;
    }).join('');
}

window.bersihkanLog = async function() {
    // 1. Cek Otoritas (Hanya Admin yang bisa menghapus)
    if (!window.isLibasAdmin) {
        Swal.fire({
            title: 'Akses Dibatasi',
            text: 'Maaf, hanya Administrator yang memiliki izin untuk menghapus riwayat aktivitas ekspor secara permanen.',
            icon: 'error',
            confirmButtonColor: '#ef4444'
        });
        return;
    }

    // 2. Konfirmasi Penghapusan
    Swal.fire({
        title: 'Hapus Semua Riwayat?',
        text: 'Seluruh riwayat aktivitas ekspor akan dihapus secara permanen dari database. Tindakan ini tidak dapat dibatalkan.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Ya, Hapus Permanen',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                tambahLog('🗑️ Sedang membersihkan seluruh riwayat aktivitas...', '⏳');
                
                // Ambil semua dokumen di collection aktivitas_ekspor
                const colRef = collection(db, "aktivitas_ekspor");
                const snapshot = await getDocs(colRef);
                
                if (snapshot.empty) {
                    Swal.fire('Info', 'Riwayat sudah kosong.', 'info');
                    return;
                }

                // Gunakan writeBatch untuk menghapus massal (maks 500 per batch)
                const batch = writeBatch(db);
                snapshot.docs.forEach((doc) => {
                    batch.delete(doc.ref);
                });

                await batch.commit();

                Swal.fire({
                    title: 'Berhasil',
                    text: 'Seluruh riwayat aktivitas ekspor telah dibersihkan.',
                    icon: 'success',
                    timer: 2000,
                    showConfirmButton: false
                });

                tambahLog('✅ Riwayat aktivitas telah dibersihkan oleh Administrator', '🛡️');

            } catch (error) {
                console.error("Gagal menghapus riwayat:", error);
                Swal.fire('Gagal', 'Terjadi kesalahan saat mencoba menghapus riwayat.', 'error');
            }
        }
    });
};


window.eksporGabunganCSV = async function() {
    const modules = [
        { id: 'produksi', name: 'Produksi' },
        { id: 'pakan', name: 'Pakan' },
        { id: 'keuangan', name: 'Keuangan' },
        { id: 'ayam', name: 'Ayam' },
        { id: 'kesehatan', name: 'Kesehatan' },
        { id: 'vaksinasi', name: 'Vaksinasi' },
        { id: 'prediksi', name: 'Prediksi' }
    ];

    const workbook = new ExcelJS.Workbook();
    let hasData = false;

    for (const m of modules) {
        const data = state[m.id];
        if (data && data.length > 0) {
            hasData = true;
            const worksheet = workbook.addWorksheet(m.name);
            const { headers, rows } = ambilDataTabel(m.id, data);

            worksheet.columns = headers.map(h => ({ header: h, key: h }));
            worksheet.addRows(rows);

            // Styling Header
            const headerRow = worksheet.getRow(1);
            headerRow.height = 25;
            headerRow.eachCell((cell) => {
                cell.font = { name: 'Segoe UI', bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6366F1' } };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                cell.border = {
                    top: { style: 'thin' }, left: { style: 'thin' },
                    bottom: { style: 'thin' }, right: { style: 'thin' }
                };
            });

            // Styling Baris & Auto-width
            worksheet.eachRow((row, rowNumber) => {
                row.eachCell((cell) => {
                    cell.border = {
                        top: { style: 'thin' }, left: { style: 'thin' },
                        bottom: { style: 'thin' }, right: { style: 'thin' }
                    };
                    if (rowNumber > 1) cell.alignment = { vertical: 'middle', horizontal: 'left' };
                });
            });

            worksheet.columns.forEach(column => {
                let maxLen = 0;
                column.eachCell({ includeEmpty: true }, (cell) => {
                    const cellLen = cell.value ? cell.value.toString().length : 10;
                    if (cellLen > maxLen) maxLen = cellLen;
                });
                column.width = maxLen < 12 ? 12 : maxLen + 5;
            });
        }
    }

    if (!hasData) {
        Swal.fire('Info', 'Seluruh data modul masih kosong, tidak ada yang bisa diekspor.', 'info');
        return;
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `Laporan_Gabungan_LIBAS_${new Date().toISOString().split('T')[0]}.xlsx`;
    anchor.click();
    window.URL.revokeObjectURL(url);
    
    tambahLog(' Ekspor Excel Gabungan berhasil dilakukan', '📋');
    
    Swal.fire({
        title: 'Berhasil!',
        text: 'Laporan Excel premium (styled) telah diunduh.',
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
    });
};

window.cetakLaporanTerpadu = function() {
    const modules = [
        { id: 'produksi', name: 'Produksi Harian' },
        { id: 'pakan', name: 'Stok Pakan' },
        { id: 'keuangan', name: 'Keuangan' },
        { id: 'ayam', name: 'Data Ayam / Populasi' },
        { id: 'kesehatan', name: 'Kesehatan Ayam' },
        { id: 'vaksinasi', name: 'Jadwal Vaksinasi' },
        { id: 'prediksi', name: 'Hasil Prediksi MA' }
    ];

    let hasData = false;
    let combinedHTML = `
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Laporan Terpadu - LIBAS</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 30px; color: #1e293b; line-height: 1.5; }
                .header-area { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #6366f1; padding-bottom: 20px; }
                h1 { margin: 0; color: #1e293b; font-size: 24px; text-transform: uppercase; letter-spacing: 1px; }
                .meta-info { margin-top: 10px; font-size: 14px; color: #64748b; }
                .section { margin-bottom: 40px; page-break-inside: avoid; }
                h2 { background: #f1f5f9; color: #334155; padding: 10px 15px; border-left: 5px solid #6366f1; font-size: 18px; margin-bottom: 15px; border-radius: 0 4px 4px 0; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
                th { background-color: #f8fafc; color: #475569; font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; border: 1px solid #e2e8f0; padding: 12px 8px; }
                td { border: 1px solid #e2e8f0; padding: 10px 8px; font-size: 11px; color: #334155; }
                tr:nth-child(even) { background-color: #fdfdfd; }
                .footer { margin-top: 50px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 20px; }
                @media print {
                    body { padding: 0; }
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            <div class="header-area">
                <h1>Laporan Terpadu Administrasi Peternakan</h1>
                <div class="meta-info">Sistem LIBAS | Dicetak pada: ${new Date().toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' })}</div>
            </div>
    `;

    modules.forEach(m => {
        const data = state[m.id];
        if (data && data.length > 0) {
            hasData = true;
            combinedHTML += `<div class="section"><h2>📊 ${m.name}</h2>`;
            
            let headers = [];
            let tableRows = '';
            
            if(m.id === 'produksi') {
                headers = ['Tanggal', 'Batch', 'Jenis Telur', 'Baik', 'Cacat', 'Total'];
                tableRows = data.map(d => `<tr><td>${d.tanggal}</td><td>${d.batchLabel}</td><td>${d.jenisTelur}</td><td align="right">${d.telurBaik}</td><td align="right">${d.telurCacat}</td><td align="right"><b>${d.totalTelur}</b></td></tr>`).join('');
            } else if(m.id === 'pakan') {
                headers = ['Tanggal', 'Tipe', 'Jenis Pakan', 'Jumlah', 'Keterangan'];
                tableRows = data.map(d => `<tr><td>${d.tanggal}</td><td>${d.tipe}</td><td>${d.jenis}</td><td align="right">${d.jumlah} Kg</td><td>${d.keterangan || '-'}</td></tr>`).join('');
            } else if(m.id === 'keuangan') {
                headers = ['Tanggal', 'Tipe', 'Deskripsi', 'Jumlah'];
                tableRows = data.map(d => `<tr><td>${d.tanggal}</td><td>${d.tipe}</td><td>${d.deskripsi}</td><td align="right">Rp ${Number(d.jumlah).toLocaleString('id-ID')}</td></tr>`).join('');
            } else if(m.id === 'ayam') {
                headers = ['Batch', 'Tgl Masuk', 'Jenis', 'Jumlah Awal', 'Sisa', 'Status'];
                tableRows = data.map(d => `<tr><td>${d.customId || d.id.substring(0,8)}</td><td>${d.tglMasuk}</td><td>${d.jenis}</td><td align="right">${d.jumlahAwal}</td><td align="right"><b>${d.sisaAyam}</b></td><td>${d.status}</td></tr>`).join('');
            } else if(m.id === 'kesehatan') {
                headers = ['Tanggal', 'Batch', 'Gejala', 'Sakit', 'Mati', 'Status'];
                tableRows = data.map(d => `<tr><td>${d.tanggal}</td><td>${d.batchName}</td><td>${d.gejala}</td><td align="right">${d.jmlSakit}</td><td align="right">${d.jmlMati}</td><td>${d.status}</td></tr>`).join('');
            } else if(m.id === 'vaksinasi') {
                headers = ['Tanggal', 'Batch', 'Vaksin', 'Metode', 'Status'];
                tableRows = data.map(d => `<tr><td>${d.tanggal}</td><td>${d.batchName}</td><td>${d.jenis}</td><td>${d.metode}</td><td>${d.status}</td></tr>`).join('');
            } else if(m.id === 'prediksi') {
                headers = ['Tanggal', 'Periode', 'Populasi', 'Prediksi (Kg)', 'Laba (Rp)', 'Status'];
                tableRows = data.map(d => {
                    const tgl = new Date(d.tanggal).toLocaleDateString('id-ID');
                    const status = (d.keuntungan || 0) >= 0 ? 'UNTUNG' : 'RUGI';
                    return `<tr><td>${tgl}</td><td>MA-${d.periodeMA}</td><td align="right">${d.populasi}</td><td align="right">${d.prediksiBesokKg.toFixed(2)}</td><td align="right">Rp ${Math.round(d.keuntungan).toLocaleString('id-ID')}</td><td>${status}</td></tr>`;
                }).join('');
            }
            
            combinedHTML += `<table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${tableRows}</tbody></table></div>`;
        }
    });

    combinedHTML += `
            <div class="footer">
                <p>© ${new Date().getFullYear()} LIBAS Administration System - Laporan Terpadu Digital</p>
                <p>Dokumen ini dihasilkan secara otomatis dari data Firestore</p>
            </div>
        </body>
        </html>
    `;

    if (!hasData) {
        Swal.fire('Info', 'Seluruh data modul masih kosong.', 'info');
        return;
    }

    const win = window.open('', '_blank');
    win.document.write(combinedHTML);
    win.document.close();
    
    // Tunggu sejenak agar browser merender HTML sebelum memicu cetak
    setTimeout(() => {
        win.print();
        tambahLog('🖨️ Cetak Laporan Terpadu berhasil dilakukan', );
    }, 500);
};

// =========================================
// 7. MODAL PRATINJAU DATA PENUH
// =========================================

/**
 * Konfigurasi tampilan dan kolom tabel tiap modul pada modal pratinjau.
 * Setiap entri mendefinisikan: ikon, judul, gradien header, dan daftar kolom tabel.
 */
const MODAL_CONFIG = {
    produksi: {
        icon: '🥚', title: 'Laporan Produksi Harian',
        gradient: 'linear-gradient(135deg, #f59e0b 0%, #fcd34d 100%)',
        kolom: ['Tanggal', 'Batch / Kandang', 'Jenis Telur', 'Telur Baik', 'Telur Cacat', 'Total Telur'],
        baris: (d) => [
            d.tanggal || '-',
            `${d.batchLabel || '-'} / ${d.kandang || '-'}`,
            d.jenisTelur || '-',
            Number(d.telurBaik || 0).toLocaleString('id-ID') + ' butir',
            Number(d.telurCacat || 0).toLocaleString('id-ID') + ' butir',
            `<b>${Number(d.totalTelur || 0).toLocaleString('id-ID')} butir</b>`
        ]
    },
    pakan: {
        icon: '🌾', title: 'Laporan Stok Pakan',
        gradient: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
        kolom: ['Tanggal', 'Tipe', 'Jenis Pakan', 'Jumlah (Kg)', 'Keterangan'],
        baris: (d) => {
            const warna = d.tipe === 'Masuk' ? '#10b981' : '#ef4444';
            return [
                d.tanggal || '-',
                `<span class="modal-badge" style="background:${warna}20;color:${warna}">${d.tipe || '-'}</span>`,
                d.jenis || '-',
                `${Number(d.jumlah || 0).toLocaleString('id-ID')} Kg`,
                d.keterangan || '-'
            ];
        }
    },
    keuangan: {
        icon: '💰', title: 'Laporan Keuangan',
        gradient: 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)',
        kolom: ['Tanggal', 'Tipe', 'Deskripsi', 'Jumlah (Rp)'],
        baris: (d) => {
            const warna = d.tipe === 'pemasukan' ? '#10b981' : '#ef4444';
            const prefix = d.tipe === 'pemasukan' ? '+' : '-';
            return [
                d.tanggal || '-',
                `<span class="modal-badge" style="background:${warna}20;color:${warna}">${d.tipe || '-'}</span>`,
                d.deskripsi || '-',
                `<b style="color:${warna}">${prefix} Rp ${Number(d.jumlah || 0).toLocaleString('id-ID')}</b>`
            ];
        }
    },
    ayam: {
        icon: '🐓', title: 'Laporan Data Ayam / Populasi',
        gradient: 'linear-gradient(135deg, #ef4444 0%, #f87171 100%)',
        kolom: ['ID Batch', 'Tgl Masuk', 'Jenis', 'Jumlah Awal', 'Sisa Ayam', 'Kandang', 'Status'],
        baris: (d) => {
            const warnaBadge = d.status === 'Aktif' ? '#10b981' : d.status === 'Panen' ? '#3b82f6' : '#f59e0b';
            return [
                d.customId || d.id?.substring(0, 8) || '-',
                d.tglMasuk || '-',
                d.jenis || '-',
                Number(d.jumlahAwal || 0).toLocaleString('id-ID') + ' ekor',
                `<b>${Number(d.sisaAyam || 0).toLocaleString('id-ID')} ekor</b>`,
                d.kandang || '-',
                `<span class="modal-badge" style="background:${warnaBadge}20;color:${warnaBadge}">${d.status || '-'}</span>`
            ];
        }
    },
    kesehatan: {
        icon: '🩺', title: 'Laporan Kesehatan Ayam',
        gradient: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
        kolom: ['Tanggal', 'Batch', 'Kandang', 'Gejala', 'Jml Sakit', 'Jml Mati', 'Penanganan', 'Status'],
        baris: (d) => {
            const warna = d.status === 'Sembuh' ? '#10b981' : d.status === 'Dalam Pengobatan' ? '#f59e0b' : '#ef4444';
            return [
                d.tanggal || '-',
                d.batchName || '-',
                d.kandang || '-',
                d.gejala || '-',
                `<span style="color:#f59e0b;font-weight:700">${d.jmlSakit || 0}</span>`,
                `<span style="color:#ef4444;font-weight:700">${d.jmlMati || 0}</span>`,
                d.penanganan || '-',
                `<span class="modal-badge" style="background:${warna}20;color:${warna}">${d.status || '-'}</span>`
            ];
        }
    },
    vaksinasi: {
        icon: '💉', title: 'Laporan Vaksinasi Ayam',
        gradient: 'linear-gradient(135deg, #0369a1 0%, #0284c7 100%)',
        kolom: ['Tanggal', 'Batch', 'Kandang', 'Jenis Vaksin', 'Metode', 'Status', 'Catatan'],
        baris: (d) => {
            const warna = d.status === 'Selesai' ? '#10b981' : '#f59e0b';
            return [
                d.tanggal || '-',
                d.batchName || '-',
                d.kandang || '-',
                d.jenis || '-',
                d.metode || '-',
                `<span class="modal-badge" style="background:${warna}20;color:${warna}">${d.status || '-'}</span>`,
                d.catatan || '-'
            ];
        }
    },
    prediksi: {
        icon: '🧠', title: 'Laporan Hasil Prediksi MA',
        gradient: 'linear-gradient(135deg, #9b59b6 0%, #c39bd3 100%)',
        kolom: ['Tanggal Analisis', 'Batch', 'Periode MA', 'Populasi', 'Prod. Besok (Kg)', 'Estimasi Pend.', 'Proyeksi Laba', 'Status', 'Rekomendasi'],
        baris: (d) => {
            const tgl = new Date(d.tanggal).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            const laba = Math.round(d.keuntungan || 0);
            const untung = laba >= 0;
            const warna = untung ? '#10b981' : '#ef4444';
            return [
                tgl,
                d.batchLabel || '-',
                `MA-${d.periodeMA || '-'}`,
                Number(d.populasi || 0).toLocaleString('id-ID') + ' ekor',
                d.prediksiBesokKg ? d.prediksiBesokKg.toFixed(2) + ' Kg' : '0 Kg',
                'Rp ' + Math.round(d.estimasiPendapatan || 0).toLocaleString('id-ID'),
                `<b style="color:${warna}">${untung ? '+' : ''}Rp ${laba.toLocaleString('id-ID')}</b>`,
                `<span class="modal-badge" style="background:${warna}20;color:${warna}">${untung ? 'UNTUNG' : 'RUGI'}</span>`,
                `<span style="font-size:0.8rem;max-width:180px;display:inline-block;white-space:normal">${d.rekomendasiUtama || '-'}</span>`
            ];
        }
    }
};

/** Nama modul yang sedang aktif di modal, digunakan oleh tombol CSV & Cetak di footer */
let _modulModal = null;

/**
 * Membuka modal pratinjau data penuh untuk modul yang dipilih.
 * Mengisi header dengan gradien + ikon modul, membangun tabel,
 * dan menampilkan modal dengan animasi.
 * @param {string} modul - Nama modul (produksi, pakan, keuangan, dll)
 */
window.bukaModalPreview = function(modul) {
    const cfg = MODAL_CONFIG[modul];
    const data = state[modul];

    if (!cfg) return;
    if (!data || data.length === 0) {
        Swal.fire('Info', `Belum ada data ${cfg.title} untuk ditampilkan.`, 'info');
        return;
    }

    _modulModal = modul;

    // --- Atur header modal ---
    const headerEl = document.getElementById('modalHeaderBar');
    if (headerEl) headerEl.style.background = cfg.gradient;

    const iconEl = document.getElementById('modalPreviewIcon');
    if (iconEl) iconEl.textContent = cfg.icon;

    const titleEl = document.getElementById('modalPreviewTitle');
    if (titleEl) titleEl.textContent = cfg.title;

    const subtitleEl = document.getElementById('modalPreviewSubtitle');
    if (subtitleEl) subtitleEl.textContent = `Menampilkan ${data.length} entri tersimpan`;

    // --- Bangun header tabel ---
    const thead = document.getElementById('modalTableHead');
    if (thead) {
        thead.innerHTML = `<tr>${cfg.kolom.map(k => `<th>${k}</th>`).join('')}</tr>`;
    }

    // --- Bangun baris tabel ---
    _renderBarisTabelModal(data, cfg);

    // --- Reset pencarian ---
    const searchInput = document.getElementById('modalSearchInput');
    if (searchInput) searchInput.value = '';

    // --- Update row count ---
    _updateRowCount(data.length);

    // --- Wiring tombol footer ---
    const btnCSV = document.getElementById('modalBtnCSV');
    if (btnCSV) btnCSV.onclick = () => window.eksporCSV(modul);

    const btnPrint = document.getElementById('modalBtnPrint');
    if (btnPrint) btnPrint.onclick = () => window.cetakLaporan(modul);

    // --- Tampilkan modal ---
    const overlay = document.getElementById('modalPreview');
    if (overlay) {
        overlay.classList.add('aktif');
        document.body.style.overflow = 'hidden'; // Cegah scroll halaman di belakang modal
    }

    tambahLog(`👁️ Membuka pratinjau: ${cfg.title} (${data.length} entri)`, );
};

/**
 * Menutup modal pratinjau dan mengembalikan scroll halaman
 */
window.tutupModalPreview = function() {
    const overlay = document.getElementById('modalPreview');
    if (overlay) overlay.classList.remove('aktif');
    document.body.style.overflow = '';
    _modulModal = null;
};

/**
 * Filter baris tabel modal berdasarkan teks pencarian (case-insensitive)
 * @param {string} kata - Teks yang diketik di kotak pencarian
 */
window.filterTabelModal = function(kata) {
    const tbody = document.getElementById('modalTableBody');
    if (!tbody) return;

    const kataBersih = kata.trim().toLowerCase();
    const baris = tbody.querySelectorAll('tr');
    let jumlahTampil = 0;

    baris.forEach(tr => {
        const teks = tr.textContent.toLowerCase();
        const cocok = !kataBersih || teks.includes(kataBersih);
        tr.style.display = cocok ? '' : 'none';
        if (cocok) jumlahTampil++;
    });

    // Tampilkan pesan kosong jika tidak ada yang cocok
    const emptyMsg = document.getElementById('modalEmptyMsg');
    if (emptyMsg) emptyMsg.style.display = (jumlahTampil === 0) ? 'block' : 'none';

    _updateRowCount(jumlahTampil);
};

/**
 * Membangun dan mengisi baris <tr> tabel modal dari array data
 * @param {Array} data - Array objek data Firestore
 * @param {Object} cfg - Konfigurasi kolom dan builder baris dari MODAL_CONFIG
 */
function _renderBarisTabelModal(data, cfg) {
    const tbody = document.getElementById('modalTableBody');
    const emptyMsg = document.getElementById('modalEmptyMsg');
    if (!tbody) return;

    tbody.innerHTML = data.map((item, idx) => {
        const sel = cfg.baris(item);
        return `<tr>${sel.map(v => `<td>${v ?? '-'}</td>`).join('')}</tr>`;
    }).join('');

    if (emptyMsg) emptyMsg.style.display = 'none';
}

/**
 * Memperbarui label jumlah entri yang ditampilkan di toolbar modal
 * @param {number} jumlah - Angka entri yang cocok
 */
function _updateRowCount(jumlah) {
    const el = document.getElementById('modalRowCount');
    if (el) el.textContent = `${jumlah.toLocaleString('id-ID')} entri`;
}

// Tutup modal saat klik pada overlay (area gelap di luar kotak)
document.addEventListener('DOMContentLoaded', () => {
    const overlay = document.getElementById('modalPreview');
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) window.tutupModalPreview();
        });
    }
});

// Tutup modal saat tombol Escape ditekan
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') window.tutupModalPreview();
});

window.goToProfile = () => window.location.href = 'editProfileTAalip.html';
window.logoutUser = () => {
    Swal.fire({ title: 'Keluar?', icon: 'question', showCancelButton: true }).then(res => {
        if(res.isConfirmed) window.location.href = 'index.html';
    });
};
