# Data Kesehatan & Kontak Peserta (MedCheck Event)

Sistem pendataan kesehatan, kontak, dan perlengkapan peserta kegiatan sekolah (SMK).
Terdiri dari formulir pendaftaran untuk peserta dan panel admin untuk panitia/guru.

## Fitur

- Formulir bertahap (6 langkah) yang mudah diisi di HP, tablet, laptop, maupun komputer.
- Menyimpan: data diri (kelas, jurusan, peran), kontak peserta & orang tua/wali,
  kondisi medis, alergi (obat, makanan, lainnya), daftar obat yang dibawa,
  perlengkapan ibadah & mandi (bisa diisi H-1 atau saat acara), dan alur pertanyaan
  kesejahteraan pribadi yang mengarahkan ke guru (Bapak Rizky Ahmed Darmawan, S.M.)
  jika peserta tidak ingin menjelaskan detailnya.
- Semua data tersimpan di server pusat (SQLite), bukan di perangkat peserta.
- Panel admin dengan login: cari/filter peserta, lihat detail, unduh PDF rapi
  (per peserta atau rekap semua), ekspor CSV, dan hubungi peserta/wali lewat
  tautan WhatsApp otomatis atau email (jika SMTP dikonfigurasi).

## Menjalankan secara lokal

Prasyarat: Node.js 18 ke atas.

```bash
npm install
cp .env.example .env
# edit .env sesuai kebutuhan (lihat penjelasan di bawah)
npm start
```

Buka `http://localhost:3000` untuk formulir peserta, dan `http://localhost:3000/admin`
untuk panel admin.

Saat pertama kali dijalankan (database masih kosong), akun admin default akan
dibuat otomatis dan ditampilkan di log terminal. Segera login lalu ganti
`ADMIN_USERNAME` dan `ADMIN_PASSWORD` di `.env`, hapus berkas `data/medcheck.db`,
lalu jalankan ulang agar akun baru terbentuk — atau tambahkan fitur ganti password
sendiri jika diperlukan.

## Konfigurasi (.env)

| Variabel | Keterangan |
|---|---|
| `PORT` | Port server, default 3000 |
| `SESSION_SECRET` | Teks rahasia acak untuk sesi login admin |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | Akun admin awal (hanya dipakai sekali saat database kosong) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Konfigurasi pengiriman email dari panel admin (opsional) |
| `FORCE_HTTPS` | Set `true` jika server berjalan di balik HTTPS |

Fitur "Hubungi" di panel admin akan selalu menyediakan tautan WhatsApp
(`wa.me`) yang berisi pesan otomatis dan bisa diedit sebelum dikirim — ini
tidak memerlukan konfigurasi tambahan. Fitur kirim email memerlukan SMTP;
jika belum diisi, tombol kirim email akan menampilkan pesan bahwa
konfigurasi belum lengkap.

## Deploy ke server sungguhan

1. Unggah seluruh folder proyek ke server (VPS, cPanel dengan Node.js, dsb).
2. Jalankan `npm install --production`.
3. Buat berkas `.env` (jangan unggah `.env` yang berisi kredensial ke tempat publik/Git).
4. Jalankan dengan process manager seperti `pm2`:
   ```bash
   npm install -g pm2
   pm2 start server.js --name medcheck
   pm2 save
   ```
5. Arahkan domain/subdomain sekolah ke aplikasi ini (reverse proxy Nginx/Apache),
   aktifkan HTTPS (mis. via Let's Encrypt / Certbot), lalu set `FORCE_HTTPS=true`
   dan `NODE_ENV=production` di `.env`.
6. Cadangkan (backup) berkas `data/medcheck.db` secara berkala karena berisi
   seluruh data peserta.

## Struktur folder

```
server.js            Entry point server Express
database/db.js        Skema & koneksi SQLite (better-sqlite3)
routes/api.js          Endpoint publik: kirim data peserta
routes/admin.js         Endpoint admin: login, data, ekspor PDF/CSV, kontak
utils/pdf.js            Pembuat PDF (pdfkit)
utils/auth.js           Middleware pengecekan sesi admin
public/index.html        Formulir peserta
public/css/style.css      Gaya formulir peserta
public/js/form.js         Logika formulir bertahap
public/admin/             Halaman login & dashboard admin
data/                     Berkas database SQLite (dibuat otomatis)
```

## Keamanan & privasi data

Data yang dikumpulkan bersifat sensitif (kesehatan, kontak pribadi, dan
cerita pribadi peserta). Beberapa saran:

- Gunakan HTTPS di server produksi.
- Batasi siapa saja yang memegang akun admin.
- Cadangkan database secara berkala dan simpan di tempat yang aman.
- Hapus data peserta setelah kegiatan selesai jika tidak diperlukan lagi
  dalam jangka panjang (gunakan tombol "Hapus data" di detail peserta,
  atau hapus berkas `data/medcheck.db` untuk menghapus semuanya).
- Bagian "Kesejahteraan Peserta" bersifat rahasia — pastikan hanya panitia/guru
  yang berwenang yang memegang akses ke panel admin.

---
&copy; Rizky Ahmed Darmawan
