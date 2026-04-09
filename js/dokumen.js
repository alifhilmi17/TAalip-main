/* =========================================================
   SISTEM ADMINISTRASI PETERNAKAN (LIBAS)
   File: dokumen.js
   Deskripsi: Logika halaman Pusat Dokumen & Laporan.
   Membaca data localStorage setiap modul, menampilkan preview
   data aktual, ekspor CSV berformat rapi, cetak laporan, dan
   mencatat log aktivitas ekspor.
========================================================= */


/* =========================================================
   🔑 KONFIGURASI KEY LOCALSTORAGE TIAP MODUL
   Disesuaikan dengan key yang digunakan masing-masing JS modul.
   - Produksi   → produksiHarianData   (inputproduksi.js)
   - Stok Pakan → stokPakan_TA         (stokpakan.js)
   - Keuangan   → financeData          (keuangan.js)
   - Data Ayam  → dataAyamData         (dataAyamTAalip.js)
========================================================= */
const STORAGE_KEYS = {
    produksi: 'produksiHarianData',
    pakan: 'stokPakan_TA',
    keuangan: 'financeData',
    ayam: 'dataAyamData',
};


/* =========================================================
   📅 TAMPILKAN TANGGAL HARI INI DI BADGE HEADER
========================================================= */
/**
 * Mengambil tanggal saat ini dan menampilkannya di badge header
 * menggunakan format bahasa Indonesia yang lengkap.
 */
function tampilkanTanggalHariIni() {
    const el = document.getElementById('tanggalHariIni');
    if (!el) return;
    const opsi = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const tglStr = new Date().toLocaleDateString('id-ID', opsi);
    el.textContent = `📅 ${tglStr.charAt(0).toUpperCase() + tglStr.slice(1)}`;
}


/* =========================================================
   📊 BACA DATA DARI LOCALSTORAGE
========================================================= */
/**
 * Membaca dan mem-parse data dari localStorage.
 * Mengembalikan array kosong jika data belum ada atau parse gagal.
 * @param {string} modul - Nama modul ('produksi', 'pakan', 'keuangan', 'ayam')
 * @returns {Array}
 */
function bacaData(modul) {
    try {
        const raw = localStorage.getItem(STORAGE_KEYS[modul]);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        console.warn(`[LIBAS Dokumen] Gagal membaca modul "${modul}":`, e);
        return [];
    }
}


/* =========================================================
   🔢 PERBARUI KARTU RINGKASAN JUMLAH ENTRI DATA
========================================================= */
/**
 * Menghitung jumlah entri tiap modul dari localStorage
 * dan menampilkannya pada kartu ringkasan atas.
 */
function perbaruiRingkasan() {
    /* Produksi: hitung entri produksiHarianData */
    const dataProduksi = bacaData('produksi');
    const elProduksi = document.getElementById('count-produksi');
    if (elProduksi) elProduksi.textContent = `${dataProduksi.length} Entri`;

    /* Stok Pakan: hitung entri stokPakan_TA */
    const dataPakan = bacaData('pakan');
    const elPakan = document.getElementById('count-pakan');
    if (elPakan) elPakan.textContent = `${dataPakan.length} Entri`;

    /* Keuangan: hitung entri financeData */
    const dataKeu = bacaData('keuangan');
    const elKeu = document.getElementById('count-keuangan');
    if (elKeu) elKeu.textContent = `${dataKeu.length} Entri`;

    /* Data Ayam: hitung entri dataAyamData */
    const dataAyam = bacaData('ayam');
    const elAyam = document.getElementById('count-ayam');
    if (elAyam) elAyam.textContent = `${dataAyam.length} Entri`;
}


/* =========================================================
   👁️ TAMPILKAN PRATINJAU DATA DI KARTU EKSPOR
========================================================= */
/**
 * Memanggil semua fungsi preview untuk mengisi tiap kartu ekspor
 * dengan data terbaru dari localStorage masing-masing modul.
 */
function tampilkanPreview() {
    tampilkanPreviewProduksi();
    tampilkanPreviewPakan();
    tampilkanPreviewKeuangan();
    tampilkanPreviewAyam();
}

