const PDFDocument = require('pdfkit');

const BRAND = '#16645C';
const BRAND_DARK = '#0E403A';
const MUTED = '#5B6E6A';
const ALERT = '#B23A24';
const LINE = '#DCE6E3';

function yesNo(v) {
  return v === 'yes' ? 'Ya' : v === 'no' ? 'Tidak' : '-';
}

function safe(v, fallback = '-') {
  if (v === null || v === undefined || v === '') return fallback;
  return v;
}

function parseJSON(v, fallback) {
  try {
    const parsed = JSON.parse(v);
    return parsed || fallback;
  } catch (e) {
    return fallback;
  }
}

function drawHeader(doc, title) {
  doc
    .rect(0, 0, doc.page.width, 90)
    .fill(BRAND);
  doc
    .fillColor('#FFFFFF')
    .font('Helvetica-Bold')
    .fontSize(16)
    .text('FORMULIR DATA KESEHATAN & KONTAK PESERTA', 40, 28, { width: doc.page.width - 80 });
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor('#DDEDE9')
    .text(title, 40, 52, { width: doc.page.width - 80 });
  doc.fillColor('#000000');
  doc.y = 110;
}

function sectionTitle(doc, text) {
  doc.moveDown(0.6);
  const y = doc.y;
  doc
    .font('Helvetica-Bold')
    .fontSize(11.5)
    .fillColor(BRAND_DARK)
    .text(text.toUpperCase(), 40, y);
  doc
    .moveTo(40, doc.y + 3)
    .lineTo(doc.page.width - 40, doc.y + 3)
    .strokeColor(LINE)
    .lineWidth(1)
    .stroke();
  doc.moveDown(0.5);
  doc.fillColor('#000000');
}

function field(doc, label, value, opts = {}) {
  const startX = 40;
  const labelWidth = opts.labelWidth || 160;
  const y = doc.y;
  doc
    .font('Helvetica')
    .fontSize(9.5)
    .fillColor(MUTED)
    .text(label, startX, y, { width: labelWidth });
  doc
    .font('Helvetica-Bold')
    .fontSize(10.5)
    .fillColor(opts.alert ? ALERT : '#1A2E2B')
    .text(String(safe(value)), startX + labelWidth, y, {
      width: doc.page.width - 80 - labelWidth,
    });
  doc.moveDown(0.35);
}

function twoColumn(doc, leftLabel, leftValue, rightLabel, rightValue) {
  const startX = 40;
  const colWidth = (doc.page.width - 80) / 2;
  const y = doc.y;
  const labelHeight = Math.max(
    doc.heightOfString(leftLabel, { width: colWidth - 10, font: 'Helvetica', fontSize: 9.5 }),
    doc.heightOfString(rightLabel, { width: colWidth - 10, font: 'Helvetica', fontSize: 9.5 })
  );
  const valueY = y + labelHeight + 4;

  doc.font('Helvetica').fontSize(9.5).fillColor(MUTED)
    .text(leftLabel, startX, y, { width: colWidth - 10 });
  doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#1A2E2B')
    .text(String(safe(leftValue)), startX, valueY, { width: colWidth - 10 });

  doc.font('Helvetica').fontSize(9.5).fillColor(MUTED)
    .text(rightLabel, startX + colWidth, y, { width: colWidth - 10 });
  doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#1A2E2B')
    .text(String(safe(rightValue)), startX + colWidth, valueY, { width: colWidth - 10 });

  doc.y = valueY + 16;
}

function checklistBlock(doc, label, items) {
  doc.font('Helvetica').fontSize(9.5).fillColor(MUTED).text(label, 40, doc.y);
  doc.moveDown(0.2);
  const list = Array.isArray(items) && items.length ? items.join(', ') : 'Belum diisi';
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#1A2E2B')
    .text(list, 40, doc.y, { width: doc.page.width - 80 });
  doc.moveDown(0.5);
}

