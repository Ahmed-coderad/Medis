// ============================================================================
// EFEK SUARA — tombol mute/unmute (mengikuti animasi detak jantung header
// panel admin). Suara sesungguhnya di-generate oleh assets/js/sound-fx.js.
// ============================================================================
(function wireAdminSoundToggle() {
  const btn = document.getElementById('soundToggleBtn');
  if (!btn || !window.SoundFX) return;
  function refresh() {
    const on = window.SoundFX.isEnabled();
    btn.textContent = on ? '🔊' : '🔇';
    btn.setAttribute('aria-pressed', String(on));
    btn.title = on ? 'Matikan efek suara' : 'Aktifkan efek suara';
  }
  btn.addEventListener('click', () => {
    window.SoundFX.setEnabled(!window.SoundFX.isEnabled());
    refresh();
    window.SoundFX.click();
  });
  refresh();
  setTimeout(() => { if (window.SoundFX) window.SoundFX.heartbeat(); }, 600);
})();

(function () {
  document.getElementById('yearLogin').textContent = new Date().getFullYear();

  const loginView = document.getElementById('loginView');
  const dashboardView = document.getElementById('dashboardView');
  const loginForm = document.getElementById('loginForm');
  const loginError = document.getElementById('loginError');
  const loginBtn = document.getElementById('loginBtn');

  let allRecords = []; // cache of everything the admin is allowed to read
  let unsubscribeSnapshot = null;

  // ---------- Auth ----------
  auth.onAuthStateChanged((user) => {
    if (user) {
      loginView.hidden = true;
      dashboardView.hidden = false;
      document.getElementById('adminName').textContent = user.email || '';
      if (window.SoundFX) window.SoundFX.success();
      subscribeToRecords();
    } else {
      loginView.hidden = false;
      dashboardView.hidden = true;
      if (unsubscribeSnapshot) { unsubscribeSnapshot(); unsubscribeSnapshot = null; }
    }
  });

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.hidden = true;
    loginBtn.disabled = true;
    loginBtn.textContent = 'Memeriksa...';
    try {
      await auth.signInWithEmailAndPassword(
        document.getElementById('username').value.trim(),
        document.getElementById('password').value
      );
    } catch (err) {
      loginError.textContent = friendlyAuthError(err);
      loginError.hidden = false;
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = 'Masuk';
    }
  });

  function friendlyAuthError(err) {
    const code = err && err.code;
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
      return 'Email atau password salah.';
    }
    if (code === 'auth/invalid-email') return 'Format email tidak valid.';
    if (code === 'auth/too-many-requests') return 'Terlalu banyak percobaan. Coba lagi beberapa saat lagi.';
    return err && err.message ? err.message : 'Gagal masuk. Silakan coba lagi.';
  }

  document.getElementById('logoutBtn').addEventListener('click', () => auth.signOut());

  // ---------- Firestore live records ----------
  function subscribeToRecords() {
    const loadingState = document.getElementById('loadingState');
    loadingState.hidden = false;
    unsubscribeSnapshot = db.collection('participants')
      .orderBy('submitted_at', 'desc')
      .onSnapshot((snap) => {
        allRecords = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        loadingState.hidden = true;
        renderStats();
        renderTable();
      }, (err) => {
        console.error(err);
        loadingState.textContent = 'Gagal memuat data: ' + err.message;
      });
  }

  // ---------- Stats ----------
  function renderStats() {
    const total = allRecords.length;
    const drugAllergy = allRecords.filter((r) => r.has_drug_allergy === 'yes').length;
    const anyAllergy = allRecords.filter((r) => r.has_drug_allergy === 'yes' || r.has_food_allergy === 'yes' || r.has_other_allergy === 'yes').length;
    const personalIssue = allRecords.filter((r) => r.has_personal_issue === 'yes').length;

    document.getElementById('statsGrid').innerHTML = `
      <div class="stat-card">
        <div class="stat-card__value">${total}</div>
        <div class="stat-card__label">Total peserta terdata</div>
      </div>
      <div class="stat-card stat-card--alert">
        <div class="stat-card__value">${drugAllergy}</div>
        <div class="stat-card__label">Alergi obat</div>
      </div>
      <div class="stat-card stat-card--alert">
        <div class="stat-card__value">${anyAllergy}</div>
        <div class="stat-card__label">Punya alergi apapun</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__value">${personalIssue}</div>
        <div class="stat-card__label">Menandai masalah pribadi</div>
      </div>
    `;
  }

  // ---------- Filtering + table ----------
  const searchInput = document.getElementById('searchInput');
  const roleFilter = document.getElementById('roleFilter');
  const allergyFilter = document.getElementById('allergyFilter');
  [searchInput, roleFilter, allergyFilter].forEach((el) => el.addEventListener('input', renderTable));

  function getFiltered() {
    const q = searchInput.value.trim().toLowerCase();
    const role = roleFilter.value;
    const allergy = allergyFilter.value;
    return allRecords.filter((r) => {
      if (q && !`${r.full_name} ${r.class} ${r.major}`.toLowerCase().includes(q)) return false;
      if (role && r.role !== role) return false;
      if (allergy === 'drug' && r.has_drug_allergy !== 'yes') return false;
      if (allergy === 'any' && !(r.has_drug_allergy === 'yes' || r.has_food_allergy === 'yes' || r.has_other_allergy === 'yes')) return false;
      return true;
    });
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function yesNoBadge(value, label) {
    if (value === 'yes') return `<span class="badge badge--alert">${label}</span>`;
    return '';
  }

  function renderTable() {
    const records = getFiltered();
    const recordsBody = document.getElementById('recordsBody');
    const emptyState = document.getElementById('emptyState');

    if (!records.length) {
      recordsBody.innerHTML = '';
      emptyState.hidden = false;
      return;
    }
    emptyState.hidden = true;

    recordsBody.innerHTML = records.map((r) => {
      const allergyBadges = [
        yesNoBadge(r.has_drug_allergy, 'Obat'),
        yesNoBadge(r.has_food_allergy, 'Makanan'),
        yesNoBadge(r.has_other_allergy, 'Lainnya'),
      ].join(' ') || '<span class="badge badge--muted">Tidak ada</span>';

      const issueBadge = r.has_personal_issue === 'yes'
        ? '<span class="badge badge--warn">Ya</span>'
        : '<span class="badge badge--muted">Tidak</span>';

      return `
        <tr>
          <td>${escapeHtml(r.full_name)}</td>
          <td>${escapeHtml(r.class)}</td>
          <td>${escapeHtml(r.major)}</td>
          <td>${escapeHtml(r.role)}</td>
          <td>${allergyBadges}</td>
          <td>${issueBadge}</td>
          <td><button class="link-btn" data-id="${r.id}">Lihat detail</button></td>
        </tr>
      `;
    }).join('');

    recordsBody.querySelectorAll('.link-btn').forEach((btn) => {
      btn.addEventListener('click', () => openDetail(btn.dataset.id));
    });
  }

  // ---------- Detail modal ----------
  const detailModal = document.getElementById('detailModal');
  const modalBody = document.getElementById('modalBody');
  const modalTitle = document.getElementById('modalTitle');
  const deleteBtn = document.getElementById('deleteBtn');
  const pdfBtn = document.getElementById('pdfBtn');
  const contactBtn = document.getElementById('contactBtn');
  let currentRecord = null;

  function detailRow(label, value, alertMode = false) {
    return `<div class="detail-row"><span class="detail-row__label">${label}</span><span class="detail-row__value ${alertMode ? 'detail-row__value--alert' : ''}">${escapeHtml(value)}</span></div>`;
  }

  function openDetail(id) {
    const r = allRecords.find((x) => x.id === id);
    if (!r) return;
    currentRecord = r;

    modalTitle.textContent = r.full_name;
    const meds = Array.isArray(r.medications) ? r.medications : [];
    const prayerGear = Array.isArray(r.prayer_gear) ? r.prayer_gear : [];
    const toiletries = Array.isArray(r.toiletries) ? r.toiletries : [];
    const plan = r.medical_attention_plan || null;
    const planBadgeClass = plan && plan.priority === 'Prioritas Tinggi' ? 'badge--alert'
      : (plan && plan.priority === 'Perlu Perhatian' ? 'badge--warn' : 'badge--muted');
    const updatedAtStr = r.updated_at && r.updated_at.toDate ? r.updated_at.toDate().toLocaleString('id-ID') : null;

    modalBody.innerHTML = `
      <div class="detail-section">
        <h4>Data Diri</h4>
        ${detailRow('Kelas', r.class)}
        ${detailRow('Jurusan', r.major)}
        ${detailRow('Peran', r.role)}
        ${updatedAtStr ? detailRow('Terakhir diubah & dikirim ulang oleh peserta', `${updatedAtStr}${r.revision_count ? ` (revisi ke-${r.revision_count})` : ''}`) : ''}
      </div>
      <div class="detail-section">
        <h4>Rencana Penanganan Medis Otomatis <span class="badge ${planBadgeClass}">${plan ? plan.priority : 'Belum tersedia'}</span></h4>
        <p class="contact-note">${plan && plan.intro ? escapeHtml(plan.intro) : 'Rencana ini disusun otomatis oleh sistem berdasarkan jawaban kesehatan &amp; kesejahteraan yang diisi peserta — bukan diagnosis medis, hanya panduan kesiapsiagaan.'}</p>
        ${plan ? plan.points.map((p) => `<p class="contact-note">• ${escapeHtml(p)}</p>`).join('') : '<p class="contact-note">Rencana otomatis belum tersusun untuk data lama sebelum pembaruan sistem ini.</p>'}
        ${plan && plan.priority_note ? `<p class="contact-note">${escapeHtml(plan.priority_note)}</p>` : ''}
      </div>
      <div class="detail-section">
        <h4>Kontak</h4>
        ${detailRow('No. HP peserta', r.participant_phone || '-')}
        ${detailRow('Email peserta', r.participant_email || '-')}
        ${detailRow('Orang tua/wali', r.guardian_name)}
        ${detailRow('Hubungan', r.guardian_relation || '-')}
        ${detailRow('No. HP orang tua/wali', r.guardian_phone)}
        ${detailRow('No. HP alternatif', r.guardian_alt_phone || '-')}
        ${detailRow('Guru/staf dihubungi otomatis', r.target_staff_name || '-')}
      </div>
      <div class="detail-section">
        <h4>Kesehatan</h4>
        ${detailRow('Kondisi medis', r.medical_conditions || 'Tidak ada')}
        ${detailRow('Alergi obat', r.has_drug_allergy === 'yes' ? r.drug_allergy_detail : 'Tidak', r.has_drug_allergy === 'yes')}
        ${detailRow('Alergi makanan', r.has_food_allergy === 'yes' ? r.food_allergy_detail : 'Tidak', r.has_food_allergy === 'yes')}
        ${detailRow('Alergi lainnya', r.has_other_allergy === 'yes' ? r.other_allergy_detail : 'Tidak', r.has_other_allergy === 'yes')}
      </div>
      <div class="detail-section">
        <h4>Perlengkapan Obat, Ibadah &amp; Mandi</h4>
        <p class="contact-note" style="font-weight:700; margin-top:0;">Obat-obatan pribadi yang dibawa</p>
        ${meds.length ? meds.map((m) => detailRow(m.name, `${m.dosage || '-'} · ${m.schedule || '-'}`)).join('') : '<p class="contact-note">Tidak membawa obat.</p>'}
        ${meds.length && r.medications_schedule ? detailRow('Jadwal obat (sesuai Jadwal Perlengkapan admin)', r.medications_schedule) : ''}
        ${detailRow('Ibadah', prayerGear.join(', ') || '-')}
        ${detailRow('Mandi', toiletries.join(', ') || '-')}
        ${detailRow('Jadwal (sesuai Jadwal Perlengkapan admin)', r.supplies_schedule_label || r.prayer_gear_timing || '-')}
      </div>
      <div class="detail-section">
        <h4>Kesejahteraan</h4>
        ${detailRow('Ada masalah pribadi', r.has_personal_issue === 'yes' ? 'Ya' : 'Tidak')}
        ${r.has_personal_issue === 'yes' ? detailRow('Bersedia menjelaskan', r.wants_to_explain === 'yes' ? 'Ya' : 'Tidak') : ''}
        ${r.wants_to_explain === 'yes' ? `<p class="contact-note">"${escapeHtml(r.issue_detail)}"</p>` : ''}
        ${r.has_personal_issue === 'yes' && r.wants_to_explain === 'no' ? `<p class="contact-note">Peserta diarahkan untuk menghubungi ${escapeHtml(r.target_staff_name || 'guru/staf yang dipilih peserta')}.</p>` : ''}
      </div>
    `;

    detailModal.hidden = false;
  }

  document.getElementById('modalClose').addEventListener('click', () => { detailModal.hidden = true; });
  document.getElementById('modalBackdrop').addEventListener('click', () => { detailModal.hidden = true; });

  deleteBtn.addEventListener('click', async () => {
    if (!currentRecord) return;
    if (!confirm('Hapus data peserta ini secara permanen?')) return;
    await db.collection('participants').doc(currentRecord.id).delete();
    detailModal.hidden = true;
  });

  // ---------- PDF generation (client-side, jsPDF) ----------
  const BRAND = [22, 100, 92];
  const BRAND_DARK = [14, 64, 58];
  const MUTED = [91, 110, 106];
  const ALERT = [178, 58, 36];
  const TEXT = [26, 46, 43];
  const LINE = [220, 230, 227];
  const PAGE_W = 595.28;
  const MARGIN = 40;
  const CONTENT_W = PAGE_W - MARGIN * 2;

  function drawHeader(doc, subtitle) {
    doc.setFillColor(...BRAND);
    doc.rect(0, 0, PAGE_W, 90, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('FORMULIR DATA KESEHATAN & KONTAK PESERTA', MARGIN, 36);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(221, 237, 233);
    doc.text(subtitle, MARGIN, 54);
    doc.setTextColor(...TEXT);
    return 118;
  }

  function sectionTitle(doc, y, text) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...BRAND_DARK);
    doc.text(text.toUpperCase(), MARGIN, y);
    doc.setDrawColor(...LINE);
    doc.line(MARGIN, y + 3, PAGE_W - MARGIN, y + 3);
    return y + 15;
  }

  function field(doc, y, label, value, opts = {}) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(label, MARGIN, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...(opts.alert ? ALERT : TEXT));
    const lines = doc.splitTextToSize(String(value === null || value === undefined || value === '' ? '-' : value), CONTENT_W);
    doc.text(lines, MARGIN, y + 11);
    return y + 11 + lines.length * 10.5 + 5;
  }

  function ensureSpace(doc, y, needed) {
    if (y + needed > 800) {
      doc.addPage();
      return 40;
    }
    return y;
  }

  function renderParticipant(doc, p) {
    let y = drawHeader(doc, 'Dicetak untuk keperluan internal panitia/sekolah');

    y = sectionTitle(doc, y, 'Data Peserta');
    y = field(doc, y, 'Nama Lengkap', p.full_name);
    y = field(doc, y, 'Kelas', p.class);
    y = field(doc, y, 'Program Keahlian / Jurusan', p.major);
    y = field(doc, y, 'Peran', p.role);
    y = field(doc, y, 'No. HP Peserta', p.participant_phone || '-');
    y = field(doc, y, 'Email Peserta', p.participant_email || '-');

    y = sectionTitle(doc, y, 'Kontak Orang Tua / Wali');
    y = field(doc, y, 'Nama Orang Tua/Wali', p.guardian_name);
    y = field(doc, y, 'Hubungan', p.guardian_relation || '-');
    y = field(doc, y, 'No. HP Utama', p.guardian_phone);
    y = field(doc, y, 'No. HP Alternatif', p.guardian_alt_phone || '-');
    y = field(doc, y, 'Guru/Staf Dihubungi Otomatis', p.target_staff_name || '-');

    y = sectionTitle(doc, y, 'Kondisi Medis');
    y = field(doc, y, 'Kondisi medis khusus', p.medical_conditions || 'Tidak ada');
    y = field(doc, y, 'Alergi Obat', p.has_drug_allergy === 'yes' ? `Ya - ${p.drug_allergy_detail}` : 'Tidak', { alert: p.has_drug_allergy === 'yes' });
    y = field(doc, y, 'Alergi Makanan', p.has_food_allergy === 'yes' ? `Ya - ${p.food_allergy_detail}` : 'Tidak', { alert: p.has_food_allergy === 'yes' });
    y = field(doc, y, 'Alergi Lainnya', p.has_other_allergy === 'yes' ? `Ya - ${p.other_allergy_detail}` : 'Tidak', { alert: p.has_other_allergy === 'yes' });

    y = ensureSpace(doc, y, 80);
    y = sectionTitle(doc, y, 'Perlengkapan Obat, Ibadah & Mandi');
    const meds = Array.isArray(p.medications) ? p.medications : [];
    if (!meds.length) {
      y = field(doc, y, 'Obat-obatan pribadi', 'Tidak membawa obat-obatan khusus.');
    } else {
      meds.forEach((m, i) => {
        y = ensureSpace(doc, y, 30);
        y = field(doc, y, `Obat ${i + 1}`, `${m.name || '-'}  |  Dosis: ${m.dosage || '-'}  |  Jadwal: ${m.schedule || '-'}`);
      });
      if (p.medications_schedule) y = field(doc, y, 'Jadwal obat (sesuai jadwal admin)', p.medications_schedule);
    }
    y = field(doc, y, 'Ibadah', (p.prayer_gear || []).join(', ') || '-');
    y = field(doc, y, 'Mandi', (p.toiletries || []).join(', ') || '-');
    y = field(doc, y, 'Jadwal (sesuai jadwal admin)', p.supplies_schedule_label || p.prayer_gear_timing || 'belum ditentukan');

    if (p.medical_attention_plan) {
      y = ensureSpace(doc, y, 60);
      y = sectionTitle(doc, y, `Rencana Penanganan Medis Otomatis — ${p.medical_attention_plan.priority}`);
      if (p.medical_attention_plan.intro) {
        y = field(doc, y, 'Keterangan', p.medical_attention_plan.intro);
      }
      (p.medical_attention_plan.points || []).forEach((pt) => {
        y = ensureSpace(doc, y, 24);
        y = field(doc, y, '•', pt, { alert: p.medical_attention_plan.priority === 'Prioritas Tinggi' });
      });
      if (p.medical_attention_plan.priority_note) {
        y = field(doc, y, 'Arti prioritas', p.medical_attention_plan.priority_note);
      }
    }

    y = ensureSpace(doc, y, 60);
    y = sectionTitle(doc, y, 'Kesejahteraan Peserta');
    y = field(doc, y, 'Ada masalah pribadi?', p.has_personal_issue === 'yes' ? 'Ya' : 'Tidak');
    if (p.has_personal_issue === 'yes') {
      y = field(doc, y, 'Bersedia menjelaskan?', p.wants_to_explain === 'yes' ? 'Ya' : 'Tidak');
      if (p.wants_to_explain === 'yes') {
        y = field(doc, y, 'Penjelasan peserta', p.issue_detail || '-');
      } else if (p.wants_to_explain === 'no') {
        y = field(doc, y, 'Catatan', `Peserta diarahkan untuk menghubungi ${p.target_staff_name || 'guru/staf yang dipilih peserta'}.`);
      }
    }

    y = ensureSpace(doc, y, 30);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    const stamp = p.submitted_at && p.submitted_at.toDate ? p.submitted_at.toDate().toLocaleString('id-ID') : '-';
    doc.text(`Data dikirim: ${stamp}`, MARGIN, y + 10);
    doc.text('Dokumen ini bersifat rahasia dan hanya untuk keperluan internal panitia/sekolah.', MARGIN, y + 22);
  }

  function buildPdfFilename(name) {
    return `data-kesehatan-${(name || 'peserta').replace(/[^a-z0-9]+/gi, '_')}.pdf`;
  }

  pdfBtn.addEventListener('click', () => {
    if (!currentRecord) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    renderParticipant(doc, currentRecord);
    doc.save(buildPdfFilename(currentRecord.full_name));
  });

  document.getElementById('exportPdfBtn').addEventListener('click', () => {
    const records = getFiltered();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    if (!records.length) {
      drawHeader(doc, 'Tidak ada data peserta');
      doc.setFontSize(11);
      doc.text('Belum ada peserta yang mengisi formulir.', MARGIN, 130);
    } else {
      records.forEach((p, idx) => {
        if (idx > 0) doc.addPage();
        renderParticipant(doc, p);
      });
    }
    doc.save('rekap-data-kesehatan-peserta.pdf');
  });

  // ---------- CSV export (client-side) ----------
  document.getElementById('exportCsvBtn').addEventListener('click', () => {
    const records = getFiltered();
    const headers = [
      'full_name', 'class', 'major', 'role',
      'participant_phone', 'participant_email',
      'guardian_name', 'guardian_relation', 'guardian_phone', 'guardian_alt_phone',
      'target_staff_name',
      'medical_conditions', 'has_drug_allergy', 'drug_allergy_detail',
      'has_food_allergy', 'food_allergy_detail', 'has_other_allergy', 'other_allergy_detail',
      'medications_schedule', 'supplies_schedule_label',
      'medical_attention_priority', 'medical_attention_points',
      'has_personal_issue', 'supplies_skipped',
      'revision_count', 'updated_at',
    ];
    const escape = (v) => `"${String(v === undefined || v === null ? '' : v).replace(/"/g, '""')}"`;
    const lines = [headers.join(',')];
    records.forEach((r) => {
      const row = { ...r };
      row.medical_attention_priority = r.medical_attention_plan ? r.medical_attention_plan.priority : '';
      row.medical_attention_points = r.medical_attention_plan ? (r.medical_attention_plan.points || []).join(' | ') : '';
      row.updated_at = r.updated_at && r.updated_at.toDate ? r.updated_at.toDate().toLocaleString('id-ID') : '';
      lines.push(headers.map((h) => escape(row[h])).join(','));
    });
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'data-peserta.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  // ---------- Contact modal ----------
  const contactModal = document.getElementById('contactModal');
  const contactModalBody = document.getElementById('contactModalBody');

  function toWaLink(phone, message) {
    const digits = (phone || '').replace(/[^0-9]/g, '').replace(/^0/, '62');
    if (!digits) return null;
    return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
  }

  contactBtn.addEventListener('click', () => {
    if (!currentRecord) return;
    const r = currentRecord;
    const msg = `Assalamu'alaikum, Bapak/Ibu wali dari ${r.full_name} (${r.class}). Kami dari panitia kegiatan ingin menginformasikan/menanyakan terkait data kesehatan ananda. Mohon informasinya, terima kasih.`;
    const guardianWa = toWaLink(r.guardian_phone, msg);
    const guardianAltWa = toWaLink(r.guardian_alt_phone, msg);
    const participantWa = toWaLink(r.participant_phone, msg);
    const staffMsg = `Halo ${r.target_staff_name || ''}, ini menindaklanjuti data peserta ${r.full_name} (${r.class}) yang memilih Anda sebagai kontak.`;
    const staffWa = r.target_staff_whatsapp ? toWaLink(r.target_staff_whatsapp, staffMsg) : null;
    const mailtoLink = r.participant_email
      ? `mailto:${r.participant_email}?subject=${encodeURIComponent('Informasi kegiatan')}&body=${encodeURIComponent(msg)}`
      : null;

    contactModalBody.innerHTML = `
      ${staffWa ? `
        <div class="contact-option">
          <div class="contact-option__label"><strong>WhatsApp ${escapeHtml(r.target_staff_name)}</strong>Guru/staf yang dipilih peserta ini</div>
          <a class="btn btn--primary btn--small" href="${staffWa}" target="_blank" rel="noopener">Buka</a>
        </div>` : ''}
      ${guardianWa ? `
        <div class="contact-option">
          <div class="contact-option__label"><strong>WhatsApp orang tua/wali</strong>Buka percakapan otomatis</div>
          <a class="btn btn--primary btn--small" href="${guardianWa}" target="_blank" rel="noopener">Buka</a>
        </div>` : ''}
      ${guardianAltWa ? `
        <div class="contact-option">
          <div class="contact-option__label"><strong>WhatsApp (alternatif)</strong>Buka percakapan otomatis</div>
          <a class="btn btn--primary btn--small" href="${guardianAltWa}" target="_blank" rel="noopener">Buka</a>
        </div>` : ''}
      ${participantWa ? `
        <div class="contact-option">
          <div class="contact-option__label"><strong>WhatsApp peserta</strong>Buka percakapan otomatis</div>
          <a class="btn btn--primary btn--small" href="${participantWa}" target="_blank" rel="noopener">Buka</a>
        </div>` : ''}
      ${mailtoLink ? `
        <div class="contact-option">
          <div class="contact-option__label"><strong>Email peserta</strong>Buka aplikasi email dengan pesan siap kirim</div>
          <a class="btn btn--ghost btn--small" href="${mailtoLink}">Buka</a>
        </div>` : ''}
      ${!guardianWa && !participantWa && !mailtoLink ? '<p class="contact-note">Tidak ada kontak yang tersimpan untuk peserta ini.</p>' : ''}
      <p class="contact-note">Tautan WhatsApp membuka percakapan berisi pesan otomatis yang bisa kamu edit sebelum dikirim. Tautan email membuka aplikasi/email default perangkatmu. Lihat README untuk opsi pengiriman email sepenuhnya otomatis lewat EmailJS (gratis, opsional).</p>
    `;
    contactModal.hidden = false;
  });

  document.getElementById('contactModalClose').addEventListener('click', () => { contactModal.hidden = true; });
  document.getElementById('contactBackdrop').addEventListener('click', () => { contactModal.hidden = true; });
})();

