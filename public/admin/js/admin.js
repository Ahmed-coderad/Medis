(function () {
  const statsGrid = document.getElementById('statsGrid');
  const recordsBody = document.getElementById('recordsBody');
  const emptyState = document.getElementById('emptyState');
  const searchInput = document.getElementById('searchInput');
  const roleFilter = document.getElementById('roleFilter');
  const allergyFilter = document.getElementById('allergyFilter');

  const detailModal = document.getElementById('detailModal');
  const modalBody = document.getElementById('modalBody');
  const modalTitle = document.getElementById('modalTitle');
  const pdfLink = document.getElementById('pdfLink');
  const deleteBtn = document.getElementById('deleteBtn');
  const contactBtn = document.getElementById('contactBtn');

  const contactModal = document.getElementById('contactModal');
  const contactModalBody = document.getElementById('contactModalBody');

  let currentRecordId = null;
  let debounceTimer = null;

  async function checkSession() {
    const res = await fetch('/admin/api/session');
    const data = await res.json();
    if (!data.loggedIn) {
      window.location.href = '/admin';
      return;
    }
    document.getElementById('adminName').textContent = data.name || '';
  }

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await fetch('/admin/api/logout', { method: 'POST' });
    window.location.href = '/admin';
  });

  function yesNoBadge(value, label) {
    if (value === 'yes') return `<span class="badge badge--alert">${label}</span>`;
    return '';
  }

  async function loadStats() {
    const res = await fetch('/admin/api/stats');
    const data = await res.json();
    statsGrid.innerHTML = `
      <div class="stat-card">
        <div class="stat-card__value">${data.total}</div>
        <div class="stat-card__label">Total peserta terdata</div>
      </div>
      <div class="stat-card stat-card--alert">
        <div class="stat-card__value">${data.drugAllergy}</div>
        <div class="stat-card__label">Alergi obat</div>
      </div>
      <div class="stat-card stat-card--alert">
        <div class="stat-card__value">${data.anyAllergy}</div>
        <div class="stat-card__label">Punya alergi apapun</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__value">${data.personalIssue}</div>
        <div class="stat-card__label">Menandai masalah pribadi</div>
      </div>
    `;
  }

  async function loadRecords() {
    const params = new URLSearchParams();
    if (searchInput.value) params.set('q', searchInput.value);
    if (roleFilter.value) params.set('role', roleFilter.value);
    if (allergyFilter.value) params.set('allergy', allergyFilter.value);

    const res = await fetch(`/admin/api/records?${params.toString()}`);
    const data = await res.json();
    renderTable(data.records);
  }

  function renderTable(records) {
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

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function detailRow(label, value, alertMode = false) {
    return `<div class="detail-row"><span class="detail-row__label">${label}</span><span class="detail-row__value ${alertMode ? 'detail-row__value--alert' : ''}">${escapeHtml(value)}</span></div>`;
  }

  async function openDetail(id) {
    currentRecordId = id;
    const res = await fetch(`/admin/api/records/${id}`);
    const { record: r } = await res.json();

    modalTitle.textContent = r.full_name;
    pdfLink.href = `/admin/api/records/${id}/pdf`;

    let meds = [];
    try { meds = JSON.parse(r.medications) || []; } catch (e) { meds = []; }
    let prayerGear = [];
    try { prayerGear = JSON.parse(r.prayer_gear) || []; } catch (e) { prayerGear = []; }
    let toiletries = [];
    try { toiletries = JSON.parse(r.toiletries) || []; } catch (e) { toiletries = []; }

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
        ${r.has_personal_issue === 'yes' && r.wants_to_explain === 'no' ? '<p class="contact-note">Peserta diarahkan untuk menghubungi Bapak Rizky Ahmed Darmawan, S.M.</p>' : ''}
      </div>
    `;

    detailModal.hidden = false;
  }

  document.getElementById('modalClose').addEventListener('click', () => { detailModal.hidden = true; });
  document.getElementById('modalBackdrop').addEventListener('click', () => { detailModal.hidden = true; });

  deleteBtn.addEventListener('click', async () => {
    if (!currentRecordId) return;
    if (!confirm('Hapus data peserta ini secara permanen?')) return;
    await fetch(`/admin/api/records/${currentRecordId}`, { method: 'DELETE' });
    detailModal.hidden = true;
    loadRecords();
    loadStats();
  });

  contactBtn.addEventListener('click', async () => {
    if (!currentRecordId) return;
    const res = await fetch(`/admin/api/records/${currentRecordId}/contact-links`);
    const data = await res.json();

    contactModalBody.innerHTML = `
      ${data.guardian_whatsapp ? `
        <div class="contact-option">
          <div class="contact-option__label"><strong>WhatsApp orang tua/wali</strong>Buka percakapan otomatis</div>
          <a class="btn btn--primary btn--small" href="${data.guardian_whatsapp}" target="_blank">Buka</a>
        </div>` : ''}
      ${data.guardian_alt_whatsapp ? `
        <div class="contact-option">
          <div class="contact-option__label"><strong>WhatsApp (alternatif)</strong>Buka percakapan otomatis</div>
          <a class="btn btn--primary btn--small" href="${data.guardian_alt_whatsapp}" target="_blank">Buka</a>
        </div>` : ''}
      ${data.participant_whatsapp ? `
        <div class="contact-option">
          <div class="contact-option__label"><strong>WhatsApp peserta</strong>Buka percakapan otomatis</div>
          <a class="btn btn--primary btn--small" href="${data.participant_whatsapp}" target="_blank">Buka</a>
        </div>` : ''}
      ${data.participant_email ? `
        <div class="contact-option">
          <div class="contact-option__label"><strong>Email peserta</strong>Kirim email otomatis dari server</div>
          <button class="btn btn--ghost btn--small" id="sendEmailBtn">Kirim</button>
        </div>` : ''}
      <p class="contact-note">Tautan WhatsApp membuka percakapan berisi pesan otomatis yang bisa kamu edit sebelum dikirim. Pengiriman email memerlukan konfigurasi SMTP pada server (lihat berkas .env).</p>
    `;

    const emailBtn = document.getElementById('sendEmailBtn');
    if (emailBtn) {
      emailBtn.addEventListener('click', async () => {
        emailBtn.disabled = true;
        emailBtn.textContent = 'Mengirim...';
        try {
          const r = await fetch(`/admin/api/records/${currentRecordId}/email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subject: 'Informasi kegiatan',
              message: 'Mohon konfirmasi data kesehatan Anda kepada panitia.',
            }),
          });
          const result = await r.json();
          if (!r.ok) throw new Error(result.error);
          alert('Email berhasil dikirim.');
        } catch (err) {
          alert(err.message || 'Gagal mengirim email.');
        } finally {
          emailBtn.disabled = false;
          emailBtn.textContent = 'Kirim';
        }
      });
    }

    contactModal.hidden = false;
  });

  document.getElementById('contactModalClose').addEventListener('click', () => { contactModal.hidden = true; });
  document.getElementById('contactBackdrop').addEventListener('click', () => { contactModal.hidden = true; });

  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(loadRecords, 300);
  });
  roleFilter.addEventListener('change', loadRecords);
  allergyFilter.addEventListener('change', loadRecords);

  checkSession().then(() => {
    loadStats();
    loadRecords();
  });
})();
