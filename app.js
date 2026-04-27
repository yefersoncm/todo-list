import { TaskStore, LocalStorageAdapter, SORT_MODES } from './taskStore.js';
import { Combobox } from './combobox.js';
import { createIcon } from './icons.js';
import { elapsedComponents, formatElapsed } from './elapsed.js';
import { paginate, ELLIPSIS } from './pagination.js';
import { ToastManager } from './toast.js';

const PAGE_SIZE_KEY = 'todo-list:pageSize';
const VALID_PAGE_SIZES = [10, 20, 50, 100];
const DEFAULT_PAGE_SIZE = 10;
// Umbral fijo para mostrar el buscador (coincide con pageSize mínimo).
const SEARCH_VISIBILITY_THRESHOLD = VALID_PAGE_SIZES[0];

const SORT_BY_KEY = 'todo-list:sortBy';
const DEFAULT_SORT = 'created-desc';

const COLLAPSED_KEY = 'todo-list:collapsedParents';
const THEME_KEY = 'todo-list:theme';
const DENSITY_KEY = 'todo-list:density';

function loadTheme() {
    const v = localStorage.getItem(THEME_KEY);
    if (v === 'light' || v === 'dark') return v;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function applyTheme(theme) {
    if (theme === 'dark') document.documentElement.dataset.theme = 'dark';
    else document.documentElement.removeAttribute('data-theme');
    localStorage.setItem(THEME_KEY, theme);
}
function loadDensity() {
    return localStorage.getItem(DENSITY_KEY) === 'compact' ? 'compact' : 'comfy';
}
function applyDensity(density) {
    if (density === 'compact') document.documentElement.dataset.density = 'compact';
    else document.documentElement.removeAttribute('data-density');
    localStorage.setItem(DENSITY_KEY, density);
}

// ****** SELECTORES DE ELEMENTOS **********
const DOM = {
    form: document.querySelector('.grocery-form'),
    groceryInput: document.getElementById('grocery'),
    submitBtn: document.querySelector('.submit-btn'),
    submitIcon: document.querySelector('.submit-icon'),
    submitLabel: document.querySelector('.submit-label'),
    container: document.querySelector('.grocery-container'),
    list: document.querySelector('.grocery-list'),
    clearBtn: document.querySelector('.clear-btn'),
    taskFilterRoot: document.getElementById('taskFilter'),
    sortByRoot: document.getElementById('sortBy'),
    pageSizeRoot: document.getElementById('pageSize'),
    bulkCollapseRoot: document.getElementById('bulkCollapse'),
    bulkCollapseAllBtn: document.querySelector('.bulk-collapse-all'),
    bulkExpandAllBtn: document.querySelector('.bulk-expand-all'),
    promoteZone: document.getElementById('promoteZone'),
    searchInput: document.getElementById('searchInput'),
    searchRow: document.getElementById('searchRow'),
    paginationNav: document.querySelector('.pagination'),
    taskCountDisplay: document.querySelector('.task-count'),
    toastContainer: document.getElementById('toastContainer'),
    confirmModal: document.getElementById('confirmModal'),
    confirmModalText: document.getElementById('confirmModalText'),
    themeSeg: document.getElementById('themeSeg'),
    densitySeg: document.getElementById('densitySeg'),
    appTitleSub: document.getElementById('appTitleSub'),
    appTitleMain: document.getElementById('appTitleMain'),
    appHamburger: document.getElementById('appHamburger'),
    appDrawerBackdrop: document.getElementById('appDrawerBackdrop'),
    taskCountRow: document.querySelector('.task-count-row'),
    appFab: document.getElementById('appFab'),
    newTaskModal: document.getElementById('newTaskModal'),
    newTaskForm: document.getElementById('newTaskForm'),
    newTaskInput: document.getElementById('newTaskInput'),
    newTaskDate: document.getElementById('newTaskDate'),
    newTaskPriority: document.getElementById('newTaskPriority'),
    mToolbarCount: document.getElementById('mToolbarCount'),
    mCollapseAll: document.getElementById('mCollapseAll'),
    mExpandAll: document.getElementById('mExpandAll'),
    mBottomNav: document.getElementById('mBottomNav'),
    newTaskDateBtn: document.getElementById('newTaskDateBtn'),
    datePickerModal: document.getElementById('datePickerModal'),
    datePickerMonth: document.getElementById('datePickerMonth'),
    datePickerPrev: document.getElementById('datePickerPrev'),
    datePickerNext: document.getElementById('datePickerNext'),
    datePickerGrid: document.getElementById('datePickerGrid'),
    datePickerOk: document.getElementById('datePickerOk'),
    datePickerClear: document.getElementById('datePickerClear'),
};

function loadPageSize() {
    const raw = parseInt(localStorage.getItem(PAGE_SIZE_KEY));
    return VALID_PAGE_SIZES.includes(raw) ? raw : DEFAULT_PAGE_SIZE;
}

function savePageSize(size) {
    localStorage.setItem(PAGE_SIZE_KEY, String(size));
}

function loadSortBy() {
    const raw = localStorage.getItem(SORT_BY_KEY);
    return SORT_MODES.includes(raw) ? raw : DEFAULT_SORT;
}

function saveSortBy(mode) {
    localStorage.setItem(SORT_BY_KEY, mode);
}

function loadCollapsed() {
    try {
        const raw = localStorage.getItem(COLLAPSED_KEY);
        if (!raw) return new Set();
        const arr = JSON.parse(raw);
        return new Set(Array.isArray(arr) ? arr : []);
    } catch {
        return new Set();
    }
}

function saveCollapsed(set) {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...set]));
}

/** Hoy en formato YYYY-MM-DD (timezone local del browser). */
function todayISO() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

// Modal de confirmación que reemplaza al confirm() nativo.
function confirmDialog(message) {
    return new Promise(resolve => {
        DOM.confirmModalText.textContent = message;
        DOM.confirmModal.hidden = false;

        const onClick = (e) => {
            const action = e.target.dataset.action;
            if (action !== 'ok' && action !== 'cancel') return;
            cleanup();
            resolve(action === 'ok');
        };
        const onKey = (e) => {
            if (e.key === 'Escape') { cleanup(); resolve(false); }
            else if (e.key === 'Enter') { cleanup(); resolve(true); }
        };
        const onBackdrop = (e) => {
            if (e.target === DOM.confirmModal) { cleanup(); resolve(false); }
        };

        function cleanup() {
            DOM.confirmModal.hidden = true;
            DOM.confirmModal.removeEventListener('click', onClick);
            DOM.confirmModal.removeEventListener('click', onBackdrop);
            document.removeEventListener('keydown', onKey);
        }

        DOM.confirmModal.addEventListener('click', onClick);
        DOM.confirmModal.addEventListener('click', onBackdrop);
        document.addEventListener('keydown', onKey);
    });
}

// ****** CAPA UI: TaskManager se apoya en TaskStore para la lógica **********
class TaskManager {
    constructor(store) {
        this.store = store;
        this._elapsedTicker = null;    // id del setInterval
        this.filterMode = 'all';       // 'all' | 'done' | 'pending'
        this.searchQuery = '';         // texto de búsqueda (no persistido)
        this.sortBy = loadSortBy();
        this.pageSize = loadPageSize();
        this.currentPage = 1;
        this.collapsedParents = loadCollapsed();
        // Set transitorio (no persistido) de IDs de padres con el form
        // "+ subtarea" expandido. Toggle desde el botón addsub-btn.
        this._showAddSubFor = new Set();
        this.toast = new ToastManager(DOM.toastContainer);
        // Filter tabs: hay 2 sets en el DOM (footer desktop + header mobile,
        // ambos con [data-filter-tabs]). Listener delegado en cada uno.
        document.querySelectorAll('[data-filter-tabs]').forEach(root => {
            root.addEventListener('click', (e) => {
                const tab = e.target.closest('.filter-tab');
                if (!tab) return;
                this._setFilterTab(tab.dataset.value);
            });
        });
        this.sortByCombo = new Combobox(DOM.sortByRoot, {
            onChange: (value) => this.handleSortChange(value),
        });
        this.sortByCombo.setValue(this.sortBy);
        this.pageSizeCombo = new Combobox(DOM.pageSizeRoot, {
            onChange: (value) => this.handlePageSizeChange(parseInt(value)),
        });
        this.pageSizeCombo.setValue(String(this.pageSize));
        // Setups defensivos: un error en uno NO debe romper los siguientes.
        this._safeRun('mountStaticIcons', () => this._mountStaticIcons());
        this._safeRun('setupChromeToggles', () => this._setupChromeToggles());
        this._safeRun('setupFooterHeightTracker', () => this._setupFooterHeightTracker());
        this._safeRun('setupMobileDrawer', () => this._setupMobileDrawer());
        this._safeRun('setupMobileFab', () => this._setupMobileFab());
        this._safeRun('setupMobileBottomNav', () => this._setupMobileBottomNav());
        this._safeRun('setupDatePicker', () => this._setupDatePicker());
        this.setupEventListeners();
        this.renderTasks();
        this._startElapsedTicker();
    }

    // ----- Tiempo transcurrido por tarea ------------------------------------

    _startElapsedTicker() {
        if (this._elapsedTicker) return;
        this._elapsedTicker = setInterval(() => this._updateElapsed(), 1000);
    }

    _updateElapsed() {
        // Con el formato compacto (single-unit), todos los strings son
        // cortos y de ancho similar. Ya no necesitamos un probe oculto
        // para medir el max-width y alinear columnas — un min-width CSS
        // pequeño basta. Solo actualizamos el textContent.
        const items = DOM.list.querySelectorAll('.grocery-item');
        if (items.length === 0) return;
        const now = new Date();
        for (const el of items) {
            const id = el.dataset.id;
            const span = el.querySelector('.task-days-old');
            if (!span) continue;
            const text = formatElapsed(elapsedComponents(parseInt(id), now));
            if (span.textContent !== text) span.textContent = text;
        }
    }

    _safeRun(label, fn) {
        try {
            fn();
        } catch (err) {
            console.error(`[init:${label}]`, err);
        }
    }