/**
 * Preview modul Produksi Harian.
 * Field: tanggal, batchId, jenisTelur, kandang, telurBaik, telurCacat, totalTelur
 */
function tampilkanPreviewProduksi() {
    const el = document.getElementById('preview-produksi');
    if (!el) return;

    const data = bacaData('produksi');

    if (data.length === 0) {
        el.innerHTML = '<p class="empty-preview">Belum ada data produksi untuk ditampilkan.</p>';
        return;
    }

    /* Ambil 5 entri terbaru (indeks terakhir array = terbaru) */
    const preview = [...data].reverse().slice(0, 5);

    el.innerHTML = preview.map(item => {
        const tgl = formatTanggalPreview(item.tanggal);
        const total = Number(item.totalTelur || 0).toLocaleString('id-ID');
        const jenis = item.jenisTelur || item.batchId || '-';
        return `
        <div class="preview-row">
            <span class="preview-label">📅 ${tgl} &nbsp;|&nbsp; ${jenis}</span>
            <span class="preview-val">🥚 ${total} butir</span>
        </div>`;
    }).join('');
}

/**
 * Preview modul Stok Pakan.
 * Field: tanggal, tipe (Masuk/Keluar), jenisPakan, jumlah, keterangan
 */
function tampilkanPreviewPakan() {
    const el = document.getElementById('preview-pakan');
    if (!el) return;

    const data = bacaData('pakan');

    if (data.length === 0) {
        el.innerHTML = '<p class="empty-preview">Belum ada data stok pakan untuk ditampilkan.</p>';
        return;
    }

    /* Urutkan terbaru dulu lalu ambil 5 */
    const preview = [...data]
        .sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal))
        .slice(0, 5);

    el.innerHTML = preview.map(item => {
        const tgl = formatTanggalPreview(item.tanggal);
        const ikon = item.tipe === 'Masuk' ? '📥' : '📤';
        const warna = item.tipe === 'Masuk' ? '#10b981' : '#ef4444';
        const jumlah = Number(item.jumlah || 0).toLocaleString('id-ID');
        return `
        <div class="preview-row">
            <span class="preview-label">${ikon} ${tgl} &nbsp;|&nbsp; ${item.jenisPakan || '-'}</span>
            <span class="preview-val" style="color:${warna}">${item.tipe} ${jumlah} kg</span>
        </div>`;
    }).join('');
}

/**
 * Preview modul Keuangan.
 * Field: date, type (pemasukan/pengeluaran), desc, amount
 */
function tampilkanPreviewKeuangan() {
    const el = document.getElementById('preview-keuangan');
    if (!el) return;

    const data = bacaData('keuangan');

    if (data.length === 0) {
        el.innerHTML = '<p class="empty-preview">Belum ada data keuangan untuk ditampilkan.</p>';
        return;
    }

    /* Sudah tersortir terbaru dari keuangan.js, ambil 5 pertama */
    const preview = data.slice(0, 5);

    el.innerHTML = preview.map(item => {
        const warna = item.type === 'pemasukan' ? '#10b981' : '#ef4444';
        const prefix = item.type === 'pemasukan' ? '+' : '-';
        const nominal = Number(item.amount || 0).toLocaleString('id-ID');
        const keterangan = (item.desc || '-').substring(0, 28) + ((item.desc || '').length > 28 ? '…' : '');
        return `
        <div class="preview-row">
            <span class="preview-label">${keterangan}</span>
            <span class="preview-val" style="color:${warna}">${prefix} Rp ${nominal}</span>
        </div>`;
    }).join('');
}

/**
 * Preview modul Data Ayam.
 * Field: id, tglMasuk, jenis, jumlahAwal, sisaAyam, kandang, status
 */
