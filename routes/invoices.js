const express = require('express');
const router = express.Router();
const { getOrderFull } = require('../services/dbService');

// Para formatlama
function fmt(kurus) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(kurus / 100);
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// GET /api/invoices/:orderId -- Fatura goruntuleme
// Trendyol'dan gelen PDF URL varsa oraya yonlendirir;
// yoksa (mock mod veya PDF henuz olusmadiysa) basit HTML fatura onizlemesi doner.
router.get('/:orderId', (req, res) => {
  const orderId = req.params.orderId;
  if (!/^TRF-\d{8}-[A-F0-9]{4}$/i.test(orderId)) {
    return res.status(400).send('Gecersiz siparis numarasi');
  }

  const order = getOrderFull(orderId);
  if (!order || !order.invoice_number) {
    return res.status(404).send('Fatura bulunamadi');
  }

  // Gercek Trendyol PDF varsa oraya yonlendir
  if (order.invoice_pdf_url && /^https?:\/\//i.test(order.invoice_pdf_url)) {
    return res.redirect(order.invoice_pdf_url);
  }

  // HTML onizleme (mock mod)
  const net = Math.round(order.total_price / 1.20);
  const vat = order.total_price - net;
  const unitNet = Math.round(net / order.quantity);

  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<title>E-Arsiv Fatura - ${escapeHtml(order.invoice_number)}</title>
<style>
  body { font-family: -apple-system, Segoe UI, Arial, sans-serif; max-width: 760px; margin: 2rem auto; padding: 2rem; color: #222; }
  .invoice-header { display: flex; justify-content: space-between; align-items: start; border-bottom: 2px solid #000; padding-bottom: 1rem; margin-bottom: 1.5rem; }
  .invoice-title { font-size: 1.8rem; font-weight: 700; margin: 0; }
  .invoice-meta { text-align: right; font-size: 0.9rem; }
  .invoice-meta div { margin: 2px 0; }
  .party { display: flex; gap: 3rem; margin: 1.5rem 0; }
  .party > div { flex: 1; }
  .party h3 { font-size: 0.85rem; text-transform: uppercase; color: #666; margin: 0 0 0.5rem; }
  .party p { margin: 2px 0; font-size: 0.95rem; }
  table { width: 100%; border-collapse: collapse; margin: 1.5rem 0; }
  th, td { padding: 0.75rem; border-bottom: 1px solid #eee; text-align: left; font-size: 0.9rem; }
  th { background: #f5f5f5; font-weight: 600; }
  td.num, th.num { text-align: right; }
  .totals { margin-top: 1rem; margin-left: auto; width: 280px; }
  .totals div { display: flex; justify-content: space-between; padding: 0.35rem 0; }
  .totals .grand { font-size: 1.1rem; font-weight: 700; border-top: 2px solid #000; margin-top: 0.5rem; padding-top: 0.5rem; }
  .watermark { margin-top: 2rem; text-align: center; color: #aaa; font-size: 0.8rem; border-top: 1px dashed #ccc; padding-top: 1rem; }
  .mock-badge { display: inline-block; background: #fef3c7; color: #92400e; padding: 4px 12px; border-radius: 4px; font-size: 0.75rem; font-weight: 600; margin-left: 10px; }
</style>
</head>
<body>
  <div class="invoice-header">
    <div>
      <h1 class="invoice-title">E-ARSIV FATURA ${order.invoice_status === 'CREATED' && String(order.invoice_ettn || '').startsWith('MOCK') ? '<span class="mock-badge">TEST / MOCK</span>' : ''}</h1>
      <div style="font-size:0.9rem;color:#666;margin-top:4px;">${escapeHtml(process.env.COMPANY_NAME || 'Trafy')}</div>
    </div>
    <div class="invoice-meta">
      <div><strong>Fatura No:</strong> ${escapeHtml(order.invoice_number)}</div>
      <div><strong>ETTN:</strong> ${escapeHtml(order.invoice_ettn || '-')}</div>
      <div><strong>Tarih:</strong> ${escapeHtml(order.created_at || '')}</div>
      <div><strong>Siparis:</strong> ${escapeHtml(order.id)}</div>
    </div>
  </div>

  <div class="party">
    <div>
      <h3>Satici</h3>
      <p><strong>${escapeHtml(process.env.COMPANY_NAME || 'Trafy')}</strong></p>
      <p>VKN: ${escapeHtml(process.env.COMPANY_TAX_NUMBER || '-')}</p>
      <p>Vergi Dairesi: ${escapeHtml(process.env.COMPANY_TAX_OFFICE || '-')}</p>
    </div>
    <div>
      <h3>Alici</h3>
      <p><strong>${escapeHtml(order.customer_name)}</strong></p>
      <p>TCKN: ${escapeHtml(order.customer_tckn || '-')}</p>
      <p>${escapeHtml(order.city)}, ${escapeHtml(order.district)}</p>
      <p>${escapeHtml(order.address)}</p>
      <p>${escapeHtml(order.customer_phone)} &middot; ${escapeHtml(order.customer_email)}</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Urun</th>
        <th class="num">Adet</th>
        <th class="num">Birim Fiyat</th>
        <th class="num">KDV %</th>
        <th class="num">Tutar</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>${escapeHtml(order.product_name)}</td>
        <td class="num">${order.quantity}</td>
        <td class="num">${fmt(unitNet)}</td>
        <td class="num">20</td>
        <td class="num">${fmt(net)}</td>
      </tr>
    </tbody>
  </table>

  <div class="totals">
    <div><span>Mal/Hizmet Toplam</span><span>${fmt(net)}</span></div>
    <div><span>KDV (%20)</span><span>${fmt(vat)}</span></div>
    <div class="grand"><span>Genel Toplam</span><span>${fmt(order.total_price)}</span></div>
  </div>

  <div class="watermark">
    Bu belge Trendyol eFaturam altyapisi uzerinden uretilmistir.
    ${String(order.invoice_ettn || '').startsWith('MOCK') ? 'TEST MODU -- resmi degildir.' : ''}
  </div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

module.exports = router;
