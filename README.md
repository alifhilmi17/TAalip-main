<p align="center">
  <span style="font-size: 80px;">🐔</span>
</p>

<h1 align="center">LIBAS — Lintau Buo Administration System</h1>

<p align="center">
  <strong>Sistem Administrasi Peternakan Ayam Petelur Berbasis Web</strong><br/>
  <em>Tugas Akhir (TA) — Aplikasi Web Manajemen Peternakan dengan Fitur Prediksi Moving Average</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Firebase-v10.9.0-FFCA28?style=for-the-badge&logo=firebase&logoColor=white" alt="Firebase"/>
  <img src="https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript"/>
  <img src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white" alt="HTML5"/>
  <img src="https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white" alt="CSS3"/>
  <img src="https://img.shields.io/badge/Chart.js-FF6384?style=for-the-badge&logo=chartdotjs&logoColor=white" alt="Chart.js"/>
</p>

---

## 📋 Daftar Isi

- [Tentang Proyek](#-tentang-proyek)
- [Fitur Utama](#-fitur-utama)
- [Arsitektur Sistem](#-arsitektur-sistem)
- [Tech Stack](#-tech-stack)
- [Struktur Direktori](#-struktur-direktori)
- [Prasyarat](#-prasyarat)
- [Instalasi & Menjalankan](#-instalasi--menjalankan)
- [Konfigurasi Firebase](#-konfigurasi-firebase)
- [Sistem Role & Autentikasi](#-sistem-role--autentikasi)
- [Algoritma Moving Average](#-algoritma-moving-average)
- [Screenshot](#-screenshot)
- [Lisensi](#-lisensi)

---

## 🐣 Tentang Proyek

**LIBAS (Lintau Buo Administration System)** adalah aplikasi web berbasis cloud yang dirancang untuk mendigitalisasi seluruh proses administrasi peternakan ayam petelur. Sistem ini mengintegrasikan pencatatan produksi, manajemen populasi ayam, pelacakan kesehatan & vaksinasi, kontrol stok pakan, pembukuan keuangan, dan **fitur unggulan berupa Sistem Peramalan (Forecasting)** menggunakan algoritma **Moving Average** yang telah dimodifikasi dengan pendekatan heuristik.

Proyek ini dikembangkan sebagai **Tugas Akhir (TA)** dengan tujuan menyediakan solusi manajemen peternakan yang profesional, efisien, dan terorganisir bagi peternak ayam petelur di wilayah Lintau Buo dan sekitarnya.

### 🎯 Latar Belakang Masalah

- Pencatatan data peternakan masih dilakukan secara manual (buku tulis)
- Tidak ada sistem prediksi yang membantu peternak merencanakan bisnis
- Monitoring kesehatan ayam dan stok pakan tidak terstruktur
- Kesulitan dalam membuat laporan keuangan periodik

---

## ✨ Fitur Utama

### 🏠 Dashboard Utama
- Ringkasan statistik real-time (produksi, keuangan, populasi)
- Grafik produksi telur & keuangan interaktif via **Chart.js**
- **Alert Banner Dinamis** — peringatan otomatis jika stok pakan rendah, ayam sakit, atau mortalitas tinggi
- Widget jadwal, aktivitas, dan pengumuman terkini

### 🐓 Manajemen Populasi (Fase 2)
- Pencatatan batch ayam (nama batch, jumlah, lokasi kandang, umur)
- CRUD data ayam dengan modal interaktif
- Statistik ringkas populasi aktif per kandang

### 📝 Input Produksi Harian (Fase 3)
- Pencatatan produksi telur harian per kandang
- Kategorisasi kualitas telur (Baik / Cacat / Pecah)
- Ringkasan otomatis: total telur, berat rata-rata, dan persentase kualitas
- Tabel riwayat produksi dengan filter & pagination

### 🏥 Kesehatan & Vaksinasi (Fase 3)
- Pencatatan riwayat medis dan status kesehatan ayam
- Jadwal vaksinasi terstruktur
- Integrasi dengan algoritma prediksi via **Faktor Penalti** (Penalty Factor)

### 🥬 Manajemen Stok Pakan (Fase 4)
- Pencatatan pakan masuk dan pemakaian harian (Kg)
- Kartu statistik: total masuk, total keluar, sisa stok
- Riwayat transaksi pakan dengan detail lengkap

### ⏰ Restock Reminder (Fase 4)
- Pengingat otomatis ketika stok pakan menipis
- Widget **Live Stock** dengan indikator real-time
- Notifikasi level kritis dan level rendah yang bisa dikonfigurasi

### 💰 Manajemen Keuangan (Fase 5)
- Input pemasukan (penjualan telur) & pengeluaran (pakan, obat, dll)
- Rincian transaksi dengan filter berdasarkan kategori dan tanggal
- Kalkulasi otomatis saldo dan laba/rugi

### 📈 Prediksi Cerdas Moving Average (Fase 6) — *Fitur Unggulan TA*
- **Prediksi Produksi Telur** menggunakan algoritma Moving Average (MA)
- **Prediksi Keuntungan/Laba** dengan kalibrasi Offset Keuangan
- **Faktor Penalti Ayam Sakit** — integrasi data kesehatan untuk koreksi prediksi
- Visualisasi **Dual-Axis Chart** (data aktual vs proyeksi)
- **Evaluasi Akurasi Model** — Backtesting otomatis (MAE & MAPE)
- Rekomendasi prediktif otomatis berdasarkan analisis
- Histori prediksi tersimpan di Firestore

### 📄 Pusat Dokumen & Laporan (Fase 7)
- Ekspor laporan ke format **Excel (.xlsx)** via **ExcelJS**
- Template laporan profesional multi-sheet
- Filter rentang data untuk laporan periodik

### 🛡️ Panel Admin (Admin Panel)
- Dashboard khusus administrator / pemilik peternakan
- **Manajemen Pengguna** — aktivasi, nonaktifkan, dan kelola akun petugas
- **Status Kesehatan Sistem** — monitoring koleksi database
- **Ringkasan Data** — agregat seluruh data operasional
- **Log Keamanan (Audit Log)** — riwayat akses dan aktivitas pengguna
- Manajemen stok pakan & restock reminder terpusat
- Gerbang keamanan tingkat lanjut (admin-gate)

### 👤 Profil Pengguna
- Edit profil (nama, username, info kontak)
- Upload & ganti foto profil
- Desain UI premium dengan animasi glassmorphism

---

## 🏗 Arsitektur Sistem

```
┌─────────────────────────────────────────────────────┐
│                   KLIEN (BROWSER)                    │
│  ┌───────────┐  ┌───────────┐  ┌──────────────────┐ │
│  │  HTML5     │  │  CSS3     │  │  JavaScript ES6+ │ │
│  │  Pages     │  │  Styling  │  │  Modules         │ │
│  └─────┬─────┘  └─────┬─────┘  └────────┬─────────┘ │
│        │              │                  │           │
│        └──────────────┼──────────────────┘           │
│                       │                              │
│  ┌────────────────────┴──────────────────────────┐   │
│  │           UI Utils & Component Loader          │   │
│  │       (Sidebar, Toast, Formatter, Sanitizer)   │   │
│  └────────────────────┬──────────────────────────┘   │
│                       │                              │
│  ┌────────────────────┴──────────────────────────┐   │
│  │       Firebase Component Layer                 │   │
│  │  ┌──────────┐ ┌────────────┐ ┌──────────────┐ │   │
│  │  │ firebase │ │ auth-state │ │ login/signup  │ │   │
│  │  │ -init.js │ │    .js     │ │ interactive  │ │   │
│  │  └────┬─────┘ └─────┬──────┘ └──────┬───────┘ │   │
│  └───────┼─────────────┼───────────────┼─────────┘   │
│          │             │               │             │
└──────────┼─────────────┼───────────────┼─────────────┘
           │             │               │
           ▼             ▼               ▼
┌─────────────────────────────────────────────────────┐
│              GOOGLE FIREBASE (CLOUD)                 │
│  ┌──────────────┐  ┌───────────────────────────┐    │
│  │ Firebase     │  │  Cloud Firestore          │    │
│  │ Auth         │  │  (NoSQL Database)         │    │
│  │              │  │                           │    │
│  │ • Login      │  │  Koleksi:                 │    │
│  │ • Signup     │  │  • user        • admin    │    │
│  │ • Session    │  │  • produksi    • keuangan │    │
│  │ • Role-based │  │  • ayam        • pakan    │    │
│  └──────────────┘  │  • kesehatan  • vaksinasi│    │
│                    │  • prediksi   • reminders │    │
│                    │  • activity_log           │    │
│                    └───────────────────────────┘    │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │  IndexedDB Persistence (Offline Support)     │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

---

## 🛠 Tech Stack

| Kategori | Teknologi | Keterangan |
|----------|-----------|------------|
| **Frontend** | HTML5, CSS3, JavaScript (ES6+ Modules) | Vanilla stack tanpa framework |
| **Backend / Database** | Google Firebase (Firestore + Auth) | Serverless, real-time sync |
| **Font** | Google Fonts — Poppins | Tipografi modern |
| **Animasi** | Animate.css v4.1.1 | Efek transisi elemen |
| **Notifikasi** | SweetAlert2 v11 | Pop-up dialog interaktif |
| **Grafik** | Chart.js | Visualisasi data produksi & keuangan |
| **Ekspor Laporan** | ExcelJS v4.4.0 | Generasi file `.xlsx` profesional |
| **UI Design** | Glassmorphism, Gradient, Micro-animation | Desain premium & responsif |
| **Offline Support** | Firebase IndexedDB Persistence | Dukungan akses tanpa internet |
| **Web Server (Lokal)** | XAMPP (Apache) | Lingkungan pengembangan lokal |

---

## 📁 Struktur Direktori

```
TAalip-main/
├── 📄 index.html                  # Landing Page (Beranda Utama)
├── 📄 login.html                  # Halaman Login (Role-based: Petugas/Admin)
├── 📄 signup.html                 # Halaman Registrasi Akun Petugas
├── 📄 dashboardTAalip.html        # Dashboard Utama (Pusat Kontrol)
├── 📄 dataAyamTAalip.html         # Manajemen Data Batch Ayam
├── 📄 inputproduksi.html          # Input Produksi Telur Harian
├── 📄 kesehatanayam.html          # Kesehatan Ayam & Vaksinasi
├── 📄 stokpakan.html              # Manajemen Stok Pakan
├── 📄 restockreminder.html        # Restock Reminder (Pengingat Stok)
├── 📄 keuangan.html               # Manajemen Keuangan
├── 📄 prediksihasil.html          # Prediksi Hasil Telur & Laba (MA)
├── 📄 dokumen.html                # Pusat Dokumen & Ekspor Laporan
├── 📄 editProfileTAalip.html      # Edit Profil Pengguna
│
├── 📁 js/                         # Logika Bisnis (JavaScript Modules)
│   ├── dashboardTAalip.js         # Controller Dashboard (84 KB)
│   ├── prediksihasil.js           # Engine Prediksi MA (97 KB) ★
│   ├── inputproduksi.js           # CRUD Produksi Telur (58 KB)
│   ├── dokumen.js                 # Ekspor Laporan Excel (50 KB)
│   ├── keuangan.js                # CRUD Keuangan (30 KB)
│   ├── stokpakan.js               # CRUD Stok Pakan (27 KB)
│   ├── kesehatanayam.js           # CRUD Kesehatan & Vaksin (23 KB)
│   ├── restockreminder.js         # Logika Restock Reminder (19 KB)
│   ├── dataAyamTAalip.js          # CRUD Data Ayam (17 KB)
│   ├── editProfileTAalip.js       # Edit Profil User (13 KB)
│   ├── ui-utils.js                # Utilitas UI Global (10 KB)
│   └── ma-core.js                 # Core Algorithm Moving Average (4 KB) ★
│
├── 📁 css/                        # Stylesheet per Halaman
│   ├── dashboardTAalip.css        # Layout utama Dashboard (87 KB)
│   ├── prediksihasil.css          # Desain halaman prediksi
│   ├── inputproduksi.css          # Desain halaman produksi
│   ├── keuangan.css               # Desain halaman keuangan
│   ├── stokpakan.css              # Desain halaman stok pakan
│   ├── kesehatanayam.css          # Desain halaman kesehatan
│   ├── dokumen.css                # Desain halaman dokumen
│   ├── dataAyamTAalip.css         # Desain halaman data ayam
│   ├── login.css                  # Desain halaman login
│   ├── signup.css                 # Desain halaman registrasi
│   ├── editProfileTAalip.css      # Desain halaman profil
│   ├── index.css                  # Desain landing page
│   └── recap-modal.css            # Desain modal rekap
│
├── 📁 components/                 # Komponen Reusable
│   └── sidebar.html               # Template Sidebar Navigasi Global
│
├── 📁 firebase.component/         # Firebase Service Layer
│   ├── firebase-init.js           # Inisialisasi & Konfigurasi Firebase
│   ├── auth-state.js              # Manajemen Status Autentikasi
│   ├── login-interactive.js       # Interaksi & Validasi Login
│   └── signup-interactive.js      # Interaksi & Validasi Registrasi
│
├── 📁 admin.frontend/             # Panel Administrator
│   ├── admin-gate.js              # Gerbang Keamanan Admin
│   └── 📁 admin-core/
│       ├── admin.html             # Halaman Admin Panel (69 KB)
│       ├── admin.js               # Logika Admin Panel (138 KB)
│       └── admin.css              # Desain Admin Panel (44 KB)
│
├── 📁 images/                     # Aset Gambar
│   ├── Screenshot.png             # Foto Profil Admin
│   ├── chicken_running-...png     # Gambar Animasi Easter Egg 🐔
│   └── profilepicture.png         # Default Avatar Profil
│
└── 📄 README.md                   # Dokumentasi Proyek (file ini)
```

> **★** = File kunci yang mengimplementasikan algoritma utama Tugas Akhir

---

## 📦 Prasyarat

Sebelum menjalankan proyek ini, pastikan perangkat Anda telah terinstal:

| Software | Versi Minimum | Keterangan |
|----------|---------------|------------|
| **XAMPP** | v8.0+ | Web Server Apache lokal |
| **Web Browser** | Chrome 90+ / Firefox 88+ / Edge 90+ | Mendukung ES6 Modules |
| **Koneksi Internet** | — | Dibutuhkan untuk Firebase (sinkronisasi awal) |

> **Catatan:** Proyek ini berjalan sepenuhnya di sisi klien (client-side). Tidak memerlukan Node.js, npm, atau build tools. Cukup letakkan file di dalam folder `htdocs` XAMPP.

---

## 🚀 Instalasi & Menjalankan

### 1. Clone Repository

```bash
git clone https://github.com/alifhilmi17/TAalip-main.git
```

### 2. Pindahkan ke Folder XAMPP

```bash
# Pindahkan folder hasil clone ke dalam htdocs XAMPP
# Windows:
xcopy /E /I TAalip-main C:\xampp\htdocs\TAalip-main

# Atau cukup copy-paste manual ke folder:
# C:\xampp\htdocs\TAalip-main
```

### 3. Jalankan XAMPP

1. Buka **XAMPP Control Panel**
2. Klik **Start** pada modul **Apache**
3. Pastikan status berubah menjadi hijau ✅

### 4. Akses Aplikasi

Buka browser dan navigasi ke:

```
http://localhost/TAalip-main/index.html
```

---

## 🔥 Konfigurasi Firebase

Proyek ini menggunakan Firebase sebagai backend cloud. Konfigurasi koneksi Firebase sudah terdapat di file [`firebase-init.js`](firebase.component/firebase-init.js):

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyD265EEi0UE9wYNvOWKQ46huxpPTfZOcOE",
  authDomain: "libas-db.firebaseapp.com",
  projectId: "libas-db",
  storageBucket: "libas-db.firebasestorage.app",
  messagingSenderId: "918841790171",
  appId: "1:918841790171:web:04ce25a5727fddbd78c6fe",
  measurementId: "G-5VPZQD4DKY"
};
```

### Koleksi Firestore yang Digunakan

| Koleksi | Fungsi |
|---------|--------|
| `user` | Data profil pengguna (petugas) |
| `admin` | Data profil administrator |
| `produksi` | Catatan produksi telur harian |
| `ayam` | Data batch populasi ayam |
| `pakan` | Transaksi stok pakan (masuk/keluar) |
| `kesehatan` | Riwayat kesehatan & mortalitas ayam |
| `vaksinasi` | Jadwal & riwayat vaksinasi |
| `keuangan` | Transaksi pemasukan & pengeluaran |
| `prediksi` | Histori hasil prediksi Moving Average |
| `restock_reminders` | Data pengingat restock pakan |
| `activity_log` | Log audit keamanan & aktivitas |

---

## 🔐 Sistem Role & Autentikasi

LIBAS menggunakan sistem **Role-Based Access Control (RBAC)** dengan dua level pengguna:

### 👨‍🌾 Petugas (Operator Kandang)
- Akses ke seluruh halaman operasional (Dashboard, Produksi, Stok, Keuangan, dll.)
- Dapat mencatat data harian dan melihat laporan
- **Tidak** dapat mengakses Panel Admin

### 👑 Admin (Pemilik Peternakan)
- Semua hak akses Petugas
- Akses ke **Admin Panel** yang dilindungi oleh `admin-gate.js`
- Dapat mengelola akun pengguna (aktivasi/nonaktifkan)
- Dapat melihat audit log keamanan
- Dapat mengonfigurasi batas alert stok pakan

### Alur Autentikasi

```
index.html → login.html → [Pilih Role]
                              │
                    ┌─────────┴──────────┐
                    ▼                    ▼
              [Petugas]             [Admin]
                    │                    │
                    ▼                    ▼
           dashboardTAalip.html   admin.html
           (Cek koleksi 'user')   (Cek koleksi 'admin')
                                  (admin-gate.js)
```

---

## 📊 Algoritma Moving Average

Fitur unggulan dari proyek ini adalah implementasi **Algoritma Moving Average (MA)** yang telah dimodifikasi dengan **pendekatan heuristik** untuk menghasilkan prediksi yang lebih realistis.

### Implementasi Inti (`ma-core.js`)

#### 1. Prediksi Produksi Telur

```
Prediksi H+1 = (Σ data N hari terakhir / N) × (1 - Faktor Penalti)
```

Di mana:
- **N** = Periode Moving Average (window size, contoh: 3, 5, atau 7 hari)
- **Faktor Penalti** = Persentase ayam sakit terhadap total populasi

#### 2. Faktor Penalti Ayam Sakit (Modifikasi Heuristik)

Tidak seperti peramalan konvensional yang hanya melihat angka historis, LIBAS mengintegrasikan data kesehatan ayam sebagai variabel koreksi:

```
Faktor Penalti = Jumlah Ayam Sakit / Total Populasi Kandang
```

> Ayam yang sakit mengalami stres sehingga produksi telurnya menurun drastis. Faktor ini memastikan prediksi tidak **over-estimasi** saat ada wabah penyakit.

#### 3. Offset Keuangan (Kalibrasi Keuntungan)

Sistem membandingkan laba historis yang diinput pengguna dengan laba teoritis, kemudian menghasilkan **angka offset** untuk mengkalibrasi prediksi keuntungan agar adaptif terhadap pola pengeluaran riil.

#### 4. Evaluasi Akurasi Model

LIBAS menyediakan fitur **backtesting** otomatis menggunakan:

| Metrik | Rumus | Keterangan |
|--------|-------|------------|
| **MAE** | Σ\|Aktual - Prediksi\| / n | Mean Absolute Error |
| **MAPE** | (Σ(\|error\| / aktual) / n) × 100% | Mean Absolute Percentage Error |
| **Akurasi** | 100% - MAPE | Tingkat ketepatan model |

---

## 📸 Screenshot

> *Tambahkan screenshot halaman-halaman utama aplikasi di sini*

| Halaman | Deskripsi |
|---------|-----------|
| Landing Page | Halaman sambutan dengan efek glassmorphism dan glow orbs |
| Login | Kartu login dengan flip animation dan pemilihan role |
| Dashboard | Pusat kontrol dengan widget statistik real-time |
| Produksi | Form input produksi harian dengan tabel riwayat |
| Prediksi MA | Grafik dual-axis dengan form prediksi interaktif |
| Admin Panel | Panel kontrol administrator dengan multi-section |

---

## 📝 Catatan Pengembangan

- Seluruh kode sumber telah dilengkapi **komentar berbahasa Indonesia** yang detail untuk memudahkan pemahaman
- Desain UI menggunakan konsep **Glassmorphism**, **Gradient**, dan **Micro-animation** untuk kesan premium
- Sidebar dimuat secara dinamis dari `components/sidebar.html` menggunakan **Template Loader** pattern
- Aplikasi mendukung **Offline Mode** melalui Firebase IndexedDB Persistence
- Proteksi **XSS (Cross-Site Scripting)** diterapkan pada semua input pengguna

---

## 👤 Penulis

**Alif Hilmi** — Mahasiswa Tugas Akhir

- GitHub: [@alifhilmi17](https://github.com/alifhilmi17)

---

## 📄 Lisensi

Proyek ini dikembangkan untuk keperluan **Tugas Akhir (TA)** akademik.

Hak cipta © 2025 Alif Hilmi — Seluruh hak dilindungi.

---

<p align="center">
  <em>Dibuat dengan ❤️ untuk peternakan yang lebih modern dan terdigitalisasi</em>
</p>
