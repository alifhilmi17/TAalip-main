/* =========================================================
   SISTEM ADMINISTRASI PETERNAKAN (LIBAS)
   File: setup-collections.js
   Deskripsi: Script untuk membuat dan menginisialisasi 
   collection Firestore yang diperlukan untuk aplikasi LIBAS
========================================================= */

import { 
    collection, 
    addDoc, 
    getDocs,
    doc,
    setDoc 
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { db } from "./firebase-init.js";

/**
 * Fungsi untuk mengecek apakah collection sudah ada dan memiliki data
 */
async function checkCollectionExists(collectionName) {
    try {
        const querySnapshot = await getDocs(collection(db, collectionName));
        return !querySnapshot.empty;
    } catch (error) {
        console.error(`Error checking collection ${collectionName}:`, error);
        return false;
    }
}

/**
 * Fungsi untuk membuat collection produksi_harian dengan data contoh
 */
async function setupProduksiHarianCollection() {
    const collectionName = "produksi_harian";
    
    try {
        const exists = await checkCollectionExists(collectionName);
        
        if (exists) {
            console.log(`✅ Collection '${collectionName}' sudah ada dengan data.`);
            return { success: true, message: "Collection sudah ada" };
        }

        // Membuat data contoh untuk produksi harian
        const sampleData = {
            tanggal: new Date().toISOString().split('T')[0],
            batchId: "sample-batch-001",
            batchLabel: "BATCH-001 - Ayam Petelur [Kandang A]",
            jenisTelur: "Telur Ayam Petelur",
            kandang: "Kandang A (Utara)",
            telurBaik: 150,
            telurCacat: 10,
            totalTelur: 160,
            ayamTidakBertelur: 5,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await addDoc(collection(db, collectionName), sampleData);
        console.log(`✅ Collection '${collectionName}' berhasil dibuat dengan data contoh!`);
        
        return { 
            success: true, 
            message: `Collection '${collectionName}' berhasil dibuat!`,
            data: sampleData 
        };
        
    } catch (error) {
        console.error(`❌ Error membuat collection ${collectionName}:`, error);
        return { 
            success: false, 
            message: error.message 
        };
    }
}

/**
 * Fungsi untuk membuat collection populasi_ayam dengan data contoh
 */
async function setupPopulasiAyamCollection() {
    const collectionName = "populasi_ayam";
    
    try {
        const exists = await checkCollectionExists(collectionName);
        
        if (exists) {
            console.log(`✅ Collection '${collectionName}' sudah ada dengan data.`);
            return { success: true, message: "Collection sudah ada" };
        }

        // Membuat data contoh untuk populasi ayam
        const sampleData = {
            customId: "BATCH-001",
            jenis: "Ayam Petelur",
            kandang: "Kandang A (Utara)",
            tglMasuk: new Date().toISOString().split('T')[0],
            jumlahAwal: 200,
            jumlahSekarang: 195,
            status: "Aktif",
            umur: 120,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await addDoc(collection(db, collectionName), sampleData);
        console.log(`✅ Collection '${collectionName}' berhasil dibuat dengan data contoh!`);
        
        return { 
            success: true, 
            message: `Collection '${collectionName}' berhasil dibuat!`,
            data: sampleData 
        };
        
    } catch (error) {
        console.error(`❌ Error membuat collection ${collectionName}:`, error);
        return { 
            success: false, 
            message: error.message 
        };
    }
}

/**
 * Fungsi utama untuk setup semua collection yang diperlukan
 */
export async function setupAllCollections() {
    console.log("🚀 Memulai setup collections Firebase...");
    
    const results = {
        produksiHarian: await setupProduksiHarianCollection(),
        populasiAyam: await setupPopulasiAyamCollection()
    };
    
    console.log("📊 Hasil Setup Collections:", results);
    
    return results;
}

/**
 * Fungsi untuk menampilkan status semua collection
 */
export async function checkAllCollections() {
    const collections = ["produksi_harian", "populasi_ayam"];
    const status = {};
    
    for (const collectionName of collections) {
        const exists = await checkCollectionExists(collectionName);
        const snapshot = await getDocs(collection(db, collectionName));
        status[collectionName] = {
            exists: exists,
            documentCount: snapshot.size
        };
    }
    
    return status;
}

// Export fungsi individual jika diperlukan
export { 
    setupProduksiHarianCollection, 
    setupPopulasiAyamCollection,
    checkCollectionExists 
};
