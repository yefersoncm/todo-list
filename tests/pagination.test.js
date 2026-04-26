import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { paginate, ELLIPSIS } from '../pagination.js';

const E = ELLIPSIS;

describe('paginate — sin paginación', () => {
    test('totalPages = 0 → []', () => assert.deepEqual(paginate(0, 1), []));
    test('totalPages = 1 → []', () => assert.deepEqual(paginate(1, 1), []));
});

describe('paginate — totales pequeños (sin ellipsis)', () => {
    test('P=2, C=1', () => assert.deepEqual(paginate(2, 1), [1, 2]));
    test('P=2, C=2', () => assert.deepEqual(paginate(2, 2), [1, 2]));
    test('P=3, C=2', () => assert.deepEqual(paginate(3, 2), [1, 2, 3]));
    test('P=5, C=3', () => assert.deepEqual(paginate(5, 3), [1, 2, 3, 4, 5]));
    test('P=5, C=1', () => assert.deepEqual(paginate(5, 1), [1, 2, 3, 4, 5]));
    test('P=5, C=5', () => assert.deepEqual(paginate(5, 5), [1, 2, 3, 4, 5]));
});

describe('paginate — relleno de huecos de 1', () => {
    test('P=6, C=4: el hueco de 1 a la izquierda se rellena con [2]', () => {
        assert.deepEqual(paginate(6, 4), [1, 2, 3, 4, 5, 6]);
    });
    test('P=8, C=4: hueco izq de 1 (rellena 2), hueco der de 2 (ellipsis)', () => {
        assert.deepEqual(paginate(8, 4), [1, 2, 3, 4, 5, E, 8]);
    });
    test('P=8, C=5: hueco izq de 2 (ellipsis), hueco der de 1 (rellena 7)', () => {
        assert.deepEqual(paginate(8, 5), [1, E, 4, 5, 6, 7, 8]);
    });
});

describe('paginate — bordes con totales medianos', () => {
    test('P=6, C=1', () => assert.deepEqual(paginate(6, 1), [1, 2, 3, E, 6]));
    test('P=6, C=2', () => assert.deepEqual(paginate(6, 2), [1, 2, 3, E, 6]));
    test('P=6, C=3', () => assert.deepEqual(paginate(6, 3), [1, 2, 3, 4, 5, 6]));
    test('P=8, C=1', () => assert.deepEqual(paginate(8, 1), [1, 2, 3, E, 8]));
    test('P=8, C=8', () => assert.deepEqual(paginate(8, 8), [1, E, 6, 7, 8]));
});

describe('paginate — C=1 con centro literal (caben ambos elipsis)', () => {
    // Cuando current=1 y el centro literal del total deja >=2 páginas
    // ocultas a cada lado, se muestra el patrón [1] [...] [mid] [...] [P]
    // para permitir saltos largos desde la primera página.
    test('P=8, C=1 → fallback (left gap = 1 hidden, no cabe elipsis)', () => {
        assert.deepEqual(paginate(8, 1), [1, 2, 3, E, 8]);
    });
    test('P=9, C=1 → centro literal (4,5,6) con ambos elipsis (umbral)', () => {
        assert.deepEqual(paginate(9, 1), [1, E, 4, 5, 6, E, 9]);
    });
    test('P=10, C=1 → centro literal (4,5,6)', () => {
        assert.deepEqual(paginate(10, 1), [1, E, 4, 5, 6, E, 10]);
    });
    test('P=11, C=1 → centro literal (5,6,7)', () => {
        assert.deepEqual(paginate(11, 1), [1, E, 5, 6, 7, E, 11]);
    });
    // C=2 (no es el primer botón) NO aplica la regla — sigue con
    // ventana alrededor del current.
    test('P=10, C=2 → window alrededor del current, no centro literal', () => {
        assert.deepEqual(paginate(10, 2), [1, 2, 3, E, 10]);
    });
});

describe('paginate — totales grandes (P=100)', () => {
    test('C=1 → centro literal (49,50,51) con ambos elipsis', () => {
        assert.deepEqual(paginate(100, 1), [1, E, 49, 50, 51, E, 100]);
    });
    test('C=2', () => assert.deepEqual(paginate(100, 2), [1, 2, 3, E, 100]));
    test('C=3', () => assert.deepEqual(paginate(100, 3), [1, 2, 3, 4, E, 100]));
    test('C=4', () => assert.deepEqual(paginate(100, 4), [1, 2, 3, 4, 5, E, 100]));
    test('C=5', () => assert.deepEqual(paginate(100, 5), [1, E, 4, 5, 6, E, 100]));
    test('C=50 — caso central canónico', () => {
        assert.deepEqual(paginate(100, 50), [1, E, 49, 50, 51, E, 100]);
    });
    test('C=96', () => assert.deepEqual(paginate(100, 96), [1, E, 95, 96, 97, E, 100]));
    test('C=97', () => assert.deepEqual(paginate(100, 97), [1, E, 96, 97, 98, 99, 100]));
    test('C=98', () => assert.deepEqual(paginate(100, 98), [1, E, 97, 98, 99, 100]));
    test('C=99', () => assert.deepEqual(paginate(100, 99), [1, E, 98, 99, 100]));
    test('C=100', () => assert.deepEqual(paginate(100, 100), [1, E, 98, 99, 100]));
});