// ============================================================================
// TAB SWITCHING (Dashboard / Kelola Staf / Jadwal Perlengkapan)
// ============================================================================
(function () {
  const tabs = document.querySelectorAll('.adm-tab');
  const panels = document.querySelectorAll('.adm-panel');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('is-active'));
      tab.classList.add('is-active');
      panels.forEach((p) => { p.hidden = p.dataset.panel !== tab.dataset.tab; });
      if (window.SoundFX) window.SoundFX.click();
    });
  });
})();

// ============================================================================
// AKUN ADMIN — ubah password akun sendiri & tambah admin baru (khusus tab
// "Akun Admin"). Akun "bawaan sistem" (dibuat langsung lewat Firebase
// Console, sebelum fitur ini ada) sengaja disembunyikan & tidak bisa diubah
// di sini — lihat catatan di firestore.rules & di UI panel ini.
// ============================================================================
(function () {
  const selfDesc = document.getElementById('accountSelfDesc');
  const selfForm = document.getElementById('selfPasswordForm');
  const selfError = document.getElementById('selfPasswordError');
  const selfSuccess = document.getElementById('selfPasswordSuccess');
  const addForm = document.getElementById('addAdminForm');
  const addError = document.getElementById('addAdminError');
  const addSuccess = document.getElementById('addAdminSuccess');
  const addBtn = document.getElementById('addAdminBtn');
  const accountsBody = document.getElementById('adminAccountsBody');
  const accountsEmpty = document.getElementById('adminAccountsEmpty');
  if (!selfForm || !addForm) return; // panel tidak ada di halaman ini

  let accountsUnsub = null;

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function friendlyAccountAuthError(err) {
    const code = err && err.code;
    if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') return 'Password saat ini salah.';
    if (code === 'auth/weak-password') return 'Password terlalu lemah — gunakan minimal 8 karakter.';
    if (code === 'auth/email-already-in-use') return 'Email ini sudah terdaftar sebagai admin.';
    if (code === 'auth/invalid-email') return 'Format email tidak valid.';
    if (code === 'auth/requires-recent-login') return 'Sesi login terlalu lama — silakan keluar lalu masuk kembali sebelum mengubah password.';
    return err && err.message ? err.message : 'Terjadi kesalahan. Silakan coba lagi.';
  }

  // ---------- Akun saya (ubah password sendiri) ----------
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      if (accountsUnsub) { accountsUnsub(); accountsUnsub = null; }
      accountsBody.innerHTML = '';
      return;
    }

    let isManagedAccount = false;
    selfDesc.textContent = 'Memuat info akun...';
    selfForm.hidden = true;
    try {
      const doc = await db.collection('admin_accounts').doc(user.uid).get();
      isManagedAccount = doc.exists;
    } catch (err) {
      isManagedAccount = false; // gagal periksa -> aman: perlakukan sebagai akun bawaan (sembunyikan)
    }

    if (isManagedAccount) {
      selfDesc.textContent = `Kamu masuk sebagai ${user.email}. Kamu bisa mengubah password akun ini sendiri di bawah (perlu memasukkan password saat ini).`;
      selfForm.hidden = false;
    } else {
      selfDesc.textContent = 'Akun ini adalah akun bawaan sistem (dibuat langsung lewat Firebase Console saat pengaturan awal). Demi keamanan, ID dan password akun ini sengaja disembunyikan & tidak bisa diubah lewat portal ini — hubungi pemegang akses Firebase Console bila perlu menggantinya.';
      selfForm.hidden = true;
    }

    // ---------- Daftar admin yang ditambahkan lewat portal ini ----------
    if (accountsUnsub) accountsUnsub();
    accountsUnsub = db.collection('admin_accounts').orderBy('created_at', 'desc').onSnapshot((snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (!rows.length) {
        accountsBody.innerHTML = '';
        accountsEmpty.hidden = false;
        return;
      }
      accountsEmpty.hidden = true;
      accountsBody.innerHTML = rows.map((r) => `
        <tr>
          <td>${escapeHtml(r.label || '-')}</td>
          <td>${escapeHtml(r.email)}</td>
          <td>${r.created_at && r.created_at.toDate ? r.created_at.toDate().toLocaleString('id-ID') : '-'}</td>
        </tr>
      `).join('');
    }, () => { accountsBody.innerHTML = ''; accountsEmpty.hidden = false; });
  });

  selfForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    selfError.hidden = true;
    selfSuccess.hidden = true;
    const currentPassword = document.getElementById('selfCurrentPassword').value;
    const newPassword = document.getElementById('selfNewPassword').value;
    if (newPassword.length < 8) {
      selfError.textContent = 'Password baru minimal 8 karakter.';
      selfError.hidden = false;
      return;
    }
    const user = auth.currentUser;
    if (!user) return;
    const btn = selfForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Menyimpan...';
    try {
      const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
      await user.reauthenticateWithCredential(credential);
      await user.updatePassword(newPassword);
      selfSuccess.hidden = false;
      selfForm.reset();
      if (window.SoundFX) window.SoundFX.success();
    } catch (err) {
      selfError.textContent = friendlyAccountAuthError(err);
      selfError.hidden = false;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Ubah Password';
    }
  });

  // ---------- Tambah admin baru (ID + password) ----------
  addForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    addError.hidden = true;
    addSuccess.hidden = true;
    const label = document.getElementById('newAdminLabel').value.trim();
    const email = document.getElementById('newAdminEmail').value.trim();
    const password = document.getElementById('newAdminPassword').value;
    if (password.length < 8) {
      addError.textContent = 'Password minimal 8 karakter.';
      addError.hidden = false;
      return;
    }
    addBtn.disabled = true;
    addBtn.textContent = 'Menambah...';
    try {
      const secondaryAuth = window.getSecondaryAuth();
      const cred = await secondaryAuth.createUserWithEmailAndPassword(email, password);
      const newUid = cred.user.uid;
      // Keluar dari sesi kedua ini supaya tidak menumpuk sesi tak terpakai —
      // sesi admin utama (variabel `auth` di atas) sama sekali tidak
      // terpengaruh karena berjalan di instance Firebase App yang berbeda.
      try { await secondaryAuth.signOut(); } catch (e2) { /* ignore */ }

      await db.collection('admin_accounts').doc(newUid).set({
        email,
        label: label || '',
        created_by: auth.currentUser ? auth.currentUser.uid : null,
        created_at: firebase.firestore.FieldValue.serverTimestamp(),
      });

      addSuccess.textContent = `Akun admin ${email} berhasil ditambahkan. Bagikan email & password ini secara aman kepada yang bersangkutan.`;
      addSuccess.hidden = false;
      addForm.reset();
      if (window.SoundFX) window.SoundFX.success();
    } catch (err) {
      addError.textContent = friendlyAccountAuthError(err);
      addError.hidden = false;
    } finally {
      addBtn.disabled = false;
      addBtn.textContent = 'Tambah Akun';
    }
  });
})();

