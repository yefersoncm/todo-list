import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { TaskStore, MemoryStorageAdapter } from '../taskStore.js';

const newStore = (initial = null) => new TaskStore(new MemoryStorageAdapter(initial));

describe('TaskStore — add', () => {
    test('crea una tarea pendiente con valor, id y updatedAt', () => {
        const store = newStore();
        const task = store.add('Comprar pan', () => '100');
        assert.equal(store.tasks.length, 1);
        assert.equal(task.value, 'Comprar pan');
        assert.equal(task.done, false);
        assert.equal(task.id, '100');
        assert.equal(task.updatedAt, 100);
    });

    test('persiste en el adapter al agregar', () => {
        const adapter = new MemoryStorageAdapter();
        const store = new TaskStore(adapter);
        store.add('x', () => '1');
        assert.equal(adapter.get().length, 1);
    });

    test('inserta al inicio del orden manual (más nueva al frente)', () => {
        const store = newStore();
        store.add('vieja', () => '1');
        store.add('nueva', () => '2');
        // Unshift: la más nueva queda al inicio.
        assert.deepEqual(store.tasks.map(t => t.id), ['2', '1']);
    });
});

describe('TaskStore — update / toggle / remove / clear', () => {
    test('update cambia value y refresca updatedAt', () => {
        const store = newStore();
        store.add('viejo', () => '1');
        store.update('1', 'nuevo', 999);
        assert.equal(store.tasks[0].value, 'nuevo');
        assert.equal(store.tasks[0].updatedAt, 999);
    });

    test('toggle cambia done y refresca updatedAt SIN reordenar', () => {
        const store = newStore();
        store.add('a', () => '1');
        store.add('b', () => '2');
        // Tras los add: orden manual = ['2', '1'] (más nueva al frente).
        store.toggle('1', true, 555);
        // El orden manual NO cambia; sólo el done y updatedAt.
        assert.deepEqual(store.tasks.map(t => t.id), ['2', '1']);
        assert.equal(store.tasks[1].done, true);
        assert.equal(store.tasks[1].updatedAt, 555);
    });

    test('remove elimina por id', () => {
        const store = newStore();
        store.add('a', () => '1');
        store.add('b', () => '2');
        store.remove('1');
        assert.equal(store.tasks.length, 1);
        assert.equal(store.tasks[0].id, '2');
    });

    test('clear vacía la lista', () => {
        const store = newStore();
        store.add('a', () => '1');
        store.clear();
        assert.equal(store.tasks.length, 0);
        assert.ok(store.isEmpty());
    });
});

describe('TaskStore — filter / counts', () => {
    test('filter(true) devuelve sólo hechas; filter(false), pendientes', () => {
        const store = newStore();
        store.add('a', () => '1');
        store.add('b', () => '2');
        store.toggle('1', true);
        assert.deepEqual(store.filter(true).map(t => t.id), ['1']);
        assert.deepEqual(store.filter(false).map(t => t.id), ['2']);
    });

    test('counts() reporta total, hechas y pendientes', () => {
        const store = newStore();
        store.add('a', () => '1');
        store.add('b', () => '2');
        store.add('c', () => '3');
        store.toggle('1', true);
        store.toggle('2', true);
        assert.deepEqual(store.counts(), { total: 3, done: 2, pending: 1 });
    });
});

describe('TaskStore — load (boundary)', () => {
    test('normaliza done="true"/"false" legacy a booleano', () => {
        const adapter = new MemoryStorageAdapter([
            { id: '1', value: 'a', done: 'true' },
            { id: '2', value: 'b', done: 'false' },
        ]);
        const store = new TaskStore(adapter);
        assert.equal(store.tasks[0].done, true);
        assert.equal(store.tasks[1].done, false);
        assert.equal(typeof store.tasks[0].done, 'boolean');
    });

    test('migra tareas sin updatedAt usando el id como timestamp', () => {
        const adapter = new MemoryStorageAdapter([
            { id: '1700000000000', value: 'a', done: false },
        ]);
        const store = new TaskStore(adapter);
        assert.equal(store.tasks[0].updatedAt, 1700000000000);
    });

    test('respeta updatedAt si ya está presente', () => {
        const adapter = new MemoryStorageAdapter([
            { id: '1', value: 'a', done: false, updatedAt: 42 },
        ]);
        const store = new TaskStore(adapter);
        assert.equal(store.tasks[0].updatedAt, 42);
    });

    test('lista vacía si el storage devuelve null', () => {
        const store = newStore();
        assert.deepEqual(store.tasks, []);
    });
});

