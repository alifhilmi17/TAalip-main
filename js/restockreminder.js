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
// GLOBAL STATE
// ==========================================
let dataReminders = [];
let currentUserName = "Pengguna";
let currentUserRole = "petugas";

const reminderCollection = collection(db, "restock_reminders");

document.addEventListener("DOMContentLoaded", () => {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            // ✅ FIX: Deteksi kedalaman folder agar redirect ke login.html utama tidak 404
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
            const adminSnap = await getDoc(doc(db, "admin", user.uid));
            if (adminSnap.exists()) {
                currentUserRole = "admin";
                currentUserName = adminSnap.data().fullname || "Admin";
                document.getElementById('adminSwitchContainer').style.display = 'block';
                const adminActions = document.getElementById('adminActionsContainer');
                if (adminActions) adminActions.style.display = 'block';
            } else {
                const userSnap = await getDoc(doc(db, "user", user.uid));
                if (userSnap.exists()) {
                    const userData = userSnap.data();
                    currentUserName = userData.fullname || "Petugas";
                    const role = (userData.role || 'petugas').toLowerCase();
                    currentUserRole = role.includes('admin') ? 'admin' : 'petugas';
                    if (currentUserRole === 'admin') {
                        const adminActions = document.getElementById('adminActionsContainer');
                        if (adminActions) adminActions.style.display = 'block';
                    }
                }
            }
            // WARN-06 FIX: Gunakan null check agar tidak crash jika elemen tidak ada
            const profileEl = document.querySelector('.profile-name');
            if (profileEl) profileEl.innerText = currentUserName;
        } catch (err) {
            console.warn("Gagal deteksi role:", err);
        }

        startFirestoreListener();
    });
});

let isInitialLoad = true;

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

function renderReminders() {
    const container = document.getElementById('reminderListContainer');
    if (!container) return;

    if (dataReminders.length === 0) {
        container.innerHTML = `<div class="empty-state">
            <span class="empty-icon">📂</span>
            <p>Tidak ada pengingat restock saat ini.</p>
        </div>`;
        return;
    }

    let html = '';
    dataReminders.forEach(r => {
        const isSelesai = r.status === 'Selesai';
        const cardClass = isSelesai ? 'selesai' : (r.prioritas === 'Tinggi' ? 'tinggi' : '');
        const badgePrioritas = r.prioritas === 'Tinggi' ? '<span class="badge badge-tinggi">⚠️ Prioritas Tinggi</span>' : '<span class="badge badge-sedang">⏳ Prioritas Sedang</span>';
        const badgeStatus = isSelesai ? '<span class="badge badge-selesai">✅ Selesai Di-restock</span>' : '<span class="badge badge-pending">⏱️ Pending</span>';
        
        let actions = '';
        if (currentUserRole === 'admin') {
            if (!isSelesai) {
                actions += `<button onclick="markSelesai('${r.id}')" style="background:#10b981; color:white; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-weight:600; margin-right:5px;">✓ Tandai Selesai</button>`;
            }
            actions += `<button onclick="deleteReminder('${r.id}')" style="background:#fee2e2; color:#ef4444; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-weight:600;">🗑️ Hapus</button>`;
        } else if (currentUserRole === 'petugas') {
            if (!isSelesai) {
                actions += `<button onclick="markSelesai('${r.id}')" style="background:#10b981; color:white; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-weight:600;">✓ Restock Selesai</button>`;
            } else {
                actions += `<span style="color:#10b981; font-weight:bold; font-size:0.9rem;">Telah Direstock</span>`;
            }
        }

        const dateStr = r.tglBatas ? new Date(r.tglBatas).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'}) : '-';

        html += `
            <div class="reminder-card ${cardClass}">
                <div class="reminder-info">
                    <h4>📦 ${r.jenisPakan}</h4>
                    <p>${r.catatan || 'Tidak ada catatan tambahan'}</p>
                    <div class="reminder-meta">
                        <span>Batas Waktu: ${dateStr}</span>
                        ${badgePrioritas}
                        ${badgeStatus}
                    </div>
                    <div style="margin-top:8px; font-size:0.75rem; color:#94a3b8;">
                        Dibuat oleh: ${r.dibuatOleh}
                    </div>
                </div>
                <div class="reminder-actions">
                    ${actions}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

window.openReminderModal = function() {
    document.getElementById('reminderForm').reset();
    document.getElementById('reminderId').value = "";
    
    // Default tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.getElementById('tglReminder').value = tomorrow.toISOString().split('T')[0];

    document.getElementById('modalTitle').innerText = "Buat Reminder Baru";
    document.getElementById('reminderModal').classList.add('show');
};

window.closeReminderModal = function() {
    document.getElementById('reminderModal').classList.remove('show');
};

window.saveReminder = async function(e) {
    e.preventDefault();
    const id = document.getElementById('reminderId').value;
    
    // BUG-10 FIX: Saat mode edit, pertahankan status lama (jangan selalu set 'Pending').
    // Ini mencegah reminder yang sudah 'Selesai' ter-reset saat admin mengedit field lain.
    let statusToSave = 'Pending'; // default untuk data baru
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
            Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Reminder berhasil dibuat.', timer: 1500, showConfirmButton: false });
        } else {
            await updateDoc(doc(db, "restock_reminders", id), payload);
            Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Reminder diperbarui.', timer: 1500, showConfirmButton: false });
        }
        closeReminderModal();
    } catch (err) {
        Swal.fire("Error", err.message, "error");
    }
};

window.markSelesai = function(id) {
    Swal.fire({
        title: 'Konfirmasi',
        text: 'Tandai pengingat ini bahwa pakan telah di-restock?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Ya, Tandai Selesai'
    }).then(async (res) => {
        if (res.isConfirmed) {
            await updateDoc(doc(db, "restock_reminders", id), {
                status: 'Selesai',
                diselesaikanOleh: currentUserName,
                waktuSelesai: serverTimestamp()
            });
            Swal.fire('Selesai', 'Pakan telah ditandai berhasil direstock.', 'success');
        }
    });
};

window.deleteReminder = function(id) {
    Swal.fire({
        title: 'Hapus Reminder?',
        text: 'Data ini akan dihapus permanen.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Hapus'
    }).then(async (res) => {
        if (res.isConfirmed) {
            await deleteDoc(doc(db, "restock_reminders", id));
            Swal.fire('Terhapus', 'Reminder telah dihapus.', 'success');
        }
    });
};


