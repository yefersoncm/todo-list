import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { TaskStore, MemoryStorageAdapter } from '../taskStore.js';

const newStore = (initial = null) => new TaskStore(new MemoryStorageAdapter(initial));

describe('TaskStore — add (top-level)', () => {
    test('crea una tarea pendiente con id, value, updatedAt y parentId=null', () => {
        const store = newStore();
        const task = store.add('Comprar pan', () => '100');
        assert.equal(store.tasks.length, 1);
        assert.equal(task.value, 'Comprar pan');
        assert.equal(task.done, false);
        assert.equal(task.id, '100');
        assert.equal(task.updatedAt, 100);
        assert.equal(task.parentId, null);
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
        assert.deepEqual(store.tasks.map(t => t.id), ['2', '1']);
    });
});

describe('TaskStore — addSubtask', () => {
    test('inserta una sub justo después del padre con parentId set', () => {
        const store = newStore();
        store.add('madre', () => 'P');
        const sub = store.addSubtask('P', 'hija', () => 'S1');
        assert.equal(sub.parentId, 'P');
        assert.deepEqual(store.tasks.map(t => t.id), ['P', 'S1']);
    });

    test('múltiples subs: la más nueva queda inmediatamente después del padre', () => {
        const store = newStore();
        store.add('madre', () => 'P');
        store.addSubtask('P', 'sub1', () => 'S1');
        store.addSubtask('P', 'sub2', () => 'S2');
        // S2 (más nueva) va más cerca del padre.
        assert.deepEqual(store.tasks.map(t => t.id), ['P', 'S2', 'S1']);
    });

    test('agregar sub a un padre done re-abre el padre', () => {
        const store = newStore();
        store.add('madre', () => 'P');
        store.toggle('P', true, 100);
        assert.equal(store.tasks[0].done, true);
        store.addSubtask('P', 'nueva sub', () => 'S1', 200);
        assert.equal(store.tasks.find(t => t.id === 'P').done, false);
    });

    test('parentId inexistente devuelve null y no inserta', () => {
        const store = newStore();
        store.add('madre', () => 'P');
        const sub = store.addSubtask('NOPE', 'sub fantasma', () => 'S1');
        assert.equal(sub, null);
        assert.equal(store.tasks.length, 1);
    });
});

describe('TaskStore — toggle con propagación', () => {
    test('toggle padre propaga el done a TODAS sus subs', () => {
        const store = newStore();
        store.add('madre', () => 'P');
        store.addSubtask('P', 's1', () => 'S1');
        store.addSubtask('P', 's2', () => 'S2');
        store.toggle('P', true, 500);
        const subs = store.tasks.filter(t => t.parentId === 'P');
        assert.ok(subs.every(s => s.done));
        assert.equal(store.tasks.find(t => t.id === 'P').done, true);
    });

    test('toggle padre a pendiente desmarca todas las subs', () => {
        const store = newStore();
        store.add('madre', () => 'P');
        store.addSubtask('P', 's1', () => 'S1');
        store.addSubtask('P', 's2', () => 'S2');
        store.toggle('P', true);
        store.toggle('P', false);
        const subs = store.tasks.filter(t => t.parentId === 'P');
        assert.ok(subs.every(s => !s.done));
    });

    test('marcar todas las subs como done auto-marca el padre', () => {
        const store = newStore();
        store.add('madre', () => 'P');
        store.addSubtask('P', 's1', () => 'S1');
        store.addSubtask('P', 's2', () => 'S2');
        store.toggle('S1', true);
        // Una sub aún pendiente; padre sigue pendiente.
        assert.equal(store.tasks.find(t => t.id === 'P').done, false);
        store.toggle('S2', true);
        // Todas hechas → padre done.
        assert.equal(store.tasks.find(t => t.id === 'P').done, true);
    });

    test('desmarcar una sub re-abre el padre', () => {
        const store = newStore();
        store.add('madre', () => 'P');
        store.addSubtask('P', 's1', () => 'S1');
        store.toggle('P', true);
        assert.equal(store.tasks.find(t => t.id === 'P').done, true);
        store.toggle('S1', false);
        assert.equal(store.tasks.find(t => t.id === 'P').done, false);
    });

    test('padre sin subs: toggle no se afecta por re-evaluación', () => {
        const store = newStore();
        store.add('solo', () => '1');
        store.toggle('1', true);
        assert.equal(store.tasks[0].done, true);
    });
});

