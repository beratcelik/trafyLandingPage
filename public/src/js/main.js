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
        setText("price-uno", "—");
        setText("price-uno-pro", "—");
        setText("price-dos", "—");
        setText("price-dos-pro", "—");
        setText("price-tres", "—");
    };

    fetch("/.netlify/functions/getPrices", { cache: "no-store" })
        .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        })
        .then((data) => {
            setText("price-uno", data["Trafy Uno"] || "—");
            setText("price-uno-pro", data["Trafy Uno Pro"] || "—");
            setText("price-dos", data["Trafy Dos"] || "—");
            setText("price-dos-pro", data["Trafy Dos Pro"] || "—");
            setText("price-tres", data["Trafy Tres"] || "—");
        })
        .catch(() => {
            setAllFallback();
        });
});
