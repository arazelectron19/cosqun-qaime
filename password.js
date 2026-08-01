// ==========================================================================
// PİN KOD VƏ SESSIYA/İNAKTİVLİK MƏNTİQİ
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    const correctPin = "1453"; // PİN kodu buradan dəyişə bilərsiniz
    let enteredPin = "";
    let isChecking = false;
    
    const pinScreen = document.getElementById('pin-screen');
    const dots = document.querySelectorAll('.pin-dot');
    const pad = document.querySelector('.pin-pad');
    const errorMsg = document.getElementById('pin-error-msg');

    if (!pinScreen) return;

    const LOCK_DURATION = 30 * 1000; // 30 saniyə (milisaniyə ilə)
    const lastActiveTime = sessionStorage.getItem("app_last_active_time");
    const currentTime = new Date().getTime();
    const isUnlocked = sessionStorage.getItem("isUnlocked") === "true";

    // Əgər əvvəl açılıbsa VƏ son 30 saniyə ərzində hərəkətsizlik müddəti bitməyibsə (səhifə yenilənsə belə sessionStorage qaldığı üçün PİN istəməyəcək)
    if (isUnlocked && lastActiveTime && (currentTime - parseInt(lastActiveTime)) < LOCK_DURATION) {
        pinScreen.style.display = 'none';
        initInactivityTimer();
    } else {
        // 30 saniyədən çox hərəkətsiz qalıbsa və ya ilk dəfə açılırsa
        sessionStorage.removeItem("isUnlocked");
        pinScreen.style.display = 'flex';
        pinScreen.style.opacity = '1';
    }

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
            sessionStorage.setItem("isUnlocked", "true");
            sessionStorage.setItem("app_last_active_time", new Date().getTime().toString());

            pinScreen.style.opacity = '0';
            pinScreen.style.transition = 'opacity 0.3s ease';
            setTimeout(() => {
                pinScreen.style.display = 'none';
                isChecking = false;
                initInactivityTimer(); 
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

    // 30 saniyə hərəkətsizlik taymeri
    function initInactivityTimer() {
        let inactivityTimeout;

        function resetTimer() {
            clearTimeout(inactivityTimeout);
            const now = new Date().getTime();
            sessionStorage.setItem("app_last_active_time", now.toString());

            inactivityTimeout = setTimeout(() => {
                sessionStorage.removeItem("isUnlocked");
                sessionStorage.removeItem("app_last_active_time");
                location.reload(); 
            }, LOCK_DURATION); 
        }

        // İstifadəçi hərəkətlərini izləyirik
        ['mousemove', 'mousedown', 'keypress', 'touchstart', 'scroll'].forEach(event => {
            window.addEventListener(event, resetTimer, { passive: true });
        });

        resetTimer();
    }
});