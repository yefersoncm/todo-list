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
    // Nuevo selector para mostrar el número de tareas (opcional, pero útil)
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
            return; // Si el usuario cancela, no hacemos nada
        }
        this.clearAllTasks();
        this.displayAlert("Lista vacía", "danger");
    }

    handleToggleDoneTasks() {
        if (DOM.checkBoxCompletadas.checked) {
            DOM.checkBoxNoCompletadas.checked = false; // Desmarcar el otro checkbox
            this.renderFilteredTasks("true");
        } else {
            this.renderTasks();
        }
    }

    handleToggleUndoneTasks() {
        if (DOM.checkBoxNoCompletadas.checked) {
            DOM.checkBoxCompletadas.checked = false; // Desmarcar el otro checkbox
            this.renderFilteredTasks("false");
        } else {
            this.renderTasks();
        }
    }

    handleMarkTaskAsDone(e) {
        const element = e.currentTarget.closest('.grocery-item');
        const id = element.dataset.id;
        let isDone = element.dataset.done === "true";
        isDone = !isDone; // Toggle the status

        element.classList.toggle("done", isDone);
        element.dataset.done = String(isDone);
        e.currentTarget.checked = isDone; // Sincroniza el checkbox

        this.updateTaskStatus(id, String(isDone));
        this.displayAlert(isDone ? 'Tarea marcada como hecha' : 'Tarea pendiente', isDone ? 'success' : 'warning');
    }

    handleDeleteItem(e) {
        const element = e.currentTarget.closest('.grocery-item');
        const id = element.dataset.id;
        if (!confirm("¿Estás seguro de que quieres eliminar esta tarea?")) {
            return; // Si el usuario cancela, no hacemos nada
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
        const id = new Date().getTime().toString();
        const done = "false";
        const createdAt = new Date().toISOString(); // Guarda la fecha de creación en formato ISO
        this.tasks.push({ id, value, done, createdAt });
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
        DOM.list.innerHTML = ''; // Limpiar la lista existente
        if (this.tasks.length > 0) {
            this.tasks.forEach(item => this.createListItem(item.id, item.value, item.done, item.createdAt));
            DOM.container.classList.add('show-container');
        } else {
            DOM.container.classList.remove("show-container");
        }
        this.updateTaskCount(); // Actualizar el contador de tareas
    }

    renderFilteredTasks(status) {
        DOM.list.innerHTML = '';
        const filteredTasks = this.tasks.filter(task => task.done === status);
        if (filteredTasks.length > 0) {
            filteredTasks.forEach(item => this.createListItem(item.id, item.value, item.done, item.createdAt));
            DOM.container.classList.add('show-container');
        } else {
            DOM.container.classList.remove("show-container");
        }
        this.updateTaskCount(status); // Actualizar el contador de tareas filtradas
    }

    createListItem(id, value, done, createdAt) {
        const element = document.createElement('article');
        element.classList.add('grocery-item');
        element.dataset.id = id;
        element.dataset.done = done;

        const daysOld = this.getDaysSinceCreation(createdAt);
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
        DOM.checkBoxCompletadas.checked = false; // Asegurar que los filtros estén desmarcados
        DOM.checkBoxNoCompletadas.checked = false; // al volver a la vista por defecto
    }

    getDaysSinceCreation(createdAt) {
        if (!createdAt) return 'N/A'; // Manejar tareas antiguas sin fecha
        const creationDate = new Date(createdAt);
        const today = new Date();
        // Resetear horas para cálculo preciso de días
        creationDate.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);

        const diffTime = Math.abs(today.getTime() - creationDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    }

    updateTaskCount(filterStatus = null) {
        if (!DOM.taskCountDisplay) return; // Asegurarse de que el elemento exista

        let totalTasks = this.tasks.length;
        let completedTasks = this.tasks.filter(task => task.done === "true").length;
        let uncompletedTasks = totalTasks - completedTasks;

        let displayCount = totalTasks;
        let displayText = `Total: ${totalTasks}`;

        if (filterStatus === "true") {
            displayCount = completedTasks;
            displayText = `Completadas: ${completedTasks}`;
        } else if (filterStatus === "false") {
            displayCount = uncompletedTasks;
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
        // Separa las tareas completadas de las no completadas
        let doneTasks = this.tasks.filter(item => item.done === "true");
        let undoneTasks = this.tasks.filter(item => item.done === "false");

        // Ordena cada grupo por ID (asumiendo que el ID es un timestamp y sirve para ordenar por creación)
        // Opcional: ordenar también por createdAt si se prefiere
        doneTasks.sort((a, b) => parseInt(a.id) - parseInt(b.id));
        undoneTasks.sort((a, b) => parseInt(a.id) - parseInt(b.id));

        // Concatena primero las no completadas y luego las completadas
        this.tasks = undoneTasks.concat(doneTasks);
        localStorage.setItem('list', JSON.stringify(this.tasks));
    }
}

// Inicializa la aplicación cuando el DOM esté cargado
document.addEventListener('DOMContentLoaded', () => {
    new TaskManager();
});
