const express = require('express');
const router = express.Router();
const { getCurrentApkVersion } = require('../services/dbService');

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

module.exports = router;
