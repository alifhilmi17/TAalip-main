/* =========================================================
   SISTEM ADMINISTRASI PETERNAKAN (LIBAS)
   File: ui-utils.js
   Deskripsi: Kumpulan fungsi antarmuka (UI) global agar tidak 
   terjadi duplikasi kode di setiap halaman (DRY Principle).
========================================================= */

/**
 * Membuka/menutup sistem menu list (accordion style) di sidebar samping.
 */
window.toggleSidebarMenu = function(submenuId) {
    const submenu = document.getElementById(submenuId);
    if (!submenu) return;
    
    if (submenu.classList.contains('show')) {
        submenu.classList.remove('show');
    }
    
    const isHidden = submenu.getAttribute("aria-hidden") === "true";
    const parentButton = submenu.previousElementSibling;

    submenu.setAttribute("aria-hidden", !isHidden);
    
    if (parentButton) {
        parentButton.setAttribute("aria-expanded", isHidden);
        if (isHidden) {
            parentButton.classList.add("active-parent");
        } else {
            parentButton.classList.remove("active-parent");
        }
    }
};

/**
 * Memuat isi sidebar secara dinamis dari components/sidebar.html
 */
window.loadSidebar = function() {
    const sidebar = document.querySelector("aside.sidebar");
    if (!sidebar) return;

    // Tentukan path ke sidebar.html berdasarkan kedalaman folder saat ini
    const href = window.location.href;
    let sidebarPath = 'components/sidebar.html';
    if (href.includes('admin-core')) {
        sidebarPath = '../../components/sidebar.html';
    } else if (href.includes('admin.frontend')) {
        sidebarPath = '../components/sidebar.html';
    }

    fetch(sidebarPath)
        .then(response => {
            if (!response.ok) throw new Error("Template sidebar tidak ditemukan");
            return response.text();
        })
        .then(html => {
            sidebar.innerHTML = html;
            
            // 1. Sorot menu yang sedang aktif secara otomatis
            window.highlightActiveSidebarMenu();
            
            // 2. Isi data profil dari window.userProfileState jika data tersebut sudah termuat dari auth-state.js
            window.updateSidebarProfileFromGlobalState();
        })
        .catch(err => console.error("Gagal memuat sidebar dinamis: ", err));
};

/**
 * Otomatis mendeteksi halaman saat ini dan menandai link aktif di sidebar
 */
window.highlightActiveSidebarMenu = function() {
    const currentPath = window.location.pathname;
    const currentPage = currentPath.substring(currentPath.lastIndexOf('/') + 1) || 'dashboardTAalip.html';
    
    const sidebar = document.querySelector("aside.sidebar");
    if (!sidebar) return;
    
    const links = sidebar.querySelectorAll("nav.main-nav a");
    links.forEach(link => {
        const hrefAttr = link.getAttribute("href");
        if (hrefAttr) {
            // Dapatkan nama file dari atribut href
            const linkPage = hrefAttr.substring(hrefAttr.lastIndexOf('/') + 1);
            if (linkPage === currentPage) {
                link.classList.add("active");
                
                // Jika menu berada di dalam submenu, buka submenunya secara otomatis
                const submenu = link.closest(".submenu");
                if (submenu) {
                    submenu.classList.add("show");
                    submenu.setAttribute("aria-hidden", "false");
                    
                    const parentButton = submenu.previousElementSibling;
                    if (parentButton) {
                        parentButton.setAttribute("aria-expanded", "true");
                        parentButton.classList.add("active-parent");
                    }
                }
            } else {
                link.classList.remove("active");
            }
        }
    });
};

/**
 * Memperbarui nama profil dan tombol admin di sidebar dari state global
 */
window.updateSidebarProfileFromGlobalState = function() {
    if (window.userProfileState) {
        const { displayName, isAdmin } = window.userProfileState;
        
        const profileNames = document.querySelectorAll(".profile-name");
        profileNames.forEach(el => {
            el.textContent = displayName || "Peternak";
        });
        
        const adminSwitch = document.getElementById("adminSwitchContainer");
        if (adminSwitch) {
            adminSwitch.style.display = isAdmin ? "block" : "none";
        }
    }
};

// Panggil pemuatan sidebar secara otomatis saat DOMContentLoaded
document.addEventListener("DOMContentLoaded", () => {
    window.loadSidebar();
});

/**
 * Format tanggal YYYY-MM-DD ke teks Indonesia (contoh: "18 Mei 2026")
 */
window.formatTanggal = function(tglString) {
    if (!tglString) return "-";
    const options = { day: 'numeric', month: 'short', year: 'numeric' };
    return new Date(tglString + 'T00:00:00').toLocaleDateString('id-ID', options);
};

/**
 * Mengamankan string teks dari injeksi HTML/Javascript berbahaya (XSS)
 */
window.escapeHTML = function(str) {
    if (!str) return '-';
    if (typeof str !== 'string') return str;
    return str.replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag] || tag));
};

/**
 * Konversi angka mentah ke Rupiah dengan pemisah titik
 * Contoh: 45000 -> "Rp 45.000"
 */
window.formatRupiah = function(angka) {
    if (angka === undefined || angka === null || isNaN(angka)) return 'Rp 0';
    return 'Rp ' + Math.round(angka).toLocaleString('id-ID');
};

/**
 * Konversi angka mentah ke format ribuan Indonesia
 * Contoh: 1000 -> "1.000"
 */
window.formatRibuan = function(angka) {
    if (angka === undefined || angka === null || isNaN(angka)) return '0';
    return Math.round(angka).toLocaleString('id-ID');
};

/**
 * Memformat input field secara real-time dengan pemisah ribuan saat user mengetik.
 * Hubungkan ke HTML: oninput="window.formatNumberInput(this)"
 */
window.formatNumberInput = function(inputElem) {
    let val = inputElem.value.replace(/[^,\d]/g, '');
    let parts = val.split(',');
    let sisa = parts[0].length % 3;
    let rupiah = parts[0].substr(0, sisa);
    let ribuan = parts[0].substr(sisa).match(/\d{3}/gi);
    
    if (ribuan) {
        let separator = sisa ? '.' : '';
        rupiah += separator + ribuan.join('.');
    }
    inputElem.value = parts[1] !== undefined ? rupiah + ',' + parts[1] : rupiah;
};

/**
 * Menampilkan pesan toast sukses/gagal di pojok kanan atas secara elegan (SweetAlert Wrapper)
 * @param {string} title - Judul pesan
 * @param {string} text - Deskripsi pesan
 * @param {'success'|'error'|'warning'|'info'} icon - Tipe ikon
 */
window.showToast = function(title, text, icon = 'success') {
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: icon,
            title: title,
            text: text,
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 2000,
            timerProgressBar: true
        });
    } else {
        alert(`${title}: ${text}`);
    }
};
