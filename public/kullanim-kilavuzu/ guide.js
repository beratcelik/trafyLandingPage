let GUIDE = null;

const modelSelect = document.getElementById("modelSelect");
const track = document.getElementById("track");
const dots = document.getElementById("dots");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const heroTitle = document.getElementById("heroTitle");
const heroDesc = document.getElementById("heroDesc");
const search = document.getElementById("search");

const dlg = document.getElementById("dlg");
const dlgTitle = document.getElementById("dlgTitle");
const dlgText = document.getElementById("dlgText");
const dlgClose = document.getElementById("dlgClose");

let activeModel = null;
let allCards = [];
let filteredCards = [];
let activeIndex = 0;

function escapeHtml(str){
    return String(str ?? "")
        .replaceAll("&","&amp;")
        .replaceAll("<","&lt;")
        .replaceAll(">","&gt;")
        .replaceAll('"',"&quot;")
        .replaceAll("'","&#039;");
}

async function loadGuide(){
    // JSON yolu: /data/guide.json
    const res = await fetch("data/guide.json", { cache: "no-store" });
    if(!res.ok) throw new Error("guide.json yüklenemedi: " + res.status);
    GUIDE = await res.json();

    activeModel = GUIDE.defaultModel || (GUIDE.models?.[0] ?? "Trafy Tres Pro");
    setModel(activeModel, true);
    buildChips();

    // Export JSON (aktif model kartları)
    const exportBtn = document.getElementById("exportBtn");
    if(exportBtn){
        exportBtn.addEventListener("click", (e)=>{
            e.preventDefault();
            const payload = {
                activeModel,
                cards: cardsForModel(activeModel),
                version: GUIDE.version
            };
            navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
                .then(()=> alert("JSON panoya kopyalandı ✅"))
                .catch(()=> alert("Kopyalama başarısız. Tarayıcı izinlerini kontrol et."));
        });
    }
}

function buildChips(){
    modelSelect.innerHTML = "";
    (GUIDE.models || []).forEach(m=>{
        const chip = document.createElement("div");
        chip.className = "chip" + (m===activeModel ? " active" : "");
        chip.textContent = m;
        chip.onclick = ()=> setModel(m);
        modelSelect.appendChild(chip);
    });
}

function cardsForModel(model){
    return (GUIDE.cardsByModel && GUIDE.cardsByModel[model]) ? GUIDE.cardsByModel[model] : [];
}

function renderCards(cards){
    filteredCards = cards;
    activeIndex = 0;
    track.innerHTML = "";
    dots.innerHTML = "";

    cards.forEach((c, idx)=>{
        const slide = document.createElement("div");
        slide.className = "slide";

        const card = document.createElement("article");
        card.className = "card";
        card.dataset.index = idx;

        const media = document.createElement("div");
        media.className = "media";
        const ph = document.createElement("div");
        ph.className = "ph";
        ph.textContent = "Görsel/Ekran görüntüsü buraya (sonradan eklenecek)";
        media.appendChild(ph);

        const content = document.createElement("div");
        content.className = "content";
        content.innerHTML = `
      <div class="kicker">${escapeHtml(c.kicker)}</div>
      <h4 class="title">${escapeHtml(c.title)}</h4>
      <p class="desc">${escapeHtml(c.desc)}</p>
      <ul class="bullets">${(c.bullets||[]).map(b=>`<li>${escapeHtml(b)}</li>`).join("")}</ul>
    `;

        const foot = document.createElement("div");
        foot.className = "foot";
        const tag = document.createElement("div");
        tag.className = "tag";
        tag.textContent = c.tag || "Kart";
        const btn = document.createElement("button");
        btn.className = "btn";
        btn.textContent = "Detay";
        btn.onclick = ()=> openDetail(c);
        foot.appendChild(tag);
        foot.appendChild(btn);

        card.appendChild(media);
        card.appendChild(content);
        card.appendChild(foot);

        slide.appendChild(card);
        track.appendChild(slide);

        const d = document.createElement("div");
        d.className = "dotx" + (idx===0 ? " active" : "");
        d.onclick = ()=> goTo(idx);
        dots.appendChild(d);
    });

    updateCarousel();
}

function updateCarousel(){
    const n = filteredCards.length;
    activeIndex = Math.max(0, Math.min(activeIndex, Math.max(0, n-1)));
    track.style.transform = `translateX(${-activeIndex * 100}%)`;
    prevBtn.disabled = activeIndex <= 0;
    nextBtn.disabled = activeIndex >= n - 1;
    [...dots.children].forEach((el, i)=> el.classList.toggle("active", i===activeIndex));
}

function goTo(i){ activeIndex = i; updateCarousel(); }
function next(){ if(activeIndex < filteredCards.length - 1){ activeIndex++; updateCarousel(); } }
function prev(){ if(activeIndex > 0){ activeIndex--; updateCarousel(); } }

prevBtn.addEventListener("click", prev);
nextBtn.addEventListener("click", next);

window.addEventListener("keydown", (e)=>{
    if(e.key === "ArrowRight") next();
    if(e.key === "ArrowLeft") prev();
});

// Swipe (pointer)
let startX = 0, isDown = false, moved = false;

track.addEventListener("pointerdown", (e)=>{
    isDown = true; moved = false; startX = e.clientX;
    track.setPointerCapture?.(e.pointerId);
});

track.addEventListener("pointermove", (e)=>{
    if(!isDown) return;
    const dx = e.clientX - startX;
    if(Math.abs(dx) > 10) moved = true;
});

track.addEventListener("pointerup", (e)=>{
    if(!isDown) return;
    isDown = false;
    const dx = e.clientX - startX;
    if(!moved) return;
    if(dx < -40) next();
    if(dx > 40) prev();
});

function setModel(model, isInit=false){
    activeModel = model;

    heroTitle.textContent = model;
    heroDesc.textContent = GUIDE?.defaultHeroDesc || "";

    buildChips();

    allCards = cardsForModel(model);
    applySearch();

    // init sırasında search input temiz kalsın
    if(!isInit && search) search.value = "";
}

function openDetail(card){
    dlgTitle.textContent = card.title;
    dlgText.textContent = card.detail || "Detay metni yakında eklenecek.";
    dlg.showModal();
}
dlgClose.onclick = ()=> dlg.close();

function applySearch(){
    const q = (search.value || "").trim().toLowerCase();
    const filtered = !q ? allCards : allCards.filter(c=>{
        const hay = [
            c.kicker, c.title, c.desc, c.tag,
            ...(c.bullets||[]),
            c.detail
        ].join(" ").toLowerCase();
        return hay.includes(q);
    });
    renderCards(filtered);
}

search.addEventListener("input", applySearch);

// INIT
loadGuide().catch((err)=>{
    console.error(err);
    heroTitle.textContent = "Hata";
    heroDesc.textContent = "Kılavuz verisi yüklenemedi. Lütfen data/guide.json yolunu kontrol edin.";
});
