
document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('.tab');
    const groups = document.querySelectorAll('.detail-group');

    const activate = (filter) => {
    tabs.forEach(t => t.classList.toggle('active', t.dataset.filter === filter));
    groups.forEach(g => g.classList.toggle('active', g.dataset.filter === filter));
};

    tabs.forEach(tab => {
    tab.addEventListener('click', () => activate(tab.dataset.filter));
});

    if (tabs[0]) activate(tabs[0].dataset.filter);

    const detailCards = document.querySelectorAll('.detail-card');
    const modelDetails = document.querySelectorAll('.model-details');

    detailCards.forEach(card => {
    card.addEventListener('click', () => {
    const targetId = card.getAttribute('data-target');

    // Tüm model detaylarını gizle
    modelDetails.forEach(detail => {
    detail.classList.remove('active');
});

    // Sadece ilgili modeli göster
    if (targetId) {
    const targetElement = document.querySelector(targetId);
    if (targetElement) {
    targetElement.classList.add('active');
    // scrollIntoView KALDIRILDI
}
}
});
});

/*
    // 👇 Shopier Button Injection
    const shopierLinks = {
    "uno": "https://www.shopier.com/s/product/35252586",
    "unopro": "https://www.shopier.com/s/product/35253512",
    "dos": "https://www.shopier.com/s/product/35254014",
    "dospro": "https://www.shopier.com/s/product/35256008",
    "tres": "https://www.shopier.com/s/product/35256356"
};

 */

});