// ============================================================================
// KELOLA STAF (guru/staf medis yang bisa dipilih peserta untuk hubungi otomatis)
// ============================================================================
(function () {
  const staffForm = document.getElementById('staffForm');
  const staffBody = document.getElementById('staffBody');
  const staffEmptyState = document.getElementById('staffEmptyState');
  const staffNoMatchState = document.getElementById('staffNoMatchState');
  const staffFormError = document.getElementById('staffFormError');
  const staffFormTitle = document.getElementById('staffFormTitle');
  const staffSubmitBtn = document.getElementById('staffSubmitBtn');
  const staffCancelEdit = document.getElementById('staffCancelEdit');
  const staffActiveBadge = document.getElementById('staffActiveBadge');
  const staffSearchInput = document.getElementById('staffSearchInput');
  const nameInput = document.getElementById('staffName');
  const roleInput = document.getElementById('staffRole');
  const whatsappInput = document.getElementById('staffWhatsapp');

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  // Menyeragamkan nomor supaya "0812...", "62812...", dan "+62812..." yang
  // sama tidak dianggap dua nomor berbeda saat memeriksa duplikat.
  function normalizePhone(v) {
    const digits = (v || '').replace(/[^0-9]/g, '');
    return digits.replace(/^0/, '62');
  }

  function showFormError(msg) {
    staffFormError.textContent = msg;
    staffFormError.hidden = false;
  }
  function clearFormError() {
    staffFormError.hidden = true;
    staffFormError.textContent = '';
  }

  let staffRows = [];
  let editingId = null;

  function enterEditMode(s) {
    editingId = s.id;
    nameInput.value = s.name || '';
    roleInput.value = s.role || 'guru';
    whatsappInput.value = s.whatsapp || '';
    staffFormTitle.textContent = `Ubah Data: ${s.name || ''}`;
    staffSubmitBtn.textContent = 'Simpan Perubahan';
    staffCancelEdit.hidden = false;
    clearFormError();
    nameInput.focus();
  }

  function exitEditMode() {
    editingId = null;
    staffForm.reset();
    staffFormTitle.textContent = 'Tambah Guru / Staf Medis';
    staffSubmitBtn.textContent = 'Tambah';
    staffCancelEdit.hidden = true;
    clearFormError();
  }

  staffCancelEdit.addEventListener('click', exitEditMode);

  function renderStaffTable() {
    const q = (staffSearchInput.value || '').trim().toLowerCase();
    const rows = q ? staffRows.filter((s) => (s.name || '').toLowerCase().includes(q)) : staffRows;

    const activeCount = staffRows.filter((s) => s.active).length;
    if (!staffRows.length) {
      staffActiveBadge.className = 'badge badge--muted';
      staffActiveBadge.textContent = 'Belum ada staf';
    } else if (activeCount === 0) {
      staffActiveBadge.className = 'badge badge--alert';
      staffActiveBadge.textContent = 'Tidak ada staf aktif — dropdown peserta akan kosong!';
    } else {
      staffActiveBadge.className = 'badge badge--success';
      staffActiveBadge.textContent = `${activeCount} staf aktif`;
    }

    if (!staffRows.length) {
      staffBody.innerHTML = '';
      staffEmptyState.hidden = false;
      staffNoMatchState.hidden = true;
      return;
    }
    staffEmptyState.hidden = true;

    if (!rows.length) {
      staffBody.innerHTML = '';
      staffNoMatchState.hidden = false;
      return;
    }
    staffNoMatchState.hidden = true;

    staffBody.innerHTML = rows.map((s) => `
      <tr>
        <td>${escapeHtml(s.name)}</td>
        <td>${s.role === 'medis' ? 'Staf Medis' : 'Guru'}</td>
        <td>${escapeHtml(s.whatsapp)}</td>
        <td>${s.active ? '<span class="badge badge--success">Aktif</span>' : '<span class="badge badge--alert">Nonaktif</span>'}</td>
        <td>
          <button class="link-btn" data-edit="${s.id}">Ubah</button>
          &nbsp;·&nbsp;
          <button class="link-btn" data-toggle="${s.id}" data-active="${s.active}">${s.active ? 'Nonaktifkan' : 'Aktifkan'}</button>
          &nbsp;·&nbsp;
          <button class="link-btn" data-del="${s.id}">Hapus</button>
        </td>
      </tr>
    `).join('');

    staffBody.querySelectorAll('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const s = staffRows.find((x) => x.id === btn.dataset.edit);
        if (s) enterEditMode(s);
      });
    });
    staffBody.querySelectorAll('[data-toggle]').forEach((btn) => {
      btn.addEventListener('click', () => {
        db.collection('staff').doc(btn.dataset.toggle).update({ active: btn.dataset.active !== 'true' })
          .catch((err) => showFormError('Gagal mengubah status: ' + (err.message || err)));
      });
    });
    staffBody.querySelectorAll('[data-del]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!confirm('Hapus guru/staf ini dari daftar?')) return;
        if (editingId === btn.dataset.del) exitEditMode();
        db.collection('staff').doc(btn.dataset.del).delete()
          .catch((err) => showFormError('Gagal menghapus: ' + (err.message || err)));
      });
    });
  }

  staffSearchInput.addEventListener('input', renderStaffTable);

  let staffUnsub = null;
  auth.onAuthStateChanged((user) => {
    if (user) {
      staffUnsub = db.collection('staff').orderBy('created_at', 'desc').onSnapshot((snap) => {
        staffRows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        renderStaffTable();
      }, (err) => {
        showFormError('Gagal memuat daftar staf: ' + (err.message || err));
      });
    } else if (staffUnsub) {
      staffUnsub(); staffUnsub = null;
      staffRows = [];
      exitEditMode();
    }
  });

  staffForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFormError();

    const name = nameInput.value.trim();
    const role = roleInput.value;
    const whatsapp = whatsappInput.value.trim();

    if (!name) { showFormError('Nama tidak boleh kosong.'); return; }
    if (!window.SupplyPhase.isValidPhone(whatsapp)) {
      showFormError('Nomor WhatsApp tidak valid. Gunakan format 08xxxxxxxxxx (9–14 digit).');
      return;
    }

    const normalized = normalizePhone(whatsapp);
    const duplicate = staffRows.find((s) => s.id !== editingId && normalizePhone(s.whatsapp) === normalized);
    if (duplicate) {
      showFormError(`Nomor ini sudah terdaftar atas nama ${duplicate.name}.`);
      return;
    }

    staffSubmitBtn.disabled = true;
    staffSubmitBtn.textContent = editingId ? 'Menyimpan...' : 'Menambah...';

    try {
      if (editingId) {
        await db.collection('staff').doc(editingId).update({ name, role, whatsapp });
      } else {
        await db.collection('staff').add({
          name, role, whatsapp, active: true,
          created_at: firebase.firestore.FieldValue.serverTimestamp(),
        });
      }
      exitEditMode();
    } catch (err) {
      showFormError((editingId ? 'Gagal menyimpan perubahan: ' : 'Gagal menambah staf: ') + (err.message || err));
      staffSubmitBtn.disabled = false;
      staffSubmitBtn.textContent = editingId ? 'Simpan Perubahan' : 'Tambah';
    }
  });
})();

