document.addEventListener("DOMContentLoaded", () => {
    const tabs = document.querySelectorAll(".tab");
    const groups = document.querySelectorAll(".detail-group");

    const activate = (filter) => {
        tabs.forEach((t) => t.classList.toggle("active", t.dataset.filter === filter));
        groups.forEach((g) => g.classList.toggle("active", g.dataset.filter === filter));
    };

    tabs.forEach((tab) => tab.addEventListener("click", () => activate(tab.dataset.filter)));
    if (tabs[0]) activate(tabs[0].dataset.filter);

    const detailCards = document.querySelectorAll(".detail-card");
    const modelDetails = document.querySelectorAll(".model-details");

    detailCards.forEach((card) => {
        card.addEventListener("click", () => {
            const targetId = card.getAttribute("data-target");
            modelDetails.forEach((detail) => detail.classList.remove("active"));

            if (targetId) {
                const targetElement = document.querySelector(targetId);
                if (targetElement) targetElement.classList.add("active");
            }
        });
    });

    // Lucide icons
    if (window.lucide?.createIcons) lucide.createIcons();

    const setText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };

    const formatTL = (kurus) => {
        const tl = kurus / 100;
        return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(tl) + ' TL';
    };

    const setAllFallback = () => {
        setText("price-uno", "1500 TL");
        setText("price-uno-pro", "2500 TL");
        setText("price-dos", "4000 TL");
        setText("price-dos-pro", "7000 TL");
        setText("price-dos-internet", "8000 TL");
        setText("price-tres", "9000 TL");
        setText("price-tres-pro", "10000 TL");
    };

    // Satis acik mi? Butonlari ve banner'i buna gore guncelle
    function applySalesUI(salesOn) {
        const banner = document.querySelector('.preorder-banner');
        if (banner) banner.style.display = salesOn ? 'none' : '';

        const links = document.querySelectorAll('a[href*="on-siparis.html?product="], a[href*="checkout.html?product="]');
        links.forEach(a => {
            const m = a.getAttribute('href').match(/product=([^&]+)/);
            if (!m) return;
            const slug = m[1];
            const page = salesOn ? 'checkout.html' : 'on-siparis.html';
            a.setAttribute('href', `${page}?product=${slug}`);

            if (a.classList.contains('buy-btn')) {
                a.textContent = salesOn ? 'Şimdi Satın Al' : 'Ön Sipariş Ver';
            } else {
                a.textContent = salesOn ? 'Satın Al' : 'Ön Sipariş';
            }
        });
    }

    fetch('/api/products/config', { cache: 'no-store' })
        .then(res => res.ok ? res.json() : null)
        .then(cfg => { if (cfg) applySalesUI(!!cfg.salesEnabled); })
        .catch(() => {});

    // Aktif APK surumunu cek (yoksa sessizce gec; butonlar zaten gizlenebilir)
    fetch('/api/app/info', { cache: 'no-store' })
        .then((res) => res.ok ? res.json() : null)
        .then((info) => {
            const heroBtn = document.getElementById('apk-download-hero');
            const footerLink = document.getElementById('apk-download-footer');
            const hv = document.getElementById('apk-version-hero');
            const fv = document.getElementById('apk-version-footer');
            if (!info) {
                // Henuz APK yayinlanmamis -- butonlari gizle
                if (heroBtn) heroBtn.style.display = 'none';
                if (footerLink && footerLink.parentElement) footerLink.parentElement.style.display = 'none';
                return;
            }
            if (hv) hv.textContent = `v${info.versionName}`;
            if (fv) fv.textContent = `v${info.versionName}`;
        })
        .catch(() => {});

    // Admin panelinden yonetilen fiyatlari DB'den cek
    fetch("/api/products", { cache: "no-store" })
        .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        })
        .then((products) => {
            const map = {};
            products.forEach(p => { map[p.slug] = p; });
            products.forEach(p => {
                setText(`price-${p.slug}`, formatTL(p.price));
                setText(`compare-price-${p.slug}`, formatTL(p.price));
            });
            // Stokta olmayan urunlerin kartini/linkini isaretle
            document.querySelectorAll('[data-product-slug]').forEach(el => {
                const slug = el.dataset.productSlug;
                const p = map[slug];
                if (p && !p.inStock) {
                    el.classList.add('out-of-stock');
                }
            });
        })
        .catch(() => {
            setAllFallback();
        });
});