function tampilkanPreviewAyam() {
    const el = document.getElementById('preview-ayam');
    if (!el) return;

    const data = bacaData('ayam');

    if (data.length === 0) {
        el.innerHTML = '<p class="empty-preview">Belum ada data ayam untuk ditampilkan.</p>';
        return;
    }

    /* Tampilkan 5 data terbaru (dari ujung array) */
    const preview = [...data].reverse().slice(0, 5);

    el.innerHTML = preview.map(item => {
        const sisaStr = Number(item.sisaAyam || 0).toLocaleString('id-ID');
        const warnaBadge = item.status === 'Aktif' ? '#10b981' : item.status === 'Panen' ? '#3b82f6' : '#f59e0b';
        return `
        <div class="preview-row">
            <span class="preview-label">🐓 ${item.id} &nbsp;|&nbsp; ${item.jenis || '-'} [${item.kandang || '-'}]</span>
            <span class="preview-val">
                ${sisaStr} ekor
                <span style="font-size:0.75rem;background:${warnaBadge};color:#fff;padding:1px 6px;border-radius:6px;margin-left:4px;">${item.status}</span>
            </span>
        </div>`;
    }).join('');
}

/**
 * Format tanggal sederhana untuk tampilan preview.
 * @param {string} tgl - String YYYY-MM-DD
 * @returns {string} string tanggal lokal singkat
 */
function formatTanggalPreview(tgl) {
    if (!tgl) return '-';
    return new Date(tgl).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}


/* =========================================================
   📥 EKSPOR DATA KE FILE CSV
========================================================= */
/**
 * Membuat konten CSV berformat rapi sesuai field masing-masing modul.
 * Setiap modul memiliki header kolom dan mapping field sendiri.
 * @param {string} modul - Nama modul
 * @param {Array} data - Array data yang akan diekspor
 * @returns {string} String konten CSV
 */
function buatKontenCSV(modul, data) {
    if (!data || data.length === 0) return '';

    /* Helper sanitasi: hapus koma & baris baru dalam nilai string */
    const bersih = (val) => {
        if (val === null || val === undefined) return '';
        return String(val).replace(/,/g, ';').replace(/\n|\r/g, ' ');
    };

    let header = '';
    let baris = [];

    switch (modul) {
        case 'produksi':
            /* inputproduksi.js: id, tanggal, batchId, batchLabel, jenisTelur, kandang,
               telurBaik, telurCacat, totalTelur, beratTotal */
            header = 'ID,Tanggal,Batch ID,Batch Label,Jenis Telur,Kandang,Telur Baik,Telur Cacat,Total Telur,Berat Total (kg)';
            baris = data.map(d => [
                bersih(d.id),
                bersih(d.tanggal),
                bersih(d.batchId),
                bersih(d.batchLabel),
                bersih(d.jenisTelur),
                bersih(d.kandang),
                d.telurBaik ?? 0,
                d.telurCacat ?? 0,
                d.totalTelur ?? 0,
                d.beratTotal ?? 0
            ].join(','));
            break;

        case 'pakan':
            /* stokpakan.js: id, tanggal, tipe, jenisPakan, jumlah, keterangan */
            header = 'ID,Tanggal,Tipe (Masuk/Keluar),Jenis Pakan,Jumlah (kg),Keterangan';
            baris = data.map(d => [
                bersih(d.id),
                bersih(d.tanggal),
                bersih(d.tipe),
                bersih(d.jenisPakan),
                d.jumlah ?? 0,
                bersih(d.keterangan)
            ].join(','));
            break;

        case 'keuangan':
            /* keuangan.js: id, date, type, desc, amount */
            header = 'ID,Tanggal,Jenis Transaksi,Keterangan/Deskripsi,Jumlah (Rp)';
            baris = data.map(d => [
                bersih(d.id),
                bersih(d.date),
                bersih(d.type),
                bersih(d.desc),
                d.amount ?? 0
            ].join(','));
            break;

        case 'ayam':
            /* dataAyamTAalip.js: id, tglMasuk, jenis, jumlahAwal, sisaAyam, kandang, status */
            header = 'ID Batch,Tanggal Masuk,Jenis Ayam,Populasi Awal,Sisa Ayam,Kandang,Status';
            baris = data.map(d => [
                bersih(d.id),
                bersih(d.tglMasuk),
                bersih(d.jenis),
                d.jumlahAwal ?? 0,
                d.sisaAyam ?? 0,
                bersih(d.kandang),
                bersih(d.status)
            ].join(','));
            break;

        default:
            /* Fallback: ambil semua key dari objek pertama */
            const keys = Object.keys(data[0]);
            header = keys.join(',');
            baris = data.map(d => keys.map(k => bersih(d[k])).join(','));
    }

    return [header, ...baris].join('\n');
}

