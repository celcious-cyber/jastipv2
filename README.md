# 🎙️ Jastip Studio v3: Rekapitulasi Arsitektur & Cara Kerja

**Jastip Studio** adalah aplikasi *Progressive Web App* (PWA) berbasis *mobile-first* yang dirancang khusus untuk pengusaha Jastip (Jasa Titip) agar dapat mengelola stok, pesanan, dan sesi belanja langsung (*Live Shopping*) dengan profesional.

## 🛠️ Arsitektur Teknologi

### 1. Frontend (Antarmuka Pengguna)
*   **Teknologi Utama**: HTML5, Vanilla JavaScript (ES6+), dan CSS3.
*   **Framework UI**: **Bootstrap 5 (CDN)** untuk tata letak responsif.
*   **Desain**: Estetika "Rustic" dengan palet warna yang dapat disesuaikan secara dinamis melalui pengaturan toko.
*   **PWA**: Menggunakan **Service Worker (v3)** untuk caching offline-first dan **Web App Manifest** agar bisa diinstal di HP tanpa melalui App Store/Play Store.
*   **Feedback**: Integrasi suara (Ding!) dan animasi micro-interactions untuk kepuasan pengguna.

### 2. Backend & Infrastruktur (BaaS)
Aplikasi ini bersifat *Serverless*, menggunakan **Supabase** sebagai fondasi backend:
*   **Database**: PostgreSQL dengan skema multi-tenant (setiap toko memiliki data terisolasi).
*   **Authentication**: Manajemen login Admin dan Staff dengan *Role-Based Access Control* (RBAC).
*   **Real-time engine**: Menggunakan *Postgres Changes* untuk pembaruan katalog live secara instan tanpa perlu reload halaman.
*   **Storage**: **Supabase Storage** (bucket `event-images`) untuk menyimpan foto barang belanjaan dengan URL publik yang ringan.

---

## 📋 Alur & Fitur Utama

### 1. Autoprovisioning (Pendaftaran)
Saat pengguna baru mendaftar, aplikasi secara otomatis:
*   Membuat akun pengguna di Supabase Auth.
*   Membuat entri Toko baru di `store_settings`.
*   Menetapkan peran 'admin' untuk pengguna tersebut.

### 2. Manajemen Live Event (Katalog Instan)
Fitur unggulan yang memungkinkan Admin bekerja sangat cepat saat di lokasi belanja:
*   **Live Capture**: Admin memotret barang -> Sistem mengompres gambar -> Mengunggah ke Storage -> Barang langsung muncul di HP semua pelanggan secara *real-time*.
*   **Public Catalog**: Halaman publik (`/public/event.html`) yang ringan, bermerek, dan mendukung penggunaan offline jika sinyal di mall buruk.

### 3. Sistem "Grab" & Order (Kanban Board)
*   Pelanggan memilih barang dan menekan **"Ambil!"**.
*   Stok di database otomatis berkurang secara atomik (mencegah *rebutan* barang).
*   Pesanan masuk ke **Dashboard Admin** dalam bentuk kartu Kanban (Unpaid -> Packing -> Completed).
*   Admin dapat langsung menghubungi pelanggan via WhatsApp yang terintegrasi.

---

## 🚀 Cara Penggunaan

### Bagi Owner (Admin)
1.  **Persiapan**: Masuk ke **Settings**, atur Nama Toko, Warna, dan No. WA.
2.  **Mulai Live**: Masuk ke menu **Live Events**, buat event baru (contoh: "Live Bangkok Sale").
3.  **Capture**: Gunakan menu **Add to Live Catalog**. Potret barang, beri harga, dan klik tambah.
4.  **Pantau Pesanan**: Buka **Orders** untuk melihat siapa saja yang melakukan "Grab" dan hubungi mereka untuk pembayaran.

### Bagi Pelanggan
1.  Akses Link: Pelanggan membuka link katalog (contoh: `event.html?id=...`).
2.  Belanja: Melihat foto barang yang baru saja diunggah owner secara real-time.
3.  Grab: Tekan **"Ambil!"**, isi data diri, dan dengarkan suara "Ding!" tanda berhasil.
4.  Konfirmasi: Pelanggan akan melihat instruksi pembayaran dan menunggu owner menghubungi via WhatsApp.

---

## 🔒 Keamanan & Isolasi Data
*   **Row-Level Security (RLS)**: Data toko A tidak akan pernah bisa dilihat oleh admin toko B.
*   **Isolasi Publik**: Halaman untuk pelanggan (`/public/`) tidak memiliki akses ke logika admin atau dashboard, mencegah kebocoran data sensitif.

---
