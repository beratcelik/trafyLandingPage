document.addEventListener('DOMContentLoaded', async () => {
    lucide.createIcons();

    // Urun gorseli haritalamasi (sadece gorsel yolu icin -- fiyat ve ad API'den gelir)
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

    // URL'den odeme sonucunu kontrol et
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get('status');
    if (status === 'success' || status === 'fail') {
        showResult(status, urlParams.get('order'), urlParams.get('error'));
        return;
    }

    // URL'den urun oku
    const productSlug = urlParams.get('product');

    // API'den urun bilgisini cek
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
            price: apiProduct.priceTL,   // TL cinsinden
            image: IMAGES[productSlug] || './images/t_logo.png',
            inStock: apiProduct.inStock
        };
    } catch (err) {
        alert('Urun bilgisi yuklenemedi. Lutfen tekrar deneyin.');
        window.location.href = '/';
        return;
    }

    if (!product.inStock) {
        alert(`${product.name} su an stokta bulunmuyor.`);
        window.location.href = '/';
        return;
    }

    // Urun bilgilerini doldur
    let quantity = 1;
    document.getElementById('product-image').src = product.image;
    document.getElementById('product-image').alt = product.name;
    document.getElementById('product-name').textContent = product.name;
    document.getElementById('product-price').textContent = formatPrice(product.price);
    updateTotal();

    function formatPrice(amount) {
        return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(amount);
    }

    function updateTotal() {
        document.getElementById('total-price').textContent = formatPrice(product.price * quantity);
        document.getElementById('quantity').value = quantity;
    }

    // Deneme urunu icin formu otomatik doldur (test amaciyla)
    if (productSlug === 'deneme') {
        document.getElementById('name').value = 'Test Kullanici';
        document.getElementById('phone').value = '05551234567';
        document.getElementById('email').value = 'test@trafy.tr';
        document.getElementById('tckn').value = '10000000146';
        document.getElementById('city').value = 'Istanbul';
        document.getElementById('district').value = 'Kadikoy';
        document.getElementById('address').value = 'Test Mahallesi, Test Sokak No:1 Daire:2';
        document.getElementById('note').value = 'Bu bir test siparisidir.';
    }

    // Adet secici
    document.getElementById('qty-minus').addEventListener('click', () => {
        if (quantity > 1) { quantity--; updateTotal(); }
    });
    document.getElementById('qty-plus').addEventListener('click', () => {
        if (quantity < 10) { quantity++; updateTotal(); }
    });

    // Adim gecisleri
    const steps = document.querySelectorAll('.checkout-step');
    const indicators = document.querySelectorAll('.step');

    function goToStep(num) {
        steps.forEach(s => s.classList.add('hidden'));
        document.getElementById('step-' + num).classList.remove('hidden');
        indicators.forEach(ind => {
            const stepNum = parseInt(ind.dataset.step);
            ind.classList.toggle('active', stepNum === num);
            ind.classList.toggle('completed', stepNum < num);
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    document.getElementById('to-step-2').addEventListener('click', () => goToStep(2));
    document.getElementById('back-to-1').addEventListener('click', () => goToStep(1));
    document.getElementById('to-step-3').addEventListener('click', () => {
        if (validateForm()) {
            fillConfirmation();
            goToStep(3);
        }
    });
    document.getElementById('back-to-2').addEventListener('click', () => goToStep(2));

    // TC Kimlik No checksum dogrulamasi
    function isValidTckn(value) {
        if (!/^\d{11}$/.test(value)) return false;
        if (value[0] === '0') return false;
        const d = value.split('').map(Number);
        const sumOdd = d[0] + d[2] + d[4] + d[6] + d[8];
        const sumEven = d[1] + d[3] + d[5] + d[7];
        // Negatif mod sorununu onlemek icin (((x % 10) + 10) % 10)
        const check10 = ((((sumOdd * 7) - sumEven) % 10) + 10) % 10;
        if (check10 !== d[9]) return false;
        const check11 = (sumOdd + sumEven + d[9]) % 10;
        return check11 === d[10];
    }

    // Form dogrulama
    function validateForm() {
        let valid = true;
        const fields = [
            { id: 'name', msg: 'Ad soyad en az 2 karakter olmali' },
            { id: 'phone', msg: 'Gecerli bir telefon numarasi girin (05xxxxxxxxx)', regex: /^05\d{9}$/ },
            { id: 'email', msg: 'Gecerli bir email adresi girin', regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
            { id: 'tckn', msg: 'Gecerli bir T.C. Kimlik No girin', custom: isValidTckn },
            { id: 'city', msg: 'Sehir gerekli' },
            { id: 'district', msg: 'Ilce gerekli' },
            { id: 'address', msg: 'Adres en az 10 karakter olmali', minLength: 10 }
        ];

        fields.forEach(f => {
            const el = document.getElementById(f.id);
            const error = el.parentElement.querySelector('.form-error');
            const val = el.value.trim();
            let fieldValid = true;

            if (!val || val.length < (f.minLength || 2)) {
                fieldValid = false;
            }
            if (f.regex && !f.regex.test(val)) {
                fieldValid = false;
            }
            if (f.custom && !f.custom(val)) {
                fieldValid = false;
            }

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

    // Onay bilgilerini doldur
    function fillConfirmation() {
        document.getElementById('confirm-product').textContent = product.name;
        document.getElementById('confirm-qty').textContent = quantity;
        document.getElementById('confirm-total').textContent = formatPrice(product.price * quantity);
        document.getElementById('confirm-name').textContent = document.getElementById('name').value.trim();
        document.getElementById('confirm-phone').textContent = document.getElementById('phone').value.trim();
        document.getElementById('confirm-email').textContent = document.getElementById('email').value.trim();
        document.getElementById('confirm-tckn').textContent = 'TCKN: ' + document.getElementById('tckn').value.trim();
        document.getElementById('confirm-address').textContent =
            document.getElementById('city').value.trim() + ', ' +
            document.getElementById('district').value.trim() + ' - ' +
            document.getElementById('address').value.trim();

        const note = document.getElementById('note').value.trim();
        if (note) {
            document.getElementById('confirm-note-section').style.display = 'block';
            document.getElementById('confirm-note').textContent = note;
        }
        lucide.createIcons();
    }

    // Odeme baslat
    document.getElementById('pay-btn').addEventListener('click', async () => {
        const payBtn = document.getElementById('pay-btn');
        const loading = document.getElementById('loading');
        payBtn.disabled = true;
        loading.classList.remove('hidden');

        try {
            const response = await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    product: productSlug,
                    quantity: quantity,
                    name: document.getElementById('name').value.trim(),
                    phone: document.getElementById('phone').value.trim(),
                    email: document.getElementById('email').value.trim(),
                    tckn: document.getElementById('tckn').value.trim(),
                    city: document.getElementById('city').value.trim(),
                    district: document.getElementById('district').value.trim(),
                    address: document.getElementById('address').value.trim(),
                    note: document.getElementById('note').value.trim() || undefined
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.errors ? data.errors.join(', ') : data.error || 'Siparis olusturulamadi');
            }

            // Siparis numarasini kaydet
            localStorage.setItem('lastOrderId', data.orderId);

            // Param 3D Secure HTML'i varsa goster (form otomatik submit olacak)
            if (data.paymentHtml) {
                const div = document.createElement('div');
                div.innerHTML = data.paymentHtml;
                document.body.appendChild(div);
                // Param genelde otomatik submit eden bir form gonderir
                const form = div.querySelector('form');
                if (form) form.submit();
            }
        } catch (err) {
            loading.classList.add('hidden');
            payBtn.disabled = false;
            alert(err.message || 'Bir hata olustu. Lutfen tekrar deneyin.');
        }
    });

    // Odeme sonucu goster
    function showResult(status, orderId, error) {
        document.querySelectorAll('.checkout-step').forEach(s => s.classList.add('hidden'));
        document.querySelector('.step-indicator').style.display = 'none';
        document.getElementById('step-result').classList.remove('hidden');

        if (status === 'success') {
            document.getElementById('result-success').classList.remove('hidden');
            document.getElementById('result-order-id').textContent = orderId || localStorage.getItem('lastOrderId') || '';
            if (orderId) localStorage.setItem('lastOrderId', orderId);
        } else {
            document.getElementById('result-fail').classList.remove('hidden');
            document.getElementById('result-error').textContent = error || 'Odeme isleminde bir sorun olustu.';
            document.getElementById('result-fail-order-id').textContent = orderId || localStorage.getItem('lastOrderId') || '';
        }
        lucide.createIcons();
    }
});
