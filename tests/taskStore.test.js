import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { TaskStore, MemoryStorageAdapter } from '../taskStore.js';

const newStore = (initial = null) => new TaskStore(new MemoryStorageAdapter(initial));

describe('TaskStore — add', () => {
    test('crea una tarea pendiente con valor y id', () => {
        const store = newStore();
        const task = store.add('Comprar pan', () => '100');
        assert.equal(store.tasks.length, 1);
        assert.equal(task.value, 'Comprar pan');
        assert.equal(task.done, false);
        assert.equal(task.id, '100');
    });

    test('persiste en el adapter al agregar', () => {
        const adapter = new MemoryStorageAdapter();
        const store = new TaskStore(adapter);
        store.add('x', () => '1');
        assert.equal(adapter.get().length, 1);
    });
});

describe('TaskStore — update / toggle / remove / clear', () => {
    test('update cambia el value de una tarea por id', () => {
        const store = newStore();
        store.add('viejo', () => '1');
        store.update('1', 'nuevo');
        assert.equal(store.tasks[0].value, 'nuevo');
    });

    test('toggle marca como hecha y reordena', () => {
        const store = newStore();
        store.add('a', () => '1');
        store.add('b', () => '2');
        store.toggle('1', true);
        // Las hechas van al final
        assert.equal(store.tasks[0].id, '2');
        assert.equal(store.tasks[1].id, '1');
        assert.equal(store.tasks[1].done, true);
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
        // load no reordena; mantiene el orden del adapter pero con tipos correctos
        assert.equal(store.tasks[0].done, true);
        assert.equal(store.tasks[1].done, false);
        assert.equal(typeof store.tasks[0].done, 'boolean');
    });

    test('lista vacía si el storage devuelve null', () => {
        const store = newStore();
        assert.deepEqual(store.tasks, []);
    });
});

describe('TaskStore — orden', () => {
    test('pendientes antes que hechas, cada grupo por id ascendente', () => {
        const store = newStore();
        store.add('a', () => '3');
        store.add('b', () => '1');
        store.add('c', () => '2');
        store.toggle('3', true);
        const ids = store.tasks.map(t => t.id);
        assert.deepEqual(ids, ['1', '2', '3']);
    });
});

describe('TaskStore.daysSinceCreation', () => {
    test('hoy → 0', () => {
        const now = new Date('2026-04-25T12:00:00Z');
        const ts = new Date('2026-04-25T08:00:00Z').getTime();
        assert.equal(TaskStore.daysSinceCreation(ts, now), 0);
    });

    test('un día atrás → 1', () => {
        const now = new Date('2026-04-25T12:00:00Z');
        const ts = new Date('2026-04-24T08:00:00Z').getTime();
        assert.equal(TaskStore.daysSinceCreation(ts, now), 1);
    });

    test('siete días atrás → 7', () => {
        const now = new Date('2026-04-25T12:00:00Z');
        const ts = new Date('2026-04-18T08:00:00Z').getTime();
        assert.equal(TaskStore.daysSinceCreation(ts, now), 7);
    });

    test('timestamp inválido → "N/A"', () => {
        assert.equal(TaskStore.daysSinceCreation(null), 'N/A');
        assert.equal(TaskStore.daysSinceCreation('abc'), 'N/A');
    });
});
