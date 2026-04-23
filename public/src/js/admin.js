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
        loadSalesToggle();
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
            if (target === 'preorders') loadPreorders();
            if (target === 'careers') loadCareers();
            if (target === 'apk') loadApk();
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
        loadSalesToggle();
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
        const mock = document.getElementById('filter-mock').checked;
        const params = new URLSearchParams();
        if (status) params.set('status', status);
        if (mock) params.set('mock', 'true');
        const qs = params.toString() ? `?${params.toString()}` : '';
        const orders = await apiCall(`/api/admin/orders${qs}`);
        if (!orders) return;
        renderOrders(orders);
    }

    document.getElementById('refresh-btn').addEventListener('click', loadOrders);
    document.getElementById('filter-status').addEventListener('change', loadOrders);
    document.getElementById('filter-mock').addEventListener('change', loadOrders);

    // Mock siparis musterilerine toplu mailto
    document.getElementById('mock-mailto-btn').addEventListener('click', async () => {
        const mockOrders = await apiCall('/api/admin/orders?mock=true');
        if (!mockOrders) return;
        const emails = [...new Set(mockOrders.map(o => o.customer_email).filter(Boolean))];
        if (emails.length === 0) { alert('Mock siparis bulunamadi.'); return; }
        const subject = encodeURIComponent('Trafy siparisiniz hakkinda');
        const body = encodeURIComponent(
            'Merhaba,\n\nWeb sitemizde yaptiginiz siparis teknik bir sorun nedeniyle odeme tahsil edilmeden kaydedilmis. Bu durum icin ozur dileriz.\n\nSatis sistemimiz tekrar acildiginda siparisinizi onceliklendirmek icin ekteki on-siparis formunu doldurmanizi rica ederiz: https://trafy.tr/on-siparis.html\n\nTrafy Ekibi'
        );
        window.location.href = `mailto:?bcc=${emails.join(',')}&subject=${subject}&body=${body}`;
    });

    // Mock siparisleri IPTAL yap
    document.getElementById('cancel-mock-btn').addEventListener('click', async () => {
        if (!confirm('Tum mock (MOCK-) siparisleri IPTAL olarak isaretlenecek. Devam?')) return;
        const r = await apiCall('/api/admin/orders/cancel-mock', { method: 'POST' });
        if (r && r.success) {
            alert(`${r.cancelled} mock siparis IPTAL edildi.`);
            loadOrders();
        } else {
            alert('Hata: ' + (r && r.error || 'bilinmiyor'));
        }
    });

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
                    ${orders.map(o => {
                        const isMock = (o.param_transaction_id || '').startsWith('MOCK-');
                        return `
                        <tr${isMock ? ' style="background:#fff7e6;"' : ''}>
                            <td>${escapeHtml(o.id)}${isMock ? ' <span class="mock-badge" style="background:#f59e0b;color:#fff;font-size:0.7rem;padding:1px 6px;border-radius:4px;margin-left:4px;">MOCK</span>' : ''}</td>
                            <td>${escapeHtml(o.product_name)} x${o.quantity}</td>
                            <td>${escapeHtml(o.customer_name)}</td>
                            <td>${formatPrice(o.total_price / 100)}</td>
                            <td><span class="status-badge status-${o.status.toLowerCase()}">${STATUS_LABELS[o.status] || o.status}</span></td>
                            <td>${formatDate(o.created_at)}</td>
                            <td><button class="btn btn-outline btn-sm detail-btn" data-order-id="${escapeHtml(o.id)}">Detay</button></td>
                        </tr>
                    `;}).join('')}
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

    // ===== SATIS DURUMU TOGGLE =====

    async function loadSalesToggle() {
        const settings = await apiCall('/api/admin/settings');
        if (!settings) return;
        applySalesToggleUI(settings.sales_enabled);
    }

    function applySalesToggleUI(enabled) {
        const panel = document.getElementById('sales-toggle-panel');
        const toggle = document.getElementById('sales-toggle');
        const label = document.getElementById('sales-status-label');
        const hint = document.getElementById('sales-toggle-hint');
        if (!panel || !toggle || !label || !hint) return;
        toggle.checked = !!enabled;
        panel.classList.toggle('sales-on', !!enabled);
        label.textContent = enabled ? 'ACIK (odeme aliniyor)' : 'KAPALI (on-siparis moduna yonlendiriliyor)';
        hint.textContent = enabled ? 'Satisi durdurmak icin kapat' : 'Satisi acmak icin ac';
    }

    const salesToggleEl = document.getElementById('sales-toggle');
    if (salesToggleEl) {
        salesToggleEl.addEventListener('change', async () => {
            const enabled = salesToggleEl.checked;
            const confirmMsg = enabled
                ? 'Satislar acilacak: checkout + Param odeme + fatura aktif olacak. Devam?'
                : 'Satislar kapatilacak: checkout 503 donecek, musteri on-siparis formuna yonlendirilecek. Devam?';
            if (!confirm(confirmMsg)) {
                salesToggleEl.checked = !enabled;
                return;
            }
            salesToggleEl.disabled = true;
            const r = await apiCall('/api/admin/settings/sales-enabled', {
                method: 'POST',
                body: JSON.stringify({ enabled })
            });
            salesToggleEl.disabled = false;
            if (r && r.success) {
                applySalesToggleUI(r.sales_enabled);
            } else {
                salesToggleEl.checked = !enabled;
                alert('Hata: ' + (r && r.error || 'bilinmiyor'));
            }
        });
    }

    // ===== ON SIPARIS YONETIMI =====

    const preordersRefreshBtn = document.getElementById('refresh-preorders-btn');
    if (preordersRefreshBtn) preordersRefreshBtn.addEventListener('click', loadPreorders);

    const preorderMailtoBtn = document.getElementById('preorder-mailto-btn');
    if (preorderMailtoBtn) preorderMailtoBtn.addEventListener('click', () => {
        const selected = document.querySelectorAll('#preorders-list .preorder-select:checked');
        let emails;
        if (selected.length > 0) {
            emails = [...new Set(Array.from(selected).map(el => el.dataset.email))];
        } else {
            const all = document.querySelectorAll('#preorders-list .preorder-select');
            emails = [...new Set(Array.from(all).map(el => el.dataset.email))];
        }
        if (emails.length === 0) { alert('On-siparis bulunamadi.'); return; }
        const subject = encodeURIComponent('Trafy satislarimiz acildi');
        const body = encodeURIComponent(
            'Merhaba,\n\nTrafy urunlerine olan ilginiz icin tesekkur ederiz. Satislarimiz acildi; web sitemizden siparis verebilirsiniz:\nhttps://trafy.tr\n\nTrafy Ekibi'
        );
        window.location.href = `mailto:?bcc=${emails.join(',')}&subject=${subject}&body=${body}`;
    });

    async function loadPreorders() {
        const preorders = await apiCall('/api/admin/preorders');
        if (!preorders) return;
        renderPreorders(preorders);
    }

    function renderPreorders(preorders) {
        const container = document.getElementById('preorders-list');
        if (!preorders || preorders.length === 0) {
            container.innerHTML = '<p class="admin-empty">Henuz on-siparis yok.</p>';
            return;
        }
        container.innerHTML = `
            <table class="admin-table">
                <thead>
                    <tr>
                        <th><input type="checkbox" id="preorder-select-all"></th>
                        <th>Ad</th>
                        <th>Telefon</th>
                        <th>E-posta</th>
                        <th>Urun</th>
                        <th>Adet</th>
                        <th>Not</th>
                        <th>Tarih</th>
                        <th>Durum</th>
                        <th>Islem</th>
                    </tr>
                </thead>
                <tbody>
                    ${preorders.map(p => `
                        <tr data-id="${p.id}">
                            <td><input type="checkbox" class="preorder-select" data-email="${escapeHtml(p.customer_email)}"></td>
                            <td>${escapeHtml(p.customer_name)}</td>
                            <td>${escapeHtml(p.customer_phone)}</td>
                            <td><a href="mailto:${escapeHtml(p.customer_email)}">${escapeHtml(p.customer_email)}</a></td>
                            <td>${escapeHtml(p.product_name)}</td>
                            <td>${p.quantity}</td>
                            <td style="max-width:220px;white-space:normal;">${escapeHtml(p.note || '-')}</td>
                            <td>${formatDate(p.created_at)}</td>
                            <td>${p.notified ? '<span style="color:#10b981;">Bilgilendirildi</span>' : '<span style="color:#6b7280;">Beklemede</span>'}</td>
                            <td><button class="btn btn-outline btn-sm preorder-notify-btn" data-id="${p.id}" data-notified="${p.notified ? 1 : 0}">${p.notified ? 'Geri Al' : 'Isaretle'}</button></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        const selectAll = document.getElementById('preorder-select-all');
        if (selectAll) {
            selectAll.addEventListener('change', () => {
                container.querySelectorAll('.preorder-select').forEach(el => { el.checked = selectAll.checked; });
            });
        }

        container.querySelectorAll('.preorder-notify-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                const newValue = btn.dataset.notified === '1' ? false : true;
                const r = await apiCall(`/api/admin/preorders/${id}/notified`, {
                    method: 'POST',
                    body: JSON.stringify({ notified: newValue })
                });
                if (r && r.success) loadPreorders();
            });
        });
    }

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

    // ===== KARIYER BASVURULARI =====

    const careersRefreshBtn = document.getElementById('refresh-careers-btn');
    if (careersRefreshBtn) careersRefreshBtn.addEventListener('click', loadCareers);

    async function loadCareers() {
        const apps = await apiCall('/api/admin/career-applications');
        if (!apps) return;
        renderCareers(apps);
    }

    function renderCareers(apps) {
        const container = document.getElementById('careers-list');
        if (!apps || apps.length === 0) {
            container.innerHTML = '<p class="admin-empty">Henuz basvuru yok.</p>';
            return;
        }
        container.innerHTML = `
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Ad Soyad</th>
                        <th>E-posta</th>
                        <th>Telefon</th>
                        <th>LinkedIn</th>
                        <th>Pozisyon</th>
                        <th>Mesaj</th>
                        <th>Tarih</th>
                    </tr>
                </thead>
                <tbody>
                    ${apps.map(a => `
                        <tr>
                            <td>${escapeHtml(a.name)}</td>
                            <td><a href="mailto:${escapeHtml(a.email)}">${escapeHtml(a.email)}</a></td>
                            <td>${escapeHtml(a.phone || '-')}</td>
                            <td>${a.linkedin ? `<a href="${escapeHtml(a.linkedin)}" target="_blank" rel="noopener">LinkedIn</a>` : '-'}</td>
                            <td>${escapeHtml(a.position || '-')}</td>
                            <td style="max-width:280px;white-space:normal;">${escapeHtml(a.message || '-')}</td>
                            <td>${formatDate(a.created_at)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    // ===== ANDROID APK YONETIMI =====

    const apkRefreshBtn = document.getElementById('refresh-apk-btn');
    if (apkRefreshBtn) apkRefreshBtn.addEventListener('click', loadApk);

    async function loadApk() {
        const [status, versions] = await Promise.all([
            apiCall('/api/admin/apk/status'),
            apiCall('/api/admin/apk/versions')
        ]);
        if (!status || !versions) return;
        renderApkStatus(status);
        renderApkVersions(versions);
    }

    function renderApkStatus(s) {
        const c = document.getElementById('apk-status-panel');
        const signerOk = s.signer.keyExists && s.signer.publicKeyB64;
        const verifierOk = s.verifier && s.verifier.ok;
        c.innerHTML = `
            <div class="apk-status-tile ${signerOk ? 'ok' : 'bad'}">
                <span class="label">Manifest imzalama anahtari</span>
                <span class="value">${signerOk ? 'AKTIF' : 'EKSIK -- yukleme devre disi'}</span>
                ${s.signer.publicKeyB64 ? `<span class="label" title="${escapeHtml(s.signer.publicKeyB64)}">Public key (Android'e yapistirin)</span><code style="font-size:0.7rem;cursor:pointer;" data-copy="${escapeHtml(s.signer.publicKeyB64)}">${escapeHtml(s.signer.publicKeyB64.slice(0, 24))}...</code>` : ''}
            </div>
            <div class="apk-status-tile ${verifierOk ? 'ok' : 'bad'}">
                <span class="label">apksigner</span>
                <span class="value">${verifierOk ? escapeHtml(s.verifier.version) : 'BULUNAMADI'}</span>
                ${!verifierOk ? `<span class="label">${escapeHtml((s.verifier && s.verifier.error) || 'apksigner kurulu degil')}</span>` : ''}
            </div>
            <div class="apk-status-tile ${s.pinnedCert ? 'ok' : 'bad'}">
                <span class="label">Pinli release sertifikasi</span>
                <span class="value" title="${escapeHtml(s.pinnedCert || '')}">${s.pinnedCert ? escapeHtml(s.pinnedCert.slice(0, 24)) + '...' : 'Pinlenmemis (ilk yuklemede otomatik pinlenir)'}</span>
            </div>
            <div class="apk-status-tile">
                <span class="label">Aktif Surum</span>
                <span class="value">${s.current ? `v${escapeHtml(s.current.version_name)} (vc${s.current.version_code})` : 'Yok'}</span>
            </div>
        `;
        // Public key copy
        c.querySelectorAll('[data-copy]').forEach(el => {
            el.addEventListener('click', () => {
                navigator.clipboard.writeText(el.dataset.copy).then(() => {
                    const orig = el.textContent;
                    el.textContent = 'Kopyalandi';
                    setTimeout(() => { el.textContent = orig; }, 1200);
                });
            });
        });
    }

    function formatBytes(b) {
        if (b < 1024) return b + ' B';
        if (b < 1024*1024) return (b/1024).toFixed(1) + ' KB';
        return (b/(1024*1024)).toFixed(2) + ' MB';
    }

    function renderApkVersions(versions) {
        const c = document.getElementById('apk-versions-list');
        if (!versions || versions.length === 0) {
            c.innerHTML = '<p class="admin-empty">Henuz yuklu APK yok.</p>';
            return;
        }
        c.innerHTML = `
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Version</th>
                        <th>Boyut</th>
                        <th>SHA-256</th>
                        <th>Imza</th>
                        <th>Tarih</th>
                        <th>Notlar</th>
                        <th>Durum</th>
                        <th>Islem</th>
                    </tr>
                </thead>
                <tbody>
                    ${versions.map(v => `
                        <tr data-id="${v.id}">
                            <td><strong>${escapeHtml(v.version_name)}</strong> <small>(vc${v.version_code})</small></td>
                            <td>${formatBytes(v.file_size)}</td>
                            <td><code class="sha-short" data-copy="${escapeHtml(v.sha256)}" title="${escapeHtml(v.sha256)}">${escapeHtml(v.sha256.slice(0, 12))}...</code></td>
                            <td>${escapeHtml(v.signature_scheme || '-')}</td>
                            <td>${formatDate(v.uploaded_at)}</td>
                            <td style="max-width:240px;white-space:normal;font-size:0.8rem;">${escapeHtml((v.release_notes_tr || '').slice(0, 80))}${(v.release_notes_tr || '').length > 80 ? '...' : ''}</td>
                            <td>${v.is_current ? '<span class="badge-current">AKTIF</span>' : '<span class="badge-archived">arsiv</span>'}</td>
                            <td class="row-actions">
                                ${!v.is_current ? `<button type="button" class="btn btn-outline btn-sm apk-activate-btn" data-id="${v.id}">Aktif Et</button>` : ''}
                                ${!v.is_current ? `<button type="button" class="btn btn-outline btn-sm apk-delete-btn" data-id="${v.id}" style="color:#dc2626;border-color:#dc2626;">Sil</button>` : ''}
                                <a href="/app/${escapeHtml(v.file_name)}" class="btn btn-outline btn-sm" download>Indir</a>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        c.querySelectorAll('[data-copy]').forEach(el => {
            el.addEventListener('click', () => {
                navigator.clipboard.writeText(el.dataset.copy).then(() => {
                    const orig = el.textContent;
                    el.textContent = 'Kopyalandi';
                    setTimeout(() => { el.textContent = orig; }, 1200);
                });
            });
        });
        c.querySelectorAll('.apk-activate-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm('Bu surumu aktif yapmak istediginize emin misiniz? Tum kullanicilara guncelleme cagrisi gidecektir.')) return;
                btn.disabled = true;
                const r = await apiCall(`/api/admin/apk/activate/${btn.dataset.id}`, { method: 'POST' });
                if (r && r.success) loadApk();
                else alert('Hata: ' + (r && r.error || 'bilinmiyor'));
            });
        });
        c.querySelectorAll('.apk-delete-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm('Bu surum kalici olarak silinecek. Devam edilsin mi?')) return;
                btn.disabled = true;
                const r = await apiCall(`/api/admin/apk/${btn.dataset.id}`, { method: 'DELETE' });
                if (r && r.success) loadApk();
                else alert('Hata: ' + (r && r.error || 'bilinmiyor'));
            });
        });
    }

    // Upload form -- XHR ile (progress icin)
    const uploadForm = document.getElementById('apk-upload-form');
    if (uploadForm) {
        uploadForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const fileEl = document.getElementById('apk-file');
            if (!fileEl.files || !fileEl.files[0]) { alert('APK dosyasi secin'); return; }
            const fd = new FormData(uploadForm);

            const btn = document.getElementById('apk-upload-btn');
            const status = document.getElementById('apk-upload-status');
            const progress = document.getElementById('apk-progress');
            const bar = document.getElementById('apk-progress-bar');
            const result = document.getElementById('apk-result');

            btn.disabled = true;
            status.textContent = 'Yukleniyor...';
            progress.classList.add('active');
            bar.style.width = '0%';
            result.classList.remove('show', 'ok', 'err');
            result.textContent = '';

            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/admin/apk/upload');
            xhr.setRequestHeader('X-Admin-Secret', adminKey);
            xhr.upload.onprogress = (ev) => {
                if (ev.lengthComputable) {
                    const pct = (ev.loaded / ev.total) * 100;
                    bar.style.width = pct.toFixed(1) + '%';
                    if (pct >= 99) status.textContent = 'Sunucu dogruluyor (apksigner)...';
                }
            };
            xhr.onload = () => {
                btn.disabled = false;
                progress.classList.remove('active');
                let body;
                try { body = JSON.parse(xhr.responseText); } catch (_e) { body = { error: 'Sunucu yanitini ayrıstırılamadı: ' + xhr.responseText.slice(0, 500) }; }
                if (xhr.status >= 200 && xhr.status < 300 && body.success) {
                    result.classList.add('show', 'ok');
                    result.textContent = `Basarili: v${body.manifest.versionName} (vc${body.manifest.versionCode}) yayinlandi.\nSHA-256: ${body.sha256}\nImza semasi: ${body.verify.scheme}${body.verify.bootstrap ? '\nUYARI: ilk yukleme -- sertifika otomatik pinlendi. Lutfen .env icine APK_RELEASE_CERT_SHA256 ekleyin.' : ''}`;
                    status.textContent = 'Tamam';
                    uploadForm.reset();
                    loadApk();
                } else {
                    result.classList.add('show', 'err');
                    let msg = body.error || ('HTTP ' + xhr.status);
                    if (body.code === 'CERT_MISMATCH' && body.details) {
                        msg += `\nBeklenen: ${body.details.expected}\nGelen:    ${body.details.actual}`;
                    } else if (body.details && typeof body.details === 'string') {
                        msg += '\n\n' + body.details;
                    }
                    result.textContent = msg;
                    status.textContent = 'Hata';
                }
            };
            xhr.onerror = () => {
                btn.disabled = false;
                progress.classList.remove('active');
                result.classList.add('show', 'err');
                result.textContent = 'Ag hatasi -- yukleme basarisiz';
                status.textContent = 'Hata';
            };
            xhr.send(fd);
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
