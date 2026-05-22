import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    onSnapshot,
    query,
    orderBy,
    getDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { db, auth } from "../firebase.component/firebase-init.js";

// ==========================================
// HELPER: Anti-XSS HTML Sanitizer
// ==========================================
function escapeHTML(str) {
    if (str === undefined || str === null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ==========================================
// GLOBAL STATE
// ==========================================
let dataReminders = [];
let currentUserName = "Pengguna";
let currentUserRole = "petugas";
let activeTab = "pending"; // 'pending' (Pending & Usulan), 'selesai' (Selesai)

const reminderCollection = collection(db, "restock_reminders");

document.addEventListener("DOMContentLoaded", () => {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            const href = window.location.href;
            if (href.includes('admin-core')) {
                window.location.href = "../../login.html";
            } else if (href.includes('admin.frontend')) {
                window.location.href = "../login.html";
            } else {
                window.location.href = "login.html";
            }
            return;
        }

        try {
            // Cek koleksi admin
            const adminSnap = await getDoc(doc(db, "admin", user.uid));
            if (adminSnap.exists()) {
                const adminData = adminSnap.data();
                const role = (adminData.role || 'admin').trim().toLowerCase();
                currentUserRole = (role === 'admin' || role === 'administrator' || role === 'owner') ? 'admin' : 'petugas';
                currentUserName = adminData.fullname || adminData.username || "Admin";
                
                const switchContainer = document.getElementById('adminSwitchContainer');
                if (switchContainer) switchContainer.style.display = 'block';
            } else {
                // Cek koleksi user
                const userSnap = await getDoc(doc(db, "user", user.uid));
                if (userSnap.exists()) {
                    const userData = userSnap.data();
                    currentUserName = userData.fullname || "Petugas";
                    const role = (userData.role || 'petugas').trim().toLowerCase();
                    currentUserRole = (role === 'admin' || role === 'administrator' || role === 'owner') ? 'admin' : 'petugas';
                }
            }

            // Update teks tombol aksi di header
            const btnAction = document.getElementById('btnActionReminder');
            if (btnAction) {
                if (currentUserRole === 'admin') {
                    btnAction.innerHTML = `➕ Buat Reminder Baru`;
                } else {
                    btnAction.innerHTML = `➕ Ajukan Kebutuhan Pakan`;
                }
            }

            const profileEl = document.querySelector('.profile-name');
            if (profileEl) profileEl.innerText = currentUserName;
        } catch (err) {
            console.warn("Gagal deteksi role:", err);
        }

        startFirestoreListener();
        startLiveStockListener();
    });
});

let isInitialLoad = true;

// ==========================================
// FIREBASE LISTENERS
// ==========================================
function startFirestoreListener() {
    const q = query(reminderCollection, orderBy("tglBatas", "asc"));
    onSnapshot(q, (snapshot) => {
        dataReminders = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderReminders();
        
        if (isInitialLoad) {
            isInitialLoad = false;
            const pending = dataReminders.filter(r => r.status === 'Pending');
            if (pending.length > 0) {
                const tinggi = pending.filter(r => r.prioritas === 'Tinggi');
                const title = tinggi.length > 0 ? `${tinggi.length} Pengingat Mendesak!` : `${pending.length} Pengingat Pending`;
                const iconType = tinggi.length > 0 ? 'warning' : 'info';
                
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: iconType,
                    title: title,
                    text: 'Anda memiliki reminder pakan yang belum direstock.',
                    showConfirmButton: false,
                    timer: 5000,
                    timerProgressBar: true
                });
            }
        }
    });
}

function startLiveStockListener() {
    const q = collection(db, "stok_pakan");
    onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map(d => d.data());
        
        // Hitung sisa stok per jenis pakan
        const stockMap = {};
        items.forEach(item => {
            const jenis = item.jenis || item.namaBarang || 'Lainnya';
            const tipe = item.tipe || 'Masuk';
            const jumlah = parseFloat(item.jumlah) || 0;
            
            if (!stockMap[jenis]) {
                stockMap[jenis] = { masuk: 0, keluar: 0 };
            }
            if (tipe === 'Masuk') {
                stockMap[jenis].masuk += jumlah;
            } else if (tipe === 'Keluar') {
                stockMap[jenis].keluar += jumlah;
            }
        });
        
        renderLiveStockWidget(stockMap);
    });
}

