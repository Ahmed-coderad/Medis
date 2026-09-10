const express = require('express');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const db = require('../database/db');
const { requireAdmin } = require('../utils/auth');
const { generateSinglePdf, generateBulkPdf } = require('../utils/pdf');

const router = express.Router();

// ---------- Auth ----------
router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username dan password wajib diisi.' });
  }
  const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
    return res.status(401).json({ error: 'Username atau password salah.' });
  }
  req.session.adminId = admin.id;
  req.session.adminName = admin.full_name || admin.username;
  return res.json({ success: true, name: req.session.adminName });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

router.get('/session', (req, res) => {
  if (req.session && req.session.adminId) {
    return res.json({ loggedIn: true, name: req.session.adminName });
  }
  return res.json({ loggedIn: false });
});

// ---------- Records ----------
router.get('/records', requireAdmin, (req, res) => {
  const { q, role, allergy } = req.query;
  let sql = 'SELECT * FROM participants WHERE 1=1';
  const params = [];

  if (q) {
    sql += ' AND (full_name LIKE ? OR class LIKE ? OR major LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  if (role) {
    sql += ' AND role = ?';
    params.push(role);
  }
  if (allergy === 'drug') {
    sql += " AND has_drug_allergy = 'yes'";
  } else if (allergy === 'any') {
    sql += " AND (has_drug_allergy = 'yes' OR has_food_allergy = 'yes' OR has_other_allergy = 'yes')";
  }
  sql += ' ORDER BY submitted_at DESC';

  const rows = db.prepare(sql).all(...params);
  res.json({ records: rows });
});

router.get('/records/:id', requireAdmin, (req, res) => {
  const row = db.prepare('SELECT * FROM participants WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Data tidak ditemukan.' });
  res.json({ record: row });
});

router.delete('/records/:id', requireAdmin, (req, res) => {
  const info = db.prepare('DELETE FROM participants WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Data tidak ditemukan.' });
  res.json({ success: true });
});

// ---------- PDF export ----------
router.get('/records/:id/pdf', requireAdmin, (req, res) => {
  const row = db.prepare('SELECT * FROM participants WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).send('Data tidak ditemukan.');
  generateSinglePdf(res, row);
});

router.get('/export/pdf', requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT * FROM participants ORDER BY class, full_name').all();
  generateBulkPdf(res, rows);
});

// ---------- CSV export ----------
router.get('/export/csv', requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT * FROM participants ORDER BY class, full_name').all();
  const headers = [
    'id', 'full_name', 'class', 'major', 'role',
    'participant_phone', 'participant_email',
    'guardian_name', 'guardian_relation', 'guardian_phone', 'guardian_alt_phone',
    'medical_conditions', 'has_drug_allergy', 'drug_allergy_detail',
    'has_food_allergy', 'food_allergy_detail', 'has_other_allergy', 'other_allergy_detail',
    'has_personal_issue', 'submitted_at',
  ];
  const escape = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v).replace(/"/g, '""');
    return `"${s}"`;
  };
  const lines = [headers.join(',')];
  rows.forEach((r) => {
    lines.push(headers.map((h) => escape(r[h])).join(','));
  });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="data-peserta.csv"');
  res.send('\uFEFF' + lines.join('\n'));
});

// ---------- Contact ----------
function buildTransporter() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

router.get('/records/:id/contact-links', requireAdmin, (req, res) => {
  const row = db.prepare('SELECT * FROM participants WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Data tidak ditemukan.' });

  const defaultMessage = encodeURIComponent(
    `Assalamu'alaikum, Bapak/Ibu wali dari ${row.full_name} (${row.class}). Kami dari panitia kegiatan ingin menginformasikan/menanyakan terkait data kesehatan ananda. Mohon informasinya, terima kasih.`
  );
  const normalizePhone = (p) => (p || '').replace(/[^0-9]/g, '').replace(/^0/, '62');

  res.json({
    participant_whatsapp: row.participant_phone
      ? `https://wa.me/${normalizePhone(row.participant_phone)}?text=${defaultMessage}`
      : null,
    guardian_whatsapp: row.guardian_phone
      ? `https://wa.me/${normalizePhone(row.guardian_phone)}?text=${defaultMessage}`
      : null,
    guardian_alt_whatsapp: row.guardian_alt_phone
      ? `https://wa.me/${normalizePhone(row.guardian_alt_phone)}?text=${defaultMessage}`
      : null,
    participant_email: row.participant_email || null,
  });
});

router.post('/records/:id/email', requireAdmin, async (req, res) => {
  const row = db.prepare('SELECT * FROM participants WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Data tidak ditemukan.' });
  if (!row.participant_email) {
    return res.status(400).json({ error: 'Peserta ini tidak mencantumkan alamat email.' });
  }

  const transporter = buildTransporter();
  if (!transporter) {
    return res.status(503).json({
      error: 'Pengiriman email belum dikonfigurasi. Isi variabel SMTP_HOST, SMTP_USER, SMTP_PASS pada berkas .env di server.',
    });
  }

  const subject = req.body.subject || `Informasi kegiatan untuk ${row.full_name}`;
  const message = req.body.message || 'Mohon konfirmasi data kesehatan Anda kepada panitia.';

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: row.participant_email,
      subject,
      text: message,
    });
    db.prepare(
      'INSERT INTO contact_log (participant_id, channel, target, message, status, sent_by) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(row.id, 'email', row.participant_email, message, 'sent', req.session.adminName);
    res.json({ success: true });
  } catch (err) {
    console.error('Gagal mengirim email:', err);
    db.prepare(
      'INSERT INTO contact_log (participant_id, channel, target, message, status, sent_by) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(row.id, 'email', row.participant_email, message, 'failed', req.session.adminName);
    res.status(500).json({ error: 'Gagal mengirim email. Periksa konfigurasi SMTP.' });
  }
});

router.get('/stats', requireAdmin, (req, res) => {
  const total = db.prepare('SELECT COUNT(*) AS c FROM participants').get().c;
  const drugAllergy = db.prepare("SELECT COUNT(*) AS c FROM participants WHERE has_drug_allergy = 'yes'").get().c;
  const anyAllergy = db.prepare(
    "SELECT COUNT(*) AS c FROM participants WHERE has_drug_allergy='yes' OR has_food_allergy='yes' OR has_other_allergy='yes'"
  ).get().c;
  const personalIssue = db.prepare("SELECT COUNT(*) AS c FROM participants WHERE has_personal_issue = 'yes'").get().c;
  const byRole = db.prepare('SELECT role, COUNT(*) AS c FROM participants GROUP BY role').all();
  res.json({ total, drugAllergy, anyAllergy, personalIssue, byRole });
});

module.exports = router;
