# Dokumentasi Fitur Bump Order

## 1. Deskripsi Fitur
Bump Order adalah penawaran produk tambahan yang muncul di halaman checkout (tepat sebelum tombol "Beli Sekarang"). Fitur ini memungkinkan pelanggan menambahkan produk pelengkap ke dalam pesanan mereka hanya dengan satu klik (checkbox), meningkatkan nilai rata-rata pesanan (AOV).

## 2. Alur Kerja (Workflow)

### A. Pengaturan Admin (Admin Area)
1. **Login ke Admin Area**: Buka `admin-area.html` dan login.
2. **Tambah/Edit Produk**:
   - Klik tombol **"Tambah Produk"** atau ikon edit pada produk yang ada.
   - Di dalam modal form produk, cari bagian **"Bump Order"**.
   - Centang **"Jadikan Bump Order"** (opsional - hanya penanda visual).
   - **PENTING**: Pada dropdown **"Pilih Produk Bump (Opsional)"**, pilih produk *lain* yang ingin ditawarkan sebagai bump order untuk produk ini.
   - **Validasi**: Sistem secara otomatis menyembunyikan produk yang sedang diedit dari dropdown untuk mencegah produk menjadi bump bagi dirinya sendiri (self-selection).
3. **Simpan**: Klik "Simpan Produk". Data bump order akan tersimpan di database (Sheet `Access_Rules` kolom 14).

### B. Tampilan Checkout (User)
1. Pelanggan membuka link checkout produk utama.
2. Sistem mendeteksi jika produk utama memiliki relasi Bump Order.
3. Jika ada, kotak penawaran khusus (Bump Offer) muncul di atas tombol "Beli Sekarang".
4. Kotak ini menampilkan:
   - Checkbox "Ya, saya mau ambil promo ini!"
   - Judul produk bump
   - Deskripsi singkat (diambil dari deskripsi produk bump)
   - Harga tambahan
5. **Interaksi**:
   - Jika dicentang: Harga total otomatis bertambah sesuai harga produk bump.
   - Jika tidak dicentang: Harga tetap harga asli.

### C. Pemrosesan Order (Backend)
1. Saat pelanggan klik "Beli Sekarang", data dikirim ke `appscript.js`.
2. **Payload Order**:
   - `id_produk`: ID produk utama.
   - `bump_id`: ID produk bump (jika dicentang).
   - `harga`: Total harga yang dikirim dari frontend.
3. **Validasi Anti-Fraud**:
   - Backend memverifikasi harga total = (Harga Produk Utama + Harga Bump [jika ada]) +/- toleransi kode unik.
   - Jika harga tidak sesuai (misal dimanipulasi di browser), order ditolak.
4. **Pencatatan**:
   - Order dicatat di Sheet `Orders`.
   - Nama produk di invoice akan digabung (contoh: "Kelas SEO + Ebook Copywriting").

## 3. Struktur Data
- **Sheet `Access_Rules`**:
  - Kolom 13 (Index 12): `is_bump` (Boolean string) - Penanda apakah produk ini cocok jadi bump (informasional).
  - Kolom 14 (Index 13): `bump_product_id` (String) - ID produk yang *akan ditawarkan* saat produk ini dibeli.

## 4. Pengujian (Testing)
Telah dilakukan unit testing simulasi untuk memverifikasi logika:
- **Positive Case**:
  - Perhitungan harga total (Main + Bump) akurat.
  - Order valid dengan bump diterima oleh backend.
- **Negative Case**:
  - Produk tidak bisa memilih dirinya sendiri sebagai bump (dropdown filter).
  - Order dengan manipulasi harga (bayar harga main tapi minta bump) ditolak backend.

Script pengujian tersedia di: `tests/bump_logic_test.js`
Jalankan dengan: `node tests/bump_logic_test.js`
