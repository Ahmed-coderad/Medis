(function () {
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

  document.getElementById('year').textContent = new Date().getFullYear();

  function showStep(index) {
    steps.forEach((s, i) => { s.hidden = i !== index; });
    progressFill.style.width = `${((index + 1) / steps.length) * 100}%`;
    progressLabel.textContent = `Langkah ${index + 1} dari ${steps.length} — ${stepNames[index]}`;
    btnBack.disabled = index === 0;
    btnNext.hidden = index === steps.length - 1;
    btnSubmit.hidden = index !== steps.length - 1;
    if (index === steps.length - 1) buildReview();
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

    if (index === 2 && document.querySelector('input[name="has_drug_allergy"]:checked').value === 'yes') {
      const detail = form.drug_allergy_detail.value.trim();
      if (!detail) valid = false;
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
      alert('Mohon lengkapi bagian yang wajib diisi sebelum melanjutkan.');
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
        revealEl.hidden = r.value !== showOnValue ? true : false;
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

  // ---------- Medication rows ----------
  const medList = document.getElementById('medList');
  document.getElementById('addMedBtn').addEventListener('click', addMedRow);

  function addMedRow() {
    medCount += 1;
    const id = medCount;
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
    medList.appendChild(row);
  }

  function collectMeds() {
    return Array.from(medList.querySelectorAll('.med-row')).map((row) => ({
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
    const data = {
      full_name: fd.get('full_name'),
      class: fd.get('class'),
      major: fd.get('major'),
      role: fd.get('role'),
      participant_phone: fd.get('participant_phone'),
      participant_email: fd.get('participant_email'),
      guardian_name: fd.get('guardian_name'),
      guardian_relation: fd.get('guardian_relation'),
      guardian_phone: fd.get('guardian_phone'),
      guardian_alt_phone: fd.get('guardian_alt_phone'),
      medical_conditions: fd.get('medical_conditions'),
      has_drug_allergy: fd.get('has_drug_allergy'),
      drug_allergy_detail: fd.get('drug_allergy_detail'),
      has_food_allergy: fd.get('has_food_allergy'),
      food_allergy_detail: fd.get('food_allergy_detail'),
      has_other_allergy: fd.get('has_other_allergy'),
      other_allergy_detail: fd.get('other_allergy_detail'),
      medications: collectMeds(),
      prayer_gear: collectChecklist('prayer_gear', 'prayerGearOther'),
      prayer_gear_timing: fd.get('prayer_gear_timing'),
      toiletries: collectChecklist('toiletries', 'toiletriesOther'),
      toiletries_timing: fd.get('toiletries_timing'),
      has_personal_issue: fd.get('has_personal_issue'),
      wants_to_explain: fd.get('wants_to_explain'),
      issue_detail: fd.get('issue_detail'),
    };
    return data;
  }

  function row(label, value) {
    return `<div class="review-row"><span class="review-row__label">${label}</span><span class="review-row__value">${value || '-'}</span></div>`;
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

    html += section('Kesehatan');
    html += row('Kondisi medis', d.medical_conditions || 'Tidak ada');
    html += row('Alergi obat', d.has_drug_allergy === 'yes' ? d.drug_allergy_detail : 'Tidak');
    html += row('Alergi makanan', d.has_food_allergy === 'yes' ? d.food_allergy_detail : 'Tidak');
    html += row('Alergi lainnya', d.has_other_allergy === 'yes' ? d.other_allergy_detail : 'Tidak');
    html += row('Jumlah obat dibawa', d.medications.length);

    html += section('Perlengkapan');
    html += row('Perlengkapan ibadah', d.prayer_gear.join(', ') || '-');
    html += row('Perlengkapan mandi', d.toiletries.join(', ') || '-');

    html += section('Kesejahteraan');
    html += row('Ada masalah pribadi', d.has_personal_issue === 'yes' ? 'Ya' : 'Tidak');

    document.getElementById('reviewBox').innerHTML = html;
  }

  // ---------- Submit ----------
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitError = document.getElementById('submitError');
    submitError.hidden = true;
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Mengirim...';

    try {
      const res = await fetch('/api/participants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(collectData()),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Gagal mengirim data.');

      form.hidden = true;
      document.querySelector('.progress').hidden = true;
      successBox.hidden = false;
    } catch (err) {
      submitError.textContent = err.message;
      submitError.hidden = false;
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'Kirim Data';
    }
  });

  showStep(0);
})();
