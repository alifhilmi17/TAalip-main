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
