# Data Kesehatan & Kontak Peserta (versi hosting GitHub gratis)

## 🆕 Pembaruan versi ini

- **No. HP alternatif wali kini opsional** — tidak lagi wajib diisi peserta
  (field lain di langkah Kontak tetap wajib seperti sebelumnya).
- **Label "Obat-obatan pribadi yang dibawa"** — sebelumnya "Obat-obatan yang
  dibawa (jika ada)", di formulir utama maupun formulir susulan perlengkapan.
- **Obat pribadi & Perlengkapan Ibadah/Mandi kini tertaut ke Jadwal
  Perlengkapan admin** — setiap entri otomatis dicatat sesuai hari, tanggal,
  bulan, dan jam persis yang diatur admin di tab "Jadwal Perlengkapan"
  (bukan cuma label "H-1"/"Hari-H" generik), dan ditampilkan langsung ke
  peserta maupun di panel admin/PDF.
- **Ubah & kirim ulang data kapan saja** — Pengurus OSIS, Peserta Umum, dan
  Panitia sekarang bisa mengubah seluruh data mereka sendiri (bukan cuma
  perlengkapan) dan mengirim ulang lewat tombol **"Ubah Data Saya"**, tanpa
  perlu login admin. Diamankan lewat pencocokan `access_token` di
  `firestore.rules`.
- **Rencana Penanganan Medis Otomatis** — begitu peserta mengisi kondisi
  medis khusus, alergi (obat/makanan/lain), dan/atau masalah pribadi, sistem
  langsung menyusun rencana penanganan & tingkat prioritas (Normal / Perlu
  Perhatian / Prioritas Tinggi) secara otomatis saat data dikirim/diubah —
  tanpa input manual guru/staf. Muncul di ringkasan peserta, panel admin,
  PDF, CSV, dan notifikasi real-time panel admin.
- **Pesan WhatsApp otomatis diperbarui** — format pesan yang terkirim ke
  guru/staf yang dipilih kini mengikuti format baku yang ditentukan sekolah.
- **Kelas**: field ini sekarang punya animasi mengetik bergantian yang
  berputar di antara `X MPLB`, `XI MPLB`, `XII MPLB`, `X OTKP`, `XI OTKP`,
  dan `XII OTKP` (peserta tetap bebas mengetik kelas lain, atau memilih dari
  saran datalist).
- **Program keahlian/jurusan**: placeholder-nya sekarang animasi mengetik
  bergantian antara *"Manajemen Perkantoran dan Layanan Bisnis"* dan
  *"Otomatisasi dan Tata Kelola Perkantoran"* (peserta tetap bebas mengetik
  apa saja, atau memilih salah satu dari saran datalist).
- **Semua field "Kontak" wajib diisi**, kecuali email — nomor HP peserta, nama
  wali, hubungan, nomor HP wali utama, dan nomor HP wali alternatif sekarang
  wajib, dan formatnya divalidasi (nomor HP 9–14 digit, email harus berformat
  benar) sebelum peserta bisa lanjut.
- **Hubungi Otomatis**: peserta memilih satu guru/staf medis di langkah
  Kontak. Saat formulir dikirim, tab WhatsApp ke orang itu langsung terbuka
  otomatis berisi ringkasan data (termasuk peringatan alergi/masalah pribadi
  bila ada). Guru/staf medis dikelola lewat tab **"Kelola Staf"** di panel
  admin — sekarang lengkap dengan validasi nomor WhatsApp, deteksi nomor
  ganda, pencarian, tombol **"Ubah"** untuk mengedit data staf yang sudah
  ada, dan lencana peringatan bila tidak ada satu pun staf yang aktif
  (dropdown di formulir peserta akan kosong bila ini terjadi).
- **Jendela waktu Perlengkapan Ibadah & Mandi / Obat**: guru/staf medis
  mengatur jadwalnya lewat tab **"Jadwal Perlengkapan"** di panel admin
  (tanggal & jam H-1, tanggal & jam hari-H, plus jam pengingat). Tab ini
  sekarang memvalidasi input sebelum disimpan (jam mulai harus lebih awal
  dari jam selesai, format jam pengingat harus `HH:mm`, dsb.) dan
  menampilkan status jendela saat ini secara langsung (Terkunci / Sedang
  dibuka / Sudah lewat / Belum diatur) sebelum maupun sesudah disimpan.
  Sebelum jendela dibuka, peserta boleh melewati bagian ini dan mengirim
  sisanya; begitu jendela dibuka, peserta yang belum mengisi akan diingatkan
  otomatis (notifikasi perangkat + tombol kirim WhatsApp) sesuai jam yang
  diatur admin (default 3x sehari: 08:00, 13:00, 19:00).
