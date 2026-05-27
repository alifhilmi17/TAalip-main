/* =========================================================
   SISTEM ADMINISTRASI PETERNAKAN (LIBAS)
   File: ui-utils.js
   Deskripsi: Kumpulan fungsi antarmuka (UI) global, pemformat
   data, sanitasi input, dan notifikasi Toast terpadu agar tidak
   terjadi duplikasi kode di setiap halaman (DRY Principle).
========================================================= */

/**
 * 1. SIDEBAR ACCORDION CONTROLLER
 * Fungsi: Membuka/menutup sistem menu list (accordion style) di sidebar samping.
 * Digunakan di: Komponen navigasi sidebar global di seluruh halaman utama.
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
 * 2. DYNAMIC SIDEBAR TEMPLATE LOADER
 * Fungsi: Memuat isi sidebar secara dinamis dari components/sidebar.html.
 * Digunakan di: Seluruh halaman utama saat DOM selesai dimuat (otomatis berjalan).
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
 * 3. SIDEBAR NAVIGATION HIGHLIGHTER
 * Fungsi: Otomatis mendeteksi halaman saat ini dan menandai link aktif di sidebar.
 * Digunakan di: Berjalan otomatis sesaat setelah loadSidebar() selesai memuat HTML.
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
 * 4. SIDEBAR PROFILE & ROLE SYNCRONIZER
 * Fungsi: Memperbarui nama profil dan tombol admin di sidebar dari state global Firestore.
 * Digunakan di: Injeksi otomatis oleh auth-state.js dan loadSidebar() saat sesi login terverifikasi.
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
 * 5. INDONESIAN DATE FORMATTER (YYYY-MM-DD -> Teks Terformat)
 * Fungsi: Mengonversi format tanggal ISO mentah (YYYY-MM-DD) menjadi teks Indonesia yang rapi.
 * Contoh: "2026-05-18" -> "18 Mei 2026"
 * Digunakan di:
 * - Halaman Riwayat Kesehatan & Vaksinasi (kesehatanayam.html)
 * - Halaman Pemasukan & Pengeluaran (keuangan.html)
 * - Halaman Pencatatan Stok Pakan (stokpakan.html)
 * - Halaman Data Batch Ayam (dataAyamTAalip.html)
 */
window.formatTanggal = function(tglString) {
    if (!tglString) return "-";
    const options = { day: 'numeric', month: 'short', year: 'numeric' };
    return new Date(tglString + 'T00:00:00').toLocaleDateString('id-ID', options);
};

/**
 * 6. SECURITY: ANTI-XSS SANITIZER (Pembersih Input Karakter Khusus)
 * Fungsi: Mengamankan teks dari injeksi tag HTML/Javascript berbahaya yang dapat merusak aplikasi.
 * Digunakan di:
 * - Halaman Restock Reminder (restockreminder.html) untuk input catatan kebutuhan pakan.
 * - Halaman Kesehatan & Vaksin (kesehatanayam.html) untuk input gejala dan penanganan medis.
 * - Halaman Pemasukan & Pengeluaran (keuangan.html) untuk kolom deskripsi transaksi manual.
 * - Halaman Data Batch Ayam (dataAyamTAalip.html) untuk kolom jenis telur & kandang.
 */
window.escapeHTML = function(str) {
    if (!str) return '-';
    if (typeof str !== 'string') return str;
    return str.replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag] || tag));
};

/**
 * 7. FORMAT RUPIAH
 * Fungsi: Mengonversi angka mentah ke format Rupiah dengan simbol "Rp" dan pemisah titik.
 * Contoh: 45000 -> "Rp 45.000"
 * Digunakan di:
 * - Halaman Pembukuan Finansial (keuangan.html) untuk menampilkan jumlah pengeluaran/pemasukan.
 * - Halaman Analisis Prediktif (prediksihasil.html) untuk menampilkan estimasi keuntungan dan laba.
 * - Dasbor Utama (dashboardTAalip.html) untuk widget total pendapatan dan pengeluaran bulan ini.
 */
window.formatRupiah = function(angka) {
    if (angka === undefined || angka === null || isNaN(angka)) return 'Rp 0';
    return 'Rp ' + Math.round(angka).toLocaleString('id-ID');
};

/**
 * 8. FORMAT PEMISAH RIBUAN
 * Fungsi: Mengonversi angka mentah bulat ke format dengan pemisah ribuan Indonesia (tanpa simbol Rp).
 * Contoh: 1000 -> "1.000"
 * Digunakan di:
 * - Halaman Analisis Prediktif (prediksihasil.html) untuk estimasi jumlah butir telur.
 * - Dasbor Utama (dashboardTAalip.html) untuk widget total butir telur dan total ayam aktif.
 * - Halaman Data Batch Ayam (dataAyamTAalip.html) untuk populasi awal dan sisa ayam.
 */
window.formatRibuan = function(angka) {
    if (angka === undefined || angka === null || isNaN(angka)) return '0';
    return Math.round(angka).toLocaleString('id-ID');
};

/**
 * 9. INPUT FIELD REAL-TIME FORMATTER (Pemisah Ribuan Otomatis)
 * Fungsi: Memformat isian input numerik secara real-time dengan titik pemisah saat pengguna mengetik.
 * Digunakan di:
 * - Halaman Pembukuan Finansial (keuangan.html) pada input nominal jumlah uang.
 * - Halaman Analisis Prediktif (prediksihasil.html) pada isian input harga pakan per kg.
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
 * 10. NOTIFICATION: PREMIUM TOAST ALERT (SweetAlert Wrapper)
 * Fungsi: Menampilkan pesan notifikasi melayang (Toast) yang elegan di pojok kanan atas layar.
 * Memiliki sistem fallback otomatis ke alert standar browser jika pustaka SweetAlert2 gagal dimuat.
 * Digunakan di:
 * - Halaman Riwayat Kesehatan & Vaksin (kesehatanayam.html) untuk sukses simpan/update data medis.
 * - Halaman Pencatatan Stok Pakan (stokpakan.html) untuk sukses re-stock dan pemakaian pakan.
 * - Halaman Pemasukan & Pengeluaran (keuangan.html) untuk pencatatan transaksi baru.
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
