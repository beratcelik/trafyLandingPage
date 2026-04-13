const axios = require('axios');

/**
 * Trendyol eFaturam e-Arsiv fatura entegrasyonu.
 *
 * Dokuman: https://developers.trendyolefaturam.com/ (login gerekir)
 *
 * Ortamlar:
 *   Test : https://stage-apigateway.trendyolefaturam.com
 *   Canli: https://apigateway.trendyolecozum.com
 *
 * Akis:
 *   1) signIn (partner hesabi) -> partner access token
 *   2) customerSignIn (partner token ile) -> musteri token + userId + companyId
 *   3) createEArchive (musteri token ile) -> fatura olusturur, ETTN + pdf donur
 *
 * Kurallar:
 *   - Tutarlar KURUS cinsinden integer (114.55 TL -> 11455)
 *   - 1 Temmuz 2024'ten itibaren internet satis e-arsiv icin paymentInfo +
 *     deliveryInfo zorunlu
 *   - KDV %20 (2026 Turkiye standart)
 *
 * Ortam degiskenleri:
 *   INVOICE_MOCK=true                    -- Mock modu
 *   TRENDYOL_INVOICE_BASE_URL            -- Gateway URL
 *   TRENDYOL_PARTNER_USERNAME            -- Partner hesap
 *   TRENDYOL_PARTNER_PASSWORD
 *   TRENDYOL_CUSTOMER_USERNAME           -- Musteri (firma) hesap
 *   TRENDYOL_CUSTOMER_PASSWORD
 *   TRENDYOL_SUPPLIER_ID                 -- Tedarikci ID
 *   COMPANY_NAME                         -- Firma adi
 *   COMPANY_TAX_NUMBER                   -- VKN
 *   COMPANY_TAX_OFFICE                   -- Vergi dairesi
 *   DOMAIN                               -- https://trafy.tr (purchaseUrl icin)
 */

const VAT_RATE = 20;

// KDV dahil tutardan KDV haric ve KDV ayir (kurus cinsinden)
function splitVat(totalWithVatKurus) {
  const net = Math.round(totalWithVatKurus / (1 + VAT_RATE / 100));
  const vat = totalWithVatKurus - net;
  return { net, vat };
}

// ===== Token cache (partner + musteri) =====
let partnerToken = null;
let partnerTokenExpiry = 0;
let customerToken = null;
let customerCompanyId = null;
let customerUserId = null;
let customerTokenExpiry = 0;

function getBaseUrl() {
  return (process.env.TRENDYOL_INVOICE_BASE_URL || 'https://stage-apigateway.trendyolefaturam.com').replace(/\/+$/, '');
}

async function signInPartner() {
  if (partnerToken && Date.now() < partnerTokenExpiry) return partnerToken;

  const resp = await axios.post(
    `${getBaseUrl()}/signIn`,
    {
      userName: process.env.TRENDYOL_PARTNER_USERNAME,
      password: process.env.TRENDYOL_PARTNER_PASSWORD
    },
    { timeout: 15000 }
  );

  const token = (resp.data && (resp.data.accessToken || resp.data.token)) || null;
  if (!token) throw new Error('Partner signIn: token alinamadi');
  partnerToken = token;
  partnerTokenExpiry = Date.now() + 50 * 60 * 1000; // 50 dk
  return token;
}

async function signInCustomer() {
  if (customerToken && Date.now() < customerTokenExpiry) {
    return { token: customerToken, companyId: customerCompanyId, userId: customerUserId };
  }

  const pToken = await signInPartner();

  const resp = await axios.post(
    `${getBaseUrl()}/customerSignIn`,
    {
      userName: process.env.TRENDYOL_CUSTOMER_USERNAME,
      password: process.env.TRENDYOL_CUSTOMER_PASSWORD
    },
    {
      headers: { Authorization: `Bearer ${pToken}` },
      timeout: 15000
    }
  );

  const data = resp.data || {};
  const token = data.accessToken || data.token;
  const companyId = data.companyId;
  const userId = data.userId;
  if (!token || !companyId) throw new Error('customerSignIn: token/companyId alinamadi');

  customerToken = token;
  customerCompanyId = companyId;
  customerUserId = userId;
  customerTokenExpiry = Date.now() + 50 * 60 * 1000;
  return { token, companyId, userId };
}

