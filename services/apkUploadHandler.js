// APK upload pipeline -- iki giris noktasindan paylasilan tek handler.
// Hem admin paneli (X-Admin-Secret ile) hem agent CI yolu (X-APK-Upload-Token
// ile) bu handler'i cagirir, davranis tamamen aynidir. uploaderTag ile
// kim yukledigi audit'lenir.

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const apkSigner = require('./apkSigner');
const apkVerifier = require('./apkVerifier');
const {
  getApkVersionByCode, getApkVersionById, insertApkVersionAndActivate
} = require('./dbService');

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

// Tek upload handler -- caller multer middleware'i mount etmis olmali
async function handleApkUpload(req, res) {
  if (!req.file) return res.status(400).json({ error: 'apk dosyasi gerekli' });

  const tempPath = req.file.path;
  let finalPath = null;

  try {
    const signerStatus = apkSigner.getStatus();
    if (!signerStatus.keyExists) {
      throw new Error('Manifest imzalama anahtari bulunamadi. Once "node scripts/generate-apk-signing-key.js" calistirin.');
    }

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

    const magic = readZipMagic(tempPath);
    if (!(magic[0] === 0x50 && magic[1] === 0x4b && magic[2] === 0x03 && magic[3] === 0x04)) {
      throw new Error('Dosya gecerli bir APK/ZIP degil');
    }

    const verify = await apkVerifier.verifyApk(tempPath);
    const sha256 = await sha256File(tempPath);

    const fileName = `trafy-${versionName}-vc${versionCode}.apk`;
    finalPath = path.join(APP_DIR, fileName);
    if (fs.existsSync(finalPath)) {
      throw new Error(`Hedef dosya zaten var: ${fileName}`);
    }
    fs.renameSync(tempPath, finalPath);

    const stat = fs.statSync(finalPath);

    const id = insertApkVersionAndActivate({
      version_code: versionCode,
      version_name: versionName,
      file_name: fileName,
      file_size: stat.size,
      sha256,
      mandatory,
      release_notes_tr: releaseNotesTr,
      release_notes_en: releaseNotesEn,
      uploaded_by: req.uploaderTag || 'unknown',
      signer_cert_sha256: verify.certSha256,
      signature_scheme: verify.scheme
    });

    const row = getApkVersionById(id);
    const manifest = apkSigner.regenerateManifest(row);

    // Audit log -- IP + uploader tag + version + cert pin status
    const ip = (req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim();
    console.log(`[apk-upload] ok uploader=${req.uploaderTag || 'unknown'} ip=${ip} versionCode=${versionCode} versionName=${versionName} bootstrap=${verify.bootstrap === true}`);

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
    const ip = (req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim();
    console.warn(`[apk-upload] reject uploader=${req.uploaderTag || 'unknown'} ip=${ip} code=${e.code || '-'} msg=${e.message}`);
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
}

// multer hata yakalayicisi -- LIMIT_FILE_SIZE 413 dondursun
function multerErrorHandler(err, _req, res, next) {
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: `APK boyutu maksimum ${APK_MAX_BYTES / (1024*1024)}MB olabilir` });
  }
  if (err) return res.status(400).json({ error: err.message || 'Yukleme hatasi' });
  next();
}

module.exports = {
  upload,
  handleApkUpload,
  multerErrorHandler,
  APP_DIR,
  APK_MAX_BYTES
};