describe('TaskStore — remove con cascade y re-evaluación', () => {
    test('borrar padre cascade-borra todas sus subs', () => {
        const store = newStore();
        store.add('madre', () => 'P');
        store.addSubtask('P', 's1', () => 'S1');
        store.addSubtask('P', 's2', () => 'S2');
        store.add('otra', () => 'Q');
        store.remove('P');
        assert.deepEqual(store.tasks.map(t => t.id), ['Q']);
    });

    test('borrar la última sub pendiente auto-marca el padre como done', () => {
        const store = newStore();
        store.add('madre', () => 'P');
        store.addSubtask('P', 'hecha', () => 'S1');
        store.addSubtask('P', 'pendiente', () => 'S2');
        store.toggle('S1', true);
        assert.equal(store.tasks.find(t => t.id === 'P').done, false);
        store.remove('S2'); // queda solo S1 que está done
        assert.equal(store.tasks.find(t => t.id === 'P').done, true);
    });

    test('borrar una sub no afecta al padre si las restantes mezclan estados', () => {
        const store = newStore();
        store.add('madre', () => 'P');
        store.addSubtask('P', 's1', () => 'S1');
        store.addSubtask('P', 's2', () => 'S2');
        store.addSubtask('P', 's3', () => 'S3');
        store.toggle('S1', true);
        store.remove('S2'); // queda S1 done y S3 pendiente
        assert.equal(store.tasks.find(t => t.id === 'P').done, false);
    });
});

describe('TaskStore — update', () => {
    test('update cambia value y refresca updatedAt', () => {
        const store = newStore();
        store.add('viejo', () => '1');
        store.update('1', 'nuevo', 999);
        assert.equal(store.tasks[0].value, 'nuevo');
        assert.equal(store.tasks[0].updatedAt, 999);
    });

    test('update funciona igual sobre subtareas', () => {
        const store = newStore();
        store.add('madre', () => 'P');
        store.addSubtask('P', 'sub vieja', () => 'S1');
        store.update('S1', 'sub editada', 1234);
        const sub = store.tasks.find(t => t.id === 'S1');
        assert.equal(sub.value, 'sub editada');
        assert.equal(sub.updatedAt, 1234);
    });
});

describe('TaskStore — filter / counts (sólo padres)', () => {
    test('filter(true|false) devuelve sólo padres con ese estado', () => {
        const store = newStore();
        store.add('a', () => '1');
        store.add('b', () => '2');
        store.toggle('1', true);
        // Agregar una sub no afecta el filter (sólo cuenta padres).
        store.addSubtask('2', 'sub', () => 'S1');
        assert.deepEqual(store.filter(true).map(t => t.id), ['1']);
        assert.deepEqual(store.filter(false).map(t => t.id), ['2']);
    });

    test('counts() reporta solo padres', () => {
        const store = newStore();
        store.add('a', () => '1');
        store.add('b', () => '2');
        store.add('c', () => '3');
        store.addSubtask('1', 's1', () => 'S1');
        store.addSubtask('1', 's2', () => 'S2');
        store.toggle('2', true);
        // 3 padres, 1 hecho, 2 pendientes (las subs no se cuentan).
        assert.deepEqual(store.counts(), { total: 3, done: 1, pending: 2 });
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
    });

    test('migra tareas sin updatedAt usando el id como timestamp', () => {
        const adapter = new MemoryStorageAdapter([
            { id: '1700000000000', value: 'a', done: false },
        ]);
        const store = new TaskStore(adapter);
        assert.equal(store.tasks[0].updatedAt, 1700000000000);
    });

    test('migra tareas sin parentId asumiendo top-level (null)', () => {
        const adapter = new MemoryStorageAdapter([
            { id: '1', value: 'a', done: false },
        ]);
        const store = new TaskStore(adapter);
        assert.equal(store.tasks[0].parentId, null);
    });

    test('respeta parentId si ya está presente', () => {
        const adapter = new MemoryStorageAdapter([
            { id: 'P', value: 'madre', done: false },
            { id: 'S1', value: 'sub', done: false, parentId: 'P' },
        ]);
        const store = new TaskStore(adapter);
        assert.equal(store.tasks[1].parentId, 'P');
    });

    test('lista vacía si el storage devuelve null', () => {
        const store = newStore();
        assert.deepEqual(store.tasks, []);
    });
});

