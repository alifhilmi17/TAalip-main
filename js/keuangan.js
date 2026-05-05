import { 
    collection, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    doc, 
    onSnapshot, 
    query, 
    orderBy 
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { db } from "../firebase.component/firebase-init.js";

// Global State
let dataKeuangan = [];
const keuanganCollection = collection(db, "keuangan");

// ==========================================
// 1. UTILITAS
// ==========================================
function formatIDR(number) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(number);
}

function formatTanggal(tglString) {
    if (!tglString) return "-";
    const options = { day: 'numeric', month: 'short', year: 'numeric' };
    // Tambahkan T00:00:00 agar diparsing sebagai waktu lokal, bukan UTC midnight
    // (mencegah tanggal meleset 1 hari di timezone UTC+7)
    const safeDate = tglString.includes('T') ? tglString : tglString + 'T00:00:00';
    return new Date(safeDate).toLocaleDateString('id-ID', options);
}

/**
 * Mengontrol tampilan loading (spinner/skeleton)
 */
function toggleLoading(target, isLoading) {
    if (target === 'form') {
        const btn = document.getElementById('btnSubmit');
        if (btn) {
            btn.classList.toggle('loading', isLoading);
            btn.disabled = isLoading;
        }
    } else if (target === 'table') {
        const loader = document.getElementById('tableLoading');
        const table = document.getElementById('financeTable');
        const empty = document.getElementById('emptyState');
        
        if (loader) loader.style.display = isLoading ? 'block' : 'none';
        if (table) table.style.opacity = isLoading ? '0.3' : '1';
        if (empty && isLoading) empty.style.display = 'none';
    }
}

// ==========================================
// 2. INISIALISASI & FIREBASE LISTENER
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    // 1. Jalankan Listener Firebase
    initFirebaseListener();

    // 2. Pasang Event Listeners
    setupEventListeners();

    // 3. Set Default Date
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('trxDate');
    if (dateInput) dateInput.value = today;
});

function initFirebaseListener() {
    toggleLoading('table', true);
    const q = query(keuanganCollection, orderBy("tanggal", "desc"));
    
    onSnapshot(q, (snapshot) => {
        dataKeuangan = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        toggleLoading('table', false);
        renderTable();
        updateSummary();
    }, (err) => {
        toggleLoading('table', false);
        console.error("Firebase Error:", err);
        Swal.fire("Error", "Gagal mengambil data dari server.", "error");
    });
}

function setupEventListeners() {
    // Form Submit
    const financeForm = document.getElementById('financeForm');
    if (financeForm) {
        financeForm.addEventListener('submit', handleFormSubmit);
    }

    // Filter & Search
    ['searchTrx', 'filterStartDate'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', () => renderTable());
        }
    });

    // Export
    const btnExport = document.getElementById('btnExport');
    if (btnExport) {
        btnExport.addEventListener('click', downloadLaporanCSV);
    }

    // Sidebar Toggle (Mobile)
    const sidebarToggle = document.getElementById('sidebarToggle');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            document.querySelector('.sidebar').classList.toggle('active');
        });
    }

    // Event Delegation untuk Hapus
    const tableBody = document.getElementById('financeTableBody');
    if (tableBody) {
        tableBody.addEventListener('click', (e) => {
            const btnDelete = e.target.closest('.btn-delete');
            if (btnDelete) {
                const id = btnDelete.dataset.id;
                deleteTransaction(id);
            }
        });
    }
}

// ==========================================
// 3. CRUD LOGIC
// ==========================================
async function handleFormSubmit(event) {
    event.preventDefault();
    toggleLoading('form', true);

    const tanggal = document.getElementById('trxDate').value;
    const tipe = document.querySelector('input[name="trxType"]:checked').value;
    const deskripsi = document.getElementById('trxDesc').value;
    const jumlah = parseFloat(document.getElementById('trxAmount').value) || 0;

    const payload = {
        tanggal,
        tipe,
        deskripsi,
        jumlah,
        createdAt: new Date().toISOString()
    };

    try {
        await addDoc(keuanganCollection, payload);
        Swal.fire({
            icon: 'success',
            title: 'Berhasil',
            text: 'Transaksi berhasil dicatat.',
            timer: 1500,
            showConfirmButton: false
        });
        document.getElementById('financeForm').reset();
        document.getElementById('trxDate').value = new Date().toISOString().split('T')[0];
    } catch (err) {
        Swal.fire("Error", "Gagal menyimpan: " + err.message, "error");
    } finally {
        toggleLoading('form', false);
    }
}

