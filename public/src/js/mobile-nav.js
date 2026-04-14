// Sadece index.html icin: mobile menu toggle (layout.js zaten diger sayfalarda bunu yapiyor)
document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.querySelector('.menu-toggle');
    const mobileNav = document.querySelector('.mobile-nav');
    if (!menuToggle || !mobileNav) return;

    menuToggle.addEventListener('click', () => {
        mobileNav.classList.toggle('active');
        const icon = menuToggle.querySelector('i');
        icon.setAttribute('data-lucide', mobileNav.classList.contains('active') ? 'x' : 'menu');
        if (window.lucide?.createIcons) lucide.createIcons();
    });

    mobileNav.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            mobileNav.classList.remove('active');
            menuToggle.querySelector('i').setAttribute('data-lucide', 'menu');
            if (window.lucide?.createIcons) lucide.createIcons();
        });
    });
});
