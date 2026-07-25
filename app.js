// 1. Bütün lazım olan Firestore metodlarını və db-ni təhlükəsiz şəkildə yalnız bir yerdən import edirik
import { 
    db, 
    collection, 
    getDocs, 
    addDoc, 
    query, 
    orderBy, 
    serverTimestamp,
    doc, 
    updateDoc, 
    deleteDoc, 
    where 
} from "./firebase.js";

// 2. Service Worker qeydiyyatı
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js', { scope: '/cosqun-qaime/' })
        .then(() => console.log("Service Worker aktivləşdirildi."))
        .catch(err => console.error("SW qeydiyyat xətası:", err));
}

// BÖYÜDÜLMÜŞ VƏ OPTİMAL ÖLÇÜLÜ BİLDİRİŞ FUNKSİYASI
function showNotification(message, type = 'success') {
    const oldNotification = document.getElementById('custom-notification');
    if (oldNotification) oldNotification.remove();

    const notification = document.createElement('div');
    notification.id = 'custom-notification';
    notification.innerText = message;

    Object.assign(notification.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        padding: '14px 28px',          
        borderRadius: '8px',
        color: '#ffffff',
        fontWeight: '600',             
        fontSize: '15px',              
        zIndex: '10000',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        transition: 'all 0.3s ease',
        opacity: '0',
        transform: 'translateY(-20px)'
    });

    if (type === 'success') {
        notification.style.backgroundColor = '#10b981';
        notification.style.borderLeft = '6px solid #047857';
    } else {
        notification.style.backgroundColor = '#ef4444';
        notification.style.borderLeft = '6px solid #b91c1c';
    }

    document.body.appendChild(notification);
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateY(0)';
    }, 10);

    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(-20px)';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

const itemsBody = document.getElementById('invoice-items-body');
const btnAddItem = document.getElementById('btn-add-item');
const customerInput = document.getElementById('customer-input');
const totalPriceView = document.getElementById('total-price-view');
const waitingListContainer = document.getElementById('waiting-list-container');
const btnNewInvoice = document.getElementById('btn-new-invoice');
const selectTemplate = document.getElementById('select-template');
const dateInput = document.getElementById('invoice-date-input');
const btnSharePdf = document.getElementById('btn-share-pdf');

let invoiceItems = [{ name: '', qty: 1, price: 0 }];
let currentActiveDocId = null;
let dbProductsList = []; // Bazadan gələn sürətli məhsullar bura yığılacaq

document.addEventListener('DOMContentLoaded', () => {
    renderItems();
    fetchWaitingList();
    loadGlobalProductsAndTemplates();
    setTodayDate(); // Səhifə açılanda bu günün tarixini avtomatik yazır
    
    // Dropdown-dan seçim klik məntiqi
    const dropdown = document.getElementById('custom-dropdown');
    if (dropdown) {
        dropdown.addEventListener('click', (e) => {
            const itemEl = e.target.closest('.dropdown-item');
            if (!itemEl) return;

            const targetIndex = parseInt(dropdown.getAttribute('data-target-index'));
            if (isNaN(targetIndex)) return;

            invoiceItems[targetIndex].name = itemEl.textContent;
            invoiceItems[targetIndex].price = parseFloat(itemEl.dataset.price) || 0;
            
            renderItems();
            dropdown.style.display = 'none';
        });

        document.addEventListener('click', (e) => {
            if (!e.target.classList.contains('item-name') && !e.target.closest('#custom-dropdown')) {
                dropdown.style.display = 'none';
            }
        });
    }
});

function setTodayDate() {
    if (dateInput) {
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        const localISODate = (new Date(now - offset)).toISOString().slice(0, 10);
        dateInput.value = localISODate;
    }
}

// Firebase-dən həm məhsul siyahısını, həm də şablonları çəkirik
async function loadGlobalProductsAndTemplates() {
    try {
        // 1. Məhsulları alaq
        const pSnap = await getDocs(query(collection(db, "base_products"), orderBy("name")));
        dbProductsList = [];
        pSnap.forEach(d => dbProductsList.push(d.data()));

        // 2. Şablonları dropdown-a dolduraq
        if (selectTemplate) {
            const tSnap = await getDocs(collection(db, "base_templates"));
            selectTemplate.innerHTML = '<option value="">-- Şablon seçilməyib --</option>';
            tSnap.forEach(docSnapshot => {
                const tData = docSnapshot.data();
                const option = document.createElement('option');
                option.value = docSnapshot.id;
                option.textContent = tData.templateName;
                option.dataset.items = JSON.stringify(tData.items);
                selectTemplate.appendChild(option);
            });
        }
    } catch (e) {
        console.error("İlkin data yüklənmə xətası:", e);
    }
}

