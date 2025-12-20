(() => {
    const DATA_URL = "/kullanim-kilavuzu/data/guide.json";

    const modelSelect = document.getElementById("modelSelect");
    const track = document.getElementById("track");
    const dots = document.getElementById("dots");
    const prevBtn = document.getElementById("prevBtn");
    const nextBtn = document.getElementById("nextBtn");
    const heroTitle = document.getElementById("heroTitle");
    const heroDesc = document.getElementById("heroDesc");
    const search = document.getElementById("search");
    const copyLink = document.getElementById("copyLink");
    const openShop = document.getElementById("openShop");

    const dlg = document.getElementById("dlg");
    const dlgTitle = document.getElementById("dlgTitle");
    const dlgText = document.getElementById("dlgText");
    const dlgClose = document.getElementById("dlgClose");

    let guideData = null;
    let MODELS = [];
    let baseCards = [];
    let overrides = {};

    let activeModel = "";
    let allCards = [];
    let filteredCards = [];
    let activeIndex = 0;

    // ---------- helpers ----------
    const escapeHtml = (s) => String(s ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

    function getModelFromUrl() {
        const params = new URLSearchParams(window.location.search);
        return params.get("model");
    }

    function setModelToUrl(model) {
        const url = new URL(window.location.href);
        url.searchParams.set("model", model);
        history.replaceState({}, "", url);
    }

    function cardsForModel(modelName) {
        // 1) modelCards varsa (full custom set) onu kullan
        const full = guideData.modelCards?.[modelName];
        if (Array.isArray(full) && full.length) return structuredClone(full);

        // 2) yoksa baseCards + overrides
        const extra = guideData.overrides?.[modelName] || [];
        return [...structuredClone(guideData.baseCards || []), ...structuredClone(extra)];
    }


    function buildChips() {
        modelSelect.innerHTML = "";
        MODELS.forEach((m) => {
            const chip = document.createElement("div");
            chip.className = "chip" + (m === activeModel ? " active" : "");
            chip.textContent = m;
            chip.onclick = () => setModel(m);
            modelSelect.appendChild(chip);
        });
    }

    function updateHero() {
        const m = (guideData.models || []).find(x => x.name === activeModel);
        heroTitle.textContent = m?.heroTitle || `${activeModel} • Kullanım Kılavuzu`;
        heroDesc.textContent = m?.heroDesc || "Kartları kaydırarak hızlıca öğren.";

        // Shop link
        if (m?.shopUrl) {
            openShop.href = m.shopUrl;
            openShop.style.display = "inline-flex";
        } else {
            openShop.href = "#";
            openShop.style.display = "none";
        }
    }

    function openDetail(card) {
        dlgTitle.textContent = card.title || "Detay";
        dlgText.textContent = card.detail || "";
        dlg.showModal();
    }

    function renderCards(cards) {
        filteredCards = cards;
        activeIndex = 0;
        track.innerHTML = "";
        dots.innerHTML = "";

        cards.forEach((c, idx) => {
            const slide = document.createElement("div");
            slide.className = "slide";

            const card = document.createElement("article");
            card.className = "card";
            card.dataset.index = String(idx);

            const media = document.createElement("div");
            media.className = "media";

            if (c.image) {
                const img = document.createElement("img");
                img.src = c.image;
                img.alt = c.imageAlt || c.title || "Kılavuz görseli";
                img.loading = "lazy";
                media.appendChild(img);
            } else {
                const ph = document.createElement("div");
                ph.className = "ph";
                ph.textContent = "Görsel/Ekran görüntüsü buraya (sonradan eklenecek)";
                media.appendChild(ph);
            }

            const content = document.createElement("div");
            content.className = "content";
            content.innerHTML = `
        <div class="kicker">${escapeHtml(c.kicker)}</div>
        <h4 class="title">${escapeHtml(c.title)}</h4>
        <p class="desc">${escapeHtml(c.desc)}</p>
        <ul class="bullets">${(c.bullets || []).map(b => `<li>${escapeHtml(b)}</li>`).join("")}</ul>
      `;

            const foot = document.createElement("div");
            foot.className = "foot";

            const tag = document.createElement("div");
            tag.className = "tag";
            tag.textContent = c.tag || "Kart";

            const btn = document.createElement("button");
            btn.className = "btn";
            btn.textContent = "Detay";
            btn.onclick = () => openDetail(c);

            foot.appendChild(tag);
            foot.appendChild(btn);

            card.appendChild(media);
            card.appendChild(content);
            card.appendChild(foot);

            slide.appendChild(card);
            track.appendChild(slide);

            const d = document.createElement("div");
            d.className = "dotx" + (idx === 0 ? " active" : "");
            d.onclick = () => goTo(idx);
            dots.appendChild(d);
        });

        updateCarousel();
    }

    function updateCarousel() {
        const x = activeIndex * track.parentElement.clientWidth;
        track.style.transform = `translateX(${-x}px)`;
        [...dots.children].forEach((el, i) => el.classList.toggle("active", i === activeIndex));
    }

    function goTo(idx) {
        if (!filteredCards.length) return;
        activeIndex = Math.max(0, Math.min(idx, filteredCards.length - 1));
        updateCarousel();
    }

    function next() { goTo(activeIndex + 1); }
    function prev() { goTo(activeIndex - 1); }

    function applySearch(q) {
        const needle = (q || "").trim().toLowerCase();
        if (!needle) {
            renderCards(allCards);
            return;
        }
        const f = allCards.filter(c => {
            const blob = [
                c.kicker, c.title, c.desc, c.detail,
                ...(c.bullets || [])
            ].join(" ").toLowerCase();
            return blob.includes(needle);
        });
        renderCards(f);
    }

    function setModel(modelName) {
        activeModel = modelName;
        setModelToUrl(activeModel);

        buildChips();
        updateHero();

        allCards = cardsForModel(activeModel);
        search.value = "";
        renderCards(allCards);

        // share link
        copyLink.onclick = async (e) => {
            e.preventDefault();
            const shareUrl = new URL(window.location.href);
            shareUrl.searchParams.set("model", activeModel);
            try {
                await navigator.clipboard.writeText(shareUrl.toString());
                copyLink.textContent = "✅ Link kopyalandı";
                setTimeout(() => copyLink.textContent = "🔗 Linki Kopyala", 1200);
            } catch {
                // fallback
                prompt("Linki kopyala:", shareUrl.toString());
            }
        };
    }

    // ---------- swipe support ----------
    let startX = 0;
    let dragging = false;

    function attachSwipe() {
        const vp = track.parentElement; // viewport
        vp.addEventListener("pointerdown", (e) => {
            dragging = true;
            startX = e.clientX;
            vp.setPointerCapture(e.pointerId);
        });

        vp.addEventListener("pointerup", (e) => {
            if (!dragging) return;
            dragging = false;
            const dx = e.clientX - startX;
            const threshold = Math.min(90, vp.clientWidth * 0.18);
            if (dx > threshold) prev();
            else if (dx < -threshold) next();
        });
    }

    // ---------- init ----------
    async function init() {
        const res = await fetch(DATA_URL, { cache: "no-store" });
        if (!res.ok) throw new Error(`guide.json yüklenemedi: HTTP ${res.status}`);

        guideData = await res.json();
        MODELS = (guideData.models || []).map(m => m.name);
        baseCards = guideData.baseCards || [];
        overrides = guideData.overrides || {};

        // query param ile model seç
        const fromUrl = getModelFromUrl();
        const initial = MODELS.includes(fromUrl) ? fromUrl : (MODELS[0] || "");
        if (!initial) throw new Error("Model listesi boş.");

        prevBtn.onclick = prev;
        nextBtn.onclick = next;

        dlgClose.onclick = () => dlg.close();
        dlg.addEventListener("click", (e) => {
            const r = dlg.getBoundingClientRect();
            const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
            if (!inside) dlg.close();
        });

        window.addEventListener("resize", updateCarousel);

        document.addEventListener("keydown", (e) => {
            if (dlg.open) return;
            if (e.key === "ArrowRight") next();
            if (e.key === "ArrowLeft") prev();
        });

        search.addEventListener("input", () => applySearch(search.value));

        attachSwipe();
        setModel(initial);
    }

    init().catch((err) => {
        console.error(err);
        heroTitle.textContent = "Kılavuz yüklenemedi";
        heroDesc.textContent = "Lütfen daha sonra tekrar deneyin.";
    });
})();