    _mountStaticIcons() {
        // Icono fijo del botón principal (siempre 'Agregar' — la edición
        // ahora es inline sobre la fila de la tarea).
        if (DOM.submitIcon && !DOM.submitIcon.firstChild) {
            DOM.submitIcon.appendChild(createIcon('plus', { size: 16, className: 'icon' }));
        }
        if (DOM.submitLabel) DOM.submitLabel.textContent = 'Agregar';

        // Inyecta iconos en botones del header que viven en HTML estático
        // (no se rebindean en cada renderTasks).
        const clearIconSlot = DOM.clearBtn?.querySelector('.bulk-btn-icon');
        if (clearIconSlot && !clearIconSlot.firstChild) {
            clearIconSlot.appendChild(createIcon('trash', { size: 14 }));
        }
        // Hamburger icon (menu) — solo se ve en mobile vía CSS.
        if (DOM.appHamburger && !DOM.appHamburger.firstChild) {
            DOM.appHamburger.appendChild(createIcon('menu', { size: 22 }));
        }
        // Mini-toolbar mobile (Fase F3): iconos collapse-all/expand-all.
        if (DOM.mCollapseAll && !DOM.mCollapseAll.firstChild) {
            DOM.mCollapseAll.appendChild(createIcon('chevron-up', { size: 16 }));
        }
        if (DOM.mExpandAll && !DOM.mExpandAll.firstChild) {
            DOM.mExpandAll.appendChild(createIcon('chevron-down', { size: 16 }));
        }
        // Bottom nav mobile (Fase F10): iconos en cada slot.
        if (DOM.mBottomNav) {
            // Nombre correcto en icons.js: 'circle-check' (no 'check-circle').
            // Cada icono envuelto en try/catch para que un nombre incorrecto
            // no aborte el resto.
            const iconMap = { today: 'flag', week: 'calendar', done: 'circle-check', settings: 'settings' };
            DOM.mBottomNav.querySelectorAll('[data-icon-slot]').forEach(slot => {
                if (slot.firstChild) return;
                const name = iconMap[slot.dataset.iconSlot];
                if (!name) return;
                try {
                    slot.appendChild(createIcon(name, { size: 20 }));
                } catch (err) {
                    console.error(`[bottom-nav icon ${name}]`, err);
                }
            });
        }
    }

    /**
     * Bottom nav mobile (Fase F10): 4 tabs.
     * - today/week/done: setean filterMode + sincroniza pills.
     * - settings: abre el drawer existente.
     * Marca .is-active el tab según filterMode actual.
     */
    _setupMobileBottomNav() {
        if (!DOM.mBottomNav) return;
        const updateActive = () => {
            DOM.mBottomNav.querySelectorAll('.m-bottom-btn').forEach(b => {
                const action = b.dataset.bottomAction;
                const active = action === 'settings' ? false
                    : action === this.filterMode;
                b.classList.toggle('is-active', active);
            });
        };
        DOM.mBottomNav.addEventListener('click', (e) => {
            const btn = e.target.closest('.m-bottom-btn');
            if (!btn) return;
            const action = btn.dataset.bottomAction;
            if (action === 'settings') {
                if (DOM.appHamburger) DOM.appHamburger.click();
                return;
            }
            this._setFilterTab(action);
            updateActive();
        });
        // Llama updateActive cada vez que cambia el filter (via _setFilterTab).
        const origSetFilterTab = this._setFilterTab.bind(this);
        this._setFilterTab = (value) => {
            origSetFilterTab(value);
            updateActive();
        };
        updateActive();
    }

