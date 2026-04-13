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
