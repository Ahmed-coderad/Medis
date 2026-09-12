# Data Kesehatan & Kontak Peserta (versi hosting GitHub gratis)

Situs statis (HTML/CSS/JS biasa — tanpa server Node.js) untuk mendata kesehatan,
kontak, dan perlengkapan peserta kegiatan sekolah, dan bisa **di-hosting 100%
gratis di GitHub Pages**. Data tetap tersimpan terpusat di server (Firebase,
milik Google) — bukan di HP masing-masing peserta.

## Kenapa arsitekturnya berubah dari versi sebelumnya?

GitHub Pages hanya bisa menyajikan berkas statis (HTML/CSS/JS) — GitHub Pages
**tidak bisa** menjalankan server Node.js/Express. Karena itu, versi ini
menggantikan server Node.js dengan **Firebase** (Google) sebagai "server"
penyimpan data. Firebase punya paket gratis (Spark Plan) yang cukup besar
untuk kebutuhan pendataan acara sekolah:

- Firestore (database): 1 GiB penyimpanan, puluhan ribu baca/tulis per hari — gratis.
- Authentication (login admin): gratis untuk email & password.

Situs (HTML/CSS/JS) di-hosting gratis di GitHub Pages, dan situs itu
langsung berbicara ke Firebase dari browser peserta/admin. Tidak ada server
yang perlu Anda sewa atau jalankan sendiri.

## Struktur folder

```
index.html                     Formulir peserta (halaman utama)
admin.html                       Panel admin (login + dashboard jadi satu halaman)
assets/css/style.css              Gaya formulir peserta
assets/css/admin.css               Gaya panel admin
assets/js/firebase-init.js          KONFIGURASI Firebase Anda (wajib diisi, lihat di bawah)
assets/js/form.js                    Logika formulir & nomor WhatsApp guru
assets/js/admin.js                    Logika dashboard, PDF, CSV, kontak
assets/vendor/                         Firebase SDK & jsPDF (sudah disertakan, tanpa perlu install apa pun)
firestore.rules                          Aturan keamanan Firestore (wajib disalin ke Firebase Console)
firebase.json                             Konfigurasi emulator lokal (opsional, untuk uji coba di komputer)
```

Karena Firebase SDK dan jsPDF sudah disertakan langsung di `assets/vendor/`,
Anda **tidak perlu** menjalankan `npm install` atau memiliki Node.js sama
sekali untuk memakai situs ini.

## Langkah 1 — Menyiapkan Firebase (sekali saja, gratis)

1. Buka https://console.firebase.google.com, login dengan akun Google, klik
   **"Add project"** (Tambah proyek). Beri nama bebas, misalnya
   `medcheck-sekolahku`. Anda boleh mematikan Google Analytics, tidak
   diperlukan.
2. Di menu kiri, klik **Build → Firestore Database → Create database**.
   Pilih **Start in production mode**, lalu pilih lokasi server terdekat
   (misalnya `asia-southeast2 (Jakarta)`).
3. Masih di Firestore, buka tab **Rules**, hapus isinya, lalu salin-tempel
   seluruh isi berkas `firestore.rules` dari proyek ini. Klik **Publish**.
   Aturan ini membuat: peserta boleh mengirim formulir, tapi HANYA admin
   yang login yang boleh membaca/menghapus data.
4. Di menu kiri, klik **Build → Authentication → Get started**. Pada tab
   **Sign-in method**, aktifkan provider **Email/Password**.
5. Masih di Authentication, buka tab **Users → Add user**. Isi email dan
   password untuk akun admin (misalnya email guru/panitia). Inilah akun
   yang dipakai untuk login di `admin.html`. Anda bisa menambah beberapa
   akun admin sekaligus di sini.
6. Kembali ke halaman utama proyek (ikon rumah), klik ikon **`</>`** (Web)
   untuk mendaftarkan aplikasi web. Beri nama bebas, klik **Register app**.
   Firebase akan menampilkan blok kode berisi `firebaseConfig = { apiKey: ...}`.
   **Salin seluruh nilai di dalamnya.**

## Langkah 2 — Memasukkan konfigurasi ke situs

Buka berkas `assets/js/firebase-init.js`, lalu ganti bagian ini dengan nilai
yang Anda salin dari Firebase tadi:

```js
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "...",
};
```

Nilai-nilai ini **aman dipublikasikan di GitHub** — ini bukan kata sandi.
Keamanan data sebenarnya diatur oleh `firestore.rules` (langkah 1.3), bukan
oleh kerahasiaan angka-angka ini.