/**
 * Memicu unduhan file CSV ke browser.
 * @param {string} modul - Nama modul yang diekspor
 */
function eksporCSV(modul) {
    const data = bacaData(modul);

    if (data.length === 0) {
        Swal.fire({
            icon: 'info',
            title: 'Data Kosong',
            text: `Modul "${labelModulNama(modul)}" belum memiliki data untuk diekspor.`,
            confirmButtonColor: '#667eea',
        });
        return;
    }

    /* \uFEFF = BOM agar Excel membaca karakter Indonesia dengan benar */
    const csvContent = '\uFEFF' + buatKontenCSV(modul, data);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const tglEkspor = new Date().toISOString().slice(0, 10);

    link.href = url;
    link.setAttribute('download', `laporan_${modul}_LIBAS_${tglEkspor}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    tambahLog(`📥 Ekspor CSV: ${labelModulNama(modul)} (${data.length} entri)`, '📥');

    Swal.fire({
        icon: 'success',
        title: 'Ekspor Berhasil!',
        text: `File laporan_${modul}_LIBAS_${tglEkspor}.csv diunduh.`,
        timer: 2000,
        showConfirmButton: false,
        timerProgressBar: true,
    });
}


/* =========================================================
   🖨️ CETAK LAPORAN SEBAGAI PRINT PREVIEW
========================================================= */
/**
 * Membuka jendela baru berisi tabel HTML terformat untuk dicetak.
 * Kolom dan label disesuaikan dengan field masing-masing modul.
 * @param {string} modul - Nama modul yang dicetak
 */
function cetakLaporan(modul) {
    const data = bacaData(modul);

    if (data.length === 0) {
        Swal.fire({
            icon: 'info',
            title: 'Data Kosong',
            text: `Modul "${labelModulNama(modul)}" belum memiliki data untuk dicetak.`,
            confirmButtonColor: '#667eea',
        });
        return;
    }

    const tglCetak = new Date().toLocaleDateString('id-ID', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    /* Bangun header kolom dan baris tabel sesuai modul */
    let headerKolom = [];
    let barisHtml = '';

    switch (modul) {
        case 'produksi':
            headerKolom = ['Tanggal', 'Batch ID', 'Jenis Telur', 'Kandang', 'Baik', 'Cacat', 'Total', 'Berat (kg)'];
            barisHtml = data.map(d => `<tr>
                <td>${formatTanggalPreview(d.tanggal)}</td>
                <td>${d.batchId || '-'}</td>
                <td>${d.jenisTelur || '-'}</td>
                <td>${d.kandang || '-'}</td>
                <td style="text-align:right;color:#166534">${(d.telurBaik ?? 0).toLocaleString('id-ID')}</td>
                <td style="text-align:right;color:#991b1b">${(d.telurCacat ?? 0).toLocaleString('id-ID')}</td>
                <td style="text-align:right;font-weight:700">${(d.totalTelur ?? 0).toLocaleString('id-ID')}</td>
                <td style="text-align:right">${d.beratTotal ?? 0}</td>
            </tr>`).join('');
            break;

        case 'pakan':
            headerKolom = ['Tanggal', 'Jenis Pakan', 'Tipe', 'Jumlah (kg)', 'Keterangan'];
            barisHtml = data.map(d => {
                const warna = d.tipe === 'Masuk' ? '#166534' : '#991b1b';
                return `<tr>
                    <td>${formatTanggalPreview(d.tanggal)}</td>
                    <td>${d.jenisPakan || '-'}</td>
                    <td style="font-weight:700;color:${warna}">${d.tipe || '-'}</td>
                    <td style="text-align:right;font-weight:700;color:${warna}">${(d.jumlah ?? 0).toLocaleString('id-ID')}</td>
                    <td>${d.keterangan || '-'}</td>
                </tr>`;
            }).join('');
            break;

        case 'keuangan':
            headerKolom = ['Tanggal', 'Jenis', 'Keterangan', 'Jumlah (Rp)'];
            barisHtml = data.map(d => {
                const warna = d.type === 'pemasukan' ? '#166534' : '#991b1b';
                const prefix = d.type === 'pemasukan' ? '+' : '-';
                const label = d.type === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran';
                return `<tr>
                    <td>${formatTanggalPreview(d.date)}</td>
                    <td style="font-weight:700;color:${warna}">${label}</td>
                    <td>${d.desc || '-'}</td>
                    <td style="text-align:right;font-weight:700;color:${warna}">${prefix} Rp ${(d.amount ?? 0).toLocaleString('id-ID')}</td>
                </tr>`;
            }).join('');
            break;

        case 'ayam':
            headerKolom = ['ID Batch', 'Tgl Masuk', 'Jenis', 'Pop. Awal', 'Sisa Ayam', 'Kandang', 'Status'];
            barisHtml = data.map(d => {
                const wStatus = d.status === 'Aktif' ? '#166534' : d.status === 'Panen' ? '#1e40af' : '#92400e';
                return `<tr>
                    <td style="font-weight:700">${d.id}</td>
                    <td>${formatTanggalPreview(d.tglMasuk)}</td>
                    <td>${d.jenis || '-'}</td>
                    <td style="text-align:right">${(d.jumlahAwal ?? 0).toLocaleString('id-ID')}</td>
                    <td style="text-align:right;font-weight:700">${(d.sisaAyam ?? 0).toLocaleString('id-ID')}</td>
                    <td>${d.kandang || '-'}</td>
                    <td style="color:${wStatus};font-weight:700">${d.status || '-'}</td>
                </tr>`;
            }).join('');
            break;
    }

    const headerHtml = headerKolom.map(h => `<th>${h}</th>`).join('');

    /* Bangun ringkasan tambahan untuk keuangan */
    let ringkasanHtml = '';
    if (modul === 'keuangan' && data.length > 0) {
        const totalMasuk = data.filter(d => d.type === 'pemasukan').reduce((s, d) => s + (d.amount || 0), 0);
        const totalKeluar = data.filter(d => d.type === 'pengeluaran').reduce((s, d) => s + (d.amount || 0), 0);
        const saldo = totalMasuk - totalKeluar;
        ringkasanHtml = `
        <div style="margin-top:20px;padding:15px;background:#f8fafc;border-radius:8px;display:flex;gap:20px;flex-wrap:wrap;">
            <div><strong style="color:#166534">Total Pemasukan:</strong> Rp ${totalMasuk.toLocaleString('id-ID')}</div>
            <div><strong style="color:#991b1b">Total Pengeluaran:</strong> Rp ${totalKeluar.toLocaleString('id-ID')}</div>
            <div><strong style="color:${saldo >= 0 ? '#1e40af' : '#dc2626'}">Saldo Bersih:</strong> Rp ${saldo.toLocaleString('id-ID')}</div>
        </div>`;
    }

    if (modul === 'pakan' && data.length > 0) {
        const totalMasuk = data.filter(d => d.tipe === 'Masuk').reduce((s, d) => s + (d.jumlah || 0), 0);
        const totalKeluar = data.filter(d => d.tipe === 'Keluar').reduce((s, d) => s + (d.jumlah || 0), 0);
        const sisa = totalMasuk - totalKeluar;
        ringkasanHtml = `
        <div style="margin-top:20px;padding:15px;background:#f8fafc;border-radius:8px;display:flex;gap:20px;flex-wrap:wrap;">
            <div><strong style="color:#166534">Total Masuk:</strong> ${totalMasuk.toLocaleString('id-ID')} kg</div>
            <div><strong style="color:#991b1b">Total Keluar:</strong> ${totalKeluar.toLocaleString('id-ID')} kg</div>
            <div><strong style="color:#1e40af">Sisa Stok:</strong> ${sisa.toLocaleString('id-ID')} kg</div>
        </div>`;
    }

    const cetakHTML = `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8"/>
    <title>${labelModulNama(modul)} - LIBAS</title>
    <style>
        body { font-family: Arial, Helvetica, sans-serif; padding: 30px; color: #333; font-size: 13px; }
        .kop { border-bottom: 2px solid #333; padding-bottom: 12px; margin-bottom: 20px; }
        .kop h1 { margin: 0; font-size: 18px; }
        .kop p { margin: 4px 0 0; color: #666; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th { background: #1e293b; color: #fff; padding: 8px 10px; text-align: left; font-size: 11px; letter-spacing: 0.5px; }
        td { padding: 7px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
        tr:nth-child(even) td { background: #f8fafc; }
        tr:hover td { background: #f1f5f9; }
        .footer { margin-top: 25px; font-size: 11px; color: #94a3b8; text-align: right; }
        @media print { body { padding: 10px; } .no-print { display: none; } }
    </style>
</head>
<body>
    <div class="kop">
        <h1>📋 ${labelModulNama(modul)}</h1>
        <p>Dicetak pada: ${tglCetak} &nbsp;|&nbsp; Total: ${data.length} entri &nbsp;|&nbsp; Sistem LIBAS - Peternakan</p>
    </div>
    <table>
        <thead><tr>${headerHtml}</tr></thead>
        <tbody>${barisHtml}</tbody>
    </table>
    ${ringkasanHtml}
    <div class="footer">Dokumen ini dicetak dari Sistem LIBAS - Lintau Buo Administration System</div>
</body>
</html>`;

    const jendelaCetak = window.open('', '_blank');
    jendelaCetak.document.write(cetakHTML);
    jendelaCetak.document.close();
    jendelaCetak.focus();
    jendelaCetak.print();

    tambahLog(`🖨️ Cetak laporan: ${labelModulNama(modul)} (${data.length} entri)`, '🖨️');
}


/* =========================================================
   📦 EKSPOR SEMUA MODUL SEKALIGUS
========================================================= */
/**
 * Mengunduh file CSV dari semua modul secara berurutan
 * dengan jeda antar unduhan agar browser tidak memblok.
 */
function eksporSemuaCSV() {
    const modulList = ['produksi', 'pakan', 'keuangan', 'ayam'];
    let jumlahDiunduh = 0;
    let totalEntri = 0;

    Swal.fire({
        title: 'Mengekspor Semua Data...',
        text: 'Mohon tunggu, semua laporan sedang diproses.',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    modulList.forEach((modul, index) => {
        setTimeout(() => {
            const data = bacaData(modul);

            if (data.length > 0) {
                const csvContent = '\uFEFF' + buatKontenCSV(modul, data);
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                const tglEkspor = new Date().toISOString().slice(0, 10);

                link.href = url;
                link.setAttribute('download', `laporan_${modul}_LIBAS_${tglEkspor}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);

                jumlahDiunduh++;
                totalEntri += data.length;
                tambahLog(`📦 Ekspor semua: ${labelModulNama(modul)} (${data.length} entri)`, '📦');
            }

            if (index === modulList.length - 1) {
                setTimeout(() => {
                    Swal.fire({
                        icon: jumlahDiunduh > 0 ? 'success' : 'info',
                        title: jumlahDiunduh > 0 ? `${jumlahDiunduh} File Diunduh!` : 'Semua Data Kosong',
                        text: jumlahDiunduh > 0
                            ? `${jumlahDiunduh} laporan CSV dengan total ${totalEntri} entri berhasil diunduh.`
                            : 'Belum ada data di modul manapun untuk diekspor.',
                        confirmButtonColor: '#667eea',
                    });
                }, 600);
            }
        }, index * 450);
    });
}


/* =========================================================
   🏷️ HELPER: LABEL NAMA MODUL
========================================================= */
/**
 * Mengembalikan nama tampilan (label) ramah pengguna untuk setiap kode modul.
 * @param {string} modul - Kode modul
 * @returns {string} Nama label modul
 */
function labelModulNama(modul) {
    const label = {
        produksi: 'Laporan Produksi Harian',
        pakan: 'Laporan Stok Pakan',
        keuangan: 'Laporan Keuangan',
        ayam: 'Laporan Data Ayam',
    };
    return label[modul] || modul;
}


/* =========================================================
   🕓 MANAJEMEN LOG RIWAYAT AKTIVITAS
========================================================= */
/**
 * Menambahkan entri baru ke atas daftar log aktivitas.
 * @param {string} teks - Deskripsi aktivitas
 * @param {string} ikon - Emoji ikon log
 */
function tambahLog(teks, ikon = '📄') {
    const logList = document.getElementById('logList');
    if (!logList) return;

    /* Hapus pesan kosong jika masih tampil */
    const elKosong = logList.querySelector('.log-empty');
    if (elKosong) elKosong.remove();

    const li = document.createElement('li');
    const waktu = new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    li.innerHTML = `
        <span class="log-icon">${ikon}</span>
        <span class="log-text">${teks}</span>
        <span class="log-time">${waktu}</span>
    `;

    /* Sisipkan log baru di posisi teratas */
    logList.insertBefore(li, logList.firstChild);
}

/**
 * Menghapus seluruh riwayat log setelah konfirmasi.
 */
function bersihkanLog() {
    const logList = document.getElementById('logList');
    if (!logList) return;

    Swal.fire({
        icon: 'warning',
        title: 'Bersihkan Log?',
        text: 'Seluruh riwayat aktivitas ekspor akan dihapus.',
        showCancelButton: true,
        confirmButtonText: 'Ya, Hapus',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#ef4444',
    }).then(result => {
        if (result.isConfirmed) {
            logList.innerHTML = '<li class="log-empty">Belum ada aktivitas ekspor pada sesi ini.</li>';
        }
    });
}


/* =========================================================
   🧭 TOGGLE SIDEBAR (NAVIGASI SUBMENU)
========================================================= */
/**
 * Membuka atau menutup submenu navigasi di sidebar.
 * @param {string} submenuId - ID elemen submenu yang di-toggle
 */
function toggleSidebarMenu(submenuId) {
    const submenu = document.getElementById(submenuId);
    const button = submenu ? submenu.previousElementSibling : null;
    if (!submenu || !button) return;

    const isOpen = submenu.classList.contains('show');

    /* Tutup semua submenu yang terbuka */
    document.querySelectorAll('.submenu.show').forEach(el => {
        el.classList.remove('show');
        el.setAttribute('aria-hidden', 'true');
    });
    document.querySelectorAll('.has-submenu').forEach(btn => {
        btn.setAttribute('aria-expanded', 'false');
        btn.classList.remove('active-parent');
    });

    /* Buka submenu yang dipilih (jika sebelumnya tertutup) */
    if (!isOpen) {
        submenu.classList.add('show');
        submenu.setAttribute('aria-hidden', 'false');
        button.setAttribute('aria-expanded', 'true');
        button.classList.add('active-parent');
    }
}


/* =========================================================
   👤 FUNGSI NAVIGASI & LOGOUT
========================================================= */
function goToProfile() {
    window.location.href = 'editProfileTAalip.html';
}

function logoutUser() {
    Swal.fire({
        title: 'Keluar dari LIBAS?',
        text: 'Sesi Anda akan diakhiri.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Ya, Keluar',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#e63946',
    }).then(result => {
        if (result.isConfirmed) {
            localStorage.removeItem('userLoggedIn');
            window.location.href = 'index.html';
        }
    });
}


/* =========================================================
   🚀 INISIALISASI HALAMAN (ENTRY POINT)
========================================================= */
document.addEventListener('DOMContentLoaded', () => {
    /* 1. Tampilkan tanggal hari ini */
    tampilkanTanggalHariIni();

    /* 2. Perbarui kartu ringkasan jumlah entri data */
    perbaruiRingkasan();

    /* 3. Tampilkan pratinjau data aktual di tiap kartu ekspor */
    tampilkanPreview();

    /* 4. Buka submenu Dokumen di sidebar secara otomatis */
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

    /* 5. Log sambutan awal */
    tambahLog('📂 Halaman Pusat Dokumen dibuka', '📂');
});
