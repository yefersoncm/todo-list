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
// Devuelve una promesa que resuelve a true/false.
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

// ****** CLASE/MÓDULO PARA GESTIÓN DE TAREAS **********
class TaskManager {
    constructor() {
        this.tasks = this.getLocalStorage();
        this.editElement = null;
        this.editFlag = false;
        this.editID = "";
        this.setupEventListeners();
        this.renderTasks(); // Carga inicial de tareas
    }

    // Inicializa todos los event listeners
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
            this.updateTask(this.editID, value);
        } else {
            this.addTask(value);
        }
        this.setBackToDefault();
    }

    async handleClearItems() {
        if (this.tasks.length === 0) {
            this.displayAlert("La lista ya está vacía", "danger");
            return;
        }
        const ok = await confirmDialog("¿Estás seguro de que quieres limpiar toda la lista?");
        if (!ok) return;
        this.clearAllTasks();
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

        this.updateTaskStatus(id, isDone);
        this.displayAlert(isDone ? 'Tarea marcada como hecha' : 'Tarea pendiente', isDone ? 'success' : 'warning');
    }

    async handleDeleteItem(e) {
        const element = e.currentTarget.closest('.grocery-item');
        const id = element.dataset.id;
        const ok = await confirmDialog("¿Estás seguro de que quieres eliminar esta tarea?");
        if (!ok) return;
        this.removeTask(id);
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

    // ****** FUNCIONES DE GESTIÓN DE TAREAS **********

    addTask(value) {
        // El ID es el timestamp epoch, que ahora también representa la fecha de creación
        const id = new Date().getTime().toString();
        // Ya no necesitamos la propiedad 'createdAt' separada
        this.tasks.push({ id, value, done: false });
        this.sortAndSaveTasks();
        this.displayAlert("Item agregado a la lista", "success");
        this.renderTasks();
    }

    updateTask(id, newValue) {
        this.tasks = this.tasks.map(item =>
            item.id === id ? { ...item, value: newValue } : item
        );
        this.sortAndSaveTasks();
        this.displayAlert("Valor cambiado", "success");
        this.renderTasks();
    }

    updateTaskStatus(id, doneStatus) {
        this.tasks = this.tasks.map(item =>
            item.id === id ? { ...item, done: doneStatus } : item
        );
        this.sortAndSaveTasks();
        this.renderTasks();
    }

    removeTask(id) {
        this.tasks = this.tasks.filter(item => item.id !== id);
        this.sortAndSaveTasks();
        this.renderTasks();
    }

    clearAllTasks() {
        this.tasks = [];
        this.sortAndSaveTasks();
        this.renderTasks();
    }

    // ****** FUNCIONES DE RENDERIZADO **********

    renderTasks() {
        DOM.list.innerHTML = '';
        if (this.tasks.length > 0) {
            // Pasamos 'item.id' como 'creationTimestamp' para el cálculo de días
            this.tasks.forEach(item => this.createListItem(item.id, item.value, item.done, item.id));
            DOM.container.classList.add('show-container');
        } else {
            DOM.container.classList.remove("show-container");
        }
        this.updateTaskCount();
    }

    renderFilteredTasks(showDone) {
        DOM.list.innerHTML = '';
        const filteredTasks = this.tasks.filter(task => task.done === showDone);
        if (filteredTasks.length > 0) {
            // Pasamos 'item.id' como 'creationTimestamp' para el cálculo de días
            filteredTasks.forEach(item => this.createListItem(item.id, item.value, item.done, item.id));
            DOM.container.classList.add('show-container');
        } else {
            DOM.container.classList.remove("show-container");
        }
        this.updateTaskCount(showDone);
    }

    // La función createListItem ahora usa 'creationTimestamp' (que es el ID)
    createListItem(id, value, done, creationTimestamp) {
        const element = document.createElement('article');
        element.classList.add('grocery-item');
        element.dataset.id = id;
        element.dataset.done = String(done);
        if (done) element.classList.add('done');

        // Calcular días transcurridos usando el ID como timestamp
        const daysOld = this.getDaysSinceCreation(parseInt(creationTimestamp));
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

    // ****** FUNCIONES DE UTILIDAD **********

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

    // `creationTimestamp` ahora es el ID de la tarea
    getDaysSinceCreation(creationTimestamp) {
        // Si la tarea es antigua y no tiene un ID basado en timestamp (epoch), o si el ID no es un número válido
        if (!creationTimestamp || isNaN(creationTimestamp)) return 'N/A';

        // Convertir el timestamp a un objeto Date
        const creationDate = new Date(creationTimestamp);
        const today = new Date();

        // Resetear horas para cálculo preciso de días (solo días completos)
        creationDate.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);

        const diffTime = Math.abs(today.getTime() - creationDate.getTime());
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)); // Usar Math.floor para días completos
        return diffDays;
    }

    updateTaskCount(filterStatus = null) {
        if (!DOM.taskCountDisplay) return;

        const totalTasks = this.tasks.length;
        const completedTasks = this.tasks.filter(task => task.done).length;
        const uncompletedTasks = totalTasks - completedTasks;

        let displayText = `Total: ${totalTasks}`;

        if (filterStatus === true) {
            displayText = `Completadas: ${completedTasks}`;
        } else if (filterStatus === false) {
            displayText = `Pendientes: ${uncompletedTasks}`;
        }

        DOM.taskCountDisplay.textContent = `Tareas: ${displayText}`;
    }

    // ****** LOCAL STORAGE **********

    getLocalStorage() {
        const raw = localStorage.getItem("list");
        if (!raw) return [];
        // Boundary: normaliza done a booleano por si vienen registros antiguos como "true"/"false"
        return JSON.parse(raw).map(item => ({
            ...item,
            done: item.done === true || item.done === "true",
        }));
    }

    sortAndSaveTasks() {
        const doneTasks = this.tasks.filter(item => item.done);
        const undoneTasks = this.tasks.filter(item => !item.done);

        // Ordena cada grupo por ID (timestamp) para mantener el orden de creación
        doneTasks.sort((a, b) => parseInt(a.id) - parseInt(b.id));
        undoneTasks.sort((a, b) => parseInt(a.id) - parseInt(b.id));

        // Concatena las tareas no completadas y luego las completadas
        this.tasks = undoneTasks.concat(doneTasks);
        localStorage.setItem('list', JSON.stringify(this.tasks));
    }
}

// Inicializa la aplicación cuando el DOM esté cargado
document.addEventListener('DOMContentLoaded', () => {
    new TaskManager();
});
