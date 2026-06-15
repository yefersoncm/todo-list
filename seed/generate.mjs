/*
 * Generador del archivo de pruebas (seed) para todo-list.
 *
 * Produce `seed/sample-1000.json` con el MISMO formato que exporta la app
 * (Ajustes → Exportar), de modo que se pueda importar directamente desde
 * Ajustes → Importar:
 *
 *   { app, version, tasks: [...], tagColors: {...} }
 *
 * El dataset incluye 1000 tareas top-level + subtareas:
 *   - algunas marcadas como favoritas (priority: true)
 *   - algunas con fecha de finalización (dueDate) — vencidas, hoy y futuras
 *   - algunas ya finalizadas (done: true), muchas creadas hace mucho tiempo
 *   - otras recién creadas
 *   - con etiquetas (tags) de una paleta fija
 *
 * Es DETERMINISTA (PRNG con semilla fija): re-ejecutarlo da el mismo archivo.
 *
 * Uso:  node seed/generate.mjs
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// "Hoy" de referencia para el dataset (fijo para reproducibilidad).
const NOW = new Date(2026, 5, 15, 9, 0, 0); // 2026-06-15 09:00 local
const NOW_MS = NOW.getTime();
const DAY = 86_400_000;

// ── PRNG determinista (mulberry32) ──
let _s = 0x9e3779b9;
function rnd() {
    _s |= 0; _s = (_s + 0x6D2B79F5) | 0;
    let t = Math.imul(_s ^ (_s >>> 15), 1 | _s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const chance = (p) => rnd() < p;
const intBetween = (a, b) => a + Math.floor(rnd() * (b - a + 1));

// ── Etiquetas y su color (réplica de TAG_PALETTE + autoTagColor de app.js) ──
const TAG_PALETTE = [
    'oklch(62% 0.17 245)', 'oklch(60% 0.16 200)', 'oklch(60% 0.15 150)',
    'oklch(70% 0.16 130)', 'oklch(74% 0.15 85)',  'oklch(68% 0.17 55)',
    'oklch(60% 0.19 25)',  'oklch(62% 0.19 350)', 'oklch(58% 0.20 300)',
    'oklch(56% 0.05 250)',
];
function autoTagColor(tag) {
    const s = String(tag).toLowerCase();
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return TAG_PALETTE[h % TAG_PALETTE.length];
}

// Categorías: cada una aporta etiquetas y frases de tarea realistas.
const CATEGORIES = [
    {
        tags: ['trabajo', 'proyecto'],
        phrases: [
            'Preparar la presentación para el cliente',
            'Revisar el pull request de {x}',
            'Cerrar el sprint y planear el siguiente',
            'Actualizar la documentación del API',
            'Responder los correos pendientes',
            'Agendar la reunión de seguimiento',
            'Desplegar la nueva versión a producción',
            'Escribir las pruebas unitarias de {x}',
            'Refactorizar el módulo de {x}',
            'Preparar el informe trimestral',
        ],
    },
    {
        tags: ['personal', 'salud'],
        phrases: [
            'Sacar cita con el dentista',
            'Salir a correr 5 km',
            'Tomar las vitaminas',
            'Renovar la membresía del gimnasio',
            'Agendar el chequeo médico anual',
            'Meditar 10 minutos',
            'Llamar a mamá',
            'Comprar lentes nuevos',
        ],
    },
    {
        tags: ['compras', 'hogar'],
        phrases: [
            'Comprar víveres para la semana',
            'Pagar la factura de la luz',
            'Cambiar el filtro del aire',
            'Reparar la llave del baño',
            'Comprar regalo de cumpleaños',
            'Ordenar el clóset',
            'Sacar la basura al reciclaje',
            'Regar las plantas',
            'Comprar café y filtros',
        ],
    },
    {
        tags: ['estudio', 'ideas'],
        phrases: [
            'Terminar el curso de {x}',
            'Leer un capítulo de {x}',
            'Tomar apuntes de la clase de {x}',
            'Practicar ejercicios de {x}',
            'Investigar sobre {x}',
            'Anotar idea para el proyecto de {x}',
            'Ver el tutorial de {x}',
        ],
    },
    {
        tags: ['finanzas', 'urgente'],
        phrases: [
            'Pagar la tarjeta de crédito',
            'Revisar el presupuesto del mes',
            'Declarar impuestos',
            'Transferir ahorros a la cuenta de inversión',
            'Cancelar la suscripción que no uso',
            'Revisar movimientos del banco',
        ],
    },
];

const FILL = ['React', 'historia', 'inglés', 'cocina', 'finanzas', 'diseño',
    'autenticación', 'reportes', 'el dashboard', 'pagos', 'Python', 'álgebra'];

function makeValue(cat) {
    let p = pick(cat.phrases);
    if (p.includes('{x}')) p = p.replace('{x}', pick(FILL));
    return p;
}

function toISO(ms) {
    const d = new Date(ms);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
}

// ── Generación ──
const N = 1000;
const tasks = [];
const usedTags = new Set();

for (let i = 0; i < N; i++) {
    // Distribución temporal: ~30% recientes (últimos 30 días), el resto
    // repartido en ~2 años hacia atrás ("hace mucho").
    let ageDays;
    if (chance(0.30)) ageDays = intBetween(0, 30);
    else ageDays = intBetween(31, 730);
    // Pequeño jitter horario para que los ids sean únicos.
    const createdMs = NOW_MS - ageDays * DAY - intBetween(0, DAY - 1);
    const id = String(createdMs);

    const cat = pick(CATEGORIES);
    const value = makeValue(cat);

    // Las tareas viejas tienen más probabilidad de estar finalizadas.
    const doneProb = ageDays > 120 ? 0.7 : ageDays > 30 ? 0.4 : 0.15;
    const done = chance(doneProb);

    const task = {
        id,
        value,
        done,
        updatedAt: done ? createdMs + intBetween(1, 20) * DAY : createdMs,
        parentId: null,
    };

    // Favoritas (priority) ~15%.
    if (chance(0.15)) task.priority = true;

    // Fecha de finalización ~45%: mezcla vencidas / hoy / futuras.
    if (chance(0.45)) {
        const roll = rnd();
        let dueMs;
        if (roll < 0.45) dueMs = NOW_MS - intBetween(1, 120) * DAY;       // vencida
        else if (roll < 0.55) dueMs = NOW_MS;                            // hoy
        else dueMs = NOW_MS + intBetween(1, 90) * DAY;                   // futura
        task.dueDate = toISO(dueMs);
    }

    // Etiquetas ~65%: 1–3 de la categoría (+ a veces 'urgente').
    if (chance(0.65)) {
        // pool ÚNICO (evita bucle infinito si 'urgente' ya está en la categoría).
        const pool = [...new Set(chance(0.2) ? [...cat.tags, 'urgente'] : cat.tags)];
        const n = intBetween(1, Math.min(3, pool.length));
        const tagsSet = new Set();
        while (tagsSet.size < n) tagsSet.add(pick(pool));
        task.tags = [...tagsSet];
        task.tags.forEach(t => usedTags.add(t));
    }

    tasks.push(task);

    // Subtareas ~25% de los padres: 1–4. (Sin tags/dueDate; 1 nivel.)
    if (chance(0.25)) {
        const subCount = intBetween(1, 4);
        let allSubsDone = true;
        const subs = [];
        for (let s = 0; s < subCount; s++) {
            const subMs = createdMs + (s + 1) * intBetween(1, 6) * 3600_000;
            const subDone = done ? true : chance(0.4);
            if (!subDone) allSubsDone = false;
            subs.push({
                id: String(subMs),
                value: `Paso ${s + 1}: ${pick(['preparar', 'revisar', 'enviar', 'confirmar', 'documentar', 'probar'])}`,
                done: subDone,
                updatedAt: subMs,
                parentId: id,
            });
        }
        // Coherencia con la regla del store: si todas las subs están done,
        // el padre queda done; si alguna pendiente, el padre pendiente.
        task.done = allSubsDone;
        // Insertar subs justo después del padre (orden [padre, ...subs]).
        tasks.push(...subs);
    }
}

const tagColors = {};
for (const t of usedTags) tagColors[t] = autoTagColor(t);

const payload = {
    app: 'todo-list',
    version: '1.2.2',
    tasks,
    tagColors,
};

const out = join(__dirname, 'sample-1000.json');
writeFileSync(out, JSON.stringify(payload, null, 2), 'utf8');

const parents = tasks.filter(t => t.parentId === null);
console.log(`OK → ${out}`);
console.log(`  top-level: ${parents.length}`);
console.log(`  subtareas: ${tasks.length - parents.length}`);
console.log(`  total ítems: ${tasks.length}`);
console.log(`  favoritas: ${parents.filter(t => t.priority).length}`);
console.log(`  con fecha: ${parents.filter(t => t.dueDate).length}`);
console.log(`  finalizadas: ${parents.filter(t => t.done).length}`);
console.log(`  con etiquetas: ${parents.filter(t => t.tags).length}`);
console.log(`  etiquetas distintas: ${Object.keys(tagColors).length}`);