// ==========================================
// RENDERING FUNCTIONS
// ==========================================
function renderLiveStockWidget(stockMap) {
    const grid = document.getElementById('liveStockGrid');
    if (!grid) return;
    
    const keys = Object.keys(stockMap);
    if (keys.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; padding: 15px; text-align: center; color: #64748b;">Belum ada data stok pakan tercatat.</div>`;
        return;
    }
    
    let html = '';
    let renderedCount = 0;
    keys.forEach(jenis => {
        const data = stockMap[jenis];
        
        // Jika tidak pernah ada stok masuk (atau semua stok masuk telah dihapus),
        // maka pakan ini dianggap tidak aktif/telah dihapus.
        if (!data.masuk || data.masuk <= 0) return;
        
        renderedCount++;
        const sisa = Math.max(0, data.masuk - data.keluar);
        const isLow = sisa < 50; // Threshold stok kritis pakan menipis
        
        const cardClass = isLow ? 'stock-item-card low-stock animate__animated animate__pulse animate__infinite' : 'stock-item-card';
        const statusText = isLow ? 'Tipis ⚠️' : 'Aman ✓';
        const statusClass = isLow ? 'status-tipis' : 'status-aman';
        
        html += `
            <div class="${cardClass}">
                <div>
                    <span class="stock-item-name">📦 ${escapeHTML(jenis)}</span>
                    <div class="stock-item-value">${sisa.toLocaleString('id-ID')} Kg</div>
                </div>
                <span class="stock-item-status ${statusClass}">${statusText}</span>
            </div>
        `;
    });
    
    if (renderedCount === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; padding: 15px; text-align: center; color: #64748b;">Belum ada data stok pakan aktif tercatat.</div>`;
        return;
    }
    
    grid.innerHTML = html;
}

