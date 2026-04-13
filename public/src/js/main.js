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
