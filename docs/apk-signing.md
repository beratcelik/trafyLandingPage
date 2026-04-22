# APK release manager — imzalama spec

Iki bagimsiz imzalama sistemi var. Her ikisi de v1'de aktif.

## 1. Manifest signing (server -> Android)

`update.json` dosyasi sunucuda ed25519 ile imzalanir. Android uygulamasi public key'i gomulu tutar ve indirdigi manifesti dogrular. Boylece sunucu/DNS ele gecirilse bile saldirgan kullaniciya sahte bir guncelleme push edemez (private key sunucu disinda durur).

### Akis

1. Admin yeni APK yukler -> server `apkSigner.regenerateManifest(row)` cagirir
2. `buildPayload(row)` -> manifest objesi (signature alani **hic eklenmez**)
3. Canonical JSON (siralanmis anahtarlar, bosluk yok, UTF-8) olarak serialize edilir
4. ed25519 ile imzalanir, base64 -> `signature` alani eklenir
5. `update.json` ve `update.json.sig` atomik (tmp + rename) olarak diske yazilir

### Canonical JSON kurali (Android tarafi tam olarak ayni sekilde uygulamali)

```js
function canonicalStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalStringify).join(',') + ']';
  const keys = Object.keys(value).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalStringify(value[k])).join(',') + '}';
}
```

RFC 8785 (JCS) uyumludur. Onemli noktalar:
- Dict anahtarlari **alfabetik** siralanir (codepoint bazli)
- Hicbir bosluk/satir sonu yok
- String'ler ASCII-safe JSON escape (`\"`, `\\`, `\n`, vb. -- `JSON.stringify` zaten yapiyor)
- Sayilar IEEE 754 double; integer ise integer olarak basilir

### Android tarafinda dogrulama (Kotlin pseudocode)

```kotlin
val TRAFY_UPDATE_PUBKEY = Base64.decode("...32 byte raw key...", Base64.NO_WRAP)

fun verifyManifest(jsonText: String): Manifest? {
    val obj = JSONObject(jsonText)
    val sigB64 = obj.optString("signature", null) ?: return null
    obj.remove("signature")
    val canonical = canonicalStringify(obj).toByteArray(Charsets.UTF_8)
    val sig = Base64.decode(sigB64, Base64.NO_WRAP)
    val pubKey = KeyFactory.getInstance("Ed25519")
        .generatePublic(X509EncodedKeySpec(buildSpki(TRAFY_UPDATE_PUBKEY)))
    val verifier = Signature.getInstance("Ed25519").apply {
        initVerify(pubKey)
        update(canonical)
    }
    if (!verifier.verify(sig)) return null
    return parseManifest(obj)
}
```

> Not: Android API < 33 icin Tink veya BouncyCastle ile polyfill gerekir. Ham 32-byte ed25519 key'i SPKI sarmalamak icin standard ASN.1 prefix'i ekleyin: `302a300506032b6570032100 || rawKey`.

### Anahtar yonetimi

- Private key: `/etc/trafy/apk_sign_private.pem`, mode 0400, owner = node user
- Olusturma: `node scripts/generate-apk-signing-key.js` (bir defa)
- Public key: `.env` icindeki `APK_SIGN_PUBLIC_B64` ve Android source kodu
- Yedek: private key'i offline (USB / sifreli vault) yedekleyin. Kaybederseniz mevcut Android kurulumlari yeni manifesti reddeder, kullanicilar ya manuel reinstall ya da yeni bir public key gomulu yeni bir APK ile guncellenmek zorunda kalir.

### Anahtar rotation (gerektiginde)

1. Yeni anahtar uretilir
2. Bir Android release yapilir; bu release **hem eski hem yeni public key'i** kabul eder
3. Bu release yaygin sekilde dagildiktan sonra server yeni anahtarla imzalamaya baslar
4. Sonraki release sadece yeni public key'i icerir, eski destegi kaldirir

## 2. APK self-signature verification (yukleme tarafi)

`apksigner verify --print-certs --verbose <file>` cikisi parse edilir ve:
- v2 veya v3 imza semasi kontrolu
- Sertifika SHA-256 hash'i pinned `APK_RELEASE_CERT_SHA256` ile esleme
- Debug keystore (CN=Android Debug) reddi

Bu, yanlis keystore ile imzalanmis APK'yi (debug build, yeni dev makinesi, vb.) kabul etmeyi engeller. Yanlis APK push edilirse mevcut Android kurulumlari "App not installed" hatasi alir ve bu durumdan cikis cok zor olur, bu yuzden pre-flight check kritik.

### Sunucu prerequisite

Ubuntu / Debian:
```bash
sudo apt install android-sdk-build-tools
which apksigner   # /usr/bin/apksigner
```

veya manuel:
```bash
# commandlinetools-linux indirip:
sdkmanager "build-tools;34.0.0"
# .env'e ekle:
APKSIGNER_PATH=/opt/android-sdk/build-tools/34.0.0/apksigner
```

### Bootstrap (ilk yukleme)

`APK_RELEASE_CERT_SHA256` bos olursa server **ilk yuklenen APK'nin** sertifika fingerprint'ini `db/apk_release_cert.txt` icine yazar. Admin UI'de uyari gosterilir; .env'e kalici olarak yazilmasi tavsiye edilir.

### Hata kodlari

| code | HTTP | Anlam |
|---|---|---|
| `INVALID_SIGNATURE` | 422 | apksigner verify basarisiz (genelde bozuk dosya) |
| `NO_CERT` | 422 | Sertifika cikistan parse edilemedi |
| `V1_ONLY` | 422 | v2/v3 imza yok (sadece v1) -- Janus saldirisina acik |
| `DEBUG_KEYSTORE` | 422 | CN=Android Debug -- release build degil |
| `CERT_MISMATCH` | 422 | SHA-256 pinned cert ile eslesmiyor |
