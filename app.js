import { TaskStore, LocalStorageAdapter } from './taskStore.js';

// ****** SELECTORES DE ELEMENTOS **********
const DOM = {
    alert: document.querySelector('.alert1'),
    form: document.querySelector('.grocery-form'),
    groceryInput: document.getElementById('grocery'),
    submitBtn: document.querySelector('.submit-btn'),
    container: document.querySelector('.grocery-container'),
    list: document.querySelector('.grocery-list'),
    clearBtn: document.querySelector('.clear-btn'),
    taskFilter: document.getElementById('taskFilter'),
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
        this.setupEventListeners();
        this.renderTasks();
    }

    setupEventListeners() {
        DOM.form.addEventListener('submit', this.handleAddItem.bind(this));
        DOM.clearBtn.addEventListener('click', this.handleClearItems.bind(this));
        DOM.taskFilter.addEventListener('change', this.handleFilterChange.bind(this));
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
        const value = DOM.taskFilter.value;
        if (value === 'done') this.renderFilteredTasks(true);
        else if (value === 'pending') this.renderFilteredTasks(false);
        else this.renderTasks();
    }

    handleMarkTaskAsDone(e) {
        const element = e.currentTarget.closest('.grocery-item');
        const id = element.dataset.id;
        const isDone = element.dataset.done !== "true";

        element.classList.toggle("done", isDone);
        element.dataset.done = String(isDone);
        e.currentTarget.checked = isDone;

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
        DOM.submitBtn.textContent = "Editar";
    }

    // ****** FUNCIONES DE RENDERIZADO **********

    renderTasks() {
        this._renderList(this.store.tasks);
        this.updateTaskCount();
    }

    renderFilteredTasks(showDone) {
        this._renderList(this.store.filter(showDone));
        this.updateTaskCount(showDone);
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

        const daysOld = TaskStore.daysSinceCreation(id);
        const daysText = daysOld === 0 ? 'Hoy' : (daysOld === 1 ? '1 día' : `${daysOld} días`);

        // Construimos los nodos en lugar de usar innerHTML para evitar XSS:
        // 'value' viene del input del usuario y se asigna por textContent.
        const title = document.createElement('p');
        title.classList.add('title');
        title.textContent = value;

        const btnContainer = document.createElement('div');
        btnContainer.className = 'btn-container form-check form-switch';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'form-check-input';
        checkbox.checked = !!done;

        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'edit-btn';
        editBtn.setAttribute('aria-label', 'Editar tarea');
        const editIcon = document.createElement('i');
        editIcon.className = 'fas fa-edit';
        const editFallback = document.createElement('span');
        editFallback.className = 'fa-fallback';
        editFallback.textContent = '✎';
        editIcon.appendChild(editFallback);
        editBtn.appendChild(editIcon);

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'delete-btn';
        deleteBtn.setAttribute('aria-label', 'Eliminar tarea');
        const deleteIcon = document.createElement('i');
        deleteIcon.className = 'fas fa-trash';
        const deleteFallback = document.createElement('span');
        deleteFallback.className = 'fa-fallback';
        deleteFallback.textContent = '🗑';
        deleteIcon.appendChild(deleteFallback);
        deleteBtn.appendChild(deleteIcon);

        const daysSpan = document.createElement('span');
        daysSpan.className = 'task-days-old';
        daysSpan.textContent = daysText;

        btnContainer.append(checkbox, editBtn, deleteBtn, daysSpan);
        element.append(title, btnContainer);

        deleteBtn.addEventListener('click', this.handleDeleteItem.bind(this));
        editBtn.addEventListener('click', this.handleEditItem.bind(this));
        checkbox.addEventListener('change', this.handleMarkTaskAsDone.bind(this));

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
        DOM.submitBtn.textContent = "Agregar";
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
