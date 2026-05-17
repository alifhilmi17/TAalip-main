/* =========================================================
   SISTEM ADMINISTRASI PETERNAKAN (LIBAS)
   File: ma-core.js
   Deskripsi: Core Engine untuk Algoritma Sistem Pakar.
   Berisi fungsi-fungsi matematis murni (Pure Functions) 
========================================================= */

/**
 * Menganalisis dan memprediksi masa depan menggunakan algoritma Moving Average.
 * @param {Array<number>} dataHistoris - Array nilai historis aktual (contoh: berat telur dalam Kg)
 * @param {number} periodeMA - Jumlah hari window/periode pergerakan rata-rata
 * @param {number} hariKedepan - Target lamanya hari masa depan yang ingin diramal (default: 7)
 * @returns {Object} Hasil prediksi H+1, prediksi array masa depan, dan history terbaru.
 */
window.calculateMovingAverage = function(dataHistoris, periodeMA, hariKedepan = 7) {
    let proyeksiMasaDepan = [];
    let tempHistory = [...dataHistoris];
    
    // 1. Prediksi Hari Esok (H+1)
    let windowH1 = tempHistory.slice(-periodeMA);
    let sumH1 = windowH1.reduce((a, b) => a + b, 0);
    let prediksiBesok = sumH1 / periodeMA;
    
    // 2. Prediksi Rantai (Chaining) untuk N Hari Kedepan
    for (let i = 0; i < hariKedepan; i++) {
        let currentWindow = tempHistory.slice(-periodeMA);
        let currSum = currentWindow.reduce((a, b) => a + b, 0);
        let nextPred = currSum / periodeMA;
        
        proyeksiMasaDepan.push(nextPred);
        tempHistory.push(nextPred); // Masukkan hasil prediksi menjadi sejarah baru untuk hitungan selanjutnya
    }
    
    return {
        prediksiBesok: prediksiBesok,
        proyeksiMasaDepan: proyeksiMasaDepan,
        historyAkhir: tempHistory
    };
};

/**
 * Mengevaluasi seberapa akurat Model AI ini terhadap data historis (Backtesting).
 * @param {Array<number>} dataAktual - Data asli yang benar-benar terjadi
 * @param {number} periodeMA - Setingan window MA yang digunakan
 * @returns {Object} Nilai MAE (Mean Absolute Error) dan Persentase Akurasi
 */
window.evaluateModelAccuracy = function(dataAktual, periodeMA) {
    let totalError = 0;
    let totalPercentageError = 0;
    let validTestCount = 0;

    // Minimal butuh data lebih dari periode MA untuk bisa membandingkan prediksi vs aktual
    if (dataAktual.length > periodeMA) {
        for (let i = periodeMA; i < dataAktual.length; i++) {
            let windowActual = dataAktual.slice(i - periodeMA, i);
            let sumWindow = windowActual.reduce((a, b) => a + b, 0);
            let pred = sumWindow / periodeMA;
            let actual = dataAktual[i];

            let error = Math.abs(actual - pred);
            totalError += error;

            if (actual > 0) {
                totalPercentageError += (error / actual);
            }
            validTestCount++;
        }
    }

    let mae = 0;
    let akurasi = 0;
    let isAkurasiValid = false;

    if (validTestCount > 0) {
        mae = totalError / validTestCount;
        let mape = (totalPercentageError / validTestCount) * 100;
        akurasi = Math.max(0, 100 - mape); // Cegah minus
        isAkurasiValid = true;
    }

    return { 
        mae, 
        akurasi, 
        isAkurasiValid, 
        jumlahDataUji: validTestCount 
    };
};