async function deleteTransaction(id) {
    const result = await Swal.fire({
        title: 'Hapus Transaksi?',
        text: "Data akan dihapus permanen.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Ya, Hapus'
    });

    if (result.isConfirmed) {
        try {
            await deleteDoc(doc(db, "keuangan", id));
            Swal.fire('Terhapus!', 'Transaksi telah dihapus.', 'success');
        } catch (err) {
            Swal.fire("Error", "Gagal menghapus: " + err.message, "error");
        }
    }
}

// ==========================================
// 4. DISPLAY & FILTER
// ==========================================
function renderTable() {
    const tbody = document.getElementById('financeTableBody');
    const emptyState = document.getElementById('emptyState');
    if (!tbody) return;

    // Ambil nilai filter
    const searchTerm = document.getElementById('searchTrx').value.toLowerCase();
    const startDate = document.getElementById('filterStartDate').value;
    
    tbody.innerHTML = "";

    // Logika Filtering (Pencarian Teks & Tanggal Spesifik)
    const filtered = dataKeuangan.filter(t => {
        const matchesSearch = t.deskripsi.toLowerCase().includes(searchTerm);
        const matchesDate = !startDate || t.tanggal === startDate;
        return matchesSearch && matchesDate;
    });

    if (filtered.length === 0) {
        if (emptyState) emptyState.style.display = 'flex';
    } else {
        if (emptyState) emptyState.style.display = 'none';
        filtered.forEach(t => {
            const tr = document.createElement('tr');
            const isIncome = t.tipe === "pemasukan";
            const badgeClass = isIncome ? 'badge-income' : 'badge-expense';
            const textClass = isIncome ? 'text-income' : 'text-expense';
            const typeLabel = t.tipe.charAt(0).toUpperCase() + t.tipe.slice(1);
            
            tr.innerHTML = `
                <td>${formatTanggal(t.tanggal)}</td>
                <td><span class="badge-type ${badgeClass}">${typeLabel}</span></td>
                <td>${t.deskripsi}</td>
                <td class="text-right ${textClass}" style="font-weight: 700;">${formatIDR(t.jumlah)}</td>
                <td class="text-center">
                    <button class="btn-delete" data-id="${t.id}" title="Hapus">🗑️</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
}

function updateSummary() {
    let income = 0;
    let expense = 0;

    dataKeuangan.forEach(t => {
        if (t.tipe === "pemasukan") income += t.jumlah;
        else expense += t.jumlah;
    });

    const incomeEl = document.getElementById('totalPemasukan');
    const expenseEl = document.getElementById('totalPengeluaran');
    const balanceEl = document.getElementById('totalSaldo');

    if(incomeEl) incomeEl.innerText = formatIDR(income);
    if(expenseEl) expenseEl.innerText = formatIDR(expense);
    if(balanceEl) balanceEl.innerText = formatIDR(income - expense);
}

function downloadLaporanCSV() {
    if (dataKeuangan.length === 0) {
        Swal.fire("Info", "Tidak ada data untuk diekspor.", "info");
        return;
    }

    let csv = "Tanggal,Jenis,Deskripsi,Jumlah (Rp)\n";
    dataKeuangan.forEach(t => {
        csv += `${t.tanggal},${t.tipe},"${t.deskripsi.replace(/"/g, '""')}",${t.jumlah}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Laporan_Keuangan_LIBAS_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
}

/**
 * Fungsi utilitas untuk sidebar (submenu) - Digunakan oleh button onclick
 * Tetap biarkan window-scoped karena diatur di HTML global sidebar
 */
window.toggleSidebarMenu = function(id) {
    const el = document.getElementById(id);
    if(!el) return;
    const isHidden = el.getAttribute('aria-hidden') === 'true';
    el.setAttribute('aria-hidden', !isHidden);
    el.previousElementSibling.setAttribute('aria-expanded', isHidden);
};
