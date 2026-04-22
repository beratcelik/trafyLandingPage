const express = require('express');
const router = express.Router();
const { getCurrentApkVersion } = require('../services/dbService');
const apkUploadAuth = require('../middleware/apkUploadAuth');
const apkSigner = require('../services/apkSigner');
const apkVerifier = require('../services/apkVerifier');
const { upload, handleApkUpload, multerErrorHandler } = require('../services/apkUploadHandler');

// GET /api/app/latest -- aktif APK'ya 302 yonlendir.
// Public link sabit kalsin, dosya ismini bilmeye gerek olmasin.
router.get('/latest', (req, res) => {
  const current = getCurrentApkVersion();
  if (!current) {
    return res.status(404).json({ error: 'Henuz yayinlanmis bir Android surumu yok' });
  }
  res.redirect(302, `/app/${current.file_name}`);
});

// GET /api/app/info -- aktif APK metadatasi (versionName, sha256, fileSize)
// Landing page footer "v1.1.0" rozeti icin.
router.get('/info', (req, res) => {
  const current = getCurrentApkVersion();
  if (!current) return res.status(404).json({ error: 'no_release' });
  res.set('Cache-Control', 'public, max-age=60');
  res.json({
    versionCode: current.version_code,
    versionName: current.version_name,
    sha256: current.sha256,
    fileSize: current.file_size,
    mandatory: !!current.mandatory,
    uploadedAt: current.uploaded_at,
    downloadUrl: `/app/${current.file_name}`
  });
});

// ===== Agent / CI APK upload API =====

// GET /api/app/upload/preflight -- agent token gecerli mi + sunucu hazir mi?
// Agent yuklemeye baslamadan once 1 cagri ile sigin durumunu, pinli sertifikayi
// ve mevcut surumu gorebilsin. (Apk dosyasi tasimaz, hizli ve ucuz.)
router.get('/upload/preflight', apkUploadAuth, async (req, res) => {
  const signer = apkSigner.getStatus();
  const verifier = await apkVerifier.healthCheck();
  const pinned = apkVerifier.getPinnedFingerprint();
  const current = getCurrentApkVersion();
  res.json({
    ok: signer.keyExists && verifier.ok,
    signerReady: signer.keyExists,
    verifierReady: !!verifier.ok,
    verifierVersion: verifier.version || null,
    pinnedCert: pinned ? apkVerifier.formatFingerprint(pinned) : null,
    currentVersionCode: current ? current.version_code : null,
    currentVersionName: current ? current.version_name : null,
    nextSuggestedVersionCode: current ? current.version_code + 1 : 1
  });
});

// POST /api/app/upload -- multipart/form-data
// Auth: X-APK-Upload-Token header (ADMIN_SECRET ile karistirilmamali)
// Form alanlari: apk (file), versionCode (int), versionName (string),
//   mandatory (bool), releaseNotesTr, releaseNotesEn
router.post('/upload',
  apkUploadAuth,
  upload.single('apk'),
  multerErrorHandler,
  handleApkUpload
);

module.exports = router;
