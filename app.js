import { TaskStore, LocalStorageAdapter } from './taskStore.js';
import { Combobox } from './combobox.js';
import { createIcon } from './icons.js';
import { elapsedComponents, formatElapsed } from './elapsed.js';

// ****** SELECTORES DE ELEMENTOS **********
const DOM = {
    alert: document.querySelector('.alert1'),
    form: document.querySelector('.grocery-form'),
    groceryInput: document.getElementById('grocery'),
    submitBtn: document.querySelector('.submit-btn'),
    submitIcon: document.querySelector('.submit-icon'),
    submitLabel: document.querySelector('.submit-label'),
    container: document.querySelector('.grocery-container'),
    list: document.querySelector('.grocery-list'),
    clearBtn: document.querySelector('.clear-btn'),
    taskFilterRoot: document.getElementById('taskFilter'),
    taskCountDisplay: document.querySelector('.task-count'),
    confirmModal: document.getElementById('confirmModal'),
    confirmModalText: document.getElementById('confirmModalText'),
};

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
        this.filter = new Combobox(DOM.taskFilterRoot, {
            onChange: () => this.handleFilterChange(),
        });
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
        this.renderTasks();
        this.displayAlert("Lista vacía", "danger");
    }

    handleFilterChange() {
        const value = this.filter.value;
        if (value === 'done') this.renderFilteredTasks(true);
        else if (value === 'pending') this.renderFilteredTasks(false);
        else this.renderTasks();
    }

    handleMarkTaskAsDone(e) {
        const button = e.currentTarget;
        const element = button.closest('.grocery-item');
        const id = element.dataset.id;
        const isDone = element.dataset.done !== "true";

        this.store.toggle(id, isDone);
        this.renderTasks();
        this.displayAlert(isDone ? 'Tarea marcada como hecha' : 'Tarea pendiente', isDone ? 'success' : 'warning');
    }

    async handleDeleteItem(e) {
        const element = e.currentTarget.closest('.grocery-item');
        const id = element.dataset.id;
        const ok = await confirmDialog("¿Estás seguro de que quieres eliminar esta tarea?");
        if (!ok) return;
        this.store.remove(id);
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

    // ****** FUNCIONES DE RENDERIZADO **********

    renderTasks() {
        this._renderList(this.store.tasks);
        this.updateTaskCount();
        this._updateElapsed();
    }

    renderFilteredTasks(showDone) {
        this._renderList(this.store.filter(showDone));
        this.updateTaskCount(showDone);
        this._updateElapsed();
    }

    _renderList(items) {
        DOM.list.innerHTML = '';
        if (items.length > 0) {
            items.forEach(item => this.createListItem(item.id, item.value, item.done));
            DOM.container.classList.add('show-container');
        } else {
            DOM.container.classList.remove("show-container");
        }
    }

    createListItem(id, value, done) {
        const element = document.createElement('article');
        element.classList.add('grocery-item');
        element.dataset.id = id;
        element.dataset.done = String(done);
        if (done) element.classList.add('done');

        const elapsedText = formatElapsed(elapsedComponents(parseInt(id)));

        // Botón de toggle (izquierda): círculo vacío / círculo con check.
        const toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.className = 'toggle-btn';
        toggleBtn.setAttribute('aria-pressed', String(!!done));
        toggleBtn.setAttribute('aria-label', done ? 'Marcar como pendiente' : 'Marcar como hecha');
        toggleBtn.appendChild(createIcon(done ? 'circle-check' : 'circle', { size: 22, className: 'toggle-icon' }));

        // Título — value viene del input del usuario, se asigna por textContent (anti-XSS).
        const title = document.createElement('p');
        title.classList.add('title');
        title.textContent = value;

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

        // Editar + eliminar agrupados como cluster de "meta-acciones".
        const actionGroup = document.createElement('div');
        actionGroup.className = 'action-group';
        actionGroup.append(editBtn, deleteBtn);

        const daysSpan = document.createElement('span');
        daysSpan.className = 'task-days-old';
        daysSpan.textContent = elapsedText;

        // Cluster derecho: acciones + metadata.
        const meta = document.createElement('div');
        meta.className = 'meta';
        meta.append(actionGroup, daysSpan);

        // Layout de la fila: toggle | title | meta
        element.append(toggleBtn, title, meta);

        toggleBtn.addEventListener('click', this.handleMarkTaskAsDone.bind(this));
        deleteBtn.addEventListener('click', this.handleDeleteItem.bind(this));
        editBtn.addEventListener('click', this.handleEditItem.bind(this));

        DOM.list.insertBefore(element, DOM.list.firstChild);
    }

    // ****** UTILIDADES **********

    displayAlert(text, action) {
        DOM.alert.textContent = text;
        DOM.alert.classList.add(`alert-${action}`);
        setTimeout(() => {
            DOM.alert.textContent = "";
            DOM.alert.classList.remove(`alert-${action}`);
        }, 1000);
    }

    setBackToDefault() {
        DOM.groceryInput.value = "";
        this.editFlag = false;
        this.editID = '';
        this.editElement = null;
        this.setSubmitMode('add');
    }

    updateTaskCount(filterStatus = null) {
        if (!DOM.taskCountDisplay) return;
        const { total, done, pending } = this.store.counts();

        let displayText = `Total: ${total}`;
        if (filterStatus === true) displayText = `Completadas: ${done}`;
        else if (filterStatus === false) displayText = `Pendientes: ${pending}`;

        DOM.taskCountDisplay.textContent = `Tareas: ${displayText}`;
    }
}

// Inicializa la aplicación cuando el DOM esté cargado
document.addEventListener('DOMContentLoaded', () => {
    const store = new TaskStore(new LocalStorageAdapter('list'));
    new TaskManager(store);
});
