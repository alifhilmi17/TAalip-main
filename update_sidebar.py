import os, re
import glob

nav_template = """      <nav class="main-nav">
        <!-- ===== MENU Dashboard ===== -->
        <a href="dashboardTAalip.html" title="Dashboard">🏠 Dashboard</a>

        <!-- ===== FASE 2: SETUP POPULASI ===== -->
        <button class="has-submenu" onclick="toggleSidebarMenu('ternakSubmenu')" aria-expanded="false">
          🐣 Manajemen Populasi <span class="arrow">▸</span>
        </button>
        <div class="submenu" id="ternakSubmenu" aria-hidden="true">
          <a href="dataAyamTAalip.html">🐓 Data Batch Ayam</a>
        </div>

        <!-- ===== FASE 3: RUTINITAS HARIAN ===== -->
        <button class="has-submenu" onclick="toggleSidebarMenu('harianSubmenu')" aria-expanded="false">
          📋 Operasional Harian <span class="arrow">▸</span>
        </button>
        <div class="submenu" id="harianSubmenu" aria-hidden="true">
          <a href="inputproduksi.html">📝 Input Produksi Telur</a>
          <a href="kesehatanayam.html">🏥 Data Kesehatan & Vaksin</a>
        </div>

        <!-- ===== FASE 4: LOGISTIK & PERSEDIAAN ===== -->
        <button class="has-submenu" onclick="toggleSidebarMenu('persediaanSubmenu')" aria-expanded="false">
          📦 Stok & Logistik <span class="arrow">▸</span>
        </button>
        <div class="submenu" id="persediaanSubmenu" aria-hidden="true">
          <a href="stokpakan.html">🥬 Pencatatan Stok Pakan</a>
          <a href="restockreminder.html">⏰ Restock Reminder</a>
        </div>

        <!-- ===== FASE 5: KEUANGAN ===== -->
        <button class="has-submenu" onclick="toggleSidebarMenu('keuanganSubmenu')" aria-expanded="false">
          💵 Pembukuan Finansial <span class="arrow">▸</span>
        </button>
        <div class="submenu" id="keuanganSubmenu" aria-hidden="true">
          <a href="keuangan.html">💰 Pemasukan & Pengeluaran</a>
        </div>

        <!-- ===== FASE 6: PREDIKSI & ANALISIS ===== -->
        <button class="has-submenu" onclick="toggleSidebarMenu('kelolaSubmenu')" aria-expanded="false">
          🔮 Analisis Prediktif <span class="arrow">▸</span>
        </button>
        <div class="submenu" id="kelolaSubmenu" aria-hidden="true">
          <a href="prediksihasil.html">📈 Prediksi Hasil & Laba</a>
        </div>

        <!-- ===== FASE 7: DOKUMEN & PELAPORAN ===== -->
        <button class="has-submenu" onclick="toggleSidebarMenu('dokumenSubmenu')" aria-expanded="false">
          📂 Pusat Dokumen <span class="arrow">▸</span>
        </button>
        <div class="submenu" id="dokumenSubmenu" aria-hidden="true">
          <a href="dokumen.html">📄 Ekspor Laporan</a>
        </div>

        <!-- ===== TOMBOL KEMBALI KE ADMIN (HANYA UNTUK ADMIN) ===== -->
        <div id="adminSwitchContainer" style="display: none; margin-top: 1.5rem">
          <a href="admin.frontend/admin-core/admin.html" class="admin-back-btn" title="Kembali ke Panel Kontrol">
            🛡️ Kembali ke Admin
          </a>
        </div>
      </nav>"""

for filepath in glob.glob('*.html'):
    if filepath in ['index.html', 'login.html', 'signup.html']:
        continue
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find the nav block
    nav_pattern = re.compile(r'\s*<nav class="main-nav">.*?</nav>', re.DOTALL)
    
    if not nav_pattern.search(content):
        continue

    # Customize nav for this specific file
    filename = os.path.basename(filepath)
    custom_nav = nav_template
    
    # 1. Add active class to the link pointing to the current file
    link_pattern = re.compile(r'(<a href="' + re.escape(filename) + r'")([^>]*>)')
    if link_pattern.search(custom_nav):
        custom_nav = link_pattern.sub(r'\1 class="active"\2', custom_nav)

        # 2. If it is inside a submenu, open the submenu
        blocks = custom_nav.split('<!-- =====')
        for i, block in enumerate(blocks):
            if filename in block:
                blocks[i] = blocks[i].replace('aria-expanded="false"', 'aria-expanded="true"')
                blocks[i] = blocks[i].replace('class="submenu"', 'class="submenu open"')
                blocks[i] = blocks[i].replace('aria-hidden="true"', 'aria-hidden="false"')
        
        custom_nav = '<!-- ====='.join(blocks)
    
    # Replace in file content
    match = nav_pattern.search(content)
    # Get the exact leading whitespace of the matched nav
    leading_ws = match.group(0)[:match.group(0).find('<nav')]
    indented_nav = leading_ws + custom_nav

    new_content = nav_pattern.sub(indented_nav, content, count=1)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print(f'Updated {filename}')
