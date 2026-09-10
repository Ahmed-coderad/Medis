const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'medcheck.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  class TEXT NOT NULL,
  major TEXT NOT NULL,
  role TEXT NOT NULL,
  participant_phone TEXT,
  participant_email TEXT,
  guardian_name TEXT NOT NULL,
  guardian_relation TEXT,
  guardian_phone TEXT NOT NULL,
  guardian_alt_phone TEXT,
  medical_conditions TEXT,
  has_drug_allergy TEXT,
  drug_allergy_detail TEXT,
  has_food_allergy TEXT,
  food_allergy_detail TEXT,
  has_other_allergy TEXT,
  other_allergy_detail TEXT,
  medications TEXT,
  prayer_gear TEXT,
  prayer_gear_timing TEXT,
  toiletries TEXT,
  toiletries_timing TEXT,
  has_personal_issue TEXT,
  wants_to_explain TEXT,
  issue_detail TEXT,
  submitted_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contact_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  participant_id INTEGER NOT NULL,
  channel TEXT NOT NULL,
  target TEXT,
  message TEXT,
  status TEXT,
  sent_by TEXT,
  sent_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (participant_id) REFERENCES participants(id)
);
`);

function ensureDefaultAdmin() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM admins').get().c;
  if (count === 0) {
    const username = process.env.ADMIN_USERNAME || 'admin';
    const password = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
    const hash = bcrypt.hashSync(password, 10);
    db.prepare(
      'INSERT INTO admins (username, password_hash, full_name) VALUES (?, ?, ?)'
    ).run(username, hash, 'Administrator');
    console.log('----------------------------------------------------');
    console.log('Akun admin default dibuat:');
    console.log('  Username:', username);
    console.log('  Password:', password);
    console.log('Segera ganti password ini melalui berkas .env');
    console.log('----------------------------------------------------');
  }
}

ensureDefaultAdmin();

module.exports = db;
