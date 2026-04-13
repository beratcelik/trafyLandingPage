const express = require('express');
const router = express.Router();
const { verifyPayment } = require('../services/paramService');
const { updateOrderStatus, updateOrderInvoice, getOrderFull, commitStockForOrder } = require('../services/dbService');
const { createInvoice } = require('../services/invoiceService');

// POST /api/payment/callback -- Param 3D Secure sonucu
router.post('/callback', async (req, res) => {
  try {
    const result = await verifyPayment(req.body);
    const domain = process.env.DOMAIN || 'https://trafy.tr';

    if (result.success && result.orderId) {
      // Odeme basarili -- durumu guncelle
      updateOrderStatus(result.orderId, 'ODEME_ONAYLANDI', {
        param_transaction_id: result.transactionId
      });

      // Stoktan dus (satis gerceklesti)
      try {
        const stockResult = commitStockForOrder(result.orderId);
        if (!stockResult.ok) {
          console.error(`Stok dusulemedi (${result.orderId}):`, stockResult.reason);
        }
      } catch (stockErr) {
        console.error('Stok hatasi:', stockErr.message);
      }

      // Fatura olustur (hata fatura disinda akisi kesmez)
      try {
        const order = getOrderFull(result.orderId);
        if (order) {
          const invoice = await createInvoice(order);
          updateOrderInvoice(result.orderId, invoice);
          if (!invoice.success) {
            console.error(`Fatura olusturulamadi (${result.orderId}):`, invoice.error);
          }
        }
      } catch (invErr) {
        console.error('Fatura hatasi:', invErr.message);
        updateOrderInvoice(result.orderId, { status: 'FAILED', error: invErr.message });
      }

      // Musteri basari sayfasina yonlendir
      return res.redirect(`${domain}/checkout.html?status=success&order=${result.orderId}`);
    }

    // Odeme basarisiz
    if (result.orderId) {
      updateOrderStatus(result.orderId, 'IPTAL');
    }

    return res.redirect(`${domain}/checkout.html?status=fail&order=${result.orderId || ''}&error=${encodeURIComponent(result.error || 'Odeme basarisiz')}`);
  } catch (err) {
    console.error('Payment callback hatasi:', err);
    const domain = process.env.DOMAIN || 'https://trafy.tr';
    return res.redirect(`${domain}/checkout.html?status=fail&error=${encodeURIComponent('Sistem hatasi')}`);
  }
});

module.exports = router;
