const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { orderRateLimiter } = require('../middleware/security');
const { createOrder, getOrderStatus, countRecentOrders, getAllProducts } = require('../services/dbService');
const { initiatePayment } = require('../services/paramService');

// Dogrulama kurallari
const orderValidation = [
  body('product').custom(v => {
    const slugs = getAllProducts().map(p => p.slug);
    if (!slugs.includes(v)) throw new Error('Gecersiz urun');
    return true;
  }),
  body('quantity').optional().isInt({ min: 1, max: 10 }).withMessage('Gecersiz adet'),
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Ad soyad gerekli'),
  body('phone').trim().matches(/^05\d{9}$/).withMessage('Gecerli bir telefon numarasi girin (05xxxxxxxxx)'),
  body('email').trim().isEmail().normalizeEmail().withMessage('Gecerli bir email adresi girin'),
  body('tckn').trim().matches(/^\d{11}$/).withMessage('Gecerli bir T.C. Kimlik No girin').custom(v => {
    // TCKN checksum dogrulamasi
    if (v[0] === '0') return false;
    const d = v.split('').map(Number);
    const sumOdd = d[0] + d[2] + d[4] + d[6] + d[8];
    const sumEven = d[1] + d[3] + d[5] + d[7];
    // JS'de negatif mod sorununu onlemek icin normalize et
    const c10 = ((((sumOdd * 7) - sumEven) % 10) + 10) % 10;
    if (c10 !== d[9]) return false;
    return (sumOdd + sumEven + d[9]) % 10 === d[10];
  }).withMessage('Gecersiz T.C. Kimlik No'),
  body('city').trim().isLength({ min: 2, max: 50 }).withMessage('Sehir gerekli'),
  body('district').trim().isLength({ min: 2, max: 50 }).withMessage('Ilce gerekli'),
  body('address').trim().isLength({ min: 10, max: 500 }).withMessage('Adres en az 10 karakter olmali'),
  body('note').optional().trim().isLength({ max: 500 })
];

// POST /api/orders -- Yeni siparis olustur
router.post('/', orderRateLimiter, orderValidation, async (req, res) => {
  // Dogrulama hatalari
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array().map(e => e.msg) });
  }

  try {
    // Rate limit: ayni telefon/email'den cok fazla siparis engelle
    const recentCount = countRecentOrders(req.body.phone, req.body.email);
    if (recentCount >= 3) {
      return res.status(429).json({ error: 'Son 1 saat icinde cok fazla siparis olusturuldu. Lutfen bekleyin.' });
    }

    // Siparisi olustur
    const order = createOrder(req.body);
    if (order.error === 'invalid_product') {
      return res.status(400).json({ error: 'Gecersiz urun' });
    }
    if (order.error === 'out_of_stock') {
      return res.status(409).json({ error: `Stok yetersiz. Mevcut: ${order.available}` });
    }

    // Param odeme baslat
    const orderFull = {
      id: order.id,
      total_price: order.totalPrice,
      product_name: order.productName,
      quantity: order.quantity,
      customer_name: req.body.name,
      customer_phone: req.body.phone,
      customer_email: req.body.email
    };

    const paymentResult = await initiatePayment(orderFull);

    if (paymentResult.success) {
      return res.json({
        orderId: order.id,
        totalPrice: order.totalPrice,
        paymentHtml: paymentResult.html
      });
    }

    return res.status(502).json({
      orderId: order.id,
      error: paymentResult.error || 'Odeme sistemi baglanti hatasi'
    });
  } catch (err) {
    console.error('Siparis olusturma hatasi:', err);
    return res.status(500).json({ error: 'Sunucu hatasi. Lutfen tekrar deneyin.' });
  }
});

// GET /api/orders/:id/status -- Siparis durumu sorgula (public)
router.get('/:id/status', (req, res) => {
  const orderId = req.params.id;

  // ID format kontrolu
  if (!/^TRF-\d{8}-[A-F0-9]{4}$/i.test(orderId)) {
    return res.status(400).json({ error: 'Gecersiz siparis numarasi' });
  }

  const order = getOrderStatus(orderId);
  if (!order) {
    return res.status(404).json({ error: 'Siparis bulunamadi' });
  }

  res.json({
    id: order.id,
    product: order.product_name,
    quantity: order.quantity,
    total: order.total_price,
    status: order.status,
    trackingNumber: order.tracking_number,
    carrier: order.carrier,
    invoiceNumber: order.invoice_number,
    // Her zaman kendi endpoint'imiz uzerinden goster (Trendyol URL'i gizli kalir)
    invoiceUrl: order.invoice_number ? `/api/invoices/${order.id}` : null,
    invoiceStatus: order.invoice_status,
    date: order.created_at
  });
});

module.exports = router;
