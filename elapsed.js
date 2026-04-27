/*
 * Cálculo y formato del tiempo transcurrido entre dos instantes.
 *
 * elapsedComponents(startTs, now): descompone la diferencia en
 * { years, months, days, hours, minutes, seconds } usando
 * aritmética de calendario real (no aproximaciones de 30 días).
 *
 * formatElapsed(parts): devuelve un string COMPACTO con solo la unidad
 * mayor significativa, en español abreviado:
 *   "ahora" / "5m" / "3h" / "2d" / "2sem" / "5mes" / "2a"
 * Diseño compacto para que quepa en metadata de tareas en cualquier
 * viewport sin truncar.
 */

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
    if (!parts) return '';
    const { years, months, days, hours, minutes } = parts;
    if (years > 0) return `${years}a`;
    if (months > 0) return `${months}mes`;
    // 7+ días = semanas; redondeo hacia abajo (8 días → 1sem, 14 → 2sem).
    if (days >= 7) return `${Math.floor(days / 7)}sem`;
    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    if (minutes > 0) return `${minutes}m`;
    return 'ahora';
}
