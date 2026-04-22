// Agent / CI -> APK upload icin dar kapsamli token. ADMIN_SECRET'tan ayri
// olarak tutulur ki sizmasi durumunda saldirgan orders/products/careers
// route'larina erisemesin (en az ayricalik).

const crypto = require('crypto');

function timingSafeEqualStr(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function apkUploadAuth(req, res, next) {
  const expected = process.env.APK_UPLOAD_TOKEN;
  if (!expected || expected.length < 32) {
    return res.status(503).json({
      error: 'APK upload API devre disi. Sunucu .env icine APK_UPLOAD_TOKEN ekleyin (>= 32 karakter).'
    });
  }
  const provided = req.headers['x-apk-upload-token'];
  if (!provided || !timingSafeEqualStr(String(provided), expected)) {
    return res.status(401).json({ error: 'Yetkisiz: gecerli APK_UPLOAD_TOKEN gerekli.' });
  }
  req.uploaderTag = 'agent';
  next();
}

module.exports = apkUploadAuth;