    /**
     * Date picker custom (modal con calendario propio). Respeta dark/light
     * mode porque usa tokens semánticos. Reemplaza al <input type='date'>
     * nativo que no se puede estilear.
     */
    _setupDatePicker() {
        if (!DOM.datePickerModal || !DOM.datePickerGrid) return;
        this._dpView = new Date();   // mes/año mostrado.
        this._dpSelected = null;     // YYYY-MM-DD del día seleccionado.
        this._dpOnConfirm = null;    // callback al hacer Aceptar.

        const close = () => {
            DOM.datePickerModal.hidden = true;
            this._dpOnConfirm = null;
        };

        DOM.datePickerPrev.appendChild(createIcon('chevron-left', { size: 18 }));
        DOM.datePickerNext.appendChild(createIcon('chevron-right', { size: 18 }));
        DOM.datePickerPrev.addEventListener('click', () => {
            this._dpView.setMonth(this._dpView.getMonth() - 1);
            this._renderDatePicker();
        });
        DOM.datePickerNext.addEventListener('click', () => {
            this._dpView.setMonth(this._dpView.getMonth() + 1);
            this._renderDatePicker();
        });
        DOM.datePickerGrid.addEventListener('click', (e) => {
            const cell = e.target.closest('[data-date]');
            if (!cell) return;
            this._dpSelected = cell.dataset.date;
            this._renderDatePicker();
        });
        DOM.datePickerOk.addEventListener('click', () => {
            const cb = this._dpOnConfirm;
            const value = this._dpSelected;
            close();
            if (cb) cb(value);
        });
        DOM.datePickerClear.addEventListener('click', () => {
            const cb = this._dpOnConfirm;
            close();
            if (cb) cb(null);
        });
        DOM.datePickerModal.addEventListener('click', (e) => {
            if (e.target === DOM.datePickerModal) close();
            const action = e.target.closest('[data-action]')?.dataset.action;
            if (action === 'cancel') close();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !DOM.datePickerModal.hidden) close();
        });
    }

    _openDatePicker(currentValue, onConfirm) {
        if (!DOM.datePickerModal) return;
        this._dpSelected = currentValue || null;
        // View arranca en el mes del valor actual, o en el mes presente.
        if (currentValue) {
            const [y, m] = currentValue.split('-').map(Number);
            this._dpView = new Date(y, m - 1, 1);
        } else {
            const t = new Date();
            this._dpView = new Date(t.getFullYear(), t.getMonth(), 1);
        }
        this._dpOnConfirm = onConfirm;
        this._renderDatePicker();
        DOM.datePickerModal.hidden = false;
    }

    _renderDatePicker() {
        const view = this._dpView;
        const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
        DOM.datePickerMonth.textContent = `${monthNames[view.getMonth()]} ${view.getFullYear()}`;
        DOM.datePickerGrid.innerHTML = '';
        // El botón "Quitar" solo aparece si hay una fecha seleccionada;
        // en otro caso no tiene sentido mostrarlo.
        if (DOM.datePickerClear) {
            DOM.datePickerClear.hidden = !this._dpSelected;
        }
        // Días en el mes y day-of-week del primero (lun=0..dom=6).
        const firstOfMonth = new Date(view.getFullYear(), view.getMonth(), 1);
        const lastOfMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0);
        // JS getDay: dom=0..sab=6. Convertimos a lun=0.
        const startDow = (firstOfMonth.getDay() + 6) % 7;
        const today = todayISO();
        // Padding antes del 1° del mes.
        for (let i = 0; i < startDow; i++) {
            const empty = document.createElement('span');
            empty.className = 'date-picker__day is-empty';
            DOM.datePickerGrid.appendChild(empty);
        }
        for (let d = 1; d <= lastOfMonth.getDate(); d++) {
            const iso = `${view.getFullYear()}-${String(view.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const cell = document.createElement('button');
            cell.type = 'button';
            cell.className = 'date-picker__day';
            cell.dataset.date = iso;
            cell.textContent = String(d);
            if (iso === today) cell.classList.add('is-today');
            if (iso === this._dpSelected) cell.classList.add('is-selected');
            DOM.datePickerGrid.appendChild(cell);
        }
    }

    /**
     * FAB mobile (Fase 9F): boton flotante "+ tarea" abajo-derecha
     * que abre un modal con input para crear tarea. Reemplaza al form
     * principal arriba (oculto en mobile via CSS). En desktop el FAB
     * permanece oculto por CSS.
     */
    _setupMobileFab() {
        if (!DOM.appFab || !DOM.newTaskModal || !DOM.newTaskForm || !DOM.newTaskInput) return;
        DOM.appFab.appendChild(createIcon('plus', { size: 24 }));

        // Helper: actualizar el botón de fecha con el value actual del input
        // hidden. "Hoy" si coincide con today, "Sin fecha" si vacío.
        const refreshDateBtn = () => {
            if (!DOM.newTaskDateBtn) return;
            const v = DOM.newTaskDate?.value;
            DOM.newTaskDateBtn.textContent = !v ? 'Sin fecha'
                : v === todayISO() ? 'Hoy'
                : v;
        };

        const open = () => {
            DOM.newTaskModal.hidden = false;
            DOM.newTaskInput.value = '';
            // Por default, fecha = hoy (decisión UX: tarea sin fecha = today).
            if (DOM.newTaskDate) DOM.newTaskDate.value = todayISO();
            if (DOM.newTaskPriority) DOM.newTaskPriority.checked = false;
            refreshDateBtn();
            requestAnimationFrame(() => DOM.newTaskInput.focus());
        };
        const close = () => {
            DOM.newTaskModal.hidden = true;
        };

        DOM.appFab.addEventListener('click', open);

        // Botón de fecha en el modal: abre el date picker custom.
        if (DOM.newTaskDateBtn) {
            DOM.newTaskDateBtn.addEventListener('click', () => {
                this._openDatePicker(DOM.newTaskDate.value || todayISO(), (newValue) => {
                    DOM.newTaskDate.value = newValue || '';
                    refreshDateBtn();
                });
            });
        }

        DOM.newTaskForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const value = DOM.newTaskInput.value;
            if (value.trim() === '') {
                this.displayAlert('Por favor ingrese un valor', 'danger');
                return;
            }
            // Tarea sin fecha explícita → today por default (decisión UX).
            const dueDate = DOM.newTaskDate?.value || todayISO();
            this.store.add(value, {
                dueDate,
                priority: !!DOM.newTaskPriority?.checked,
            });
            this.displayAlert('Item agregado a la lista', 'success');
            this.currentPage = 1;
            this.renderTasks();
            close();
        });
        DOM.newTaskModal.addEventListener('click', (e) => {
            if (e.target === DOM.newTaskModal) close();
            const action = e.target.closest('[data-action]')?.dataset.action;
            if (action === 'cancel') close();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !DOM.newTaskModal.hidden) close();
        });
    }

    /**
     * Drawer mobile (hamburger): el .task-count-row se reposiciona como
     * panel fixed slide-from-left en mobile. Click en hamburger toggle
     * la clase .is-open, que activa el slide. Backdrop + Esc cierran.
     */
    _setupMobileDrawer() {
        if (!DOM.appHamburger || !DOM.taskCountRow || !DOM.appDrawerBackdrop) return;
        const open = () => {
            DOM.taskCountRow.classList.add('is-open');
            DOM.appDrawerBackdrop.hidden = false;
            requestAnimationFrame(() => DOM.appDrawerBackdrop.classList.add('is-open'));
            DOM.appHamburger.setAttribute('aria-expanded', 'true');
        };
        const close = () => {
            DOM.taskCountRow.classList.remove('is-open');
            DOM.appDrawerBackdrop.classList.remove('is-open');
            DOM.appHamburger.setAttribute('aria-expanded', 'false');
            // Espera fin de transición para hidden=true (evita flash).
            setTimeout(() => { DOM.appDrawerBackdrop.hidden = true; }, 220);
        };
        DOM.appHamburger.addEventListener('click', () => {
            const isOpen = DOM.taskCountRow.classList.contains('is-open');
            isOpen ? close() : open();
        });
        DOM.appDrawerBackdrop.addEventListener('click', close);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && DOM.taskCountRow.classList.contains('is-open')) close();
        });
    }

    /**
     * Mide la altura real del footer fijo y la setea como --footer-h
     * sobre <html>. Antes era hardcoded (64/76px) y en algunos casos
     * el footer real era mayor (filter-tabs height en touch + padding +
     * border + safe-area), dejando la paginación tapada.
     * Recalcula en load, resize y cuando cambia density (los botones
     * cambian de tamaño con --btn-h).
     */
    _setupFooterHeightTracker() {
        const footer = document.querySelector('.app-footer');
        if (!footer) return;
        const update = () => {
            const h = footer.offsetHeight;
            if (h > 0) document.documentElement.style.setProperty('--footer-h', `${h}px`);
        };
        update();
        window.addEventListener('resize', update);
        // ResizeObserver dispara cuando el contenido del footer cambia
        // (cambio de density modifica btn-h, etc.).
        if (typeof ResizeObserver !== 'undefined') {
            new ResizeObserver(update).observe(footer);
        }
    }

    /**
     * Setup de los toggles de tema (light/dark) y densidad (comfy/compact).
     * Persistencia en localStorage. Aplica `data-theme` y `data-density`
     * sobre <html> para que los tokens.css los lean.
     */
    _setupChromeToggles() {
        if (!DOM.themeSeg || !DOM.densitySeg) return;

        // Estado inicial.
        const theme = loadTheme();
        const density = loadDensity();
        applyTheme(theme);
        applyDensity(density);

        // Iconos en los botones del seg de tema.
        const sunBtn = DOM.themeSeg.querySelector('[data-theme="light"]');
        const moonBtn = DOM.themeSeg.querySelector('[data-theme="dark"]');
        sunBtn?.appendChild(createIcon('sun', { size: 14 }));
        moonBtn?.appendChild(createIcon('moon', { size: 14 }));

        // Iconos en los botones del seg de densidad.
        const rowsBtn = DOM.densitySeg.querySelector('[data-density="comfy"]');
        const tightBtn = DOM.densitySeg.querySelector('[data-density="compact"]');
        rowsBtn?.appendChild(createIcon('rows', { size: 14 }));
        tightBtn?.appendChild(createIcon('align-justify', { size: 14 }));

        const setActive = (seg, attr, value) => {
            seg.querySelectorAll('.seg__btn').forEach(b => {
                b.classList.toggle('is-active', b.dataset[attr] === value);
            });
        };
        setActive(DOM.themeSeg, 'theme', theme);
        setActive(DOM.densitySeg, 'density', density);

        DOM.themeSeg.addEventListener('click', (e) => {
            const btn = e.target.closest('.seg__btn');
            if (!btn) return;
            const v = btn.dataset.theme;
            if (v !== 'light' && v !== 'dark') return;
            applyTheme(v);
            setActive(DOM.themeSeg, 'theme', v);
        });
        DOM.densitySeg.addEventListener('click', (e) => {
            const btn = e.target.closest('.seg__btn');
            if (!btn) return;
            const v = btn.dataset.density;
            if (v !== 'comfy' && v !== 'compact') return;
            applyDensity(v);
            setActive(DOM.densitySeg, 'density', v);
        });
    }

    setupEventListeners() {
        DOM.form.addEventListener('submit', this.handleAddItem.bind(this));
        DOM.clearBtn.addEventListener('click', this.handleClearItems.bind(this));
        if (DOM.bulkCollapseAllBtn) {
            DOM.bulkCollapseAllBtn.addEventListener('click', this.handleCollapseAll.bind(this));
        }
        if (DOM.bulkExpandAllBtn) {
            DOM.bulkExpandAllBtn.addEventListener('click', this.handleExpandAll.bind(this));
        }
        // Mini-toolbar mobile (Fase F3): mismos handlers que los del drawer.
        if (DOM.mCollapseAll) {
            DOM.mCollapseAll.addEventListener('click', this.handleCollapseAll.bind(this));
        }
        if (DOM.mExpandAll) {
            DOM.mExpandAll.addEventListener('click', this.handleExpandAll.bind(this));
        }
        if (DOM.promoteZone) {
            DOM.promoteZone.addEventListener('dragover', this.handlePromoteDragOver.bind(this));
            DOM.promoteZone.addEventListener('dragleave', this.handlePromoteDragLeave.bind(this));
            DOM.promoteZone.addEventListener('drop', this.handlePromoteDrop.bind(this));
        }
        // Delegación de drag en el contenedor de la lista: dragover/leave/drop
        // se resuelven desde aquí, calculando target lógico (item específico
        // o gap entre bloques) según geometría.
        if (DOM.searchInput) {
            DOM.searchInput.addEventListener('input', this.handleSearchInput.bind(this));
        }
        DOM.list.addEventListener('dragover', this.handleListDragOver.bind(this));
        DOM.list.addEventListener('dragleave', this.handleListDragLeave.bind(this));
        DOM.list.addEventListener('drop', this.handleListDrop.bind(this));
    }

    // ****** MANEJADORES DE EVENTOS **********

    handleAddItem(e) {
        e.preventDefault();
        const value = DOM.groceryInput.value;
        if (value.trim() === "") {
            this.displayAlert("Por favor ingrese un valor", "danger");
            return;
        }
        // Tarea creada sin fecha asume today (decisión UX).
        this.store.add(value, { dueDate: todayISO() });
        this.displayAlert("Item agregado a la lista", "success");
        this.currentPage = 1;
        this.renderTasks();
        DOM.groceryInput.value = "";
    }

    async handleClearItems() {
        if (this.store.isEmpty()) {
            this.displayAlert("La lista ya está vacía", "danger");
            return;
        }
        const ok = await confirmDialog("¿Estás seguro de que quieres limpiar toda la lista?");
        if (!ok) return;
        // Snapshot ANTES del clear para poder revertir si el usuario
        // presiona 'Deshacer' en el toast (5s de ventana).
        const tasksSnapshot = this.store.snapshot();
        const collapsedSnapshot = new Set(this.collapsedParents);
        this.store.clear();
        this.currentPage = 1;
        this.renderTasks();
        this.toast.show("Lista vacía", "danger", {
            action: {
                label: 'Deshacer',
                onClick: () => {
                    this.store.restore(tasksSnapshot);
                    this.collapsedParents = collapsedSnapshot;
                    saveCollapsed(this.collapsedParents);
                    this.currentPage = 1;
                    this.renderTasks();
                    this.displayAlert('Lista restaurada', 'success');
                },
            },
        });
    }

    _setFilterTab(value) {
        if (!['all', 'done', 'pending', 'today', 'week', 'priority'].includes(value)) return;
        if (this.filterMode === value) return;
        this.filterMode = value;
        this.currentPage = 1;
        // Actualiza aria-selected y .is-active en TODOS los sets de tabs
        // (footer desktop + header mobile via data-filter-tabs).
        document.querySelectorAll('[data-filter-tabs] .filter-tab').forEach(t => {
            const active = t.dataset.value === value;
            t.classList.toggle('is-active', active);
            t.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        this.renderTasks();
    }

    handlePageSizeChange(size) {
        if (!VALID_PAGE_SIZES.includes(size)) return;
        this.pageSize = size;
        savePageSize(size);
        this.currentPage = 1;
        this.renderTasks();
    }

    handleSearchInput(e) {
        this.searchQuery = e.target.value.trim().toLowerCase();
        this.currentPage = 1;
        this.renderTasks();
    }

    handleSortChange(mode) {
        if (!SORT_MODES.includes(mode)) return;
        this.sortBy = mode;
        saveSortBy(mode);
        this.currentPage = 1;
        this.renderTasks();
    }

    handlePageClick(page) {
        if (page === this.currentPage) return;
        this.currentPage = page;
        this.renderTasks();
    }

    handleMarkTaskAsDone(e) {
        const button = e.currentTarget;
        const element = button.closest('.grocery-item');
        const id = element.dataset.id;
        const isDone = element.dataset.done !== "true";

        this.store.toggle(id, isDone);
        this.currentPage = 1;
        this.renderTasks();
        this.displayAlert(isDone ? 'Tarea marcada como hecha' : 'Tarea pendiente', isDone ? 'success' : 'warning');
    }

    async handleDeleteItem(e) {
        const element = e.currentTarget.closest('.grocery-item');
        const id = element.dataset.id;
        const task = this.store.tasks.find(t => t.id === id);
        const isParent = task && task.parentId === null;
        const subs = isParent ? this.store.subsOf(id) : [];
        const message = subs.length > 0
            ? `Esta tarea tiene ${subs.length} subtarea${subs.length === 1 ? '' : 's'}. ¿Borrarla${subs.length === 1 ? '' : 's'} también?`
            : '¿Estás seguro de que quieres eliminar esta tarea?';
        const ok = await confirmDialog(message);
        if (!ok) return;
        // Limpieza del Set de colapsados:
        if (isParent && this.collapsedParents.has(id)) {
            this.collapsedParents.delete(id);
            saveCollapsed(this.collapsedParents);
        }
        this.store.remove(id);
        // Si esa sub era la última de su padre, el padre ya no tiene
        // subs y su entrada en el Set queda obsoleta — limpiarla.
        if (!isParent && task) {
            const parentStillHasSubs = this.store.subsOf(task.parentId).length > 0;
            if (!parentStillHasSubs && this.collapsedParents.has(task.parentId)) {
                this.collapsedParents.delete(task.parentId);
                saveCollapsed(this.collapsedParents);
            }
        }
        this.currentPage = 1;
        this.renderTasks();
        this.displayAlert("Item eliminado", "danger");
    }

    handleEditItem(e) {
        const element = e.currentTarget.closest('.grocery-item');
        this._enterEditMode(element);
    }

    /**
     * Edita la dueDate vía el date picker custom (modal con calendario
     * propio que respeta dark/light mode). Reemplaza al picker nativo
     * que era inestilable.
     */
    _editDueDate(taskId) {
        const task = this.store.tasks.find(t => t.id === taskId);
        if (!task || task.parentId !== null) return;
        this._openDatePicker(task.dueDate || '', (newValue) => {
            this.store.setDueDate(taskId, newValue || null);
            this.renderTasks();
            this.displayAlert(newValue
                ? `Fecha asignada: ${newValue}`
                : 'Fecha removida', 'success');
        });
    }

    /**
     * Activa edición inline sobre la fila: reemplaza el <p class="title">
     * por un <input> con el valor actual. Enter o blur guardan, Esc
     * cancela. Si la fila ya está en modo edit, no-op.
     */
    _enterEditMode(taskEl) {
        if (!taskEl || taskEl.dataset.editing === 'true') return;
        const titleEl = taskEl.querySelector('.title');
        if (!titleEl) return;
        const id = taskEl.dataset.id;
        const task = this.store.tasks.find(t => t.id === id);
        if (!task) return;

        const oldText = task.value;
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'title-edit-input';
        input.value = oldText;
        input.setAttribute('aria-label', 'Editar tarea');

        taskEl.dataset.editing = 'true';
        // Mientras editamos suspendemos el draggable para que el drag
        // no se dispare al seleccionar texto con el mouse.
        const wasDraggable = taskEl.draggable;
        taskEl.draggable = false;

        titleEl.replaceWith(input);
        input.focus();
        input.select();

        let resolved = false;
        const finish = (save) => {
            if (resolved) return;
            resolved = true;
            taskEl.dataset.editing = 'false';
            taskEl.draggable = wasDraggable;
            const newValue = input.value.trim();
            if (save && newValue && newValue !== oldText) {
                this.store.update(id, newValue);
                this.displayAlert('Tarea actualizada', 'success');
            }
            this.renderTasks();
        };

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); finish(true); }
            else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
        });
        // Click fuera = guardar (decisión UX confirmada con el usuario).
        input.addEventListener('blur', () => finish(true));
    }

    // ----- Reordenamiento manual: drag-and-drop + teclado --------------------

    _isManualReorderActive() {
        // Sólo activamos drag/keyboard reorder cuando el sort es 'manual'
        // y NO hay un filtro aplicado (mover entre items invisibles
        // confundiría al usuario).
        return this.sortBy === 'manual' && this.filterMode === 'all';
    }

    /**
     * true si el dispositivo es primary touch (pointer: coarse). Coincide
     * con el media query que el CSS usa para mostrar los botones touch.
     * Usado para deshabilitar `dblclick` en mobile (Fase 4) y otros
     * comportamientos hover/desktop-only.
     */
    _isPrimaryTouch() {
        return typeof window !== 'undefined'
            && typeof window.matchMedia === 'function'
            && window.matchMedia('(pointer: coarse)').matches;
    }

    handleDragStart(e) {
        const el = e.currentTarget;
        const id = el.dataset.id;
        const task = this.store.tasks.find(t => t.id === id);
        this._draggingId = id;
        this._draggingIsSub = task ? task.parentId !== null : false;
        // setData ANTES de cualquier cambio de DOM. Firefox lo exige; en
        // Chrome además, modificar el DOM dentro de dragstart puede
        // cancelar el drag silenciosamente — diferimos esos cambios al
        // siguiente frame para que Chrome haya capturado la "drag image"
        // antes de que cambie el layout.
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', id);
        e.dataTransfer.setData('application/x-task-id', id);
        requestAnimationFrame(() => {
            el.classList.add('is-dragging');
            if (this._draggingIsSub && DOM.promoteZone) {
                DOM.promoteZone.hidden = false;
            }
        });
    }

    handleDragEnd(e) {
        e.currentTarget.classList.remove('is-dragging');
        this._clearDragVisuals();
        if (DOM.promoteZone) {
            DOM.promoteZone.classList.remove('is-drop-target');
            DOM.promoteZone.hidden = true;
        }
        this._draggingId = null;
        this._draggingIsSub = false;
        this._cancelExpandTimer();
        this._currentDropAction = null;
    }

    // ----- Drag delegado al contenedor: resolver target lógico ---------------

    /**
     * Resuelve la acción de drop según los 6 casos de la tabla:
     *  Origen × Target → { type, parentId, beforeId, blockEl?, indicatorRect? }
     * type ∈ 'reorder' | 'nest-end' | 'nest-before' | 'promote' | 'invalid'
     */
    _resolveDropAction(e) {
        if (!this._draggingId || !this._isManualReorderActive()) {
            return { type: 'invalid' };
        }
        const draggingId = this._draggingId;
        const isSubOrigin = this._draggingIsSub;

        const itemEl = e.target.closest('.grocery-item');
        const overItem = itemEl && itemEl.dataset.id !== draggingId ? itemEl : null;

        // ----- Hover sobre un ITEM ------------------------------------------
        if (overItem) {
            const overIsSub = overItem.classList.contains('is-subtask');
            const rect = overItem.getBoundingClientRect();
            const isUpperHalf = e.clientY < rect.top + rect.height / 2;

            if (!isSubOrigin && !overIsSub) {
                // CASO 1: Task → Task. Reorder según mitad sup/inf.
                const beforeId = isUpperHalf
                    ? overItem.dataset.id
                    : this._nextParentIdAfter(overItem.dataset.id);
                return {
                    type: 'reorder',
                    parentId: null,
                    beforeId,
                    indicatorRect: this._lineRectFor(overItem, isUpperHalf ? 'top' : 'bottom'),
                };
            }

            if (!isSubOrigin && overIsSub) {
                // CASO 2: Task → Subtask. Reorder respecto al BLOQUE del padre.
                const parentId = overItem.dataset.parentId;
                const block = this._blockOf(parentId);
                if (!block) return { type: 'invalid' };
                const blockTop = block.parentEl.getBoundingClientRect().top;
                const blockBottom = block.lastEl.getBoundingClientRect().bottom;
                const upper = e.clientY < (blockTop + blockBottom) / 2;
                const beforeId = upper ? parentId : this._nextParentIdAfter(parentId);
                return {
                    type: 'reorder',
                    parentId: null,
                    beforeId,
                    blockEl: block,
                    indicatorRect: this._lineRectForBlock(block, upper ? 'top' : 'bottom'),
                };
            }

            if (isSubOrigin && !overIsSub) {
                // CASO 4: Subtask → Task (fila padre). Default: al final del bloque.
                // Auto-expand si está colapsado.
                const parentId = overItem.dataset.id;
                if (this.collapsedParents.has(parentId)) {
                    this._scheduleAutoExpand(parentId);
                } else {
                    this._cancelExpandTimer();
                }
                const block = this._blockOf(parentId);
                if (!block) return { type: 'invalid' };
                return {
                    type: 'nest-end',
                    parentId,
                    beforeId: null,
                    blockEl: block,
                    indicatorRect: this._lineRectForBlock(block, 'bottom'),
                };
            }

            if (isSubOrigin && overIsSub) {
                // CASO 5: Subtask → Subtask. Re-parent o reorder según mitad.
                const parentId = overItem.dataset.parentId;
                const block = this._blockOf(parentId);
                if (!block) return { type: 'invalid' };
                const beforeId = isUpperHalf
                    ? overItem.dataset.id
                    : this._nextSubIdAfter(parentId, overItem.dataset.id);
                return {
                    type: 'nest-before',
                    parentId,
                    beforeId,
                    blockEl: block,
                    indicatorRect: this._lineRectFor(overItem, isUpperHalf ? 'top' : 'bottom'),
                };
            }
        }

        // ----- Hover en GAP (espacio entre bloques o áreas vacías) ----------
        // Calcula entre qué dos PADRES cae el cursor verticalmente.
        const parentEls = [...DOM.list.querySelectorAll('.grocery-item:not(.is-subtask)')];
        let beforeParentId = null;
        for (const el of parentEls) {
            if (el.dataset.id === draggingId) continue;
            const rect = el.getBoundingClientRect();
            if (e.clientY < rect.top) {
                beforeParentId = el.dataset.id;
                break;
            }
        }

        if (isSubOrigin) {
            // CASO 6: Subtask en gap → promote en esa posición.
            return {
                type: 'promote',
                parentId: null,
                beforeId: beforeParentId,
                indicatorRect: this._gapLineRect(beforeParentId),
            };
        }
        // CASO 1 (en gap entre bloques): Task → reorder en esa posición.
        return {
            type: 'reorder',
            parentId: null,
            beforeId: beforeParentId,
            indicatorRect: this._gapLineRect(beforeParentId),
        };
    }

    handleListDragOver(e) {
        if (!this._draggingId) return;
        const action = this._resolveDropAction(e);
        // Solo aceptamos el drop (preventDefault) si la acción es válida.
        // Cambiar dropEffect dinámicamente entre 'move' y 'none' confunde
        // a Chrome y a veces cancela el drag silenciosamente.
        if (action.type === 'invalid') {
            this._currentDropAction = action;
            this._clearDragVisuals();
            this._hideIndicator();
            return;
        }
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        this._currentDropAction = action;
        this._clearDragVisuals();

        if (action.blockEl) {
            action.blockEl.parentEl.classList.add('is-block-target');
            for (const subEl of action.blockEl.subEls) subEl.classList.add('is-block-target');
        }
        if (action.indicatorRect) {
            this._showIndicator(action.indicatorRect);
        } else {
            this._hideIndicator();
        }
    }

    handleListDragLeave(e) {
        // Solo limpiar si realmente salimos del contenedor (no de un hijo).
        if (e.target !== DOM.list) return;
        const rect = DOM.list.getBoundingClientRect();
        if (e.clientX >= rect.left && e.clientX <= rect.right
            && e.clientY >= rect.top && e.clientY <= rect.bottom) return;
        this._clearDragVisuals();
        this._hideIndicator();
        this._cancelExpandTimer();
    }

    handleListDrop(e) {
        // Fallback: si _draggingId quedó null por orden inusual de eventos
        // (Chrome a veces dispara dragend antes que drop), recuperamos el
        // id desde dataTransfer.
        let fromId = this._draggingId;
        if (!fromId && e.dataTransfer) {
            fromId = e.dataTransfer.getData('application/x-task-id')
                  || e.dataTransfer.getData('text/plain');
        }
        if (!fromId) return;
        e.preventDefault();
        const action = this._currentDropAction || this._resolveDropAction(e);
        this._draggingId = null;
        this._draggingIsSub = false;
        this._currentDropAction = null;
        this._clearDragVisuals();
        this._hideIndicator();
        this._cancelExpandTimer();

        if (!action || action.type === 'invalid') return;

        let ok = false;
        let msg = '';
        if (action.type === 'reorder') {
            ok = this.store.moveToParent(fromId, null, action.beforeId);
            msg = 'Tarea reordenada';
        } else if (action.type === 'nest-end' || action.type === 'nest-before') {
            ok = this.store.moveToParent(fromId, action.parentId, action.beforeId);
            msg = 'Subtarea movida';
        } else if (action.type === 'promote') {
            ok = this.store.moveToParent(fromId, null, action.beforeId);
            msg = 'Promovida a tarea principal';
        }
        if (ok) {
            this.currentPage = 1;
            this.renderTasks();
            this.displayAlert(msg, 'success');
        }
    }

    // ----- Helpers de drag ---------------------------------------------------

    _blockOf(parentId) {
        const parentEl = DOM.list.querySelector(
            `.grocery-item[data-id="${parentId}"]:not(.is-subtask)`
        );
        if (!parentEl) return null;
        const subEls = [...DOM.list.querySelectorAll(
            `.grocery-item.is-subtask[data-parent-id="${parentId}"]:not(.is-collapsed)`
        )];
        const lastEl = subEls[subEls.length - 1] || parentEl;
        return { parentEl, subEls, lastEl };
    }

    _nextParentIdAfter(parentId) {
        const parents = [...DOM.list.querySelectorAll('.grocery-item:not(.is-subtask)')];
        const idx = parents.findIndex(el => el.dataset.id === parentId);
        if (idx < 0 || idx === parents.length - 1) return null;
        return parents[idx + 1].dataset.id;
    }

    _nextSubIdAfter(parentId, subId) {
        const subs = [...DOM.list.querySelectorAll(
            `.grocery-item.is-subtask[data-parent-id="${parentId}"]`
        )];
        const idx = subs.findIndex(el => el.dataset.id === subId);
        if (idx < 0 || idx === subs.length - 1) return null;
        return subs[idx + 1].dataset.id;
    }

    _ensureIndicator() {
        if (this._dropIndicator) return this._dropIndicator;
        const el = document.createElement('div');
        el.className = 'drop-indicator';
        el.setAttribute('aria-hidden', 'true');
        // Lo agregamos al BODY (position: fixed) en vez de dentro del list.
        // Así no queda como descendiente del contenedor de drop y nunca
        // aparece como `e.target` durante dragover (incluso aunque tenga
        // pointer-events: none, algunos browsers se confunden).
        document.body.appendChild(el);
        this._dropIndicator = el;
        return el;
    }

    _showIndicator(rect) {
        if (!rect) return this._hideIndicator();
        const el = this._ensureIndicator();
        // rect.top/left ya están en coordenadas de viewport (clientRect),
        // y el elemento es position: fixed, así que se aplican directo.
        el.style.top = `${rect.top}px`;
        el.style.left = `${rect.left}px`;
        el.style.width = `${rect.width}px`;
        el.classList.add('is-visible');
    }

    _hideIndicator() {
        if (!this._dropIndicator) return;
        this._dropIndicator.classList.remove('is-visible');
    }

    _lineRectFor(itemEl, edge) {
        const rect = itemEl.getBoundingClientRect();
        return {
            top: edge === 'top' ? rect.top - 2 : rect.bottom - 1,
            left: rect.left,
            width: rect.width,
        };
    }

    _lineRectForBlock(block, edge) {
        const top = block.parentEl.getBoundingClientRect();
        const bottom = block.lastEl.getBoundingClientRect();
        return {
            top: edge === 'top' ? top.top - 2 : bottom.bottom - 1,
            left: top.left,
            width: top.width,
        };
    }

    _gapLineRect(beforeParentId) {
        // Línea horizontal en el espacio entre bloques. Si beforeParentId es
        // null, la línea va al final de la lista.
        const listRect = DOM.list.getBoundingClientRect();
        if (beforeParentId === null) {
            const parents = DOM.list.querySelectorAll('.grocery-item:not(.is-subtask)');
            const lastParent = parents[parents.length - 1];
            if (!lastParent) return { top: listRect.top, left: listRect.left, width: listRect.width };
            const block = this._blockOf(lastParent.dataset.id);
            const bottom = block ? block.lastEl.getBoundingClientRect().bottom : lastParent.getBoundingClientRect().bottom;
            return { top: bottom + 1, left: listRect.left, width: listRect.width };
        }
        const targetEl = DOM.list.querySelector(
            `.grocery-item[data-id="${beforeParentId}"]:not(.is-subtask)`
        );
        if (!targetEl) return null;
        const rect = targetEl.getBoundingClientRect();
        return { top: rect.top - 2, left: listRect.left, width: listRect.width };
    }

    _clearDragVisuals() {
        DOM.list.querySelectorAll('.grocery-item.is-block-target')
            .forEach(el => el.classList.remove('is-block-target'));
        DOM.list.querySelectorAll('.grocery-item.is-drop-target, .grocery-item.is-drop-nest')
            .forEach(el => el.classList.remove('is-drop-target', 'is-drop-nest'));
    }

    _scheduleAutoExpand(parentId) {
        if (this._expandTimer && this._expandTimerParentId === parentId) return;
        this._cancelExpandTimer();
        this._expandTimerParentId = parentId;
        this._expandTimer = setTimeout(() => {
            this._expandTimer = null;
            this._expandTimerParentId = null;
            if (this._expandParent(parentId)) {
                this.renderTasks();
            }
        }, 500);
    }

    _cancelExpandTimer() {
        if (this._expandTimer) {
            clearTimeout(this._expandTimer);
            this._expandTimer = null;
            this._expandTimerParentId = null;
        }
    }

    // Listeners del promote zone (sólo recibe drops de subs).
    handlePromoteDragOver(e) {
        if (!this._draggingId || !this._draggingIsSub) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        DOM.promoteZone.classList.add('is-drop-target');
    }

    handlePromoteDragLeave() {
        DOM.promoteZone.classList.remove('is-drop-target');
    }

    handlePromoteDrop(e) {
        e.preventDefault();
        DOM.promoteZone.classList.remove('is-drop-target');
        if (!this._draggingId || !this._draggingIsSub) return;
        const id = this._draggingId;
        this._draggingId = null;
        this._draggingIsSub = false;
        const ok = this.store.moveToParent(id, null);
        if (ok) {
            this.currentPage = 1;
            this.renderTasks();
            this.displayAlert('Promovida a tarea principal', 'success');
        }
        DOM.promoteZone.hidden = true;
    }

    // ----- Collapse / expand de grupos de subtareas ---------------------------

    _parentsWithSubs() {
        // Devuelve la lista de IDs de padres que tienen al menos una sub.
        return this.store.tasks
            .filter(t => t.parentId === null)
            .map(p => p.id)
            .filter(id => this.store.subsOf(id).length > 0);
    }

    _toggleCollapsed(parentId) {
        if (this.collapsedParents.has(parentId)) {
            this.collapsedParents.delete(parentId);
        } else {
            this.collapsedParents.add(parentId);
        }
        saveCollapsed(this.collapsedParents);
    }

    _expandParent(parentId) {
        if (!this.collapsedParents.has(parentId)) return false;
        this.collapsedParents.delete(parentId);
        saveCollapsed(this.collapsedParents);
        return true;
    }

    handleSubtaskToggleCollapse(e) {
        const btn = e.currentTarget;
        const parentId = btn.dataset.parentId;
        this._toggleCollapsed(parentId);
        const isNowCollapsed = this.collapsedParents.has(parentId);
        // El chevron individual SOLO afecta la visibilidad de las subs.
        // El form '+ subtarea' (si está expandido) sigue visible — el user
        // puede agregar una sub aunque las existentes estén colapsadas.
        // Animación DOM-only (sin renderTasks) para preservar transiciones.
        btn.setAttribute('aria-expanded', String(!isNowCollapsed));
        btn.setAttribute('aria-label', isNowCollapsed ? 'Expandir subtareas' : 'Contraer subtareas');
        btn.replaceChildren(createIcon(isNowCollapsed ? 'chevron-right' : 'chevron-down', { size: 14 }));
        DOM.list.querySelectorAll(`.grocery-item.is-subtask[data-parent-id="${parentId}"]`)
            .forEach(el => el.classList.toggle('is-collapsed', isNowCollapsed));
        const subsWrap = DOM.list.querySelector(`.m-subs[data-parent-id="${parentId}"]`);
        subsWrap?.classList.toggle('is-collapsed', isNowCollapsed);
    }

    handleSubtaskToggleKeyDown(e) {
        const btn = e.currentTarget;
        const parentId = btn.dataset.parentId;
        const isCollapsed = this.collapsedParents.has(parentId);
        if (e.key === 'ArrowLeft' && !isCollapsed) {
            e.preventDefault();
            btn.click();
        } else if (e.key === 'ArrowRight' && isCollapsed) {
            e.preventDefault();
            btn.click();
        }
    }

    handleCollapseAll() {
        const ids = this._parentsWithSubs();
        for (const id of ids) this.collapsedParents.add(id);
        saveCollapsed(this.collapsedParents);
        // 'Colapsar todo' también cierra TODOS los forms '+ subtarea'
        // expandidos (incluso en padres sin subs). Reinicia al estado
        // por default: ícono plus, sin input visible.
        this._showAddSubFor.clear();
        this.renderTasks();
    }

    handleExpandAll() {
        this.collapsedParents.clear();
        saveCollapsed(this.collapsedParents);
        this.renderTasks();
    }

    handleManualKeyDown(e) {
        // Alt+ArrowUp/Down reordena la tarea PADRE enfocada.
        // El check de !shiftKey deja libre Alt+Shift+↑/↓ para subs.
        if (!e.altKey || e.shiftKey) return;
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        e.preventDefault();
        const id = e.currentTarget.dataset.id;
        const parents = this.store.tasks.filter(t => t.parentId === null);
        const idx = parents.findIndex(p => p.id === id);
        if (idx < 0) return;
        const newIdx = e.key === 'ArrowUp' ? idx - 1 : idx + 1;
        if (newIdx < 0 || newIdx >= parents.length) return;
        this.store.move(idx, newIdx);
        this.renderTasks();
        const moved = DOM.list.querySelector(`.grocery-item[data-id="${id}"]`);
        if (moved) moved.focus();
    }

    /**
     * Atajos sobre una SUBTAREA enfocada (Tab para llegar). Requieren Alt:
     *   Alt+↑/↓        → reorder dentro del padre actual.
     *   Alt+Shift+↑    → promote a top-level (queda antes del padre actual).
     *   Alt+Shift+↓    → re-parent al siguiente padre (al final del bloque).
     */
    handleSubKeyDown(e) {
        if (!e.altKey) return;
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        const id = e.currentTarget.dataset.id;
        const sub = this.store.tasks.find(t => t.id === id);
        if (!sub || sub.parentId === null) return;
        e.preventDefault();

        let ok = false;
        let msg = '';

        if (e.shiftKey) {
            if (e.key === 'ArrowUp') {
                // Promote: queda como top-level antes del padre actual.
                ok = this.store.moveToParent(id, null, sub.parentId);
                msg = 'Promovida a tarea principal';
            } else {
                // Re-parent al siguiente padre, al final del bloque.
                const parents = this.store.tasks.filter(t => t.parentId === null);
                const parentIdx = parents.findIndex(p => p.id === sub.parentId);
                const nextParent = parents[parentIdx + 1];
                if (!nextParent) return;
                ok = this.store.moveToParent(id, nextParent.id, null);
                msg = 'Subtarea movida al siguiente padre';
            }
        } else {
            const siblings = this.store.subsOf(sub.parentId);
            const idx = siblings.findIndex(s => s.id === id);
            if (e.key === 'ArrowUp') {
                if (idx <= 0) return;
                const beforeId = siblings[idx - 1].id;
                ok = this.store.moveToParent(id, sub.parentId, beforeId);
            } else {
                if (idx < 0 || idx >= siblings.length - 1) return;
                const beforeId = idx + 2 < siblings.length ? siblings[idx + 2].id : null;
                ok = this.store.moveToParent(id, sub.parentId, beforeId);
            }
        }

        if (ok) {
            this.renderTasks();
            if (msg) this.displayAlert(msg, 'success');
            const moved = DOM.list.querySelector(`.grocery-item[data-id="${id}"]`);
            if (moved) moved.focus();
        }
    }

    /**
     * Construye los botones touch (↑ ↓ ⬅) que reemplazan al drag-and-drop
     * en dispositivos primary touch. CSS los oculta en pointer:fine, así que
     * el render es uniforme; solo cambia la visibilidad.
     *
     * - ↑ subir / ↓ bajar: solo activos en sort manual + filtro 'all'.
     *   Replican la misma lógica que handleManualKeyDown (top-level) y la
     *   rama no-shift de handleSubKeyDown (sub).
     * - ⬅ promote (solo subs): convierte la sub en top-level antes del
     *   padre actual. Funciona en cualquier sort (no afecta el orden de
     *   los padres, que se ordena por `_sortList`).
     *
     * Devuelve array de elementos para append; vacío si la tarea no
     * permite ninguna acción touch.
     */
    _buildTouchMoveControls(task, isSubtask) {
        const id = task.id;
        const manualOk = this._isManualReorderActive();

        // Si el sort no es manual, los botones ↑/↓ no sirven — los omitimos
        // para no ocupar espacio en mobile. El promote (⬅) sí queda en subs
        // porque funciona en cualquier sort.
        const out = [];

        if (manualOk) {
            // Calcula si hay vecino arriba/abajo en el scope correcto.
            let canUp = false, canDown = false;
            if (isSubtask) {
                const siblings = this.store.subsOf(task.parentId);
                const sIdx = siblings.findIndex(s => s.id === id);
                canUp = sIdx > 0;
                canDown = sIdx >= 0 && sIdx < siblings.length - 1;
            } else {
                const parents = this.store.tasks.filter(t => t.parentId === null);
                const pIdx = parents.findIndex(p => p.id === id);
                canUp = pIdx > 0;
                canDown = pIdx >= 0 && pIdx < parents.length - 1;
            }
            if (canUp) out.push(this._makeTouchMoveBtn('chevron-up', 'Mover arriba',
                () => this._touchMove(id, 'up', isSubtask)));
            if (canDown) out.push(this._makeTouchMoveBtn('chevron-down', 'Mover abajo',
                () => this._touchMove(id, 'down', isSubtask)));
        }

        if (isSubtask) {
            const promoteBtn = this._makeTouchMoveBtn('corner-up-left',
                'Convertir en tarea principal', () => this._touchPromote(id));
            promoteBtn.classList.add('touch-promote-btn');
            out.push(promoteBtn);
        }
        return out;
    }

    _makeTouchMoveBtn(iconName, label, onClick) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'touch-move-btn';
        btn.setAttribute('aria-label', label);
        btn.title = label;
        btn.appendChild(createIcon(iconName, { size: 18 }));
        btn.addEventListener('click', onClick);
        return btn;
    }

    _touchMove(id, direction, isSubtask) {
        if (!this._isManualReorderActive()) return;
        let ok = false;
        if (isSubtask) {
            const sub = this.store.tasks.find(t => t.id === id);
            if (!sub) return;
            const siblings = this.store.subsOf(sub.parentId);
            const idx = siblings.findIndex(s => s.id === id);
            if (direction === 'up') {
                if (idx <= 0) return;
                ok = this.store.moveToParent(id, sub.parentId, siblings[idx - 1].id);
            } else {
                if (idx < 0 || idx >= siblings.length - 1) return;
                const beforeId = idx + 2 < siblings.length ? siblings[idx + 2].id : null;
                ok = this.store.moveToParent(id, sub.parentId, beforeId);
            }
        } else {
            const parents = this.store.tasks.filter(t => t.parentId === null);
            const idx = parents.findIndex(p => p.id === id);
            if (idx < 0) return;
            const newIdx = direction === 'up' ? idx - 1 : idx + 1;
            if (newIdx < 0 || newIdx >= parents.length) return;
            this.store.move(idx, newIdx);
            ok = true;
        }
        if (ok) {
            this.renderTasks();
            const moved = DOM.list.querySelector(`.grocery-item[data-id="${id}"]`);
            if (moved) moved.focus?.();
        }
    }

    _touchPromote(id) {
        const sub = this.store.tasks.find(t => t.id === id);
        if (!sub || sub.parentId === null) return;
        const ok = this.store.moveToParent(id, null, sub.parentId);
        if (ok) {
            this.renderTasks();
            this.displayAlert('Promovida a tarea principal', 'success');
            const moved = DOM.list.querySelector(`.grocery-item[data-id="${id}"]`);
            if (moved) moved.focus?.();
        }
    }

    // ****** FUNCIONES DE RENDERIZADO **********

    renderTasks() {
        // Limpia entradas obsoletas del Set de colapsados antes del render.
        this._pruneCollapsedSet();
        // La paginación cuenta sólo PADRES; cada padre arrastra a sus subs.
        const filteredParents = this._filteredParents();
        const totalPages = Math.max(1, Math.ceil(filteredParents.length / this.pageSize));
        if (this.currentPage > totalPages) this.currentPage = totalPages;
        const start = (this.currentPage - 1) * this.pageSize;
        const pageParents = filteredParents.slice(start, start + this.pageSize);

        // Expandimos cada padre con sus subs en orden.
        const pageItems = [];
        for (const parent of pageParents) {
            pageItems.push(parent);
            for (const sub of this.store.subsOf(parent.id)) pageItems.push(sub);
        }

        this._renderList(pageItems);
        this._renderPagination(totalPages);
        this.updateTaskCount(filteredParents.length);
        this._updateBulkCollapseVisibility();
        this._updateSearchVisibility();
        this._updateElapsed();
    }

    _updateSearchVisibility() {
        if (!DOM.searchRow) return;
        const totalParents = this.store.tasks.filter(t => t.parentId === null).length;
        const shouldShow = totalParents > SEARCH_VISIBILITY_THRESHOLD;
        DOM.searchRow.hidden = !shouldShow;
        if (!shouldShow && this.searchQuery) {
            this.searchQuery = '';
            if (DOM.searchInput) DOM.searchInput.value = '';
        }
    }

    _updateBulkCollapseVisibility() {
        if (!DOM.bulkCollapseRoot) return;
        const hasAny = this._parentsWithSubs().length > 0;
        DOM.bulkCollapseRoot.hidden = !hasAny;
    }

    _pruneCollapsedSet() {
        // Limpia entradas obsoletas: padres en el Set que ya no tienen
        // subs (porque se movieron afuera o se borraron).
        const valid = new Set(this._parentsWithSubs());
        let changed = false;
        for (const id of [...this.collapsedParents]) {
            if (!valid.has(id)) {
                this.collapsedParents.delete(id);
                changed = true;
            }
        }
        if (changed) saveCollapsed(this.collapsedParents);
    }

    _filteredParents() {
        // Sort sólo aplica a padres; el filtro también sólo aplica a padres.
        const ordered = this.store.getOrderedTasks(this.sortBy);
        let parents = ordered.filter(t => t.parentId === null);
        if (this.filterMode === 'done') parents = parents.filter(t => t.done);
        else if (this.filterMode === 'pending') parents = parents.filter(t => !t.done);
        else if (this.filterMode === 'today') {
            const today = todayISO();
            parents = parents.filter(t => t.dueDate === today);
        }
        else if (this.filterMode === 'week') {
            // Próximos 7 días (incluye hoy). Solo tareas con dueDate.
            const today = todayISO();
            const t = new Date();
            t.setDate(t.getDate() + 7);
            const end = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
            parents = parents.filter(p => p.dueDate && p.dueDate >= today && p.dueDate <= end);
        }
        else if (this.filterMode === 'priority') parents = parents.filter(t => !!t.priority);
        // Búsqueda: substring case-insensitive en el value del padre o
        // de cualquiera de sus subs. Match en sub también muestra al
        // padre completo para preservar el contexto.
        if (this.searchQuery) {
            const q = this.searchQuery;
            parents = parents.filter(p => {
                if (p.value.toLowerCase().includes(q)) return true;
                return this.store.subsOf(p.id).some(s => s.value.toLowerCase().includes(q));
            });
        }
        return parents;
    }

    _renderList(items) {
        DOM.list.innerHTML = '';
        if (items.length > 0) {
            // Group titles temporales (Fase F8): cuando filter='all' o
            // 'pending', subdivide pendientes por urgencia según dueDate.
            // Subs van dentro de un wrapper .m-subs que renderiza una guía
            // vertical en árbol (Fase F-tree) y al final el form
            // "+ subtarea".
            let lastGroup = null;
            let currentSubsWrap = null;
            let currentParentId = null;
            const showGroups = ['all', 'pending'].includes(this.filterMode);

            // Renderiza el wrapper .m-subs SOLO si tiene contenido (subs
            // existentes o form expanded por el usuario). Sin contenido,
            // el wrapper (y su guía árbol) no se inserta — items sin
            // subtareas quedan limpios.
            const closeSubsWrap = () => {
                if (currentSubsWrap && currentParentId) {
                    const expanded = this._showAddSubFor.has(currentParentId);
                    if (expanded) {
                        currentSubsWrap.appendChild(this._buildSubtaskAddForm(currentParentId));
                    }
                    if (currentSubsWrap.children.length > 0) {
                        DOM.list.appendChild(currentSubsWrap);
                    }
                }
                currentSubsWrap = null;
                currentParentId = null;
            };

            items.forEach(item => {
                if (item.parentId === null) {
                    closeSubsWrap();
                    if (showGroups) {
                        const group = this._groupOf(item);
                        if (group !== lastGroup) {
                            const title = document.createElement('div');
                            title.className = 'group-title';
                            title.textContent = group;
                            DOM.list.appendChild(title);
                            lastGroup = group;
                        }
                    }
                    DOM.list.appendChild(this.createListItem(item));
                    currentParentId = item.id;
                    currentSubsWrap = document.createElement('div');
                    currentSubsWrap.className = 'm-subs';
                    if (this.collapsedParents.has(item.id)) {
                        currentSubsWrap.classList.add('is-collapsed');
                    }
                    if (this._showAddSubFor.has(item.id)) {
                        currentSubsWrap.classList.add('is-add-expanded');
                    }
                    currentSubsWrap.dataset.parentId = item.id;
                } else {
                    if (currentSubsWrap) {
                        currentSubsWrap.appendChild(this.createListItem(item));
                    } else {
                        // Fallback: sub sin padre visible — al list directo.
                        DOM.list.appendChild(this.createListItem(item));
                    }
                }
            });
            closeSubsWrap();
            DOM.container.classList.add('show-container');
        } else {
            // Empty state: cuando un filter (Hoy/Semana/Prioridad/Hechas/etc)
            // devuelve cero matches Y la app NO está vacía, mostramos un mensaje.
            // Si la app entera está vacía, ocultamos el container como antes.
            const totalParents = this.store.tasks.filter(t => t.parentId === null).length;
            if (totalParents === 0) {
                DOM.container.classList.remove('show-container');
            } else {
                const empty = document.createElement('div');
                empty.className = 'empty-state';
                empty.textContent = this._emptyStateMessage();
                DOM.list.appendChild(empty);
                DOM.container.classList.add('show-container');
            }
        }
    }

    _emptyStateMessage() {
        switch (this.filterMode) {
            case 'today':    return 'No hay tareas con fecha de hoy.';
            case 'week':     return 'No hay tareas para los próximos 7 días.';
            case 'priority': return 'No hay tareas marcadas como prioritarias.';
            case 'done':     return 'No hay tareas hechas.';
            case 'pending':  return 'Todo terminado. No hay pendientes.';
            default:
                return this.searchQuery
                    ? 'Sin resultados para tu búsqueda.'
                    : 'No hay tareas para mostrar.';
        }
    }

    /**
     * Devuelve el nombre del grupo temporal al que pertenece una tarea
     * top-level, según su done y dueDate vs hoy.
     */
    _groupOf(task) {
        if (task.done) return 'Hechas';
        if (!task.dueDate) return 'Sin fecha';
        const today = todayISO();
        if (task.dueDate < today) return 'Vencidas';
        if (task.dueDate === today) return 'Hoy';
        // Próxima semana = los próximos 6 días.
        const t = new Date();
        t.setDate(t.getDate() + 7);
        const weekEnd = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
        if (task.dueDate <= weekEnd) return 'Esta semana';
        return 'Próximamente';
    }

    _renderPagination(totalPages) {
        const nav = DOM.paginationNav;
        nav.replaceChildren();
        if (totalPages <= 1) {
            nav.hidden = true;
            return;
        }
        nav.hidden = false;

        // Anterior — sólo si current > 1.
        if (this.currentPage > 1) {
            nav.append(this._buildPageNav('prev', this.currentPage - 1));
        }

        const items = paginate(totalPages, this.currentPage);
        const list = document.createElement('ul');
        list.className = 'page-list';
        for (const item of items) {
            const li = document.createElement('li');
            if (item === ELLIPSIS) {
                li.className = 'page-ellipsis';
                li.setAttribute('aria-hidden', 'true');
                li.textContent = '…';
            } else {
                const isCurrent = item === this.currentPage;
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'page-num';
                btn.textContent = String(item);
                if (isCurrent) {
                    btn.classList.add('is-current');
                    btn.disabled = true;
                    btn.setAttribute('aria-current', 'page');
                } else {
                    btn.setAttribute('aria-label', `Ir a la página ${item}`);
                    btn.addEventListener('click', () => this.handlePageClick(item));
                }
                li.appendChild(btn);
            }
            list.appendChild(li);
        }
        nav.appendChild(list);

        // Siguiente — sólo si current < totalPages.
        if (this.currentPage < totalPages) {
            nav.append(this._buildPageNav('next', this.currentPage + 1));
        }
    }

    _buildPageNav(direction, targetPage) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `page-${direction}`;
        const isPrev = direction === 'prev';
        btn.setAttribute('aria-label', isPrev ? 'Página anterior' : 'Página siguiente');
        if (isPrev) {
            btn.append(createIcon('chevron-left', { size: 16 }));
            btn.append(this._navLabel('Anterior'));
        } else {
            btn.append(this._navLabel('Siguiente'));
            btn.append(createIcon('chevron-right', { size: 16 }));
        }
        btn.addEventListener('click', () => this.handlePageClick(targetPage));
        return btn;
    }

    _navLabel(text) {
        const span = document.createElement('span');
        span.className = 'page-nav-label';
        span.textContent = text;
        return span;
    }

    createListItem(task) {
        const { id, value, done, parentId } = task;
        const isSubtask = parentId !== null;

        const element = document.createElement('article');
        // Clases dobles: viejas (para selectores JS legacy) + nuevas (para
        // CSS del rediseño). Fase 7D mantiene compat hasta que se
        // refactoricen los selectores JS en otra pasada.
        element.classList.add('grocery-item', 'task');
        if (isSubtask) {
            element.classList.add('is-subtask', 'is-sub');
            element.dataset.parentId = parentId;
            if (this.collapsedParents.has(parentId)) {
                element.classList.add('is-collapsed');
            }
        }
        element.dataset.id = id;
        element.dataset.done = String(done);
        if (done) element.classList.add('done', 'is-done');

        // Drag-and-drop en modo manual sin filtro:
        //   - dragstart/dragend van en cada item (cycle del drag).
        //   - dragover/dragleave/drop están delegados al contenedor (.grocery-list)
        //     para resolver gaps entre bloques con geometría.
        if (this._isManualReorderActive()) {
            element.draggable = true;
            element.classList.add('is-draggable');
            element.addEventListener('dragstart', this.handleDragStart.bind(this));
            element.addEventListener('dragend', this.handleDragEnd.bind(this));
            element.tabIndex = 0;
            if (isSubtask) {
                element.addEventListener('keydown', this.handleSubKeyDown.bind(this));
            } else {
                element.addEventListener('keydown', this.handleManualKeyDown.bind(this));
            }
        }

        const elapsedText = formatElapsed(elapsedComponents(parseInt(id)));

        // Toggle (izquierda). El círculo sale del CSS border de .toggle-check;
        // el SVG check es invisible cuando aria-pressed=false (color: transparent
        // en components.css) y aparece animado al marcar.
        const toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.className = 'toggle-check';
        toggleBtn.setAttribute('aria-pressed', String(!!done));
        toggleBtn.setAttribute('aria-label', done ? 'Marcar como pendiente' : 'Marcar como hecha');
        toggleBtn.appendChild(createIcon('check', { size: 14, className: 'toggle-icon' }));

        // Título + (opcional) contador de subs.
        const title = document.createElement('p');
        title.classList.add('title', 'task__title');
        title.textContent = value;
        // Doble-click sobre el título activa edición inline. Solo en
        // desktop: en touch el browser interpreta el doble-tap como zoom
        // y el handler es poco confiable; ahí el lápiz es el único trigger.
        if (!this._isPrimaryTouch()) {
            title.addEventListener('dblclick', () => this._enterEditMode(element));
        }
        if (!isSubtask) {
            const subs = this.store.subsOf(id);
            if (subs.length > 0) {
                const counter = document.createElement('span');
                counter.className = 'subtask-counter task__counter';
                const doneCount = subs.filter(s => s.done).length;
                counter.textContent = ` (${doneCount}/${subs.length})`;
                title.appendChild(counter);
            }
        }

        // Bloque title + elapsed (estilo m-task__head del mockup):
        // wrapper que agrupa visualmente el título arriba y el elapsed
        // pequeño debajo. Permite que el grid 3-col del item ponga este
        // bloque en la columna central.
        const titleBlock = document.createElement('div');
        titleBlock.className = 'task__title-block';

        const daysSpan = document.createElement('span');
        daysSpan.className = 'task-days-old task__elapsed';
        daysSpan.textContent = elapsedText;

        // Badge de due-date — solo padres con dueDate asignada.
        if (!isSubtask && task.dueDate) {
            const today = todayISO();
            if (task.dueDate === today) element.classList.add('is-due-today');
            else if (task.dueDate < today) element.classList.add('is-overdue');
            const due = document.createElement('span');
            due.className = 'task__due-badge';
            due.textContent = task.dueDate;
            daysSpan.appendChild(document.createTextNode(' · '));
            daysSpan.appendChild(due);
        }
        // Star inline al lado del título si task.priority.
        if (!isSubtask && task.priority) {
            element.classList.add('is-priority');
            const starInline = createIcon('star', { size: 12, className: 'task__priority-mark' });
            title.appendChild(document.createTextNode(' '));
            title.appendChild(starInline);
        }

        titleBlock.append(title, daysSpan);

        // Botón star (priority): solo padres. Toggle el flag.
        let priorityBtn = null;
        let dueBtn = null;
        if (!isSubtask) {
            priorityBtn = document.createElement('button');
            priorityBtn.type = 'button';
            priorityBtn.className = 'priority-btn btn-icon btn-icon--sm';
            if (task.priority) priorityBtn.classList.add('is-priority');
            priorityBtn.setAttribute('aria-label', task.priority ? 'Quitar prioridad' : 'Marcar prioridad');
            priorityBtn.setAttribute('aria-pressed', task.priority ? 'true' : 'false');
            priorityBtn.appendChild(createIcon('star'));
            priorityBtn.addEventListener('click', () => {
                this.store.togglePriority(id);
                this.renderTasks();
            });
            // Botón calendar (due-date): solo padres. Click abre input date
            // dinámico que hace setDueDate/clear. Si ya tiene fecha, badge
            // visible cerca del título y sub.
            dueBtn = document.createElement('button');
            dueBtn.type = 'button';
            dueBtn.className = 'due-btn btn-icon btn-icon--sm';
            if (task.dueDate) dueBtn.classList.add('is-due');
            dueBtn.setAttribute('aria-label', task.dueDate ? `Fecha: ${task.dueDate}` : 'Asignar fecha');
            dueBtn.appendChild(createIcon('calendar'));
            dueBtn.addEventListener('click', () => this._editDueDate(id));
        }

        // Botón addsub (plus/minus): solo padres. Toggle el form
        // "+ subtarea" en el wrapper .m-subs. El plus se vuelve minus
        // cuando el form está visible.
        let addSubBtn = null;
        if (!isSubtask) {
            const expanded = this._showAddSubFor.has(id);
            addSubBtn = document.createElement('button');
            addSubBtn.type = 'button';
            addSubBtn.className = 'addsub-btn btn-icon btn-icon--sm';
            if (expanded) addSubBtn.classList.add('is-expanded');
            addSubBtn.setAttribute('aria-label', expanded ? 'Cerrar agregar subtarea' : 'Agregar subtarea');
            addSubBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
            addSubBtn.appendChild(createIcon(expanded ? 'minus-circle' : 'plus-circle'));
            addSubBtn.addEventListener('click', () => {
                // Comportamiento exclusivo: solo UN form '+ subtarea' abierto
                // a la vez. Click en otro padre cierra el actual y abre el
                // nuevo. Click en el mismo padre toggla off.
                const wasExpanded = this._showAddSubFor.has(id);
                this._showAddSubFor.clear();
                if (!wasExpanded) this._showAddSubFor.add(id);
                this.renderTasks();
            });
        }

        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'edit-btn btn-icon btn-icon--sm';
        editBtn.setAttribute('aria-label', 'Editar tarea');
        editBtn.appendChild(createIcon('pencil'));

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'delete-btn btn-icon btn-icon--sm btn-icon--danger';
        deleteBtn.setAttribute('aria-label', 'Eliminar tarea');
        deleteBtn.appendChild(createIcon('trash'));

        const actionGroup = document.createElement('div');
        actionGroup.className = 'action-group task__actions';
        const touchControls = this._buildTouchMoveControls(task, isSubtask);
        const extras = [];
        if (dueBtn) extras.push(dueBtn);
        if (priorityBtn) extras.push(priorityBtn);
        if (addSubBtn) extras.push(addSubBtn);
        actionGroup.append(...touchControls, ...extras, editBtn, deleteBtn);

        const meta = document.createElement('div');
        meta.className = 'meta';
        meta.append(actionGroup);

        // Padres llevan un chevron al inicio si tienen subs (placeholder
        // si no). El input para agregar subtarea NO va más dentro del
        // padre — se renderiza después de las subs como sibling vía
        // _renderList (estilo .m-subs del mockup).
        if (!isSubtask) {
            const hasSubs = this.store.subsOf(id).length > 0;
            const subSlot = hasSubs ? this._buildSubtaskCollapseBtn(id) : this._buildSubtaskCollapsePlaceholder();
            element.append(subSlot, toggleBtn, titleBlock, meta);
        } else {
            element.append(toggleBtn, titleBlock, meta);
        }

        toggleBtn.addEventListener('click', this.handleMarkTaskAsDone.bind(this));
        deleteBtn.addEventListener('click', this.handleDeleteItem.bind(this));
        editBtn.addEventListener('click', this.handleEditItem.bind(this));

        return element;
    }

    _buildSubtaskAddForm(parentId) {
        const form = document.createElement('form');
        form.className = 'subtask-add-form';
        form.dataset.parentId = parentId;

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'subtask-add-input field';
        input.placeholder = '+ Subtarea';
        input.setAttribute('aria-label', 'Agregar subtarea');

        form.appendChild(input);
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const value = input.value.trim();
            if (!value) return;
            this.store.addSubtask(parentId, value);
            input.value = '';
            // Auto-expandir si estaba colapsado: si no, la sub nueva queda invisible.
            this._expandParent(parentId);
            this.currentPage = 1;
            this.renderTasks();
            this.displayAlert('Subtarea agregada', 'success');
        });
        return form;
    }

    _buildSubtaskCollapsePlaceholder() {
        const span = document.createElement('span');
        span.className = 'subtask-collapse-placeholder';
        span.setAttribute('aria-hidden', 'true');
        return span;
    }

    _buildSubtaskCollapseBtn(parentId) {
        const isCollapsed = this.collapsedParents.has(parentId);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'subtask-collapse-btn';
        btn.dataset.parentId = parentId;
        btn.setAttribute('aria-expanded', String(!isCollapsed));
        btn.setAttribute('aria-label', isCollapsed ? 'Expandir subtareas' : 'Contraer subtareas');
        btn.appendChild(createIcon(isCollapsed ? 'chevron-right' : 'chevron-down', { size: 14 }));
        btn.addEventListener('click', this.handleSubtaskToggleCollapse.bind(this));
        btn.addEventListener('keydown', this.handleSubtaskToggleKeyDown.bind(this));
        return btn;
    }

    // ****** UTILIDADES **********

    displayAlert(text, type) {
        // Delegado al ToastManager — el método se conserva como fachada
        // para no tocar todos los call sites.
        this.toast.show(text, type);
    }

    updateTaskCount(filteredCount) {
        if (DOM.taskCountDisplay) {
            let label = 'Total';
            if (this.filterMode === 'done') label = 'Completadas';
            else if (this.filterMode === 'pending') label = 'Pendientes';
            else if (this.filterMode === 'today') label = 'Hoy';
            else if (this.filterMode === 'priority') label = 'Prioridad';
            DOM.taskCountDisplay.textContent = `Tareas: ${label}: ${filteredCount}`;
        }
        if (DOM.mToolbarCount) {
            DOM.mToolbarCount.innerHTML = `<strong>${filteredCount}</strong> tareas`;
        }
        // Header mobile (Fase F1 + dinámico): título refleja el filter activo,
        // subtítulo muestra "X de Y · DD mes" con stats globales y fecha.
        if (DOM.appTitleMain) {
            const titles = {
                all: 'Todas', pending: 'Pendientes', done: 'Hechas',
                today: 'Hoy', week: 'Esta semana', priority: 'Prioridad',
            };
            DOM.appTitleMain.textContent = titles[this.filterMode] || 'Tareas';
        }
        if (DOM.appTitleSub) {
            const allParents = this.store.tasks.filter(t => t.parentId === null);
            const doneCount = allParents.filter(p => p.done).length;
            const today = new Date();
            const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
            const dateStr = `${today.getDate()} ${months[today.getMonth()]}`;
            DOM.appTitleSub.textContent = `${doneCount} de ${allParents.length} · ${dateStr}`;
        }
    }
}

// Inicializa la aplicación cuando el DOM esté cargado
document.addEventListener('DOMContentLoaded', () => {
    const store = new TaskStore(new LocalStorageAdapter('list'));
    new TaskManager(store);
});
