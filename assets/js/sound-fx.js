/* global window */
// ============================================================================
// EFEK SUARA (SoundFX) — dipakai bersama oleh formulir peserta & panel admin.
// Semua bunyi di-generate langsung lewat Web Audio API (osilator sederhana),
// jadi tidak perlu berkas audio eksternal apa pun (tetap 100% statis/gratis).
//
// Dipetakan ke animasi bertema medis yang sudah ada di situs ini:
//   - heartbeat() -> detak ikon plus header & ikon centang sukses (heartbeat-icon)
//   - success()   -> saat kotak "berhasil" (success-box) muncul
//   - notify()    -> notifikasi baris data peserta baru di panel admin
//   - click()     -> perpindahan langkah formulir / tombol tutup
//   - alarm()     -> alarm pengingat perlengkapan (dibunyikan berulang oleh form.js)
//
// Pengguna bisa mematikan/menghidupkan lewat tombol 🔊/🔇 di header
// (preferensi disimpan di localStorage, default: menyala).
// ============================================================================
(function () {
  const STORAGE_KEY = 'medcheck_sound_enabled';
  let enabled = true;
  try { enabled = localStorage.getItem(STORAGE_KEY) !== 'off'; } catch (e) { /* ignore */ }

  let ctx = null;
  function ensureCtx() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ctx = null; }
    }
    if (ctx && ctx.state === 'suspended') { ctx.resume().catch(() => {}); }
    return ctx;
  }

  // Browser modern memblokir suara sebelum ada interaksi pengguna — "buka
  // kunci" AudioContext pada sentuhan/klik/keydown pertama di halaman.
  ['click', 'touchstart', 'keydown'].forEach((evt) => {
    document.addEventListener(evt, function unlock() { ensureCtx(); }, { once: true, passive: true });
  });

  function tone(freq, startOffset, duration, waveType, peakGain) {
    const c = ensureCtx();
    if (!c || !enabled) return;
    try {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = waveType || 'sine';
      osc.frequency.value = freq;
      const t0 = c.currentTime + startOffset;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(peakGain || 0.15, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
      osc.connect(gain).connect(c.destination);
      osc.start(t0);
      osc.stop(t0 + duration + 0.03);
    } catch (e) { /* diamkan bila Web Audio tidak tersedia/gagal */ }
  }

  const SoundFX = {
    isEnabled() { return enabled; },
    setEnabled(v) {
      enabled = !!v;
      try { localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off'); } catch (e) { /* ignore */ }
    },
    // Detak "lub-dub" pelan — dipasangkan dengan animasi heartbeatPulse.
    heartbeat() {
      tone(95, 0, 0.13, 'sine', 0.16);
      tone(72, 0.15, 0.17, 'sine', 0.14);
    },
    // Chime dua-tiga nada menaik — untuk kotak sukses / data tersimpan.
    success() {
      tone(523.25, 0, 0.14, 'sine', 0.13);
      tone(659.25, 0.12, 0.14, 'sine', 0.13);
      tone(783.99, 0.24, 0.22, 'sine', 0.15);
    },
    // Ping lembut dua-nada — untuk notifikasi/badge/baris data baru.
    notify() {
      tone(660, 0, 0.09, 'sine', 0.11);
      tone(880, 0.11, 0.13, 'sine', 0.11);
    },
    // Tik singkat — untuk navigasi langkah / tombol tutup.
    click() {
      tone(600, 0, 0.045, 'square', 0.05);
    },
    // Alarm mendesak (2 nada bergantian) — untuk pengingat perlengkapan.
    alarm() {
      [0, 0.28, 0.56, 0.84].forEach((t, i) => {
        tone(i % 2 === 0 ? 880 : 660, t, 0.22, 'square', 0.13);
      });
    },
  };

  window.SoundFX = SoundFX;
})();
