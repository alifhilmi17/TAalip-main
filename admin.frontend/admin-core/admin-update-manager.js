/* =========================================================
   SISTEM ADMINISTRASI PETERNAKAN (LIBAS)
   File: admin-update-manager.js
   Deskripsi: Modul manajemen pembaruan aplikasi untuk Admin Panel.
   Memungkinkan admin membuat, mempratinjau, dan mempublish
   pemberitahuan update ke Firestore (system_config/app_version).
========================================================= */

import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { db } from "../../firebase.component/firebase-init.js";
import { CURRENT_APP_VERSION, showUpdateModal } from "../../js/version-checker.js";

// =========================================================
// 1. STATE & REFERENCES
// =========================================================
let changelogItems = [];

// Referensi DOM
const els = {};
function initElements() {
    els.latestVersion   = document.getElementById('umLatestVersion');
    els.minVersion      = document.getElementById('umMinVersion');
    els.title           = document.getElementById('umTitle');
    els.releaseDate     = document.getElementById('umReleaseDate');
    els.downloadUrl     = document.getElementById('umDownloadUrl');
    els.forceUpdate     = document.getElementById('umForceUpdate');
    els.changelogList   = document.getElementById('umChangelogList');
    els.newChangelogItem = document.getElementById('umNewChangelogItem');
    els.btnAddChangelog  = document.getElementById('btnAddChangelog');
    els.btnPreview       = document.getElementById('btnPreviewUpdate');
    els.btnPublish       = document.getElementById('btnPublishUpdate');
    els.btnLoad          = document.getElementById('btnLoadCurrentVersion');
    
    // Preview elements
    els.previewTitle       = document.getElementById('umPreviewTitle');
    els.previewCurrentVer  = document.getElementById('umPreviewCurrentVer');
    els.previewLatestVer   = document.getElementById('umPreviewLatestVer');
    els.previewDate        = document.getElementById('umPreviewDate');
    els.previewChangelog   = document.getElementById('umPreviewChangelog');
    els.previewForceBadge  = document.getElementById('umPreviewForceBadge');
    els.previewBtnLater    = document.getElementById('umPreviewBtnLater');
    els.statusValue        = document.getElementById('umStatusValue');
    els.statusCard         = document.getElementById('umPublishStatus');
}

// =========================================================
// 2. CHANGELOG MANAGEMENT
// =========================================================

/**
 * Menambahkan item baru ke daftar changelog
 */
function addChangelogItem(text) {
    if (!text || !text.trim()) return;
    const trimmed = text.trim();
    
    // Cegah duplikasi
    if (changelogItems.includes(trimmed)) return;
    
    changelogItems.push(trimmed);
    renderChangelogList();
    updateLivePreview();
    
    // Kosongkan input
    if (els.newChangelogItem) {
        els.newChangelogItem.value = '';
        els.newChangelogItem.focus();
    }
}

/**
 * Menghapus item changelog berdasarkan index
 */
function removeChangelogItem(index) {
    changelogItems.splice(index, 1);
    renderChangelogList();
    updateLivePreview();
}

/**
 * Merender ulang daftar changelog di form
 */
function renderChangelogList() {
    if (!els.changelogList) return;
    
    if (changelogItems.length === 0) {
        els.changelogList.innerHTML = '';
        return;
    }
    
    els.changelogList.innerHTML = changelogItems.map((item, index) => `
        <div class="um-changelog-item">
            <span class="um-cl-text">• ${escapeHtml(item)}</span>
            <button type="button" class="um-cl-remove" data-index="${index}" title="Hapus">×</button>
        </div>
    `).join('');
    
    // Attach event listeners to remove buttons
    els.changelogList.querySelectorAll('.um-cl-remove').forEach(btn => {
        btn.addEventListener('click', () => {
            removeChangelogItem(parseInt(btn.dataset.index));
        });
    });
}

// =========================================================
// 3. LIVE PREVIEW
// =========================================================

/**
 * Memperbarui tampilan pratinjau secara real-time
 */