describe('TaskStore — getOrderedTasks', () => {
    function setupStore() {
        const store = newStore();
        // Insertamos en este orden temporal: bicicleta (1), Avocado (3), zorro (2)
        store.add('bicicleta', () => '1');
        store.add('Avocado', () => '3');
        store.add('zorro', () => '2');
        // Orden manual tras unshift: ['2' zorro, '3' Avocado, '1' bicicleta]
        return store;
    }

    test('manual / default → orden actual del array', () => {
        const store = setupStore();
        assert.deepEqual(store.getOrderedTasks('manual').map(t => t.id), ['2', '3', '1']);
    });

    test('created-desc → más recientes primero (ids descendentes)', () => {
        const store = setupStore();
        assert.deepEqual(store.getOrderedTasks('created-desc').map(t => t.id), ['3', '2', '1']);
    });

    test('created-asc → más antiguas primero', () => {
        const store = setupStore();
        assert.deepEqual(store.getOrderedTasks('created-asc').map(t => t.id), ['1', '2', '3']);
    });

    test('alpha-asc → A→Z (ignorando mayúsculas)', () => {
        const store = setupStore();
        assert.deepEqual(
            store.getOrderedTasks('alpha-asc').map(t => t.value),
            ['Avocado', 'bicicleta', 'zorro'],
        );
    });

    test('alpha-desc → Z→A', () => {
        const store = setupStore();
        assert.deepEqual(
            store.getOrderedTasks('alpha-desc').map(t => t.value),
            ['zorro', 'bicicleta', 'Avocado'],
        );
    });

    test('length-asc → más cortas primero', () => {
        const store = setupStore();
        const lens = store.getOrderedTasks('length-asc').map(t => t.value.length);
        assert.deepEqual(lens, [...lens].sort((a, b) => a - b));
    });

    test('length-desc → más largas primero', () => {
        const store = setupStore();
        const lens = store.getOrderedTasks('length-desc').map(t => t.value.length);
        assert.deepEqual(lens, [...lens].sort((a, b) => b - a));
    });

    test('pending-first → pendientes antes que hechas', () => {
        const store = setupStore();
        store.toggle('1', true);
        const result = store.getOrderedTasks('pending-first');
        assert.equal(result[result.length - 1].id, '1');
        assert.ok(result.slice(0, -1).every(t => !t.done));
    });

    test('done-first → hechas antes que pendientes', () => {
        const store = setupStore();
        store.toggle('1', true);
        const result = store.getOrderedTasks('done-first');
        assert.equal(result[0].id, '1');
        assert.ok(result.slice(1).every(t => !t.done));
    });

    test('modified-desc → más recientemente modificadas primero', () => {
        const store = setupStore();
        store.update('1', 'bicicleta vieja', 5000);
        store.update('3', 'avocado fresco', 9000);
        store.update('2', 'zorro pardo', 7000);
        assert.deepEqual(
            store.getOrderedTasks('modified-desc').map(t => t.id),
            ['3', '2', '1'],
        );
    });

    test('modified-asc → modificadas hace tiempo primero', () => {
        const store = setupStore();
        store.update('1', 'b', 5000);
        store.update('3', 'a', 9000);
        store.update('2', 'z', 7000);
        assert.deepEqual(
            store.getOrderedTasks('modified-asc').map(t => t.id),
            ['1', '2', '3'],
        );
    });

    test('no muta this.tasks', () => {
        const store = setupStore();
        const before = store.tasks.map(t => t.id);
        store.getOrderedTasks('alpha-asc');
        assert.deepEqual(store.tasks.map(t => t.id), before);
    });

    test('valor desconocido cae a manual', () => {
        const store = setupStore();
        assert.deepEqual(
            store.getOrderedTasks('what-is-this').map(t => t.id),
            store.getOrderedTasks('manual').map(t => t.id),
        );
    });
});

describe('TaskStore — move', () => {
    function setup() {
        const store = newStore();
        store.add('a', () => '1');
        store.add('b', () => '2');
        store.add('c', () => '3');
        // Orden manual tras unshift: ['3', '2', '1'].
        return store;
    }

    test('mueve hacia arriba: índice 2 → 0', () => {
        const store = setup();
        store.move(2, 0);
        assert.deepEqual(store.tasks.map(t => t.id), ['1', '3', '2']);
    });

    test('mueve hacia abajo: índice 0 → 2', () => {
        const store = setup();
        store.move(0, 2);
        assert.deepEqual(store.tasks.map(t => t.id), ['2', '1', '3']);
    });

    test('no-op si los índices son iguales', () => {
        const store = setup();
        store.move(1, 1);
        assert.deepEqual(store.tasks.map(t => t.id), ['3', '2', '1']);
    });

    test('no-op si los índices están fuera de rango', () => {
        const store = setup();
        const before = store.tasks.map(t => t.id);
        store.move(-1, 0);
        store.move(0, 99);
        assert.deepEqual(store.tasks.map(t => t.id), before);
    });

    test('persiste el nuevo orden en el adapter', () => {
        const adapter = new MemoryStorageAdapter();
        const store = new TaskStore(adapter);
        store.add('a', () => '1');
        store.add('b', () => '2');
        store.add('c', () => '3');
        store.move(0, 2);
        assert.deepEqual(adapter.get().map(t => t.id), ['2', '1', '3']);
    });
});
