const express = require('express');
const db = require('../database/db');

const router = express.Router();

const ROLES = ['Pengurus OSIS', 'Peserta Umum', 'Panitia'];
const TIMING_OPTIONS = ['H-1 (sehari sebelum acara)', 'Saat acara berlangsung'];

function toJsonArray(value) {
  if (Array.isArray(value)) return JSON.stringify(value.filter(Boolean));
  return JSON.stringify([]);
}

function toJsonMeds(value) {
  if (!Array.isArray(value)) return JSON.stringify([]);
  const cleaned = value
    .filter((m) => m && (m.name || m.dosage || m.schedule))
    .map((m) => ({
      name: (m.name || '').toString().slice(0, 200),
      dosage: (m.dosage || '').toString().slice(0, 200),
      schedule: (m.schedule || '').toString().slice(0, 200),
    }));
  return JSON.stringify(cleaned);
}

function validate(body) {
  const errors = [];
  const required = [
    ['full_name', 'Nama lengkap'],
    ['class', 'Kelas'],
    ['major', 'Program keahlian / jurusan'],
    ['role', 'Peran'],
    ['guardian_name', 'Nama orang tua/wali'],
    ['guardian_phone', 'No. HP orang tua/wali'],
  ];
  required.forEach(([key, label]) => {
    if (!body[key] || String(body[key]).trim() === '') {
      errors.push(`${label} wajib diisi.`);
    }
  });
  if (body.role && !ROLES.includes(body.role)) {
    errors.push('Peran yang dipilih tidak valid.');
  }
  if (body.has_drug_allergy === 'yes' && !body.drug_allergy_detail) {
    errors.push('Mohon isi detail alergi obat.');
  }
  if (body.has_personal_issue === 'yes') {
    if (!['yes', 'no'].includes(body.wants_to_explain)) {
      errors.push('Mohon jawab apakah kamu ingin menjelaskan detail masalahmu.');
    } else if (body.wants_to_explain === 'yes' && !body.issue_detail) {
      errors.push('Mohon isi penjelasan singkat mengenai masalahmu.');
    }
  }
  return errors;
}

router.post('/participants', (req, res) => {
  const body = req.body || {};
  const errors = validate(body);
  if (errors.length) {
    return res.status(400).json({ error: errors.join(' ') });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO participants (
        full_name, class, major, role,
        participant_phone, participant_email,
        guardian_name, guardian_relation, guardian_phone, guardian_alt_phone,
        medical_conditions,
        has_drug_allergy, drug_allergy_detail,
        has_food_allergy, food_allergy_detail,
        has_other_allergy, other_allergy_detail,
        medications,
        prayer_gear, prayer_gear_timing,
        toiletries, toiletries_timing,
        has_personal_issue, wants_to_explain, issue_detail
      ) VALUES (
        @full_name, @class, @major, @role,
        @participant_phone, @participant_email,
        @guardian_name, @guardian_relation, @guardian_phone, @guardian_alt_phone,
        @medical_conditions,
        @has_drug_allergy, @drug_allergy_detail,
        @has_food_allergy, @food_allergy_detail,
        @has_other_allergy, @other_allergy_detail,
        @medications,
        @prayer_gear, @prayer_gear_timing,
        @toiletries, @toiletries_timing,
        @has_personal_issue, @wants_to_explain, @issue_detail
      )
    `);

    const info = stmt.run({
      full_name: body.full_name.trim(),
      class: body.class.trim(),
      major: body.major.trim(),
      role: body.role,
      participant_phone: body.participant_phone || null,
      participant_email: body.participant_email || null,
      guardian_name: body.guardian_name.trim(),
      guardian_relation: body.guardian_relation || null,
      guardian_phone: body.guardian_phone.trim(),
      guardian_alt_phone: body.guardian_alt_phone || null,
      medical_conditions: body.medical_conditions || null,
      has_drug_allergy: body.has_drug_allergy === 'yes' ? 'yes' : 'no',
      drug_allergy_detail: body.has_drug_allergy === 'yes' ? body.drug_allergy_detail : null,
      has_food_allergy: body.has_food_allergy === 'yes' ? 'yes' : 'no',
      food_allergy_detail: body.has_food_allergy === 'yes' ? body.food_allergy_detail : null,
      has_other_allergy: body.has_other_allergy === 'yes' ? 'yes' : 'no',
      other_allergy_detail: body.has_other_allergy === 'yes' ? body.other_allergy_detail : null,
      medications: toJsonMeds(body.medications),
      prayer_gear: toJsonArray(body.prayer_gear),
      prayer_gear_timing: TIMING_OPTIONS.includes(body.prayer_gear_timing) ? body.prayer_gear_timing : null,
      toiletries: toJsonArray(body.toiletries),
      toiletries_timing: TIMING_OPTIONS.includes(body.toiletries_timing) ? body.toiletries_timing : null,
      has_personal_issue: body.has_personal_issue === 'yes' ? 'yes' : 'no',
      wants_to_explain: body.has_personal_issue === 'yes' ? (body.wants_to_explain === 'yes' ? 'yes' : 'no') : null,
      issue_detail: body.has_personal_issue === 'yes' && body.wants_to_explain === 'yes' ? body.issue_detail : null,
    });

    return res.status(201).json({ success: true, id: info.lastInsertRowid });
  } catch (err) {
    console.error('Gagal menyimpan data peserta:', err);
    return res.status(500).json({ error: 'Terjadi kesalahan pada server. Silakan coba lagi.' });
  }
});

module.exports = router;
