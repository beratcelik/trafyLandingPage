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

    const setAllFallback = () => {
        setText("price-uno", "1500 TL");
        setText("price-uno-pro", "2500 TL");
        setText("price-dos", "4000 TL");
        setText("price-dos-pro", "7000 TL");
        setText("price-dos-internet", "8000 TL");
        setText("price-tres", "9000 TL");
        setText("price-tres-pro", "10000 TL");
    };

    fetch("/.netlify/functions/getPrices", { cache: "no-store" })
        .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        })
        .then((data) => {
            setText("price-uno", data["Trafy Uno"] || "1500 TL");
            setText("price-uno-pro", data["Trafy Uno Pro"] || "2500 TL");
            setText("price-dos", data["Trafy Dos"] || "4000 TL");
            setText("price-dos-pro", data["Trafy Dos Pro"] || "7000 TL");
            setText("price-dos-internet", data["Trafy Dos Internet"] || "8000 TL");
            setText("price-tres", data["Trafy Tres"] || "9000 TL");
            setText("price-tres-pro", data["Trafy Tres Pro"] || "10000 TL");
        })
        .catch(() => {
            setAllFallback();
        });
});
