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

window.goToProfile = () => window.location.href = 'editProfileTAalip.html';
window.logoutUser = () => {
    Swal.fire({ title: 'Keluar?', icon: 'question', showCancelButton: true }).then(res => {
        if(res.isConfirmed) window.location.href = 'index.html';
    });
};
