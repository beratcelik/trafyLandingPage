const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, '..', 'db', 'database.sqlite');
let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

// Baslangic urun fiyat haritasi (ilk DB olusturulurken seed icin -- kurus cinsinden)
const SEED_PRODUCTS = {
  'deneme':       { name: 'Trafy Deneme Urunu', price: 100,      stock: 999 },
  'uno':          { name: 'Trafy Uno',          price: 150000,   stock: 0 },
  'uno-pro':      { name: 'Trafy Uno Pro',      price: 250000,   stock: 0 },
  'dos':          { name: 'Trafy Dos',          price: 400000,   stock: 0 },
  'dos-pro':      { name: 'Trafy Dos Pro',      price: 700000,   stock: 0 },
  'dos-internet': { name: 'Trafy Dos Internet', price: 800000,   stock: 0 },
  'tres':         { name: 'Trafy Tres',         price: 900000,   stock: 0 },
  'tres-pro':     { name: 'Trafy Tres Pro',     price: 1000000,  stock: 0 }
};

function initDatabase() {
  const database = getDb();
  database.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      product_slug TEXT NOT NULL,
      product_name TEXT NOT NULL,
      quantity INTEGER DEFAULT 1,
      unit_price INTEGER NOT NULL,
      total_price INTEGER NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      customer_tckn TEXT,
      city TEXT NOT NULL,
      district TEXT NOT NULL,
      address TEXT NOT NULL,
      note TEXT,
      status TEXT DEFAULT 'ODEME_BEKLENIYOR',
      param_transaction_id TEXT,
      tracking_number TEXT,
      carrier TEXT,
      invoice_ettn TEXT,
      invoice_number TEXT,
      invoice_pdf_url TEXT,
      invoice_status TEXT,
      invoice_error TEXT,
      stock_committed INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      slug TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price INTEGER NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS career_applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      position TEXT,
      linkedin TEXT,
      message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS preorders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_slug TEXT NOT NULL,
      product_name TEXT NOT NULL,
      quantity INTEGER DEFAULT 1,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      note TEXT,
      notified INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS apk_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version_code INTEGER NOT NULL UNIQUE,
      version_name TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      sha256 TEXT NOT NULL,
      mandatory INTEGER NOT NULL DEFAULT 0,
      release_notes_tr TEXT,
      release_notes_en TEXT,
      is_current INTEGER NOT NULL DEFAULT 0,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      uploaded_by TEXT,
      signer_cert_sha256 TEXT NOT NULL,
      signature_scheme TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_apk_current ON apk_versions(is_current);
  `);

  // career_applications icin migrasyon (eski DB'ye linkedin ekle)
  const careerCols = database.prepare("PRAGMA table_info(career_applications)").all().map(c => c.name);
  if (!careerCols.includes('linkedin')) {
    database.exec('ALTER TABLE career_applications ADD COLUMN linkedin TEXT');
  }
  // Migrasyon: mevcut veritabanlarina yeni sutunlari ekle
  const existingCols = database.prepare("PRAGMA table_info(orders)").all().map(c => c.name);
  const addCol = (name, type) => {
    if (!existingCols.includes(name)) {
      database.exec(`ALTER TABLE orders ADD COLUMN ${name} ${type}`);
    }
  };
  addCol('customer_tckn', 'TEXT');
  addCol('invoice_ettn', 'TEXT');
  addCol('invoice_number', 'TEXT');
  addCol('invoice_pdf_url', 'TEXT');
  addCol('invoice_status', 'TEXT');
  addCol('invoice_error', 'TEXT');
  addCol('stock_committed', 'INTEGER DEFAULT 0');

  // Seed: sales_enabled ayarini env'den (ilk kurulum icin). Sonradan admin panelden degisir.
  const hasSales = database.prepare("SELECT value FROM settings WHERE key = 'sales_enabled'").get();
  if (!hasSales) {
    const initial = process.env.SALES_ENABLED === 'false' ? 'false' : 'true';
    database.prepare("INSERT INTO settings (key, value) VALUES ('sales_enabled', ?)").run(initial);
  }

  // Seed: urunler tablosu bos ise varsayilanlarla doldur
  const productCount = database.prepare('SELECT COUNT(*) as c FROM products').get().c;
  if (productCount === 0) {
    const insert = database.prepare('INSERT INTO products (slug, name, price, stock) VALUES (?, ?, ?, ?)');
    const tx = database.transaction((items) => {
      for (const [slug, p] of Object.entries(items)) {
        insert.run(slug, p.name, p.price, p.stock);
      }
    });
    tx(SEED_PRODUCTS);
    console.log(`Urunler tablosu seed edildi (${Object.keys(SEED_PRODUCTS).length} urun).`);
  }

  console.log('Veritabani hazir.');
}

// ===== Urun fonksiyonlari =====

function getAllProducts() {
  return getDb().prepare('SELECT slug, name, price, stock, updated_at FROM products ORDER BY price ASC').all();
}

function getProduct(slug) {
  return getDb().prepare('SELECT slug, name, price, stock FROM products WHERE slug = ?').get(slug);
}

function updateProduct(slug, fields) {
  const updates = [];
  const values = [];
  if (typeof fields.name === 'string') { updates.push('name = ?'); values.push(fields.name.trim()); }
  if (Number.isInteger(fields.price) && fields.price >= 0) { updates.push('price = ?'); values.push(fields.price); }
  if (Number.isInteger(fields.stock) && fields.stock >= 0) { updates.push('stock = ?'); values.push(fields.stock); }
  if (updates.length === 0) return { changes: 0 };
  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(slug);
  return getDb().prepare(`UPDATE products SET ${updates.join(', ')} WHERE slug = ?`).run(...values);
}

// Stok dusur/ekle -- atomik
function decrementStock(slug, qty) {
  const stmt = getDb().prepare('UPDATE products SET stock = stock - ?, updated_at = CURRENT_TIMESTAMP WHERE slug = ? AND stock >= ?');
  const r = stmt.run(qty, slug, qty);
  return r.changes > 0;
}

function incrementStock(slug, qty) {
  const stmt = getDb().prepare('UPDATE products SET stock = stock + ?, updated_at = CURRENT_TIMESTAMP WHERE slug = ?');
  return stmt.run(qty, slug).changes > 0;
}

// Siparis onaylandiginda stok dusur + bayragi isaretle (tek transaction)
function commitStockForOrder(orderId) {
  const database = getDb();
  const tx = database.transaction(() => {
    const order = database.prepare('SELECT product_slug, quantity, stock_committed FROM orders WHERE id = ?').get(orderId);
    if (!order) return { ok: false, reason: 'not_found' };
    if (order.stock_committed) return { ok: true, already: true };
    const r = database.prepare('UPDATE products SET stock = stock - ?, updated_at = CURRENT_TIMESTAMP WHERE slug = ? AND stock >= ?')
      .run(order.quantity, order.product_slug, order.quantity);
    if (r.changes === 0) return { ok: false, reason: 'insufficient_stock' };
    database.prepare('UPDATE orders SET stock_committed = 1 WHERE id = ?').run(orderId);
    return { ok: true };
  });
  return tx();
}

// Iade/iptal durumunda stogu geri ekle
function releaseStockForOrder(orderId) {
  const database = getDb();
  const tx = database.transaction(() => {
    const order = database.prepare('SELECT product_slug, quantity, stock_committed FROM orders WHERE id = ?').get(orderId);
    if (!order) return { ok: false, reason: 'not_found' };
    if (!order.stock_committed) return { ok: true, already: true };
    database.prepare('UPDATE products SET stock = stock + ?, updated_at = CURRENT_TIMESTAMP WHERE slug = ?')
      .run(order.quantity, order.product_slug);
    database.prepare('UPDATE orders SET stock_committed = 0 WHERE id = ?').run(orderId);
    return { ok: true };
  });
  return tx();
}

function generateOrderId() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `TRF-${date}-${rand}`;
}

function createOrder(data) {
  const product = getProduct(data.product);
  if (!product) return { error: 'invalid_product' };

  const quantity = Math.max(1, Math.min(10, parseInt(data.quantity) || 1));
  if (product.stock < quantity) {
    return { error: 'out_of_stock', available: product.stock };
  }

  const id = generateOrderId();
  const totalPrice = product.price * quantity;

  const stmt = getDb().prepare(`
    INSERT INTO orders (id, product_slug, product_name, quantity, unit_price, total_price,
      customer_name, customer_phone, customer_email, customer_tckn, city, district, address, note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id, data.product, product.name, quantity, product.price, totalPrice,
    data.name.trim(), data.phone.trim(), data.email.trim(),
    data.tckn ? data.tckn.trim() : null,
    data.city.trim(), data.district.trim(), data.address.trim(),
    data.note ? data.note.trim() : null
  );

  return { id, productName: product.name, quantity, totalPrice };
}

