const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { orderRateLimiter } = require('../middleware/security');
const { createPreorder, countRecentPreorders, getAllProducts } = require('../services/dbService');

const preorderValidation = [
  body('product').custom(v => {
    const slugs = getAllProducts().map(p => p.slug);
    if (!slugs.includes(v)) throw new Error('Gecersiz urun');
    return true;
  }),
  body('quantity').optional().isInt({ min: 1, max: 10 }).withMessage('Gecersiz adet'),
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Ad soyad gerekli'),
  body('phone').trim().matches(/^05\d{9}$/).withMessage('Gecerli bir telefon numarasi girin (05xxxxxxxxx)'),
  body('email').trim().isEmail().normalizeEmail().withMessage('Gecerli bir email adresi girin'),
  body('note').optional().trim().isLength({ max: 500 })
];

// POST /api/preorders -- On-siparis olustur
router.post('/', orderRateLimiter, preorderValidation, (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array().map(e => e.msg) });
  }

  try {
    const recentCount = countRecentPreorders(req.body.phone, req.body.email);
    if (recentCount >= 3) {
      return res.status(429).json({ error: 'Son 1 saat icinde cok fazla on-siparis olusturuldu. Lutfen bekleyin.' });
    }

    const result = createPreorder(req.body);
    if (result.error === 'invalid_product') {
      return res.status(400).json({ error: 'Gecersiz urun' });
    }

    return res.json({
      id: result.id,
      productName: result.productName,
      quantity: result.quantity,
      message: 'On-siparisiniz alindi. Satislar acildiginda size haber verecegiz.'
    });
  } catch (err) {
    console.error('On-siparis olusturma hatasi:', err);
    return res.status(500).json({ error: 'Sunucu hatasi. Lutfen tekrar deneyin.' });
  }
});

module.exports = router;