describe('TaskStore — getOrderedTasks (subs siguen al padre)', () => {
    function setup() {
        const store = newStore();
        store.add('alfa', () => '1');
        store.add('beta', () => '2');
        store.addSubtask('1', 'sub-alfa-1', () => '11');
        store.addSubtask('2', 'sub-beta-1', () => '21');
        store.addSubtask('1', 'sub-alfa-2', () => '12');
        return store;
    }

    test('manual: cada padre va seguido inmediatamente de sus subs', () => {
        const store = setup();
        const result = store.getOrderedTasks('manual').map(t => t.id);
        // En manual: '2' fue agregado después → unshift al frente.
        // Las subs siguen INMEDIATAMENTE a su padre, antes del siguiente padre.
        const idxParent2 = result.indexOf('2');
        const idxSub21 = result.indexOf('21');
        const idxParent1 = result.indexOf('1');
        const idxSub11 = result.indexOf('11');
        const idxSub12 = result.indexOf('12');
        // Sub '21' entre padre '2' y padre '1'.
        assert.ok(idxParent2 < idxSub21 && idxSub21 < idxParent1);
        // Subs de '1' después de '1'.
        assert.ok(idxParent1 < idxSub11);
        assert.ok(idxParent1 < idxSub12);
    });

    test('alpha-asc ordena padres alfabéticamente; subs siguen al padre', () => {
        const store = setup();
        const result = store.getOrderedTasks('alpha-asc').map(t => t.id);
        // Padres en orden: alfa(1) → beta(2). Subs siguen.
        assert.equal(result[0], '1');
        // Después de '1' vienen sus subs (en algún orden) y luego '2'.
        const idx2 = result.indexOf('2');
        const idx11 = result.indexOf('11');
        const idx12 = result.indexOf('12');
        assert.ok(idx11 < idx2);
        assert.ok(idx12 < idx2);
    });

    test('created-asc: padres por id ascendente; subs pegadas', () => {
        const store = setup();
        const result = store.getOrderedTasks('created-asc').map(t => t.id);
        assert.equal(result[0], '1');
        // Subs de 1 antes del padre 2.
        const idx2 = result.indexOf('2');
        assert.ok(result.indexOf('11') < idx2);
        assert.ok(result.indexOf('12') < idx2);
    });

    test('no muta this.tasks', () => {
        const store = setup();
        const before = store.tasks.map(t => t.id);
        store.getOrderedTasks('alpha-asc');
        assert.deepEqual(store.tasks.map(t => t.id), before);
    });
});

describe('TaskStore — move (parent groups)', () => {
    function setup() {
        const store = newStore();
        store.add('a', () => 'A');
        store.add('b', () => 'B');
        store.add('c', () => 'C');
        // Manual order tras unshift: ['C', 'B', 'A'] (todos parents, sin subs).
        return store;
    }

    test('mueve el padre del idx 0 al idx 2 (termina en la última posición)', () => {
        const store = setup();
        // Splice estándar: removemos parents[0]='C' y lo insertamos en idx 2.
        store.move(0, 2);
        assert.deepEqual(store.tasks.map(t => t.id), ['B', 'A', 'C']);
    });

    test('mueve el padre del idx 2 al idx 0 (termina al frente)', () => {
        const store = setup();
        store.move(2, 0);
        assert.deepEqual(store.tasks.map(t => t.id), ['A', 'C', 'B']);
    });

    test('mover un padre arrastra a sus subs como grupo', () => {
        const store = newStore();
        store.add('a', () => 'A');
        store.add('b', () => 'B');
        // Manual order: ['B', 'A']
        store.addSubtask('B', 'sub-B', () => 'BS');
        // Manual order: ['B', 'BS', 'A']
        store.move(0, 1); // mueve 'B' (con su sub) a posición de 'A'
        assert.deepEqual(store.tasks.map(t => t.id), ['A', 'B', 'BS']);
    });

    test('no-op si los índices son iguales', () => {
        const store = setup();
        store.move(1, 1);
        assert.deepEqual(store.tasks.map(t => t.id), ['C', 'B', 'A']);
    });

    test('no-op si los índices están fuera de rango', () => {
        const store = setup();
        const before = store.tasks.map(t => t.id);
        store.move(-1, 0);
        store.move(0, 99);
        assert.deepEqual(store.tasks.map(t => t.id), before);
    });
});