function renderParticipant(doc, p) {
  drawHeader(doc, `Dicetak untuk keperluan internal panitia/sekolah`);

  sectionTitle(doc, 'Data Peserta');
  twoColumn(doc, 'Nama Lengkap', p.full_name, 'Peran', p.role);
  twoColumn(doc, 'Kelas', p.class, 'Program Keahlian / Jurusan', p.major);
  twoColumn(doc, 'No. HP Peserta', p.participant_phone, 'Email Peserta', p.participant_email);

  sectionTitle(doc, 'Kontak Orang Tua / Wali');
  twoColumn(doc, 'Nama Orang Tua/Wali', p.guardian_name, 'Hubungan', p.guardian_relation);
  twoColumn(doc, 'No. HP Utama', p.guardian_phone, 'No. HP Alternatif', p.guardian_alt_phone);

  sectionTitle(doc, 'Kondisi Medis');
  field(doc, 'Kondisi medis khusus', p.medical_conditions || 'Tidak ada');

  const hasAnyAllergy = p.has_drug_allergy === 'yes' || p.has_food_allergy === 'yes' || p.has_other_allergy === 'yes';
  field(doc, 'Alergi Obat', p.has_drug_allergy === 'yes' ? `Ya - ${safe(p.drug_allergy_detail)}` : 'Tidak', { alert: p.has_drug_allergy === 'yes' });
  field(doc, 'Alergi Makanan', p.has_food_allergy === 'yes' ? `Ya - ${safe(p.food_allergy_detail)}` : 'Tidak', { alert: p.has_food_allergy === 'yes' });
  field(doc, 'Alergi Lainnya', p.has_other_allergy === 'yes' ? `Ya - ${safe(p.other_allergy_detail)}` : 'Tidak', { alert: p.has_other_allergy === 'yes' });

  sectionTitle(doc, 'Obat-obatan yang Dibawa');
  const meds = parseJSON(p.medications, []);
  if (meds.length === 0) {
    doc.font('Helvetica').fontSize(10).fillColor(MUTED).text('Tidak membawa obat-obatan khusus.');
    doc.moveDown(0.5);
  } else {
    meds.forEach((m, i) => {
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#1A2E2B')
        .text(`${i + 1}. ${safe(m.name)}`, 40, doc.y);
      doc.font('Helvetica').fontSize(9.5).fillColor(MUTED)
        .text(`   Dosis: ${safe(m.dosage)}   |   Jadwal: ${safe(m.schedule)}`, 40, doc.y);
      doc.moveDown(0.3);
    });
  }

  sectionTitle(doc, 'Perlengkapan Ibadah & Mandi');
  checklistBlock(doc, `Perlengkapan ibadah (diisi ${safe(p.prayer_gear_timing, 'belum ditentukan')})`, parseJSON(p.prayer_gear, []));
  checklistBlock(doc, `Perlengkapan mandi (diisi ${safe(p.toiletries_timing, 'belum ditentukan')})`, parseJSON(p.toiletries, []));

  sectionTitle(doc, 'Kesejahteraan Peserta');
  field(doc, 'Ada masalah pribadi?', yesNo(p.has_personal_issue));
  if (p.has_personal_issue === 'yes') {
    field(doc, 'Bersedia menjelaskan?', yesNo(p.wants_to_explain));
    if (p.wants_to_explain === 'yes') {
      doc.font('Helvetica').fontSize(9.5).fillColor(MUTED).text('Penjelasan dari peserta:', 40, doc.y);
      doc.moveDown(0.2);
      doc.font('Helvetica').fontSize(10).fillColor('#1A2E2B')
        .text(safe(p.issue_detail, '-'), 40, doc.y, { width: doc.page.width - 80 });
      doc.moveDown(0.3);
    } else if (p.wants_to_explain === 'no') {
      doc.font('Helvetica-Oblique').fontSize(9.5).fillColor(MUTED)
        .text('Peserta diarahkan untuk menghubungi Bapak Rizky Ahmed Darmawan, S.M. jika diperlukan.', 40, doc.y, { width: doc.page.width - 80 });
      doc.moveDown(0.3);
    }
  }

  doc.moveDown(1);
  doc.font('Helvetica').fontSize(8).fillColor(MUTED)
    .text(`Data dikirim: ${safe(p.submitted_at)}   |   Terakhir diperbarui: ${safe(p.updated_at)}`, 40, doc.y);

  doc.moveDown(0.4);
  doc.font('Helvetica').fontSize(7.5).fillColor(MUTED)
    .text('Dokumen ini bersifat rahasia dan hanya untuk keperluan internal panitia/sekolah. Dilarang menyebarluaskan tanpa izin.', 40, doc.y, { width: doc.page.width - 80 });
}

function generateSinglePdf(res, participant) {
  const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="data-kesehatan-${(participant.full_name || 'peserta').replace(/[^a-z0-9]+/gi, '_')}.pdf"`
  );
  doc.pipe(res);
  renderParticipant(doc, participant);
  doc.end();
}

function generateBulkPdf(res, participants) {
  const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="rekap-data-kesehatan-peserta.pdf"');
  doc.pipe(res);
  participants.forEach((p, idx) => {
    if (idx > 0) doc.addPage();
    renderParticipant(doc, p);
  });
  if (participants.length === 0) {
    drawHeader(doc, 'Tidak ada data peserta');
    doc.font('Helvetica').fontSize(11).text('Belum ada peserta yang mengisi formulir.', 40, 120);
  }
  doc.end();
}

module.exports = { generateSinglePdf, generateBulkPdf };
