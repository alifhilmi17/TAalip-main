/**
 * =========================================================
 * LIBAS (Lintau Buo Administration System) - Desktop
 * File: preload.js
 * Deskripsi: Skrip jembatan (bridge) aman antara proses native
 * Node.js/Electron dengan antarmuka web (Renderer).
 * =========================================================
 */

const { contextBridge, ipcRenderer } = require('electron');

// Mengekspos API desktop yang aman ke objek `window.electronAPI`
contextBridge.exposeInMainWorld('electronAPI', {
    isDesktop: true,
    platform: process.platform,
    version: '1.0.0',
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close')
});
