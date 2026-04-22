const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const adminAuth = require('../middleware/adminAuth');
const {
  getAllOrders, getOrderFull, updateOrderStatus,
  getAllProducts, getProduct, updateProduct,
  commitStockForOrder, releaseStockForOrder,
  getAllCareerApplications,
  getAllApkVersions, getCurrentApkVersion, getApkVersionById, getApkVersionByCode,
  insertApkVersionAndActivate, activateApkVersion, deleteApkVersion
} = require('../services/dbService');
const apkSigner = require('../services/apkSigner');
const apkVerifier = require('../services/apkVerifier');

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

// ===== APK release manager =====

const APP_DIR = apkSigner.APP_DIR;
if (!fs.existsSync(APP_DIR)) fs.mkdirSync(APP_DIR, { recursive: true });

const APK_MAX_BYTES = (parseInt(process.env.APK_MAX_MB, 10) || 100) * 1024 * 1024;
const TMP_DIR = path.join(APP_DIR, '_tmp');
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, TMP_DIR),
    filename: (_req, _file, cb) => cb(null, `upload-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.apk`)
  }),
  limits: { fileSize: APK_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    // Multer dosyayi okumadan once cagriliyor; sadece extension/mime ile
    // kabaca eleyebiliriz. Asil dogrulama (magic bytes + apksigner) sonra.
    if (file.originalname && !file.originalname.toLowerCase().endsWith('.apk')) {
      return cb(new Error('Sadece .apk dosyalari kabul edilir'));
    }
    cb(null, true);
  }
});

function safeUnlink(filePath) {
  try { if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath); }
  catch (e) { console.error('safeUnlink:', e.message); }
}

function readZipMagic(filePath) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const buf = Buffer.alloc(4);
    fs.readSync(fd, buf, 0, 4, 0);
    return buf;
  } finally { fs.closeSync(fd); }
}

function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
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

// POST /api/admin/apk/upload -- multipart APK yukle
router.post('/apk/upload', (req, res) => {
  upload.single('apk')(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: `APK boyutu maksimum ${APK_MAX_BYTES / (1024*1024)}MB olabilir` });
      }
      return res.status(400).json({ error: err.message || 'Yukleme hatasi' });
    }
    if (!req.file) return res.status(400).json({ error: 'apk dosyasi gerekli' });

    const tempPath = req.file.path;
    let finalPath = null;

    try {
      // 1) Imzalama anahtari hazir mi? Yoksa sessizce yukleme yapip imzasiz
      // manifest yazmaktansa loud-fail.
      const signerStatus = apkSigner.getStatus();
      if (!signerStatus.keyExists) {
        throw new Error('Manifest imzalama anahtari bulunamadi. Once "node scripts/generate-apk-signing-key.js" calistirin.');
      }

      // 2) Form alanlari
      const versionCode = parseInt(req.body.versionCode, 10);
      const versionName = String(req.body.versionName || '').trim();
      const mandatory = req.body.mandatory === 'true' || req.body.mandatory === '1' || req.body.mandatory === 'on';
      const releaseNotesTr = String(req.body.releaseNotesTr || '').trim().slice(0, 4000);
      const releaseNotesEn = String(req.body.releaseNotesEn || '').trim().slice(0, 4000);

      if (!Number.isInteger(versionCode) || versionCode < 1) {
        throw new Error('versionCode pozitif tam sayi olmalidir');
      }
      if (!versionName || !/^[0-9.A-Za-z\-_+]{1,32}$/.test(versionName)) {
        throw new Error('versionName gecersiz (yalnizca harf/rakam/.-_+, max 32 karakter)');
      }
      if (getApkVersionByCode(versionCode)) {
        throw new Error(`versionCode ${versionCode} zaten yuklu. Lutfen artirin.`);
      }

      // 3) ZIP magic bytes (APK = ZIP arsivi)
      const magic = readZipMagic(tempPath);
      if (!(magic[0] === 0x50 && magic[1] === 0x4b && magic[2] === 0x03 && magic[3] === 0x04)) {
        throw new Error('Dosya gecerli bir APK/ZIP degil');
      }

      // 4) APK kendi imzasini dogrula
      const verify = await apkVerifier.verifyApk(tempPath);

      // 5) SHA-256
      const sha256 = await sha256File(tempPath);

      // 6) Final dosya adi -- versiyonlu, immutable
      const fileName = `trafy-${versionName}-vc${versionCode}.apk`;
      finalPath = path.join(APP_DIR, fileName);
      if (fs.existsSync(finalPath)) {
        throw new Error(`Hedef dosya zaten var: ${fileName}`);
      }
      fs.renameSync(tempPath, finalPath);

      const stat = fs.statSync(finalPath);

      // 7) DB'ye yaz + bu surumu aktif yap
      const id = insertApkVersionAndActivate({
        version_code: versionCode,
        version_name: versionName,
        file_name: fileName,
        file_size: stat.size,
        sha256,
        mandatory,
        release_notes_tr: releaseNotesTr,
        release_notes_en: releaseNotesEn,
        uploaded_by: 'admin',
        signer_cert_sha256: verify.certSha256,
        signature_scheme: verify.scheme
      });

      // 8) Manifest regenerate + imzala
      const row = getApkVersionById(id);
      const manifest = apkSigner.regenerateManifest(row);

      res.json({
        success: true,
        id,
        fileName,
        sha256,
        downloadUrl: `/app/${fileName}`,
        verify,
        manifest
      });
    } catch (e) {
      safeUnlink(tempPath);
      if (finalPath) safeUnlink(finalPath);
      const status = e.code === 'CERT_MISMATCH' ? 422 :
                     e.code === 'DEBUG_KEYSTORE' ? 422 :
                     e.code === 'V1_ONLY' ? 422 :
                     e.code === 'INVALID_SIGNATURE' ? 422 : 400;
      res.status(status).json({
        error: e.message,
        code: e.code,
        details: e.details
      });
    }
  });
});

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
