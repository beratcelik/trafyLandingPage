// Ortak header/footer + WhatsApp FAB + Kariyer Modal enjekte eder
// Icerik sayfalari (hakkimizda.html, garanti.html, vb.) tarafindan kullanilir.
document.addEventListener('DOMContentLoaded', () => {
    const headerHTML = `
        <header>
            <div class="header-center">
                <div class="logo-wrapper">
                    <a href="/"><img src="./images/t_logo.png" alt="Trafy Logo" style="height: 64px;"></a>
                </div>
                <nav class="desktop-nav">
                    <a href="/">Ana Sayfa</a>
                    <a href="/#filter">Araç İçi Kamera</a>
                    <a href="/kullanim-kilavuzu/" target="_self">Kullanım Kılavuzu</a>
                </nav>
                <button class="menu-toggle" aria-label="Menüyü Aç">
                    <i data-lucide="menu"></i>
                </button>
            </div>
            <nav class="mobile-nav">
                <a href="/">Ana Sayfa</a>
                <a href="/#filter">Araç İçi Kamera</a>
                <a href="/kullanim-kilavuzu/" target="_self">Kullanım Kılavuzu</a>
            </nav>
        </header>
    `;

    const footerHTML = `
        <footer>
            <div class="footer-grid">
                <div class="footer-col">
                    <h4 class="footer-col-title">Destek</h4>
                    <ul class="footer-links">
                        <li><a href="/tracking.html">Sipariş Takibi</a></li>
                        <li><a href="/kullanim-kilavuzu/">Kullanım Kılavuzu</a></li>
                        <li><a href="/garanti.html">Garanti</a></li>
                        <li><a href="/sss.html">Sıkça Sorulan Sorular</a></li>
                    </ul>
                </div>
                <div class="footer-col">
                    <h4 class="footer-col-title">İş Ortaklığı</h4>
                    <ul class="footer-links">
                        <li><a href="/bayi.html">Bayi Olun</a></li>
                        <li><a href="/montaj-partneri.html">Montaj Partneri Olun</a></li>
                        <li><a href="/toptan.html">Toptan Satın Alın</a></li>
                        <li><a href="/kurumsal.html">Kurumsal Alışveriş</a></li>
                    </ul>
                </div>
                <div class="footer-col">
                    <h4 class="footer-col-title">Trafy Hakkında</h4>
                    <ul class="footer-links">
                        <li><a href="/hakkimizda.html">Hakkımızda</a></li>
                        <li><a href="/trafy-kulubu.html">Trafy Kulübü</a></li>
                        <li><a href="/kariyer.html">Kariyer Fırsatları</a></li>
                        <li>
                            <a href="https://wa.me/905554005342" target="_blank" rel="noopener">
                                İletişim — WhatsApp
                            </a>
                        </li>
                    </ul>
                </div>
                <div class="footer-col">
                    <h4 class="footer-col-title">Bizi Takip Edin</h4>
                    <ul class="footer-links footer-social">
                        <li>
                            <a href="https://www.instagram.com/trafykamerasi/" target="_blank" rel="noopener">
                                <i data-lucide="instagram"></i> @trafykamerasi
                            </a>
                        </li>
                        <li>
                            <a href="https://t.me/trafy_kulubu" target="_blank" rel="noopener">
                                <i data-lucide="send"></i> trafy_kulubu
                            </a>
                        </li>
                        <li>
                            <a href="https://whatsapp.com/channel/0029VbCDkE3IyPtVNhtYL10Y" target="_blank" rel="noopener">
                                <i data-lucide="message-circle"></i> WhatsApp Kanalı
                            </a>
                        </li>
                    </ul>
                </div>
            </div>
            <div class="footer-bottom">
                <p>&copy; 2025 Trafy. Tüm hakları saklıdır.</p>
                <div class="payment-provider">
                    <img src="./images/param_logo.png" alt="Param ile Güvenli Öde" />
                </div>
            </div>
        </footer>
        <a href="https://wa.me/905554005342" target="_blank" rel="noopener" class="support-fab" aria-label="WhatsApp Destek">
            <i data-lucide="message-circle"></i>
        </a>
    `;

    const headerSlot = document.getElementById('layout-header');
    const footerSlot = document.getElementById('layout-footer');
    if (headerSlot) headerSlot.outerHTML = headerHTML;
    if (footerSlot) footerSlot.outerHTML = footerHTML;

    if (window.lucide?.createIcons) lucide.createIcons();

    // Mobil menu
    const menuToggle = document.querySelector('.menu-toggle');
    const mobileNav = document.querySelector('.mobile-nav');
    if (menuToggle && mobileNav) {
        menuToggle.addEventListener('click', () => {
            mobileNav.classList.toggle('active');
            const icon = menuToggle.querySelector('i');
            icon.setAttribute('data-lucide', mobileNav.classList.contains('active') ? 'x' : 'menu');
            lucide.createIcons();
        });
        mobileNav.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                mobileNav.classList.remove('active');
                menuToggle.querySelector('i').setAttribute('data-lucide', 'menu');
                lucide.createIcons();
            });
        });
    }

});
