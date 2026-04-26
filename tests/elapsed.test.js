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

describe('formatElapsed — formato y plurales', () => {
    const z = { years: 0, months: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };

    test('todo en cero → cadena vacía', () => {
        assert.equal(formatElapsed(z), '');
    });

    test('un solo componente, plural', () => {
        assert.equal(formatElapsed({ ...z, seconds: 5 }), '5 Segundos');
    });

    test('un solo componente, singular', () => {
        assert.equal(formatElapsed({ ...z, seconds: 1 }), '1 Segundo');
    });

    test('dos componentes — usa "y" sin coma', () => {
        assert.equal(formatElapsed({ ...z, hours: 5, minutes: 30 }), '5 Horas y 30 Minutos');
    });

    test('tres componentes — coma + "y"', () => {
        assert.equal(formatElapsed({ ...z, days: 4, hours: 5, minutes: 30 }), '4 Días, 5 Horas y 30 Minutos');
    });

    test('seis componentes (caso máximo)', () => {
        assert.equal(
            formatElapsed({ years: 1, months: 3, days: 4, hours: 5, minutes: 30, seconds: 55 }),
            '1 Año, 3 Meses, 4 Días, 5 Horas, 30 Minutos y 55 Segundos'
        );
    });

    test('omite ceros intermedios', () => {
        assert.equal(formatElapsed({ ...z, years: 1, days: 5 }), '1 Año y 5 Días');
    });

    test('omite ceros al final (no muestra "0 Segundos")', () => {
        assert.equal(formatElapsed({ ...z, days: 1, hours: 2, minutes: 3 }), '1 Día, 2 Horas y 3 Minutos');
    });

    test('singulares en orden distinto: 1 Año, 1 Mes', () => {
        assert.equal(formatElapsed({ ...z, years: 1, months: 1 }), '1 Año y 1 Mes');
    });
});
