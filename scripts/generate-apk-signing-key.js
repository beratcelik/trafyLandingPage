#!/usr/bin/env node
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const keyPath = process.env.APK_SIGN_KEY_PATH;
if (!keyPath) {
  console.error('HATA: APK_SIGN_KEY_PATH .env icinde tanimli degil.');
  console.error('Ornegin: APK_SIGN_KEY_PATH=/etc/trafy/apk_sign_private.pem');
  process.exit(1);
}

if (fs.existsSync(keyPath)) {
  console.error(`HATA: ${keyPath} zaten mevcut.`);
  console.error('Anahtari yenilemek icin once mevcut dosyayi guvenli bir sekilde yedekleyip silin.');
  console.error('UYARI: Anahtari degistirirseniz mevcut Android kurulumlari yeni manifesti reddeder.');
  process.exit(1);
}

const dir = path.dirname(keyPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
}

const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');

const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' });
fs.writeFileSync(keyPath, privPem, { mode: 0o400 });

const pubRaw = publicKey.export({ type: 'spki', format: 'der' }).slice(-32);
const pubB64 = pubRaw.toString('base64');

console.log('');
console.log('Ed25519 anahtar cifti olusturuldu.');
console.log('');
console.log(`Ozel anahtar yazildi: ${keyPath} (mode 0400)`);
console.log('');
console.log('OZEL ANAHTARI ASLA PAYLASMAYIN. Yedekleyin (offline) ve sunucudan disari cikarmayin.');
console.log('');
console.log('Public key (32 bytes, base64) -- Android uygulamasina ve .env icine yapistirin:');
console.log('');
console.log(`APK_SIGN_PUBLIC_B64=${pubB64}`);
console.log('');
console.log('Android tarafinda:');
console.log(`val TRAFY_UPDATE_PUBKEY = Base64.decode("${pubB64}", Base64.NO_WRAP)`);
console.log('');
