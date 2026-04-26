/*
 * TaskStore — lógica pura de gestión de tareas, sin DOM.
 * Aceptará cualquier adapter con get()/set() para que sea testeable
 * sin localStorage real.
 *
 * Modelo de tarea: { id, value, done, updatedAt }
 *   - id: timestamp epoch (string) en el momento de creación.
 *   - value: texto.
 *   - done: booleano.
 *   - updatedAt: timestamp epoch (number) de la última modificación
 *     (creación, edición de texto o cambio de estado).
 *
 * El orden del array `tasks` es el "orden de inserción / manual".
 * Para visualizar con cualquier otro criterio se usa
 * getOrderedTasks(sortBy) que devuelve un array nuevo sin mutar el
 * almacenamiento. Persistir mantiene el orden manual.
 */

export const SORT_MODES = [
    'created-desc',
    'created-asc',
    'alpha-asc',
    'alpha-desc',
    'length-asc',
    'length-desc',
    'pending-first',
    'done-first',
    'modified-desc',
    'modified-asc',
    'manual',
];

export class TaskStore {
    constructor(storage) {
        this.storage = storage;
        this.tasks = this.load();
    }

    load() {
        const raw = this.storage.get();
        if (!raw) return [];
        // Boundary: normaliza done a booleano y agrega updatedAt para
        // compatibilidad con datos viejos que no traían ese campo.
        return raw.map(item => {
            const done = item.done === true || item.done === "true";
            const fallbackTs = parseInt(item.id);
            const updatedAt = typeof item.updatedAt === 'number'
                ? item.updatedAt
                : (Number.isFinite(fallbackTs) ? fallbackTs : Date.now());
            return { ...item, done, updatedAt };
        });
    }

    save() {
        // Persiste el orden actual (orden manual / de inserción).
        this.storage.set(this.tasks);
    }

    add(value, idFactory = () => Date.now().toString()) {
        const id = idFactory();
        const createdAt = parseInt(id) || Date.now();
        const task = { id, value, done: false, updatedAt: createdAt };
        // Las tareas nuevas se insertan al inicio del orden manual,
        // así "Más recientes primero" coincide con "manual" justo
        // después de crear.
        this.tasks.unshift(task);
        this.save();
        return task;
    }

    update(id, value, now = Date.now()) {
        this.tasks = this.tasks.map(t => t.id === id ? { ...t, value, updatedAt: now } : t);
        this.save();
    }

    toggle(id, done, now = Date.now()) {
        this.tasks = this.tasks.map(t => t.id === id ? { ...t, done, updatedAt: now } : t);
        this.save();
    }

    remove(id) {
        this.tasks = this.tasks.filter(t => t.id !== id);
        this.save();
    }

    clear() {
        this.tasks = [];
        this.save();
    }

    /**
     * Mueve la tarea de fromIndex a toIndex en el orden manual.
     * No-op si los índices son iguales o están fuera de rango.
     */
    move(fromIndex, toIndex) {
        if (fromIndex === toIndex) return;
        if (fromIndex < 0 || fromIndex >= this.tasks.length) return;
        if (toIndex < 0 || toIndex >= this.tasks.length) return;
        const [item] = this.tasks.splice(fromIndex, 1);
        this.tasks.splice(toIndex, 0, item);
        this.save();
    }

    filter(showDone) {
        return this.tasks.filter(t => t.done === showDone);
    }

    counts() {
        const total = this.tasks.length;
        const done = this.tasks.filter(t => t.done).length;
        return { total, done, pending: total - done };
    }

    isEmpty() {
        return this.tasks.length === 0;
    }

    /**
     * Devuelve una COPIA del array de tareas ordenada según sortBy.
     * No muta this.tasks. Si sortBy === 'manual' o no se reconoce,
     * devuelve una copia en el orden manual actual.
     */
    getOrderedTasks(sortBy = 'created-desc') {
        const copy = [...this.tasks];
        const idAsNum = t => parseInt(t.id) || 0;
        const compareEs = (a, b) => a.value.localeCompare(b.value, 'es', { sensitivity: 'base' });
        switch (sortBy) {
            case 'created-desc':
                return copy.sort((a, b) => idAsNum(b) - idAsNum(a));
            case 'created-asc':
                return copy.sort((a, b) => idAsNum(a) - idAsNum(b));
            case 'alpha-asc':
                return copy.sort(compareEs);
            case 'alpha-desc':
                return copy.sort((a, b) => compareEs(b, a));
            case 'length-asc':
                return copy.sort((a, b) => a.value.length - b.value.length);
            case 'length-desc':
                return copy.sort((a, b) => b.value.length - a.value.length);
            case 'pending-first':
                return copy.sort((a, b) => Number(a.done) - Number(b.done));
            case 'done-first':
                return copy.sort((a, b) => Number(b.done) - Number(a.done));
            case 'modified-desc':
                return copy.sort((a, b) => b.updatedAt - a.updatedAt);
            case 'modified-asc':
                return copy.sort((a, b) => a.updatedAt - b.updatedAt);
            case 'manual':
            default:
                return copy;
        }
    }
}

export class LocalStorageAdapter {
    constructor(key) { this.key = key; }
    get() {
        const raw = localStorage.getItem(this.key);
        return raw ? JSON.parse(raw) : null;
    }
    set(value) {
        localStorage.setItem(this.key, JSON.stringify(value));
    }
}

export class MemoryStorageAdapter {
    constructor(initial = null) { this._data = initial; }
    get() { return this._data ? JSON.parse(JSON.stringify(this._data)) : null; }
    set(value) { this._data = JSON.parse(JSON.stringify(value)); }
}
