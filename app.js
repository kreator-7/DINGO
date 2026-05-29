// ============================================================
//  DINGO DB — Firebase Firestore (sincronización en la nube)
// ============================================================

const firebaseConfig = {
    apiKey: "AIzaSyB5KwDGBXU6AIKakRmKnq1cbdWdwAq7JPk",
    authDomain: "dingo-pos.firebaseapp.com",
    projectId: "dingo-pos",
    storageBucket: "dingo-pos.firebasestorage.app",
    messagingSenderId: "1016223041034",
    appId: "1:1016223041034:web:403777d442f6e4c03b81f3",
    measurementId: "G-9Y3TMVB6G7"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Colecciones en Firestore
const COL = {
    catalog:    db.collection('catalog'),
    categories: db.collection('categories'),
    purchases:  db.collection('purchases'),
    sales:      db.collection('sales'),
    closures:   db.collection('closures'),
    settings:   db.collection('settings'),
};

// Helpers para leer/escribir documentos simples
async function fsGet(col, id) {
    const snap = await COL[col].doc(id).get();
    return snap.exists ? snap.data() : null;
}
async function fsPut(col, id, data) {
    await COL[col].doc(id).set(data);
}
async function fsGetAll(col) {
    const snap = await COL[col].get();
    return snap.docs.map(d => ({ ...d.data(), _fsId: d.id }));
}
async function fsClearAndBulk(col, items) {
    const batch = db.batch();
    // Borrar todos los documentos existentes
    const existing = await COL[col].get();
    existing.docs.forEach(d => batch.delete(d.ref));
    // Agregar los nuevos
    items.forEach(item => {
        const ref = COL[col].doc(String(item.id ?? item.key ?? db.collection('_').doc().id));
        batch.set(ref, item);
    });
    await batch.commit();
}


const defaultCatalog = [
    { id: 1, name: 'Manzanas Frescas (1kg)', price: 15.50, buyPrice: 10.00, stock: 50, unit: 'Bs', barcode: '100000000001', category: 'Frescos', image: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6fac6?auto=format&fit=crop&q=80&w=400', tag: 'Orgánico' },
    { id: 2, name: 'Leche Deslactosada 1L', price: 8.00, buyPrice: 6.50, stock: 120, unit: 'Bs', barcode: '100000000002', category: 'Lácteos', image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&q=80&w=400', tag: 'Oferta' },
    { id: 3, name: 'Carne Premium Angus', price: 45.00, buyPrice: 35.00, stock: 20, unit: 'Bs/kg', barcode: '100000000003', category: 'Carnes', image: 'https://images.unsplash.com/photo-1603048297172-c92544798d5e?auto=format&fit=crop&q=80&w=400', tag: 'Fresco' },
    { id: 4, name: 'Bebida Energética', price: 12.00, buyPrice: 8.00, stock: 200, unit: 'Bs', barcode: '100000000004', category: 'Bebidas', image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&q=80&w=400', tag: 'Nuevo' },
    { id: 5, name: 'Pan Artesanal Integral', price: 10.50, buyPrice: 5.00, stock: 30, unit: 'Bs', barcode: '100000000005', category: 'Panadería', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=400', tag: 'Horneado Hoy' },
    { id: 6, name: 'Queso Mozzarella', price: 22.00, buyPrice: 15.00, stock: 40, unit: 'Bs', barcode: '100000000006', category: 'Lácteos', image: 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?auto=format&fit=crop&q=80&w=400', tag: 'Oferta' }
];

const defaultCategories = ['Todo', 'Frescos', 'Lácteos', 'Carnes', 'Bebidas', 'Panadería', 'Otros'];

const state = {
    currentUserRole: null, // 'admin' or 'cashier'
    currentTab: 'pos', // 'pos', 'delivery', 'catalog', 'settings'
    cart: [],
    catalog: [],
    categories: [],
    purchases: [],
    sales: [],
    closures: [],
    lastActiveDate: new Date().toLocaleDateString('en-CA'),
    cajaChicaAmount: 0,
    cajaChicaDate: '',
    selectedCategory: 'Todo',
    catalogViewMode: 'grid',
    catalogSearchQuery: '',
    isCheckoutOpen: false,
    isAddProductOpen: false,
    isManageCategoriesOpen: false,
    isAddPurchaseOpen: false,
    isPurchasesHistoryOpen: false,
    isClosuresHistoryOpen: false,
    editingCategoryIndex: -1,
    editingProductId: null,
    scannerImage: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=800',
    qrImage: 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=DingoPaymentDemo'
};

async function loadDatabase() {
    try {
        showToast("Conectando con la nube...", "cloud");

        // Leer todas las colecciones en paralelo desde Firestore
        const [loadedCatalog, loadedCategories, loadedPurchases, loadedSales, loadedClosures] = await Promise.all([
            fsGetAll('catalog'),
            fsGetAll('categories'),
            fsGetAll('purchases'),
            fsGetAll('sales'),
            fsGetAll('closures'),
        ]);

        const sImg    = await fsGet('settings', 'scannerImage');
        const qImg    = await fsGet('settings', 'qrImage');
        const lastDate = await fsGet('settings', 'lastActiveDate');
        const cDate   = await fsGet('settings', 'cajaChicaDate');
        const cAmt    = await fsGet('settings', 'cajaChicaAmount');

        // Si Firestore está vacío, subir los datos por defecto
        if (loadedCatalog.length === 0) {
            console.log('Firestore vacío — cargando datos por defecto...');
            await fsClearAndBulk('catalog', defaultCatalog);
            await fsClearAndBulk('categories', defaultCategories.map((name, i) => ({ id: i + 1, name })));
            state.catalog = defaultCatalog;
            state.categories = defaultCategories;
        } else {
            state.catalog = loadedCatalog;
            state.categories = loadedCategories.length > 0
                ? loadedCategories.sort((a,b) => (a.id||0)-(b.id||0)).map(c => c.name)
                : defaultCategories;
        }

        state.purchases = loadedPurchases;
        state.sales     = loadedSales;
        state.closures  = loadedClosures;

        if (sImg)    state.scannerImage    = sImg.value;
        if (qImg)    state.qrImage         = qImg.value;
        if (lastDate) state.lastActiveDate = lastDate.value;
        if (cDate)   state.cajaChicaDate   = cDate.value;
        if (cAmt)    state.cajaChicaAmount = cAmt.value;

        // Activar sincronización en tiempo real
        activarSyncTiempoReal();

        setTimeout(() => showToast("✅ Conectado a la nube", "cloud"), 500);

    } catch (error) {
        console.error("Error cargando desde Firestore:", error);
        showToast("Error al conectar con la nube", "alert-triangle");
    }
}

async function saveDatabase() {
    try {
        await Promise.all([
            fsClearAndBulk('catalog',    state.catalog),
            fsClearAndBulk('categories', state.categories.map((name, i) => ({ id: i + 1, name }))),
            fsClearAndBulk('purchases',  state.purchases),
            fsClearAndBulk('sales',      state.sales),
            fsClearAndBulk('closures',   state.closures),
        ]);
        await Promise.all([
            fsPut('settings', 'scannerImage',    { value: state.scannerImage }),
            fsPut('settings', 'qrImage',         { value: state.qrImage }),
            fsPut('settings', 'lastActiveDate',  { value: state.lastActiveDate }),
            fsPut('settings', 'cajaChicaDate',   { value: state.cajaChicaDate }),
            fsPut('settings', 'cajaChicaAmount', { value: state.cajaChicaAmount }),
        ]);
    } catch(error) {
        console.error("Error guardando en Firestore:", error);
        showToast("Error al guardar datos en la nube", "alert-triangle");
    }
}

// Sincronización en tiempo real: recarga la app cuando otro dispositivo hace cambios
function activarSyncTiempoReal() {
    COL.catalog.onSnapshot(snap => {
        if (snap.metadata.hasPendingWrites) return; // ignorar cambios locales propios
        const nuevos = snap.docs.map(d => ({ ...d.data(), _fsId: d.id }));
        if (nuevos.length > 0) {
            state.catalog = nuevos;
            renderApp();
        }
    });
    COL.sales.onSnapshot(snap => {
        if (snap.metadata.hasPendingWrites) return;
        state.sales = snap.docs.map(d => ({ ...d.data(), _fsId: d.id }));
    });
    COL.purchases.onSnapshot(snap => {
        if (snap.metadata.hasPendingWrites) return;
        state.purchases = snap.docs.map(d => ({ ...d.data(), _fsId: d.id }));
    });
    COL.closures.onSnapshot(snap => {
        if (snap.metadata.hasPendingWrites) return;
        state.closures = snap.docs.map(d => ({ ...d.data(), _fsId: d.id }));
    });
}

async function exportDatabase() {
    try {
        const data = {
            catalog: state.catalog,
            categories: state.categories,
            purchases: state.purchases,
            sales: state.sales,
            closures: state.closures,
            scannerImage: state.scannerImage,
            qrImage: state.qrImage,
            lastActiveDate: state.lastActiveDate,
            cajaChicaAmount: state.cajaChicaAmount,
            cajaChicaDate: state.cajaChicaDate
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const d = new Date();
        const dateStr = d.toISOString().split('T')[0];
        a.download = `dingo_backup_${dateStr}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showToast("Respaldo exportado correctamente. Guárdalo en la carpeta Respaldos_BD.", "download");
    } catch(e) {
        console.error("Error exportando BD:", e);
        showToast("Error al exportar respaldo", "alert-triangle");
    }
}

async function importDatabase(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.catalog || !data.categories) {
                throw new Error("Formato de archivo inválido");
            }
            
            state.catalog = data.catalog;
            state.categories = data.categories;
            state.purchases = data.purchases || [];
            state.sales = data.sales || [];
            state.closures = data.closures || [];
            if(data.scannerImage) state.scannerImage = data.scannerImage;
            if(data.qrImage) state.qrImage = data.qrImage;
            if(data.lastActiveDate) state.lastActiveDate = data.lastActiveDate;
            if(data.cajaChicaAmount !== undefined) state.cajaChicaAmount = data.cajaChicaAmount;
            if(data.cajaChicaDate) state.cajaChicaDate = data.cajaChicaDate;
            
            await saveDatabase();
            
            showToast("Base de datos importada correctamente", "check");
            updateUI();
            
            setTimeout(() => {
                window.location.reload();
            }, 1000);
            
        } catch(err) {
            console.error("Error importando:", err);
            showToast("Error: Archivo inválido", "alert-triangle");
        }
    };
    reader.readAsText(file);
}

const appContainer = document.getElementById('app-container');
const getIcon = (name, className = '') => `<i data-lucide="${name}" class="${className}"></i>`;

function renderApp() {
    checkAutomaticClosure();
    setInterval(checkAutomaticClosure, 60000); // Revisar cada minuto si cambió de día

    appContainer.innerHTML = `
        ${renderHeader()}
        <div id="views-container">
            ${renderPOS()}
            ${renderDelivery()}
            ${renderCatalog()}
            ${renderSettings()}
            ${renderCheckout()}
            ${renderAddProduct()}
            ${renderManageCategories()}
            ${renderAddPurchase()}
            ${renderPurchasesHistory()}
            ${renderClosuresHistory()}
            ${renderStatisticsView()}
        </div>
        ${renderSuccess()}
        ${renderQRModal()}
        ${renderCajaChicaModal()}
        ${renderFAB()}
        ${renderBottomNav()}
    `;
    
    lucide.createIcons();
    bindEvents();
    updateUI();
    setTab('pos');
    checkCajaChica();
}

function renderHeader() {
    return `
        <header id="main-header">
            <div class="logo">
                ${getIcon('shopping-bag')} DINGO
            </div>
            <div class="user-profile">
                ${getIcon('user')}
            </div>
        </header>
    `;
}

function renderPOS() {
    return `
        <div id="tab-pos" class="view" style="padding: 0;">
            <div style="display: flex; flex-direction: column; height: calc(100vh - 70px);">
                
                <!-- TOP HALF: SCANNER -->
                <div style="flex: 1; min-height: 0; padding: 20px; display: flex; flex-direction: column; gap: 12px;">
                    <div class="section-title" style="font-size: 20px; text-align: center; justify-content: center; margin-bottom: 0; color: var(--accent-secondary); letter-spacing: 1px;">
                        MUESTRE SU PRODUCTO
                    </div>
                    
                    <form onsubmit="handlePhysicalScan(event)" style="display:flex; gap:8px;">
                        <div class="barcode-wrapper" style="flex:1;">
                            <input type="text" id="physical-barcode-input" class="form-input" style="width:100%; padding: 12px; font-size:15px;" placeholder="Escanee o busque por nombre..." autofocus>
                            <button type="submit" class="scan-barcode-btn" style="border-radius: 12px; padding: 0 16px;">
                                ${getIcon('corner-down-left')}
                            </button>
                        </div>
                    </form>

                    <!-- Visor Simulado con Overlay -->
                    <div class="scanner-box" style="position: relative; width: 100%; flex: 1; border-radius: 20px; overflow: hidden; border: 2px solid var(--accent-secondary); height: auto;">
                        <div class="camera-feed" style="width: 100%; height: 100%; background: url('${state.scannerImage}') center/cover; position: absolute; filter: brightness(0.7);"></div>
                        <div class="scanner-overlay" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 80%; height: 80%; border: 2px solid var(--accent-secondary); border-radius: 20px;">
                            <div class="scanner-line"></div>
                        </div>
                        <div id="scanned-product-overlay" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); backdrop-filter: blur(4px); display: none; align-items: center; justify-content: center; flex-direction: column; z-index: 10;"></div>
                    </div>
                    
                    <button class="btn-primary" style="width: 100%; justify-content: center; background: rgba(230,0,0,0.05); color: var(--accent-primary); padding: 10px; border: 1px solid var(--accent-primary);" onclick="simulateScan()">
                        ${getIcon('scan')} ESCANEA TU PRODUCTO
                    </button>
                </div>

                <!-- BOTTOM HALF: LISTA DE PRODUCTOS ESCANEADOS -->
                <div style="flex: 1; min-height: 0; background: var(--bg-card); border-top-left-radius: 30px; border-top-right-radius: 30px; border-top: 1px solid var(--glass-border); padding: 20px; display: flex; flex-direction: column;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <div style="font-size: 18px; font-weight: 700;">Productos Escaneados</div>
                        <div id="pos-inline-total" style="font-size: 18px; font-weight: 800; color: var(--accent-primary);">Bs 0.00</div>
                    </div>
                    
                    <div id="pos-inline-cart" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding-right: 4px;">
                        <!-- Lista dinámica -->
                    </div>
                    
                    <button class="pay-btn" style="margin-top: 12px; padding: 16px;" onclick="showPaymentModal()">
                        Pagar Ahora ${getIcon('arrow-right')}
                    </button>
                </div>

            </div>
        </div>
    `;
}

function renderDelivery() {
    return `
        <div id="tab-delivery" class="view">
            <div class="hero-section">
                <div class="hero-card glass">
                    <div class="hero-subtitle">Hola, Yeiden</div>
                    <div class="hero-title">Tus productos frescos en 15 min.</div>
                    <button class="btn-primary" style="margin-top: 16px;">
                        ${getIcon('sparkles')} Sugerencias IA
                    </button>
                </div>
            </div>
            <div class="section-title">Populares para Delivery</div>
            <div class="catalog-grid">
                ${state.catalog.slice(0, 4).map(product => productCardHTML(product, 'delivery')).join('')}
            </div>
        </div>
    `;
}

function renderCatalog() {
    return `
        <div id="tab-catalog" class="view">
            <div class="section-title" style="margin-top: -10px;">
                <span>Inventario</span>
                <div style="display:flex; gap: 8px;">
                    <button class="admin-header-btn" onclick="toggleCatalogViewMode()" id="catalog-view-toggle-btn" style="background: rgba(0,0,0,0.05); color: var(--text-primary); padding: 6px 10px;">
                        ${getIcon('list', 'w-4 h-4')}
                    </button>
                    <button class="admin-header-btn" onclick="toggleManageCategories(true)" style="background: rgba(0,0,0,0.05); color: var(--text-primary); padding: 6px 10px;">
                        ${getIcon('folder-edit', 'w-4 h-4')}
                    </button>
                    <button class="admin-header-btn" onclick="openPurchasesHistory()" style="background: rgba(255,51,51,0.1); color: var(--accent-secondary); border: 1px solid rgba(255,51,51,0.3); padding: 6px 10px;">
                        ${getIcon('history', 'w-4 h-4')}
                    </button>
                    <button class="admin-header-btn" onclick="openAddPurchase()" style="background: rgba(230,0,0,0.1); color: var(--accent-primary); border: 1px solid rgba(230,0,0,0.3); padding: 6px 10px;">
                        ${getIcon('truck', 'w-4 h-4')} Compra
                    </button>
                    <button class="admin-header-btn" onclick="openAddProduct()" style="background: var(--text-primary); color: var(--text-inverted); padding: 6px 10px;">
                        ${getIcon('plus', 'w-4 h-4')} Nuevo
                    </button>
                </div>
            </div>
            <div style="padding: 0 20px; margin-bottom: 16px;">
                <input type="text" id="catalog-search" class="form-input" style="width: 100%; padding: 12px; border-radius: 14px;" placeholder="Buscar producto por nombre..." oninput="handleCatalogSearch(event)">
            </div>
            <div class="categories-list" id="main-categories-pills"></div>
            <div class="catalog-grid" id="catalog-grid"></div>
        </div>
    `;
}

function renderSettings() {
    return `
        <div id="tab-settings" class="view">
            <div class="section-title">Configuración</div>
            <div class="settings-menu">
                
                <div class="settings-item glass" style="flex-direction: column; align-items: flex-start; gap: 12px; cursor: default;">
                    <div style="display:flex; align-items:center; gap: 16px; width: 100%;">
                        ${getIcon('image')}
                        <div style="flex: 1; font-weight: 500;">Fondo del Escáner (POS)</div>
                    </div>
                    
                    <div style="display: flex; gap: 8px; width: 100%;">
                        <div style="position: relative; flex: 1;">
                            <button type="button" class="admin-header-btn" style="width: 100%; justify-content: center; padding: 12px; background: rgba(0,0,0,0.05); color: var(--text-primary);">
                                ${getIcon('camera', 'w-5 h-5')} Tomar Foto
                            </button>
                            <input type="file" accept="image/*" capture="environment" onchange="updateScannerImage(event)" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; z-index: 2;">
                        </div>
                        <div style="position: relative; flex: 1;">
                            <button type="button" class="admin-header-btn" style="width: 100%; justify-content: center; padding: 12px; background: rgba(0,0,0,0.05); color: var(--text-primary);">
                                ${getIcon('image', 'w-5 h-5')} Galería
                            </button>
                            <input type="file" accept="image/*" onchange="updateScannerImage(event)" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; z-index: 2;">
                        </div>
                    </div>
                    <div style="width: 100%; text-align: right; margin-top: 4px;">
                        <button class="admin-header-btn" style="background: transparent; border: none; color: var(--accent-primary); padding: 0; font-size: 13px;" onclick="resetScannerImage()">Restaurar Original</button>
                    </div>
                </div>

                <div class="settings-item glass" style="flex-direction: column; align-items: flex-start; gap: 12px; cursor: default;">
                    <div style="display:flex; align-items:center; gap: 16px; width: 100%;">
                        ${getIcon('qr-code')}
                        <div style="flex: 1; font-weight: 500;">Imagen de QR para Cobro</div>
                    </div>
                    
                    <div style="display: flex; gap: 8px; width: 100%;">
                        <div style="position: relative; flex: 1;">
                            <button type="button" class="admin-header-btn" style="width: 100%; justify-content: center; padding: 12px; background: rgba(0,0,0,0.05); color: var(--text-primary);">
                                ${getIcon('camera', 'w-5 h-5')} Tomar Foto
                            </button>
                            <input type="file" accept="image/*" capture="environment" onchange="updateQRImage(event)" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; z-index: 2;">
                        </div>
                        <div style="position: relative; flex: 1;">
                            <button type="button" class="admin-header-btn" style="width: 100%; justify-content: center; padding: 12px; background: rgba(0,0,0,0.05); color: var(--text-primary);">
                                ${getIcon('image', 'w-5 h-5')} Galería
                            </button>
                            <input type="file" accept="image/*" onchange="updateQRImage(event)" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; z-index: 2;">
                        </div>
                    </div>
                    <div style="width: 100%; text-align: right; margin-top: 4px;">
                        <button class="admin-header-btn" style="background: transparent; border: none; color: var(--accent-primary); padding: 0; font-size: 13px;" onclick="resetQRImage()">Restaurar Original</button>
                    </div>
                </div>

                <div class="settings-item glass" style="flex-direction: column; align-items: flex-start; gap: 12px; cursor: default; background: rgba(0, 100, 255, 0.05); border: 1px solid rgba(0, 100, 255, 0.2);">
                    <div style="display:flex; align-items:center; gap: 16px; width: 100%;">
                        ${getIcon('database', 'color: #0064ff;')}
                        <div style="flex: 1; font-weight: 600; color: #0064ff;">Respaldos de Base de Datos</div>
                    </div>
                    <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 8px;">Guarda tus datos en la carpeta Respaldos_BD de tu PC.</div>
                    
                    <div style="display: flex; gap: 8px; width: 100%;">
                        <button type="button" class="admin-header-btn" style="flex: 1; justify-content: center; padding: 12px; background: rgba(0, 100, 255, 0.1); color: #0064ff;" onclick="exportDatabase()">
                            ${getIcon('download', 'w-5 h-5')} Exportar BD
                        </button>
                        <div style="position: relative; flex: 1;">
                            <button type="button" class="admin-header-btn" style="width: 100%; justify-content: center; padding: 12px; background: rgba(0,0,0,0.05); color: var(--text-primary);">
                                ${getIcon('upload', 'w-5 h-5')} Importar BD
                            </button>
                            <input type="file" accept=".json" onchange="importDatabase(event)" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; z-index: 2;">
                        </div>
                    </div>
                </div>
                <div class="settings-item glass" onclick="openStatistics()" style="cursor: pointer; background: rgba(0,200,100,0.05); border: 1px solid rgba(0,200,100,0.2);">
                    ${getIcon('bar-chart-2', 'color: #00c864')}
                    <div style="flex: 1; font-weight: 600; color: #00c864;">Estadísticas (Ventas y Productos)</div>
                    ${getIcon('chevron-right', 'color: #00c864')}
                </div>
                <div class="settings-item glass" onclick="openClosuresHistory()" style="cursor: pointer;">
                    ${getIcon('calculator')}
                    <div style="flex: 1; font-weight: 500;">Historial de Cierres de Caja</div>
                    ${getIcon('chevron-right')}
                </div>
                <div class="settings-item glass" onclick="showDailySales()" style="cursor: pointer; background: rgba(255,165,0,0.05); border: 1px solid rgba(255,165,0,0.2);">
                    ${getIcon('bar-chart', 'color: #ffa500')}
                    <div style="flex: 1; font-weight: 600; color: #ffa500;">Ver Ventas del Día Parcial</div>
                    ${getIcon('chevron-right', 'color: #ffa500')}
                </div>
                <div class="settings-item glass" onclick="performManualClosure()" style="cursor: pointer; background: rgba(230,0,0,0.05); border: 1px solid rgba(230,0,0,0.2);">
                    ${getIcon('lock', 'color: var(--accent-primary)')}
                    <div style="flex: 1; font-weight: 600; color: var(--accent-primary);">Realizar Cierre de Caja Manual</div>
                    ${getIcon('chevron-right', 'color: var(--accent-primary)')}
                </div>
                <div class="settings-item glass">
                    ${getIcon('credit-card')}
                    <div style="flex: 1; font-weight: 500;">Métodos de Pago</div>
                    ${getIcon('chevron-right')}
                </div>
                <div class="settings-item glass">
                    ${getIcon('map-pin')}
                    <div style="flex: 1; font-weight: 500;">Direcciones Guardadas</div>
                    ${getIcon('chevron-right')}
                </div>
                <div class="settings-item glass">
                    ${getIcon('bell')}
                    <div style="flex: 1; font-weight: 500;">Notificaciones</div>
                    ${getIcon('chevron-right')}
                </div>
                <div class="settings-item glass" style="margin-top: 20px; border-color: var(--danger); color: var(--danger);" onclick="logout()">
                    ${getIcon('log-out')}
                    <div style="flex: 1; font-weight: 500;">Cerrar Sesión</div>
                </div>
            </div>
        </div>
    `;
}

function renderAddProduct() {
    return `
        <div id="view-add-product" class="admin-view glass-panel" style="display:none;">
            <div class="view-header">
                <button class="back-btn" onclick="toggleAddProduct(false)">
                    ${getIcon('chevron-left', 'w-6 h-6')}
                </button>
                <div class="view-title" id="add-product-title">Añadir Producto</div>
            </div>
            
            <form id="add-product-form" onsubmit="handleProductSubmit(event)">
                <div class="photo-upload-container" style="margin-bottom: 8px; border-style: solid;">
                    ${getIcon('image', 'w-8 h-8')}
                    <span id="photo-upload-text" style="font-size: 13px;">Sin foto seleccionada</span>
                    <img id="photo-preview-img" class="photo-preview">
                </div>
                <div style="display: flex; gap: 8px; margin-bottom: 20px;">
                    <div style="position: relative; flex: 1;">
                        <button type="button" class="admin-header-btn" style="width: 100%; justify-content: center; padding: 12px;">
                            ${getIcon('camera', 'w-5 h-5')} Usar Cámara
                        </button>
                        <input type="file" accept="image/*" capture="environment" onchange="previewPhoto(event)" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; z-index: 2;">
                    </div>
                    <div style="position: relative; flex: 1;">
                        <button type="button" class="admin-header-btn" style="width: 100%; justify-content: center; padding: 12px; background: rgba(0,0,0,0.05); color: var(--text-primary);">
                            ${getIcon('image', 'w-5 h-5')} Abrir Galería
                        </button>
                        <input type="file" accept="image/*" onchange="previewPhoto(event)" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; z-index: 2;">
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">Nombre del Producto</label>
                    <input type="text" id="product-name" class="form-input" placeholder="Ej. Coca Cola 2L" required>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Categoría</label>
                    <select id="product-category" class="form-input" required style="appearance: none;">
                    </select>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Precio Compra (Bs)</label>
                        <input type="number" id="product-buy-price" class="form-input" placeholder="0.00" step="0.01" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Precio Venta (Bs)</label>
                        <input type="number" id="product-sell-price" class="form-input" placeholder="0.00" step="0.01" required>
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Cantidad Inicial (Stock)</label>
                        <input type="number" id="product-stock" class="form-input" placeholder="0" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Unidad</label>
                        <input type="text" id="product-unit" class="form-input" placeholder="Ej. Bs, kg, L" value="Bs" required>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">Código de Barras</label>
                    <div class="barcode-wrapper">
                        <input type="text" id="product-barcode" class="form-input" placeholder="Ej. 100000000001">
                        <button type="button" class="scan-barcode-btn" onclick="simulateBarcodeScan()">
                            ${getIcon('scan-line')}
                        </button>
                    </div>
                </div>

                <button type="submit" class="pay-btn" style="margin-top: 24px;" id="add-product-submit-btn">
                    ${getIcon('save')} Guardar Producto
                </button>
                
                <button type="button" id="delete-product-btn" class="pay-btn" style="margin-top: 12px; background: rgba(255,23,68,0.1); color: var(--danger); border: 1px solid rgba(255,23,68,0.3); display: none;" onclick="deleteCurrentProduct()">
                    ${getIcon('trash-2')} Eliminar Producto
                </button>
            </form>
        </div>
    `;
}

function renderManageCategories() {
    return `
        <div id="view-manage-categories" class="admin-view glass-panel" style="display:none;">
            <div class="view-header">
                <button class="back-btn" onclick="toggleManageCategories(false)">
                    ${getIcon('chevron-left', 'w-6 h-6')}
                </button>
                <div class="view-title">Categorías</div>
            </div>
            
            <div id="manage-categories-list"></div>

            <div class="add-category-row">
                <input type="text" id="new-category-name" class="form-input" placeholder="Nueva categoría...">
                <button class="admin-header-btn" onclick="addNewCategory()">
                    ${getIcon('plus', 'w-5 h-5')}
                </button>
            </div>
        </div>
    `;
}

function renderAddPurchase() {
    return `
        <div id="view-add-purchase" class="admin-view glass-panel" style="display:none;">
            <div class="view-header">
                <button class="back-btn" onclick="toggleAddPurchase(false)">
                    ${getIcon('chevron-left', 'w-6 h-6')}
                </button>
                <div class="view-title">Registrar Compra</div>
            </div>
            
            <form id="add-purchase-form" onsubmit="handlePurchaseSubmit(event)">
                
                <!-- NEW SCANNER FIELD -->
                <div class="form-group" style="margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px dashed var(--glass-border);">
                    <label class="form-label" style="color: var(--accent-secondary);">Escaneo Rápido (Lector de Barras)</label>
                    <div class="barcode-wrapper">
                        <input type="text" id="purchase-barcode-input" class="form-input" placeholder="Escanee código de barras aquí..." onkeydown="handlePurchaseScan(event)">
                        <button type="button" class="scan-barcode-btn" onclick="simulatePurchaseScan()">
                            ${getIcon('scan-line')}
                        </button>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">Seleccionar Producto</label>
                    <select id="purchase-product-id" class="form-input" required style="appearance: none;" onchange="updatePurchaseCost()">
                        <option value="" disabled selected>Elige un producto manualmente...</option>
                    </select>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Cantidad Adquirida</label>
                        <input type="number" id="purchase-qty" class="form-input" placeholder="Ej. 100" min="1" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Costo Unitario (Bs)</label>
                        <input type="number" id="purchase-cost" class="form-input" placeholder="0.00" step="0.01" required>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">Fecha de Compra</label>
                    <input type="date" id="purchase-date" class="form-input" required>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Fecha de Vencimiento (Opcional)</label>
                    <input type="date" id="purchase-expiry" class="form-input">
                </div>

                <button type="submit" class="pay-btn" style="margin-top: 24px; background: var(--accent-primary); color: var(--bg-dark);">
                    ${getIcon('truck')} Guardar Ingreso
                </button>
            </form>
        </div>
    `;
}

function renderPurchasesHistory() {
    return `
        <div id="view-purchases-history" class="admin-view glass-panel" style="display:none;">
            <div class="view-header">
                <button class="back-btn" onclick="togglePurchasesHistory(false)">
                    ${getIcon('chevron-left', 'w-6 h-6')}
                </button>
                <div class="view-title">Historial de Compras</div>
            </div>
            
            <div id="purchases-history-list" style="display:flex; flex-direction:column; gap:12px;"></div>
        </div>
    `;
}

function renderClosuresHistory() {
    return `
        <div id="view-closures-history" class="admin-view glass-panel" style="display:none;">
            <div class="view-header">
                <button class="back-btn" onclick="toggleClosuresHistory(false)">
                    ${getIcon('chevron-left', 'w-6 h-6')}
                </button>
                <div class="view-title">Cierres de Caja (Historial)</div>
            </div>
            <div id="closures-history-list" style="display:flex; flex-direction:column; gap:12px; padding-bottom:30px;"></div>
        </div>
    `;
}

function renderBottomNav() {
    if (state.currentUserRole === 'cashier') {
        return `
            <div class="bottom-nav" id="bottom-nav">
                <div class="nav-item active-pos" data-tab="pos" onclick="setTab('pos')">
                    ${getIcon('scan-line')}
                    <span>POS</span>
                </div>
                <div class="nav-item" onclick="openAddPurchase()">
                    ${getIcon('truck')}
                    <span>Compras</span>
                </div>
                <div class="nav-item" onclick="showCashierClosureModal()" style="color: var(--accent-primary);">
                    ${getIcon('lock')}
                    <span>Cierre</span>
                </div>
                <div class="nav-item" onclick="logout()" style="color: var(--danger);">
                    ${getIcon('log-out')}
                    <span>Salir</span>
                </div>
            </div>
        `;
    }

    return `
        <div class="bottom-nav" id="bottom-nav">
            <div class="nav-item" data-tab="pos" onclick="setTab('pos')">
                ${getIcon('scan-line')}
                <span>POS</span>
            </div>
            <div class="nav-item" data-tab="delivery" onclick="setTab('delivery')">
                ${getIcon('bike')}
                <span>Delivery</span>
            </div>
            <div class="nav-item" data-tab="catalog" onclick="setTab('catalog')">
                ${getIcon('layout-grid')}
                <span>Productos</span>
            </div>
            <div class="nav-item" data-tab="settings" onclick="setTab('settings')">
                ${getIcon('settings')}
                <span>Ajustes</span>
            </div>
        </div>
    `;
}

function renderCheckout() {
    return `
        <div id="view-checkout" class="view checkout-view" style="position:fixed; top:0; left:0; width:100%; height:100vh; background:var(--bg-dark); z-index:2000; overflow-y:auto; display:none;">
            <div class="view-header">
                <button class="back-btn" onclick="toggleCheckout(false)">
                    ${getIcon('x', 'w-6 h-6')}
                </button>
                <div class="view-title">Tu Carrito</div>
            </div>
            <div id="checkout-items" class="cart-items"></div>
            <div class="checkout-total glass">
                <div class="total-row">
                    <span>Subtotal</span>
                    <span id="checkout-subtotal">Bs 0.00</span>
                </div>
                <div class="total-row" id="delivery-fee-row">
                    <span>Costo de envío</span>
                    <span id="checkout-fee">Bs 0.00</span>
                </div>
                <div class="total-row grand-total">
                    <span>Total</span>
                    <span id="checkout-total">Bs 0.00</span>
                </div>
                <button class="pay-btn" onclick="showPaymentModal()">
                    Pagar Ahora ${getIcon('arrow-right')}
                </button>
            </div>
        </div>
    `;
}

function renderSuccess() {
    return `
        <div id="view-success" class="success-view">
            <div class="success-icon">
                ${getIcon('check', 'w-12 h-12')}
            </div>
            <div class="success-title">¡Operación Exitosa!</div>
            <div class="success-subtitle" id="success-message">
                Tu compra se procesó correctamente.
            </div>
            <button class="pay-btn" onclick="resetApp()" style="margin-top: 40px; background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--glass-border);">
                Volver al Inicio
            </button>
        </div>
    `;
}

function renderFAB() {
    return `
        <div class="fab-container" id="fab-container" onclick="toggleCheckout(true)">
            <div class="cart-fab glass">
                <div class="cart-info">
                    <div class="cart-count" id="cart-count">0</div>
                    <span>Ver Carrito</span>
                </div>
                <span id="cart-total-btn">Bs 0.00</span>
            </div>
        </div>
    `;
}

function renderQRModal() {
    return `
        <div class="modal-overlay" id="qr-modal">
            <div class="qr-modal glass">
                <div class="modal-title">Escanea para pagar</div>
                <div class="modal-subtitle">Usa tu app bancaria (QR Simple)</div>
                <div class="qr-code-wrapper">
                    <div class="qr-code">
                        <img src="${state.qrImage}" alt="QR" id="qr-image-display">
                    </div>
                </div>
                <button class="sim-payment-btn" onclick="completePayment('QR')">
                    Pago Realizado
                </button>
                <button style="background: rgba(0,0,0,0.05); border: 1px solid var(--glass-border); color: var(--text-primary); padding: 10px 20px; border-radius: 12px; font-weight: 600; cursor: pointer; font-size: 13px; display: flex; align-items: center; gap: 8px;" onclick="completePayment('Efectivo')">
                    ${getIcon('banknote', 'w-4 h-4')} Pago en Efectivo
                </button>
                <button style="background: transparent; border: none; color: var(--text-secondary); margin-top: 5px; cursor: pointer; font-size: 13px;" onclick="hidePaymentModal()">
                    Cancelar
                </button>
            </div>
        </div>
    `;
}

function getNearestExpiration(productId) {
    const today = new Date();
    today.setHours(0,0,0,0);
    const activePurchases = state.purchases.filter(p => p.productId === productId && p.expiryDate);
    if (activePurchases.length === 0) return null;
    
    // Sort ascending
    activePurchases.sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
    return activePurchases[0].expiryDate;
}

function productCardHTML(product, context = 'catalog') {
    const expiry = getNearestExpiration(product.id);
    let expiryHTML = '';
    if (expiry) {
        const today = new Date();
        today.setHours(0,0,0,0);
        const expDate = new Date(expiry);
        const daysToExpiry = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
        
        let color = "var(--accent-secondary)";
        if (daysToExpiry < 0) color = "var(--danger)"; // Vencido
        else if (daysToExpiry <= 7) color = "#FF9800"; // Próximo a vencer
        
        const text = daysToExpiry < 0 ? "Vencido" : `Vence: ${expiry}`;
        expiryHTML = `<div style="font-size:11px;color:${color};margin-top:4px;display:flex;align-items:center;gap:4px;font-weight:600;">${getIcon('calendar-clock', 'w-3 h-3')} ${text}</div>`;
    }

    if (context === 'catalog') {
        return `
            <div class="product-card glass" onclick="openEditProduct(${product.id})">
                <div class="product-image-container">
                    ${product.tag ? `<div class="tag">${product.tag}</div>` : ''}
                    <img src="${product.image}" alt="${product.name}" class="product-image">
                </div>
                <div class="product-info">
                    <div class="product-name">${product.name}</div>
                    <div class="product-price">Bs ${product.price.toFixed(2)} <span class="product-unit" style="font-size:12px;color:var(--text-secondary);font-weight:400;">${product.unit}</span></div>
                    <div style="font-size:11px;color:var(--text-secondary);margin-top:2px;">Stock: ${product.stock}</div>
                    ${expiryHTML}
                </div>
                <button class="add-btn" style="background: rgba(0,0,0,0.05); border:none; color: var(--text-primary);">
                    ${getIcon('pencil', 'w-4 h-4')}
                </button>
            </div>
        `;
    } else {
        return `
            <div class="product-card glass" onclick="addToCart(${product.id})">
                <div class="product-image-container">
                    ${product.tag ? `<div class="tag">${product.tag}</div>` : ''}
                    <img src="${product.image}" alt="${product.name}" class="product-image">
                </div>
                <div class="product-info">
                    <div class="product-name">${product.name}</div>
                    <div class="product-price">Bs ${product.price.toFixed(2)} <span class="product-unit" style="font-size:12px;color:var(--text-secondary);font-weight:400;">${product.unit}</span></div>
                </div>
                <button class="add-btn" onclick="event.stopPropagation(); addToCart(${product.id})">
                    ${getIcon('plus', 'w-4 h-4')}
                </button>
            </div>
        `;
    }
}

function bindEvents() {
    window.addEventListener('scroll', () => {
        const header = document.getElementById('main-header');
        if(window.scrollY > 10 && header) header.classList.add('scrolled');
        else if (header) header.classList.remove('scrolled');
    });
}

function hideAllViews() {
    document.querySelectorAll('#views-container > .view, .admin-view').forEach(v => {
        v.style.display = 'none';
        v.classList.remove('active');
    });
}

window.setTab = function(tabId) {
    if (state.currentUserRole === 'cashier' && tabId !== 'pos') {
        showToast("Acceso denegado. Solo POS permitido.", "alert-triangle");
        return;
    }

    state.currentTab = tabId;
    hideAllViews();
    
    const target = document.getElementById(`tab-${tabId}`);
    if(target) {
        target.style.display = 'block';
        target.classList.add('active');
    }
    
    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.remove('active', 'active-pos');
        if (el.dataset.tab === tabId) {
            el.classList.add(tabId === 'pos' ? 'active-pos' : 'active');
        }
    });

    const cartFab = document.querySelector('.cart-fab');
    if (tabId === 'pos') {
        if(cartFab) cartFab.classList.add('store-mode');
        const header = document.getElementById('main-header');
        if(header) header.style.display = 'none';
        
        setTimeout(() => {
            const physicalInput = document.getElementById('physical-barcode-input');
            if (physicalInput) physicalInput.focus();
        }, 200);
    } else {
        if(cartFab) cartFab.classList.remove('store-mode');
        const header = document.getElementById('main-header');
        if(header) header.style.display = 'flex';
    }

    if (tabId === 'catalog') {
        updateCatalogCategoriesDOM();
    } else if (tabId === 'delivery') {
        const deliveryContainer = document.querySelector('#tab-delivery .catalog-grid');
        if(deliveryContainer) {
            deliveryContainer.innerHTML = state.catalog.slice(0, 4).map(product => productCardHTML(product, 'delivery')).join('');
            lucide.createIcons();
        }
    }
}

window.checkAutomaticClosure = function() {
    const currentDate = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local
    if (state.lastActiveDate !== currentDate) {
        // Cierre automático detectado por cambio de día
        const unclosedSales = state.sales.filter(s => !s.closed);
        if (unclosedSales.length > 0) {
            const totalRevenue = unclosedSales.reduce((acc, sale) => acc + sale.total, 0);
            const totalQR = unclosedSales.filter(s => s.method === 'QR').reduce((acc, s) => acc + s.total, 0);
            const totalCash = unclosedSales.filter(s => s.method === 'Efectivo').reduce((acc, s) => acc + s.total, 0);
            const totalTransactions = unclosedSales.length;
            
            const productsSold = {};
            unclosedSales.forEach(sale => {
                if(sale.items) {
                    sale.items.forEach(item => {
                        if(!productsSold[item.id]) {
                            productsSold[item.id] = { id: item.id, name: item.name, qty: 0, revenue: 0 };
                        }
                        productsSold[item.id].qty += item.qty;
                        productsSold[item.id].revenue += (item.qty * item.price);
                    });
                }
            });
            const soldItems = Object.values(productsSold).sort((a, b) => b.qty - a.qty);
            
            const closure = {
                id: Date.now(),
                date: state.lastActiveDate, // El día que se está cerrando
                cajaChica: state.cajaChicaAmount || 0,
                totalRevenue: totalRevenue,
                totalQR: totalQR,
                totalCash: totalCash,
                transactions: totalTransactions,
                soldItems: soldItems,
                timestamp: new Date().toISOString()
            };
            
            state.closures.push(closure);
            unclosedSales.forEach(s => s.closed = true);
        }
        state.lastActiveDate = currentDate;
        saveDatabase();
        console.log("Cierre de caja automático realizado. Día: " + state.lastActiveDate);
        
        checkCajaChica();
        
        // Notificación visual al usuario
        setTimeout(() => {
            showToast("Cierre de caja automático realizado con éxito", "check-circle");
        }, 1000);
    }
};

window.showClosureSummaryModal = function(closure) {
    const modalId = 'closure-summary-modal';
    let modal = document.getElementById(modalId);
    if (!modal) {
        modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal-overlay';
        modal.style.zIndex = '3000';
        document.body.appendChild(modal);
    }
    
    const soldItems = closure.soldItems || [];
    const itemsHtml = soldItems.length > 0 
        ? soldItems.map(item => `
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed var(--glass-border); padding: 8px 0; font-size: 14px;">
                <div style="flex: 1; text-align: left;">
                    <div style="font-weight: 600; color: var(--text-primary);">${item.name}</div>
                    <div style="color: var(--text-secondary); font-size: 12px;">${item.qty} unid. vendidas</div>
                </div>
                <div style="font-weight: 700; color: var(--accent-primary);">Bs ${item.revenue.toFixed(2)}</div>
            </div>
        `).join('')
        : '<div style="padding: 20px; color: var(--text-secondary);">No se vendieron productos en este cierre.</div>';

    const totalCaja = closure.totalRevenue + (closure.cajaChica || 0);

    modal.innerHTML = `
        <div class="qr-modal glass" style="padding: 24px; width: 90%; max-width: 450px; text-align: center; max-height: 85vh; overflow-y: auto;">
            <div style="margin-bottom: 16px; display: flex; justify-content: center;">
                <div style="background: rgba(0, 200, 100, 0.1); padding: 16px; border-radius: 50%; color: #00c864;">
                    ${getIcon('clipboard-check', 'w-10 h-10')}
                </div>
            </div>
            <div class="modal-title" style="margin-bottom: 8px;">Cierre Exitoso</div>
            <div class="modal-subtitle">Resumen de productos vendidos</div>
            
            <div style="margin-top: 20px; background: rgba(0,0,0,0.03); border-radius: 12px; padding: 16px; max-height: 40vh; overflow-y: auto;">
                ${itemsHtml}
            </div>
            
            <div style="margin-top: 16px; padding-bottom: 12px; border-bottom: 1px dashed var(--glass-border);">
                <div style="display: flex; justify-content: space-between; font-weight: 600; font-size: 14px; margin-bottom: 8px; color: var(--text-secondary);">
                    <span>Caja Chica (Inicio):</span>
                    <span>Bs ${(closure.cajaChica || 0).toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-weight: 600; font-size: 14px; color: var(--text-secondary);">
                    <span>Ventas del día:</span>
                    <span>Bs ${closure.totalRevenue.toFixed(2)}</span>
                </div>
            </div>

            <div style="margin-top: 12px; display: flex; justify-content: space-between; font-weight: 800; font-size: 18px;">
                <span>Total en Caja:</span>
                <span style="color: var(--accent-primary);">Bs ${totalCaja.toFixed(2)}</span>
            </div>
            
            <button class="pay-btn" style="width: 100%; margin-top: 24px; background: #00c864; color: white;" onclick="document.getElementById('${modalId}').classList.remove('active')">
                Aceptar
            </button>
        </div>
    `;
    
    lucide.createIcons();
    setTimeout(() => modal.classList.add('active'), 10);
};

window.performManualClosure = function(closureType = 'Manual') {
    const unclosedSales = state.sales.filter(s => !s.closed);
    if (unclosedSales.length === 0) {
        showToast("No hay ventas para cerrar en este momento", "alert-circle");
        return;
    }

    if (closureType === 'Manual') {
        if (!confirm("¿Estás seguro de que deseas realizar el cierre de caja manual ahora? Esto reiniciará el contador de ventas del día.")) {
            return;
        }
    }

    const totalRevenue = unclosedSales.reduce((acc, sale) => acc + sale.total, 0);
    const totalQR = unclosedSales.filter(s => s.method === 'QR').reduce((acc, s) => acc + s.total, 0);
    const totalCash = unclosedSales.filter(s => s.method === 'Efectivo').reduce((acc, s) => acc + s.total, 0);
    const totalTransactions = unclosedSales.length;
    const currentDate = new Date().toLocaleDateString('en-CA');

    const productsSold = {};
    unclosedSales.forEach(sale => {
        if(sale.items) {
            sale.items.forEach(item => {
                if(!productsSold[item.id]) {
                    productsSold[item.id] = { id: item.id, name: item.name, qty: 0, revenue: 0 };
                }
                productsSold[item.id].qty += item.qty;
                productsSold[item.id].revenue += (item.qty * item.price);
            });
        }
    });
    const soldItems = Object.values(productsSold).sort((a, b) => b.qty - a.qty);

    const closure = {
        id: Date.now(),
        date: currentDate + " (" + closureType + ")",
        cajaChica: state.cajaChicaAmount || 0,
        totalRevenue: totalRevenue,
        totalQR: totalQR,
        totalCash: totalCash,
        transactions: totalTransactions,
        soldItems: soldItems,
        timestamp: new Date().toISOString()
    };

    state.closures.push(closure);
    unclosedSales.forEach(s => s.closed = true);
    state.lastActiveDate = currentDate; 
    state.cajaChicaDate = ''; // Resetear para pedir nueva caja chica
    saveDatabase();

    checkCajaChica();

    showClosureSummaryModal(closure);
    
    if (state.isClosuresHistoryOpen) renderClosuresList();
};

window.showCashierClosureModal = function() {
    let modalId = 'cashier-closure-modal';
    let modal = document.getElementById(modalId);
    if (!modal) {
        modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal-overlay';
        modal.style.zIndex = '3000';
        document.body.appendChild(modal);
    }
    
    modal.innerHTML = `
        <div class="qr-modal glass" style="padding: 24px; width: 90%; max-width: 400px; text-align: center;">
            <div class="modal-title" style="margin-bottom: 16px;">Opciones de Cierre</div>
            <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px;">
                <button class="pay-btn" style="background: var(--accent-secondary);" onclick="promptClosurePassword('Turno')">
                    ${getIcon('clock')} Cierre de Turno
                </button>
                <button class="pay-btn" style="background: var(--accent-primary);" onclick="promptClosurePassword('Día')">
                    ${getIcon('calendar')} Cierre del Día
                </button>
            </div>
            <button class="pay-btn" style="background: transparent; color: var(--text-secondary); border: 1px solid var(--glass-border);" onclick="document.getElementById('${modalId}').classList.remove('active')">
                Cancelar
            </button>
        </div>
    `;
    lucide.createIcons();
    setTimeout(() => modal.classList.add('active'), 10);
};

window.promptClosurePassword = function(type) {
    let modalId = 'closure-password-modal';
    let modal = document.getElementById(modalId);
    if (!modal) {
        modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal-overlay';
        modal.style.zIndex = '3005';
        document.body.appendChild(modal);
    }
    
    modal.innerHTML = `
        <div class="qr-modal glass" style="padding: 24px; width: 90%; max-width: 400px; text-align: center;">
            <div class="modal-title" style="margin-bottom: 8px;">Confirmar Cierre de ${type}</div>
            <div class="modal-subtitle" style="margin-bottom: 24px;">Ingresa tu contraseña para autorizar</div>
            
            <input type="password" id="closure-pwd-input" class="form-input" placeholder="Contraseña" style="text-align: center; margin-bottom: 16px;">
            
            <div style="display: flex; gap: 12px;">
                <button class="pay-btn" style="flex: 1; background: transparent; color: var(--text-secondary); border: 1px solid var(--glass-border);" onclick="document.getElementById('${modalId}').classList.remove('active')">
                    Cancelar
                </button>
                <button class="pay-btn" style="flex: 1; background: var(--danger);" onclick="executeAuthorizedClosure('${type}')">
                    Autorizar
                </button>
            </div>
        </div>
    `;
    lucide.createIcons();
    setTimeout(() => {
        modal.classList.add('active');
        document.getElementById('closure-pwd-input').focus();
    }, 10);
};

window.executeAuthorizedClosure = function(type) {
    const pwd = document.getElementById('closure-pwd-input').value.trim();
    if (state.currentUserRole === 'cashier' && pwd !== '123') {
        showToast("Contraseña incorrecta", "alert-circle");
        return;
    }
    if (state.currentUserRole === 'admin' && pwd !== 'admin') {
        showToast("Contraseña incorrecta", "alert-circle");
        return;
    }
    
    // Close the modals
    document.getElementById('closure-password-modal').classList.remove('active');
    document.getElementById('cashier-closure-modal').classList.remove('active');
    
    // Perform closure
    performManualClosure(type);
};

window.showDailySales = function() {
    const unclosedSales = state.sales.filter(s => !s.closed);
    if (unclosedSales.length === 0) {
        showToast("No hay ventas registradas en este día", "info");
        return;
    }

    const totalRevenue = unclosedSales.reduce((acc, sale) => acc + sale.total, 0);

    const productsSold = {};
    unclosedSales.forEach(sale => {
        if(sale.items) {
            sale.items.forEach(item => {
                if(!productsSold[item.id]) {
                    productsSold[item.id] = { id: item.id, name: item.name, qty: 0, revenue: 0 };
                }
                productsSold[item.id].qty += item.qty;
                productsSold[item.id].revenue += (item.qty * item.price);
            });
        }
    });
    const soldItems = Object.values(productsSold).sort((a, b) => b.qty - a.qty);

    const closure = {
        cajaChica: state.cajaChicaAmount || 0,
        totalRevenue: totalRevenue,
        soldItems: soldItems
    };

    const modalId = 'daily-sales-modal';
    let modal = document.getElementById(modalId);
    if (!modal) {
        modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal-overlay';
        modal.style.zIndex = '3000';
        document.body.appendChild(modal);
    }
    
    const itemsHtml = soldItems.length > 0 
        ? soldItems.map(item => `
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed var(--glass-border); padding: 8px 0; font-size: 14px;">
                <div style="flex: 1; text-align: left;">
                    <div style="font-weight: 600; color: var(--text-primary);">${item.name}</div>
                    <div style="color: var(--text-secondary); font-size: 12px;">${item.qty} unid. vendidas</div>
                </div>
                <div style="font-weight: 700; color: var(--accent-primary);">Bs ${item.revenue.toFixed(2)}</div>
            </div>
        `).join('')
        : '<div style="padding: 20px; color: var(--text-secondary);">No se vendieron productos hoy.</div>';

    const totalCaja = closure.totalRevenue + (closure.cajaChica || 0);

    modal.innerHTML = `
        <div class="qr-modal glass" style="padding: 24px; width: 90%; max-width: 450px; text-align: center; max-height: 85vh; overflow-y: auto;">
            <div style="margin-bottom: 16px; display: flex; justify-content: center;">
                <div style="background: rgba(255, 165, 0, 0.1); padding: 16px; border-radius: 50%; color: #ffa500;">
                    ${getIcon('bar-chart-2', 'w-10 h-10')}
                </div>
            </div>
            <div class="modal-title" style="margin-bottom: 8px;">Ventas del Día</div>
            <div class="modal-subtitle">Resumen parcial sin cerrar caja</div>
            
            <div style="margin-top: 20px; background: rgba(0,0,0,0.03); border-radius: 12px; padding: 16px; max-height: 40vh; overflow-y: auto;">
                ${itemsHtml}
            </div>
            
            <div style="margin-top: 16px; padding-bottom: 12px; border-bottom: 1px dashed var(--glass-border);">
                <div style="display: flex; justify-content: space-between; font-weight: 600; font-size: 14px; margin-bottom: 8px; color: var(--text-secondary);">
                    <span>Caja Chica (Inicio):</span>
                    <span>Bs ${(closure.cajaChica || 0).toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-weight: 600; font-size: 14px; color: var(--text-secondary);">
                    <span>Ventas del día:</span>
                    <span>Bs ${closure.totalRevenue.toFixed(2)}</span>
                </div>
            </div>

            <div style="margin-top: 12px; display: flex; justify-content: space-between; font-weight: 800; font-size: 18px;">
                <span>Total en Caja Parcial:</span>
                <span style="color: var(--accent-primary);">Bs ${totalCaja.toFixed(2)}</span>
            </div>
            
            <button class="pay-btn" style="width: 100%; margin-top: 24px; background: #ffa500; color: white;" onclick="document.getElementById('${modalId}').classList.remove('active')">
                Cerrar Resumen
            </button>
        </div>
    `;
    
    lucide.createIcons();
    setTimeout(() => modal.classList.add('active'), 10);
};

window.updateScannerImage = function(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            state.scannerImage = e.target.result;
            saveDatabase();
            
            const posContainer = document.getElementById('tab-pos');
            if (posContainer) {
                const bg = posContainer.querySelector('.camera-feed');
            if (bg) bg.style.backgroundImage = `url('${state.scannerImage}')`;
            }
            showToast("Fondo del escáner actualizado", "image");
        };
        reader.readAsDataURL(file);
    }
};

window.resetScannerImage = function() {
    state.scannerImage = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=800';
    saveDatabase();
    
    const posContainer = document.getElementById('tab-pos');
    if (posContainer) {
        const bg = posContainer.querySelector('.camera-feed');
        if (bg) bg.style.backgroundImage = `url(${state.scannerImage})`;
    }
    showToast("Fondo original restaurado", "refresh-cw");
};

window.updateQRImage = function(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            state.qrImage = e.target.result;
            saveDatabase();
            
            const qrImgDisplay = document.getElementById('qr-image-display');
            if (qrImgDisplay) qrImgDisplay.src = state.qrImage;
            
            showToast("Imagen QR actualizada", "qr-code");
        };
        reader.readAsDataURL(file);
    }
};

window.resetQRImage = function() {
    state.qrImage = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=DingoPaymentDemo';
    saveDatabase();
    
    const qrImgDisplay = document.getElementById('qr-image-display');
    if (qrImgDisplay) qrImgDisplay.src = state.qrImage;
    
    showToast("QR original restaurado", "refresh-cw");
};

/* --- LECTOR DE CÓDIGO DE BARRAS REAL (POS) --- */
window.handlePhysicalScan = function(event) {
    event.preventDefault();
    const input = document.getElementById('physical-barcode-input');
    const searchTerm = input.value.trim();
    if (searchTerm) {
        let product = state.catalog.find(p => p.barcode === searchTerm);
        if (!product) {
            const lowerTerm = searchTerm.toLowerCase();
            product = state.catalog.find(p => p.name.toLowerCase().includes(lowerTerm));
        }

        if (product) {
            onScanSuccess(product.barcode, null);
        } else {
            showToast("Producto no encontrado", "alert-circle");
        }
        
        input.value = '';
        input.focus(); // Mantener el foco
    }
};

let scanTimeout = null;

function onScanSuccess(decodedText, decodedResult) {
    const product = state.catalog.find(p => p.barcode === decodedText);
    const overlay = document.getElementById('scanned-product-overlay');
    
    if (product) {
        addToCart(product.id);
            
        if (overlay) {
            overlay.innerHTML = `
                <img src="${product.image}" style="width: 100px; height: 100px; border-radius: 14px; object-fit: cover; margin-bottom: 12px; border: 2px solid var(--accent-primary); box-shadow: 0 4px 15px rgba(0,230,118,0.3);">
                <div style="font-size: 18px; font-weight: 700; color: white; text-align: center; padding: 0 10px;">${product.name}</div>
                <div style="font-size: 16px; color: var(--accent-primary); font-weight: 800; margin-top: 4px;">Bs ${product.price.toFixed(2)}</div>
                <div style="font-size: 12px; color: var(--text-secondary); margin-top: 8px; display:flex; align-items:center; gap:4px;">
                    ${getIcon('barcode', 'w-4 h-4')} ${product.barcode}
                </div>
            `;
            overlay.style.display = 'flex';
            lucide.createIcons();
        }
    } else {
        showToast("Producto no encontrado", "alert-circle");
    }
}

window.simulateScan = function() {
    const randomProduct = state.catalog[Math.floor(Math.random() * state.catalog.length)];
    onScanSuccess(randomProduct.barcode, null);
};

/* --- CATALOG DOM --- */
function updateCatalogCategoriesDOM() {
    const pillsContainer = document.getElementById('main-categories-pills');
    if (pillsContainer) {
        pillsContainer.innerHTML = state.categories.map(cat => `
            <div class="category-pill ${state.selectedCategory === cat ? 'active' : ''}" onclick="setCategory('${cat}')">
                ${cat}
            </div>
        `).join('');
    }

    const select = document.getElementById('product-category');
    if (select) {
        select.innerHTML = state.categories.slice(1).map(cat => `<option value="${cat}">${cat}</option>`).join('');
    }

    updateCatalogView();
}

window.setCategory = function(cat) {
    state.selectedCategory = cat;
    updateCatalogCategoriesDOM();
}

function productListHTML(product) {
    return `
        <div class="glass" style="display: flex; align-items: center; padding: 12px 16px; gap: 12px; cursor: pointer; border-radius: 16px; margin-bottom: 8px;" onclick="addToCart(${product.id})">
            <div style="flex: 1; min-width: 0;">
                <div style="font-size: 15px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-primary);">${product.name}</div>
                <div style="font-size: 12px; color: var(--text-secondary);">Stock: ${product.stock} ${product.unit} | ${product.category}</div>
            </div>
            <div style="font-weight: 700; color: var(--accent-primary); font-size: 16px;">Bs ${product.price.toFixed(2)}</div>
            <div style="display: flex; gap: 4px;">
                <button class="admin-header-btn" style="padding: 6px; background: rgba(0,0,0,0.05); color: var(--text-primary);" onclick="event.stopPropagation(); editProduct(${product.id})">${getIcon('edit', 'w-4 h-4')}</button>
            </div>
        </div>
    `;
}

window.toggleCatalogViewMode = function() {
    state.catalogViewMode = state.catalogViewMode === 'grid' ? 'list' : 'grid';
    const btn = document.getElementById('catalog-view-toggle-btn');
    if(btn) btn.innerHTML = getIcon(state.catalogViewMode === 'grid' ? 'list' : 'grid', 'w-4 h-4');
    updateCatalogView();
};

window.handleCatalogSearch = function(event) {
    state.catalogSearchQuery = event.target.value.toLowerCase();
    updateCatalogView();
};

function updateCatalogView() {
    const grid = document.getElementById('catalog-grid');
    if(!grid) return;
    let filtered = state.selectedCategory === 'Todo' 
        ? state.catalog 
        : state.catalog.filter(p => p.category === state.selectedCategory);
        
    if(state.catalogSearchQuery) {
        filtered = filtered.filter(p => p.name.toLowerCase().includes(state.catalogSearchQuery) || (p.barcode && p.barcode.includes(state.catalogSearchQuery)));
    }
    
    if (state.catalogViewMode === 'list') {
        grid.style.display = 'block';
        grid.innerHTML = filtered.map(p => productListHTML(p)).join('');
    } else {
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = '1fr 1fr';
        grid.style.gap = '16px';
        grid.innerHTML = filtered.map(p => productCardHTML(p, 'catalog')).join('');
    }
    lucide.createIcons();
}

/* --- CART --- */
window.addToCart = function(productId) {
    const product = state.catalog.find(p => p.id === productId);
    if (!product) return;
    const existing = state.cart.find(item => item.product.id === productId);
    if (existing) existing.quantity += 1;
    else state.cart.push({ product, quantity: 1 });
    
    updateCartUI();
    if(state.isCheckoutOpen) renderCheckoutItems();
};

window.updateQuantity = function(productId, delta) {
    const itemIndex = state.cart.findIndex(item => item.product.id === productId);
    if (itemIndex > -1) {
        state.cart[itemIndex].quantity += delta;
        if (state.cart[itemIndex].quantity <= 0) state.cart.splice(itemIndex, 1);
        updateCartUI();
        renderCheckoutItems();
    }
};

function updateCartUI() {
    const countEl = document.getElementById('cart-count');
    const totalBtnEl = document.getElementById('cart-total-btn');
    if(!countEl || !totalBtnEl) return;

    const totalItems = state.cart.reduce((acc, item) => acc + item.quantity, 0);
    const totalAmount = state.cart.reduce((acc, item) => acc + (item.product.price * item.quantity), 0);
    
    countEl.textContent = totalItems;
    totalBtnEl.textContent = `Bs ${totalAmount.toFixed(2)}`;
    
    const fab = document.getElementById('fab-container');
    if (totalItems > 0 && !state.isCheckoutOpen && !state.isAddProductOpen && !state.isManageCategoriesOpen && !state.isAddPurchaseOpen && !state.isPurchasesHistoryOpen && state.currentTab !== 'pos') {
        fab.style.display = 'flex';
    } else {
        fab.style.display = 'none';
    }

    const inlineCart = document.getElementById('pos-inline-cart');
    const inlineTotal = document.getElementById('pos-inline-total');
    if (inlineCart && inlineTotal) {
        inlineTotal.textContent = `Bs ${totalAmount.toFixed(2)}`;
        if (state.cart.length === 0) {
            inlineCart.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-secondary); font-size: 14px;">La lista está vacía</div>';
        } else {
            inlineCart.innerHTML = state.cart.map(item => `
                <div class="glass" style="display: flex; gap: 12px; padding: 10px 12px; align-items: center; border-radius: 16px;">
                    <img src="${item.product.image}" style="width: 44px; height: 44px; border-radius: 10px; object-fit: cover;">
                    <div style="flex: 1;">
                        <div style="font-weight: 600; font-size: 14px; margin-bottom: 2px;">${item.product.name}</div>
                        <div style="color: var(--accent-primary); font-weight: 700; font-size: 14px;">Bs ${item.product.price.toFixed(2)}</div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px; background: rgba(0,0,0,0.05); padding: 4px 8px; border-radius: 10px;">
                        <button style="background:transparent; border:none; color:var(--text-primary); cursor:pointer;" onclick="updateQuantity(${item.product.id}, -1)">${getIcon('minus', 'w-3 h-3')}</button>
                        <span style="font-size: 13px; font-weight: 600; width: 16px; text-align:center;">${item.quantity}</span>
                        <button style="background:transparent; border:none; color:var(--text-primary); cursor:pointer;" onclick="updateQuantity(${item.product.id}, 1)">${getIcon('plus', 'w-3 h-3')}</button>
                    </div>
                </div>
            `).join('');
            lucide.createIcons();
        }
    }
}

window.toggleCheckout = function(open) {
    state.isCheckoutOpen = open;
    const chk = document.getElementById('view-checkout');
    const nav = document.getElementById('bottom-nav');
    
    if (open) {
        chk.style.display = 'block';
        chk.classList.add('active');
        nav.style.display = 'none';
        renderCheckoutItems();
        updateCartUI();
    } else {
        chk.style.display = 'none';
        chk.classList.remove('active');
        nav.style.display = 'flex';
        updateCartUI();
    }
};

function renderCheckoutItems() {
    const container = document.getElementById('checkout-items');
    if (state.cart.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-secondary);">Tu carrito está vacío</div>';
    } else {
        container.innerHTML = state.cart.map(item => `
            <div class="cart-item glass">
                <img src="${item.product.image}">
                <div class="cart-item-info">
                    <div class="cart-item-title">${item.product.name}</div>
                    <div class="cart-item-price">Bs ${item.product.price.toFixed(2)}</div>
                    <div class="qty-control">
                        <button class="qty-btn" onclick="updateQuantity(${item.product.id}, -1)">${getIcon('minus', 'w-4 h-4')}</button>
                        <span style="font-weight:600; font-size: 14px; width: 20px; text-align:center;">${item.quantity}</span>
                        <button class="qty-btn" onclick="updateQuantity(${item.product.id}, 1)">${getIcon('plus', 'w-4 h-4')}</button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    const subtotal = state.cart.reduce((acc, item) => acc + (item.product.price * item.quantity), 0);
    const fee = state.currentTab === 'delivery' ? 5.00 : 0.00;
    
    document.getElementById('checkout-subtotal').textContent = `Bs ${subtotal.toFixed(2)}`;
    document.getElementById('checkout-fee').textContent = `Bs ${fee.toFixed(2)}`;
    document.getElementById('checkout-total').textContent = `Bs ${(subtotal + fee).toFixed(2)}`;
    
    document.getElementById('delivery-fee-row').style.display = fee > 0 ? 'flex' : 'none';
    lucide.createIcons();
}

window.showPaymentModal = function() {
    if (state.cart.length === 0) return;
    document.getElementById('qr-modal').classList.add('active');
};

window.hidePaymentModal = function() {
    document.getElementById('qr-modal').classList.remove('active');
};

window.completePayment = function(method = 'QR') {
    hidePaymentModal();
    toggleCheckout(false);
    hideAllViews();
    
    document.getElementById('fab-container').style.display = 'none';
    document.getElementById('bottom-nav').style.display = 'none';
    const header = document.getElementById('main-header');
    if(header) header.style.display = 'none';
    
    const overlay = document.getElementById('scanned-product-overlay');
    if (overlay) overlay.style.display = 'none';
    
    document.getElementById('view-success').classList.add('active');
    
    const msg = document.getElementById('success-message');
    if (state.currentTab === 'delivery') {
        msg.innerHTML = 'Tu pedido está siendo preparado y llegará en <strong style="color:var(--accent-primary)">15 minutos</strong>.';
    } else {
        msg.innerHTML = '¡Gracias por tu compra! Puedes retirarte de la tienda libremente.';
    }
    
    // REGISTRAR VENTA PARA CIERRE DE CAJA
    let saleTotal = 0;
    const saleItems = [];
    
    state.cart.forEach(item => {
        const product = state.catalog.find(p => p.id === item.product.id);
        if (product && product.stock >= item.quantity) {
            product.stock -= item.quantity;
        }
        saleTotal += (item.product.price * item.quantity);
        saleItems.push({ id: item.product.id, name: item.product.name, qty: item.quantity, price: item.product.price });
    });
    
    const newSale = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        total: saleTotal,
        method: method,
        items: saleItems,
        closed: false
    };
    state.sales.push(newSale);
    
    saveDatabase();
    
    state.cart = [];
    
    // Ocultar botón "Volver al Inicio" y automatizar el regreso
    const successBtn = document.querySelector('#view-success button');
    if (successBtn) successBtn.style.display = 'none';
    
    setTimeout(() => {
        resetApp();
    }, 1500);
};

window.resetApp = function() {
    document.getElementById('view-success').classList.remove('active');
    document.getElementById('bottom-nav').style.display = 'flex';
    const header = document.getElementById('main-header');
    if(header) header.style.display = 'flex';
    setTab('pos');
    updateUI();
};

/* --- Admin: Manage Products --- */
window.openAddProduct = function() {
    state.editingProductId = null;
    toggleAddProduct(true);
};

window.openEditProduct = function(productId) {
    state.editingProductId = productId;
    toggleAddProduct(true);
};

window.toggleAddProduct = function(open) {
    state.isAddProductOpen = open;
    const view = document.getElementById('view-add-product');
    const nav = document.getElementById('bottom-nav');
    
    if (open) {
        view.style.display = 'block';
        view.classList.add('active');
        nav.style.display = 'none';
        updateCartUI(); 

        const form = document.getElementById('add-product-form');
        const preview = document.getElementById('photo-preview-img');
        const title = document.getElementById('add-product-title');
        const submitBtn = document.getElementById('add-product-submit-btn');
        const deleteBtn = document.getElementById('delete-product-btn');

        const select = document.getElementById('product-category');
        select.innerHTML = state.categories.slice(1).map(cat => `<option value="${cat}">${cat}</option>`).join('');

        if (state.editingProductId) {
            const product = state.catalog.find(p => p.id === state.editingProductId);
            title.textContent = "Editar Producto";
            submitBtn.innerHTML = `${getIcon('save')} Actualizar Producto`;
            deleteBtn.style.display = 'flex';

            document.getElementById('product-name').value = product.name;
            document.getElementById('product-category').value = product.category;
            document.getElementById('product-buy-price').value = product.buyPrice || 0;
            document.getElementById('product-sell-price').value = product.price;
            document.getElementById('product-stock').value = product.stock || 0;
            document.getElementById('product-unit').value = product.unit;
            document.getElementById('product-barcode').value = product.barcode || '';
            
            preview.src = product.image;
            preview.style.display = 'block';
        } else {
            title.textContent = "Añadir Producto";
            submitBtn.innerHTML = `${getIcon('save')} Guardar Producto`;
            deleteBtn.style.display = 'none';

            form.reset();
            preview.style.display = 'none';
            preview.src = '';
        }
        lucide.createIcons();

    } else {
        view.style.display = 'none';
        view.classList.remove('active');
        nav.style.display = 'flex';
        updateCartUI(); 
    }
};

window.previewPhoto = function(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const preview = document.getElementById('photo-preview-img');
            preview.src = e.target.result;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
};

window.simulateBarcodeScan = function() {
    const input = document.getElementById('product-barcode');
    input.value = Math.floor(100000000000 + Math.random() * 900000000000).toString();
    const btn = document.querySelector('.scan-barcode-btn');
    btn.style.background = 'var(--accent-secondary)';
    btn.style.color = '#000';
    setTimeout(() => { btn.style.background = ''; btn.style.color = ''; }, 300);
};

window.handleProductSubmit = function(event) {
    event.preventDefault();
    const name = document.getElementById('product-name').value;
    const category = document.getElementById('product-category').value;
    const buyPrice = parseFloat(document.getElementById('product-buy-price').value);
    const sellPrice = parseFloat(document.getElementById('product-sell-price').value);
    const stock = parseInt(document.getElementById('product-stock').value);
    const unit = document.getElementById('product-unit').value;
    const barcode = document.getElementById('product-barcode').value;
    
    let photoUrl = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=400';
    const preview = document.getElementById('photo-preview-img');
    if (preview.src && preview.src.startsWith('data:image')) photoUrl = preview.src;
    else if (preview.src && preview.src.startsWith('http')) photoUrl = preview.src; 

    if (state.editingProductId) {
        const index = state.catalog.findIndex(p => p.id === state.editingProductId);
        if (index > -1) {
            state.catalog[index] = {
                ...state.catalog[index],
                name: name, price: sellPrice, buyPrice: buyPrice,
                stock: stock, unit: unit, barcode: barcode, category: category, image: photoUrl
            };
        }
    } else {
        const newProduct = {
            id: Date.now(), name: name, price: sellPrice, buyPrice: buyPrice,
            stock: stock, unit: unit, barcode: barcode, category: category, image: photoUrl, tag: 'Nuevo'
        };
        state.catalog.unshift(newProduct);
    }

    toggleAddProduct(false);
    updateCatalogCategoriesDOM(); 
    saveDatabase();
    
    const message = state.editingProductId ? "Producto actualizado con éxito" : "Producto creado con éxito";
    showToast(message, "check-circle");
    
    state.editingProductId = null;
};

window.deleteCurrentProduct = function() {
    if (state.editingProductId) {
        if (confirm("¿Seguro que deseas eliminar este producto?")) {
            const index = state.catalog.findIndex(p => p.id === state.editingProductId);
            if (index > -1) {
                state.catalog.splice(index, 1);
                state.cart = state.cart.filter(item => item.product.id !== state.editingProductId);
            }
            toggleAddProduct(false);
            updateCatalogCategoriesDOM();
            saveDatabase();
        }
    }
};

/* --- Admin: Manage Categories --- */
window.toggleManageCategories = function(open) {
    state.isManageCategoriesOpen = open;
    const view = document.getElementById('view-manage-categories');
    const nav = document.getElementById('bottom-nav');
    
    if (open) {
        view.style.display = 'block';
        view.classList.add('active');
        nav.style.display = 'none';
        updateCartUI();
        state.editingCategoryIndex = -1;
        renderManageCategoriesList();
    } else {
        view.style.display = 'none';
        view.classList.remove('active');
        nav.style.display = 'flex';
        updateCartUI(); 
    }
};

function renderManageCategoriesList() {
    const list = document.getElementById('manage-categories-list');
    if(!list) return;

    const itemsHTML = state.categories.map((cat, index) => {
        if(index === 0) return ''; 
        const isEditing = state.editingCategoryIndex === index;
        if (isEditing) {
            return `
                <div class="category-edit-item">
                    <input type="text" id="edit-cat-input-${index}" class="category-edit-input" style="display:block;" value="${cat}">
                    <div class="category-edit-actions">
                        <button class="icon-btn success" onclick="saveEditCategory(${index}, '${cat}')">${getIcon('check', 'w-5 h-5')}</button>
                        <button class="icon-btn" onclick="cancelEditCategory()">${getIcon('x', 'w-5 h-5')}</button>
                    </div>
                </div>
            `;
        } else {
            return `
                <div class="category-edit-item">
                    <div class="category-edit-name">${cat}</div>
                    <div class="category-edit-actions">
                        <button class="icon-btn" onclick="startEditCategory(${index})">${getIcon('pencil', 'w-4 h-4')}</button>
                        <button class="icon-btn danger" onclick="deleteCategory(${index}, '${cat}')">${getIcon('trash-2', 'w-4 h-4')}</button>
                    </div>
                </div>
            `;
        }
    }).join('');

    list.innerHTML = itemsHTML;
    lucide.createIcons();
}

window.addNewCategory = function() {
    const input = document.getElementById('new-category-name');
    const val = input.value.trim();
    if (val && !state.categories.includes(val)) {
        state.categories.push(val);
        input.value = '';
        renderManageCategoriesList();
        updateCatalogCategoriesDOM();
        saveDatabase();
    }
};

window.startEditCategory = function(index) {
    state.editingCategoryIndex = index;
    renderManageCategoriesList();
};

window.cancelEditCategory = function() {
    state.editingCategoryIndex = -1;
    renderManageCategoriesList();
};

window.saveEditCategory = function(index, oldName) {
    const input = document.getElementById(`edit-cat-input-${index}`);
    const newName = input.value.trim();
    if (newName && newName !== oldName && !state.categories.includes(newName)) {
        state.categories[index] = newName;
        state.catalog.forEach(p => { if (p.category === oldName) p.category = newName; });
        if (state.selectedCategory === oldName) state.selectedCategory = newName;
    }
    state.editingCategoryIndex = -1;
    renderManageCategoriesList();
    updateCatalogCategoriesDOM();
    saveDatabase();
};

window.deleteCategory = function(index, catName) {
    if (confirm(`¿Estás seguro de eliminar la categoría "${catName}"? Los productos pasarán a "Otros".`)) {
        state.categories.splice(index, 1);
        if (!state.categories.includes('Otros')) state.categories.push('Otros');
        state.catalog.forEach(p => { if (p.category === catName) p.category = 'Otros'; });
        if (state.selectedCategory === catName) state.selectedCategory = 'Todo';
        renderManageCategoriesList();
        updateCatalogCategoriesDOM();
        saveDatabase();
    }
};

/* --- Admin: Purchases (Ingresos) --- */

window.openAddPurchase = function() {
    toggleAddPurchase(true);
};

window.toggleAddPurchase = function(open) {
    state.isAddPurchaseOpen = open;
    const view = document.getElementById('view-add-purchase');
    const nav = document.getElementById('bottom-nav');
    
    if (open) {
        view.style.display = 'block';
        view.classList.add('active');
        nav.style.display = 'none';
        
        // Llenar select de productos
        const select = document.getElementById('purchase-product-id');
        select.innerHTML = '<option value="" disabled selected>Elige un producto manualmente...</option>' + 
                           state.catalog.map(p => `<option value="${p.id}">${p.name} (Stock actual: ${p.stock})</option>`).join('');
        
        // Fecha por defecto hoy
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('purchase-date').value = today;
        
        document.getElementById('add-purchase-form').reset();
        document.getElementById('purchase-date').value = today; // restore after reset

        setTimeout(() => {
            const scanInput = document.getElementById('purchase-barcode-input');
            if(scanInput) scanInput.focus();
        }, 200);

        lucide.createIcons();
    } else {
        view.style.display = 'none';
        view.classList.remove('active');
        nav.style.display = 'flex';
    }
    updateCartUI(); 
};

window.updatePurchaseCost = function() {
    const select = document.getElementById('purchase-product-id');
    const productId = parseInt(select.value);
    if(productId) {
        const product = state.catalog.find(p => p.id === productId);
        if(product && product.buyPrice) {
            document.getElementById('purchase-cost').value = product.buyPrice;
        }
    }
};

window.handlePurchaseScan = function(event) {
    if (event.key === 'Enter') {
        event.preventDefault(); // Evitar que el form se envíe
        const input = document.getElementById('purchase-barcode-input');
        const searchTerm = input.value.trim();
        if (!searchTerm) return;

        let product = state.catalog.find(p => p.barcode === searchTerm);
        if (!product) {
            const lowerTerm = searchTerm.toLowerCase();
            product = state.catalog.find(p => p.name.toLowerCase().includes(lowerTerm));
        }

        if (product) {
            const select = document.getElementById('purchase-product-id');
            select.value = product.id;
            updatePurchaseCost();
            
            // Feedback visual
            input.style.borderColor = "var(--accent-primary)";
            setTimeout(() => input.style.borderColor = "var(--glass-border)", 500);
            
            // Pasar foco a cantidad
            document.getElementById('purchase-qty').focus();
        } else {
            showToast("Producto no encontrado", "alert-circle");
        }
        input.value = '';
    }
};

window.simulatePurchaseScan = function() {
    if(state.catalog.length === 0) return;
    const randomProduct = state.catalog[Math.floor(Math.random() * state.catalog.length)];
    const input = document.getElementById('purchase-barcode-input');
    input.value = randomProduct.barcode;
    handlePurchaseScan({ key: 'Enter', preventDefault: () => {} });
};

window.handlePurchaseSubmit = function(event) {
    event.preventDefault();
    const productId = parseInt(document.getElementById('purchase-product-id').value);
    const qty = parseInt(document.getElementById('purchase-qty').value);
    const cost = parseFloat(document.getElementById('purchase-cost').value);
    const pDate = document.getElementById('purchase-date').value;
    const expiry = document.getElementById('purchase-expiry').value;

    if(!productId || isNaN(qty) || isNaN(cost)) return;

    // Buscar producto y actualizar
    const product = state.catalog.find(p => p.id === productId);
    if(product) {
        product.stock += qty;
        product.buyPrice = cost; // Update default buy price
    }

    // Registrar en historial
    const newPurchase = {
        id: Date.now(),
        productId: productId,
        productName: product ? product.name : 'Desconocido',
        quantity: qty,
        unitCost: cost,
        totalCost: qty * cost,
        date: pDate,
        expiryDate: expiry || null
    };
    
    state.purchases.unshift(newPurchase);

    saveDatabase();
    toggleAddPurchase(false);
    updateCatalogCategoriesDOM();
    showToast(`Compra registrada: ${product.name}`, "truck");
};

window.openPurchasesHistory = function() {
    togglePurchasesHistory(true);
};

window.togglePurchasesHistory = function(open) {
    state.isPurchasesHistoryOpen = open;
    const view = document.getElementById('view-purchases-history');
    const nav = document.getElementById('bottom-nav');
    
    if (open) {
        view.style.display = 'block';
        view.classList.add('active');
        nav.style.display = 'none';
        renderPurchasesHistoryList();
    } else {
        view.style.display = 'none';
        view.classList.remove('active');
        nav.style.display = 'flex';
    }
    updateCartUI(); 
};

function renderPurchasesHistoryList() {
    const list = document.getElementById('purchases-history-list');
    if (state.purchases.length === 0) {
        list.innerHTML = `<div style="text-align:center; padding: 40px; color: var(--text-secondary);">No hay compras registradas</div>`;
        return;
    }

    list.innerHTML = state.purchases.map(p => {
        const expiryBadge = p.expiryDate 
            ? `<div style="font-size:12px; color:var(--text-secondary); margin-top:4px;">${getIcon('calendar-clock', 'w-3 h-3')} Vence: ${p.expiryDate}</div>`
            : '';
            
        return `
            <div class="glass" style="padding: 16px; border-radius: 16px;">
                <div style="display:flex; justify-content:space-between; margin-bottom: 8px;">
                    <strong style="font-size:15px;">${p.productName}</strong>
                    <span style="color:var(--text-secondary); font-size:12px;">${p.date}</span>
                </div>
                <div style="display:flex; justify-content:space-between; font-size: 14px; color: var(--text-secondary);">
                    <span>Cant: <strong style="color:var(--text-primary)">${p.quantity}</strong></span>
                    <span>Costo Unit: Bs ${p.unitCost.toFixed(2)}</span>
                    <span style="color:var(--accent-primary); font-weight:700;">Total: Bs ${p.totalCost.toFixed(2)}</span>
                </div>
                ${expiryBadge}
            </div>
        `;
    }).join('');
    
    lucide.createIcons();
}

/* --- Admin: Closures History --- */
window.toggleClosuresHistory = function(open) {
    state.isClosuresHistoryOpen = open;
    const view = document.getElementById('view-closures-history');
    const nav = document.getElementById('bottom-nav');
    if(open) {
        if(window.innerWidth < 768) nav.style.display = 'none';
        view.style.display = 'block';
        view.classList.add('active');
        renderClosuresList();
    } else {
        view.style.display = 'none';
        view.classList.remove('active');
        if(window.innerWidth < 768) nav.style.display = 'flex';
    }
};

window.openClosuresHistory = function() {
    toggleClosuresHistory(true);
};

window.toggleSoldItems = function(index) {
    const el = document.getElementById(`sold-items-${index}`);
    const icon = document.getElementById(`sold-items-icon-${index}`);
    if (el) {
        if (el.style.display === 'none') {
            el.style.display = 'block';
            if (icon) icon.innerHTML = getIcon('chevron-up', 'w-4 h-4');
        } else {
            el.style.display = 'none';
            if (icon) icon.innerHTML = getIcon('chevron-down', 'w-4 h-4');
        }
        lucide.createIcons();
    }
};

window.renderClosuresList = function() {
    const list = document.getElementById('closures-history-list');
    if (!list) return;

    if (state.closures.length === 0) {
        list.innerHTML = '<div style="text-align:center; padding: 40px 20px; color:var(--text-secondary);">No hay cierres registrados aún.<br><br>El cierre se realiza automáticamente al pasar la medianoche o al iniciar la app en un nuevo día.</div>';
        return;
    }

    const reversed = [...state.closures].reverse();
    
    list.innerHTML = reversed.map((c, index) => {
        let soldItemsHtml = '';
        if (c.soldItems && c.soldItems.length > 0) {
            const itemsList = c.soldItems.map(item => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0; border-bottom: 1px dashed rgba(0,0,0,0.05);">
                    <div style="flex: 1; text-align: left;">
                        <div style="font-weight: 600; font-size: 13px; color: var(--text-primary);">${item.name}</div>
                        <div style="font-size: 11px; color: var(--text-secondary);">${item.qty} unid.</div>
                    </div>
                    <div style="font-weight: 600; font-size: 13px; color: var(--text-primary);">Bs ${item.revenue.toFixed(2)}</div>
                </div>
            `).join('');
            
            soldItemsHtml = `
                <div style="margin-top: 12px; padding-top: 12px; border-top: 1px dashed var(--glass-border);">
                    <button onclick="toggleSoldItems(${index})" style="width: 100%; text-align: left; background: transparent; border: none; padding: 4px 0; color: var(--text-secondary); font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: space-between;">
                        <span>Ver productos vendidos (${c.soldItems.length})</span>
                        <span id="sold-items-icon-${index}">${getIcon('chevron-down', 'w-4 h-4')}</span>
                    </button>
                    <div id="sold-items-${index}" style="display: none; background: rgba(0,0,0,0.02); border-radius: 8px; padding: 8px; max-height: 200px; overflow-y: auto; margin-top: 8px;">
                        ${itemsList}
                    </div>
                </div>
            `;
        } else {
            soldItemsHtml = `
                <div style="margin-top: 12px; padding-top: 12px; border-top: 1px dashed var(--glass-border); color: var(--text-secondary); font-size: 12px; text-align: center;">
                    No hay detalle de productos para este cierre.
                </div>
            `;
        }

        return `
            <div class="glass" style="padding: 16px; border-radius: 16px; border: 1px solid var(--glass-border);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px;">
                    <span style="font-weight:700; font-size:16px;">Fecha: ${c.date}</span>
                    <span style="color:var(--text-secondary); font-size:12px;">Grabado a las: ${new Date(c.timestamp).toLocaleTimeString()}</span>
                </div>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; font-size: 13px;">
                    <div style="background: rgba(0,0,0,0.03); padding: 8px; border-radius: 8px;">
                        <div style="color: var(--text-secondary); font-size: 11px;">Pagos QR</div>
                        <div style="font-weight: 700;">Bs ${(c.totalQR || 0).toFixed(2)}</div>
                    </div>
                    <div style="background: rgba(0,0,0,0.03); padding: 8px; border-radius: 8px;">
                        <div style="color: var(--text-secondary); font-size: 11px;">Efectivo</div>
                        <div style="font-weight: 700;">Bs ${(c.totalCash || 0).toFixed(2)}</div>
                    </div>
                </div>
                <div style="display:flex; justify-content:space-between; align-items: center; border-top: 1px dashed var(--glass-border); padding-top: 8px; margin-top: 8px;">
                    <span style="font-size: 13px; color: var(--text-secondary);">Caja Chica: <strong>Bs ${(c.cajaChica || 0).toFixed(2)}</strong></span>
                    <span style="font-size: 13px; color: var(--text-secondary);">Ventas: <strong>${c.transactions}</strong></span>
                </div>
                <div style="display:flex; justify-content:space-between; align-items: center; margin-top: 4px;">
                    <span style="color:var(--accent-primary); font-weight:800; font-size:18px;">Total Caja: Bs ${(c.totalRevenue + (c.cajaChica || 0)).toFixed(2)}</span>
                </div>
                ${soldItemsHtml}
            </div>
        `;
    }).join('');
    
    lucide.createIcons();
};

window.showToast = function(message, icon = 'info') {
    // Eliminar toast anterior si existe
    const oldToast = document.querySelector('.toast');
    if (oldToast) oldToast.remove();

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `${getIcon(icon)} <span>${message}</span>`;
    document.body.appendChild(toast);
    
    lucide.createIcons();
    
    setTimeout(() => toast.classList.add('active'), 10);
    
    setTimeout(() => {
        toast.classList.remove('active');
        setTimeout(() => toast.remove(), 400);
    }, 4000);
};

function updateUI() {
    updateCartUI();
    updateCatalogCategoriesDOM();
}

loadDatabase().then(() => {
    renderLogin();
});

window.renderLogin = function() {
    appContainer.innerHTML = `
        <div style="height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background: var(--bg-dark); padding: 20px;">
            <div class="glass" style="width: 100%; max-width: 400px; padding: 40px 24px; text-align: center; border-radius: 24px;">
                <div style="margin-bottom: 24px;">
                    <div style="background: rgba(230,0,0,0.1); width: 80px; height: 80px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto; color: var(--accent-primary);">
                        ${getIcon('lock', 'w-10 h-10')}
                    </div>
                </div>
                <div class="modal-title" style="margin-bottom: 8px;">Bienvenido a Dingo</div>
                <div class="modal-subtitle" style="margin-bottom: 32px;">Ingresa tu código de acceso para continuar</div>
                
                <form onsubmit="handleLogin(event)" style="display: flex; flex-direction: column; gap: 16px;">
                    <input type="password" id="login-password" class="form-input" placeholder="Contraseña o PIN" required style="text-align: center; font-size: 20px; letter-spacing: 4px; padding: 16px;">
                    <button type="submit" class="pay-btn" style="padding: 16px;">Ingresar al Sistema</button>
                </form>
            </div>
        </div>
    `;
    lucide.createIcons();
    setTimeout(() => {
        const input = document.getElementById('login-password');
        if(input) input.focus();
    }, 100);
};

window.handleLogin = function(event) {
    event.preventDefault();
    const input = document.getElementById('login-password');
    const pwd = input.value.trim();
    
    if (pwd === 'admin') {
        state.currentUserRole = 'admin';
        renderApp();
    } else if (pwd === '123') {
        state.currentUserRole = 'cashier';
        renderApp();
    } else {
        showToast("Contraseña incorrecta", "alert-circle");
        input.value = '';
        input.focus();
    }
};

window.logout = function() {
    state.currentUserRole = null;
    hideAllViews();
    renderLogin();
};

// --- Caja Chica ---

function renderCajaChicaModal() {
    return `
        <div class="modal-overlay" id="caja-chica-modal" style="z-index: 3000;">
            <div class="qr-modal glass" style="padding: 24px; width: 90%; max-width: 400px; text-align: center;">
                <div style="margin-bottom: 16px; display: flex; justify-content: center;">
                    <div style="background: rgba(0, 100, 255, 0.1); padding: 16px; border-radius: 50%; color: #0064ff;">
                        ${getIcon('wallet', 'w-10 h-10')}
                    </div>
                </div>
                <div class="modal-title" style="margin-bottom: 8px;">Caja Chica del Día</div>
                <div class="modal-subtitle">Ingresa el efectivo con el que inicias hoy.</div>
                
                <div class="form-group" style="margin-top: 24px; margin-bottom: 24px;">
                    <input type="number" id="caja-chica-input" class="form-input" placeholder="0.00" step="0.01" min="0" style="font-size: 24px; text-align: center; padding: 16px; font-weight: 600;">
                </div>
                
                <button class="pay-btn" style="width: 100%; background: #0064ff; color: white;" onclick="saveCajaChica()">
                    Guardar y Empezar
                </button>
            </div>
        </div>
    `;
}

window.showCajaChicaModal = function() {
    const modal = document.getElementById('caja-chica-modal');
    if(modal) {
        modal.classList.add('active');
        setTimeout(() => {
            const input = document.getElementById('caja-chica-input');
            if(input) {
                input.value = '';
                input.focus();
            }
        }, 100);
    }
}

window.saveCajaChica = function() {
    const input = document.getElementById('caja-chica-input');
    const amount = parseFloat(input.value);
    
    if(isNaN(amount) || amount < 0) {
        showToast("Ingresa un monto válido", "alert-circle");
        return;
    }
    
    state.cajaChicaAmount = amount;
    state.cajaChicaDate = new Date().toLocaleDateString('en-CA');
    saveDatabase();
    
    const modal = document.getElementById('caja-chica-modal');
    if(modal) modal.classList.remove('active');
    
    showToast("Caja chica registrada con éxito", "check-circle");
}

function checkCajaChica() {
    const today = new Date().toLocaleDateString('en-CA');
    if(state.cajaChicaDate !== today) {
        showCajaChicaModal();
    }
}

/* --- Admin: Statistics View --- */
window.toggleStatistics = function(open) {
    const view = document.getElementById('view-statistics');
    const nav = document.getElementById('bottom-nav');
    if(open) {
        if(window.innerWidth < 768) nav.style.display = 'none';
        view.style.display = 'block';
        view.classList.add('active');
        renderStatisticsContent('today');
    } else {
        view.style.display = 'none';
        view.classList.remove('active');
        if(window.innerWidth < 768) nav.style.display = 'flex';
    }
};

window.openStatistics = function() {
    toggleStatistics(true);
};

function renderStatisticsView() {
    return `
        <div id="view-statistics" class="manage-categories-view" style="z-index: 2600;">
            <div class="view-header" style="position: sticky; top: 0; background: var(--bg-dark); padding: 16px 0; z-index: 10;">
                <button class="back-btn" onclick="toggleStatistics(false)">
                    ${getIcon('arrow-left')}
                </button>
                <div class="view-title">Estadísticas</div>
                <div style="width: 24px;"></div>
            </div>
            
            <div style="display: flex; gap: 8px; margin-bottom: 20px; background: rgba(0,0,0,0.05); padding: 4px; border-radius: 12px;">
                <button id="stat-btn-today" class="admin-header-btn" style="flex: 1; background: var(--bg-card); color: var(--text-primary);" onclick="renderStatisticsContent('today')">Hoy</button>
                <button id="stat-btn-month" class="admin-header-btn" style="flex: 1; background: transparent; color: var(--text-secondary);" onclick="renderStatisticsContent('month')">Mes</button>
                <button id="stat-btn-year" class="admin-header-btn" style="flex: 1; background: transparent; color: var(--text-secondary);" onclick="renderStatisticsContent('year')">Año</button>
            </div>
            
            <div id="statistics-content">
                <!-- Content injected here -->
            </div>
        </div>
    `;
}

window.renderStatisticsContent = function(period) {
    // Update tabs UI
    ['today', 'month', 'year'].forEach(p => {
        const btn = document.getElementById(`stat-btn-${p}`);
        if(btn) {
            if(p === period) {
                btn.style.background = 'var(--bg-card)';
                btn.style.color = 'var(--text-primary)';
                btn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
            } else {
                btn.style.background = 'transparent';
                btn.style.color = 'var(--text-secondary)';
                btn.style.boxShadow = 'none';
            }
        }
    });
    
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const todayStr = now.toLocaleDateString('en-CA');
    
    // Filter sales
    const filteredSales = state.sales.filter(s => {
        const d = new Date(s.timestamp);
        if (period === 'today') return s.timestamp.startsWith(todayStr); // using ISO string
        if (period === 'month') return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
        if (period === 'year') return d.getFullYear() === currentYear;
        return false;
    });
    
    const totalRevenue = filteredSales.reduce((sum, s) => sum + s.total, 0);
    const totalSales = filteredSales.length;
    
    // Filter purchases
    const filteredPurchases = state.purchases.filter(p => {
        const d = new Date(p.timestamp || p.date);
        if (period === 'today') {
            if (p.timestamp) return p.timestamp.startsWith(todayStr);
            return p.date === todayStr;
        }
        if (period === 'month') return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
        if (period === 'year') return d.getFullYear() === currentYear;
        return false;
    });
    
    const totalPurchasesCost = filteredPurchases.reduce((sum, p) => sum + (p.totalCost || 0), 0);
    const ganancia = totalRevenue - totalPurchasesCost;
    
    // Calculate Top Products
    const productCounts = {};
    filteredSales.forEach(sale => {
        if(sale.items) {
            sale.items.forEach(item => {
                if(!productCounts[item.id]) {
                    productCounts[item.id] = { name: item.name, qty: 0, revenue: 0 };
                }
                productCounts[item.id].qty += item.qty;
                productCounts[item.id].revenue += (item.qty * item.price);
            });
        }
    });
    
    const topProducts = Object.values(productCounts).sort((a, b) => b.qty - a.qty).slice(0, 10);
    
    let html = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
            <div class="glass" style="padding: 16px; text-align: center;">
                <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 4px;">Ingresos (Ventas)</div>
                <div style="font-size: 20px; font-weight: 800; color: var(--accent-primary);">Bs ${totalRevenue.toFixed(2)}</div>
            </div>
            <div class="glass" style="padding: 16px; text-align: center;">
                <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 4px;">Egresos (Compras)</div>
                <div style="font-size: 20px; font-weight: 800; color: #ff9800;">Bs ${totalPurchasesCost.toFixed(2)}</div>
            </div>
        </div>
        
        <div class="glass" style="padding: 16px; text-align: center; margin-bottom: 24px; background: ${ganancia >= 0 ? 'rgba(0, 200, 100, 0.05)' : 'rgba(255, 59, 48, 0.05)'}; border: 1px solid ${ganancia >= 0 ? 'rgba(0, 200, 100, 0.2)' : 'rgba(255, 59, 48, 0.2)'};">
            <div style="font-size: 14px; font-weight: 600; color: ${ganancia >= 0 ? '#00c864' : 'var(--danger)'}; margin-bottom: 4px;">Ganancia Neta del Periodo</div>
            <div style="font-size: 28px; font-weight: 900; color: ${ganancia >= 0 ? '#00c864' : 'var(--danger)'};">Bs ${ganancia.toFixed(2)}</div>
            <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">(${totalSales} transacciones de venta)</div>
        </div>
        
        <div class="section-title" style="padding: 0; margin-bottom: 12px; font-size: 16px;">Top Productos Más Vendidos</div>
    `;
    
    if (topProducts.length === 0) {
        html += `<div style="text-align: center; color: var(--text-secondary); padding: 40px 20px;">No hay ventas registradas en este periodo.</div>`;
    } else {
        html += topProducts.map((p, index) => `
            <div class="glass" style="display: flex; align-items: center; padding: 12px 16px; margin-bottom: 8px; gap: 12px;">
                <div style="font-size: 18px; font-weight: 800; color: var(--accent-secondary); width: 24px; text-align: center;">${index + 1}</div>
                <div style="flex: 1; min-width: 0;">
                    <div style="font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.name}</div>
                    <div style="font-size: 12px; color: var(--text-secondary);">${p.qty} unidades vendidas</div>
                </div>
                <div style="font-weight: 700; color: var(--accent-primary);">Bs ${p.revenue.toFixed(2)}</div>
            </div>
        `).join('');
    }
    
    const container = document.getElementById('statistics-content');
    if(container) {
        container.innerHTML = html;
        lucide.createIcons();
    }
};
