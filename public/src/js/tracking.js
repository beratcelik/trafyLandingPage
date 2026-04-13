document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();

    const STATUS_ORDER = ['ODEME_BEKLENIYOR', 'ODEME_ONAYLANDI', 'HAZIRLANIYOR', 'KARGODA', 'TESLIM_EDILDI'];

    const input = document.getElementById('order-id-input');
    const trackBtn = document.getElementById('track-btn');

    // localStorage'dan son siparis ID'sini oku
    const lastOrderId = localStorage.getItem('lastOrderId');
    if (lastOrderId) {
        input.value = lastOrderId;
    }

    // URL'den siparis ID kontrol et
    const urlParams = new URLSearchParams(window.location.search);
    const urlOrderId = urlParams.get('order');
    if (urlOrderId) {
        input.value = urlOrderId;
        trackOrder(urlOrderId);
    }

    trackBtn.addEventListener('click', () => {
        const orderId = input.value.trim().toUpperCase();
        if (orderId) trackOrder(orderId);
    });

    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const orderId = input.value.trim().toUpperCase();
            if (orderId) trackOrder(orderId);
        }
    });

    async function trackOrder(orderId) {
        const resultDiv = document.getElementById('tracking-result');
        const errorDiv = document.getElementById('tracking-error');
        resultDiv.classList.add('hidden');
        errorDiv.classList.add('hidden');

        try {
            const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/status`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Siparis bulunamadi');
            }

            displayOrder(data);
            resultDiv.classList.remove('hidden');
        } catch (err) {
            document.getElementById('track-error-msg').textContent = err.message;
            errorDiv.classList.remove('hidden');
        }
    }

    function displayOrder(order) {
        document.getElementById('track-order-id').textContent = order.id;
        document.getElementById('track-product').textContent = order.product;
        document.getElementById('track-qty').textContent = order.quantity;
        document.getElementById('track-total').textContent = formatPrice(order.total / 100);
        document.getElementById('track-date').textContent = formatDate(order.date);

        // Durum adimlarini guncelle
        const steps = document.querySelectorAll('.tracking-step');
        const lines = document.querySelectorAll('.tracking-step-line');
        const currentIndex = STATUS_ORDER.indexOf(order.status);

        // Iptal durumu
        if (order.status === 'IPTAL') {
            document.getElementById('cancelled-info').classList.remove('hidden');
            document.getElementById('cargo-info').classList.add('hidden');
            steps.forEach(s => s.classList.remove('active', 'completed'));
            lines.forEach(l => l.classList.remove('completed'));
            return;
        }

        document.getElementById('cancelled-info').classList.add('hidden');

        steps.forEach((step, index) => {
            if (index < currentIndex) {
                step.classList.add('completed');
                step.classList.remove('active');
            } else if (index === currentIndex) {
                step.classList.add('active');
                step.classList.remove('completed');
            } else {
                step.classList.remove('active', 'completed');
            }
        });

        lines.forEach((line, index) => {
            line.classList.toggle('completed', index < currentIndex);
        });

        // Kargo bilgisi
        if (order.trackingNumber && order.carrier) {
            document.getElementById('cargo-info').classList.remove('hidden');
            document.getElementById('track-carrier').textContent = order.carrier;
            document.getElementById('track-tracking-number').textContent = order.trackingNumber;
        } else {
            document.getElementById('cargo-info').classList.add('hidden');
        }

        // Fatura bilgisi
        const invoiceInfo = document.getElementById('invoice-info');
        if (invoiceInfo) {
            if (order.invoiceNumber && order.invoiceUrl) {
                invoiceInfo.classList.remove('hidden');
                document.getElementById('track-invoice-number').textContent = order.invoiceNumber;
                const pdfLink = document.getElementById('track-invoice-pdf');
                pdfLink.href = order.invoiceUrl;
                pdfLink.classList.remove('hidden');
            } else {
                invoiceInfo.classList.add('hidden');
            }
        }

        lucide.createIcons();
    }

    function formatPrice(amount) {
        return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(amount);
    }

    function formatDate(dateStr) {
        return new Date(dateStr).toLocaleDateString('tr-TR', {
            year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    }
});