if (btnNewInvoice) {
    btnNewInvoice.addEventListener('click', () => {
        btnNewInvoice.classList.add('clicked');
        setTimeout(() => btnNewInvoice.classList.remove('clicked'), 500);
        resetForm(); 
    });
}

function renderItems() {
    itemsBody.innerHTML = '';
    let grandTotal = 0;

    invoiceItems.forEach((item, index) => {
        const rowTotal = item.qty * item.price;
        grandTotal += rowTotal;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="text-align: left; padding: 10px 5px;">${index + 1}</td>
            <td style="text-align: left; padding: 10px 5px;"><input type="text" class="item-name" value="${item.name || ''}" placeholder="Məhsulun adı"></td>
            <td style="text-align: left; padding: 10px 5px;"><input type="number" class="item-qty" value="${item.qty}" style="width: 60px;"></td>
            <td style="text-align: left; padding: 10px 5px;"><input type="number" class="item-price" value="${item.price || ''}" step="0.01" placeholder="0.00" style="width: 80px;"></td>
            <td style="text-align: left; padding: 10px 5px; font-weight: 600;" class="row-total-display">${rowTotal.toFixed(2)} AZN</td>
            <td style="text-align: left; padding: 10px 5px;"><button class="btn-delete-row">×</button></td>
        `;

        const nameInput = tr.querySelector('.item-name');
        const qtyInput = tr.querySelector('.item-qty');
        const priceInput = tr.querySelector('.item-price');
        const rowTotalDisplay = tr.querySelector('.row-total-display');
        const btnDeleteRow = tr.querySelector('.btn-delete-row');

        nameInput.addEventListener('input', (e) => {
            item.name = e.target.value;
            const dropdown = document.getElementById('custom-dropdown');
            
            if (dropdown) {
                if (dropdown.parentNode !== document.body) document.body.appendChild(dropdown);
                
                const rect = nameInput.getBoundingClientRect();
                
                dropdown.style.position = 'fixed'; 
                dropdown.style.left = `${rect.left}px`;
                dropdown.style.top = `${rect.bottom}px`;
                dropdown.style.width = `${rect.width}px`;
                dropdown.style.display = 'block';
                
                dropdown.setAttribute('data-target-index', index);
                filterDropdownItems(e.target.value, dropdown);
            }
        });

        qtyInput.addEventListener('input', (e) => {
            item.qty = parseInt(e.target.value) || 0;
            rowTotalDisplay.textContent = (item.qty * item.price).toFixed(2) + " AZN";
            fastCalculateTotal();
        });

        priceInput.addEventListener('input', (e) => {
            item.price = parseFloat(e.target.value) || 0;
            rowTotalDisplay.textContent = (item.qty * item.price).toFixed(2) + " AZN";
            fastCalculateTotal();
        });

        qtyInput.addEventListener('focus', (e) => { if(e.target.value == '0') e.target.value = ''; });
        priceInput.addEventListener('focus', (e) => { if(e.target.value == '0') e.target.value = ''; });

        btnDeleteRow.addEventListener('click', () => {
            if(invoiceItems.length === 1) {
                invoiceItems = [{ name: '', qty: 1, price: 0 }];
            } else {
                invoiceItems.splice(index, 1);
            }
            renderItems();
        });

        itemsBody.appendChild(tr);
    });

    if (totalPriceView) totalPriceView.textContent = grandTotal.toFixed(2);
}

function filterDropdownItems(filterText, dropdown) {
    dropdown.innerHTML = '';
    const queryStr = filterText.toLowerCase().trim();
    const filtered = dbProductsList.filter(p => p.name.toLowerCase().includes(queryStr));
    
    if (filtered.length === 0) {
        dropdown.style.display = 'none';
        return;
    }

    filtered.forEach(prod => {
        const dItem = document.createElement('div');
        dItem.className = 'dropdown-item';
        dItem.innerHTML = `<span>${prod.name}</span> <span style="float:right; opacity:0.6;">${prod.price} AZN</span>`;
        dItem.dataset.price = prod.price;
        
        dItem.addEventListener('mousedown', (e) => {
            e.preventDefault();
            const targetIndex = parseInt(dropdown.getAttribute('data-target-index'));
            invoiceItems[targetIndex].name = prod.name;
            invoiceItems[targetIndex].price = parseFloat(prod.price) || 0;
            renderItems();
            dropdown.style.display = 'none';
        });
        
        dropdown.appendChild(dItem);
    });
    dropdown.style.display = 'block';
}

function fastCalculateTotal() {
    const total = invoiceItems.reduce((sum, item) => sum + (item.qty * item.price), 0);
    if (totalPriceView) totalPriceView.textContent = total.toFixed(2);
}

if (btnAddItem) {
    btnAddItem.addEventListener('click', () => {
        btnAddItem.classList.add('clicked');
        setTimeout(() => btnAdditem.classList.remove('clicked'), 500);
        invoiceItems.push({ name: '', qty: 1, price: 0 });
        renderItems();
    });
}

const btnWaiting = document.getElementById('btn-waiting');
if (btnWaiting) {
    btnWaiting.addEventListener('click', async () => {
        btnWaiting.classList.add('clicked');
        setTimeout(() => btnWaiting.classList.remove('clicked'), 500);

        const customerName = customerInput.value.trim();
        const isFirstItemEmpty = invoiceItems.length === 1 && !invoiceItems[0].name.trim();

        if (!customerName || isFirstItemEmpty) {
            return showNotification("Müştəri adı və məhsul əlavə edin", "error");
        }

        const selectedDate = dateInput && dateInput.value ? new Date(dateInput.value) : new Date();

        const data = {
            customerName: customerName,
            items: invoiceItems,
            status: "waiting",
            updatedAt: selectedDate
        };

        try {
            if (currentActiveDocId) {
                await updateDoc(doc(db, "waiting_invoices", currentActiveDocId), data);
                showNotification("Qaimə uğurla yeniləndi!", "success");
            } else {
                await addDoc(collection(db, "waiting_invoices"), data);
                showNotification("Qaimə gözləməyə alındı!", "success");
            }
            resetForm();
            await fetchWaitingList();
        } catch (e) { 
            console.error(e); 
            showNotification("Xəta baş verdi!", "error");
        }
    });
}

async function fetchWaitingList() {
    if (!waitingListContainer) return;
    waitingListContainer.innerHTML = '<div class="loading-wrapper"><div class="sharp-ring-loader"></div></div>';
    try {
        const q = query(
            collection(db, "waiting_invoices"), 
            where("status", "==", "waiting")
        );
        const snap = await getDocs(q);
        waitingListContainer.innerHTML = '';

        if(snap.empty) {
            waitingListContainer.innerHTML = '<p style="font-size:12px; color:#9ca3af; text-align:center;">Gözləyən iş yoxdur.</p>';
            return;
        }

        const docsArray = [];
        snap.forEach(docSnap => {
            docsArray.push({ id: docSnap.id, ...docSnap.data() });
        });

        docsArray.sort((a, b) => {
            const timeA = a.updatedAt?.toDate ? a.updatedAt.toDate().getTime() : new Date(a.updatedAt).getTime();
            const timeB = b.updatedAt?.toDate ? b.updatedAt.toDate().getTime() : new Date(b.updatedAt).getTime();
            return timeB - timeA;
        });

        docsArray.forEach((data) => {
            const docId = data.id;
            const formattedDate = formatDate(data.updatedAt);

            const div = document.createElement('div');
            div.className = 'waiting-item';
            div.innerHTML = `
                <div style="flex:1;" class="info-area">
                    <strong style="color:#ffffff;">${data.customerName}</strong>
                    <span style="display:block; font-size:11px; color:#a5b4fc; margin-top:2px;">${data.items.length} məhsul</span>
                    <span style="display:block; font-size:10px; color:#9ca3af; margin-top:4px;">📅 ${formattedDate}</span>
                </div>
                <div class="action-area" style="display:flex; align-items:center;">
                    <button class="btn-delete-waiting">Sil</button>
                </div>
            `;

            div.addEventListener('click', (e) => {
                if(e.target.closest('.btn-delete-waiting') || e.target.closest('.waiting-item-confirm-box')) return;
                currentActiveDocId = docId;
                customerInput.value = data.customerName;
                invoiceItems = data.items;

                if (dateInput && data.updatedAt) {
                    const dateObj = data.updatedAt.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt);
                    const offset = dateObj.getTimezoneOffset() * 60000;
                    const localISODate = (new Date(dateObj - offset)).toISOString().slice(0, 10);
                    dateInput.value = localISODate;
                }

                renderItems();
                if (btnWaiting) btnWaiting.textContent = 'Yenilə';
            });

            const btnDelete = div.querySelector('.btn-delete-waiting');
            const actionArea = div.querySelector('.action-area');

            btnDelete.addEventListener('click', (e) => {
                e.stopPropagation();
                btnDelete.style.display = 'none';
                
                const confirmBox = document.createElement('div');
                confirmBox.className = 'waiting-item-confirm-box';
                confirmBox.innerHTML = `
                    <span>Silinsin?</span>
                    <button class="btn-confirm-yes" style="background:#ef4444; color:#fff; border:none; padding:3px 8px; margin:0 3px; cursor:pointer; border-radius:3px;">Bəli</button>
                    <button class="btn-confirm-no" style="background:#4b5563; color:#fff; border:none; padding:3px 8px; margin:0 3px; cursor:pointer; border-radius:3px;">Xeyr</button>
                `;

                confirmBox.querySelector('.btn-confirm-yes').addEventListener('click', async (eSub) => {
                    eSub.stopPropagation();
                    try {
                        await deleteDoc(doc(db, "waiting_invoices", docId));
                        if (currentActiveDocId === docId) resetForm();
                        fetchWaitingList();
                        showNotification("Qaimə uğurla silindi!", "success");
                    } catch (err) {
                        showNotification("Silmək mümkün olmadı!", "error");
                    }
                });

                confirmBox.querySelector('.btn-confirm-no').addEventListener('click', (eSub) => {
                    eSub.stopPropagation();
                    confirmBox.remove();
                    btnDelete.style.display = 'block';
                });

                actionArea.appendChild(confirmBox);
            });

            waitingListContainer.appendChild(div);
        });
    } catch (e) { 
        console.error(e); 
    }
}

const btnRefresh = document.getElementById('btn-refresh');
if (btnRefresh) {
    btnRefresh.addEventListener('click', async () => {
        btnRefresh.classList.add('clicked');
        await fetchWaitingList();
        setTimeout(() => btnRefresh.classList.remove('clicked'), 250);
    });
}

function resetForm() {
    if (customerInput) customerInput.value = '';
    if (selectTemplate) selectTemplate.selectedIndex = 0;
    invoiceItems = [{ name: '', qty: 1, price: 0 }];
    currentActiveDocId = null;
    setTodayDate();
    renderItems();
    if (btnWaiting) btnWaiting.textContent = 'Gözləməyə Al';
}

const btnSettings = document.getElementById('btn-settings');
if (btnSettings) {
    btnSettings.addEventListener('click', (e) => {
        e.preventDefault();
        btnSettings.classList.add('clicked');
        setTimeout(() => {
            btnSettings.classList.remove('clicked');
            window.location.href = btnSettings.getAttribute('href');
        }, 500);
    });
}

if (selectTemplate) {
    selectTemplate.addEventListener('change', (e) => {
        const selectedOption = e.target.options[e.target.selectedIndex];
        if (!selectedOption || !selectedOption.value) return; 
        
        try {
            const templateItems = JSON.parse(selectedOption.dataset.items);
            if (templateItems && templateItems.length > 0) {
                invoiceItems = templateItems.map(item => ({
                    name: item.name,
                    qty: item.qty || 1,
                    price: item.price || 0
                }));
                renderItems();
            }
        } catch (err) {
            console.error("Şablon tətbiq xətası:", err);
        }
    });
}

function formatDate(firestoreTimestamp) {
    if (!firestoreTimestamp) return "";
    const date = firestoreTimestamp.toDate ? firestoreTimestamp.toDate() : new Date(firestoreTimestamp);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
}

if (btnSharePdf) {
    btnSharePdf.addEventListener('click', () => {
        btnSharePdf.classList.add('clicked');
        setTimeout(() => btnSharePdf.classList.remove('clicked'), 500);

        if (invoiceItems.length === 1 && !invoiceItems[0].name.trim()) {
            return showNotification("Boş qaimə paylaşıla bilməz!", "error");
        }
        openShareChoiceModal();
    });
}

function openShareChoiceModal() {
    const old = document.getElementById('share-choice-modal');
    if (old) old.remove();

    const modal = document.createElement('div');
    modal.id = 'share-choice-modal';
    modal.className = 'share-choice-overlay';
    modal.innerHTML = `
        <div class="share-choice-box">
            <h3>Necə paylaşmaq istəyirsiniz?</h3>
            <div class="share-choice-buttons">
                <button type="button" id="share-choice-image" class="share-choice-btn">
                    <span class="share-choice-icon">🖼️</span>
                    <span>Şəkil</span>
                </button>
                <button type="button" id="share-choice-pdf" class="share-choice-btn">
                    <span class="share-choice-icon">📄</span>
                    <span>PDF</span>
                </button>
            </div>
            <button type="button" id="share-choice-cancel" class="share-choice-cancel">Ləğv et</button>
        </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
    document.getElementById('share-choice-cancel').addEventListener('click', () => modal.remove());
    document.getElementById('share-choice-image').addEventListener('click', () => {
        modal.remove();
        generateAndShareInvoice('image');
    });
    document.getElementById('share-choice-pdf').addEventListener('click', () => {
        modal.remove();
        generateAndShareInvoice('pdf');
    });
}

const COMPANY_INFO = {
    name: 'ARAZ ELECTRON',
    tagline: 'Elektronika və Texniki Dəstək Xidmətləri',
    address: 'Beyləqan r. Magistral yol',
    website: 'arazelectron.com',
    email: 'info@arazelectron.com',
    phone: '+994514280906',
    footerNote: 'Batareya və Hard Diskə zəmanət verilmir.',
    stampSrc: './mohur.png'
};

function buildInvoiceHTML() {
    const customerName = customerInput.value.trim() || "Müştəri";
    const selectedDate = dateInput ? dateInput.value : "";

    let formattedDate = "";
    if (selectedDate) {
        const parts = selectedDate.split("-");
        formattedDate = `${parts[2]}.${parts[1]}.${parts[0]}`;
    } else {
        const now = new Date();
        formattedDate = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()}`;
    }

    let tableRowsHTML = "";
    let grandTotal = 0;

    invoiceItems.forEach((item, index) => {
        const rowTotal = (item.qty || 1) * (item.price || 0);
        grandTotal += rowTotal;
        tableRowsHTML += `
            <tr style="border-bottom: 1px solid #e5e7eb; page-break-inside: avoid; break-inside: avoid;">
                <td style="padding: 10px 6px; font-size: 13px; color: #374151;">${index + 1}</td>
                <td style="padding: 10px 6px; font-size: 13px; font-weight: 700; color: #111111; word-break: break-word;">${item.name || ''}</td>
                <td style="padding: 10px 6px; font-size: 13px; text-align: center; color: #374151;">${item.qty}</td>
                <td style="padding: 10px 6px; font-size: 13px; text-align: right; color: #374151;">${item.price.toFixed(2)}</td>
                <td style="padding: 10px 6px; font-size: 13px; text-align: right; font-weight: 700; color: #111111;">${rowTotal.toFixed(2)}</td>
            </tr>
        `;
    });

    const html = `
        <div style="width: 794px; box-sizing: border-box; padding: 40px 45px; background-color: #ffffff; font-family: 'Noto Sans', Arial, sans-serif; color: #111111;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px;">
                <div>
                    <h1 style="font-size: 26px; font-weight: 800; margin: 0 0 14px 0; letter-spacing: 0.3px;">SATIŞ QAİMƏSİ</h1>
                    <div style="font-size: 11px; color: #6b7280; margin-bottom: 2px;">Kimə (Müştəri):</div>
                    <div style="font-size: 15px; font-weight: 700; padding-bottom: 6px; border-bottom: 1px solid #9ca3af; display: inline-block; min-width: 170px; margin-bottom: 10px;">${customerName}</div>
                    <div style="font-size: 12px; color: #6b7280; margin-top: 8px;">📅 Tarix: ${formattedDate}</div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 19px; font-weight: 800;">${COMPANY_INFO.name}</div>
                    <div style="font-size: 10.5px; color: #6b7280; margin: 3px 0 10px 0;">${COMPANY_INFO.tagline}</div>
                    <div style="font-size: 11px; color: #4b5563; line-height: 1.85;">
                        📍 ${COMPANY_INFO.address}<br>
                        🌐 ${COMPANY_INFO.website}<br>
                        ✉️ ${COMPANY_INFO.email}<br>
                        📞 ${COMPANY_INFO.phone}
                    </div>
                </div>
            </div>

            <table class="invoice-print-table" style="width: 100%; border-collapse: collapse; table-layout: fixed;">
                <thead>
                    <tr style="border-bottom: 2px solid #111111;">
                        <th style="padding: 8px 6px; text-align: left; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.4px; width: 5%;">#</th>
                        <th style="padding: 8px 6px; text-align: left; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.4px;">Məhsulun adı</th>
                        <th style="padding: 8px 6px; text-align: center; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.4px; width: 14%;">Miqdar</th>
                        <th style="padding: 8px 6px; text-align: right; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.4px; width: 14%;">Qiymət</th>
                        <th style="padding: 8px 6px; text-align: right; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.4px; width: 14%;">Cəmi</th>
                    </tr>
                </thead>
                <tbody>${tableRowsHTML}</tbody>
            </table>

            <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 55px;">
                <img src="${COMPANY_INFO.stampSrc}" crossorigin="anonymous" style="width: 86.67px; height: 130px; display: block;">
                <div style="text-align: right;">
                    <span style="font-size: 14px; color: #374151;">Yekun Ödəniş: </span>
                    <span style="font-size: 20px; font-weight: 800;">${grandTotal.toFixed(2)} AZN</span>
                </div>
            </div>

            <div style="text-align: center; margin-top: 36px; font-size: 11px; font-weight: 700;">
                ${COMPANY_INFO.footerNote}
            </div>
        </div>
    `;

    return { html, customerName };
}

function buildInvoicePrintContainer() {
    const { html, customerName } = buildInvoiceHTML();

    const printContainer = document.createElement('div');
    printContainer.className = 'pdf-render-hidden';
    Object.assign(printContainer.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        zIndex: '999999998',
        opacity: '1',
        pointerEvents: 'none',
        width: '794px'
    });
    printContainer.innerHTML = html;

    return { printContainer, customerName };
}

function showCaptureOverlay() {
    let overlay = document.getElementById('pdf-capture-overlay');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'pdf-capture-overlay';
    Object.assign(overlay.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        backgroundColor: '#0b132b',
        zIndex: '999999999',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#ffffff',
        fontSize: '15px',
        fontWeight: '600',
        gap: '14px'
    });
    overlay.innerHTML = `
        <div style="width:34px; height:34px; border:3px solid rgba(255,255,255,0.2); border-top-color:#5bc0be; border-radius:50%; animation: qaimeShareSpin 0.8s linear infinite;"></div>
        <div>Hazırlanır...</div>
        <style>@keyframes qaimeShareSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }</style>
    `;
    document.body.appendChild(overlay);
    return overlay;
}

function hideCaptureOverlay() {
    const overlay = document.getElementById('pdf-capture-overlay');
    if (overlay) overlay.remove();
}

async function waitForRenderReady(container) {
    if (document.fonts && document.fonts.ready) {
        try {
            await document.fonts.load("400 16px 'Noto Sans'");
            await document.fonts.load("700 16px 'Noto Sans'");
            await document.fonts.load("800 16px 'Noto Sans'");
            await document.fonts.ready;
        } catch (e) {}
    }

    if (container) {
        const images = Array.from(container.querySelectorAll('img'));
        await Promise.all(images.map((img) => {
            if (img.complete && img.naturalWidth > 0) return Promise.resolve();
            return new Promise((resolve) => {
                img.addEventListener('load', resolve, { once: true });
                img.addEventListener('error', resolve, { once: true });
                setTimeout(resolve, 3000);
            });
        }));
    }

    await new Promise(resolve => requestAnimationFrame(resolve));
}

function buildPdfBlobFromCanvas(canvas) {
    const jsPDFCtor = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
    if (!jsPDFCtor) throw new Error('jsPDF kitabxanası tapılmadı');

    const pageWidthMM = 210;   
    const pageHeightMM = 297;  
    const marginMM = 6;
    const usableWidthMM = pageWidthMM - marginMM * 2;
    const usableHeightMM = pageHeightMM - marginMM * 2;

    const imgHeightMM = (canvas.height * usableWidthMM) / canvas.width;
    const pdf = new jsPDFCtor({ unit: 'mm', format: 'a4', orientation: 'portrait' });

    if (imgHeightMM <= usableHeightMM) {
        const imgData = canvas.toDataURL('image/jpeg', 0.98);
        pdf.addImage(imgData, 'JPEG', marginMM, marginMM, usableWidthMM, imgHeightMM);
    } else {
        const pxPerMM = canvas.width / usableWidthMM;
        const pageContentHeightPx = Math.floor(usableHeightMM * pxPerMM);

        let yOffsetPx = 0;
        let first = true;
        while (yOffsetPx < canvas.height) {
            if (!first) pdf.addPage();
            first = false;

            const sliceHeightPx = Math.min(pageContentHeightPx, canvas.height - yOffsetPx);
            const sliceCanvas = document.createElement('canvas');
            sliceCanvas.width = canvas.width;
            sliceCanvas.height = sliceHeightPx;
            sliceCanvas.getContext('2d').drawImage(
                canvas, 0, yOffsetPx, canvas.width, sliceHeightPx,
                0, 0, canvas.width, sliceHeightPx
            );
            const sliceData = sliceCanvas.toDataURL('image/jpeg', 0.98);
            const sliceHeightMM = (sliceHeightPx * usableWidthMM) / canvas.width;
            pdf.addImage(sliceData, 'JPEG', marginMM, marginMM, usableWidthMM, sliceHeightMM);

            yOffsetPx += sliceHeightPx;
        }
    }

    return pdf.output('blob');
}

function toSafeFileName(text) {
    const map = {
        'ə': 'e', 'Ə': 'E',
        'ı': 'i', 'İ': 'I',
        'ş': 's', 'Ş': 'S',
        'ç': 'c', 'Ç': 'C',
        'ö': 'o', 'Ö': 'O',
        'ü': 'u', 'Ü': 'U',
        'ğ': 'g', 'Ğ': 'G'
    };
    return String(text)
        .split('')
        .map((ch) => map[ch] !== undefined ? map[ch] : ch)
        .join('')
        .replace(/[^a-zA-Z0-9_\-]/g, '_');
}

async function generateAndShareInvoice(type) {
    const originalBtnText = btnSharePdf.innerHTML;
    btnSharePdf.disabled = true;
    btnSharePdf.innerHTML = "⌛ Hazırlanır...";

    showCaptureOverlay();
    const { printContainer, customerName } = buildInvoicePrintContainer();
    document.body.appendChild(printContainer);

    try {
        await waitForRenderReady(printContainer);

        const safeName = toSafeFileName(`Qaime_${customerName.replace(/\s+/g, '_')}`);

        const canvas = await html2canvas(printContainer, {
            scale: 1.5,
            useCORS: true,
            allowTaint: false,
            backgroundColor: '#ffffff',
            imageTimeout: 0,
            windowWidth: 794,
            scrollX: 0,
            scrollY: 0
        });

        if (type === 'pdf') {
            const pdfBlob = await buildPdfBlobFromCanvas(canvas);
            const file = new File([pdfBlob], `${safeName}.pdf`, { type: 'application/pdf'});
            await shareOrDownloadFile(file, pdfBlob, `${safeName}.pdf`, 'PDF');
        } else {
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png', 1.0));
            const file = new File([blob], `${safeName}.png`, { type: 'image/png' });
            await shareOrDownloadFile(file, blob, `${safeName}.png`, 'Şəkil');
        }
    } catch (error) {
        console.error(error);
        showNotification("Xəta baş verdi! Yenidən cəhd edin.", "error");
    } finally {
        printContainer.remove();
        hideCaptureOverlay();
        btnSharePdf.disabled = false;
        btnSharePdf.innerHTML = originalBtnText;
    }
}

async function shareOrDownloadFile(file, blob, filename, label) {
    if (!navigator.share) {
        showNotification("Bu brauzer paylaşma funksiyasını ümumiyyətlə dəstəkləmir.", "error");
    } else {
        try {
            await navigator.share({ files: [file], title: 'Satış Qaiməsi' });
            return;
        } catch (err) {
            if (err && err.name === 'AbortError') return;
            console.warn('navigator.share uğursuz oldu:', err);
            showNotification(`Paylaşma xətası: [${err && err.name}] ${err && err.message}`, "error");
        }
    }

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 5000);
}
