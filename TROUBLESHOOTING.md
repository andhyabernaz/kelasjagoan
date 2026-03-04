# Panduan Troubleshooting & Error Handling
**Kelas Jagoan E-Commerce System**

Dokumen ini berisi panduan penanganan masalah teknis untuk dua error kritis yang sering dilaporkan:
1.  Error Halaman Checkout ("Gagal memuat sistem pembayaran")
2.  Error Halaman Utama ("Katalog sedang diperbarui")

---

## 1. Error Halaman Checkout
**Gejala:** Muncul pesan error saat memuat halaman checkout atau saat submit form.

### A. Pesan Error & Solusi
| Pesan Error | Kemungkinan Penyebab | Solusi Teknis |
| :--- | :--- | :--- |
| **"Gagal memuat sistem pembayaran"** | API Gateway Duitku down, konfigurasi salah, atau script error. | 1. Cek `Settings` di Spreadsheet, pastikan `duitku_merchant_code` & `duitku_api_key` benar.<br>2. Cek Console Browser (F12) untuk detail error.<br>3. Redeploy App Script jika ada perubahan backend. |
| **"Koneksi lambat (Timeout)"** | Koneksi user lambat atau Server Google busy. | 1. Refresh halaman.<br>2. Sistem sudah memiliki *Retry Mechanism* otomatis (3x percobaan). |
| **"Koneksi internet bermasalah"** | User offline atau blokir CORS/Firewall. | 1. Cek koneksi internet.<br>2. Matikan VPN/AdBlocker sementara. |
| **"Data dari server tidak valid"** | Respons Backend bukan JSON valid (misal HTML error page). | 1. Cek Log di Google Apps Script Dashboard.<br>2. Pastikan tidak ada syntax error di `appscript.js`. |

### B. Arsitektur Perbaikan
- **Retry Mechanism:** `fetchWithRetry` (3 retries, exponential backoff).
- **Timeout Handling:** Request dibatasi 10-15 detik.
- **Validasi Input:** JSON.parse dibungkus `try-catch` aman.

---

## 2. Error Halaman Utama (Katalog)
**Gejala:** Produk tidak muncul, hanya loading terus atau pesan error.

### A. Pesan Error & Solusi
| Pesan Error | Kemungkinan Penyebab | Solusi Teknis |
| :--- | :--- | :--- |
| **"Belum Ada Produk / Katalog sedang disiapkan"** | API Sukses, tapi data produk kosong. | 1. Buka Spreadsheet sheet `Access_Rules`.<br>2. Pastikan ada produk dengan kolom `Status` = "Active".<br>3. Pastikan kolom data tidak bergeser. |
| **"Gagal Memuat Katalog"** | Gagal fetch ke API Backend. | 1. Cek URL `SCRIPT_URL` di `config.js`.<br>2. Pastikan deployment Web App di set ke "Anyone" (Public). |
| **Spinner Loading Tidak Berhenti** | JavaScript error sebelum render. | 1. Cek Console Browser (F12) -> Console Tab.<br>2. Cari error berwarna merah. |

### B. Arsitektur Perbaikan
- **Stale-While-Revalidate:** Menampilkan data cache (localStorage) terlebih dahulu agar loading instan, sambil update data di background.
- **Fallback UI:** Jika API mati & Cache kosong, tampilkan UI "Gagal Memuat" dengan tombol Retry, bukan halaman putih.
- **Client-Side Logging:** Error fetch pertama akan dikirim ke server (Sheet `Analytics`) untuk monitoring.

---

## 3. Sistem Logging & Monitoring
Sistem dilengkapi dengan logging sederhana untuk memantau kesehatan aplikasi.

### A. Lokasi Log
1.  **Client-Side (Browser Console):** Tekan F12 -> Console. Error akan dikategorikan (TIMEOUT, NETWORK, HTTP).
2.  **Server-Side (Spreadsheet):**
    - Sheet **Analytics**: Mencatat error fetch dari frontend (`catalog_fetch_retry`).
    - Sheet **Executions** (Google Cloud Console): Log internal Google Apps Script.

### B. Cara Monitoring
- **Alert:** Admin dapat memantau sheet `Analytics`. Jika banyak entry `error` dengan label `catalog_fetch_retry`, berarti sedang ada gangguan masif.
- **Action:** Jika error meningkat, cek Quota Google Apps Script atau status API Duitku.

---

## 4. Prosedur Verifikasi (Testing)
Gunakan file `test-catalog.html` dan `test-payment.html` untuk simulasi.

1.  Buka `test-catalog.html` di browser.
2.  Pastikan semua status **PASS**.
3.  Test manual: Matikan internet -> Refresh halaman -> Pastikan muncul pesan "Koneksi internet bermasalah".

---
*Dibuat otomatis oleh AI Assistant - 2026*
