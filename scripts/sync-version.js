/**
 * =========================================================
 * LIBAS - Skrip Sinkronisasi Versi Otomatis
 * File: scripts/sync-version.js
 *
 * Cara kerja:
 * 1. Membaca versi terkini dari package.json (satu-satunya sumber)
 * 2. Menghasilkan file js/app-version.js berisi versi tersebut
 * 3. Dijalankan otomatis sebelum `npm run dist` (via "predist" hook)
 *    dan manual via `npm run version:sync`
 * =========================================================
 */

const fs = require('fs');
const path = require('path');

// Baca package.json
const pkg = require('../package.json');
const version = pkg.version;

if (!version) {
    console.error('[sync-version] ERROR: Field "version" tidak ditemukan di package.json!');
    process.exit(1);
}

// Generate file js/app-version.js
const outputPath = path.join(__dirname, '..', 'js', 'app-version.js');
const outputContent = `/**
 * =========================================================
 * LIBAS - Auto-generated Version File
 * ⚠️ File ini DIBUAT OTOMATIS oleh scripts/sync-version.js
 * ⚠️ JANGAN diedit manual! Ubah versi hanya di package.json
 * =========================================================
 */

// Versi aplikasi terbaru yang disinkronisasi dari package.json
window.LIBAS_VERSION = "${version}";
`;

fs.writeFileSync(outputPath, outputContent, 'utf-8');

console.log(`✅ [sync-version] Berhasil! js/app-version.js diperbarui ke v${version}`);
