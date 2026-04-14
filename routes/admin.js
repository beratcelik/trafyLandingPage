const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const {
  getAllOrders, getOrderFull, updateOrderStatus,
  getAllProducts, getProduct, updateProduct,
  commitStockForOrder, releaseStockForOrder,
  getAllCareerApplications
} = require('../services/dbService');

// Tum admin route'lari auth gerektiriyor
router.use(adminAuth);

// GET /api/admin/orders -- Tum siparisler
router.get('/orders', (req, res) => {
  const filters = {};
  if (req.query.status) filters.status = req.query.status;
  if (req.query.date_from) filters.date_from = req.query.date_from;
  if (req.query.date_to) filters.date_to = req.query.date_to;

  const orders = getAllOrders(filters);
  res.json(orders);
});

// GET /api/admin/orders/:id -- Siparis detay
router.get('/orders/:id', (req, res) => {
  const order = getOrderFull(req.params.id);
  if (!order) {
    return res.status(404).json({ error: 'Siparis bulunamadi' });
  }
  res.json(order);
});

// POST /api/admin/orders/:id -- Siparis guncelle
router.post('/orders/:id', (req, res) => {
  const { status, tracking_number, carrier } = req.body;

  const validStatuses = ['ODEME_BEKLENIYOR', 'ODEME_ONAYLANDI', 'HAZIRLANIYOR', 'KARGODA', 'TESLIM_EDILDI', 'IPTAL'];
  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Gecersiz durum' });
  }

  const order = getOrderFull(req.params.id);
  if (!order) {
    return res.status(404).json({ error: 'Siparis bulunamadi' });
  }

  const newStatus = status || order.status;
  const oldStatus = order.status;

  const result = updateOrderStatus(req.params.id, newStatus, {
    tracking_number: tracking_number || undefined,
    carrier: carrier || undefined
  });

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Guncelleme basarisiz' });
  }

  // Stok hareketi: durum IPTAL'e gecerse ve stok committed ise geri ekle (iade)
  // Durum IPTAL'den aktif bir duruma donerse tekrar dus (manuel duzeltme)
  let stockMessage = null;
  if (newStatus === 'IPTAL' && oldStatus !== 'IPTAL') {
    const r = releaseStockForOrder(req.params.id);
    if (r.ok && !r.already) stockMessage = 'Stok iade edildi';
  } else if (oldStatus === 'IPTAL' && newStatus !== 'IPTAL') {
    const r = commitStockForOrder(req.params.id);
    if (!r.ok && r.reason === 'insufficient_stock') {
      return res.status(409).json({ error: 'Stok yetersiz -- durum degistirilemedi' });
    }
    if (r.ok && !r.already) stockMessage = 'Stok yeniden dusuldu';
  }

  res.json({ success: true, message: 'Siparis guncellendi' + (stockMessage ? ' -- ' + stockMessage : '') });
});

// ===== Urun yonetimi =====

// GET /api/admin/products -- Tum urunler (stok dahil)
router.get('/products', (req, res) => {
  res.json(getAllProducts());
});

// POST /api/admin/products/:slug -- Urun guncelle (fiyat ve/veya stok)
router.post('/products/:slug', (req, res) => {
  const existing = getProduct(req.params.slug);
  if (!existing) {
    return res.status(404).json({ error: 'Urun bulunamadi' });
  }

  const fields = {};
  if (req.body.name !== undefined) {
    if (typeof req.body.name !== 'string' || req.body.name.trim().length < 2) {
      return res.status(400).json({ error: 'Gecersiz isim' });
    }
    fields.name = req.body.name;
  }
  if (req.body.price !== undefined) {
    const price = parseInt(req.body.price);
    if (!Number.isInteger(price) || price < 0) {
      return res.status(400).json({ error: 'Gecersiz fiyat (kurus cinsinden pozitif tam sayi)' });
    }
    fields.price = price;
  }
  if (req.body.stock !== undefined) {
    const stock = parseInt(req.body.stock);
    if (!Number.isInteger(stock) || stock < 0) {
      return res.status(400).json({ error: 'Gecersiz stok' });
    }
    fields.stock = stock;
  }

  if (Object.keys(fields).length === 0) {
    return res.status(400).json({ error: 'Guncellenecek alan yok' });
  }

  updateProduct(req.params.slug, fields);
  res.json({ success: true, product: getProduct(req.params.slug) });
});

// GET /api/admin/career-applications -- Tum kariyer basvurulari
router.get('/career-applications', (req, res) => {
  res.json(getAllCareerApplications());
});

module.exports = router;