function updateLivePreview() {
    const version = els.latestVersion?.value || '?.?.?';
    const title = els.title?.value || `Pembaruan Sistem LIBAS v${version}`;
    const force = els.forceUpdate?.checked || false;
    const releaseDate = els.releaseDate?.value;
    
    // Update preview title
    if (els.previewTitle) {
        els.previewTitle.textContent = title;
    }
    
    // Update version numbers
    if (els.previewCurrentVer) {
        els.previewCurrentVer.textContent = `v${CURRENT_APP_VERSION}`;
    }
    if (els.previewLatestVer) {
        els.previewLatestVer.textContent = `v${version}`;
    }
    
    // Update release date
    if (els.previewDate && releaseDate) {
        const dateObj = new Date(releaseDate + 'T00:00:00');
        els.previewDate.textContent = `Dirilis pada: ${dateObj.toLocaleDateString('id-ID', { 
            day: 'numeric', month: 'long', year: 'numeric' 
        })}`;
    } else if (els.previewDate) {
        els.previewDate.textContent = '-';
    }
    
    // Update changelog preview
    if (els.previewChangelog) {
        if (changelogItems.length > 0) {
            els.previewChangelog.innerHTML = changelogItems.map(item => 
                `<li>${escapeHtml(item)}</li>`
            ).join('');
        } else {
            els.previewChangelog.innerHTML = '<li class="um-pc-empty">Belum ada catatan perubahan</li>';
        }
    }
    
    // Update force update badge
    if (els.previewForceBadge) {
        els.previewForceBadge.style.display = force ? 'block' : 'none';
    }
    
    // Update "Nanti Saja" button visibility (hidden when force update)
    if (els.previewBtnLater) {
        els.previewBtnLater.style.display = force ? 'none' : 'block';
    }
}

// =========================================================
// 4. BUILD FIRESTORE DATA
// =========================================================

/**
 * Mengumpulkan data dari form dan membangun objek untuk Firestore
 */
function buildUpdateData() {
    const latestVersion = els.latestVersion?.value?.trim();
    const minVersion = els.minVersion?.value?.trim() || latestVersion;
    const title = els.title?.value?.trim() || `Pembaruan Sistem LIBAS v${latestVersion}`;
    const releaseDate = els.releaseDate?.value;
    const downloadUrl = els.downloadUrl?.value?.trim() || '';
    const forceUpdate = els.forceUpdate?.checked || false;
    
    // Format tanggal rilis
    let formattedDate = '';
    if (releaseDate) {
        const dateObj = new Date(releaseDate + 'T00:00:00');
        formattedDate = dateObj.toLocaleDateString('id-ID', { 
            day: 'numeric', month: 'long', year: 'numeric' 
        });
    } else {
        formattedDate = new Date().toLocaleDateString('id-ID', { 
            day: 'numeric', month: 'long', year: 'numeric' 
        });
    }
    
    return {
        latest_version: latestVersion,
        min_required_version: minVersion,
        title: title,
        release_date: formattedDate,
        whats_new: [...changelogItems],
        download_url: downloadUrl,
        force_update: forceUpdate
    };
}

// =========================================================
// 5. VALIDASI
// =========================================================

/**
 * Validasi input form sebelum publish
 */
function validateForm() {
    const version = els.latestVersion?.value?.trim();
    
    if (!version) {
        Swal.fire({
            icon: 'warning',
            title: 'Versi Terbaru Wajib Diisi',
            text: 'Masukkan nomor versi terbaru (contoh: 1.1.0)',
            background: '#1e2430',
            color: '#fff',
            confirmButtonColor: '#7c3aed'
        });
        els.latestVersion?.focus();
        return false;
    }
    
    // Validasi format semver sederhana
    const semverRegex = /^\d+\.\d+\.\d+$/;
    if (!semverRegex.test(version)) {
        Swal.fire({
            icon: 'warning',
            title: 'Format Versi Tidak Valid',
            text: 'Gunakan format semver: major.minor.patch (contoh: 1.1.0)',
            background: '#1e2430',
            color: '#fff',
            confirmButtonColor: '#7c3aed'
        });
        els.latestVersion?.focus();
        return false;
    }
    
    if (changelogItems.length === 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Catatan Perubahan Kosong',
            text: 'Tambahkan minimal 1 catatan perubahan sebelum publish.',
            background: '#1e2430',
            color: '#fff',
            confirmButtonColor: '#7c3aed'
        });
        els.newChangelogItem?.focus();
        return false;
    }
    
    return true;
}

// =========================================================
// 6. PUBLISH TO FIRESTORE
// =========================================================

/**
 * Mempublish data pembaruan ke Firestore
 */
