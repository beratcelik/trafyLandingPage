const express = require('express');
const router = express.Router();
const { getAllProducts, isSalesEnabled } = require('../services/dbService');

// GET /api/products -- Public urun listesi (fiyatlar + stok durumu)
router.get('/', (req, res) => {
  // Public: stok sayisi acik gosterilmez, sadece inStock flag
  const products = getAllProducts().map(p => ({
    slug: p.slug,
    name: p.name,
    price: p.price,           // kurus
    priceTL: p.price / 100,   // lira
    inStock: p.stock > 0
  }));
  res.json(products);
});

// GET /api/products/config -- Public site durumu (satis acik mi vb.)
router.get('/config', (req, res) => {
  res.json({ salesEnabled: isSalesEnabled() });
});

module.exports = router;
