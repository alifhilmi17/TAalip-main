/* =========================================================
   SISTEM ADMINISTRASI PETERNAKAN (LIBAS)
   File: keuangan.js
   Deskripsi: Manajemen pencatatan pemasukan dan pengeluaran
   menggunakan Firestore.
========================================================= */

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
    return new Date(tglString).toLocaleDateString('id-ID', options);
}

// ==========================================
// 2. INISIALISASI & FIREBASE LISTENER
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    const q = query(keuanganCollection, orderBy("tanggal", "desc"));
    
    onSnapshot(q, (snapshot) => {
        dataKeuangan = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        renderTable();
        updateSummary();
    });

    // Set default date hari ini
    const today = new Date().toISOString().split('T')[0];
    if (document.getElementById('trxDate')) {
        document.getElementById('trxDate').value = today;
    }
});

// ==========================================
// 3. CRUD LOGIC
// ==========================================
window.addTransaction = async function(event) {
    event.preventDefault();

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
            text: 'Transaksi berhasil disimpan ke cloud.',
            timer: 1500,
            showConfirmButton: false
        });
        document.getElementById('financeForm').reset();
        // Reset date
        document.getElementById('trxDate').value = new Date().toISOString().split('T')[0];
    } catch (err) {
        Swal.fire("Error", "Gagal menyimpan: " + err.message, "error");
    }
};

window.deleteTransaction = function(id) {
    Swal.fire({
        title: 'Hapus Transaksi?',
        text: "Data akan dihapus permanen dari Firestore.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ff6b6b'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                await deleteDoc(doc(db, "keuangan", id));
                Swal.fire('Terhapus!', 'Transaksi telah dihapus.', 'success');
            } catch (err) {
                Swal.fire("Error", "Gagal menghapus: " + err.message, "error");
            }
        }
    });
};

// ==========================================
// 4. DISPLAY & FILTER
// ==========================================
function renderTable() {
    const tbody = document.getElementById('financeTableBody');
    const searchTerm = document.getElementById('searchTrx').value.toLowerCase();
    
    if (!tbody) return;
    tbody.innerHTML = "";

    const filtered = dataKeuangan.filter(t => t.deskripsi.toLowerCase().includes(searchTerm));

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-state">Belum ada data transaksi match.</td></tr>`;
    } else {
        filtered.forEach(t => {
            const tr = document.createElement('tr');
            const typeClass = t.tipe === "pemasukan" ? 'status-masuk' : 'status-keluar';
            const typeLabel = t.tipe.charAt(0).toUpperCase() + t.tipe.slice(1);
            
            tr.innerHTML = `
                <td>${formatTanggal(t.tanggal)}</td>
                <td><span class="badge ${typeClass}">${typeLabel}</span></td>
                <td>${t.deskripsi}</td>
                <td style="text-align: right; font-weight: 600;">${formatIDR(t.jumlah)}</td>
                <td style="text-align: center;">
                    <button class="btn-delete" onclick="deleteTransaction('${t.id}')" title="Hapus">🗑️</button>
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

    if(document.getElementById('totalPemasukan')) document.getElementById('totalPemasukan').innerText = formatIDR(income);
    if(document.getElementById('totalPengeluaran')) document.getElementById('totalPengeluaran').innerText = formatIDR(expense);
    if(document.getElementById('totalSaldo')) document.getElementById('totalSaldo').innerText = formatIDR(income - expense);
}

window.filterTable = function() {
    renderTable();
};

window.downloadLaporanCSV = function() {
    if (dataKeuangan.length === 0) return;
    let csv = "Tanggal,Jenis,Deskripsi,Jumlah (Rp)\n";
    dataKeuangan.forEach(t => {
        csv += `${t.tanggal},${t.tipe},"${t.deskripsi}",${t.jumlah}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Laporan_Keuangan_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
};

// Sidebar
window.toggleSidebarMenu = function(id) {
    const el = document.getElementById(id);
    if(!el) return;
    const isHidden = el.getAttribute('aria-hidden') === 'true';
    el.setAttribute('aria-hidden', !isHidden);
    el.previousElementSibling.setAttribute('aria-expanded', isHidden);
};
