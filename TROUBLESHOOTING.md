# Panduan Troubleshooting & Error Handling
**Kelas Jagoan E-Commerce System**

Dokumen ini berisi panduan penanganan masalah teknis untuk dua error kritis yang sering dilaporkan:
1.  Error Halaman Checkout ("Gagal memuat sistem pembayaran")
2.  Error Halaman Utama ("Katalog sedang diperbarui" / "Waktu Habis")

---

## 1. Error: "Gagal memuat sistem pembayaran" (Checkout)

### Gejala
*   Muncul pesan "Gagal memuat sistem pembayaran, cek koneksi internet anda" saat halaman checkout dimuat.
*   Pilihan metode pembayaran tidak muncul.

### Kemungkinan Penyebab & Solusi
| Pesan Error | Kemungkinan Penyebab | Solusi |
| :--- | :--- | :--- |
| **Koneksi lambat (Timeout)** | API Gateway lambat merespon (>10s) | Otomatis di-retry 3x. Jika persisten, cek status server Google Apps Script. |
| **Koneksi internet bermasalah** | User offline atau DNS block | Minta user cek koneksi. Coba akses via data seluler. |
| **HTTP_ERROR_500/404** | Backend script error atau URL salah | Cek log backend di Apps Script Dashboard. Pastikan `SCRIPT_URL` benar. |
| **Error: Konfigurasi API hilang** | `config.js` tidak termuat | Cek console browser. Pastikan file `config.js` ada dan tidak di-block adblocker. |

### Verifikasi Teknis
1.  Buka **DevTools** (F12) -> **Console**.
2.  Cari log dengan prefix `Attempt X failed`.
3.  Jalankan `test-payment.html` untuk simulasi koneksi.

---

## 2. Error: "Katalog sedang diperbarui" / "Waktu Habis" (Index)

### Gejala
*   Produk tidak muncul, hanya loading spinner terus menerus.
*   Muncul pesan "Katalog sedang diperbarui" atau "Waktu Habis".

### Root Cause Analysis (Fixed)
*   **Data Property Mismatch:** Frontend sebelumnya mencari properti `available`, padahal backend mengembalikan `data`. (Fixed: Fallback mechanism added).
*   **Empty Response:** Backend mengembalikan array kosong `[]` jika tidak ada produk aktif.
*   **Stuck Loading:** Fetch request menggantung tanpa timeout yang jelas. (Fixed: Added Safety Timeout 45s).

### Mekanisme Perbaikan (Implemented)
1.  **Stale-While-Revalidate:** Menampilkan data dari cache (localStorage) segera, sambil fetch data baru di background.
2.  **Robust Error Handling:** Menggunakan `r.data` (primary) dan `r.available` (fallback).
3.  **Safety Timeout:** Jika loading > 45 detik, otomatis stop dan tampilkan tombol "Coba Lagi".
4.  **Logging:** Log respon API lengkap ke console untuk debugging (`Catalog API Response: ...`).

### Cara Debugging (Langkah Demi Langkah)
1.  **Cek Console Log:**
    *   Buka DevTools (F12) -> Console.
    *   Lihat log: `Catalog API Response: { ... }`.
    *   Pastikan `status: "success"` dan `data` berisi array produk.
2.  **Cek Network Tab:**
    *   Filter: `Fetch/XHR`.
    *   Cari request ke script google (`exec`).
    *   Pastikan status 200 OK.
3.  **Test Cache:**
    *   Jalankan `localStorage.removeItem('melimpah_public_catalog')` di console.
    *   Refresh halaman.

### Verifikasi dengan Test File
1.  Buka `test-catalog.html` di browser.
2.  Pastikan semua status **PASS**.
    *   Jika Test 1 (Real API) GAGAL, berarti backend down atau URL salah.
3.  Test manual: Matikan internet -> Refresh halaman -> Pastikan muncul pesan "Koneksi internet bermasalah".

---
*Dibuat otomatis oleh AI Assistant - 2026*
