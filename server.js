require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');

const apiRoutes = require('./routes/api');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'ganti-secret-ini-di-env',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 8, // 8 jam
      secure: process.env.NODE_ENV === 'production' && process.env.FORCE_HTTPS === 'true',
    },
  })
);

app.use('/api', apiRoutes);
app.use('/admin/api', adminRoutes);

// Halaman-halaman utama didaftarkan SEBELUM express.static, supaya
// permintaan ke "/admin" langsung dilayani (200) tanpa perlu dialihkan
// (redirect) ke "/admin/" terlebih dahulu.
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});
app.get('/admin/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'dashboard.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res) => {
  res.status(404).send('Halaman tidak ditemukan.');
});

app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});
