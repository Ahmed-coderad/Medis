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

  const LS_KEY = 'medcheck_participant';
  function loadLocalRecord() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch (e) { return null; }
  }
  function saveLocalRecord(rec) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(rec)); } catch (e) { /* ignore */ }
  }

  // Firestore FieldValue (serverTimestamp) tidak bisa disimpan ke
  // localStorage/JSON — bersihkan dulu sebelum disimpan sebagai cache lokal
  // yang dipakai untuk memuat ulang data ke formulir saat mode "Ubah Data".
  function sanitizeForStorage(data) {
    const clone = {};
    Object.keys(data).forEach((k) => {
      const v = data[k];
      if (v && typeof v === 'object' && typeof v.isEqual === 'function') return; // FieldValue sentinel
      clone[k] = v;
    });
    return clone;
  }

  document.getElementById('year').textContent = new Date().getFullYear();

  // ==========================================================================
  // EFEK SUARA — tombol mute/unmute untuk animasi bertema medis di header
  // (detak jantung ikon plus & garis EKG). Suara sesungguhnya di-generate
  // langsung oleh assets/js/sound-fx.js (tanpa berkas audio eksternal).
  // ==========================================================================
  (function wireSoundToggle() {
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
    // Detak jantung header (mengikuti animasi ikon plus berdenyut) — dibunyikan
    // sekali saat halaman selesai dimuat (baru benar-benar terdengar setelah
    // interaksi pertama pengguna, mengikuti kebijakan autoplay browser).
    setTimeout(() => { if (window.SoundFX) window.SoundFX.heartbeat(); }, 600);
  })();

  // ==========================================================================
  // STAFF DIRECTORY (guru/staf medis yang bisa dipilih peserta)
  // ==========================================================================
  let staffList = [];
  let selectedStaff = null;

  // ==========================================================================
  // MODE UBAH DATA (edit & kirim ulang)
  // Pengurus OSIS, Peserta Umum, maupun Panitia tetap boleh mengubah dan
  // mengirim ulang data mereka kapan saja setelah pengiriman pertama —
  // `editingRecord` menampung dokumen yang sedang diubah (bila ada).
  // ==========================================================================
  let editingRecord = null;

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
  // TYPEWRITER PLACEHOLDER — animasi mengetik bergantian pada field "Kelas"
  // (X/XI/XII MPLB/OTKP) dan "Program keahlian/jurusan" (Manajemen
  // Perkantoran dan Layanan Bisnis / Otomatisasi dan Tata Kelola
  // Perkantoran).
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
    'Manajemen Perkantoran dan Layanan Bisnis',
    'Otomatisasi dan Tata Kelola Perkantoran',
  ]);

  wireTypewriterPlaceholder('class', [
    'X MPLB',
    'XI MPLB',
    'XII MPLB',
    'X OTKP',
    'XI OTKP',
    'XII OTKP',
  ]);

  // ==========================================================================
  // JENDELA WAKTU PERLENGKAPAN & OBAT (diatur guru/staf medis lewat panel admin)
  // ==========================================================================
  let supplySettings = null;

  // Mengembalikan: 'locked' | 'open' | 'closed' | 'unset'
  function getSupplyPhase(now) {
    return window.SupplyPhase.getPhase(supplySettings, now);
  }

  function nextOpenLabel() {
    return window.SupplyPhase.nextOpenLabel(supplySettings);
  }

  function parseLocal(dateStr, timeStr) {
    return window.SupplyPhase.parseLocal(dateStr, timeStr);
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

  // Mengembalikan snapshot jadwal (hari/tanggal/bulan/jam) yang sedang atau
  // akan berlaku, langsung dari pengaturan admin — dipakai untuk menandai
  // entri "Perlengkapan Obat, Ibadah & Mandi" supaya selalu tertaut ke
  // jadwal resmi, bukan sekadar label generik.
  function currentScheduleSnapshot() {
    return window.SupplyPhase.scheduleSnapshot(supplySettings);
  }

  function currentScheduleLabel() {
    const snap = currentScheduleSnapshot();
    if (!snap) return '';
    if (snap.activeLabel) return snap.activeLabel;
    // Belum ada jendela yang aktif sekarang -> tampilkan jadwal H-1 sebagai acuan terdekat.
    return snap.dayBefore.label || snap.eventDay.label || '';
  }

  function renderSupplyWindowBanner() {
    const banner = document.getElementById('supplyWindowBanner');
    const wrap = document.getElementById('supplyFieldsWrap');
    const detail = document.getElementById('supplyScheduleDetail');
    const medNote = document.getElementById('medScheduleNote');
    const phase = getSupplyPhase();
    banner.hidden = false;
    wrap.classList.remove('is-locked');
    setSupplyFieldsDisabled(false);

    if (phase === 'unset') {
      banner.hidden = true;
      if (detail) detail.hidden = true;
      if (medNote) medNote.textContent = '';
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
    const label = currentScheduleLabel();
    if (detail) {
      if (label) {
        detail.hidden = false;
        detail.textContent = `Sesuai jadwal admin, bagian ini berlaku pada: ${label}.`;
      } else {
        detail.hidden = true;
      }
    }
    if (medNote) {
      medNote.textContent = label ? `Obat yang kamu catat di sini akan tertaut ke jadwal: ${label}.` : '';
    }
    return phase;
  }

  // ==========================================================================
  // WIZARD (langkah 1-6)
  // ==========================================================================
  const form = document.getElementById('regForm');
  const steps = Array.from(document.querySelectorAll('.step'));
  const stepNames = ['Data Diri', 'Kontak', 'Kondisi Kesehatan', 'Perlengkapan Obat, Ibadah & Mandi', 'Kesejahteraan', 'Periksa Kembali'];
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
    if (index === steps.length - 1) {
      btnSubmit.textContent = editingRecord ? 'Kirim Perubahan' : 'Kirim Data';
    }
    if (steps[index].dataset.step === '4') renderSupplyWindowBanner();
    if (index === steps.length - 1) buildReview();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const isValidPhone = window.SupplyPhase.isValidPhone;

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
    if (window.SoundFX) window.SoundFX.click();
    current += 1;
    showStep(current);
  });

  btnBack.addEventListener('click', () => {
    if (window.SoundFX) window.SoundFX.click();
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

  // ==========================================================================
  // RENCANA PENANGANAN MEDIS OTOMATIS
  // Setiap kali formulir dikirim (atau data diubah & dikirim ulang), sistem
  // membaca kondisi medis khusus, alergi (obat/makanan/lainnya), dan masalah
  // pribadi yang dituliskan peserta, lalu langsung menyusun rencana
  // penanganan beserta tingkat prioritasnya — tanpa perlu input manual dari
  // guru/staf medis. Panel admin menampilkan hasilnya di detail peserta.
  // ==========================================================================
  const CONDITION_PLAYBOOK = [
    { keywords: ['asma'], point: 'Kondisi: riwayat asma. Yang perlu disiapkan: pastikan inhaler pribadi selalu mudah dijangkau, dan hindari area berdebu/berasap selama kegiatan.' },
    { keywords: ['jantung'], point: 'Kondisi: riwayat gangguan jantung. Yang perlu disiapkan: dampingi saat aktivitas fisik berat, dan siapkan jalur ke bantuan medis terdekat.' },
    { keywords: ['diabetes', 'gula darah', 'gula'], point: 'Kondisi: indikasi diabetes/gula darah. Yang perlu disiapkan: jaga jadwal makan tetap teratur, dan sediakan camilan/gula darurat.' },
    { keywords: ['epilepsi', 'ayan', 'kejang'], point: 'Kondisi: riwayat epilepsi/kejang. Yang perlu disiapkan: pastikan selalu ada pendamping yang paham langkah pertolongan pertama saat kejang.' },
    { keywords: ['maag', 'lambung', 'gerd'], point: 'Kondisi: riwayat maag/gangguan lambung. Yang perlu disiapkan: jangan biarkan jadwal makan terlambat, dan siapkan obat lambung bila dibawa.' },
    { keywords: ['tekanan darah', 'hipertensi', 'darah tinggi', 'darah rendah'], point: 'Kondisi: indikasi tekanan darah tidak stabil. Yang perlu disiapkan: pantau kondisi secara berkala, terutama saat cuaca panas atau aktivitas fisik.' },
    { keywords: ['sesak', 'napas'], point: 'Kondisi: keluhan pernapasan. Yang perlu disiapkan: sediakan tempat istirahat dengan sirkulasi udara yang baik.' },
  ];

  // Kalimat pembuka singkat yang ditampilkan bersama rencana ini, supaya
  // pembaca (peserta maupun guru/staf medis) langsung paham ini bukan
  // diagnosis medis, melainkan panduan kesiapsiagaan yang disusun otomatis.
  const MEDICAL_PLAN_INTRO = 'Rencana ini disusun otomatis oleh sistem berdasarkan jawaban kesehatan & kesejahteraan yang kamu isi — bukan diagnosis medis, hanya panduan kesiapsiagaan untuk guru/staf medis.';

  function priorityExplanation(priority) {
    if (priority === 'Prioritas Tinggi') return 'Artinya kondisimu perlu perhatian ekstra dari guru/staf medis sejak awal kegiatan.';
    if (priority === 'Perlu Perhatian') return 'Artinya kondisimu tidak darurat, tapi tetap perlu diketahui & dipantau guru/staf medis.';
    return 'Artinya tidak ada kondisi khusus yang perlu penanganan tambahan — tetap penanganan standar seperti peserta lain.';
  }

  function detectConditionPoints(text) {
    const lower = (text || '').toLowerCase();
    if (!lower.trim() || /^tidak( ada)?$/.test(lower.trim()) || lower.trim() === '-') return [];
    const points = CONDITION_PLAYBOOK.filter((c) => c.keywords.some((k) => lower.includes(k))).map((c) => c.point);
    if (!points.length) {
      points.push(`Kondisi: kondisi medis khusus dilaporkan ("${text.trim()}"). Yang perlu disiapkan: ditinjau langsung oleh guru/staf medis agar penanganannya tepat.`);
    }
    return points;
  }

  function buildMedicalAttentionPlan(d) {
    const points = [];
    let riskScore = 0;

    points.push(...detectConditionPoints(d.medical_conditions));
    if (detectConditionPoints(d.medical_conditions).length) riskScore += 1;

    if (d.has_drug_allergy === 'yes') {
      points.push(`Kondisi: alergi obat (${d.drug_allergy_detail || 'tidak dirinci'}). Yang perlu disiapkan: obat ini TIDAK boleh diberikan — pastikan seluruh pendamping & tim P3K mengetahuinya.`);
      riskScore += 2;
    }
    if (d.has_food_allergy === 'yes') {
      points.push(`Kondisi: alergi makanan (${d.food_allergy_detail || 'tidak dirinci'}). Yang perlu disiapkan: pastikan menu/konsumsi tidak mengandung bahan ini.`);
      riskScore += 2;
    }
    if (d.has_other_allergy === 'yes') {
      points.push(`Kondisi: alergi lain (${d.other_allergy_detail || 'tidak dirinci'}). Yang perlu disiapkan: jauhkan dari pemicunya, dan siapkan obat alergi bila diperlukan.`);
      riskScore += 1;
    }
    if (Array.isArray(d.medications) && d.medications.length) {
      const scheduleText = d.medications.map((m) => m.schedule).filter(Boolean).join(', ') || 'sesuai catatan peserta';
      points.push(`Kondisi: membawa ${d.medications.length} jenis obat pribadi. Yang perlu disiapkan: pantau jadwal minum obat (${scheduleText}) agar tidak terlewat.`);
    }
    if (d.has_personal_issue === 'yes') {
      if (d.wants_to_explain === 'yes' && d.issue_detail) {
        points.push(`Kondisi: ada masalah pribadi yang ingin diceritakan. Yang perlu disiapkan: tindak lanjut personal & rahasia dari ${d.target_staff_name || 'guru/staf yang dipilih'} sesegera mungkin.`);
        riskScore += 2;
      } else {
        points.push(`Kondisi: ada masalah pribadi, namun belum ingin diceritakan. Yang perlu disiapkan: pastikan ${d.target_staff_name || 'guru/staf yang dipilih'} tetap terbuka/siap dihubungi kapan saja.`);
        riskScore += 1;
      }
    }

    if (!points.length) {
      points.push('Kondisi: tidak ada kondisi medis, alergi, atau masalah pribadi yang dilaporkan. Yang perlu disiapkan: penanganan standar/umum seperti biasa.');
    }

    const priority = riskScore >= 3 ? 'Prioritas Tinggi' : (riskScore >= 1 ? 'Perlu Perhatian' : 'Normal');

    return {
      priority,
      priority_note: priorityExplanation(priority),
      risk_score: riskScore,
      points,
      intro: MEDICAL_PLAN_INTRO,
      generated_at_client: new Date().toISOString(),
    };
  }

  // ---------- Data collection ----------
  function collectData() {
    const fd = new FormData(form);
    const phase = getSupplyPhase();
    const suppliesSkipped = phase === 'locked';
    const scheduleSnap = currentScheduleSnapshot();
    const scheduleLabel = currentScheduleLabel();
    const data = {
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
      medications_schedule: suppliesSkipped ? '' : scheduleLabel,
      prayer_gear: suppliesSkipped ? [] : collectChecklist('prayer_gear', 'prayerGearOther'),
      prayer_gear_timing: suppliesSkipped ? '' : (fd.get('prayer_gear_timing') || ''),
      toiletries: suppliesSkipped ? [] : collectChecklist('toiletries', 'toiletriesOther'),
      toiletries_timing: suppliesSkipped ? '' : (fd.get('toiletries_timing') || ''),
      supplies_schedule: suppliesSkipped ? null : scheduleSnap,
      supplies_schedule_label: suppliesSkipped ? '' : scheduleLabel,
      supplies_skipped: suppliesSkipped,
      supplies_submitted_at: suppliesSkipped ? null : firebase.firestore.FieldValue.serverTimestamp(),
      has_personal_issue: fd.get('has_personal_issue') || 'no',
      wants_to_explain: fd.get('wants_to_explain') || null,
      issue_detail: fd.get('issue_detail') || '',
      access_token: (editingRecord && editingRecord.access_token) || genToken(),
    };
    // Sistem otomatis: rencana penanganan medis langsung disusun ulang
    // setiap kali data ini dikumpulkan (submit awal maupun ubah/kirim ulang),
    // berdasarkan kondisi medis, alergi, dan masalah pribadi yang diisi.
    data.medical_attention_plan = buildMedicalAttentionPlan(data);
    return data;
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

    html += section('Perlengkapan Obat, Ibadah & Mandi');
    html += row('Jumlah obat dibawa', d.medications.length);
    if (d.supplies_skipped) {
      html += row('Status', `Dilewati dulu — akan diingatkan mulai ${nextOpenLabel()}`);
    } else {
      html += row('Perlengkapan ibadah', d.prayer_gear.join(', ') || '-');
      html += row('Perlengkapan mandi', d.toiletries.join(', ') || '-');
      html += row('Jadwal (sesuai admin)', d.supplies_schedule_label || '-');
    }

    html += section('Kesejahteraan');
    html += row('Ada masalah pribadi', d.has_personal_issue === 'yes' ? 'Ya' : 'Tidak');

    html += section('Rencana Penanganan Medis Otomatis');
    html += `<p class="review-row__note">${escapeHtml(d.medical_attention_plan.intro)}</p>`;
    html += row('Prioritas', d.medical_attention_plan.priority);
    html += `<p class="review-row__note">${escapeHtml(d.medical_attention_plan.priority_note)}</p>`;
    html += `<div class="review-row"><span class="review-row__label">Rencana</span><span class="review-row__value">${d.medical_attention_plan.points.map(escapeHtml).join('<br/><br/>')}</span></div>`;

    document.getElementById('reviewBox').innerHTML = html;
  }

  // ==========================================================================
  // MEMUAT DATA LAMA KE FORMULIR SAAT MODE "UBAH DATA"
  // Dipakai supaya Pengurus OSIS, Peserta Umum, dan Panitia bisa mengubah &
  // mengirim ulang data mereka tanpa perlu mengetik ulang dari awal.
  // ==========================================================================
  function setChecklistValues(name, otherInputId, values) {
    const list = Array.isArray(values) ? values.slice() : [];
    const boxes = document.querySelectorAll(`input[name="${name}"]`);
    boxes.forEach((box) => {
      const idx = list.indexOf(box.value);
      box.checked = idx !== -1;
      if (idx !== -1) list.splice(idx, 1);
    });
    const otherEl = document.getElementById(otherInputId);
    if (otherEl) otherEl.value = list.join(', ');
  }

  function setRadioValue(name, value) {
    const radios = document.querySelectorAll(`input[name="${name}"]`);
    radios.forEach((r) => {
      r.checked = r.value === value;
      r.dispatchEvent(new Event('change'));
    });
  }

  function prefillMeds(container, list, counterSetter) {
    container.innerHTML = '';
    (Array.isArray(list) ? list : []).forEach((m) => {
      const row = addMedRow(container, counterSetter);
      row.querySelector('[data-field="name"]').value = m.name || '';
      row.querySelector('[data-field="dosage"]').value = m.dosage || '';
      row.querySelector('[data-field="schedule"]').value = m.schedule || '';
    });
  }

  function prefillFormFromData(d) {
    const setVal = (name, value) => { if (form[name]) form[name].value = value || ''; };
    setVal('full_name', d.full_name);
    setVal('class', d.class);
    setVal('major', d.major);
    setVal('role', d.role);
    setVal('participant_phone', d.participant_phone);
    setVal('participant_email', d.participant_email);
    setVal('guardian_name', d.guardian_name);
    setVal('guardian_relation', d.guardian_relation);
    setVal('guardian_phone', d.guardian_phone);
    setVal('guardian_alt_phone', d.guardian_alt_phone);
    if (d.target_staff_id) {
      const sel = document.getElementById('target_staff');
      sel.value = d.target_staff_id;
      selectedStaff = staffList.find((s) => s.id === d.target_staff_id) || null;
      updateTeacherNote();
    }
    setVal('medical_conditions', d.medical_conditions);
    setRadioValue('has_drug_allergy', d.has_drug_allergy || 'no');
    setVal('drug_allergy_detail', d.drug_allergy_detail);
    setRadioValue('has_food_allergy', d.has_food_allergy || 'no');
    setVal('food_allergy_detail', d.food_allergy_detail);
    setRadioValue('has_other_allergy', d.has_other_allergy || 'no');
    setVal('other_allergy_detail', d.other_allergy_detail);
    prefillMeds(medList, d.medications, () => { medCount += 1; return medCount; });
    setChecklistValues('prayer_gear', 'prayerGearOther', d.prayer_gear);
    setRadioValue('prayer_gear_timing', d.prayer_gear_timing || 'H-1 (sehari sebelum acara)');
    setChecklistValues('toiletries', 'toiletriesOther', d.toiletries);
    setRadioValue('toiletries_timing', d.toiletries_timing || 'H-1 (sehari sebelum acara)');
    setRadioValue('has_personal_issue', d.has_personal_issue || 'no');
    if (d.wants_to_explain) setRadioValue('wants_to_explain', d.wants_to_explain);
    setVal('issue_detail', d.issue_detail);
  }

  function startEditMode(localRec) {
    if (!localRec || !localRec.full_data) {
      alert('Data lama kamu belum bisa dimuat ulang otomatis di perangkat ini (kemungkinan tersimpan sebelum fitur "Ubah Data" ada). Silakan hubungi guru/staf/panitia untuk membantu memperbarui datamu secara manual.');
      return;
    }
    editingRecord = {
      id: localRec.id,
      access_token: localRec.access_token,
      submitted_at: localRec.submitted_at,
      revision_count: localRec.full_data.revision_count || 0,
    };
    document.querySelector('main.wrap').hidden = false;
    document.querySelector('.progress').hidden = false;
    document.getElementById('alreadySubmittedNotice').hidden = true;
    document.getElementById('suppliesFollowup').hidden = true;
    document.getElementById('suppliesFollowupDone').hidden = true;
    successBox.hidden = true;
    form.hidden = false;
    document.getElementById('editModeBanner').hidden = false;
    prefillFormFromData(localRec.full_data);
    current = 0;
    showStep(0);
  }

  // ---------- Auto-contact saat data terkirim ----------
  // Format pesan baku (wajib persis seperti ini), placeholder diisi otomatis
  // dari data formulir setiap kali dikirim maupun diubah/dikirim ulang.
  function buildAutoContactMessage(d) {
    const teacherName = d.target_staff_name || '-';
    return `Assalamu'alaikum wr. wb. Mr./Ms. ${teacherName}. Apologies for the interruption. I would like to inform you that I, ${d.full_name} (Class ${d.class}), have just completed the health and contact data form for the school activity. The data has been recorded in the system. Please review it if necessary. Thank you very much for your attention. Wassalamu'alaikum wr. wb.`;
  }

  // ---------- Submit to Firestore (pengiriman pertama ATAU ubah/kirim ulang) ----------
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitError = document.getElementById('submitError');
    submitError.hidden = true;
    btnSubmit.disabled = true;
    btnSubmit.textContent = editingRecord ? 'Menyimpan perubahan...' : 'Mengirim...';

    // Buka tab WhatsApp SEKARANG (di dalam handler klik) supaya tidak diblokir
    // pop-up blocker browser; URL-nya diisi setelah data berhasil tersimpan.
    let waTab = null;
    try { waTab = window.open('', '_blank'); } catch (e) { waTab = null; }

    try {
      const data = collectData();
      if (!data.full_name || !data.class || !data.major || !data.role || !data.guardian_name || !data.guardian_phone || !data.target_staff_id) {
        throw new Error('Ada data wajib yang belum terisi. Silakan periksa kembali langkah sebelumnya.');
      }

      let docId;
      if (editingRecord && editingRecord.id) {
        // Mode Ubah Data: Pengurus OSIS/Peserta Umum/Panitia mengirim ulang
        // data mereka sendiri. access_token yang sama dipakai supaya
        // firestore.rules mengizinkan pembaruan ini tanpa perlu login admin.
        docId = editingRecord.id;
        // submitted_at (waktu pengiriman PERTAMA) sengaja TIDAK disertakan di
        // sini supaya .update() tidak menimpanya — hanya field lain yang
        // berubah, plus updated_at baru sebagai jejak kapan data diubah.
        await db.collection('participants').doc(docId).update({
          ...data,
          updated_at: firebase.firestore.FieldValue.serverTimestamp(),
          revision_count: (editingRecord.revision_count || 0) + 1,
        });
      } else {
        const docRef = await db.collection('participants').add({
          ...data,
          submitted_at: firebase.firestore.FieldValue.serverTimestamp(),
        });
        docId = docRef.id;
      }

      // Auto-contact: buka WhatsApp ke guru/staf yang dipilih (baik saat
      // pengiriman pertama maupun saat data diubah & dikirim ulang).
      const waLink = data.target_staff_whatsapp ? toWaLink(data.target_staff_whatsapp, buildAutoContactMessage(data)) : null;
      if (waLink && waTab) {
        waTab.location.href = waLink;
      } else if (waTab) {
        waTab.close();
      }
      db.collection('contactLog').add({
        participant_id: docId,
        full_name: data.full_name,
        target_staff_id: data.target_staff_id,
        target_staff_name: data.target_staff_name,
        channel: 'whatsapp_auto',
        trigger: editingRecord ? 'form_resubmit' : 'form_submit',
        created_at: firebase.firestore.FieldValue.serverTimestamp(),
      }).catch(() => {});

      saveLocalRecord({
        id: docId,
        access_token: data.access_token,
        full_name: data.full_name,
        supplies_done: !data.supplies_skipped,
        submitted_at: (editingRecord && editingRecord.submitted_at) || Date.now(),
        full_data: sanitizeForStorage(data),
      });
      editingRecord = null;

      form.hidden = true;
      document.getElementById('editModeBanner').hidden = true;
      document.querySelector('.progress').hidden = true;
      successBox.hidden = false;
      successBox.querySelector('h2').textContent = 'Data berhasil dikirim';
      if (window.SoundFX) window.SoundFX.success();

      const contactNote = document.getElementById('successContactNote');
      if (waLink) {
        contactNote.hidden = false;
        contactNote.textContent = `Tab WhatsApp ke ${data.target_staff_name} sudah dibuka otomatis — cek lalu tekan kirim.`;
      }
      const suppliesNote = document.getElementById('successSuppliesNote');
      if (data.supplies_skipped) {
        suppliesNote.hidden = false;
        suppliesNote.textContent = `Perlengkapan obat, ibadah & mandi belum diisi — buka lagi halaman ini mulai ${nextOpenLabel()}, sistem akan mengingatkanmu otomatis (notifikasi, suara alarm, & WhatsApp).`;
      }
      const planNote = document.getElementById('successPlanNote');
      planNote.hidden = false;
      planNote.textContent = `Sistem telah menyusun rencana penanganan medis otomatis untukmu (tingkat prioritas: ${data.medical_attention_plan.priority}). Ini bukan diagnosis medis — hanya panduan kesiapsiagaan yang bisa dilihat guru/staf medis di panel admin.`;
    } catch (err) {
      console.error(err);
      if (waTab) { try { waTab.close(); } catch (e) { /* ignore */ } }
      submitError.textContent = err.message || 'Gagal mengirim data. Periksa koneksi internet kamu dan coba lagi.';
      submitError.hidden = false;
      btnSubmit.disabled = false;
      btnSubmit.textContent = editingRecord ? 'Kirim Perubahan' : 'Kirim Data';
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

    const scheduleLabel = currentScheduleLabel();
    const payload = {
      prayer_gear: collectChecklist('fu_prayer_gear', 'fuPrayerGearOther'),
      prayer_gear_timing: timing,
      toiletries: collectChecklist('fu_toiletries', 'fuToiletriesOther'),
      toiletries_timing: timing,
      medications: collectMeds(fuMedList),
      medications_schedule: scheduleLabel,
      supplies_schedule_label: scheduleLabel,
      supplies_schedule: currentScheduleSnapshot(),
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
        document.getElementById('reminderBanner').classList.remove('reminder-banner--alarm');
        stopAlarmSound();
        if (window.SoundFX) window.SoundFX.success();
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

  // Alarm suara diulang berkala selagi banner pengingat masih tampil &
  // belum ditutup/diisi — supaya benar-benar terasa seperti "alarm", bukan
  // cuma satu kali bunyi lalu diam.
  let alarmRepeatTimer = null;
  function startAlarmSound() {
    stopAlarmSound();
    if (window.SoundFX) window.SoundFX.alarm();
    alarmRepeatTimer = setInterval(() => { if (window.SoundFX) window.SoundFX.alarm(); }, 45000);
  }
  function stopAlarmSound() {
    if (alarmRepeatTimer) { clearInterval(alarmRepeatTimer); alarmRepeatTimer = null; }
  }

  function showReminder(localRec, bucket) {
    const banner = document.getElementById('reminderBanner');
    const title = document.getElementById('reminderBannerTitle');
    const text = document.getElementById('reminderBannerText');
    const waBtn = document.getElementById('reminderWaBtn');
    title.textContent = 'Alarm Pengingat Perlengkapan Obat, Ibadah & Mandi';
    text.textContent = `Pengingat pukul ${bucket} — lengkapi perlengkapan obat, ibadah & mandi kamu, ${localRec.full_name}.`;
    const msg = `Assalamu'alaikum, mengingatkan untuk melengkapi perlengkapan obat, ibadah & mandi ananda ${localRec.full_name} untuk kegiatan besok/hari ini. Terima kasih.`;
    const guardianPhone = form.guardian_phone ? form.guardian_phone.value : '';
    const waLink = toWaLink(guardianPhone, msg);
    waBtn.href = waLink || '#';
    banner.hidden = false;
    banner.classList.add('reminder-banner--alarm');
    startAlarmSound();

    if (window.Notification && Notification.permission === 'granted') {
      try {
        new Notification('Alarm Pengingat Perlengkapan Obat, Ibadah & Mandi', { body: text.textContent });
      } catch (e) { /* ignore */ }
    }
  }

  document.getElementById('reminderDismiss').addEventListener('click', () => {
    document.getElementById('reminderBanner').hidden = true;
    document.getElementById('reminderBanner').classList.remove('reminder-banner--alarm');
    stopAlarmSound();
    if (window.SoundFX) window.SoundFX.click();
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
        const fuNote = document.getElementById('fuSupplyScheduleNote');
        if (fuNote) {
          const label = currentScheduleLabel();
          fuNote.textContent = label ? `Sesuai jadwal admin, bagian ini berlaku pada: ${label}.` : '';
        }
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
          : `Terima kasih. Perlengkapan obat, ibadah & mandi bisa kamu lengkapi mulai ${nextOpenLabel()} — sistem akan mengingatkanmu otomatis lewat notifikasi, suara alarm, & WhatsApp.`;
        notice.hidden = false;
        if (window.SoundFX) window.SoundFX.heartbeat();
        document.getElementById('editDataBtn').addEventListener('click', () => startEditMode(localRec));
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
      if (window.SoundFX) window.SoundFX.heartbeat();
      document.getElementById('editDataBtn').addEventListener('click', () => startEditMode(localRec));
      return;
    }

    // Belum pernah mengisi sama sekali -> tampilkan wizard normal.
    showStep(0);
  });
})();
