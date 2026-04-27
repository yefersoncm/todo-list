import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { elapsedComponents, formatElapsed } from '../elapsed.js';

// Helper: construye Dates en hora LOCAL para que los tests funcionen
// en cualquier zona horaria (elapsedComponents usa getFullYear/Month/...
// que devuelven hora local).
const localDate = (y, m, d, h = 0, min = 0, s = 0) => new Date(y, m - 1, d, h, min, s);

describe('elapsedComponents — casos simples', () => {
    test('5 segundos atrás', () => {
        const start = localDate(2026, 4, 25, 12, 0, 0);
        const now = localDate(2026, 4, 25, 12, 0, 5);
        assert.deepEqual(elapsedComponents(start.getTime(), now), {
            years: 0, months: 0, days: 0, hours: 0, minutes: 0, seconds: 5,
        });
    });

    test('1 minuto exacto', () => {
        const start = localDate(2026, 4, 25, 12, 0, 0);
        const now = localDate(2026, 4, 25, 12, 1, 0);
        assert.deepEqual(elapsedComponents(start.getTime(), now), {
            years: 0, months: 0, days: 0, hours: 0, minutes: 1, seconds: 0,
        });
    });

    test('1 hora exacta', () => {
        const start = localDate(2026, 4, 25, 12, 0, 0);
        const now = localDate(2026, 4, 25, 13, 0, 0);
        assert.deepEqual(elapsedComponents(start.getTime(), now), {
            years: 0, months: 0, days: 0, hours: 1, minutes: 0, seconds: 0,
        });
    });

    test('1 día exacto', () => {
        const start = localDate(2026, 4, 24, 12, 0, 0);
        const now = localDate(2026, 4, 25, 12, 0, 0);
        assert.deepEqual(elapsedComponents(start.getTime(), now), {
            years: 0, months: 0, days: 1, hours: 0, minutes: 0, seconds: 0,
        });
    });
});

describe('elapsedComponents — préstamos entre componentes', () => {
    test('30 días en febrero (no bisiesto) cruza a marzo', () => {
        // start: feb 28 12:00, now: mar 1 12:00 → 1 día (feb 2026 tiene 28 días)
        const start = localDate(2026, 2, 28, 12, 0, 0);
        const now = localDate(2026, 3, 1, 12, 0, 0);
        assert.deepEqual(elapsedComponents(start.getTime(), now), {
            years: 0, months: 0, days: 1, hours: 0, minutes: 0, seconds: 0,
        });
    });

    test('1 año, 1 mes, 1 día, 1 hora, 1 minuto, 1 segundo', () => {
        const start = localDate(2025, 3, 24, 11, 58, 59);
        const now = localDate(2026, 4, 25, 13, 0, 0);
        assert.deepEqual(elapsedComponents(start.getTime(), now), {
            years: 1, months: 1, days: 1, hours: 1, minutes: 1, seconds: 1,
        });
    });

    test('exactamente 1 año (mismo mes y día)', () => {
        const start = localDate(2025, 4, 25, 12, 0, 0);
        const now = localDate(2026, 4, 25, 12, 0, 0);
        assert.deepEqual(elapsedComponents(start.getTime(), now), {
            years: 1, months: 0, days: 0, hours: 0, minutes: 0, seconds: 0,
        });
    });

    test('exactamente 1 mes', () => {
        const start = localDate(2026, 3, 25, 12, 0, 0);
        const now = localDate(2026, 4, 25, 12, 0, 0);
        assert.deepEqual(elapsedComponents(start.getTime(), now), {
            years: 0, months: 1, days: 0, hours: 0, minutes: 0, seconds: 0,
        });
    });

    test('start en el futuro → todos los componentes en cero', () => {
        const start = localDate(2027, 1, 1, 0, 0, 0);
        const now = localDate(2026, 4, 25, 12, 0, 0);
        assert.deepEqual(elapsedComponents(start.getTime(), now), {
            years: 0, months: 0, days: 0, hours: 0, minutes: 0, seconds: 0,
        });
    });
});

describe('formatElapsed — formato compacto (single-unit, español abreviado)', () => {
    const z = { years: 0, months: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };

    test('todo en cero → "ahora"', () => {
        assert.equal(formatElapsed(z), 'ahora');
    });

    test('solo segundos → "ahora" (sub-minuto se considera ahora)', () => {
        assert.equal(formatElapsed({ ...z, seconds: 5 }), 'ahora');
        assert.equal(formatElapsed({ ...z, seconds: 59 }), 'ahora');
    });

    test('minutos → "Nm"', () => {
        assert.equal(formatElapsed({ ...z, minutes: 1 }), '1m');
        assert.equal(formatElapsed({ ...z, minutes: 30 }), '30m');
        assert.equal(formatElapsed({ ...z, minutes: 59, seconds: 30 }), '59m');
    });

    test('horas → "Nh"', () => {
        assert.equal(formatElapsed({ ...z, hours: 1 }), '1h');
        assert.equal(formatElapsed({ ...z, hours: 23, minutes: 59 }), '23h');
    });

    test('días < 7 → "Nd"', () => {
        assert.equal(formatElapsed({ ...z, days: 1 }), '1d');
        assert.equal(formatElapsed({ ...z, days: 6, hours: 23 }), '6d');
    });

    test('días 7+ → "Nsem" (semanas, floor)', () => {
        assert.equal(formatElapsed({ ...z, days: 7 }), '1sem');
        assert.equal(formatElapsed({ ...z, days: 13 }), '1sem');
        assert.equal(formatElapsed({ ...z, days: 14 }), '2sem');
        assert.equal(formatElapsed({ ...z, days: 29 }), '4sem');
    });

    test('meses → "Nmes"', () => {
        assert.equal(formatElapsed({ ...z, months: 1 }), '1mes');
        assert.equal(formatElapsed({ ...z, months: 11 }), '11mes');
    });

    test('años → "Na" (mayor unidad gana, ignora el resto)', () => {
        assert.equal(formatElapsed({ ...z, years: 1 }), '1a');
        assert.equal(formatElapsed({ years: 1, months: 3, days: 4, hours: 5, minutes: 30, seconds: 55 }), '1a');
        assert.equal(formatElapsed({ ...z, years: 5 }), '5a');
    });

    test('parts null/undefined → cadena vacía', () => {
        assert.equal(formatElapsed(null), '');
        assert.equal(formatElapsed(undefined), '');
    });
});
