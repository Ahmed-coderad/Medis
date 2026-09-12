/* global firebase */

// ============================================================================
// KONFIGURASI FIREBASE — GANTI DENGAN CONFIG PROYEK FIREBASE ANDA SENDIRI
// ============================================================================
// Cara mendapatkan nilai-nilai ini: lihat README.md bagian "Menyiapkan Firebase".
// Nilai-nilai ini AMAN untuk dipublikasikan di GitHub / dilihat publik —
// ini bukan kata sandi. Keamanan data sesungguhnya diatur oleh
// firestore.rules (hanya admin yang login yang bisa membaca/mengubah data).
const firebaseConfig = {
  apiKey: "GANTI_DENGAN_API_KEY",
  authDomain: "GANTI_DENGAN_PROJECT_ID.firebaseapp.com",
  projectId: "GANTI_DENGAN_PROJECT_ID",
  storageBucket: "GANTI_DENGAN_PROJECT_ID.appspot.com",
  messagingSenderId: "GANTI_DENGAN_SENDER_ID",
  appId: "GANTI_DENGAN_APP_ID",
};
// ============================================================================

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

// Saat situs dibuka di komputer lokal (localhost / 127.0.0.1), otomatis
// tersambung ke Firebase Emulator alih-alih proyek Firebase asli. Ini
// membuat pengetesan lokal aman (tidak menyentuh data sungguhan) dan tidak
// memerlukan konfigurasi tambahan saat sudah di-deploy ke GitHub Pages.
if (['localhost', '127.0.0.1'].includes(window.location.hostname)) {
  auth.useEmulator('http://localhost:9099', { disableWarnings: true });
  db.useEmulator('localhost', 8080);
  console.info('Mode pengembangan lokal: tersambung ke Firebase Emulator.');
}
