/*
 * Cálculo y formato del tiempo transcurrido entre dos instantes.
 *
 * elapsedComponents(startTs, now): descompone la diferencia en
 * { years, months, days, hours, minutes, seconds } usando
 * aritmética de calendario real (no aproximaciones de 30 días).
 *
 * formatElapsed(parts): formatea como
 *   "1 Año, 3 Meses, 4 Días, 5 Horas, 30 Minutos y 55 Segundos"
 * - Omite componentes en cero.
 * - Plurales correctos en español.
 * - "y" antes del último; coma entre los demás.
 * - Cadena vacía si todos los componentes son cero.
 */

const UNITS = [
    ['years', 'Año', 'Años'],
    ['months', 'Mes', 'Meses'],
    ['days', 'Día', 'Días'],
    ['hours', 'Hora', 'Horas'],
    ['minutes', 'Minuto', 'Minutos'],
    ['seconds', 'Segundo', 'Segundos'],
];

export function elapsedComponents(startTs, now = new Date()) {
    const start = new Date(startTs);
    const target = new Date(now.getTime());
    if (target < start) {
        return { years: 0, months: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };
    }

    let years = target.getFullYear() - start.getFullYear();
    let months = target.getMonth() - start.getMonth();
    let days = target.getDate() - start.getDate();
    let hours = target.getHours() - start.getHours();
    let minutes = target.getMinutes() - start.getMinutes();
    let seconds = target.getSeconds() - start.getSeconds();

    if (seconds < 0) { seconds += 60; minutes -= 1; }
    if (minutes < 0) { minutes += 60; hours -= 1; }
    if (hours < 0) { hours += 24; days -= 1; }
    if (days < 0) {
        // Días del mes anterior al "target" (último día del mes pasado).
        const prevMonthDays = new Date(target.getFullYear(), target.getMonth(), 0).getDate();
        days += prevMonthDays;
        months -= 1;
    }
    if (months < 0) { months += 12; years -= 1; }

    return { years, months, days, hours, minutes, seconds };
}

export function formatElapsed(parts) {
    const tokens = [];
    for (const [key, sg, pl] of UNITS) {
        const n = parts[key];
        if (!n) continue;
        tokens.push(`${n} ${n === 1 ? sg : pl}`);
    }

    if (tokens.length === 0) return '';
    if (tokens.length === 1) return tokens[0];
    if (tokens.length === 2) return `${tokens[0]} y ${tokens[1]}`;
    return `${tokens.slice(0, -1).join(', ')} y ${tokens[tokens.length - 1]}`;
}
