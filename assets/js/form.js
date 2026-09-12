(function () {
  // ==========================================================================
  // Util
  // ==========================================================================
  function toWaLink(phone, message) {
    const digits = (phone || '').replace(/[^0-9]/g, '').replace(/^0/, '62');
    if (!digits) return null;
    const text = encodeURIComponent(message || '');
    return `https://wa.me/${digits}${text ? `?text=${text}` : ''}`;
  }

  function genToken() {
    return 'tok_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 12);
  }

  function pad(n) { return String(n).padStart(2, '0'); }
  function fmtDateTime(d) {
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  const LS_KEY = 'medcheck_participant';
  function loadLocalRecord() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch (e) { return null; }
  }
  function saveLocalRecord(rec) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(rec)); } catch (e) { /* ignore */ }
  }

  document.getElementById('year').textContent = new Date().getFullYear();

  // ==========================================================================
  // STAFF DIRECTORY (guru/staf medis yang bisa dipilih peserta)
  // ==========================================================================
  let staffList = [];
  let selectedStaff = null;

  function populateStaffSelect() {
    const sel = document.getElementById('target_staff');
    if (!staffList.length) {
      sel.innerHTML = '<option value="" disabled selected>Belum ada guru/staf terdaftar</option>';
      return;
    }
    sel.innerHTML = '<option value="" disabled selected>Pilih guru / staf medis</option>' +
      staffList.map((s) => `<option value="${s.id}">${s.name} (${s.role === 'medis' ? 'Staf Medis' : 'Guru'})</option>`).join('');
    sel.addEventListener('change', () => {
      selectedStaff = staffList.find((s) => s.id === sel.value) || null;
      updateTeacherNote();
    });
  }

  function updateTeacherNote() {
    const nameLabel = document.getElementById('teacherNameLabel');
    const waLink = document.getElementById('teacherWaLink');
    if (selectedStaff) {
      nameLabel.textContent = selectedStaff.name;
      waLink.href = toWaLink(selectedStaff.whatsapp, `Assalamu'alaikum ${selectedStaff.name}, saya ingin bercerita tentang sesuatu yang sedang saya alami.`) || '#';
    }
  }

  function loadStaff() {
    return db.collection('staff').where('active', '==', true).get()
      .then((snap) => {
        staffList = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        populateStaffSelect();
      })
      .catch((err) => {
        console.error('Gagal memuat daftar staf:', err);
        document.getElementById('target_staff').innerHTML = '<option value="" disabled selected>Gagal memuat daftar</option>';
      });
  }

  // ==========================================================================
  // TYPEWRITER PLACEHOLDER — "Office Management and Business Services / Office
  // Automation and Governance" berputar otomatis pada field jurusan.
  // ==========================================================================
  function wireTypewriterPlaceholder(inputId, phrases, opts = {}) {
    const el = document.getElementById(inputId);
    if (!el) return;
    const typeSpeed = opts.typeSpeed || 45;
    const holdMs = opts.holdMs || 1400;
    const deleteSpeed = opts.deleteSpeed || 25;
    let phraseIndex = 0;
    let charIndex = 0;
    let deleting = false;
    let timer = null;

    function tick() {
      if (el.value) { el.placeholder = phrases[phraseIndex]; return; } // user is typing, stop animating
      const phrase = phrases[phraseIndex];
      if (!deleting) {
        charIndex += 1;
        el.placeholder = phrase.slice(0, charIndex);
        if (charIndex >= phrase.length) {
          deleting = true;
          timer = setTimeout(tick, holdMs);
          return;
        }
        timer = setTimeout(tick, typeSpeed);
      } else {
        charIndex -= 1;
        el.placeholder = phrase.slice(0, charIndex);
        if (charIndex <= 0) {
          deleting = false;
          phraseIndex = (phraseIndex + 1) % phrases.length;
          timer = setTimeout(tick, 300);
          return;
        }
        timer = setTimeout(tick, deleteSpeed);
      }
    }
    tick();
    el.addEventListener('focus', () => { if (!el.value) { clearTimeout(timer); el.placeholder = phrases[phraseIndex]; } });
    el.addEventListener('blur', () => { if (!el.value) tick(); });
  }

  wireTypewriterPlaceholder('major', [
    'Office Management and Business Services',
    'Office Automation and Governance',
  ]);

  // ==========================================================================
  // JENDELA WAKTU PERLENGKAPAN & OBAT (diatur guru/staf medis lewat panel admin)
  // ==========================================================================
  let supplySettings = null;

  function parseLocal(dateStr, timeStr) {
    if (!dateStr || !timeStr) return null;
    const [y, m, d] = dateStr.split('-').map(Number);
    const [hh, mm] = timeStr.split(':').map(Number);
    return new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0);
  }

  // Mengembalikan: 'locked' | 'open' | 'closed' | 'unset'
  function getSupplyPhase(now) {
    now = now || new Date();
    if (!supplySettings || !supplySettings.enabled) return 'unset';
    const dbStart = parseLocal(supplySettings.dayBefore && supplySettings.dayBefore.date, supplySettings.dayBefore && supplySettings.dayBefore.start);
    const dbEnd = parseLocal(supplySettings.dayBefore && supplySettings.dayBefore.date, supplySettings.dayBefore && supplySettings.dayBefore.end);
    const edStart = parseLocal(supplySettings.eventDay && supplySettings.eventDay.date, supplySettings.eventDay && supplySettings.eventDay.start);
    const edEnd = parseLocal(supplySettings.eventDay && supplySettings.eventDay.date, supplySettings.eventDay && supplySettings.eventDay.end);
    if (!dbStart || !edEnd) return 'unset';
    if (now < dbStart) return 'locked';
    if ((dbEnd && now <= dbEnd) || (edStart && edEnd && now >= edStart && now <= edEnd)) return 'open';
    if (now > edEnd) return 'closed';
    return 'locked'; // di antara dua jendela (H-1 sudah lewat, hari-H belum mulai)
  }

  function nextOpenLabel() {
    if (!supplySettings) return '';
    const dbStart = parseLocal(supplySettings.dayBefore && supplySettings.dayBefore.date, supplySettings.dayBefore && supplySettings.dayBefore.start);
    const edStart = parseLocal(supplySettings.eventDay && supplySettings.eventDay.date, supplySettings.eventDay && supplySettings.eventDay.start);
    const now = new Date();
    const target = (dbStart && now < dbStart) ? dbStart : edStart;
    return target ? fmtDateTime(target) : '-';
  }

  function loadSupplySettings() {
    return db.collection('settings').doc('supplyWindow').get()
      .then((doc) => { supplySettings = doc.exists ? doc.data() : null; })
      .catch((err) => { console.error('Gagal memuat jadwal perlengkapan:', err); supplySettings = null; });
  }

  function setSupplyFieldsDisabled(disabled) {
    const wrap = document.getElementById('supplyFieldsWrap');
    wrap.querySelectorAll('input, textarea, select, button').forEach((el) => { el.disabled = disabled; });
  }

  function renderSupplyWindowBanner() {
    const banner = document.getElementById('supplyWindowBanner');
    const wrap = document.getElementById('supplyFieldsWrap');
    const phase = getSupplyPhase();
    banner.hidden = false;
    wrap.classList.remove('is-locked');
    setSupplyFieldsDisabled(false);

    if (phase === 'unset') {
      banner.hidden = true;
      return phase;
    }
    if (phase === 'locked') {
      banner.className = 'window-banner window-banner--locked';
      banner.textContent = `Bagian ini belum dibuka. Kamu boleh lewati dulu — sistem akan mengingatkanmu otomatis mulai ${nextOpenLabel()}.`;
      wrap.classList.add('is-locked');
      setSupplyFieldsDisabled(true);
    } else if (phase === 'open') {
      banner.className = 'window-banner window-banner--open';
      banner.textContent = 'Jendela pengisian sedang dibuka sekarang — silakan lengkapi.';
    } else {
      banner.className = 'window-banner window-banner--closed';
      banner.textContent = 'Jendela waktu yang ditentukan sudah lewat, tapi kamu tetap boleh mengisi jika perlu.';
    }
    return phase;
  }

  // ==========================================================================
  // WIZARD (langkah 1-6)
  // ==========================================================================
  const form = document.getElementById('regForm');
  const steps = Array.from(document.querySelectorAll('.step'));
  const stepNames = ['Data Diri', 'Kontak', 'Kondisi Kesehatan', 'Perlengkapan', 'Kesejahteraan', 'Periksa Kembali'];
  let current = 0;
  let medCount = 0;

  const progressFill = document.getElementById('progressFill');
  const progressLabel = document.getElementById('progressLabel');
  const btnBack = document.getElementById('btnBack');
  const btnNext = document.getElementById('btnNext');
  const btnSubmit = document.getElementById('btnSubmit');
  const successBox = document.getElementById('successBox');

  function showStep(index) {
    steps.forEach((s, i) => { s.hidden = i !== index; });
    progressFill.style.width = `${((index + 1) / steps.length) * 100}%`;
    progressLabel.textContent = `Langkah ${index + 1} dari ${steps.length} — ${stepNames[index]}`;
    btnBack.disabled = index === 0;
    btnNext.hidden = index === steps.length - 1;
    btnSubmit.hidden = index !== steps.length - 1;
    if (steps[index].dataset.step === '4') renderSupplyWindowBanner();
    if (index === steps.length - 1) buildReview();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function isValidPhone(value) {
    const digits = (value || '').replace(/[^0-9]/g, '');
    return digits.length >= 9 && digits.length <= 14;
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((value || '').trim());
  }

  function validateStep(index) {
    const step = steps[index];
    const requiredFields = step.querySelectorAll('[required]');
    let valid = true;
    requiredFields.forEach((el) => {
      const fieldWrap = el.closest('.field') || el;
      const value = (el.value || '').trim();
      if (!value) {
        valid = false;
        fieldWrap.classList && fieldWrap.classList.add('has-error');
      } else {
        fieldWrap.classList && fieldWrap.classList.remove('has-error');
      }
    });

    if (index === 1) {
      ['participant_phone', 'guardian_phone', 'guardian_alt_phone'].forEach((id) => {
        const el = document.getElementById(id);
        const fieldWrap = el.closest('.field') || el;
        if (el.value.trim() && !isValidPhone(el.value)) {
          valid = false;
          fieldWrap.classList.add('has-error');
        }
      });
      const emailEl = document.getElementById('participant_email');
      if (emailEl.value.trim() && !isValidEmail(emailEl.value)) {
        valid = false;
        (emailEl.closest('.field') || emailEl).classList.add('has-error');
      }
    }

    if (index === 2) {
      if (document.querySelector('input[name="has_drug_allergy"]:checked').value === 'yes') {
        const detail = form.drug_allergy_detail.value.trim();
        if (!detail) valid = false;
      }
      if (document.querySelector('input[name="has_food_allergy"]:checked').value === 'yes') {
        const detail = form.food_allergy_detail.value.trim();
        if (!detail) valid = false;
      }
      if (document.querySelector('input[name="has_other_allergy"]:checked').value === 'yes') {
        const detail = form.other_allergy_detail.value.trim();
        if (!detail) valid = false;
      }
    }

    if (index === 4) {
      const hasIssue = document.querySelector('input[name="has_personal_issue"]:checked').value;
      if (hasIssue === 'yes') {
        const wantsExplain = document.querySelector('input[name="wants_to_explain"]:checked');
        if (!wantsExplain) valid = false;
        else if (wantsExplain.value === 'yes' && !document.getElementById('issue_detail').value.trim()) {
          valid = false;
        }
      }
    }

    if (!valid) {
      alert('Mohon lengkapi bagian yang wajib diisi dengan benar sebelum melanjutkan (periksa juga format nomor HP dan email).');
    }
    return valid;
  }

  btnNext.addEventListener('click', () => {
    if (!validateStep(current)) return;
    current += 1;
    showStep(current);
  });

  btnBack.addEventListener('click', () => {
    current = Math.max(0, current - 1);
    showStep(current);
  });

  // ---------- Conditional reveals ----------
  function wireYesNoReveal(radioName, revealId, showOnValue = 'yes') {
    const radios = document.querySelectorAll(`input[name="${radioName}"]`);
    const revealEl = document.getElementById(revealId);
    radios.forEach((r) => {
      r.addEventListener('change', () => {
        if (r.checked) revealEl.hidden = r.value !== showOnValue;
      });
    });
  }
  wireYesNoReveal('has_drug_allergy', 'reveal_drug_allergy');
  wireYesNoReveal('has_food_allergy', 'reveal_food_allergy');
  wireYesNoReveal('has_other_allergy', 'reveal_other_allergy');

  // Personal issue flow
  const issueFollowup = document.getElementById('issueFollowup');
  const issueDetailBox = document.getElementById('issueDetailBox');
  const issueTeacherNote = document.getElementById('issueTeacherNote');

  document.querySelectorAll('input[name="has_personal_issue"]').forEach((r) => {
    r.addEventListener('change', () => {
      issueFollowup.hidden = r.value !== 'yes';
      if (r.value !== 'yes') {
        issueDetailBox.hidden = true;
        issueTeacherNote.hidden = true;
        document.querySelectorAll('input[name="wants_to_explain"]').forEach((x) => { x.checked = false; });
      }
    });
  });

  document.querySelectorAll('input[name="wants_to_explain"]').forEach((r) => {
    r.addEventListener('change', () => {
      issueDetailBox.hidden = r.value !== 'yes';
      issueTeacherNote.hidden = r.value !== 'no';
    });
  });

  // ---------- Medication rows (step 3, formulir utama) ----------
  const medList = document.getElementById('medList');
  document.getElementById('addMedBtn').addEventListener('click', () => addMedRow(medList, () => { medCount += 1; return medCount; }));

  function addMedRow(container, nextId) {
    const id = nextId();
    const row = document.createElement('div');
    row.className = 'med-row';
    row.dataset.id = id;
    row.innerHTML = `
      <input type="text" placeholder="Nama obat" data-field="name" />
      <input type="text" placeholder="Dosis (contoh: 500mg)" data-field="dosage" />
      <input type="text" placeholder="Jadwal (contoh: 2x sehari)" data-field="schedule" />
      <button type="button" class="btn-remove" aria-label="Hapus obat">✕</button>
    `;
    row.querySelector('.btn-remove').addEventListener('click', () => row.remove());
    container.appendChild(row);
    return row;
  }

  function collectMeds(container) {
    return Array.from(container.querySelectorAll('.med-row')).map((row) => ({
      name: row.querySelector('[data-field="name"]').value.trim(),
      dosage: row.querySelector('[data-field="dosage"]').value.trim(),
      schedule: row.querySelector('[data-field="schedule"]').value.trim(),
    })).filter((m) => m.name || m.dosage || m.schedule);
  }

  // ---------- Checklist "other" handling ----------
  function collectChecklist(name, otherInputId) {
    const values = Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map((el) => el.value);
    const otherVal = document.getElementById(otherInputId).value.trim();
    if (otherVal) values.push(otherVal);
    return values;
  }

  // ---------- Data collection ----------
  function collectData() {
    const fd = new FormData(form);
    const phase = getSupplyPhase();
    const suppliesSkipped = phase === 'locked';
    return {
      full_name: (fd.get('full_name') || '').trim(),
      class: (fd.get('class') || '').trim(),
      major: (fd.get('major') || '').trim(),
      role: fd.get('role') || '',
      participant_phone: (fd.get('participant_phone') || '').trim(),
      participant_email: (fd.get('participant_email') || '').trim(),
      guardian_name: (fd.get('guardian_name') || '').trim(),
      guardian_relation: fd.get('guardian_relation') || '',
      guardian_phone: (fd.get('guardian_phone') || '').trim(),
      guardian_alt_phone: (fd.get('guardian_alt_phone') || '').trim(),
      target_staff_id: selectedStaff ? selectedStaff.id : (fd.get('target_staff') || ''),
      target_staff_name: selectedStaff ? selectedStaff.name : '',
      target_staff_whatsapp: selectedStaff ? selectedStaff.whatsapp : '',
      medical_conditions: fd.get('medical_conditions') || '',
      has_drug_allergy: fd.get('has_drug_allergy') || 'no',
      drug_allergy_detail: fd.get('drug_allergy_detail') || '',
      has_food_allergy: fd.get('has_food_allergy') || 'no',
      food_allergy_detail: fd.get('food_allergy_detail') || '',
      has_other_allergy: fd.get('has_other_allergy') || 'no',
      other_allergy_detail: fd.get('other_allergy_detail') || '',
      medications: suppliesSkipped ? [] : collectMeds(medList),
      prayer_gear: suppliesSkipped ? [] : collectChecklist('prayer_gear', 'prayerGearOther'),
      prayer_gear_timing: suppliesSkipped ? '' : (fd.get('prayer_gear_timing') || ''),
      toiletries: suppliesSkipped ? [] : collectChecklist('toiletries', 'toiletriesOther'),
      toiletries_timing: suppliesSkipped ? '' : (fd.get('toiletries_timing') || ''),
      supplies_skipped: suppliesSkipped,
      supplies_submitted_at: suppliesSkipped ? null : firebase.firestore.FieldValue.serverTimestamp(),
      has_personal_issue: fd.get('has_personal_issue') || 'no',
      wants_to_explain: fd.get('wants_to_explain') || null,
      issue_detail: fd.get('issue_detail') || '',
      access_token: genToken(),
    };
  }

  function escapeHtml(str) {
    if (str === null || str === undefined || str === '') return '';
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function row(label, value) {
    const display = value ? escapeHtml(value) : '-';
    return `<div class="review-row"><span class="review-row__label">${label}</span><span class="review-row__value">${display}</span></div>`;
  }
  function section(title) {
    return `<div class="review-section">${title}</div>`;
  }

  function buildReview() {
    const d = collectData();
    let html = '';
    html += section('Data Diri');
    html += row('Nama lengkap', d.full_name);
    html += row('Kelas', d.class);
    html += row('Jurusan', d.major);
    html += row('Peran', d.role);

    html += section('Kontak');
    html += row('No. HP kamu', d.participant_phone);
    html += row('Email kamu', d.participant_email);
    html += row('Orang tua/wali', d.guardian_name);
    html += row('No. HP orang tua/wali', d.guardian_phone);
    html += row('Guru/staf dihubungi otomatis', d.target_staff_name);

    html += section('Kesehatan');
    html += row('Kondisi medis', d.medical_conditions || 'Tidak ada');
    html += row('Alergi obat', d.has_drug_allergy === 'yes' ? d.drug_allergy_detail : 'Tidak');
    html += row('Alergi makanan', d.has_food_allergy === 'yes' ? d.food_allergy_detail : 'Tidak');
    html += row('Alergi lainnya', d.has_other_allergy === 'yes' ? d.other_allergy_detail : 'Tidak');
    html += row('Jumlah obat dibawa', d.medications.length);

    html += section('Perlengkapan');
    if (d.supplies_skipped) {
      html += row('Status', `Dilewati dulu — akan diingatkan mulai ${nextOpenLabel()}`);
    } else {
      html += row('Perlengkapan ibadah', d.prayer_gear.join(', ') || '-');
      html += row('Perlengkapan mandi', d.toiletries.join(', ') || '-');
    }

    html += section('Kesejahteraan');
    html += row('Ada masalah pribadi', d.has_personal_issue === 'yes' ? 'Ya' : 'Tidak');

    document.getElementById('reviewBox').innerHTML = html;
  }

  // ---------- Auto-contact saat data terkirim ----------
  function buildAutoContactMessage(d) {
    const flags = [];
    if (d.has_drug_allergy === 'yes') flags.push(`alergi obat (${d.drug_allergy_detail || '-'})`);
    if (d.has_food_allergy === 'yes') flags.push(`alergi makanan (${d.food_allergy_detail || '-'})`);
    if (d.has_other_allergy === 'yes') flags.push(`alergi lain (${d.other_allergy_detail || '-'})`);
    if (d.has_personal_issue === 'yes') flags.push('menandai ada masalah pribadi');
    const flagText = flags.length ? `\nCatatan penting: ${flags.join(', ')}.` : '';
    return `Assalamu'alaikum ${d.target_staff_name || ''}, saya ${d.full_name} (${d.class} - ${d.role}) baru saja mengisi formulir data kesehatan & kontak untuk kegiatan sekolah.${flagText}\nMohon dicatat, terima kasih.`;
  }

  // ---------- Submit to Firestore ----------
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitError = document.getElementById('submitError');
    submitError.hidden = true;
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Mengirim...';

    // Buka tab WhatsApp SEKARANG (di dalam handler klik) supaya tidak diblokir
    // pop-up blocker browser; URL-nya diisi setelah data berhasil tersimpan.
    let waTab = null;
    try { waTab = window.open('', '_blank'); } catch (e) { waTab = null; }

    try {
      const data = collectData();
      if (!data.full_name || !data.class || !data.major || !data.role || !data.guardian_name || !data.guardian_phone || !data.target_staff_id) {
        throw new Error('Ada data wajib yang belum terisi. Silakan periksa kembali langkah sebelumnya.');
      }
      const docRef = await db.collection('participants').add({
        ...data,
        submitted_at: firebase.firestore.FieldValue.serverTimestamp(),
      });

      // Auto-contact: buka WhatsApp ke guru/staf yang dipilih.
      const waLink = data.target_staff_whatsapp ? toWaLink(data.target_staff_whatsapp, buildAutoContactMessage(data)) : null;
      if (waLink && waTab) {
        waTab.location.href = waLink;
      } else if (waTab) {
        waTab.close();
      }
      db.collection('contactLog').add({
        participant_id: docRef.id,
        full_name: data.full_name,
        target_staff_id: data.target_staff_id,
        target_staff_name: data.target_staff_name,
        channel: 'whatsapp_auto',
        trigger: 'form_submit',
        created_at: firebase.firestore.FieldValue.serverTimestamp(),
      }).catch(() => {});

      saveLocalRecord({
        id: docRef.id,
        access_token: data.access_token,
        full_name: data.full_name,
        supplies_done: !data.supplies_skipped,
        submitted_at: Date.now(),
      });

      form.hidden = true;
      document.querySelector('.progress').hidden = true;
      successBox.hidden = false;

      const contactNote = document.getElementById('successContactNote');
      if (waLink) {
        contactNote.hidden = false;
        contactNote.textContent = `Tab WhatsApp ke ${data.target_staff_name} sudah dibuka otomatis — cek lalu tekan kirim.`;
      }
      const suppliesNote = document.getElementById('successSuppliesNote');
      if (data.supplies_skipped) {
        suppliesNote.hidden = false;
        suppliesNote.textContent = `Perlengkapan ibadah & mandi belum diisi — buka lagi halaman ini mulai ${nextOpenLabel()}, sistem akan mengingatkanmu otomatis.`;
      }
    } catch (err) {
      console.error(err);
      if (waTab) { try { waTab.close(); } catch (e) { /* ignore */ } }
      submitError.textContent = err.message || 'Gagal mengirim data. Periksa koneksi internet kamu dan coba lagi.';
      submitError.hidden = false;
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'Kirim Data';
    }
  });

  // ==========================================================================
  // SUSULAN PERLENGKAPAN — untuk peserta yang sudah pernah mengisi formulir
  // utama dan kembali ke halaman ini saat jendela waktu sedang terbuka.
  // ==========================================================================
  let fuMedCount = 0;
  const fuMedList = document.getElementById('fuMedList');
  document.getElementById('fuAddMedBtn').addEventListener('click', () => addMedRow(fuMedList, () => { fuMedCount += 1; return fuMedCount; }));

  function submitSuppliesFollowup(localRec) {
    const btn = document.getElementById('fuSubmitBtn');
    const errEl = document.getElementById('suppliesFollowupError');
    errEl.hidden = true;
    btn.disabled = true;
    btn.textContent = 'Menyimpan...';

    const phase = getSupplyPhase();
    const timing = phase === 'open' && supplySettings && new Date() <= parseLocal(supplySettings.dayBefore.date, supplySettings.dayBefore.end)
      ? 'H-1 (sehari sebelum acara)'
      : 'Saat acara berlangsung';

    const payload = {
      prayer_gear: collectChecklist('fu_prayer_gear', 'fuPrayerGearOther'),
      prayer_gear_timing: timing,
      toiletries: collectChecklist('fu_toiletries', 'fuToiletriesOther'),
      toiletries_timing: timing,
      medications: collectMeds(fuMedList),
      supplies_submitted_at: firebase.firestore.FieldValue.serverTimestamp(),
      access_token: localRec.access_token,
    };

    db.collection('participants').doc(localRec.id).update(payload)
      .then(() => {
        localRec.supplies_done = true;
        saveLocalRecord(localRec);
        document.getElementById('suppliesFollowup').hidden = true;
        document.getElementById('suppliesFollowupDone').hidden = false;
        document.getElementById('reminderBanner').hidden = true;
      })
      .catch((err) => {
        console.error(err);
        errEl.textContent = 'Gagal menyimpan. Periksa koneksi internet kamu lalu coba lagi.';
        errEl.hidden = false;
      })
      .finally(() => {
        btn.disabled = false;
        btn.textContent = 'Simpan Perlengkapan';
      });
  }

  // ==========================================================================
  // PENGINGAT OTOMATIS 3x SEHARI (perangkat + tombol kirim WhatsApp)
  // ==========================================================================
  function reminderBucketsToday() {
    const times = (supplySettings && supplySettings.reminderTimes && supplySettings.reminderTimes.length)
      ? supplySettings.reminderTimes
      : ['08:00', '13:00', '19:00'];
    return times;
  }

  function checkReminders(localRec) {
    if (!localRec || localRec.supplies_done) return;
    if (getSupplyPhase() !== 'open') return;

    const today = new Date();
    const todayKey = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    const lastShownKey = `medcheck_reminder_${localRec.id}_${todayKey}`;
    let shownBuckets = [];
    try { shownBuckets = JSON.parse(localStorage.getItem(lastShownKey) || '[]'); } catch (e) { shownBuckets = []; }

    const buckets = reminderBucketsToday();
    const nowMinutes = today.getHours() * 60 + today.getMinutes();
    for (const b of buckets) {
      const [hh, mm] = b.split(':').map(Number);
      const bucketMinutes = hh * 60 + mm;
      if (nowMinutes >= bucketMinutes && !shownBuckets.includes(b)) {
        shownBuckets.push(b);
        localStorage.setItem(lastShownKey, JSON.stringify(shownBuckets));
        showReminder(localRec, b);
        break; // satu pengingat per pemeriksaan supaya tidak menumpuk
      }
    }
  }

  function showReminder(localRec, bucket) {
    const banner = document.getElementById('reminderBanner');
    const text = document.getElementById('reminderBannerText');
    const waBtn = document.getElementById('reminderWaBtn');
    text.textContent = `Pengingat pukul ${bucket} — lengkapi perlengkapan ibadah & mandi kamu, ${localRec.full_name}.`;
    const msg = `Assalamu'alaikum, mengingatkan untuk melengkapi perlengkapan ibadah & mandi ananda ${localRec.full_name} untuk kegiatan besok/hari ini. Terima kasih.`;
    const guardianPhone = form.guardian_phone ? form.guardian_phone.value : '';
    const waLink = toWaLink(guardianPhone, msg);
    waBtn.href = waLink || '#';
    banner.hidden = false;

    if (window.Notification && Notification.permission === 'granted') {
      try {
        new Notification('Pengingat Perlengkapan', { body: text.textContent });
      } catch (e) { /* ignore */ }
    }
  }

  document.getElementById('reminderDismiss').addEventListener('click', () => {
    document.getElementById('reminderBanner').hidden = true;
  });

  if (window.Notification && Notification.permission === 'default') {
    // Minta izin secara halus, tidak memblokir apa pun jika ditolak.
    setTimeout(() => { try { Notification.requestPermission(); } catch (e) { /* ignore */ } }, 3000);
  }

  // ==========================================================================
  // INISIALISASI HALAMAN
  // ==========================================================================
  Promise.all([loadStaff(), loadSupplySettings()]).then(() => {
    const localRec = loadLocalRecord();
    const mainWrap = document.querySelector('main.wrap');
    const progressBar = document.querySelector('.progress');

    if (localRec && !localRec.supplies_done) {
      const phase = getSupplyPhase();
      if (phase === 'open') {
        mainWrap.hidden = true;
        progressBar.hidden = true;
        document.getElementById('suppliesFollowup').hidden = false;
        document.getElementById('fuSubmitBtn').addEventListener('click', () => submitSuppliesFollowup(localRec));
        checkReminders(localRec);
        setInterval(() => checkReminders(localRec), 5 * 60 * 1000);
        return;
      }
      if (phase === 'locked' || phase === 'unset') {
        mainWrap.hidden = true;
        progressBar.hidden = true;
        const notice = document.getElementById('alreadySubmittedNotice');
        document.getElementById('alreadySubmittedText').textContent = phase === 'unset'
          ? 'Terima kasih, kamu sudah mengisi formulir ini sebelumnya.'
          : `Terima kasih. Perlengkapan ibadah & mandi bisa kamu lengkapi mulai ${nextOpenLabel()} — sistem akan mengingatkanmu otomatis lewat notifikasi & WhatsApp.`;
        notice.hidden = false;
        return;
      }
      // phase === 'closed' -> tetap tampilkan susulan supaya tetap bisa diisi
      mainWrap.hidden = true;
      progressBar.hidden = true;
      document.getElementById('suppliesFollowup').hidden = false;
      document.getElementById('suppliesFollowupDesc').textContent = 'Jendela waktu resmi sudah lewat, tapi kamu tetap bisa melengkapi datanya di sini.';
      document.getElementById('fuSubmitBtn').addEventListener('click', () => submitSuppliesFollowup(localRec));
      return;
    }

    if (localRec && localRec.supplies_done) {
      mainWrap.hidden = true;
      progressBar.hidden = true;
      const notice = document.getElementById('alreadySubmittedNotice');
      document.getElementById('alreadySubmittedText').textContent = 'Semua data (termasuk perlengkapan) sudah lengkap tersimpan. Terima kasih!';
      notice.hidden = false;
      return;
    }

    // Belum pernah mengisi sama sekali -> tampilkan wizard normal.
    showStep(0);
  });
})();