// ============================================================================
// JADWAL JENDELA PENGISIAN PERLENGKAPAN & OBAT
// ============================================================================
(function () {
  const settingsRef = db.collection('settings').doc('supplyWindow');
  const els = {
    enabled: document.getElementById('settingsEnabled'),
    dbDate: document.getElementById('dbDate'),
    dbStart: document.getElementById('dbStart'),
    dbEnd: document.getElementById('dbEnd'),
    edDate: document.getElementById('edDate'),
    edStart: document.getElementById('edStart'),
    edEnd: document.getElementById('edEnd'),
    reminderTimes: document.getElementById('reminderTimes'),
    saveBtn: document.getElementById('saveSettingsBtn'),
    savedNote: document.getElementById('settingsSavedNote'),
    updatedAt: document.getElementById('settingsUpdatedAt'),
    error: document.getElementById('settingsError'),
    statusBadge: document.getElementById('supplyStatusBadge'),
  };

  let currentSettings = null;
  let loadedOnce = false;

  function showSettingsError(msg) {
    els.error.textContent = msg;
    els.error.hidden = false;
  }
  function clearSettingsError() {
    els.error.hidden = true;
    els.error.textContent = '';
  }

  function currentFormAsSettings() {
    return {
      enabled: els.enabled.checked,
      dayBefore: { date: els.dbDate.value, start: els.dbStart.value, end: els.dbEnd.value },
      eventDay: { date: els.edDate.value, start: els.edStart.value, end: els.edEnd.value },
      reminderTimes: els.reminderTimes.value.split(',').map((s) => s.trim()).filter(Boolean),
    };
  }

  function badgeClassForPhase(phase) {
    if (phase === 'open') return 'badge badge--success';
    if (phase === 'locked') return 'badge badge--warn';
    if (phase === 'closed') return 'badge badge--muted';
    return 'badge badge--muted';
  }

  // Menampilkan status jendela SAAT INI berdasarkan apa yang sedang diketik
  // di formulir (belum tentu sudah disimpan) supaya admin bisa melihat efek
  // pengaturannya sebelum menekan "Simpan Jadwal".
  function refreshStatusBadge() {
    const phase = window.SupplyPhase.getPhase(currentFormAsSettings());
    els.statusBadge.className = badgeClassForPhase(phase);
    els.statusBadge.textContent = window.SupplyPhase.PHASE_LABELS[phase] || phase;
  }

  Object.values(els).forEach((el) => {
    if (el && el.tagName && ['INPUT'].includes(el.tagName)) {
      el.addEventListener('input', refreshStatusBadge);
      el.addEventListener('change', refreshStatusBadge);
    }
  });
  setInterval(refreshStatusBadge, 30000);

  auth.onAuthStateChanged((user) => {
    if (!user || loadedOnce) return;
    loadedOnce = true;
    settingsRef.get().then((doc) => {
      if (doc.exists) {
        const d = doc.data();
        currentSettings = d;
        els.enabled.checked = !!d.enabled;
        if (d.dayBefore) { els.dbDate.value = d.dayBefore.date || ''; els.dbStart.value = d.dayBefore.start || ''; els.dbEnd.value = d.dayBefore.end || ''; }
        if (d.eventDay) { els.edDate.value = d.eventDay.date || ''; els.edStart.value = d.eventDay.start || ''; els.edEnd.value = d.eventDay.end || ''; }
        els.reminderTimes.value = (d.reminderTimes || []).join(', ');
        if (d.updated_at && d.updated_at.toDate) {
          els.updatedAt.hidden = false;
          els.updatedAt.textContent = `Terakhir disimpan: ${d.updated_at.toDate().toLocaleString('id-ID')}`;
        }
      }
      refreshStatusBadge();
    }).catch((err) => showSettingsError('Gagal memuat jadwal tersimpan: ' + (err.message || err)));
  });

  function validateSettingsForm() {
    const reminderTimes = els.reminderTimes.value.split(',').map((s) => s.trim()).filter(Boolean);
    for (const t of reminderTimes) {
      if (!window.SupplyPhase.isValidTimeString(t)) {
        return `Jam pengingat "${t}" tidak valid. Gunakan format HH:mm, contoh 08:00.`;
      }
    }

    if (!els.enabled.checked) return null; // tidak perlu validasi tanggal/jam jika pembatasan dimatikan

    if (!els.dbDate.value || !els.dbStart.value || !els.dbEnd.value) {
      return 'Tanggal & jam jendela H-1 wajib diisi lengkap saat pembatasan diaktifkan.';
    }
    if (!els.edDate.value || !els.edStart.value || !els.edEnd.value) {
      return 'Tanggal & jam jendela Hari-H wajib diisi lengkap saat pembatasan diaktifkan.';
    }
    const dbStart = window.SupplyPhase.parseLocal(els.dbDate.value, els.dbStart.value);
    const dbEnd = window.SupplyPhase.parseLocal(els.dbDate.value, els.dbEnd.value);
    const edStart = window.SupplyPhase.parseLocal(els.edDate.value, els.edStart.value);
    const edEnd = window.SupplyPhase.parseLocal(els.edDate.value, els.edEnd.value);
    if (dbStart && dbEnd && dbStart >= dbEnd) {
      return 'Jam mulai H-1 harus lebih awal dari jam selesai H-1.';
    }
    if (edStart && edEnd && edStart >= edEnd) {
      return 'Jam mulai Hari-H harus lebih awal dari jam selesai Hari-H.';
    }
    if (dbEnd && edStart && dbEnd > edStart) {
      return 'Jendela Hari-H sebaiknya dimulai setelah jendela H-1 selesai.';
    }
    return null;
  }

  els.saveBtn.addEventListener('click', async () => {
    clearSettingsError();
    const errorMsg = validateSettingsForm();
    if (errorMsg) { showSettingsError(errorMsg); return; }

    const payload = currentFormAsSettings();
    els.saveBtn.disabled = true;
    els.saveBtn.textContent = 'Menyimpan...';
    try {
      await settingsRef.set({
        ...payload,
        updated_at: firebase.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      currentSettings = payload;
      els.savedNote.hidden = false;
      els.updatedAt.hidden = false;
      els.updatedAt.textContent = `Terakhir disimpan: ${new Date().toLocaleString('id-ID')}`;
      refreshStatusBadge();
      setTimeout(() => { els.savedNote.hidden = true; }, 2500);
    } catch (err) {
      showSettingsError('Gagal menyimpan jadwal: ' + (err.message || err));
    } finally {
      els.saveBtn.disabled = false;
      els.saveBtn.textContent = 'Simpan Jadwal';
    }
  });
})();


// ============================================================================
// PERINGATAN OTOMATIS UNTUK GURU/STAF MEDIS SAAT DATA BARU / BERISIKO MASUK
// (bekerja selama panel admin sedang dibuka — notifikasi browser real-time)
// ============================================================================
(function () {
  let knownIds = null; // null = belum diinisialisasi (data lama, jangan dinotifikasi)
  let unsub = null;

  if (window.Notification && Notification.permission === 'default') {
    document.addEventListener('click', function requestOnce() {
      try { Notification.requestPermission(); } catch (e) { /* ignore */ }
      document.removeEventListener('click', requestOnce);
    }, { once: true });
  }

  function flagSummary(r) {
    const flags = [];
    if (r.has_drug_allergy === 'yes') flags.push('alergi obat');
    if (r.has_food_allergy === 'yes') flags.push('alergi makanan');
    if (r.has_other_allergy === 'yes') flags.push('alergi lain');
    if (r.has_personal_issue === 'yes') flags.push('masalah pribadi');
    if (r.medical_attention_plan && r.medical_attention_plan.priority === 'Prioritas Tinggi') {
      flags.push('rencana penanganan: PRIORITAS TINGGI');
    }
    return flags;
  }

  auth.onAuthStateChanged((user) => {
    if (user) {
      unsub = db.collection('participants').orderBy('submitted_at', 'desc').limit(20)
        .onSnapshot((snap) => {
          if (knownIds === null) {
            knownIds = new Set(snap.docs.map((d) => d.id));
            return; // jangan notifikasi untuk data yang sudah ada sebelum dashboard dibuka
          }
          snap.docChanges().forEach((change) => {
            if (change.type !== 'added') return;
            if (knownIds.has(change.doc.id)) return;
            knownIds.add(change.doc.id);
            const r = change.doc.data();
            const flags = flagSummary(r);
            const body = flags.length
              ? `${r.full_name} (${r.class}) — perlu perhatian: ${flags.join(', ')}.`
              : `${r.full_name} (${r.class}) baru saja mengisi data.`;
            if (window.Notification && Notification.permission === 'granted') {
              try { new Notification('Data peserta baru masuk', { body }); } catch (e) { /* ignore */ }
            }
            if (window.SoundFX) window.SoundFX.notify();
            const row = staffOrRecordRow(change.doc.id);
            if (row) row.classList.add('is-new');
          });
        });
    } else if (unsub) {
      unsub(); unsub = null; knownIds = null;
    }
  });

  function staffOrRecordRow(id) {
    const btn = document.querySelector(`#recordsBody .link-btn[data-id="${id}"]`);
    return btn ? btn.closest('tr') : null;
  }
})();
