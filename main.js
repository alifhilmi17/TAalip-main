/**
 * =========================================================
 * LIBAS (Lintau Buo Administration System) - Desktop
 * File: main.js
 * Deskripsi: Proses utama (Main Process) Electron.
 * Bertanggung jawab membuat jendela aplikasi desktop dan
 * menyediakan embedded internal HTTP server agar modul
 * JavaScript (ES Modules) dan Firebase Auth berjalan sempurna.
 * =========================================================
 */

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

console.log('[DEBUG 1] Script main.js mulai dieksekusi...');

// Matikan akselerasi hardware untuk mencegah GPU driver Windows memblokir tampilan jendela
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-features', 'NetworkServiceSandbox');

let mainWindow = null;
let localServer = null;
let serverPort = null;

// Daftar MIME Type lengkap untuk mendukung seluruh aset web
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.txt': 'text/plain; charset=utf-8'
};

/**
 * Menjalankan server lokal mini internal (127.0.0.1).
 */
function startInternalServer() {
    return new Promise((resolve, reject) => {
        localServer = http.createServer((req, res) => {
            try {
                const parsedUrl = new URL(req.url, `http://127.0.0.1:${serverPort || 3000}`);
                let safePath = decodeURIComponent(parsedUrl.pathname);

                if (safePath === '/' || safePath === '') {
                    safePath = '/login.html';
                }

                const targetFilePath = path.normalize(path.join(__dirname, safePath));
                if (!targetFilePath.startsWith(__dirname)) {
                    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
                    return res.end('403 Terlarang');
                }

                fs.stat(targetFilePath, (err, stats) => {
                    if (err || !stats.isFile()) {
                        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                        return res.end(`404 Tidak Ditemukan: ${safePath}`);
                    }

                    const ext = path.extname(targetFilePath).toLowerCase();
                    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

                    res.writeHead(200, {
                        'Content-Type': contentType,
                        'Access-Control-Allow-Origin': '*'
                    });

                    const stream = fs.createReadStream(targetFilePath);
                    stream.pipe(res);
                });
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('500 Kesalahan Server Internal');
            }
        });

        localServer.listen(0, '127.0.0.1', () => {
            const address = localServer.address();
            serverPort = address.port;
            console.log(`[DEBUG 2] Internal server aktif di http://127.0.0.1:${serverPort}`);
            resolve(serverPort);
        });

        localServer.on('error', (err) => {
            console.error('[ERROR SERVER]', err);
            reject(err);
        });
    });
}

/**
 * Membuat jendela utama aplikasi desktop LIBAS
 */
function createWindow() {
    console.log('[DEBUG 3] Membuat jendela BrowserWindow...');
    const iconPath = path.join(__dirname, 'build', 'icon.png');

    mainWindow = new BrowserWindow({
        width: 1280,
        height: 768,
        minWidth: 1024,
        minHeight: 650,
        center: true,
        title: 'LIBAS - Lintau Buo Administration System',
        icon: fs.existsSync(iconPath) ? iconPath : undefined,
        autoHideMenuBar: true,
        show: true,
        alwaysOnTop: true, // Paksa jendela muncul paling depan agar terlihat di monitor
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    // Lepas status alwaysOnTop setelah 2 detik agar tidak mengganggu multitasking
    setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.setAlwaysOnTop(false);
        }
    }, 2000);

    const targetUrl = `http://127.0.0.1:${serverPort}/login.html`;
    console.log(`[DEBUG 4] Memuat alamat: ${targetUrl}`);
    mainWindow.loadURL(targetUrl);

    mainWindow.show();
    mainWindow.focus();

    mainWindow.webContents.on('did-finish-load', () => {
        console.log('[DEBUG 5] Halaman login sukses dimuat ke layar!');
        mainWindow.show();
        mainWindow.focus();
    });

    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        console.error(`[ERROR RENDERER] Gagal memuat (${errorCode}): ${errorDescription}`);
    });

    // Logging console browser ke terminal pengembang
    mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
        console.log(`[Web Console] ${message}`);
    });

    // F12 atau Ctrl+Shift+I untuk DevTools
    mainWindow.webContents.on('before-input-event', (event, input) => {
        if ((input.key === 'F12') || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
            mainWindow.webContents.toggleDevTools();
            event.preventDefault();
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// Inisialisasi Aplikasi
app.whenReady().then(async () => {
    try {
        console.log('[DEBUG] app.whenReady terpanggil!');
        await startInternalServer();
        createWindow();

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                createWindow();
            }
        });
    } catch (error) {
        console.error('[FATAL ERROR]', error);
        app.quit();
    }
});

// IPC Kontrol Jendela
ipcMain.on('window-minimize', () => {
    if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
    if (mainWindow) {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
    }
});

ipcMain.on('window-close', () => {
    if (mainWindow) mainWindow.close();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        if (localServer) {
            localServer.close();
        }
        app.quit();
    }
});