describe('TaskStore — moveToParent (re-parent / promote / demote)', () => {
    test('re-parent: una sub se mueve a otro padre', () => {
        const store = newStore();
        store.add('A', () => 'A');
        store.add('B', () => 'B');
        store.addSubtask('A', 'sub-A', () => 'SA');
        const ok = store.moveToParent('SA', 'B');
        assert.ok(ok);
        const sub = store.tasks.find(t => t.id === 'SA');
        assert.equal(sub.parentId, 'B');
        const idxB = store.tasks.findIndex(t => t.id === 'B');
        assert.equal(store.tasks[idxB + 1].id, 'SA');
    });

    test('promote: una sub se vuelve top-level (parentId=null) y queda al frente', () => {
        const store = newStore();
        store.add('A', () => 'A');
        store.addSubtask('A', 'sub-A', () => 'SA');
        const ok = store.moveToParent('SA', null);
        assert.ok(ok);
        const promoted = store.tasks.find(t => t.id === 'SA');
        assert.equal(promoted.parentId, null);
        assert.equal(store.tasks[0].id, 'SA');
    });

    test('demote: top-level SIN subs se vuelve sub de otro padre', () => {
        const store = newStore();
        store.add('A', () => 'A');
        store.add('B', () => 'B');
        const ok = store.moveToParent('A', 'B');
        assert.ok(ok);
        assert.equal(store.tasks.find(t => t.id === 'A').parentId, 'B');
    });

    test('rechaza demote de un padre CON subs (crearía subsub)', () => {
        const store = newStore();
        store.add('A', () => 'A');
        store.add('B', () => 'B');
        store.addSubtask('A', 'sub-A', () => 'SA');
        const ok = store.moveToParent('A', 'B');
        assert.equal(ok, false);
        assert.equal(store.tasks.find(t => t.id === 'A').parentId, null);
    });

    test('rechaza moverse sobre sí mismo', () => {
        const store = newStore();
        store.add('A', () => 'A');
        assert.equal(store.moveToParent('A', 'A'), false);
    });

    test('rechaza si el nuevo padre no existe', () => {
        const store = newStore();
        store.add('A', () => 'A');
        store.addSubtask('A', 'sub', () => 'SA');
        assert.equal(store.moveToParent('SA', 'NOPE'), false);
    });

    test('rechaza si el nuevo padre es una sub (no top-level)', () => {
        const store = newStore();
        store.add('A', () => 'A');
        store.add('B', () => 'B');
        store.addSubtask('A', 'sa', () => 'SA');
        store.addSubtask('B', 'sb', () => 'SB');
        assert.equal(store.moveToParent('SA', 'SB'), false);
    });

    test('no-op si la sub ya tiene ese padre', () => {
        const store = newStore();
        store.add('A', () => 'A');
        store.addSubtask('A', 'sub', () => 'SA');
        assert.equal(store.moveToParent('SA', 'A'), false);
    });

    test('promote re-evalúa al padre viejo (puede pasar a done)', () => {
        const store = newStore();
        store.add('A', () => 'A');
        store.addSubtask('A', 'hecha', () => 'S1');
        store.addSubtask('A', 'pendiente', () => 'S2');
        store.toggle('S1', true);
        assert.equal(store.tasks.find(t => t.id === 'A').done, false);
        store.moveToParent('S2', null);
        assert.equal(store.tasks.find(t => t.id === 'A').done, true);
    });

    test('re-parent re-evalúa al padre nuevo (puede re-abrir si estaba done)', () => {
        const store = newStore();
        store.add('A', () => 'A');
        store.add('B', () => 'B');
        store.addSubtask('B', 'sub-B', () => 'SB');
        store.toggle('B', true);
        assert.equal(store.tasks.find(t => t.id === 'B').done, true);
        store.addSubtask('A', 'pendiente', () => 'SA');
        store.moveToParent('SA', 'B');
        assert.equal(store.tasks.find(t => t.id === 'B').done, false);
    });

    test('actualiza updatedAt en la tarea movida', () => {
        const store = newStore();
        store.add('A', () => 'A');
        store.add('B', () => 'B');
        store.addSubtask('A', 'sub', () => 'SA');
        store.moveToParent('SA', 'B', undefined, 9999);
        assert.equal(store.tasks.find(t => t.id === 'SA').updatedAt, 9999);
    });
});

