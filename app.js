import { TaskStore, LocalStorageAdapter, SORT_MODES } from './taskStore.js';
import { Combobox } from './combobox.js';
import { createIcon } from './icons.js';
import { elapsedComponents, formatElapsed } from './elapsed.js';
import { paginate, ELLIPSIS } from './pagination.js';
import { ToastManager } from './toast.js';

const PAGE_SIZE_KEY = 'todo-list:pageSize';
const VALID_PAGE_SIZES = [10, 20, 50, 100];
const DEFAULT_PAGE_SIZE = 10;

const SORT_BY_KEY = 'todo-list:sortBy';
const DEFAULT_SORT = 'created-desc';

const COLLAPSED_KEY = 'todo-list:collapsedParents';

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
    paginationNav: document.querySelector('.pagination'),
    taskCountDisplay: document.querySelector('.task-count'),
    toastContainer: document.getElementById('toastContainer'),
    confirmModal: document.getElementById('confirmModal'),
    confirmModalText: document.getElementById('confirmModalText'),
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
        this._elapsedProbe = null;     // span oculto para medir el texto más largo
        this._elapsedTicker = null;    // id del setInterval
        this.filterMode = 'all';       // 'all' | 'done' | 'pending'
        this.searchQuery = '';         // texto de búsqueda (no persistido)
        this.sortBy = loadSortBy();
        this.pageSize = loadPageSize();
        this.currentPage = 1;
        this.collapsedParents = loadCollapsed();
        this.toast = new ToastManager(DOM.toastContainer);
        this.filter = new Combobox(DOM.taskFilterRoot, {
            onChange: () => this.handleFilterChange(),
        });
        this.sortByCombo = new Combobox(DOM.sortByRoot, {
            onChange: (value) => this.handleSortChange(value),
        });
        this.sortByCombo.setValue(this.sortBy);
        this.pageSizeCombo = new Combobox(DOM.pageSizeRoot, {
            onChange: (value) => this.handlePageSizeChange(parseInt(value)),
        });
        this.pageSizeCombo.setValue(String(this.pageSize));
        this._mountStaticIcons();
        this.setupEventListeners();
        this.renderTasks();
        this._startElapsedTicker();
    }

    // ----- Tiempo transcurrido por tarea ------------------------------------

    _startElapsedTicker() {
        if (this._elapsedTicker) return;
        this._elapsedTicker = setInterval(() => this._updateElapsed(), 1000);
    }

    _ensureElapsedProbe() {
        if (this._elapsedProbe) return this._elapsedProbe;
        const probe = document.createElement('span');
        probe.className = 'task-days-old';
        probe.style.cssText = 'position:absolute;visibility:hidden;left:-9999px;top:0;min-width:0;white-space:nowrap;pointer-events:none;';
        document.body.appendChild(probe);
        this._elapsedProbe = probe;
        return probe;
    }

    _updateElapsed() {
        const items = DOM.list.querySelectorAll('.grocery-item');
        if (items.length === 0) {
            DOM.list.style.removeProperty('--elapsed-min-width');
            return;
        }
        const probe = this._ensureElapsedProbe();
        const now = new Date();
        let maxWidth = 0;
        for (const el of items) {
            const id = el.dataset.id;
            const span = el.querySelector('.task-days-old');
            if (!span) continue;
            const text = formatElapsed(elapsedComponents(parseInt(id), now));
            if (span.textContent !== text) span.textContent = text;
            probe.textContent = text;
            const w = probe.offsetWidth;
            if (w > maxWidth) maxWidth = w;
        }
        DOM.list.style.setProperty('--elapsed-min-width', `${maxWidth}px`);
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
        this.store.add(value);
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

    handleFilterChange() {
        this.filterMode = this.filter.value; // 'all' | 'done' | 'pending'
        this.currentPage = 1;
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
        // Actualiza el icono y aria-expanded sin re-renderizar todo —
        // así se ve la animación CSS al cambiar de clase.
        btn.setAttribute('aria-expanded', String(!isNowCollapsed));
        btn.setAttribute('aria-label', isNowCollapsed ? 'Expandir subtareas' : 'Contraer subtareas');
        btn.replaceChildren(createIcon(isNowCollapsed ? 'chevron-right' : 'chevron-down', { size: 14 }));
        // Toggle .is-collapsed en las subs del DOM con ese parentId.
        DOM.list.querySelectorAll(`.grocery-item.is-subtask[data-parent-id="${parentId}"]`)
            .forEach(el => el.classList.toggle('is-collapsed', isNowCollapsed));
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
        this._updateElapsed();
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
            items.forEach(item => this.createListItem(item));
            DOM.container.classList.add('show-container');
        } else {
            DOM.container.classList.remove("show-container");
        }
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
        element.classList.add('grocery-item');
        if (isSubtask) {
            element.classList.add('is-subtask');
            element.dataset.parentId = parentId;
            // Si el padre está colapsado, la sub se renderiza con
            // .is-collapsed (max-height 0 → invisible vía CSS).
            if (this.collapsedParents.has(parentId)) {
                element.classList.add('is-collapsed');
            }
        }
        element.dataset.id = id;
        element.dataset.done = String(done);
        if (done) element.classList.add('done');

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

        // Toggle (izquierda).
        const toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.className = 'toggle-btn';
        toggleBtn.setAttribute('aria-pressed', String(!!done));
        toggleBtn.setAttribute('aria-label', done ? 'Marcar como pendiente' : 'Marcar como hecha');
        toggleBtn.appendChild(createIcon(done ? 'circle-check' : 'circle', { size: 22, className: 'toggle-icon' }));

        // Título + (opcional) contador de subs.
        const title = document.createElement('p');
        title.classList.add('title');
        title.textContent = value;
        // Doble-click sobre el título activa edición inline.
        title.addEventListener('dblclick', () => this._enterEditMode(element));
        if (!isSubtask) {
            const subs = this.store.subsOf(id);
            if (subs.length > 0) {
                const counter = document.createElement('span');
                counter.className = 'subtask-counter';
                const doneCount = subs.filter(s => s.done).length;
                counter.textContent = ` (${doneCount}/${subs.length})`;
                title.appendChild(counter);
            }
        }

        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'edit-btn';
        editBtn.setAttribute('aria-label', 'Editar tarea');
        editBtn.appendChild(createIcon('pencil'));

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'delete-btn';
        deleteBtn.setAttribute('aria-label', 'Eliminar tarea');
        deleteBtn.appendChild(createIcon('trash'));

        const actionGroup = document.createElement('div');
        actionGroup.className = 'action-group';
        actionGroup.append(editBtn, deleteBtn);

        const daysSpan = document.createElement('span');
        daysSpan.className = 'task-days-old';
        daysSpan.textContent = elapsedText;

        const meta = document.createElement('div');
        meta.className = 'meta';
        meta.append(actionGroup, daysSpan);

        // Padres llevan input inline para agregar subtareas, y un
        // chevron al inicio si tienen al menos una sub. Cuando NO tienen
        // subs, en su lugar va un placeholder del mismo tamaño para
        // mantener alineación de columnas entre tareas con/sin chevron.
        if (!isSubtask) {
            const hasSubs = this.store.subsOf(id).length > 0;
            const subSlot = hasSubs ? this._buildSubtaskCollapseBtn(id) : this._buildSubtaskCollapsePlaceholder();
            const subForm = this._buildSubtaskAddForm(id);
            element.append(subSlot, toggleBtn, title, subForm, meta);
        } else {
            element.append(toggleBtn, title, meta);
        }

        toggleBtn.addEventListener('click', this.handleMarkTaskAsDone.bind(this));
        deleteBtn.addEventListener('click', this.handleDeleteItem.bind(this));
        editBtn.addEventListener('click', this.handleEditItem.bind(this));

        DOM.list.appendChild(element);
    }

    _buildSubtaskAddForm(parentId) {
        const form = document.createElement('form');
        form.className = 'subtask-add-form';
        form.dataset.parentId = parentId;

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'subtask-add-input';
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
        if (!DOM.taskCountDisplay) return;
        let label = 'Total';
        if (this.filterMode === 'done') label = 'Completadas';
        else if (this.filterMode === 'pending') label = 'Pendientes';
        DOM.taskCountDisplay.textContent = `Tareas: ${label}: ${filteredCount}`;
    }
}

// Inicializa la aplicación cuando el DOM esté cargado
document.addEventListener('DOMContentLoaded', () => {
    const store = new TaskStore(new LocalStorageAdapter('list'));
    new TaskManager(store);
});
