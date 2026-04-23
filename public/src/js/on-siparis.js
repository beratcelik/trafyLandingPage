document.addEventListener('DOMContentLoaded', async () => {
    lucide.createIcons();

    const IMAGES = {
        'deneme': './images/t_logo.png',
        'uno': './images/uno/uno_solo.png',
        'uno-pro': './images/unopro/uno_pro_solo.png',
        'dos': './images/dos/dos_solo.png',
        'dos-pro': './images/dospro/dos_pro_solo.png',
        'dos-internet': './images/dosinternet/dos_internet.png',
        'tres': './images/tres/tres_inner_solo.png',
        'tres-pro': './images/trespro/tres_pro.png'
    };

    const urlParams = new URLSearchParams(window.location.search);
    const productSlug = urlParams.get('product');

    if (!productSlug) {
        window.location.href = '/';
        return;
    }

    let product;
    try {
        const res = await fetch('/api/products', { cache: 'no-store' });
        if (!res.ok) throw new Error('Urun listesi alinamadi');
        const products = await res.json();
        const apiProduct = products.find(p => p.slug === productSlug);
        if (!apiProduct) {
            window.location.href = '/';
            return;
        }
        product = {
            name: apiProduct.name,
            price: apiProduct.priceTL,
            image: IMAGES[productSlug] || './images/t_logo.png'
        };
    } catch (err) {
        alert('Urun bilgisi yuklenemedi. Lutfen tekrar deneyin.');
        window.location.href = '/';
        return;
    }

    let quantity = 1;
    document.getElementById('product-image').src = product.image;
    document.getElementById('product-image').alt = product.name;
    document.getElementById('product-name').textContent = product.name;
    document.getElementById('product-price').textContent = formatPrice(product.price);
    document.getElementById('quantity').value = quantity;

    function formatPrice(amount) {
        return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(amount);
    }

    document.getElementById('qty-minus').addEventListener('click', () => {
        if (quantity > 1) { quantity--; document.getElementById('quantity').value = quantity; }
    });
    document.getElementById('qty-plus').addEventListener('click', () => {
        if (quantity < 10) { quantity++; document.getElementById('quantity').value = quantity; }
    });

    function validateForm() {
        const fields = [
            { id: 'name', msg: 'Ad soyad en az 2 karakter olmali' },
            { id: 'phone', msg: 'Gecerli bir telefon numarasi girin (05xxxxxxxxx)', regex: /^05\d{9}$/ },
            { id: 'email', msg: 'Gecerli bir email adresi girin', regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ }
        ];
        let valid = true;
        fields.forEach(f => {
            const el = document.getElementById(f.id);
            const error = el.parentElement.querySelector('.form-error');
            const val = el.value.trim();
            let fieldValid = val.length >= 2;
            if (f.regex && !f.regex.test(val)) fieldValid = false;
            if (!fieldValid) {
                el.classList.add('input-error');
                if (error) error.textContent = f.msg;
                valid = false;
            } else {
                el.classList.remove('input-error');
                if (error) error.textContent = '';
            }
        });
        return valid;
    }

    document.getElementById('preorder-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!validateForm()) return;

        const submitBtn = document.getElementById('submit-btn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Gonderiliyor...';

        try {
            const response = await fetch('/api/preorders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    product: productSlug,
                    quantity: quantity,
                    name: document.getElementById('name').value.trim(),
                    phone: document.getElementById('phone').value.trim(),
                    email: document.getElementById('email').value.trim(),
                    note: document.getElementById('note').value.trim() || undefined
                })
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.errors ? data.errors.join(', ') : data.error || 'On siparis olusturulamadi');
            }

            document.getElementById('preorder-form-wrap').classList.add('hidden');
            const success = document.getElementById('preorder-success');
            success.classList.remove('hidden');
            if (data.message) {
                document.getElementById('success-message').textContent = data.message;
            }
            lucide.createIcons();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (err) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'On Siparis Ver';
            alert(err.message || 'Bir hata olustu. Lutfen tekrar deneyin.');
        }
    });
});
