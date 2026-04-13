document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();

    let adminKey = sessionStorage.getItem('adminKey') || '';
    let currentOrderId = null;

    const STATUS_LABELS = {
        'ODEME_BEKLENIYOR': 'Odeme Bekleniyor',
        'ODEME_ONAYLANDI': 'Odeme Onaylandi',
        'HAZIRLANIYOR': 'Hazirlaniyor',
        'KARGODA': 'Kargoda',
        'TESLIM_EDILDI': 'Teslim Edildi',
        'IPTAL': 'Iptal'
    };

    // Otomatik giris
    if (adminKey) {
        showPanel();
        loadOrders();
        loadProducts();
    }

    // Sekme gecisi
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;
            document.querySelectorAll('.admin-tab').forEach(t => t.classList.toggle('active', t === tab));
            document.querySelectorAll('.admin-tab-content').forEach(c => {
                c.classList.toggle('hidden', c.id !== `tab-${target}`);
            });
            if (target === 'products') loadProducts();
            if (target === 'orders') loadOrders();
        });
    });

    // Giris
    document.getElementById('login-btn').addEventListener('click', login);
    document.getElementById('admin-key').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') login();
    });

    function login() {
        adminKey = document.getElementById('admin-key').value.trim();
        if (!adminKey) return;
        sessionStorage.setItem('adminKey', adminKey);
        showPanel();
        loadOrders();
        loadProducts();
    }

    // Cikis
    document.getElementById('logout-btn').addEventListener('click', () => {
        adminKey = '';
        sessionStorage.removeItem('adminKey');
        document.getElementById('admin-panel').classList.add('hidden');
        document.getElementById('admin-login').classList.remove('hidden');
        document.getElementById('admin-key').value = '';
    });

    function showPanel() {
        document.getElementById('admin-login').classList.add('hidden');
        document.getElementById('admin-panel').classList.remove('hidden');
    }

    // API helper
    async function apiCall(url, options = {}) {
        const res = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'X-Admin-Secret': adminKey,
                ...options.headers
            }
        });
        if (res.status === 401) {
            alert('Yetkisiz erisim. Sifrenizi kontrol edin.');
            sessionStorage.removeItem('adminKey');
            location.reload();
            return null;
        }
        return res.json();
    }

    // Siparisleri yukle
    async function loadOrders() {
        const status = document.getElementById('filter-status').value;
        const params = status ? `?status=${status}` : '';
        const orders = await apiCall(`/api/admin/orders${params}`);
        if (!orders) return;
        renderOrders(orders);
    }

    document.getElementById('refresh-btn').addEventListener('click', loadOrders);
    document.getElementById('filter-status').addEventListener('change', loadOrders);

    function renderOrders(orders) {
        const container = document.getElementById('orders-list');
        if (orders.length === 0) {
            container.innerHTML = '<p class="admin-empty">Siparis bulunamadi.</p>';
            return;
        }

        container.innerHTML = `
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Siparis No</th>
                        <th>Urun</th>
                        <th>Musteri</th>
                        <th>Toplam</th>
                        <th>Durum</th>
                        <th>Tarih</th>
                        <th>Islem</th>
                    </tr>
                </thead>
                <tbody>
                    ${orders.map(o => `
                        <tr>
                            <td>${escapeHtml(o.id)}</td>
                            <td>${escapeHtml(o.product_name)} x${o.quantity}</td>
                            <td>${escapeHtml(o.customer_name)}</td>
                            <td>${formatPrice(o.total_price / 100)}</td>
                            <td><span class="status-badge status-${o.status.toLowerCase()}">${STATUS_LABELS[o.status] || o.status}</span></td>
                            <td>${formatDate(o.created_at)}</td>
                            <td><button class="btn btn-outline btn-sm detail-btn" data-order-id="${escapeHtml(o.id)}">Detay</button></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        // Detay butonlari icin event delegation (CSP inline onclick'e izin vermiyor)
        container.querySelectorAll('.detail-btn').forEach(btn => {
            btn.addEventListener('click', () => openOrder(btn.dataset.orderId));
        });
    }

    // Siparis detay modal
    async function openOrder(orderId) {
        currentOrderId = orderId;
        const order = await apiCall(`/api/admin/orders/${orderId}`);
        if (!order) return;

        document.getElementById('modal-order-id').textContent = order.id;
        document.getElementById('modal-product').textContent = `${order.product_name} x${order.quantity}`;
        document.getElementById('modal-total').textContent = `Toplam: ${formatPrice(order.total_price / 100)}`;
        document.getElementById('modal-name').textContent = order.customer_name;
        document.getElementById('modal-phone').textContent = order.customer_phone;
        document.getElementById('modal-email').textContent = order.customer_email;
        document.getElementById('modal-tckn').textContent = order.customer_tckn || '-';
        document.getElementById('modal-address').textContent = `${order.city}, ${order.district} - ${order.address}`;
        document.getElementById('modal-note').textContent = order.note || '-';
        document.getElementById('modal-status').value = order.status;
        document.getElementById('modal-carrier').value = order.carrier || '';
        document.getElementById('modal-tracking').value = order.tracking_number || '';

        // Fatura bilgisi
        const invEl = document.getElementById('modal-invoice');
        if (invEl) {
            if (order.invoice_number) {
                const viewUrl = `/api/invoices/${encodeURIComponent(order.id)}`;
                invEl.innerHTML = `<strong>${escapeHtml(order.invoice_number)}</strong> (${escapeHtml(order.invoice_status || '-')}) — <a href="${viewUrl}" target="_blank" rel="noopener">Faturayi Goruntule</a>`;
            } else if (order.invoice_error) {
                invEl.innerHTML = `<span style="color:#ef4444;">HATA: ${escapeHtml(order.invoice_error)}</span>`;
            } else {
                invEl.textContent = 'Henuz kesilmedi';
            }
        }

        document.getElementById('order-modal').classList.remove('hidden');
    }

    // Modal kapat
    document.getElementById('close-modal').addEventListener('click', closeModal);
    document.getElementById('cancel-modal-btn').addEventListener('click', closeModal);
    function closeModal() {
        document.getElementById('order-modal').classList.add('hidden');
        currentOrderId = null;
    }

    // Siparis kaydet
    document.getElementById('save-order-btn').addEventListener('click', async () => {
        if (!currentOrderId) return;

        const data = {
            status: document.getElementById('modal-status').value,
            carrier: document.getElementById('modal-carrier').value.trim() || undefined,
            tracking_number: document.getElementById('modal-tracking').value.trim() || undefined
        };

        const result = await apiCall(`/api/admin/orders/${currentOrderId}`, {
            method: 'POST',
            body: JSON.stringify(data)
        });

        if (result && result.success) {
            closeModal();
            loadOrders();
        }
    });

    // ===== URUN YONETIMI =====

    document.getElementById('refresh-products-btn').addEventListener('click', loadProducts);

    async function loadProducts() {
        const products = await apiCall('/api/admin/products');
        if (!products) return;
        renderProducts(products);
    }

    function renderProducts(products) {
        const container = document.getElementById('products-list');
        if (!products || products.length === 0) {
            container.innerHTML = '<p class="admin-empty">Urun bulunamadi.</p>';
            return;
        }

        container.innerHTML = `
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Slug</th>
                        <th>Urun Adi</th>
                        <th>Fiyat (TL)</th>
                        <th>Stok</th>
                        <th>Durum</th>
                        <th>Islem</th>
                    </tr>
                </thead>
                <tbody>
                    ${products.map(p => `
                        <tr data-slug="${escapeHtml(p.slug)}">
                            <td><code>${escapeHtml(p.slug)}</code></td>
                            <td><strong>${escapeHtml(p.name)}</strong></td>
                            <td><input type="number" class="product-price-input" step="0.01" min="0" value="${(p.price / 100).toFixed(2)}" style="width:120px;"></td>
                            <td><input type="number" class="product-stock-input" min="0" value="${p.stock}" style="width:90px;"></td>
                            <td>${p.stock > 0 ? '<span style="color:#10b981;">Stokta</span>' : '<span style="color:#ef4444;">Tukendi</span>'}</td>
                            <td><button type="button" class="btn btn-primary btn-sm product-save-btn">Kaydet</button></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <p style="margin-top:1rem;color:#666;font-size:0.85rem;">
                Fiyat TL cinsinden girilir (kurus icin ondalik kullanin, orn: 1500.50).
                Stok tam sayi olmalidir. Satis onaylandiginda otomatik stoktan dusulur, siparis iptal edilirse iade edilir.
            </p>
        `;

        // Kaydet butonlari
        container.querySelectorAll('.product-save-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const tr = btn.closest('tr');
                const slug = tr.dataset.slug;
                const priceTL = parseFloat(tr.querySelector('.product-price-input').value);
                const stock = parseInt(tr.querySelector('.product-stock-input').value);

                if (isNaN(priceTL) || priceTL < 0) { alert('Gecersiz fiyat'); return; }
                if (isNaN(stock) || stock < 0) { alert('Gecersiz stok'); return; }

                const priceKurus = Math.round(priceTL * 100);
                btn.disabled = true;
                btn.textContent = 'Kaydediliyor...';

                const result = await apiCall(`/api/admin/products/${encodeURIComponent(slug)}`, {
                    method: 'POST',
                    body: JSON.stringify({ price: priceKurus, stock: stock })
                });

                btn.disabled = false;
                btn.textContent = 'Kaydet';

                if (result && result.success) {
                    btn.textContent = 'Kaydedildi';
                    setTimeout(() => { btn.textContent = 'Kaydet'; }, 1500);
                } else if (result && result.error) {
                    alert('Hata: ' + result.error);
                }
            });
        });
    }

    // Yardimci fonksiyonlar
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function formatPrice(amount) {
        return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(amount);
    }

    function formatDate(dateStr) {
        return new Date(dateStr).toLocaleDateString('tr-TR', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    }
});