async function publishUpdate() {
    if (!validateForm()) return;
    
    const data = buildUpdateData();
    
    // Konfirmasi sebelum publish
    const confirm = await Swal.fire({
        icon: 'question',
        title: 'Publish Pembaruan?',
        html: `
            <div style="text-align: left; font-size: 0.9rem; line-height: 1.7;">
                <p><strong>Versi:</strong> v${data.latest_version}</p>
                <p><strong>Wajib Update:</strong> ${data.force_update ? '✅ Ya (Force)' : '❌ Tidak'}</p>
                <p><strong>Catatan:</strong> ${data.whats_new.length} item</p>
                <hr style="border-color: #e2e8f0; margin: 8px 0;">
                <p style="color: #ef4444; font-size: 0.82rem;">
                    ⚠️ Data ini akan langsung terlihat oleh semua pengguna (petugas/user) yang membuka aplikasi.
                </p>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: '📢 Ya, Publish Sekarang',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#7c3aed',
        cancelButtonColor: '#64748b'
    });
    
    if (!confirm.isConfirmed) return;
    
    try {
        const docRef = doc(db, "system_config", "app_version");
        await setDoc(docRef, data, { merge: true });
        
        // Update status card
        updateStatusCard(data, true);
        
        Swal.fire({
            icon: 'success',
            title: 'Berhasil Dipublish! 🎉',
            html: `
                <p>Pemberitahuan pembaruan <strong>v${data.latest_version}</strong> telah berhasil disimpan ke Firestore.</p>
                <p style="font-size: 0.82rem; color: #64748b; margin-top: 8px;">
                    Semua pengguna (petugas/user) akan melihat notifikasi update pada sesi berikutnya.
                </p>
            `,
            confirmButtonColor: '#7c3aed',
            confirmButtonText: 'Tutup'
        });
        
        console.log('%c[UpdateManager] Pembaruan berhasil dipublish ke Firestore!', 'color: #4caf50; font-weight: bold;', data);
        
    } catch (err) {
        console.error('[UpdateManager] Gagal publish:', err);
        Swal.fire({
            icon: 'error',
            title: 'Gagal Publish',
            text: `Terjadi kesalahan: ${err.message}`,
            confirmButtonColor: '#ef4444'
        });
    }
}

// =========================================================
// 7. LOAD EXISTING DATA
// =========================================================

/**
 * Memuat data versi yang sudah ada dari Firestore
 */
async function loadCurrentVersion() {
    try {
        const docRef = doc(db, "system_config", "app_version");
        const snapshot = await getDoc(docRef);
        
        if (!snapshot.exists()) {
            updateStatusCard(null, false);
            Swal.fire({
                icon: 'info',
                title: 'Belum Ada Data',
                text: 'Dokumen app_version belum ada di Firestore. Silakan buat pemberitahuan baru.',
                confirmButtonColor: '#7c3aed'
            });
            return;
        }
        
        const data = snapshot.data();
        console.log('[UpdateManager] Data terkini dari Firestore:', data);
        
        // Isi form dengan data yang ada
        if (els.latestVersion) els.latestVersion.value = data.latest_version || '';
        if (els.minVersion) els.minVersion.value = data.min_required_version || '';
        if (els.title) els.title.value = data.title || '';
        if (els.downloadUrl) els.downloadUrl.value = data.download_url || '';
        if (els.forceUpdate) els.forceUpdate.checked = !!data.force_update;
        
        // Parse tanggal rilis ke format input date
        if (data.release_date && els.releaseDate) {
            try {
                // Coba parse dari format Indonesia
                const months = {
                    'januari': '01', 'februari': '02', 'maret': '03', 'april': '04',
                    'mei': '05', 'juni': '06', 'juli': '07', 'agustus': '08',
                    'september': '09', 'oktober': '10', 'november': '11', 'desember': '12'
                };
                const parts = data.release_date.toLowerCase().split(' ');
                if (parts.length === 3 && months[parts[1]]) {
                    const day = parts[0].padStart(2, '0');
                    const month = months[parts[1]];
                    const year = parts[2];
                    els.releaseDate.value = `${year}-${month}-${day}`;
                }
            } catch (_) {
                // Abaikan jika parsing gagal
            }
        }
        
        // Isi changelog items
        changelogItems = Array.isArray(data.whats_new) ? [...data.whats_new] : [];
        renderChangelogList();
        updateLivePreview();
        updateStatusCard(data, true);
        
        Swal.fire({
            icon: 'success',
            title: 'Data Berhasil Dimuat',
            text: `Versi terkini: v${data.latest_version}`,
            confirmButtonColor: '#7c3aed',
            timer: 2000,
            showConfirmButton: false
        });
        
    } catch (err) {
        console.error('[UpdateManager] Gagal memuat data:', err);
        Swal.fire({
            icon: 'error',
            title: 'Gagal Memuat Data',
            text: `Pastikan Firestore security rules mengizinkan akses read pada system_config. Error: ${err.message}`,
            confirmButtonColor: '#ef4444'
        });
    }
}

// =========================================================
// 8. PREVIEW POPUP (SWAL)
// =========================================================

/**
 * Menampilkan preview popup SweetAlert seperti yang dilihat user
 */
function previewUpdatePopup() {
    const version = els.latestVersion?.value?.trim();
    if (!version) {
        Swal.fire({
            icon: 'info',
            title: 'Isi Versi Terlebih Dahulu',
            text: 'Masukkan nomor versi untuk melihat preview popup.',
            confirmButtonColor: '#7c3aed'
        });
        return;
    }
    
    const data = buildUpdateData();
    const isForce = data.force_update;
    
    // Gunakan showUpdateModal dari version-checker.js
    showUpdateModal(data, isForce);
}

// =========================================================
// 9. STATUS CARD
// =========================================================

/**
 * Update tampilan status card di bawah preview
 */
function updateStatusCard(data, hasData) {
    if (!els.statusCard || !els.statusValue) return;
    
    if (hasData && data) {
        els.statusCard.classList.remove('um-status-empty');
        els.statusValue.innerHTML = `
            Versi <strong>v${data.latest_version}</strong> terpublish
            ${data.force_update ? ' · <span style="color: #ef4444;">Force Update AKTIF</span>' : ''}
            ${data.release_date ? ` · ${data.release_date}` : ''}
        `;
    } else {
        els.statusCard.classList.add('um-status-empty');
        els.statusValue.textContent = 'Belum ada data terpublish';
    }
}

// =========================================================
// 10. UTILITY
// =========================================================

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// =========================================================
// 11. INITIALIZATION
// =========================================================

function initUpdateManager() {
    initElements();
    
    // Pastikan elemen sudah ada sebelum bind events
    if (!els.latestVersion) {
        console.log('[UpdateManager] Elemen belum ada, skip inisialisasi.');
        return;
    }
    
    console.log('[UpdateManager] Menginisialisasi modul Manajemen Pembaruan...');
    
    // Set default date ke hari ini
    if (els.releaseDate) {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        els.releaseDate.value = `${yyyy}-${mm}-${dd}`;
    }
    
    // Set current version di preview
    if (els.previewCurrentVer) {
        els.previewCurrentVer.textContent = `v${CURRENT_APP_VERSION}`;
    }
    
    // --- EVENT LISTENERS ---
    
    // Tambah changelog item via tombol
    els.btnAddChangelog?.addEventListener('click', () => {
        addChangelogItem(els.newChangelogItem?.value);
    });
    
    // Tambah changelog item via Enter
    els.newChangelogItem?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addChangelogItem(els.newChangelogItem.value);
        }
    });
    
    // Live preview update pada setiap perubahan form
    const formInputs = [els.latestVersion, els.minVersion, els.title, els.releaseDate, els.downloadUrl];
    formInputs.forEach(input => {
        input?.addEventListener('input', updateLivePreview);
    });
    
    // Toggle force update
    els.forceUpdate?.addEventListener('change', updateLivePreview);
    
    // Preview popup via SweetAlert
    els.btnPreview?.addEventListener('click', previewUpdatePopup);
    
    // Publish ke Firestore
    els.btnPublish?.addEventListener('click', publishUpdate);
    
    // Muat data terkini dari Firestore
    els.btnLoad?.addEventListener('click', loadCurrentVersion);
    
    // Auto-load data saat pertama kali section dibuka
    loadCurrentVersion();
    
    // Initial preview
    updateLivePreview();
    
    console.log('[UpdateManager] ✅ Modul Manajemen Pembaruan siap.');
}

// =========================================================
// BOOT
// =========================================================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUpdateManager);
} else {
    initUpdateManager();
}
