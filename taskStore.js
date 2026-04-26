/*
 * TaskStore — lógica pura de gestión de tareas, sin DOM.
 * Aceptará cualquier adapter con get()/set() para que sea testeable
 * sin localStorage real.
 */

export class TaskStore {
    constructor(storage) {
        this.storage = storage;
        this.tasks = this.load();
    }

    load() {
        const raw = this.storage.get();
        if (!raw) return [];
        // Boundary: normaliza done a booleano para compatibilidad con datos viejos
        return raw.map(item => ({
            ...item,
            done: item.done === true || item.done === "true",
        }));
    }

    save() {
        this.tasks = this._sorted();
        this.storage.set(this.tasks);
    }

    _sorted() {
        const done = this.tasks.filter(t => t.done);
        const pending = this.tasks.filter(t => !t.done);
        const byIdAsc = (a, b) => parseInt(a.id) - parseInt(b.id);
        done.sort(byIdAsc);
        pending.sort(byIdAsc);
        return [...pending, ...done];
    }

    add(value, idFactory = () => Date.now().toString()) {
        const task = { id: idFactory(), value, done: false };
        this.tasks.push(task);
        this.save();
        return task;
    }

    update(id, value) {
        this.tasks = this.tasks.map(t => t.id === id ? { ...t, value } : t);
        this.save();
    }

    toggle(id, done) {
        this.tasks = this.tasks.map(t => t.id === id ? { ...t, done } : t);
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
