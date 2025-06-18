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
    lucide.createIcons();
    fetch("/.netlify/functions/getPrices")
        .then(res => res.json())
        .then(data => {
            document.getElementById("price-uno").textContent = data["Trafy Uno"];
            document.getElementById("price-uno-pro").textContent = data["Trafy Uno Pro"];
            document.getElementById("price-dos").textContent = data["Trafy Dos"];
            document.getElementById("price-dos-pro").textContent = data["Trafy Dos Pro"];
            document.getElementById("price-tres").textContent = data["Trafy Tres"];
        })
        .catch(() => {
            document.getElementById("price-uno").textContent = "700 TL";
            document.getElementById("price-uno-pro").textContent = "2000 TL";
            document.getElementById("price-dos").textContent = "3000 TL";
            document.getElementById("price-dos-pro").textContent = "5000 TL";
            document.getElementById("price-tres").textContent = "7000 TL";
        });

});
