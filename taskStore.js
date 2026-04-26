/*
 * TaskStore — lógica pura de gestión de tareas y subtareas, sin DOM.
 *
 * Modelo de tarea: { id, value, done, updatedAt, parentId }
 *   - id: timestamp epoch (string) en el momento de creación.
 *   - value: texto.
 *   - done: booleano.
 *   - updatedAt: timestamp epoch (number) de la última modificación.
 *   - parentId: null para tareas top-level, id (string) del padre
 *     para subtareas. Profundidad máxima: 1 nivel.
 *
 * Reglas de propagación (sólo entre padre y sus subs):
 *   - Toggle padre → propaga el done a TODAS sus subs.
 *   - Toggle sub → re-evalúa el padre: todas subs done ⇒ padre done;
 *     alguna sub pendiente ⇒ padre pendiente.
 *   - Add sub a un padre done → re-evalúa el padre (vuelve a pendiente
 *     porque la nueva sub está pendiente).
 *   - Remove sub → re-evalúa el padre.
 *   - Remove padre → cascade (borra todas las subs).
 *
 * El orden de this.tasks es: cada padre seguido inmediatamente por sus
 * subs en orden de inserción (sub más reciente = closer al padre).
 * Para visualizar con cualquier sort se usa getOrderedTasks(sortBy)
 * que ordena los PADRES y mantiene a las subs pegadas a su padre.
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
        // Boundary: normaliza done a booleano, agrega updatedAt y
        // parentId si no existían (datos legacy de versiones previas).
        return raw.map(item => {
            const done = item.done === true || item.done === "true";
            const fallbackTs = parseInt(item.id);
            const updatedAt = typeof item.updatedAt === 'number'
                ? item.updatedAt
                : (Number.isFinite(fallbackTs) ? fallbackTs : Date.now());
            const parentId = typeof item.parentId === 'string' ? item.parentId : null;
            return { ...item, done, updatedAt, parentId };
        });
    }

    save() {
        this.storage.set(this.tasks);
    }

    /**
     * Crea una tarea top-level. Se inserta al inicio del orden manual.
     */
    add(value, idFactory = () => Date.now().toString()) {
        const id = idFactory();
        const createdAt = parseInt(id) || Date.now();
        const task = { id, value, done: false, updatedAt: createdAt, parentId: null };
        this.tasks.unshift(task);
        this.save();
        return task;
    }

    /**
     * Crea una subtarea bajo `parentId`. Se inserta inmediatamente
     * después del padre (más nueva más cerca del padre). Si el padre
     * estaba done, vuelve a pendiente porque la sub nueva está pendiente.
     */
    addSubtask(parentId, value, idFactory = () => Date.now().toString(), now = Date.now()) {
        const parentIdx = this.tasks.findIndex(t => t.id === parentId && t.parentId === null);
        if (parentIdx < 0) return null;
        const id = idFactory();
        const createdAt = parseInt(id) || Date.now();
        const task = { id, value, done: false, updatedAt: createdAt, parentId };
        // Insertar justo después del padre (antes de las subs existentes).
        this.tasks.splice(parentIdx + 1, 0, task);
        // Si el padre estaba done, ahora hay una sub pendiente → re-abrir.
        this._reevaluateParent(parentId, now);
        this.save();
        return task;
    }

    update(id, value, now = Date.now()) {
        this.tasks = this.tasks.map(t => t.id === id ? { ...t, value, updatedAt: now } : t);
        this.save();
    }

    /**
     * Toggle con propagación bidireccional entre padre y subs.
     */
    toggle(id, done, now = Date.now()) {
        const task = this.tasks.find(t => t.id === id);
        if (!task) return;

        if (task.parentId === null) {
            // Es padre: propagar el done a TODAS sus subs.
            this.tasks = this.tasks.map(t => {
                if (t.id === id) return { ...t, done, updatedAt: now };
                if (t.parentId === id) return { ...t, done, updatedAt: now };
                return t;
            });
        } else {
            // Es sub: cambiar y re-evaluar el padre.
            this.tasks = this.tasks.map(t => t.id === id ? { ...t, done, updatedAt: now } : t);
            this._reevaluateParent(task.parentId, now);
        }
        this.save();
    }

    /**
     * Re-calcula el done de un padre según el estado de sus subs.
     * Si todas las subs están done → padre done.
     * Si al menos una sub está pendiente → padre pendiente.
     * Si no tiene subs → no toca al padre (preserva su estado manual).
     */
    _reevaluateParent(parentId, now) {
        const parent = this.tasks.find(t => t.id === parentId);
        if (!parent || parent.parentId !== null) return;
        const subs = this.tasks.filter(t => t.parentId === parentId);
        if (subs.length === 0) return;
        const allDone = subs.every(s => s.done);
        if (parent.done !== allDone) {
            this.tasks = this.tasks.map(t =>
                t.id === parentId ? { ...t, done: allDone, updatedAt: now } : t
            );
        }
    }

    remove(id, now = Date.now()) {
        const task = this.tasks.find(t => t.id === id);
        if (!task) return;
        if (task.parentId === null) {
            // Cascade: borrar padre y todas sus subs.
            this.tasks = this.tasks.filter(t => t.id !== id && t.parentId !== id);
        } else {
            // Borrar sub y re-evaluar el padre.
            const parentId = task.parentId;
            this.tasks = this.tasks.filter(t => t.id !== id);
            this._reevaluateParent(parentId, now);
        }
        this.save();
    }

    clear() {
        this.tasks = [];
        this.save();
    }

    /**
     * Mueve un padre (con sus subs como grupo) de fromParentIdx a
     * toParentIdx. Los índices se refieren a la lista de padres
     * (no a this.tasks). Semántica estándar de splice: el padre
     * movido termina en la posición toParentIdx de la lista final.
     */
    move(fromParentIdx, toParentIdx) {
        if (fromParentIdx === toParentIdx) return;
        const parents = this.tasks.filter(t => t.parentId === null);
        if (fromParentIdx < 0 || fromParentIdx >= parents.length) return;
        if (toParentIdx < 0 || toParentIdx >= parents.length) return;

        // 1) Reordenamos la lista de padres con splice.
        const newParents = [...parents];
        const [moved] = newParents.splice(fromParentIdx, 1);
        newParents.splice(toParentIdx, 0, moved);

        // 2) Reconstruimos this.tasks como [padre, ...subs] por cada padre,
        //    preservando el orden interno de las subs en this.tasks.
        const subsByParent = new Map();
        for (const t of this.tasks) {
            if (t.parentId !== null) {
                if (!subsByParent.has(t.parentId)) subsByParent.set(t.parentId, []);
                subsByParent.get(t.parentId).push(t);
            }
        }
        this.tasks = newParents.flatMap(p => [p, ...(subsByParent.get(p.id) || [])]);
        this.save();
    }

    /**
     * Filtra padres por estado done. Las subs no se cuentan aquí — los
     * filtros aplican sólo a padres por decisión de UX.
     */
    filter(showDone) {
        return this.tasks.filter(t => t.parentId === null && t.done === showDone);
    }

    /**
     * Counts opera sobre PADRES — la paginación y los counters de la
     * UI se basan en cuántos padres hay, no cuántas filas en total.
     */
    counts() {
        const parents = this.tasks.filter(t => t.parentId === null);
        const total = parents.length;
        const done = parents.filter(t => t.done).length;
        return { total, done, pending: total - done };
    }

    isEmpty() {
        return this.tasks.length === 0;
    }

    /**
     * Devuelve las subtareas (en el orden de this.tasks) de un padre.
     */
    subsOf(parentId) {
        return this.tasks.filter(t => t.parentId === parentId);
    }

    /**
     * Mueve una tarea entre niveles y/o a una posición específica.
     *  - newParentId === null → promote a top-level.
     *  - newParentId = id de un padre válido → re-parent.
     *  - insertBeforeId:
     *      undefined → legacy: top-level=unshift, child=al inicio del bloque.
     *      null      → al final del scope (lista top-level si newParentId=null,
     *                  o final del bloque del padre si no).
     *      '<id>'    → insertar antes de esa tarea (debe estar en el scope correcto).
     * Validaciones:
     *  - No mover sobre sí misma.
     *  - El nuevo padre debe existir y ser top-level.
     *  - Padre con subs NO puede demotarse (crearía subsub).
     * Devuelve true si se aplicó el cambio, false si fue rechazado/no-op.
     */
    moveToParent(taskId, newParentId, insertBeforeId = undefined, now = Date.now()) {
        if (taskId === newParentId) return false;
        if (taskId === insertBeforeId) return false;
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return false;

        const sameParent = task.parentId === newParentId;
        if (sameParent && insertBeforeId === undefined) return false;

        if (task.parentId === null && newParentId !== null && this.subsOf(taskId).length > 0) {
            return false;
        }

        if (newParentId !== null) {
            const newParent = this.tasks.find(t => t.id === newParentId);
            if (!newParent || newParent.parentId !== null) return false;
        }

        const oldParentId = task.parentId;
        const idx = this.tasks.findIndex(t => t.id === taskId);
        const [item] = this.tasks.splice(idx, 1);
        item.parentId = newParentId;
        item.updatedAt = now;

        if (insertBeforeId === undefined) {
            // Legacy: comportamiento histórico.
            if (newParentId === null) {
                this.tasks.unshift(item);
            } else {
                const parentIdx = this.tasks.findIndex(t => t.id === newParentId);
                this.tasks.splice(parentIdx + 1, 0, item);
            }
        } else if (insertBeforeId === null) {
            // Al final del scope.
            if (newParentId === null) {
                // Final de la lista de top-levels = después del último padre y sus subs.
                // En this.tasks eso es simplemente el final.
                this.tasks.push(item);
            } else {
                // Final del bloque del padre = después de la última sub de ese padre.
                const parentIdx = this.tasks.findIndex(t => t.id === newParentId);
                let insertAt = parentIdx + 1;
                while (insertAt < this.tasks.length && this.tasks[insertAt].parentId === newParentId) {
                    insertAt++;
                }
                this.tasks.splice(insertAt, 0, item);
            }
        } else {
            // Antes de un id específico.
            const beforeIdx = this.tasks.findIndex(t => t.id === insertBeforeId);
            if (beforeIdx < 0) {
                // Fallback: al final.
                this.tasks.push(item);
            } else {
                this.tasks.splice(beforeIdx, 0, item);
            }
        }

        if (oldParentId && oldParentId !== newParentId) this._reevaluateParent(oldParentId, now);
        if (newParentId) this._reevaluateParent(newParentId, now);

        this.save();
        return true;
    }

    /**
     * Devuelve la lista plana ordenada para visualización:
     * [parent1, sub1a, sub1b, parent2, sub2a, ...]
     * El sort se aplica SOLO a los padres; las subs siempre van pegadas
     * a su padre en el orden actual de this.tasks.
     */
    getOrderedTasks(sortBy = 'created-desc') {
        const parents = this.tasks.filter(t => t.parentId === null);
        const sortedParents = this._sortList([...parents], sortBy);
        const result = [];
        for (const parent of sortedParents) {
            result.push(parent);
            for (const sub of this.tasks) {
                if (sub.parentId === parent.id) result.push(sub);
            }
        }
        return result;
    }

    _sortList(list, sortBy) {
        const idAsNum = t => parseInt(t.id) || 0;
        const compareEs = (a, b) => a.value.localeCompare(b.value, 'es', { sensitivity: 'base' });
        switch (sortBy) {
            case 'created-desc':
                return list.sort((a, b) => idAsNum(b) - idAsNum(a));
            case 'created-asc':
                return list.sort((a, b) => idAsNum(a) - idAsNum(b));
            case 'alpha-asc':
                return list.sort(compareEs);
            case 'alpha-desc':
                return list.sort((a, b) => compareEs(b, a));
            case 'length-asc':
                return list.sort((a, b) => a.value.length - b.value.length);
            case 'length-desc':
                return list.sort((a, b) => b.value.length - a.value.length);
            case 'pending-first':
                return list.sort((a, b) => Number(a.done) - Number(b.done));
            case 'done-first':
                return list.sort((a, b) => Number(b.done) - Number(a.done));
            case 'modified-desc':
                return list.sort((a, b) => b.updatedAt - a.updatedAt);
            case 'modified-asc':
                return list.sort((a, b) => a.updatedAt - b.updatedAt);
            case 'manual':
            default:
                return list;
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
