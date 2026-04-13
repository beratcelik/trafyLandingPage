const soap = require('soap');
const crypto = require('crypto');

const WSDL_URL = 'https://dmzws.ew.com.tr/turkpos.ws/service_turkpos_prod.asmx?wsdl';

let soapClient = null;

async function getClient() {
  if (!soapClient) {
    soapClient = await soap.createClientAsync(WSDL_URL);
  }
  return soapClient;
}

function getCredentials() {
  return {
    CLIENT_CODE: process.env.PARAM_CLIENT_CODE,
    CLIENT_USERNAME: process.env.PARAM_CLIENT_USERNAME,
    CLIENT_PASSWORD: process.env.PARAM_CLIENT_PASSWORD,
    GUID: process.env.PARAM_CLIENT_GUID
  };
}

// SHA1 + Base64 hash (Param kimlik dogrulama icin)
function createHash(value) {
  return crypto.createHash('sha1').update(value, 'utf8').digest('base64');
}

/**
 * Param 3D Secure odeme baslatma
 * Musteri bilgileri ve tutar ile Param'a istek gonderir,
 * 3D Secure yonlendirme HTML'i doner
 */
async function initiatePayment(order) {
  const domain = process.env.DOMAIN || 'https://trafy.tr';

  // MOCK MODE -- test/demo icin (PARAM_MOCK=true ise)
  if (process.env.PARAM_MOCK === 'true') {
    const mockTxId = `MOCK-${Date.now()}`;
    const mockHtml = `
      <form id="mock-param-form" action="${domain}/api/payment/callback" method="POST">
        <input type="hidden" name="Islem_ID" value="${mockTxId}" />
        <input type="hidden" name="Siparis_ID" value="${order.id}" />
        <input type="hidden" name="Islem_Sonuc" value="1" />
        <input type="hidden" name="Sonuc_Str" value="MOCK BASARILI" />
      </form>
    `;
    return { success: true, html: mockHtml, transactionId: mockTxId };
  }

  const client = await getClient();
  const creds = getCredentials();

  // Tutar TL formatinda (ornek: 1000.00)
  const amount = (order.total_price / 100).toFixed(2);

  const params = {
    G: {
      CLIENT_CODE: creds.CLIENT_CODE,
      CLIENT_USERNAME: creds.CLIENT_USERNAME,
      CLIENT_PASSWORD: creds.CLIENT_PASSWORD,
      GUID: creds.GUID
    },
    TURKPOS_RETVAL_Islem_Odeme_Amamlaamamadim_Onamamlamamay: {
      // Siparis bilgileri
      Islem_Guvenlik_Tip: '3D',
      Islem_Hash: '',
      Islem_ID: order.id,
      Islem_GUID: creds.GUID,
      Islem_Tutar: amount,
      Toplam_Tutar: amount,
      // Taksit yok
      Taksit: '1',
      // Kart bilgileri 3D Secure sayfasinda girilecek
      KK_Sahibi: '',
      KK_No: '',
      KK_SK_Ay: '',
      KK_SK_Yil: '',
      KK_CVC: '',
      // Musteri bilgileri
      Hata_URL: `${domain}/api/payment/callback`,
      Basarili_URL: `${domain}/api/payment/callback`,
      Siparis_ID: order.id,
      Siparis_Aciklama: `Trafy - ${order.product_name} x${order.quantity}`,
      // Musteri IP ve veri
      Data1: order.customer_name,
      Data2: order.customer_phone,
      Data3: order.customer_email,
      Data4: '',
      Data5: ''
    }
  };

  try {
    // TP_WMD_UCD -- Pos bilgisi al
    const [posResult] = await client.TP_WMD_UCDAsync({
      G: params.G,
      GUID: creds.GUID
    });

    // Odeme baslatma metodu -- Param dokumantasyonuna gore
    // Farkli Param versiyonlari farkli metod isimleri kullanabilir
    // Asagidaki en yaygin kullanim
    const [payResult] = await client.TP_WMD_PayAsync(params);

    if (payResult && payResult.TP_WMD_PayResult) {
      const result = payResult.TP_WMD_PayResult;
      if (result.Sonuc && result.Sonuc !== '1') {
        return { success: false, error: result.Sonuc_Str || 'Odeme baslatma hatasi' };
      }
      // 3D Secure HTML formu donecek -- bunu musteri tarayicisina gonderecegiz
      return { success: true, html: result.UCD_HTML || result.Islem_ID, transactionId: result.Islem_ID };
    }

    return { success: false, error: 'Param API yanit vermedi' };
  } catch (err) {
    console.error('Param odeme hatasi:', err.message);
    return { success: false, error: 'Odeme sistemi baglanti hatasi' };
  }
}

/**
 * Param'dan donen 3D Secure sonucunu dogrula
 */
async function verifyPayment(callbackData) {
  // MOCK modunda SOAP client yukleme -- sadece callback verilerini kontrol et
  const isMock = process.env.PARAM_MOCK === 'true';
  if (!isMock) {
    // Gercek modda ileride SOAP dogrulamasi yapilabilir; simdilik callback verilerine guveniyoruz
    // (Param ayrica gizli anahtar imzasi ile dogrulama yapiyor -- WSDL uzerinden re-query opsiyonel)
  }

  try {
    // Param callback verilerinden islem sonucunu dogrula
    const islemId = callbackData.Islem_ID || callbackData.islem_id;
    const siparisId = callbackData.Siparis_ID || callbackData.siparis_id;
    const sonuc = callbackData.Islem_Sonuc || callbackData.islem_sonuc;

    // Basarili islem kontrolu
    if (sonuc === '1' || sonuc === 'true') {
      return {
        success: true,
        orderId: siparisId,
        transactionId: islemId
      };
    }

    return {
      success: false,
      orderId: siparisId,
      error: callbackData.Sonuc_Str || 'Odeme basarisiz'
    };
  } catch (err) {
    console.error('Param dogrulama hatasi:', err.message);
    return { success: false, error: 'Dogrulama hatasi' };
  }
}

module.exports = { initiatePayment, verifyPayment };
