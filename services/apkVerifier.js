const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const PINNED_FILE = path.join(__dirname, '..', 'db', 'apk_release_cert.txt');

class ApkVerifyError extends Error {
  constructor(code, message, details) {
    super(message);
    this.code = code;
    this.details = details || null;
  }
}

function getApksignerPath() {
  return process.env.APKSIGNER_PATH || 'apksigner';
}

function getPinnedFingerprint() {
  if (process.env.APK_RELEASE_CERT_SHA256) {
    return process.env.APK_RELEASE_CERT_SHA256.toUpperCase().replace(/\s/g, '');
  }
  try {
    if (fs.existsSync(PINNED_FILE)) {
      return fs.readFileSync(PINNED_FILE, 'utf8').trim().toUpperCase();
    }
  } catch (_e) { /* ignore */ }
  return null;
}

function bootstrapPinnedFingerprint(fp) {
  try {
    fs.writeFileSync(PINNED_FILE, fp + '\n', { mode: 0o600 });
    return true;
  } catch (e) {
    console.error('apk_release_cert.txt yazilirken hata:', e.message);
    return false;
  }
}

function healthCheck() {
  return new Promise((resolve) => {
    execFile(getApksignerPath(), ['--version'], { timeout: 5000 }, (err, stdout) => {
      if (err) return resolve({ ok: false, error: err.message });
      resolve({ ok: true, version: String(stdout).trim() });
    });
  });
}

function runApksigner(filePath) {
  return new Promise((resolve, reject) => {
    execFile(
      getApksignerPath(),
      ['verify', '--print-certs', '--verbose', filePath],
      { timeout: 30000, maxBuffer: 4 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          return reject(new ApkVerifyError(
            'INVALID_SIGNATURE',
            'APK imzasi gecersiz veya eksik',
            (stdout + '\n' + stderr).slice(0, 2000)
          ));
        }
        resolve(String(stdout));
      }
    );
  });
}

function parseOutput(output) {
  const lines = output.split('\n');
  const verified = {};
  let certSha256 = null;
  let certDn = null;
  for (const line of lines) {
    const t = line.trim();
    let m;
    if ((m = t.match(/^Verified using v(\d) scheme.*:\s*(true|false)/))) {
      verified[`v${m[1]}`] = m[2] === 'true';
    }
    if (!certSha256 && (m = t.match(/Signer #1 certificate SHA-256 digest:\s*([0-9a-fA-F]+)/))) {
      certSha256 = m[1].toUpperCase();
    }
    if (!certDn && (m = t.match(/Signer #1 certificate DN:\s*(.+)/))) {
      certDn = m[1];
    }
  }
  return { verified, certSha256, certDn };
}

function formatFingerprint(hex) {
  // 64 hex karakteri AB:CD:.. seklinde grupla (apksigner cikti formati)
  return hex.toUpperCase().match(/.{1,2}/g).join(':');
}

async function verifyApk(filePath) {
  const stdout = await runApksigner(filePath);
  const { verified, certSha256, certDn } = parseOutput(stdout);

  if (!certSha256) {
    throw new ApkVerifyError('NO_CERT', 'APK sertifikasi okunamadi', stdout.slice(0, 1000));
  }

  let scheme = null;
  if (verified.v3) scheme = 'v3';
  else if (verified.v2) scheme = 'v2';
  if (!scheme) {
    throw new ApkVerifyError(
      'V1_ONLY',
      'v2 veya v3 imza sart. Lutfen APK Signing Scheme v2 ile yeniden imzalayin.',
      stdout.slice(0, 1000)
    );
  }

  // Android studio debug keystore default DN'si -- CN=Android Debug.
  // Her makinede ayri sha olustuguicin dn uzerinden yakalamak daha guvenli.
  if (certDn && /CN=Android Debug/i.test(certDn)) {
    throw new ApkVerifyError(
      'DEBUG_KEYSTORE',
      'Debug imzali APK reddedildi. Release build yukleyin.',
      { certDn }
    );
  }

  const expected = getPinnedFingerprint();
  const expectedNorm = expected ? expected.replace(/[^0-9A-F]/g, '') : null;

  if (!expectedNorm) {
    bootstrapPinnedFingerprint(formatFingerprint(certSha256));
    return {
      ok: true,
      certSha256,
      certFingerprint: formatFingerprint(certSha256),
      certDn,
      scheme,
      bootstrap: true
    };
  }

  if (expectedNorm !== certSha256) {
    throw new ApkVerifyError(
      'CERT_MISMATCH',
      'Sertifika eslesmiyor. Yanlis keystore ile imzalanmis olabilir.',
      {
        expected: formatFingerprint(expectedNorm),
        actual: formatFingerprint(certSha256)
      }
    );
  }

  return {
    ok: true,
    certSha256,
    certFingerprint: formatFingerprint(certSha256),
    certDn,
    scheme,
    bootstrap: false
  };
}

module.exports = {
  ApkVerifyError,
  verifyApk,
  healthCheck,
  getPinnedFingerprint,
  formatFingerprint
};
