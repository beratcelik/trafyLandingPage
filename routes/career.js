const express = require('express');
const router = express.Router();
const { createCareerApplication } = require('../services/dbService');

// POST /api/career-applications -- Public kariyer basvurusu
router.post('/', (req, res) => {
  try {
    const {
      name, email, phone, position, linkedin, message,
      website, // honeypot: bot doldurursa gercek insan degil
      form_loaded_at // client tarafindan set edilen yuklenme zamani (ms)
    } = req.body || {};

    // 1) Honeypot: gorunmeyen alan dolu ise bot
    if (website && String(website).trim() !== '') {
      return res.status(400).json({ error: 'spam_detected' });
    }

    // 2) Minimum gonderim suresi: form yuklendikten 3 saniye gecmeden gonderilemez
    const loadedAt = Number(form_loaded_at);
    if (!Number.isFinite(loadedAt) || (Date.now() - loadedAt) < 3000) {
      return res.status(400).json({ error: 'too_fast' });
    }

    // 3) Temel validasyon
    if (!name || !email) {
      return res.status(400).json({ error: 'name ve email zorunludur' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
      return res.status(400).json({ error: 'Gecersiz e-posta' });
    }

    const result = createCareerApplication({ name, email, phone, position, linkedin, message });
    res.json({ ok: true, id: result.id });
  } catch (err) {
    console.error('career application error:', err);
    res.status(500).json({ error: 'internal' });
  }
});

module.exports = router;
