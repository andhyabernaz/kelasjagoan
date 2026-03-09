# Laporan Pembaruan Arsitektur Konfigurasi (SSOT)

## Ringkasan
Telah dilakukan pembaruan arsitektur konfigurasi untuk menerapkan prinsip **Single Source of Truth (SSOT)**. Konfigurasi URL Web App (`SCRIPT_URL`) kini hanya perlu dikelola di satu tempat, yaitu `config.js` di sisi frontend. AppScript tidak lagi menyimpan konfigurasi hardcoded yang berpotensi menyebabkan duplikasi atau ketidaksinkronan.

## Perubahan Teknis

### 1. AppScript (Backend)
- **Menghapus `SCRIPT_CONFIG`**: Objek konfigurasi hardcoded telah dihapus dari `appscript.js`.
- **Integrasi `Settings` Sheet**: Fungsi `getScriptConfig` diperbarui untuk membaca konfigurasi secara dinamis dari sheet `Settings` (menggunakan caching untuk performa).
- **Endpoint `update_settings`**: Digunakan untuk menyimpan konfigurasi yang dikirim dari frontend.
- **Endpoint `get_admin_data`**: Secara otomatis menyertakan seluruh konfigurasi dari sheet `Settings` (termasuk `script_url`) dalam respons.

### 2. Admin Dashboard (Frontend)
- **Mekanisme Auto-Sync**: Pada saat Admin Dashboard dimuat (`admin-area.html`), sistem akan:
  1. Mengambil data konfigurasi dari server.
  2. Membandingkan `script_url` dari server dengan `SCRIPT_URL` lokal (`config.js`).
  3. Jika berbeda (atau belum ada di server), sistem akan otomatis mengirimkan `SCRIPT_URL` terbaru ke server untuk disimpan di sheet `Settings`.
  
### 3. Config.js
- Tetap menjadi **satu-satunya tempat** untuk mengubah URL Web App.
- Tidak perlu lagi mengedit `appscript.js` setelah deployment ulang, cukup update `config.js`.

## Cara Kerja
1. Admin melakukan deployment ulang AppScript (jika ada perubahan kode).
2. Admin mendapatkan URL Web App baru.
3. Admin mengupdate `window.SCRIPT_URL` di file `config.js`.
4. Admin membuka Admin Dashboard.
5. Dashboard mendeteksi perubahan URL dan menyinkronkannya ke database (sheet `Settings`).
6. AppScript kini memiliki akses ke URL barunya sendiri via database untuk keperluan internal (jika dibutuhkan).

## Keuntungan
- **Mencegah Inkonsistensi**: Tidak ada risiko lupa mengupdate URL di salah satu sisi (backend/frontend).
- **Efisiensi**: Hanya satu file yang perlu diedit saat deployment ulang.
- **Fleksibilitas**: Konfigurasi lain juga dapat ditambahkan ke `Settings` sheet tanpa mengubah kode.
