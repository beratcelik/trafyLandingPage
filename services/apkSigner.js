const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const APP_DIR = path.join(PUBLIC_DIR, 'app');
const MANIFEST_PATH = path.join(APP_DIR, 'update.json');
const SIG_PATH = path.join(APP_DIR, 'update.json.sig');

let cachedKey = null;
let cachedKeyPath = null;

function loadPrivateKey() {
  const keyPath = process.env.APK_SIGN_KEY_PATH;
  if (!keyPath) {
    throw new Error('APK_SIGN_KEY_PATH ayarli degil');
  }
  if (cachedKey && cachedKeyPath === keyPath) return cachedKey;
  const pem = fs.readFileSync(keyPath, 'utf8');
  cachedKey = crypto.createPrivateKey(pem);
  cachedKeyPath = keyPath;
  return cachedKey;
}

// Android tarafiyla bayt-bayt eslesen kanonik JSON: anahtarlar siralanmis,
// bosluk yok, UTF-8. Sadece duz objeler/dizeler/sayilar/booleanlar/null icin.
function canonicalStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalStringify).join(',') + ']';
  }
  const keys = Object.keys(value).sort();
  const parts = keys.map(k => JSON.stringify(k) + ':' + canonicalStringify(value[k]));
  return '{' + parts.join(',') + '}';
}

function getDomain() {
  return (process.env.DOMAIN || 'https://trafy.com.tr').replace(/\/$/, '');
}

function buildPayload(row) {
  return {
    versionCode: row.version_code,
    versionName: row.version_name,
    apkUrl: `${getDomain()}/app/${row.file_name}`,
    sha256: row.sha256,
    fileSize: row.file_size,
    mandatory: !!row.mandatory,
    releaseNotes: {
      en: row.release_notes_en || '',
      tr: row.release_notes_tr || ''
    },
    signedAt: new Date().toISOString()
  };
}

function signPayload(payload) {
  const key = loadPrivateKey();
  const canonical = Buffer.from(canonicalStringify(payload), 'utf8');
  const sigBuf = crypto.sign(null, canonical, key);
  return sigBuf.toString('base64');
}

// Manifest var mi diye check et (admin panelinde "imzalama anahtari aktif mi"
// rozeti icin).
function getStatus() {
  const keyPath = process.env.APK_SIGN_KEY_PATH;
  const status = {
    keyConfigured: !!keyPath,
    keyExists: false,
    publicKeyB64: process.env.APK_SIGN_PUBLIC_B64 || null,
    domain: getDomain()
  };
  try {
    if (keyPath && fs.existsSync(keyPath)) status.keyExists = true;
  } catch (_e) { /* ignore */ }
  return status;
}

// Atomik yaz: gecici dosya + rename (Android istemcisi yarim yazilmis JSON
// gormesin).
function writeAtomic(targetPath, content) {
  const tmp = targetPath + '.tmp';
  fs.writeFileSync(tmp, content, { mode: 0o644 });
  fs.renameSync(tmp, targetPath);
}

function regenerateManifest(currentRow) {
  if (!fs.existsSync(APP_DIR)) {
    fs.mkdirSync(APP_DIR, { recursive: true });
  }
  if (!currentRow) {
    // Aktif APK yok -- manifesti sil (Android uygulamasi 404 alip sessizce
    // gecsin).
    if (fs.existsSync(MANIFEST_PATH)) fs.unlinkSync(MANIFEST_PATH);
    if (fs.existsSync(SIG_PATH)) fs.unlinkSync(SIG_PATH);
    return null;
  }
  const payload = buildPayload(currentRow);
  const signature = signPayload(payload);
  const signed = { ...payload, signature };
  writeAtomic(MANIFEST_PATH, JSON.stringify(signed, null, 2) + '\n');
  writeAtomic(SIG_PATH, signature + '\n');
  return signed;
}

module.exports = {
  regenerateManifest,
  getStatus,
  canonicalStringify,
  buildPayload,
  signPayload,
  APP_DIR,
  MANIFEST_PATH,
  SIG_PATH
};
