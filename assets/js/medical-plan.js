/* global window */
// ============================================================================
// MedicalPlan — mesin aturan bersama untuk "Rencana Penanganan Medis Otomatis".
// Dipakai oleh formulir peserta (form.js, saat data dikirim/diubah) DAN panel
// admin (admin.js, tab "Analisis Medis" — termasuk untuk menghitung ulang
// rencana bagi data lama yang belum memilikinya tersimpan), supaya aturannya
// satu sumber kebenaran dan tidak pernah berbeda di dua tempat.
//
// PENTING: ini BUKAN mesin diagnosis medis. Ini hanya mencocokkan kata kunci
// dari jawaban peserta sendiri (kondisi medis, alergi, obat yang dibawa,
// kesejahteraan) dengan daftar tindakan kesiapsiagaan standar, supaya
// guru/staf medis punya titik awal yang cepat dibaca — keputusan akhir tetap
// di tangan mereka.
// ============================================================================
(function (global) {
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
  const INTRO = 'Rencana ini disusun otomatis oleh sistem berdasarkan jawaban kesehatan & kesejahteraan yang diisi — bukan diagnosis medis, hanya panduan kesiapsiagaan untuk guru/staf medis.';

  const PRIORITY_RANK = { 'Prioritas Tinggi': 2, 'Perlu Perhatian': 1, Normal: 0 };

  function priorityExplanation(priority) {
    if (priority === 'Prioritas Tinggi') return 'Artinya kondisinya perlu perhatian ekstra dari guru/staf medis sejak awal kegiatan.';
    if (priority === 'Perlu Perhatian') return 'Artinya kondisinya tidak darurat, tapi tetap perlu diketahui & dipantau guru/staf medis.';
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

  // d = objek data peserta (dari FormData formulir ATAU dokumen Firestore —
  // keduanya memakai nama field yang sama, jadi fungsi ini bisa dipakai
  // langsung untuk keduanya).
  function build(d) {
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
      intro: INTRO,
      generated_at_client: new Date().toISOString(),
    };
  }

  global.MedicalPlan = { build, priorityExplanation, detectConditionPoints, PRIORITY_RANK, INTRO };
})(window);