function renderReminders() {
    const container = document.getElementById('reminderListContainer');
    if (!container) return;

    // Hitung jumlah untuk badge tab
    const countPending = dataReminders.filter(r => r.status === 'Pending' || r.status === 'Usulan' || !r.status).length;
    const countSelesai = dataReminders.filter(r => r.status === 'Selesai').length;

    const badgePending = document.getElementById('badgePendingCount');
    const badgeSelesai = document.getElementById('badgeSelesaiCount');

    if (badgePending) {
        badgePending.innerText = countPending;
        if (countPending > 0) badgePending.classList.remove('count-zero');
        else badgePending.classList.add('count-zero');
    }
    if (badgeSelesai) {
        badgeSelesai.innerText = countSelesai;
        if (countSelesai > 0) badgeSelesai.classList.remove('count-zero');
        else badgeSelesai.classList.add('count-zero');
    }

    // Filter reminder sesuai tab aktif
    let filteredData = [];
    if (activeTab === 'pending') {
        filteredData = dataReminders.filter(r => r.status === 'Pending' || r.status === 'Usulan' || !r.status);
    } else {
        filteredData = dataReminders.filter(r => r.status === 'Selesai');
    }

    if (filteredData.length === 0) {
        container.innerHTML = `<div class="empty-state animate__animated animate__fadeIn">
            <span class="empty-icon">📂</span>
            <p>${activeTab === 'pending' ? 'Tidak ada pengingat restock yang butuh tindakan.' : 'Belum ada riwayat restock pakan.'}</p>
        </div>`;
        return;
    }

    let html = '';
    filteredData.forEach(r => {
        const isSelesai = r.status === 'Selesai';
        const isUsulan = r.status === 'Usulan';
        
        let cardClass = '';
        if (isSelesai) cardClass = 'selesai';
        else if (isUsulan) cardClass = 'usulan';
        else if (r.prioritas === 'Tinggi') cardClass = 'tinggi';

        // Beacon / lampu denyut untuk prioritas tinggi yang belum selesai
        const showBeacon = r.prioritas === 'Tinggi' && !isSelesai;
        const beaconHtml = showBeacon ? '<span class="pulse-beacon" title="Mendesak!"></span>' : '';

        // Badge Prioritas
        const badgePrioritas = r.prioritas === 'Tinggi' 
            ? '<span class="badge badge-tinggi">⚠️ Prioritas Tinggi</span>' 
            : '<span class="badge badge-sedang">⏳ Prioritas Sedang</span>';

        // Badge Status
        let badgeStatus = '';
        if (isSelesai) {
            badgeStatus = '<span class="badge badge-selesai">✅ Selesai Di-restock</span>';
        } else if (isUsulan) {
            badgeStatus = '<span class="badge badge-usulan">💡 Usulan Baru</span>';
        } else {
            badgeStatus = '<span class="badge badge-pending">⏱️ Pending</span>';
        }

        let actionsHtml = '';
        if (currentUserRole === 'admin') {
            if (isUsulan) {
                // Admin/Owner menyetujui usulan
                actionsHtml += `<button onclick="approveUsulan('${r.id}')" class="action-btn btn-indigo-solid">✓ Setujui Usulan</button>`;
            } else if (!isSelesai) {
                // Admin/Owner menandai selesai
                actionsHtml += `<button onclick="markSelesai('${r.id}')" class="action-btn btn-success-solid">✓ Tandai Selesai</button>`;
            }
            // Admin/Owner selalu bisa menghapus
            actionsHtml += `<button onclick="deleteReminder('${r.id}')" class="action-btn btn-danger-light">🗑️ Hapus</button>`;
        } else {
            // Petugas / Akuntan
            if (isUsulan) {
                actionsHtml += `<span style="color:#6366f1; font-weight:600; font-size:0.8rem; font-style:italic;">⌛ Menunggu Persetujuan Admin</span>`;
            } else if (!isSelesai) {
                // Tombol restock selesai untuk staff
                actionsHtml += `<button onclick="markSelesai('${r.id}')" class="action-btn btn-success-solid">✓ Restock Selesai</button>`;
            } else {
                actionsHtml += `<span style="color:#10b981; font-weight:bold; font-size:0.9rem;">Telah Direstock</span>`;
            }
        }

        const dateStr = r.tglBatas ? new Date(r.tglBatas).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'}) : '-';

        html += `
            <div class="reminder-card ${cardClass} animate__animated animate__fadeInUp">
                <div class="reminder-info">
                    <h4 style="display: flex; align-items: center;">${beaconHtml}📦 ${escapeHTML(r.jenisPakan)}</h4>
                    <p style="margin: 6px 0 10px 0; font-size: 0.9rem; line-height: 1.4;">${escapeHTML(r.catatan) || 'Tidak ada catatan tambahan'}</p>
                    <div class="reminder-meta">
                        <span>Batas Waktu: ${dateStr}</span>
                        ${badgePrioritas}
                        ${badgeStatus}
                    </div>
                    <div style="margin-top:10px; font-size:0.75rem; color:#94a3b8;">
                        Diajukan oleh: <strong>${escapeHTML(r.dibuatOleh || 'Petugas')}</strong>
                        ${r.diselesaikanOleh ? ` | Direstock oleh: <strong>${escapeHTML(r.diselesaikanOleh)}</strong>` : ''}
                    </div>
                </div>
                <div class="reminder-actions">
                    ${actionsHtml}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// ==========================================
// TABS NAVIGATION CONTROLLER
// ==========================================
window.switchTab = function(tabName) {
    activeTab = tabName;
    
    const btnPending = document.getElementById('tabPendingBtn');
    const btnSelesai = document.getElementById('tabSelesaiBtn');
    
    if (tabName === 'pending') {
        if (btnPending) btnPending.classList.add('active');
        if (btnSelesai) btnSelesai.classList.remove('active');
    } else {
        if (btnPending) btnPending.classList.remove('active');
        if (btnSelesai) btnSelesai.classList.add('active');
    }
    
    renderReminders();
};

// ==========================================
// ACTION HANDLERS & MODALS
// ==========================================
window.openReminderModal = function() {
    document.getElementById('reminderForm').reset();
    document.getElementById('reminderId').value = "";
    
    // Default tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.getElementById('tglReminder').value = tomorrow.toISOString().split('T')[0];

    document.getElementById('modalTitle').innerText = currentUserRole === 'admin' ? "Buat Reminder Baru" : "Ajukan Usulan Kebutuhan Pakan";
    document.getElementById('reminderModal').classList.add('show');
};

window.closeReminderModal = function() {
    document.getElementById('reminderModal').classList.remove('show');
};

window.saveReminder = async function(e) {
    e.preventDefault();
    const id = document.getElementById('reminderId').value;
    
    let statusToSave = 'Pending'; // default untuk data baru oleh Admin
    if (currentUserRole !== 'admin') {
        statusToSave = 'Usulan'; // Otomatis berstatus 'Usulan' untuk Petugas/Akuntan
    }
    
    if (id) {
        const existingReminder = dataReminders.find(r => r.id === id);
        statusToSave = existingReminder ? existingReminder.status : 'Pending';
    }
    
    const payload = {
        jenisPakan: document.getElementById('jenisPakan').value,
        tglBatas: document.getElementById('tglReminder').value,
        prioritas: document.getElementById('prioritas').value,
        catatan: document.getElementById('catatan').value,
        dibuatOleh: currentUserName,
        status: statusToSave,
        updatedAt: serverTimestamp()
    };

    try {
        if (!id) {
            payload.createdAt = serverTimestamp();
            await addDoc(reminderCollection, payload);
            
            const successMsg = currentUserRole === 'admin' 
                ? 'Reminder restock berhasil dibuat.' 
                : 'Usulan kebutuhan pakan berhasil diajukan untuk disetujui.';
                
            Swal.fire({ icon: 'success', title: 'Berhasil', text: successMsg, timer: 2000, showConfirmButton: false });
        } else {
            await updateDoc(doc(db, "restock_reminders", id), payload);
            Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Reminder diperbarui.', timer: 1500, showConfirmButton: false });
        }
        closeReminderModal();
    } catch (err) {
        Swal.fire("Error", err.message, "error");
    }
};

window.approveUsulan = function(id) {
    Swal.fire({
        title: 'Setujui Usulan Pakan',
        text: 'Apakah Anda yakin ingin menyetujui usulan pengadaan pakan ini dan memindahkannya ke antrean restock?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#6366f1',
        confirmButtonText: 'Ya, Setujui Usulan',
        cancelButtonText: 'Batal'
    }).then(async (res) => {
        if (res.isConfirmed) {
            try {
                await updateDoc(doc(db, "restock_reminders", id), {
                    status: 'Pending',
                    disetujuiOleh: currentUserName,
                    disetujuiPada: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });
                Swal.fire({
                    icon: 'success',
                    title: 'Disetujui',
                    text: 'Usulan pakan berhasil disetujui.',
                    timer: 1500,
                    showConfirmButton: false
                });
            } catch (err) {
                Swal.fire('Error', err.message, 'error');
            }
        }
    });
};

window.markSelesai = function(id) {
    Swal.fire({
        title: 'Konfirmasi Restock',
        text: 'Tandai pengingat ini bahwa pakan telah berhasil di-restock?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Ya, Tandai Selesai'
    }).then(async (res) => {
        if (res.isConfirmed) {
            try {
                await updateDoc(doc(db, "restock_reminders", id), {
                    status: 'Selesai',
                    diselesaikanOleh: currentUserName,
                    waktuSelesai: serverTimestamp()
                });
                Swal.fire('Selesai', 'Pakan telah ditandai berhasil direstock.', 'success');
            } catch (err) {
                Swal.fire('Error', err.message, 'error');
            }
        }
    });
};

window.deleteReminder = function(id) {
    Swal.fire({
        title: 'Hapus Reminder?',
        text: 'Data ini akan dihapus secara permanen dari sistem.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Ya, Hapus'
    }).then(async (res) => {
        if (res.isConfirmed) {
            try {
                await deleteDoc(doc(db, "restock_reminders", id));
                Swal.fire('Terhapus', 'Reminder telah berhasil dihapus.', 'success');
            } catch (err) {
                Swal.fire('Error', err.message, 'error');
            }
        }
    });
};


