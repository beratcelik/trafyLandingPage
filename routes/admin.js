const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const adminAuth = require('../middleware/adminAuth');
const {
  getAllOrders, getOrderFull, updateOrderStatus,
  getAllProducts, getProduct, updateProduct,
  commitStockForOrder, releaseStockForOrder,
  getAllPreorders, markPreorderNotified, cancelAllMockOrders,
  getSetting, setSetting, isSalesEnabled,
  getAllCareerApplications,
  getAllApkVersions, getCurrentApkVersion, getApkVersionById,
  activateApkVersion, deleteApkVersion
} = require('../services/dbService');
const apkSigner = require('../services/apkSigner');
const apkVerifier = require('../services/apkVerifier');
const { upload, handleApkUpload, multerErrorHandler, APP_DIR } = require('../services/apkUploadHandler');

// Tum admin route'lari auth gerektiriyor
router.use(adminAuth);

// GET /api/admin/orders -- Tum siparisler
router.get('/orders', (req, res) => {
  const filters = {};
  if (req.query.status) filters.status = req.query.status;
  if (req.query.date_from) filters.date_from = req.query.date_from;
  if (req.query.date_to) filters.date_to = req.query.date_to;
  if (req.query.mock === 'true') filters.mock = true;

  const orders = getAllOrders(filters);
  res.json(orders);
});

// ===== Ayarlar =====

// GET /api/admin/settings -- Tum ayarlar
router.get('/settings', (req, res) => {
  res.json({
    sales_enabled: isSalesEnabled()
  });
});

// POST /api/admin/settings/sales-enabled -- Satis akisi toggle
router.post('/settings/sales-enabled', (req, res) => {
  const enabled = req.body && req.body.enabled === true;
  setSetting('sales_enabled', enabled ? 'true' : 'false');
  res.json({ success: true, sales_enabled: enabled });
});

// ===== On-siparis yonetimi =====

// GET /api/admin/preorders -- Tum on-siparisler
router.get('/preorders', (req, res) => {
  res.json(getAllPreorders());
});

// POST /api/admin/preorders/:id/notified -- On-siparisi "haber verildi" isaretle
router.post('/preorders/:id/notified', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Gecersiz id' });
  const notified = req.body && req.body.notified === false ? false : true;
  const changes = markPreorderNotified(id, notified);
  if (changes === 0) return res.status(404).json({ error: 'On-siparis bulunamadi' });
  res.json({ success: true, notified });
});

// POST /api/admin/orders/cancel-mock -- Tum mock siparisleri IPTAL yap
router.post('/orders/cancel-mock', (req, res) => {
  const count = cancelAllMockOrders();
  res.json({ success: true, cancelled: count });
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

// ===== APK release manager =====

function safeUnlink(filePath) {
  try { if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath); }
  catch (e) { console.error('safeUnlink:', e.message); }
}

// GET /api/admin/apk/status -- Imzalama anahtari + apksigner saglik
router.get('/apk/status', async (req, res) => {
  const signer = apkSigner.getStatus();
  const verifier = await apkVerifier.healthCheck();
  const pinned = apkVerifier.getPinnedFingerprint();
  const current = getCurrentApkVersion();
  res.json({
    signer,
    verifier,
    pinnedCert: pinned ? apkVerifier.formatFingerprint(pinned) : null,
    current
  });
});

// GET /api/admin/apk/versions -- tum surumler
router.get('/apk/versions', (req, res) => {
  res.json(getAllApkVersions());
});

// POST /api/admin/apk/upload -- multipart APK yukle (paylasilan handler)
router.post('/apk/upload',
  (req, _res, next) => { req.uploaderTag = 'admin'; next(); },
  upload.single('apk'),
  multerErrorHandler,
  handleApkUpload
);

// POST /api/admin/apk/activate/:id -- onceki bir surumu aktif yap (rollback)
router.post('/apk/activate/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Gecersiz id' });
  const r = activateApkVersion(id);
  if (!r.ok) return res.status(404).json({ error: 'Surum bulunamadi' });
  const current = getCurrentApkVersion();
  apkSigner.regenerateManifest(current);
  res.json({ success: true, current });
});

// DELETE /api/admin/apk/:id
router.delete('/apk/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Gecersiz id' });
  const row = getApkVersionById(id);
  if (!row) return res.status(404).json({ error: 'Surum bulunamadi' });
  if (row.is_current) {
    return res.status(409).json({ error: 'Aktif surum silinemez. Once baska bir surumu aktif yapin.' });
  }
  const r = deleteApkVersion(id);
  if (!r.ok) return res.status(409).json({ error: r.reason });
  // Dosyayi sil
  safeUnlink(path.join(APP_DIR, row.file_name));
  res.json({ success: true });
});

module.exports = router;
