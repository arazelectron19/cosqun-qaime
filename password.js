// ==========================================================================
// PİN KOD MƏNTİQİ (PAROL: 1453)
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    const correctPin = "1453";
    let enteredPin = "";
    let isChecking = false;
    
    const pinScreen = document.getElementById('pin-screen');
    const dots = document.querySelectorAll('.pin-dot');
    const pad = document.querySelector('.pin-pad');
    const errorMsg = document.getElementById('pin-error-msg');

    if (!pinScreen) return;

    // Səhifə yenilənəndə dərhal PİN ekranını göstərmək üçün 
    // yoxlama məlumatını təmizləyirik (və ya localStorage yoxlamasını ləğv edirik)
    pinScreen.style.display = 'flex';
    pinScreen.style.opacity = '1';

    pad.addEventListener('click', (e) => {
        if (isChecking) return;

        const btn = e.target.closest('.pin-btn');
        if (!btn) return;

        const value = btn.getAttribute('data-value');
        const action = btn.getAttribute('data-action');

        if (errorMsg.classList.contains('visible')) {
            errorMsg.classList.remove('visible');
            dots.forEach(d => d.classList.remove('error'));
        }

        if (value !== null) {
            if (enteredPin.length < 4) {
                enteredPin += value;
                updateDots();
            }

            if (enteredPin.length === 4) {
                isChecking = true;
                setTimeout(verifyPin, 150);
            }
        } else if (action === 'clear') {
            enteredPin = "";
            updateDots();
        } else if (action === 'backspace') {
            enteredPin = enteredPin.slice(0, -1);
            updateDots();
        }
    });

    function updateDots() {
        dots.forEach((dot, index) => {
            if (index < enteredPin.length) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });
    }

    function verifyPin() {
        if (enteredPin === correctPin) {
            // Doğru olduqda sadəcə pəncərəni bağlayırıq (yaddaşda saxlamırıq ki, səhifə yenilənəndə yenidən istəsin)
            pinScreen.style.opacity = '0';
            pinScreen.style.transition = 'opacity 0.3s ease';
            setTimeout(() => {
                pinScreen.style.display = 'none';
                isChecking = false;
            }, 300);
        } else {
            dots.forEach(dot => dot.classList.add('error'));
            errorMsg.classList.add('visible');

            setTimeout(() => {
                enteredPin = "";
                updateDots();
                dots.forEach(dot => dot.classList.remove('error'));
                isChecking = false;
            }, 600);
        }
    }
});