## Langkah 3 — Mengunggah ke GitHub & mengaktifkan GitHub Pages

1. Buat repository baru di GitHub (lihat panduan git dasar jika belum
   pernah: buat repo di github.com → `git init` → `git add .` →
   `git commit -m "Initial commit"` → `git remote add origin ...` →
   `git push -u origin main`).
2. Di halaman repository GitHub, buka **Settings → Pages**.
3. Pada **Source**, pilih branch `main` dan folder `/ (root)`, lalu **Save**.
4. Tunggu 1-2 menit, GitHub akan menampilkan URL situs Anda, biasanya
   berbentuk `https://namaanda.github.io/nama-repo/`.

## Langkah 4 — Satu langkah wajib yang sering terlewat

Firebase Authentication akan **menolak login** dari domain yang tidak
dikenal. Setelah situs Anda tayang di GitHub Pages:

1. Salin URL domain GitHub Pages Anda (misalnya `namaanda.github.io`).
2. Di Firebase Console → **Authentication → Settings → Authorized domains**
   → **Add domain** → tempelkan domain tersebut (tanpa `https://` dan tanpa
   path, cukup `namaanda.github.io`).

Tanpa langkah ini, formulir peserta tetap berfungsi normal, tapi **login
admin akan gagal** dengan pesan error terkait domain.

## Mencoba di komputer sendiri sebelum online (opsional)

Karena ini situs statis, cara termudah adalah membuka `index.html` langsung
lewat server lokal sederhana, misalnya (jika Python terpasang):

```bash
python3 -m http.server 8000
```

lalu buka `http://localhost:8000/` di browser. Karena `firebase-init.js`
sudah diisi dengan config Firebase asli Anda (bukan emulator), pengetesan
lokal ini akan langsung membaca/menulis ke database Firebase yang
sesungguhnya — jadi data uji coba Anda akan ikut tersimpan di sana. Hapus
data uji coba tersebut lewat panel admin setelah selesai menguji.

## Fitur "Hubungi Peserta/Wali" — cara kerjanya di versi statis ini

Karena situs ini tidak punya server sendiri, fitur "Hubungi" di panel admin
bekerja dengan cara yang tetap gratis dan tanpa perlu langganan apa pun:

- **WhatsApp**: tombol "Buka" akan membuka WhatsApp dengan pesan yang sudah
  ditulis otomatis — Anda tinggal periksa lalu tekan kirim. Ini juga dipakai
  pada catatan "hubungi guru" di formulir peserta (nomor WhatsApp
  Bapak Rizky Ahmed Darmawan, S.M. sudah ditulis di `assets/js/form.js`,
  konstanta `TEACHER_WHATSAPP` — ubah di sana jika nomornya berganti).
- **Email**: tombol "Buka" akan membuka aplikasi email default perangkat
  Anda dengan pesan yang sudah terisi.

Jika suatu saat Anda ingin pengiriman email yang benar-benar otomatis (tanpa
membuka aplikasi email manual), Anda bisa menambahkan layanan gratis
**EmailJS** (emailjs.com, tidak memerlukan server, ada paket gratis) — ini
di luar cakupan proyek ini tapi mudah ditambahkan ke `assets/js/admin.js`
jika suatu saat dibutuhkan.

## Mengunduh PDF & CSV

Tombol "Unduh PDF" dan "Ekspor PDF (semua)" di panel admin membuat berkas
PDF langsung di browser (tanpa server) menggunakan pustaka jsPDF yang sudah
disertakan. "Ekspor CSV" membuat berkas CSV yang bisa dibuka di Excel/Google
Sheets.

## Keamanan & privasi data

- Jangan bagikan email/password admin ke pihak yang tidak berwenang —
  siapapun yang login bisa membaca seluruh data kesehatan peserta.
- Data "Kesejahteraan Peserta" (masalah pribadi) bersifat rahasia; hanya
  admin yang login yang bisa melihatnya (diatur oleh `firestore.rules`).
- Setelah kegiatan selesai, Anda bisa menghapus data peserta satu per satu
  lewat tombol "Hapus data" di panel admin, atau menghapus seluruh koleksi
  `participants` langsung dari Firebase Console jika sudah tidak diperlukan.
- Firestore Anda tetap berada di infrastruktur Google — bukan di GitHub.
  GitHub hanya menyajikan berkas HTML/CSS/JS-nya.

---
&copy; Rizky Ahmed Darmawan
