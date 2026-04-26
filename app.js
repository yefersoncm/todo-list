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
        this.editElement = null;
        this.editFlag = false;
        this.editID = "";
        this._elapsedProbe = null;     // span oculto para medir el texto más largo
        this._elapsedTicker = null;    // id del setInterval
        this.filterMode = 'all';       // 'all' | 'done' | 'pending'
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
        this.setSubmitMode('add');
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

    setSubmitMode(mode) {
        const isEdit = mode === 'edit';
        // En edit usamos 'pencil' — el mismo icono del botón Editar de
        // cada tarea, para mantener coherencia visual del verbo.
        DOM.submitIcon.replaceChildren(createIcon(isEdit ? 'pencil' : 'plus', { size: 16, className: 'icon' }));
        DOM.submitLabel.textContent = isEdit ? 'Editar' : 'Agregar';
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
    }

    // ****** MANEJADORES DE EVENTOS **********

    handleAddItem(e) {
        e.preventDefault();
        const value = DOM.groceryInput.value;
        if (value.trim() === "") {
            this.displayAlert("Por favor ingrese un valor", "danger");
            return;
        }

        if (this.editFlag) {
            this.store.update(this.editID, value);
            this.displayAlert("Valor cambiado", "success");
        } else {
            this.store.add(value);
            this.displayAlert("Item agregado a la lista", "success");
        }
        this.currentPage = 1;
        this.renderTasks();
        this.setBackToDefault();
    }

    async handleClearItems() {
        if (this.store.isEmpty()) {
            this.displayAlert("La lista ya está vacía", "danger");
            return;
        }
        const ok = await confirmDialog("¿Estás seguro de que quieres limpiar toda la lista?");
        if (!ok) return;
        this.store.clear();
        this.currentPage = 1;
        this.renderTasks();
        this.displayAlert("Lista vacía", "danger");
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
        this.setBackToDefault();
    }

    handleEditItem(e) {
        const element = e.currentTarget.closest('.grocery-item');
        this.editElement = element.querySelector('.title');
        DOM.groceryInput.value = this.editElement.textContent;
        this.editFlag = true;
        this.editID = element.dataset.id;
        this.setSubmitMode('edit');
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
        el.classList.add('is-dragging');
        e.dataTransfer.effectAllowed = 'move';
        // Algunos browsers requieren que escribamos algo a dataTransfer
        // para que el drag sea válido; el id real lo guardamos en una
        // propiedad de instancia porque dragover no permite leer
        // dataTransfer en Chromium.
        e.dataTransfer.setData('text/plain', id);
        // Mostrar el promote zone sólo cuando arrastramos una sub.
        if (this._draggingIsSub && DOM.promoteZone) {
            DOM.promoteZone.hidden = false;
        }
    }

    handleDragOver(e) {
        if (!this._draggingId) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const target = e.currentTarget;
        if (target.dataset.id === this._draggingId) return;
        // Source = sub → siempre nest. Source = parent → reorder.
        if (this._draggingIsSub) {
            target.classList.add('is-drop-nest');
        } else {
            target.classList.add('is-drop-target');
        }
    }

    handleDragLeave(e) {
        e.currentTarget.classList.remove('is-drop-target', 'is-drop-nest');
    }

    handleDrop(e) {
        e.preventDefault();
        e.currentTarget.classList.remove('is-drop-target', 'is-drop-nest');
        const fromId = this._draggingId;
        const toId = e.currentTarget.dataset.id;
        const wasSub = this._draggingIsSub;
        this._draggingId = null;
        this._draggingIsSub = false;
        if (!fromId || fromId === toId) return;

        if (wasSub) {
            // Sub → re-parent. El target puede ser un padre (nestear ahí)
            // o una sub (entonces nesteamos al padre de esa sub).
            const targetTask = this.store.tasks.find(t => t.id === toId);
            if (!targetTask) return;
            const newParentId = targetTask.parentId === null ? toId : targetTask.parentId;
            const ok = this.store.moveToParent(fromId, newParentId);
            if (ok) {
                this.currentPage = 1;
                this.renderTasks();
                this.displayAlert('Subtarea movida', 'success');
            }
        } else {
            // Parent → reorder. move() opera sobre índices de la lista
            // de PADRES, no de tasks completo (importante con subs intercaladas).
            const parents = this.store.tasks.filter(t => t.parentId === null);
            const fromIdx = parents.findIndex(p => p.id === fromId);
            const toIdx = parents.findIndex(p => p.id === toId);
            if (fromIdx < 0 || toIdx < 0) return;
            this.store.move(fromIdx, toIdx);
            this.renderTasks();
        }
    }

    handleDragEnd(e) {
        e.currentTarget.classList.remove('is-dragging');
        // Limpieza defensiva: si dragend dispara sin drop (cancelado),
        // dejamos los .is-drop-target/.is-drop-nest colgados — borramos.
        DOM.list.querySelectorAll('.grocery-item.is-drop-target, .grocery-item.is-drop-nest')
            .forEach(el => el.classList.remove('is-drop-target', 'is-drop-nest'));
        if (DOM.promoteZone) {
            DOM.promoteZone.classList.remove('is-drop-target');
            DOM.promoteZone.hidden = true;
        }
        this._draggingId = null;
        this._draggingIsSub = false;
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
        // (Subs no son keyboard-reordenables; siguen a su padre.)
        if (!e.altKey) return;
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        e.preventDefault();
        const id = e.currentTarget.dataset.id;
        // move() trabaja sobre la lista de PADRES, no sobre el array completo.
        const parents = this.store.tasks.filter(t => t.parentId === null);
        const idx = parents.findIndex(p => p.id === id);
        if (idx < 0) return;
        const newIdx = e.key === 'ArrowUp' ? idx - 1 : idx + 1;
        if (newIdx < 0 || newIdx >= parents.length) return;
        this.store.move(idx, newIdx);
        this.renderTasks();
        // Mantén el foco en la tarea movida.
        const moved = DOM.list.querySelector(`.grocery-item[data-id="${id}"]`);
        if (moved) moved.focus();
    }

    // ****** FUNCIONES DE RENDERIZADO **********

    renderTasks() {
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

    _filteredParents() {
        // Sort sólo aplica a padres; el filtro también sólo aplica a padres.
        const ordered = this.store.getOrderedTasks(this.sortBy);
        const parents = ordered.filter(t => t.parentId === null);
        if (this.filterMode === 'done') return parents.filter(t => t.done);
        if (this.filterMode === 'pending') return parents.filter(t => !t.done);
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
        //   - Padres son draggables (reorder + soporte para teclado Alt+↑/↓).
        //   - Subs son draggables (solo drop entre niveles: re-parent o promote).
        if (this._isManualReorderActive()) {
            element.draggable = true;
            element.classList.add('is-draggable');
            element.addEventListener('dragstart', this.handleDragStart.bind(this));
            element.addEventListener('dragover', this.handleDragOver.bind(this));
            element.addEventListener('dragleave', this.handleDragLeave.bind(this));
            element.addEventListener('drop', this.handleDrop.bind(this));
            element.addEventListener('dragend', this.handleDragEnd.bind(this));
            // Teclado de reordenamiento sólo aplica a padres.
            if (!isSubtask) {
                element.tabIndex = 0;
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
        // chevron al inicio si tienen al menos una sub.
        if (!isSubtask) {
            const hasSubs = this.store.subsOf(id).length > 0;
            const subToggle = hasSubs ? this._buildSubtaskCollapseBtn(id) : null;
            const subForm = this._buildSubtaskAddForm(id);
            if (subToggle) {
                element.append(subToggle, toggleBtn, title, subForm, meta);
            } else {
                element.append(toggleBtn, title, subForm, meta);
            }
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

    setBackToDefault() {
        DOM.groceryInput.value = "";
        this.editFlag = false;
        this.editID = '';
        this.editElement = null;
        this.setSubmitMode('add');
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
