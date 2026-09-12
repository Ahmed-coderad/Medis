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

    modalBody.innerHTML = `
      <div class="detail-section">
        <h4>Data Diri</h4>
        ${detailRow('Kelas', r.class)}
        ${detailRow('Jurusan', r.major)}
        ${detailRow('Peran', r.role)}
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
        <h4>Obat yang dibawa</h4>
        ${meds.length ? meds.map((m) => detailRow(m.name, `${m.dosage || '-'} · ${m.schedule || '-'}`)).join('') : '<p class="contact-note">Tidak membawa obat.</p>'}
      </div>
      <div class="detail-section">
        <h4>Perlengkapan</h4>
        ${detailRow('Ibadah', prayerGear.join(', ') || '-')}
        ${detailRow('Diisi pada', r.prayer_gear_timing || '-')}
        ${detailRow('Mandi', toiletries.join(', ') || '-')}
        ${detailRow('Diisi pada', r.toiletries_timing || '-')}
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

    y = ensureSpace(doc, y, 60);
    y = sectionTitle(doc, y, 'Obat-obatan yang Dibawa');
    const meds = Array.isArray(p.medications) ? p.medications : [];
    if (!meds.length) {
      y = field(doc, y, 'Status', 'Tidak membawa obat-obatan khusus.');
    } else {
      meds.forEach((m, i) => {
        y = ensureSpace(doc, y, 30);
        y = field(doc, y, `Obat ${i + 1}`, `${m.name || '-'}  |  Dosis: ${m.dosage || '-'}  |  Jadwal: ${m.schedule || '-'}`);
      });
    }

    y = ensureSpace(doc, y, 80);
    y = sectionTitle(doc, y, 'Perlengkapan Ibadah & Mandi');
    y = field(doc, y, `Ibadah (diisi ${p.prayer_gear_timing || 'belum ditentukan'})`, (p.prayer_gear || []).join(', ') || '-');
    y = field(doc, y, `Mandi (diisi ${p.toiletries_timing || 'belum ditentukan'})`, (p.toiletries || []).join(', ') || '-');

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
      'has_personal_issue', 'supplies_skipped',
    ];
    const escape = (v) => `"${String(v === undefined || v === null ? '' : v).replace(/"/g, '""')}"`;
    const lines = [headers.join(',')];
    records.forEach((r) => lines.push(headers.map((h) => escape(r[h])).join(',')));
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
    });
  });
})();

// ============================================================================
// KELOLA STAF (guru/staf medis yang bisa dipilih peserta untuk hubungi otomatis)
// ============================================================================
(function () {
  const staffForm = document.getElementById('staffForm');
  const staffBody = document.getElementById('staffBody');
  const staffEmptyState = document.getElementById('staffEmptyState');

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  let staffUnsub = null;
  auth.onAuthStateChanged((user) => {
    if (user) {
      staffUnsub = db.collection('staff').orderBy('created_at', 'desc').onSnapshot((snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (!rows.length) {
          staffBody.innerHTML = '';
          staffEmptyState.hidden = false;
          return;
        }
        staffEmptyState.hidden = true;
        staffBody.innerHTML = rows.map((s) => `
          <tr>
            <td>${escapeHtml(s.name)}</td>
            <td>${s.role === 'medis' ? 'Staf Medis' : 'Guru'}</td>
            <td>${escapeHtml(s.whatsapp)}</td>
            <td>${s.active ? '<span class="badge badge--muted">Aktif</span>' : '<span class="badge badge--alert">Nonaktif</span>'}</td>
            <td>
              <button class="link-btn" data-toggle="${s.id}" data-active="${s.active}">${s.active ? 'Nonaktifkan' : 'Aktifkan'}</button>
              &nbsp;·&nbsp;
              <button class="link-btn" data-del="${s.id}">Hapus</button>
            </td>
          </tr>
        `).join('');

        staffBody.querySelectorAll('[data-toggle]').forEach((btn) => {
          btn.addEventListener('click', () => {
            db.collection('staff').doc(btn.dataset.toggle).update({ active: btn.dataset.active !== 'true' });
          });
        });
        staffBody.querySelectorAll('[data-del]').forEach((btn) => {
          btn.addEventListener('click', () => {
            if (confirm('Hapus guru/staf ini dari daftar?')) db.collection('staff').doc(btn.dataset.del).delete();
          });
        });
      });
    } else if (staffUnsub) {
      staffUnsub(); staffUnsub = null;
    }
  });

  staffForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('staffName').value.trim();
    const role = document.getElementById('staffRole').value;
    const whatsapp = document.getElementById('staffWhatsapp').value.trim();
    if (!name || !whatsapp) return;
    await db.collection('staff').add({
      name, role, whatsapp, active: true,
      created_at: firebase.firestore.FieldValue.serverTimestamp(),
    });
    staffForm.reset();
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
  };

  auth.onAuthStateChanged((user) => {
    if (!user) return;
    settingsRef.get().then((doc) => {
      if (!doc.exists) return;
      const d = doc.data();
      els.enabled.checked = !!d.enabled;
      if (d.dayBefore) { els.dbDate.value = d.dayBefore.date || ''; els.dbStart.value = d.dayBefore.start || ''; els.dbEnd.value = d.dayBefore.end || ''; }
      if (d.eventDay) { els.edDate.value = d.eventDay.date || ''; els.edStart.value = d.eventDay.start || ''; els.edEnd.value = d.eventDay.end || ''; }
      els.reminderTimes.value = (d.reminderTimes || []).join(', ');
    });
  });

  els.saveBtn.addEventListener('click', async () => {
    const reminderTimes = els.reminderTimes.value.split(',').map((s) => s.trim()).filter(Boolean);
    await settingsRef.set({
      enabled: els.enabled.checked,
      dayBefore: { date: els.dbDate.value, start: els.dbStart.value, end: els.dbEnd.value },
      eventDay: { date: els.edDate.value, start: els.edStart.value, end: els.edEnd.value },
      reminderTimes,
      updated_at: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    els.savedNote.hidden = false;
    setTimeout(() => { els.savedNote.hidden = true; }, 2500);
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