describe('TaskStore — subsOf', () => {
    test('devuelve sólo las subs del padre indicado, en orden', () => {
        const store = newStore();
        store.add('A', () => 'A');
        store.add('B', () => 'B');
        store.addSubtask('A', 'a1', () => 'A1');
        store.addSubtask('B', 'b1', () => 'B1');
        store.addSubtask('A', 'a2', () => 'A2');
        const subsA = store.subsOf('A').map(t => t.id);
        // En this.tasks el orden es: B, A, A2, A1, B1 (por unshifts).
        // subsOf devuelve en el orden de aparición en this.tasks.
        assert.deepEqual(subsA, ['A2', 'A1']);
        const subsB = store.subsOf('B').map(t => t.id);
        assert.deepEqual(subsB, ['B1']);
    });
});

describe('TaskStore — add con options (dueDate, priority)', () => {
    test('add legacy (función como 2do arg) sigue funcionando', () => {
        const store = newStore();
        const t = store.add('legacy', () => '1');
        assert.equal(t.id, '1');
        assert.equal(t.dueDate, undefined);
        assert.equal(t.priority, undefined);
    });

    test('add con options.dueDate setea el campo', () => {
        const store = newStore();
        const t = store.add('reunion', { dueDate: '2026-05-01', idFactory: () => '1' });
        assert.equal(t.dueDate, '2026-05-01');
    });

    test('add con options.priority=true setea el flag', () => {
        const store = newStore();
        const t = store.add('urgente', { priority: true, idFactory: () => '1' });
        assert.equal(t.priority, true);
    });

    test('add sin options.dueDate NO crea el campo (undefined)', () => {
        const store = newStore();
        const t = store.add('s/fecha', { idFactory: () => '1' });
        assert.equal('dueDate' in t, false);
    });

    test('add con options.priority=false NO crea el campo', () => {
        const store = newStore();
        const t = store.add('s/prio', { priority: false, idFactory: () => '1' });
        assert.equal('priority' in t, false);
    });
});

describe('TaskStore — setDueDate', () => {
    test('setea dueDate en una tarea top-level', () => {
        const store = newStore();
        store.add('x', () => '1');
        const ok = store.setDueDate('1', '2026-04-30', 50);
        assert.equal(ok, true);
        assert.equal(store.tasks[0].dueDate, '2026-04-30');
        assert.equal(store.tasks[0].updatedAt, 50);
    });

    test('limpia dueDate si recibe null/undefined', () => {
        const store = newStore();
        store.add('x', () => '1');
        store.setDueDate('1', '2026-04-30');
        store.setDueDate('1', null);
        assert.equal('dueDate' in store.tasks[0], false);
    });

    test('rechaza setDueDate sobre subtarea (solo top-level)', () => {
        const store = newStore();
        store.add('p', () => 'P');
        store.addSubtask('P', 's', () => 'S');
        const ok = store.setDueDate('S', '2026-04-30');
        assert.equal(ok, false);
        assert.equal('dueDate' in store.tasks.find(t => t.id === 'S'), false);
    });

    test('rechaza setDueDate sobre id inexistente', () => {
        const store = newStore();
        assert.equal(store.setDueDate('nope', '2026-04-30'), false);
    });

    test('persiste en el adapter', () => {
        const adapter = new MemoryStorageAdapter();
        const store = new TaskStore(adapter);
        store.add('x', () => '1');
        store.setDueDate('1', '2026-05-15');
        assert.equal(adapter.get().find(t => t.id === '1').dueDate, '2026-05-15');
    });
});

describe('TaskStore — togglePriority', () => {
    test('cambia false → true', () => {
        const store = newStore();
        store.add('x', () => '1');
        const ok = store.togglePriority('1', 100);
        assert.equal(ok, true);
        assert.equal(store.tasks[0].priority, true);
        assert.equal(store.tasks[0].updatedAt, 100);
    });

    test('cambia true → false en segunda llamada', () => {
        const store = newStore();
        store.add('x', { priority: true, idFactory: () => '1' });
        store.togglePriority('1');
        assert.equal(store.tasks[0].priority, false);
    });

    test('rechaza togglePriority sobre subtarea', () => {
        const store = newStore();
        store.add('p', () => 'P');
        store.addSubtask('P', 's', () => 'S');
        assert.equal(store.togglePriority('S'), false);
    });

    test('rechaza togglePriority sobre id inexistente', () => {
        const store = newStore();
        assert.equal(store.togglePriority('nope'), false);
    });
});