- **Panel admin**: guru/staf medis melihat data secara real-time, mendapat
  notifikasi otomatis di layar saat ada data baru/berisiko (alergi, masalah
  pribadi) masuk selama dashboard terbuka, dan punya tombol "Hubungi
  otomatis" ke staf yang dipilih peserta selain ke wali/peserta.
- Animasi bertema medis: ikon plus berdetak (heartbeat) di header, garis EKG
  berjalan, badge titik berdenyut, dan ikon centang berdetak saat sukses.
- Logika jendela waktu (`assets/js/supply-phase.js`) sekarang dipakai
  bersama oleh formulir peserta dan panel admin, supaya aturannya konsisten
  di kedua tempat.

### ⚠️ Batasan jujur yang perlu dipahami (situs statis + free tier)

Situs ini **tetap 100% statis** (tanpa server sendiri) supaya bisa terus
dihosting gratis di GitHub Pages dengan Firebase Spark (gratis). Karena itu:

1. **"Hubungi otomatis" membuka tab WhatsApp secara otomatis**, tapi
   *mengirim* pesannya tetap perlu satu tombol "Kirim" ditekan manusia —
   ini batasan resmi dari WhatsApp (wa.me), bukan dari kode situs ini.
   Pengiriman WhatsApp yang benar-benar tanpa sentuhan manusia sama sekali
   hanya bisa lewat **WhatsApp Business API resmi** (berbayar & perlu
   verifikasi bisnis), di luar cakupan versi gratis ini.
2. **Pengingat 3x sehari** bekerja penuh selama peserta/guru membuka tab
   situs ini di jam-jam tersebut (memakai `Notification` browser + banner
   dalam halaman). Untuk pengingat yang tetap terkirim walau aplikasi/tab
   sedang tertutup total, dibutuhkan **Firebase Cloud Messaging + Cloud
   Function terjadwal**, yang mengharuskan upgrade ke paket **Blaze**
   (bayar-sesuai-pakai; untuk skala sekolah biayanya biasanya tetap
   Rp0–beberapa ribu rupiah/bulan, tapi tidak lagi 100% gratis seperti
   Spark). Ini bisa ditambahkan sebagai pengembangan lanjutan bila
   dibutuhkan.
3. Notifikasi otomatis untuk guru/staf medis di panel admin ("data baru
   masuk") juga bekerja selama tab dashboard **sedang terbuka** — ini
   real-time via Firestore listener (`onSnapshot`), bukan simulasi, tapi
   tetap butuh tab dashboard aktif untuk memicu notifikasi browser.

### Struktur data baru di Firestore

- `participants/{id}` — field lama tetap ada, ditambah:
  `target_staff_id`, `target_staff_name`, `target_staff_whatsapp`,
  `access_token` (dipakai peserta untuk menyusulkan data perlengkapan tanpa
  login, dan sekarang juga untuk mengubah/mengirim ulang seluruh datanya
  lewat tombol "Ubah Data Saya"), `supplies_skipped`, `supplies_submitted_at`,
  `medications_schedule`, `supplies_schedule_label`, `supplies_schedule`
  (snapshot hari/tanggal/bulan/jam dari Jadwal Perlengkapan admin),
  `medical_attention_plan` (rencana penanganan medis otomatis beserta
  prioritasnya), `updated_at` & `revision_count` (jejak setiap kali peserta
  mengubah & mengirim ulang datanya).
- `staff/{id}` — `name`, `role` (`guru`/`medis`), `whatsapp`, `active`.
  Dibaca publik oleh formulir peserta, hanya bisa ditulis oleh admin yang
  login. Dikelola lewat tab "Kelola Staf" di panel admin — tidak perlu
  diisi manual di Firebase Console.
- `settings/supplyWindow` — jadwal jendela H-1/hari-H & jam pengingat.
  Dibaca publik, hanya admin yang bisa mengubah. Dikelola lewat tab
  "Jadwal Perlengkapan".
- `contactLog/{id}` — jejak audit setiap kali "hubungi otomatis" dipicu.

Setelah menerapkan `firestore.rules` yang baru (lihat Langkah 1.3 di bawah),
tambahkan minimal satu guru/staf lewat tab **Kelola Staf** di panel admin
sebelum membagikan link formulir ke peserta — kalau belum ada staf
terdaftar, dropdown "Hubungi Otomatis" di formulir akan kosong.

---


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
assets/js/supply-phase.js            Util bersama: logika jendela waktu Perlengkapan (dipakai formulir & admin)
assets/js/form.js                    Logika formulir & nomor WhatsApp guru
assets/js/admin.js                    Logika dashboard, PDF, CSV, kontak, kelola staf, jadwal
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
  pada fitur "Hubungi Otomatis" di formulir peserta. Nomor WhatsApp guru/staf
  tidak lagi ditulis langsung di kode — semuanya dikelola lewat tab
  **"Kelola Staf"** di panel admin, jadi cukup tambah/ubah datanya di sana
  jika ada staf baru atau nomornya berganti.
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
