/* global firebase */

// ============================================================================
// KONFIGURASI FIREBASE — GANTI DENGAN CONFIG PROYEK FIREBASE ANDA SENDIRI
// ============================================================================
// Cara mendapatkan nilai-nilai ini: lihat README.md bagian "Menyiapkan Firebase".
// Nilai-nilai ini AMAN untuk dipublikasikan di GitHub / dilihat publik —
// ini bukan kata sandi. Keamanan data sesungguhnya diatur oleh
// firestore.rules (hanya admin yang login yang bisa membaca/mengubah data).
const firebaseConfig = {
  apiKey: "AIzaSyDky7_IqTUCtrT9_No64toFFdrjlRNneyI",
  authDomain: "medis-sekolah.firebaseapp.com",
  databaseURL: "https://medis-sekolah-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "medis-sekolah",
  storageBucket: "medis-sekolah.firebasestorage.app",
  messagingSenderId: "666320549362",
  appId: "1:666320549362:web:b7f3e1247a78f07c63676b",
  measurementId: "G-FN9YXZ43L4",
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
