/* global window */
// ============================================================================
// SupplyPhase — util bersama untuk logika jendela waktu Perlengkapan & Obat,
// dipakai oleh formulir peserta (form.js) DAN panel admin (admin.js) supaya
// aturannya tidak pernah "berbeda sendiri-sendiri" di dua tempat.
// ============================================================================
(function (global) {
  function pad(n) { return String(n).padStart(2, '0'); }

  function parseLocal(dateStr, timeStr) {
    if (!dateStr || !timeStr) return null;
    const [y, m, d] = dateStr.split('-').map(Number);
    const [hh, mm] = timeStr.split(':').map(Number);
    if (!y || !m || !d || Number.isNaN(hh) || Number.isNaN(mm)) return null;
    return new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0);
  }

  function fmtDateTime(d) {
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', "Jum'at", 'Sabtu'];
  const MONTH_NAMES = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];

  // Format lengkap: hari, tanggal, bulan, tahun, dan rentang jam — dipakai
  // supaya entri Perlengkapan Obat, Ibadah & Mandi selalu tercatat sesuai
  // hari/tanggal/bulan/jam persis yang diatur admin lewat Jadwal
  // Perlengkapan, bukan sekadar label "H-1"/"Hari-H".
  function fmtFullDay(dateStr, startStr, endStr) {
    const start = parseLocal(dateStr, startStr || '00:00');
    if (!start) return '';
    const dayName = DAY_NAMES[start.getDay()];
    const monthName = MONTH_NAMES[start.getMonth()];
    const dateLabel = `${dayName}, ${start.getDate()} ${monthName} ${start.getFullYear()}`;
    const timeLabel = endStr ? `${startStr}–${endStr} WIB` : `${startStr} WIB`;
    return `${dateLabel}, pukul ${timeLabel}`;
  }

  // Mengembalikan objek jadwal terperinci (hari, tanggal, bulan, jam) untuk
  // jendela H-1 dan hari-H sekaligus, plus label jendela mana yang sedang
  // aktif/akan datang sesuai `now`. Dipakai untuk menandai setiap entri Obat
  // Pribadi & Perlengkapan supaya tertaut langsung ke jadwal admin.
  function scheduleSnapshot(settings, now) {
    now = now || new Date();
    if (!settings || !settings.enabled) return null;
    const db_ = settings.dayBefore || {};
    const ed_ = settings.eventDay || {};
    const dayBeforeLabel = db_.date ? fmtFullDay(db_.date, db_.start, db_.end) : '';
    const eventDayLabel = ed_.date ? fmtFullDay(ed_.date, ed_.start, ed_.end) : '';
    const phase = getPhase(settings, now);
    let activeWindow = null;
    let activeLabel = '';
    const dbEnd = parseLocal(db_.date, db_.end);
    if (phase === 'open') {
      activeWindow = (dbEnd && now <= dbEnd) ? 'dayBefore' : 'eventDay';
      activeLabel = activeWindow === 'dayBefore' ? dayBeforeLabel : eventDayLabel;
    }
    return {
      phase,
      dayBefore: { date: db_.date || '', start: db_.start || '', end: db_.end || '', label: dayBeforeLabel },
      eventDay: { date: ed_.date || '', start: ed_.start || '', end: ed_.end || '', label: eventDayLabel },
      activeWindow,
      activeLabel,
    };
  }

  // Mengembalikan: 'locked' | 'open' | 'closed' | 'unset'
  function getPhase(settings, now) {
    now = now || new Date();
    if (!settings || !settings.enabled) return 'unset';
    const dbStart = parseLocal(settings.dayBefore && settings.dayBefore.date, settings.dayBefore && settings.dayBefore.start);
    const dbEnd = parseLocal(settings.dayBefore && settings.dayBefore.date, settings.dayBefore && settings.dayBefore.end);
    const edStart = parseLocal(settings.eventDay && settings.eventDay.date, settings.eventDay && settings.eventDay.start);
    const edEnd = parseLocal(settings.eventDay && settings.eventDay.date, settings.eventDay && settings.eventDay.end);
    if (!dbStart || !edEnd) return 'unset';
    if (now < dbStart) return 'locked';
    if ((dbEnd && now <= dbEnd) || (edStart && edEnd && now >= edStart && now <= edEnd)) return 'open';
    if (now > edEnd) return 'closed';
    return 'locked'; // di antara dua jendela (H-1 sudah lewat, hari-H belum mulai)
  }

  function nextOpenLabel(settings) {
    if (!settings) return '';
    const dbStart = parseLocal(settings.dayBefore && settings.dayBefore.date, settings.dayBefore && settings.dayBefore.start);
    const edStart = parseLocal(settings.eventDay && settings.eventDay.date, settings.eventDay && settings.eventDay.start);
    const now = new Date();
    const target = (dbStart && now < dbStart) ? dbStart : edStart;
    return target ? fmtDateTime(target) : '-';
  }

  function isValidTimeString(v) {
    return /^([01]\d|2[0-3]):([0-5]\d)$/.test((v || '').trim());
  }

  function isValidPhone(value) {
    const digits = (value || '').replace(/[^0-9]/g, '');
    return digits.length >= 9 && digits.length <= 14;
  }

  const PHASE_LABELS = {
    unset: 'Belum diatur',
    locked: 'Terkunci (belum dibuka)',
    open: 'Sedang dibuka',
    closed: 'Sudah lewat jendela waktu',
  };

  global.SupplyPhase = {
    parseLocal, fmtDateTime, getPhase, nextOpenLabel,
    isValidTimeString, isValidPhone, PHASE_LABELS,
    fmtFullDay, scheduleSnapshot, DAY_NAMES, MONTH_NAMES,
  };
})(window);
