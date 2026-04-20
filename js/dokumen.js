/* =========================================================
   SISTEM ADMINISTRASI PETERNAKAN (LIBAS)
   File: dokumen.js
   Deskripsi: Logika halaman Pusat Dokumen & Laporan (FIRESTORE).
   Mempusatkan seluruh data dari semua modul untuk pratinjau, 
   ekspor CSV, dan cetak laporan secara real-time.
========================================================= */

import { 
    collection, 
    onSnapshot, 
    query, 
    orderBy 
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { db } from "../firebase.component/firebase-init.js";

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
document.addEventListener('DOMContentLoaded', () => {
    tampilkanTanggalHariIni();
    tambahLog('📂 Halaman Pusat Dokumen dibuka', '📂');

    // Listener Produksi
    onSnapshot(query(collection(db, "produksi_harian"), orderBy("tanggal", "desc")), (snap) => {
        state.produksi = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        perbaruiUI();
    });

    // Listener Pakan
    onSnapshot(query(collection(db, "stok_pakan"), orderBy("tanggal", "desc")), (snap) => {
        state.pakan = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        perbaruiUI();
    });

    // Listener Keuangan
    onSnapshot(query(collection(db, "keuangan"), orderBy("tanggal", "desc")), (snap) => {
        state.keuangan = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        perbaruiUI();
    });

    // Listener Ayam (Populasi)
    onSnapshot(query(collection(db, "populasi_ayam"), orderBy("tglMasuk", "desc")), (snap) => {
        state.ayam = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        perbaruiUI();
    });

    // Listener Kesehatan Ayam
    onSnapshot(query(collection(db, "kesehatan_ayam"), orderBy("tanggal", "desc")), (snap) => {
        state.kesehatan = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        perbaruiUI();
    });

    // Listener Vaksinasi Ayam
    onSnapshot(query(collection(db, "vaksinasi_ayam"), orderBy("tanggal", "desc")), (snap) => {
        state.vaksinasi = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        perbaruiUI();
    });

    // Listener Histori Prediksi MA
    onSnapshot(query(collection(db, "prediksi_history"), orderBy("tanggal", "desc")), (snap) => {
        state.prediksi = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        perbaruiUI();
    });

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
        const desc = (item.deskripsi || '-').substring(0, 22) + ((item.deskripsi || '').length > 22 ? '…' : '');
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
            <span class="preview-label">🐓 ${customId} &nbsp;|&nbsp; ${item.jenis || '-'}</span>
            <span class="preview-val">
                ${sisaStr} ekor
                <span style="font-size:0.65rem;background:${warnaBadge};color:#fff;padding:1px 4px;border-radius:4px;margin-left:4px;">${item.status}</span>
            </span>
        </div>`;
    });

    // 5. Kesehatan Preview: Menampilkan angka ayam sakit/mati
    renderPreview('preview-kesehatan', state.kesehatan, (item) => {
        const tgl = formatTanggalPreview(item.tanggal);
        const batch = item.batchName || 'N/A';
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
        const jenis = item.jenis || '-';
        const metode = item.metode || '-';
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
window.eksporCSV = function(modul) {
    const data = state[modul];
    if (!data || data.length === 0) {
        Swal.fire('Info', `Data laporan ${modul} masih kosong.`, 'info');
        return;
    }

    // Menambah Byte Order Mark (BOM) agar Excel dapat membaca karakter spesial/tanda baca dengan benar
    const csvContent = '\uFEFF' + buatKontenCSV(modul, data);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `laporan_${modul}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click(); // Trigger download
    
    tambahLog(`📥 Ekspor CSV: ${modul} (${data.length} entri)`, '📥');
};

function buatKontenCSV(modul, data) {
    let header = '';
    let baris = [];
    const sanitize = (v) => String(v || '').replace(/,/g, ';').replace(/\n/g, ' ');

    switch (modul) {
        case 'produksi':
            header = 'ID,Tanggal,Batch,Jenis Telur,Kandang,Baik,Cacat,Total';
            baris = data.map(d => [d.id, d.tanggal, d.batchLabel, d.jenisTelur, d.kandang, d.telurBaik, d.telurCacat, d.totalTelur].map(sanitize).join(','));
            break;
        case 'pakan':
            header = 'ID,Tanggal,Tipe,Jenis,Jumlah(Kg),Keterangan';
            baris = data.map(d => [d.id, d.tanggal, d.tipe, d.jenis, d.jumlah, d.keterangan].map(sanitize).join(','));
            break;
        case 'keuangan':
            header = 'ID,Tanggal,Tipe,Deskripsi,Jumlah(Rp)';
            baris = data.map(d => [d.id, d.tanggal, d.tipe, d.deskripsi, d.jumlah].map(sanitize).join(','));
            break;
        case 'ayam':
            header = 'ID,CustomID,Tgl Masuk,Jenis,Jumlah Awal,Sisa Ayam,Kandang,Status';
            baris = data.map(d => [d.id, d.customId, d.tglMasuk, d.jenis, d.jumlahAwal, d.sisaAyam, d.kandang, d.status].map(sanitize).join(','));
            break;
        case 'kesehatan':
            header = 'ID,Tanggal,Batch,Kandang,Gejala,Jml Sakit,Jml Mati,Penanganan,Status';
            baris = data.map(d => [d.id, d.tanggal, d.batchName, d.kandang, d.gejala, d.jmlSakit, d.jmlMati, d.penanganan, d.status].map(sanitize).join(','));
            break;
        case 'vaksinasi':
            header = 'ID,Tanggal,Batch,Kandang,Jenis Vaksin,Metode,Status,Catatan';
            baris = data.map(d => [d.id, d.tanggal, d.batchName, d.kandang, d.jenis, d.metode, d.status, d.catatan].map(sanitize).join(','));
            break;
        case 'prediksi':
            header = 'ID,Tanggal Analisis,Batch/Populasi,Periode MA,Populasi (Ekor),Prediksi Produksi (Kg),Prediksi Produksi (Butir),Estimasi Pendapatan (Rp),Biaya Pakan (Rp),Proyeksi Laba (Rp),Status Keuangan,Rekomendasi Utama';
            baris = data.map(d => [
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
            ].map(sanitize).join(','));
            break;
    }
    return [header, ...baris].join('\n');
}

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
    
    tambahLog(`🖨️ Cetak laporan: ${modul} (${data.length} entri)`, '🖨️');
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
                <p style="margin-bottom: 12px; font-size: 0.85rem; color: #64748b;">Sistem telah menyiapkan <b>${modules.length} file CSV</b> terpisah dari seluruh data modul peternakan Anda:</p>
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
        confirmButtonText: '🚀 Unduh Semua File',
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
                text: 'Mengekspor data ke format CSV. Silahkan cek folder Download Anda.',
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
            });
        }
    });
};

