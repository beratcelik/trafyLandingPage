require('dotenv').config();
const express = require('express');
const path = require('path');
const { securityMiddleware, rateLimiter } = require('./middleware/security');
const { initDatabase } = require('./services/dbService');

const app = express();
const PORT = process.env.PORT || 3000;

// Guvenlik middleware'leri
securityMiddleware(app);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use('/api/', rateLimiter);

// API Routes
app.use('/api/orders', require('./routes/orders'));
app.use('/api/payment', require('./routes/payment'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/products', require('./routes/products'));
app.use('/api/career-applications', require('./routes/career'));
app.use('/api/app', require('./routes/app'));

// /app/* statik dosyalari icin cache + indirme header'lari (express.static'ten once mount edilmeli)
app.use('/app', (req, res, next) => {
  if (req.path === '/update.json' || req.path === '/update.json.sig') {
    res.set('Cache-Control', 'no-cache, must-revalidate');
  } else if (req.path.endsWith('.apk')) {
    // Versiyonlu dosya isimleri immutable -- agressif cachele
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.set('Content-Type', 'application/vnd.android.package-archive');
    res.set('Content-Disposition', `attachment; filename="${path.basename(req.path)}"`);
  }
  next();
});

// Statik dosyalar
app.use(express.static(path.join(__dirname, 'public')));

// SPA fallback -- bilinen sayfalar icin
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Veritabanini baslat ve sunucuyu calistir
initDatabase();

app.listen(PORT, () => {
  console.log(`Trafy sunucusu port ${PORT} uzerinde calisiyor`);
});
