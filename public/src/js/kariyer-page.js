// Kariyer sayfasindaki ana basvuru formu (sayfa ici, modal degil)
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('kariyer-page-form');
    if (!form) return;

    // Bot korumasi: form yuklendigi an zamani kaydet
    const formLoadedAt = Date.now();

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('kp-name').value.trim();
        const email = document.getElementById('kp-email').value.trim();
        const phone = document.getElementById('kp-phone').value.trim();
        const linkedin = document.getElementById('kp-linkedin').value.trim();
        const position = document.getElementById('kp-position').value;
        const message = document.getElementById('kp-message').value.trim();
        const website = document.getElementById('kp-website').value; // honeypot

        const submitBtn = form.querySelector('.kariyer-submit-btn');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Gönderiliyor...';

        try {
            const res = await fetch('/api/career-applications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name, email, phone, linkedin, position, message,
                    website,                         // honeypot
                    form_loaded_at: formLoadedAt     // zaman kontrolu
                })
            });
            if (!res.ok) throw new Error('Sunucu hatası');

            form.reset();
            form.classList.add('hidden');
            const successBox = document.getElementById('kariyer-page-success');
            successBox.classList.remove('hidden');
            if (window.lucide?.createIcons) lucide.createIcons();
            successBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch (err) {
            alert('Başvurunuz iletilemedi. Lütfen daha sonra tekrar deneyin veya kariyer@trafy.com.tr adresine e-posta gönderin.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    });
});