function tambahLog(teks, ikon = '📄') {
    const logList = document.getElementById('logList');
    if (!logList) return;
    const elKosong = logList.querySelector('.log-empty');
    if (elKosong) elKosong.remove();

    const li = document.createElement('li');
    const waktu = new Date().toLocaleTimeString('id-ID');
    li.innerHTML = `<span class="log-icon">${ikon}</span><span class="log-text">${teks}</span><span class="log-time">${waktu}</span>`;
    logList.insertBefore(li, logList.firstChild);
}

window.bersihkanLog = function() {
    const list = document.getElementById('logList');
    if(list) list.innerHTML = '<li class="log-empty">Belum ada aktivitas ekspor pada sesi ini.</li>';
};

window.toggleSidebarMenu = function(id) {
    const el = document.getElementById(id);
    if(!el) return;
    const isHidden = el.getAttribute('aria-hidden') === 'true';
    const parentButton = el.previousElementSibling;
    
    // Toggle ARIA attributes
    el.setAttribute('aria-hidden', !isHidden);
    parentButton.setAttribute('aria-expanded', isHidden);
    
    // Toggle CSS classes for visual feedback
    if (isHidden) {
        el.classList.add('show');
        parentButton.classList.add('active-parent');
    } else {
        el.classList.remove('show');
        parentButton.classList.remove('active-parent');
    }
};

window.eksporGabunganCSV = function() {
    Swal.fire('Fitur', 'Fitur Ekspor Gabungan sedang dalam pengembangan.', 'info');
};

window.cetakLaporanTerpadu = function() {
    Swal.fire('Fitur', 'Fitur Cetak Terpadu sedang dalam pengembangan.', 'info');
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

    tambahLog(`👁️ Membuka pratinjau: ${cfg.title} (${data.length} entri)`, '👁️');
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
