// 1) MODELLER
const MODELS = [
    "Trafy Uno",
    "Trafy Uno Pro",
    "Trafy Dos",
    "Trafy Dos Pro",
    "Trafy Dos Internet",
    "Trafy Tres",
    "Trafy Tres Pro",
];

// 2) ORTAK KARTLAR
const BASE_CARDS = [
    {
        kicker: "KUTU",
        title: "Kutudan çıkanlar",
        desc: "Kamerayı kurmadan önce kutu içeriğini hızlıca kontrol et.",
        bullets: [
            "Kamera gövdesi",
            "Güç kablosu (USB / USB-C modele göre)",
            "Montaj aparatı",
            "Kablo klipsleri",
        ],
        tag: "📦 Kutu İçeriği",
        detail:
            "Eksik parça varsa kuruluma geçmeden önce satıcıyla iletişime geç."
    },
    {
        kicker: "MONTAJ",
        title: "Kamerayı nereye takmalıyım?",
        desc: "En ideal konum: iç dikiz aynasının arkası.",
        bullets: [
            "Camı temizle",
            "Kamerayı hizala",
            "Kabloları gizle",
            "Gücü bağla",
        ],
        tag: "🔧 Montaj",
        detail:
            "Yapıştırmalı montajda 24 saat tam tutunma süresi önerilir."
    },
    {
        kicker: "HAFIZA",
        title: "MicroSD kart",
        desc: "Kartı ilk kullanımda kamerada formatla.",
        bullets: [
            "Class 10 veya üzeri",
            "256GB’a kadar",
            "Loop kayıt açık olmalı",
        ],
        tag: "💾 MicroSD",
        detail:
            "Kart dolunca eski videolar otomatik silinir."
    },
];

// 3) MODEL-ÖZEL KARTLAR
function cardsForModel(model){

    // === Trafy Tres Pro ===
    if(model === "Trafy Tres Pro"){
        return [
            {
                kicker:"ÜRÜN",
                title:"Trafy Tres Pro nedir?",
                desc:"3 kanallı, 4K çözünürlüklü, Wi-Fi ve GPS destekli araç içi kamera.",
                bullets:[
                    "4K + 1080p + 1080p",
                    "Ön + kabin içi entegre",
                    "Harici arka kamera",
                    "24 saat park modu"
                ],
                tag:"📷 Ürün",
                detail:"Araç kapalıyken de kayıt yapabilir."
            },
            {
                kicker:"KUTU",
                title:"Kutudan çıkanlar",
                desc:"Kutu içeriği listesi.",
                bullets:[
                    "Ana kamera",
                    "Arka kamera",
                    "Hardware kit (Type-C)",
                    "GPS modülü",
                    "Cam filmi & mendil"
                ],
                tag:"📦 Kutu",
                detail:"Hafıza kartı ayrıca temin edilir."
            }
        ];
    }

    // === Trafy Dos Internet ===
    if(model === "Trafy Dos Internet"){
        return [
            {
                kicker:"ÜRÜN",
                title:"Trafy Dos Internet nedir?",
                desc:"4G bağlantı destekli, çift kameralı araç içi kamera.",
                bullets:[
                    "4G uzaktan canlı izleme",
                    "2K ön + 1080p arka kamera",
                    "24 saat park modu",
                    "GPS dahili"
                ],
                tag:"📷 Ürün",
                detail:"Wi-Fi yakın mesafe, 4G uzaktan kullanım içindir."
            },
            {
                kicker:"KUTU",
                title:"Kutudan çıkanlar",
                desc:"Kurulum için gerekli tüm parçalar.",
                bullets:[
                    "Ana kamera",
                    "Arka kamera",
                    "Park modu kablosu",
                    "Yapıştırma aparatı",
                    "Temizlik mendili"
                ],
                tag:"📦 Kutu",
                detail:"Çakmaklık adaptörü yoktur."
            },
            {
                kicker:"WIFI",
                title:"Wi-Fi & Cloud View Genie",
                desc:"Telefon bağlantısı ve uzaktan erişim.",
                bullets:[
                    "Wi-Fi: A19-01_XXXX",
                    "Şifre: 12345678",
                    "Cloud View Genie uygulaması",
                    "4G ile uzaktan izleme"
                ],
                tag:"📶 Wi-Fi / 4G",
                detail:"Wi-Fi sırasında mobil internet kapanabilir."
            }
        ];
    }

    // Diğer modeller → ortak kartlar
    return JSON.parse(JSON.stringify(BASE_CARDS));
}

// ========== UI ==========
const modelSelect = document.getElementById("modelSelect");
const track = document.getElementById("track");
const dots = document.getElementById("dots");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const heroTitle = document.getElementById("heroTitle");
const heroDesc = document.getElementById("heroDesc");
const search = document.getElementById("search");

let activeModel = "Trafy Tres Pro";
let allCards = [];
let filteredCards = [];
let activeIndex = 0;

// Model chipleri
function buildChips(){
    modelSelect.innerHTML = "";
    MODELS.forEach(m=>{
        const chip = document.createElement("div");
        chip.className = "chip" + (m===activeModel ? " active" : "");
        chip.textContent = m;
        chip.onclick = ()=> setModel(m);
        modelSelect.appendChild(chip);
    });
}

// Kartları çiz
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

        card.innerHTML = `
      <div class="media"><div class="ph">Görsel buraya</div></div>
      <div class="content">
        <div class="kicker">${c.kicker}</div>
        <h4 class="title">${c.title}</h4>
        <p class="desc">${c.desc}</p>
        <ul class="bullets">${(c.bullets||[]).map(b=>`<li>${b}</li>`).join("")}</ul>
      </div>
      <div class="foot">
        <div class="tag">${c.tag}</div>
        <button class="btn">Detay</button>
      </div>
    `;

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
    track.style.transform = `translateX(${-activeIndex * 100}%)`;
    prevBtn.disabled = activeIndex <= 0;
    nextBtn.disabled = activeIndex >= filteredCards.length - 1;
    [...dots.children].forEach((el,i)=>el.classList.toggle("active", i===activeIndex));
}

function goTo(i){ activeIndex = i; updateCarousel(); }
function next(){ if(activeIndex < filteredCards.length-1){ activeIndex++; updateCarousel(); } }
function prev(){ if(activeIndex > 0){ activeIndex--; updateCarousel(); } }

prevBtn.onclick = prev;
nextBtn.onclick = next;

// Arama
search.addEventListener("input", ()=>{
    const q = search.value.toLowerCase();
    const filtered = allCards.filter(c =>
        [c.title,c.desc,(c.bullets||[]).join(" ")].join(" ").toLowerCase().includes(q)
    );
    renderCards(filtered);
});

// Model değiştir
function setModel(model){
    activeModel = model;
    heroTitle.textContent = model;
    heroDesc.textContent = "Kart kart ilerleyen hızlı kullanım kılavuzu.";
    buildChips();
    allCards = cardsForModel(model);
    renderCards(allCards);
}

// INIT
buildChips();
allCards = cardsForModel(activeModel);
renderCards(allCards);