function getOrderStatus(orderId) {
  const stmt = getDb().prepare(`
    SELECT id, product_name, quantity, total_price, status, tracking_number, carrier,
      invoice_number, invoice_pdf_url, invoice_status, created_at
    FROM orders WHERE id = ?
  `);
  return stmt.get(orderId);
}

function updateOrderInvoice(orderId, invoice) {
  const stmt = getDb().prepare(`
    UPDATE orders SET
      invoice_ettn = ?, invoice_number = ?, invoice_pdf_url = ?,
      invoice_status = ?, invoice_error = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  return stmt.run(
    invoice.ettn || null,
    invoice.invoiceNumber || null,
    invoice.pdfUrl || null,
    invoice.status || null,
    invoice.error || null,
    orderId
  );
}

function getOrderFull(orderId) {
  const stmt = getDb().prepare('SELECT * FROM orders WHERE id = ?');
  return stmt.get(orderId);
}

function updateOrderStatus(orderId, status, extra = {}) {
  const fields = ['status = ?', 'updated_at = CURRENT_TIMESTAMP'];
  const values = [status];

  if (extra.tracking_number) {
    fields.push('tracking_number = ?');
    values.push(extra.tracking_number);
  }
  if (extra.carrier) {
    fields.push('carrier = ?');
    values.push(extra.carrier);
  }
  if (extra.param_transaction_id) {
    fields.push('param_transaction_id = ?');
    values.push(extra.param_transaction_id);
  }

  values.push(orderId);
  const stmt = getDb().prepare(`UPDATE orders SET ${fields.join(', ')} WHERE id = ?`);
  return stmt.run(...values);
}

function getAllOrders(filters = {}) {
  let query = 'SELECT * FROM orders';
  const conditions = [];
  const values = [];

  if (filters.status) {
    conditions.push('status = ?');
    values.push(filters.status);
  }
  if (filters.date_from) {
    conditions.push('created_at >= ?');
    values.push(filters.date_from);
  }
  if (filters.date_to) {
    conditions.push('created_at <= ?');
    values.push(filters.date_to);
  }
  if (filters.mock === true) {
    conditions.push("param_transaction_id LIKE 'MOCK-%'");
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  query += ' ORDER BY created_at DESC';

  const stmt = getDb().prepare(query);
  return stmt.all(...values);
}

function cancelAllMockOrders() {
  const stmt = getDb().prepare(
    "UPDATE orders SET status='IPTAL', updated_at=CURRENT_TIMESTAMP WHERE param_transaction_id LIKE 'MOCK-%' AND status != 'IPTAL'"
  );
  return stmt.run().changes;
}

function countRecentOrders(phone, email, minutes = 60) {
  const stmt = getDb().prepare(`
    SELECT COUNT(*) as count FROM orders
    WHERE (customer_phone = ? OR customer_email = ?)
    AND created_at >= datetime('now', ?)
  `);
  return stmt.get(phone, email, `-${minutes} minutes`).count;
}

// ===== Ayarlar (settings) =====

function getSetting(key, defaultValue = null) {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : defaultValue;
}

function setSetting(key, value) {
  getDb().prepare(`
    INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `).run(key, String(value));
}

function isSalesEnabled() {
  return getSetting('sales_enabled', 'true') !== 'false';
}

// ===== On-siparis (preorder) =====

function createPreorder(data) {
  const product = getProduct(data.product);
  if (!product) return { error: 'invalid_product' };
  const quantity = Math.max(1, Math.min(10, parseInt(data.quantity) || 1));

  const stmt = getDb().prepare(`
    INSERT INTO preorders (product_slug, product_name, quantity,
      customer_name, customer_phone, customer_email, note)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const r = stmt.run(
    data.product, product.name, quantity,
    data.name.trim(), data.phone.trim(), data.email.trim(),
    data.note ? data.note.trim() : null
  );
  return { id: r.lastInsertRowid, productName: product.name, quantity };
}

function getAllPreorders() {
  return getDb().prepare(
    'SELECT id, product_slug, product_name, quantity, customer_name, customer_phone, customer_email, note, notified, created_at FROM preorders ORDER BY created_at DESC'
  ).all();
}

function markPreorderNotified(id, notified = true) {
  return getDb().prepare('UPDATE preorders SET notified = ? WHERE id = ?').run(notified ? 1 : 0, id).changes;
}

function countRecentPreorders(phone, email, minutes = 60) {
  const stmt = getDb().prepare(`
    SELECT COUNT(*) as count FROM preorders
    WHERE (customer_phone = ? OR customer_email = ?)
    AND created_at >= datetime('now', ?)
  `);
  return stmt.get(phone, email, `-${minutes} minutes`).count;
}

// ===== Kariyer basvurulari =====

function createCareerApplication(data) {
  const stmt = getDb().prepare(
    'INSERT INTO career_applications (name, email, phone, position, linkedin, message) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const r = stmt.run(
    String(data.name || '').trim().slice(0, 200),
    String(data.email || '').trim().slice(0, 200),
    String(data.phone || '').trim().slice(0, 50),
    String(data.position || '').trim().slice(0, 100),
    String(data.linkedin || '').trim().slice(0, 300),
    String(data.message || '').trim().slice(0, 4000)
  );
  return { id: r.lastInsertRowid };
}

function getAllCareerApplications() {
  return getDb()
    .prepare('SELECT id, name, email, phone, position, linkedin, message, created_at FROM career_applications ORDER BY created_at DESC')
    .all();
}

// ===== APK surumleri =====

function getAllApkVersions() {
  return getDb()
    .prepare('SELECT * FROM apk_versions ORDER BY version_code DESC')
    .all();
}

function getCurrentApkVersion() {
  return getDb()
    .prepare('SELECT * FROM apk_versions WHERE is_current = 1 LIMIT 1')
    .get();
}

function getApkVersionById(id) {
  return getDb().prepare('SELECT * FROM apk_versions WHERE id = ?').get(id);
}

function getApkVersionByCode(versionCode) {
  return getDb().prepare('SELECT * FROM apk_versions WHERE version_code = ?').get(versionCode);
}

function insertApkVersionAndActivate(row) {
  const database = getDb();
  const tx = database.transaction(() => {
    database.prepare('UPDATE apk_versions SET is_current = 0').run();
    const r = database.prepare(`
      INSERT INTO apk_versions
        (version_code, version_name, file_name, file_size, sha256, mandatory,
         release_notes_tr, release_notes_en, is_current, uploaded_by,
         signer_cert_sha256, signature_scheme)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
    `).run(
      row.version_code,
      row.version_name,
      row.file_name,
      row.file_size,
      row.sha256,
      row.mandatory ? 1 : 0,
      row.release_notes_tr || null,
      row.release_notes_en || null,
      row.uploaded_by || null,
      row.signer_cert_sha256,
      row.signature_scheme
    );
    return r.lastInsertRowid;
  });
  return tx();
}

function activateApkVersion(id) {
  const database = getDb();
  const tx = database.transaction(() => {
    const target = database.prepare('SELECT id FROM apk_versions WHERE id = ?').get(id);
    if (!target) return { ok: false, reason: 'not_found' };
    database.prepare('UPDATE apk_versions SET is_current = 0').run();
    database.prepare('UPDATE apk_versions SET is_current = 1 WHERE id = ?').run(id);
    return { ok: true };
  });
  return tx();
}

function deleteApkVersion(id) {
  const database = getDb();
  const row = database.prepare('SELECT * FROM apk_versions WHERE id = ?').get(id);
  if (!row) return { ok: false, reason: 'not_found' };
  if (row.is_current) return { ok: false, reason: 'is_current', row };
  database.prepare('DELETE FROM apk_versions WHERE id = ?').run(id);
  return { ok: true, row };
}

module.exports = {
  initDatabase,
  getDb,
  createOrder,
  getOrderStatus,
  getOrderFull,
  updateOrderStatus,
  updateOrderInvoice,
  getAllOrders,
  countRecentOrders,
  // Urun / stok
  getAllProducts,
  getProduct,
  updateProduct,
  decrementStock,
  incrementStock,
  commitStockForOrder,
  releaseStockForOrder,
  // On-siparis
  createPreorder,
  getAllPreorders,
  markPreorderNotified,
  countRecentPreorders,
  cancelAllMockOrders,
  // Ayarlar
  getSetting,
  setSetting,
  isSalesEnabled,
  // Kariyer
  createCareerApplication,
  getAllCareerApplications,
  // APK
  getAllApkVersions,
  getCurrentApkVersion,
  getApkVersionById,
  getApkVersionByCode,
  insertApkVersionAndActivate,
  activateApkVersion,
  deleteApkVersion
};