function buildEArchivePayload(order, companyId) {
  const domain = process.env.DOMAIN || 'https://trafy.tr';
  const lineTotal = order.total_price; // kurus, KDV dahil kabul edilir
  const { net: lineNet, vat: lineVat } = splitVat(lineTotal);
  const unitPriceNet = Math.round(lineNet / order.quantity); // kurus

  return {
    companyId: companyId,
    documentType: 'EARCHIVE',
    invoiceType: 'SATIS',
    invoiceDate: new Date().toISOString().slice(0, 10),
    currencyCode: 'TRY',
    externalRef: order.id,
    profileId: 'EARSIVFATURA',
    buyer: {
      identityNumber: order.customer_tckn,
      name: order.customer_name,
      email: order.customer_email,
      phone: order.customer_phone,
      address: order.address,
      district: order.district,
      city: order.city,
      country: 'Turkiye'
    },
    invoiceLines: [
      {
        productName: `${order.product_name} (x${order.quantity})`,
        quantity: order.quantity,
        unitCode: 'C62', // adet
        unitPrice: unitPriceNet,        // kurus, KDV haric
        lineTotal: lineNet,             // kurus, KDV haric
        vatRate: VAT_RATE,
        vatAmount: lineVat,             // kurus
        totalWithVat: lineTotal         // kurus
      }
    ],
    totals: {
      lineTotal: lineNet,
      vatTotal: lineVat,
      grandTotal: lineTotal
    },
    // 1 Temmuz 2024 sonrasi zorunlu
    paymentInfo: {
      paymentType: 'CREDIT_CARD',
      paymentAgent: 'Param',
      paymentDate: new Date().toISOString().slice(0, 10),
      purchaseUrl: `${domain}/checkout.html?product=${order.product_slug}`
    },
    deliveryInfo: {
      deliveryType: 'KARGO',
      carrier: order.carrier || 'Kargo',
      trackingNumber: order.tracking_number || order.id,
      recipientName: order.customer_name,
      address: order.address,
      district: order.district,
      city: order.city,
      country: 'Turkiye'
    }
  };
}

async function createInvoice(order) {
  // ===== MOCK MODU =====
  if (process.env.INVOICE_MOCK === 'true') {
    const mockEttn = `MOCK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const mockNumber = `TRF${new Date().getFullYear()}${String(Math.floor(Math.random() * 900000) + 100000)}`;
    console.log(`[Invoice MOCK] Siparis ${order.id} icin fatura: ${mockNumber}`);
    return {
      success: true,
      ettn: mockEttn,
      invoiceNumber: mockNumber,
      pdfUrl: `/api/invoices/${mockEttn}/pdf`, // mock endpoint
      status: 'CREATED'
    };
  }

  // ===== GERCEK MODU =====
  const required = ['TRENDYOL_PARTNER_USERNAME', 'TRENDYOL_PARTNER_PASSWORD', 'TRENDYOL_CUSTOMER_USERNAME', 'TRENDYOL_CUSTOMER_PASSWORD'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length > 0) {
    return { success: false, status: 'CONFIG_MISSING', error: `Eksik env: ${missing.join(', ')}` };
  }

  try {
    const { token, companyId } = await signInCustomer();
    const payload = buildEArchivePayload(order, companyId);

    const resp = await axios.post(
      `${getBaseUrl()}/createEArchive`,
      payload,
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        timeout: 20000
      }
    );

    const data = resp.data || {};
    return {
      success: true,
      ettn: data.ettn || data.uuid || data.id,
      invoiceNumber: data.invoiceNumber || data.documentNumber,
      pdfUrl: data.pdfUrl || data.documentUrl,
      status: data.status || 'CREATED'
    };
  } catch (err) {
    const apiMsg = err.response && err.response.data
      ? (typeof err.response.data === 'string' ? err.response.data : JSON.stringify(err.response.data))
      : err.message;
    console.error('Trendyol eFaturam hatasi:', apiMsg);
    // Token'i temizle, bir sonraki denemede yeniden login olsun
    if (err.response && (err.response.status === 401 || err.response.status === 403)) {
      partnerToken = null; customerToken = null;
    }
    return { success: false, status: 'FAILED', error: apiMsg.slice(0, 500) };
  }
}

module.exports = { createInvoice };
