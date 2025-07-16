// ****** SELECTORES DE ELEMENTOS **********
const DOM = {
    alert: document.querySelector('.alert1'),
    form: document.querySelector('.grocery-form'),
    groceryInput: document.getElementById('grocery'),
    submitBtn: document.querySelector('.submit-btn'),
    container: document.querySelector('.grocery-container'),
    list: document.querySelector('.grocery-list'),
    clearBtn: document.querySelector('.clear-btn'),
    checkBoxCompletadas: document.querySelector('#checkBoxCompletadas'),
    checkBoxNoCompletadas: document.querySelector('#checkBoxNoCompletadas'),
    taskCountDisplay: document.querySelector('.task-count'),
};

// ****** ESTADO DE LA APLICACIÓN **********
let editElement = null;
let editFlag = false;
let editID = "";

// ****** CLASE/MÓDULO PARA GESTIÓN DE TAREAS **********
class TaskManager {
    constructor() {
        this.tasks = this.getLocalStorage();
        this.setupEventListeners();
        this.renderTasks(); // Carga inicial de tareas
    }

    // Inicializa todos los event listeners
    setupEventListeners() {
        DOM.form.addEventListener('submit', this.handleAddItem.bind(this));
        DOM.clearBtn.addEventListener('click', this.handleClearItems.bind(this));
        DOM.checkBoxCompletadas.addEventListener('change', this.handleToggleDoneTasks.bind(this));
        DOM.checkBoxNoCompletadas.addEventListener('change', this.handleToggleUndoneTasks.bind(this));
    }

    // ****** MANEJADORES DE EVENTOS **********

    handleAddItem(e) {
        e.preventDefault();
        const value = DOM.groceryInput.value;
        if (value.trim() === "") {
            this.displayAlert("Por favor ingrese un valor", "danger");
            return;
        }

        if (editFlag) {
            this.updateTask(editID, value);
        } else {
            this.addTask(value);
        }
        this.setBackToDefault();
    }

    handleClearItems() {
        if (this.tasks.length === 0) {
            this.displayAlert("La lista ya está vacía", "danger");
            return;
        }
        if (!confirm("¿Estás seguro de que quieres limpiar toda la lista?")) {
            return;
        }
        this.clearAllTasks();
        this.displayAlert("Lista vacía", "danger");
    }

    handleToggleDoneTasks() {
        if (DOM.checkBoxCompletadas.checked) {
            DOM.checkBoxNoCompletadas.checked = false;
            this.renderFilteredTasks("true");
        } else {
            this.renderTasks();
        }
    }

    handleToggleUndoneTasks() {
        if (DOM.checkBoxNoCompletadas.checked) {
            DOM.checkBoxCompletadas.checked = false;
            this.renderFilteredTasks("false");
        } else {
            this.renderTasks();
        }
    }

    handleMarkTaskAsDone(e) {
        const element = e.currentTarget.closest('.grocery-item');
        const id = element.dataset.id;
        let isDone = element.dataset.done === "true";
        isDone = !isDone;

        element.classList.toggle("done", isDone);
        element.dataset.done = String(isDone);
        e.currentTarget.checked = isDone;

        this.updateTaskStatus(id, String(isDone));
        this.displayAlert(isDone ? 'Tarea marcada como hecha' : 'Tarea pendiente', isDone ? 'success' : 'warning');
    }

    handleDeleteItem(e) {
        const element = e.currentTarget.closest('.grocery-item');
        const id = element.dataset.id;
        if (!confirm("¿Estás seguro de que quieres eliminar esta tarea?")) {
            return;
        }
        this.removeTask(id);
        this.displayAlert("Item eliminado", "danger");
        this.setBackToDefault();
    }

    handleEditItem(e) {
        const element = e.currentTarget.closest('.grocery-item');
        editElement = element.querySelector('.title');
        DOM.groceryInput.value = editElement.textContent;
        editFlag = true;
        editID = element.dataset.id;
        DOM.submitBtn.textContent = "Editar";
    }

    // ****** FUNCIONES DE GESTIÓN DE TAREAS **********

    addTask(value) {
        // El ID es el timestamp epoch, que ahora también representa la fecha de creación
        const id = new Date().getTime().toString();
        const done = "false";
        // Ya no necesitamos la propiedad 'createdAt' separada
        this.tasks.push({ id, value, done });
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

    renderFilteredTasks(status) {
        DOM.list.innerHTML = '';
        const filteredTasks = this.tasks.filter(task => task.done === status);
        if (filteredTasks.length > 0) {
            // Pasamos 'item.id' como 'creationTimestamp' para el cálculo de días
            filteredTasks.forEach(item => this.createListItem(item.id, item.value, item.done, item.id));
            DOM.container.classList.add('show-container');
        } else {
            DOM.container.classList.remove("show-container");
        }
        this.updateTaskCount(status);
    }

    // La función createListItem ahora usa 'creationTimestamp' (que es el ID)
    createListItem(id, value, done, creationTimestamp) {
        const element = document.createElement('article');
        element.classList.add('grocery-item');
        element.dataset.id = id;
        element.dataset.done = done;

        // Calcular días transcurridos usando el ID como timestamp
        const daysOld = this.getDaysSinceCreation(parseInt(creationTimestamp)); // Asegurarse de que sea un número
        const daysText = daysOld === 0 ? 'Hoy' : (daysOld === 1 ? '1 día' : `${daysOld} días`);

        element.innerHTML = `
            <p class="title">${value}</p>
            <div class="btn-container form-check form-switch">
                <input class="form-check-input" type="checkbox" ${done === "true" ? "checked" : ""}>
                <button type="button" class="edit-btn">
                    <i class="fas fa-edit"></i>
                </button>
                <button type="button" class="delete-btn">
                    <i class="fas fa-trash"></i>
                </button>
                <span class="task-days-old">${daysText}</span>
            </div>
        `;

        if (done === "true") {
            element.classList.add('done');
        } else {
            element.classList.remove('done');
        }

        element.querySelector('.delete-btn').addEventListener('click', this.handleDeleteItem.bind(this));
        element.querySelector('.edit-btn').addEventListener('click', this.handleEditItem.bind(this));
        element.querySelector('.form-check-input').addEventListener('change', this.handleMarkTaskAsDone.bind(this));

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
        editFlag = false;
        editID = '';
        editElement = null;
        DOM.submitBtn.textContent = "Agregar";
        DOM.checkBoxCompletadas.checked = false;
        DOM.checkBoxNoCompletadas.checked = false;
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

        let totalTasks = this.tasks.length;
        let completedTasks = this.tasks.filter(task => task.done === "true").length;
        let uncompletedTasks = totalTasks - completedTasks;

        let displayText = `Total: ${totalTasks}`;

        if (filterStatus === "true") {
            displayText = `Completadas: ${completedTasks}`;
        } else if (filterStatus === "false") {
            displayText = `Pendientes: ${uncompletedTasks}`;
        }

        DOM.taskCountDisplay.textContent = `Tareas: ${displayText}`;
    }

    // ****** LOCAL STORAGE **********

    getLocalStorage() {
        return localStorage.getItem("list")
            ? JSON.parse(localStorage.getItem("list"))
            : [];
    }

    sortAndSaveTasks() {
        let doneTasks = this.tasks.filter(item => item.done === "true");
        let undoneTasks = this.tasks.filter(item => item.done === "false");

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
